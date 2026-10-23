import fs from 'fs';
import path from 'path';
import { normalizeArabicText, findMatchesWithSnippets, findMatchesWithSnippetsOptimized } from './arabic';

export interface HighlightCategory {
  id: string;
  name: string;
  colorHex: string;
  description?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  format: 'pdf' | 'epub' | 'txt' | 'docx';
  fileSize: number;
  fileName: string;
  filePath: string;
  coverUrl?: string;
  collectionId: string | null;
  pageCount: number;
  status: 'ready' | 'processing' | 'error';
  isOcr: boolean;
  ocrStatus: 'none' | 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  createdAt: string;
}

export interface BookPageText {
  id: string;
  bookId: string;
  pageNumber: number;
  textContent: string;
  normalizedText: string;
}

export interface Highlight {
  id: string;
  bookId: string;
  categoryId: string; // Foreign key to HighlightCategory
  pageNumber: number;
  text: string;
  positionData: any; // PDF rects, EPUB CFI/offset, TXT char index
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Bookmark {
  id: string;
  bookId: string;
  pageNumber: number;
  positionData?: any;
  title: string;
  textSnippet: string;
  createdAt: string;
}

export interface Note {
  id: string;
  bookId: string;
  pageNumber: number;
  text: string;
  snippet?: string;
  highlightId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingProgress {
  bookId: string;
  currentPage: number;
  totalPages: number;
  percentage: number;
  lastPosition?: any;
  updatedAt: string;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'sepia';
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  viewMode: 'single' | 'double' | 'continuous';
  autoSaveProgress: boolean;
}

interface DatabaseSchema {
  categories: HighlightCategory[];
  books: Book[];
  collections: Collection[];
  bookTexts: BookPageText[];
  highlights: Highlight[];
  bookmarks: Bookmark[];
  notes: Note[];
  progress: Record<string, ReadingProgress>;
  settings: UserSettings;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'library.json');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const BOOKS_DIR = path.join(UPLOADS_DIR, 'books');
const COVERS_DIR = path.join(UPLOADS_DIR, 'covers');

// Ensure storage directories exist
function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(BOOKS_DIR)) fs.mkdirSync(BOOKS_DIR, { recursive: true });
  if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true });
}

// Initial default categories as specified by the user
const DEFAULT_CATEGORIES: HighlightCategory[] = [
  {
    id: 'cat_important',
    name: 'معلومات مهمة',
    colorHex: '#EF4444',
    description: 'المعلومات التي أريد الرجوع إليها بسرعة',
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cat_religious',
    name: 'معلومات دينية',
    colorHex: '#10B981',
    description: 'النصوص والمعلومات الدينية',
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cat_history',
    name: 'معلومات تاريخية',
    colorHex: '#3B82F6',
    description: 'الأحداث والتواريخ والمعلومات التاريخية',
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cat_definitions',
    name: 'تعريفات ومصطلحات',
    colorHex: '#F59E0B',
    description: 'التعريفات والمفاهيم المهمة',
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cat_quotes',
    name: 'اقتباسات مميزة',
    colorHex: '#8B5CF6',
    description: 'العبارات التي أريد الاحتفاظ بها',
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cat_review',
    name: 'يحتاج إلى مراجعة',
    colorHex: '#F97316',
    description: 'النصوص التي أريد العودة إليها لاحقًا',
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'dark',
  fontFamily: 'Cairo',
  fontSize: 18,
  lineHeight: 1.8,
  viewMode: 'single',
  autoSaveProgress: true,
};

function getInitialDB(): DatabaseSchema {
  return {
    categories: [...DEFAULT_CATEGORIES],
    books: [],
    collections: [
      {
        id: 'col_general',
        name: 'عام',
        description: 'المجموعة العامة للكتب',
        color: '#6366f1',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'col_favorites',
        name: 'المفضلة',
        description: 'كتبي المفضلة والمختارة',
        color: '#ec4899',
        createdAt: new Date().toISOString(),
      },
    ],
    bookTexts: [],
    highlights: [],
    bookmarks: [],
    notes: [],
    progress: {},
    settings: { ...DEFAULT_SETTINGS },
  };
}

// In-memory cache + persistent write-through
const globalForDb = globalThis as unknown as { __app_memory_db?: DatabaseSchema };

function loadDB(): DatabaseSchema {
  ensureDirectories();
  if (globalForDb.__app_memory_db) return globalForDb.__app_memory_db;

  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const loaded: DatabaseSchema = JSON.parse(data);
      if (!loaded.categories || loaded.categories.length === 0) {
        loaded.categories = [...DEFAULT_CATEGORIES];
      }
      globalForDb.__app_memory_db = loaded;
      return loaded;
    } catch (err) {
      console.error('Error reading DB, using initial default', err);
    }
  }

  const initial = getInitialDB();
  globalForDb.__app_memory_db = initial;
  saveDB();
  return initial;
}

function saveDB(): void {
  ensureDirectories();
  const current = globalForDb.__app_memory_db;
  if (!current) return;
  const tempFile = `${DB_FILE}.tmp`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(current, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error writing DB file', err);
  }
}

export const db = {
  // Categories
  categories: {
    getAll(): HighlightCategory[] {
      return loadDB().categories;
    },
    getById(id: string): HighlightCategory | undefined {
      return loadDB().categories.find((c) => c.id === id);
    },
    create(data: { name: string; colorHex: string; description?: string }): HighlightCategory {
      const current = loadDB();
      const newCat: HighlightCategory = {
        id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: data.name.trim(),
        colorHex: data.colorHex.trim(),
        description: data.description?.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      current.categories.push(newCat);
      saveDB();
      return newCat;
    },
    update(id: string, data: { name?: string; colorHex?: string; description?: string }): HighlightCategory | null {
      const current = loadDB();
      const cat = current.categories.find((c) => c.id === id);
      if (!cat) return null;
      if (data.name !== undefined) cat.name = data.name.trim();
      if (data.colorHex !== undefined) cat.colorHex = data.colorHex.trim();
      if (data.description !== undefined) cat.description = data.description.trim();
      cat.updatedAt = new Date().toISOString();
      saveDB();
      return cat;
    },
    delete(id: string, reassignToCategoryId?: string): { success: boolean; reassignedCount: number } {
      const current = loadDB();
      const index = current.categories.findIndex((c) => c.id === id);
      if (index === -1) return { success: false, reassignedCount: 0 };

      // Update associated highlights to avoid deleting user highlights
      let reassignedCount = 0;
      current.highlights.forEach((h) => {
        if (h.categoryId === id) {
          h.categoryId = reassignToCategoryId || 'cat_important'; // Default or uncategorized
          h.updatedAt = new Date().toISOString();
          reassignedCount++;
        }
      });

      current.categories.splice(index, 1);
      saveDB();
      return { success: true, reassignedCount };
    },
  },

  // Books
  books: {
    getAll(): (Book & { readingProgress?: ReadingProgress })[] {
      const current = loadDB();
      return current.books.map((b) => ({
        ...b,
        readingProgress: current.progress[b.id] || undefined,
      }));
    },
    getById(id: string): (Book & { readingProgress?: ReadingProgress }) | null {
      const current = loadDB();
      const book = current.books.find((b) => b.id === id);
      if (!book) return null;
      return {
        ...book,
        readingProgress: current.progress[book.id] || undefined,
      };
    },
    create(data: Omit<Book, 'createdAt' | 'updatedAt'>): Book {
      const current = loadDB();
      const now = new Date().toISOString();
      const newBook: Book = {
        ...data,
        createdAt: now,
        updatedAt: now,
      };
      current.books.unshift(newBook);
      saveDB();
      return newBook;
    },
    update(id: string, data: Partial<Book>): Book | null {
      const current = loadDB();
      const book = current.books.find((b) => b.id === id);
      if (!book) return null;
      Object.assign(book, data, { updatedAt: new Date().toISOString() });
      saveDB();
      return book;
    },
    delete(id: string): { success: boolean } {
      const current = loadDB();
      const index = current.books.findIndex((b) => b.id === id);
      if (index === -1) return { success: false };

      const book = current.books[index];
      // Clean up physical file if it exists
      if (book.filePath && fs.existsSync(book.filePath)) {
        try {
          fs.unlinkSync(book.filePath);
        } catch (e) {
          console.error('Error removing book file', e);
        }
      }

      current.books.splice(index, 1);
      // Clean associated data
      current.bookTexts = current.bookTexts.filter((t) => t.bookId !== id);
      current.highlights = current.highlights.filter((h) => h.bookId !== id);
      current.bookmarks = current.bookmarks.filter((bm) => bm.bookId !== id);
      current.notes = current.notes.filter((n) => n.bookId !== id);
      delete current.progress[id];

      saveDB();
      return { success: true };
    },
  },

  // Book Texts & Full-text Search
  bookTexts: {
    savePages(bookId: string, pages: { pageNumber: number; textContent: string }[]): void {
      const current = loadDB();
      // Remove previous pages if any
      current.bookTexts = current.bookTexts.filter((p) => p.bookId !== bookId);
      pages.forEach((p) => {
        current.bookTexts.push({
          id: `txt_${bookId}_${p.pageNumber}`,
          bookId,
          pageNumber: p.pageNumber,
          textContent: p.textContent,
          normalizedText: normalizeArabicText(p.textContent),
        });
      });
      saveDB();
    },
    saveSinglePage(bookId: string, pageNumber: number, textContent: string): void {
      const current = loadDB();
      const existing = current.bookTexts.find((p) => p.bookId === bookId && p.pageNumber === pageNumber);
      if (existing) {
        existing.textContent = textContent;
        existing.normalizedText = normalizeArabicText(textContent);
      } else {
        current.bookTexts.push({
          id: `txt_${bookId}_${pageNumber}`,
          bookId,
          pageNumber,
          textContent,
          normalizedText: normalizeArabicText(textContent),
        });
      }
      saveDB();
    },
    getPage(bookId: string, pageNumber: number): BookPageText | undefined {
      return loadDB().bookTexts.find((p) => p.bookId === bookId && p.pageNumber === pageNumber);
    },
    getAllPages(bookId: string): BookPageText[] {
      return loadDB().bookTexts.filter((p) => p.bookId === bookId);
    },
    searchInBook(bookId: string, query: string) {
      const current = loadDB();
      const pages = current.bookTexts.filter((p) => p.bookId === bookId);
      const results: {
        pageNumber: number;
        matches: { index: number; snippet: string; exactMatch: string }[];
      }[] = [];

      const trimmed = (query || '').trim();
      const normQuery = normalizeArabicText(trimmed);
      if (!normQuery) return results;

      for (const page of pages) {
        const matches = findMatchesWithSnippetsOptimized(
          page.textContent,
          page.normalizedText,
          normQuery,
          trimmed
        );
        if (matches.length > 0) {
          results.push({
            pageNumber: page.pageNumber,
            matches,
          });
        }
      }

      return results;
    },
    searchGlobal(query: string, collectionId?: string) {
      const current = loadDB();
      const bookMap = new Map<string, Book>();
      current.books.forEach((b) => {
        if (!collectionId || b.collectionId === collectionId) {
          bookMap.set(b.id, b);
        }
      });

      const bookResults: {
        book: Book;
        totalMatches: number;
        pages: {
          pageNumber: number;
          matches: { index: number; snippet: string; exactMatch: string }[];
        }[];
      }[] = [];

      const trimmed = (query || '').trim();
      const normQuery = normalizeArabicText(trimmed);
      if (!normQuery) return bookResults;

      for (const [bId, book] of bookMap.entries()) {
        const pages = current.bookTexts.filter((p) => p.bookId === bId);
        let bookMatchCount = 0;
        const pageMatches: {
          pageNumber: number;
          matches: { index: number; snippet: string; exactMatch: string }[];
        }[] = [];

        for (const page of pages) {
          const matches = findMatchesWithSnippetsOptimized(
            page.textContent,
            page.normalizedText,
            normQuery,
            trimmed
          );
          if (matches.length > 0) {
            bookMatchCount += matches.length;
            pageMatches.push({
              pageNumber: page.pageNumber,
              matches,
            });
          }
        }

        if (bookMatchCount > 0) {
          bookResults.push({
            book,
            totalMatches: bookMatchCount,
            pages: pageMatches,
          });
        }
      }

      return bookResults;
    },
  },

  // Highlights
  highlights: {
    getAll(): (Highlight & { category?: HighlightCategory; bookTitle?: string })[] {
      const current = loadDB();
      const catMap = new Map(current.categories.map((c) => [c.id, c]));
      const bookMap = new Map(current.books.map((b) => [b.id, b.title]));

      return current.highlights.map((h) => ({
        ...h,
        category: catMap.get(h.categoryId),
        bookTitle: bookMap.get(h.bookId) || 'كتاب غير معروف',
      }));
    },
    getByBook(bookId: string): (Highlight & { category?: HighlightCategory })[] {
      const current = loadDB();
      const catMap = new Map(current.categories.map((c) => [c.id, c]));
      return current.highlights
        .filter((h) => h.bookId === bookId)
        .map((h) => ({
          ...h,
          category: catMap.get(h.categoryId),
        }));
    },
    create(data: Omit<Highlight, 'id' | 'createdAt' | 'updatedAt'>): Highlight {
      const current = loadDB();
      const now = new Date().toISOString();
      const newH: Highlight = {
        id: `hl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        ...data,
        createdAt: now,
        updatedAt: now,
      };
      current.highlights.push(newH);
      saveDB();
      return newH;
    },
    update(id: string, data: Partial<Highlight>): Highlight | null {
      const current = loadDB();
      const hl = current.highlights.find((h) => h.id === id);
      if (!hl) return null;
      Object.assign(hl, data, { updatedAt: new Date().toISOString() });
      saveDB();
      return hl;
    },
    delete(id: string): boolean {
      const current = loadDB();
      const idx = current.highlights.findIndex((h) => h.id === id);
      if (idx === -1) return false;
      current.highlights.splice(idx, 1);
      saveDB();
      return true;
    },
  },

  // Bookmarks
  bookmarks: {
    getAll(): (Bookmark & { bookTitle?: string })[] {
      const current = loadDB();
      const bookMap = new Map(current.books.map((b) => [b.id, b.title]));
      return current.bookmarks.map((bm) => ({
        ...bm,
        bookTitle: bookMap.get(bm.bookId) || 'كتاب غير معروف',
      }));
    },
    getByBook(bookId: string): Bookmark[] {
      return loadDB().bookmarks.filter((bm) => bm.bookId === bookId);
    },
    create(data: Omit<Bookmark, 'id' | 'createdAt'>): Bookmark {
      const current = loadDB();
      const newBm: Bookmark = {
        id: `bm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        ...data,
        createdAt: new Date().toISOString(),
      };
      current.bookmarks.push(newBm);
      saveDB();
      return newBm;
    },
    delete(id: string): boolean {
      const current = loadDB();
      const idx = current.bookmarks.findIndex((b) => b.id === id);
      if (idx === -1) return false;
      current.bookmarks.splice(idx, 1);
      saveDB();
      return true;
    },
  },

  // Notes
  notes: {
    getAll(): (Note & { bookTitle?: string })[] {
      const current = loadDB();
      const bookMap = new Map(current.books.map((b) => [b.id, b.title]));
      return current.notes.map((n) => ({
        ...n,
        bookTitle: bookMap.get(n.bookId) || 'كتاب غير معروف',
      }));
    },
    getByBook(bookId: string): Note[] {
      return loadDB().notes.filter((n) => n.bookId === bookId);
    },
    create(data: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Note {
      const current = loadDB();
      const now = new Date().toISOString();
      const newNote: Note = {
        id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        ...data,
        createdAt: now,
        updatedAt: now,
      };
      current.notes.push(newNote);
      saveDB();
      return newNote;
    },
    update(id: string, data: Partial<Note>): Note | null {
      const current = loadDB();
      const note = current.notes.find((n) => n.id === id);
      if (!note) return null;
      Object.assign(note, data, { updatedAt: new Date().toISOString() });
      saveDB();
      return note;
    },
    delete(id: string): boolean {
      const current = loadDB();
      const idx = current.notes.findIndex((n) => n.id === id);
      if (idx === -1) return false;
      current.notes.splice(idx, 1);
      saveDB();
      return true;
    },
  },

  // Collections
  collections: {
    getAll(): (Collection & { bookCount: number })[] {
      const current = loadDB();
      const counts = new Map<string, number>();
      current.books.forEach((b) => {
        if (b.collectionId) {
          counts.set(b.collectionId, (counts.get(b.collectionId) || 0) + 1);
        }
      });
      return current.collections.map((c) => ({
        ...c,
        bookCount: counts.get(c.id) || 0,
      }));
    },
    create(data: { name: string; description?: string; color?: string; icon?: string }): Collection {
      const current = loadDB();
      const newCol: Collection = {
        id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: data.name.trim(),
        description: data.description?.trim(),
        color: data.color || '#6366f1',
        icon: data.icon || 'folder',
        createdAt: new Date().toISOString(),
      };
      current.collections.push(newCol);
      saveDB();
      return newCol;
    },
    update(id: string, data: Partial<Collection>): Collection | null {
      const current = loadDB();
      const col = current.collections.find((c) => c.id === id);
      if (!col) return null;
      Object.assign(col, data);
      saveDB();
      return col;
    },
    delete(id: string): boolean {
      const current = loadDB();
      const idx = current.collections.findIndex((c) => c.id === id);
      if (idx === -1) return false;
      // Untag books in this collection
      current.books.forEach((b) => {
        if (b.collectionId === id) b.collectionId = null;
      });
      current.collections.splice(idx, 1);
      saveDB();
      return true;
    },
  },

  // Reading Progress
  progress: {
    get(bookId: string): ReadingProgress | undefined {
      return loadDB().progress[bookId];
    },
    save(bookId: string, data: { currentPage: number; totalPages: number; lastPosition?: any }): ReadingProgress {
      const current = loadDB();
      const totalPages = Math.max(1, data.totalPages);
      const currentPage = Math.min(Math.max(1, data.currentPage), totalPages);
      const percentage = Math.round((currentPage / totalPages) * 100);

      const prog: ReadingProgress = {
        bookId,
        currentPage,
        totalPages,
        percentage,
        lastPosition: data.lastPosition,
        updatedAt: new Date().toISOString(),
      };

      current.progress[bookId] = prog;
      saveDB();
      return prog;
    },
  },

  // Settings
  settings: {
    get(): UserSettings {
      return loadDB().settings || DEFAULT_SETTINGS;
    },
    update(data: Partial<UserSettings>): UserSettings {
      const current = loadDB();
      current.settings = { ...current.settings, ...data };
      saveDB();
      return current.settings;
    },
  },
};
