/**
 * BookWeb - Client-Side Database Engine
 * Compatible with GitHub Pages & Static Hosting
 * Powered by high-speed memory indexing and lightweight localStorage persistence.
 */

// Arabic Text Normalization Helpers
function stripArabicDiacritics(text) {
  if (!text) return '';
  return text.replace(/[\u064B-\u065F\u0670]/g, '').replace(/\u0640/g, '');
}

function normalizeArabicText(text) {
  if (!text) return '';
  let normalized = stripArabicDiacritics(text);
  normalized = normalized.replace(/[إأآٱآ]/g, 'ا');
  normalized = normalized.replace(/ة/g, 'ه');
  normalized = normalized.replace(/ى/g, 'ي');
  return normalized.replace(/\s+/g, ' ').trim().toLowerCase();
}

function findMatchesWithSnippets(fullText, normText, normQuery, origQuery, snippetRadius = 70) {
  if (!fullText || !normQuery) return [];
  const textNorm = normText || normalizeArabicText(fullText);
  if (!textNorm || !textNorm.includes(normQuery)) return [];

  const matches = [];
  let startIndex = 0;
  const ratio = fullText.length / Math.max(1, textNorm.length);

  while (startIndex < textNorm.length && matches.length < 15) {
    const foundIndex = textNorm.indexOf(normQuery, startIndex);
    if (foundIndex === -1) break;

    const approxOrigPos = Math.floor(foundIndex * ratio);
    const snipStart = Math.max(0, approxOrigPos - snippetRadius);
    const snipEnd = Math.min(fullText.length, approxOrigPos + origQuery.length + snippetRadius);
    let snippet = fullText.substring(snipStart, snipEnd).replace(/\n/g, ' ');

    if (snipStart > 0) snippet = '...' + snippet;
    if (snipEnd < fullText.length) snippet = snippet + '...';

    matches.push({
      snippet,
      matchIndex: foundIndex
    });

    startIndex = foundIndex + normQuery.length;
  }

  return matches;
}

class LibraryDatabase {
  constructor() {
    this.USER_STORAGE_KEY = 'bookweb_user_data_v2';
    this.LEGACY_STORAGE_KEY = 'bookweb_library_v1';
    this.data = {
      categories: [],
      books: [],
      collections: [],
      bookTexts: [],
      highlights: [],
      bookmarks: [],
      notes: [],
      progress: {}
    };
    this.pageMap = new Map();
    this.bookPagesMap = new Map();
    this.init();
  }

  init() {
    // 1. Load static master library data
    const staticData = window.__BOOKWEB_STATIC_DATA__ || {};

    const defaultCategories = staticData.categories || [
      { id: "cat_important", name: "معلومات مهمة", colorHex: "#EF4444", description: "المعلومات التي أريد الرجوع إليها بسرعة", isDefault: true },
      { id: "cat_religious", name: "معلومات دينية", colorHex: "#10B981", description: "النصوص والمعلومات الدينية", isDefault: true },
      { id: "cat_history", name: "معلومات تاريخية", colorHex: "#3B82F6", description: "الأحداث والتواريخ والمعلومات التاريخية", isDefault: true },
      { id: "cat_definitions", name: "تعريفات ومصطلحات", colorHex: "#F59E0B", description: "التعريفات والمفاهيم المهمة", isDefault: true },
      { id: "cat_quotes", name: "اقتباسات مميزة", colorHex: "#8B5CF6", description: "العبارات التي أريد الاحتفاظ بها", isDefault: true },
      { id: "cat_review", name: "يحتاج إلى مراجعة", colorHex: "#F97316", description: "النصوص التي أريد العودة إليها لاحقًا", isDefault: true },
      { id: "cat_1792763603637_ougkt", name: "بلاغة وإعجاز بياني", colorHex: "#0D9488", description: "تم تحديث الاسم واللون" },
      { id: "cat_1792769581769_54p72", name: "البطولات", colorHex: "#5f1282", description: "النصوص" }
    ];

    const defaultCollections = staticData.collections || [
      { id: "col_general", name: "عام", description: "المجموعة العامة للكتب", color: "#6366f1" },
      { id: "col_favorites", name: "المفضلة", description: "كتبي المفضلة والمختارة", color: "#ec4899" }
    ];

    this.data.categories = JSON.parse(JSON.stringify(defaultCategories));
    this.data.collections = JSON.parse(JSON.stringify(defaultCollections));
    this.data.books = JSON.parse(JSON.stringify(staticData.books || []));
    this.data.bookTexts = staticData.bookTexts || [];

    // Build fast lookup maps
    this.rebuildPageMaps();

    // 2. Load user annotations (highlights, bookmarks, notes, progress, custom categories)
    this.loadUserData();
  }

  rebuildPageMaps() {
    this.pageMap.clear();
    this.bookPagesMap.clear();

    for (let i = 0; i < this.data.bookTexts.length; i++) {
      const p = this.data.bookTexts[i];
      const key = p.bookId + '_' + p.pageNumber;
      this.pageMap.set(key, p);

      let list = this.bookPagesMap.get(p.bookId);
      if (!list) {
        list = [];
        this.bookPagesMap.set(p.bookId, list);
      }
      list.push(p);
    }

    // Sort book pages by pageNumber
    for (const [_, list] of this.bookPagesMap.entries()) {
      list.sort((a, b) => a.pageNumber - b.pageNumber);
    }
  }

  loadUserData() {
    try {
      let userData = null;
      const stored = localStorage.getItem(this.USER_STORAGE_KEY);

      if (stored) {
        userData = JSON.parse(stored);
      } else {
        // Try to migrate from legacy storage
        const legacyStored = localStorage.getItem(this.LEGACY_STORAGE_KEY);
        if (legacyStored) {
          try {
            const legacy = JSON.parse(legacyStored);
            userData = {
              highlights: legacy.highlights || [],
              bookmarks: legacy.bookmarks || [],
              notes: legacy.notes || [],
              progress: legacy.progress || {},
              customCategories: (legacy.categories || []).filter(c => !c.isDefault && !this.data.categories.some(dc => dc.id === c.id))
            };
          } catch (e) {
            console.warn('Could not migrate legacy storage', e);
          }
        }
      }

      if (userData) {
        if (Array.isArray(userData.highlights)) this.data.highlights = userData.highlights;
        if (Array.isArray(userData.bookmarks)) this.data.bookmarks = userData.bookmarks;
        if (Array.isArray(userData.notes)) this.data.notes = userData.notes;
        if (userData.progress && typeof userData.progress === 'object') this.data.progress = userData.progress;

        // Merge custom categories
        if (Array.isArray(userData.customCategories)) {
          userData.customCategories.forEach(uc => {
            const existingIdx = this.data.categories.findIndex(c => c.id === uc.id);
            if (existingIdx !== -1) {
              this.data.categories[existingIdx] = uc;
            } else {
              this.data.categories.push(uc);
            }
          });
        }
      }
    } catch (e) {
      console.warn('Error loading user data from localStorage', e);
    }
  }

  save() {
    try {
      const userData = {
        highlights: this.data.highlights || [],
        bookmarks: this.data.bookmarks || [],
        notes: this.data.notes || [],
        progress: this.data.progress || {},
        customCategories: (this.data.categories || []).filter(c => !c.isDefault)
      };
      localStorage.setItem(this.USER_STORAGE_KEY, JSON.stringify(userData));
    } catch (e) {
      console.error('Failed to save user data to localStorage', e);
    }
  }

  // Categories
  getCategories() {
    return this.data.categories || [];
  }

  getCategory(id) {
    return this.getCategories().find(c => c.id === id);
  }

  saveCategory(cat) {
    if (!cat.id) {
      cat.id = 'cat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      cat.createdAt = new Date().toISOString();
      this.data.categories.push(cat);
    } else {
      const idx = this.data.categories.findIndex(c => c.id === cat.id);
      if (idx !== -1) {
        this.data.categories[idx] = { ...this.data.categories[idx], ...cat, updatedAt: new Date().toISOString() };
      }
    }
    this.save();
    return cat;
  }

  deleteCategory(id) {
    this.data.categories = this.data.categories.filter(c => c.id !== id);
    this.save();
  }

  // Books
  getBooks() {
    return (this.data.books || []).map(b => ({
      ...b,
      readingProgress: (this.data.progress && this.data.progress[b.id]) || b.readingProgress
    }));
  }

  getBook(id) {
    const book = (this.data.books || []).find(b => b.id === id);
    if (!book) return null;
    return {
      ...book,
      readingProgress: (this.data.progress && this.data.progress[id]) || book.readingProgress
    };
  }

  saveBook(book) {
    const idx = this.data.books.findIndex(b => b.id === book.id);
    if (idx !== -1) {
      this.data.books[idx] = { ...this.data.books[idx], ...book, updatedAt: new Date().toISOString() };
    } else {
      this.data.books.unshift(book);
    }
    this.save();
    return book;
  }

  deleteBook(id) {
    this.data.books = this.data.books.filter(b => b.id !== id);
    if (this.data.highlights) this.data.highlights = this.data.highlights.filter(h => h.bookId !== id);
    if (this.data.bookmarks) this.data.bookmarks = this.data.bookmarks.filter(bm => bm.bookId !== id);
    if (this.data.notes) this.data.notes = this.data.notes.filter(n => n.bookId !== id);
    if (this.data.progress && this.data.progress[id]) delete this.data.progress[id];
    this.save();
  }

  // Collections
  getCollections() {
    const counts = {};
    (this.data.books || []).forEach(b => {
      if (b.collectionId) {
        counts[b.collectionId] = (counts[b.collectionId] || 0) + 1;
      }
    });
    return (this.data.collections || []).map(c => ({
      ...c,
      bookCount: counts[c.id] || 0
    }));
  }

  saveCollection(col) {
    if (!col.id) {
      col.id = 'col_' + Date.now();
      col.createdAt = new Date().toISOString();
      this.data.collections.push(col);
    } else {
      const idx = this.data.collections.findIndex(c => c.id === col.id);
      if (idx !== -1) Object.assign(this.data.collections[idx], col);
    }
    this.save();
    return col;
  }

  deleteCollection(id) {
    this.data.collections = this.data.collections.filter(c => c.id !== id);
    (this.data.books || []).forEach(b => {
      if (b.collectionId === id) b.collectionId = null;
    });
    this.save();
  }

  // Book Texts (Pages)
  getAllBookTexts(bookId) {
    return this.bookPagesMap.get(bookId) || [];
  }

  getPageText(bookId, pageNumber) {
    return this.pageMap.get(bookId + '_' + pageNumber) || null;
  }

  savePageText(bookId, pageNumber, textContent) {
    const key = bookId + '_' + pageNumber;
    let page = this.pageMap.get(key);
    if (page) {
      page.textContent = textContent;
      page._norm = null;
    } else {
      page = {
        id: 'txt_' + bookId + '_' + pageNumber,
        bookId,
        pageNumber,
        textContent
      };
      this.data.bookTexts.push(page);
      this.rebuildPageMaps();
    }
    this.save();
  }

  // Search inside a specific book
  searchInBook(bookId, query) {
    if (!query || !query.trim()) return [];
    const origQuery = query.trim();
    const normQuery = normalizeArabicText(origQuery);
    if (!normQuery) return [];

    const pages = this.getAllBookTexts(bookId);
    const results = [];

    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (!p.textContent) continue;
      if (!p._norm) p._norm = normalizeArabicText(p.textContent);
      const matches = findMatchesWithSnippets(p.textContent, p._norm, normQuery, origQuery);
      if (matches.length > 0) {
        results.push({
          pageNumber: p.pageNumber,
          matches
        });
      }
    }

    return results;
  }

  // Global Search across ALL books
  searchGlobal(query, collectionId = null) {
    if (!query || !query.trim()) return { results: [], totalMatches: 0 };
    const origQuery = query.trim();
    const normQuery = normalizeArabicText(origQuery);
    if (!normQuery) return { results: [], totalMatches: 0 };

    const books = this.getBooks().filter(b => !collectionId || b.collectionId === collectionId);
    const results = [];
    let totalMatches = 0;

    for (let i = 0; i < books.length; i++) {
      const b = books[i];
      const pages = this.getAllBookTexts(b.id);
      const pageResults = [];
      let bookMatchCount = 0;

      for (let j = 0; j < pages.length; j++) {
        const p = pages[j];
        if (!p.textContent) continue;
        if (!p._norm) p._norm = normalizeArabicText(p.textContent);
        const matches = findMatchesWithSnippets(p.textContent, p._norm, normQuery, origQuery);
        if (matches.length > 0) {
          bookMatchCount += matches.length;
          pageResults.push({
            pageNumber: p.pageNumber,
            matches
          });
        }
      }

      if (bookMatchCount > 0) {
        totalMatches += bookMatchCount;
        results.push({
          book: b,
          totalMatches: bookMatchCount,
          pages: pageResults
        });
      }
    }

    return { results, totalMatches };
  }

  // Highlights
  getHighlights(bookId) {
    const list = this.data.highlights || [];
    const catMap = new Map((this.data.categories || []).map(c => [c.id, c]));
    return list
      .filter(h => !bookId || h.bookId === bookId)
      .map(h => ({
        ...h,
        category: catMap.get(h.categoryId) || { name: 'تظليل', colorHex: '#EF4444' }
      }));
  }

  saveHighlight(h) {
    if (!this.data.highlights) this.data.highlights = [];
    if (!h.id) {
      h.id = 'hl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      h.createdAt = new Date().toISOString();
      this.data.highlights.push(h);
    } else {
      const idx = this.data.highlights.findIndex(item => item.id === h.id);
      if (idx !== -1) {
        this.data.highlights[idx] = { ...this.data.highlights[idx], ...h, updatedAt: new Date().toISOString() };
      }
    }
    this.save();
    return h;
  }

  deleteHighlight(id) {
    if (!this.data.highlights) return;
    this.data.highlights = this.data.highlights.filter(h => h.id !== id);
    this.save();
  }

  // Bookmarks
  getBookmarks(bookId) {
    return (this.data.bookmarks || []).filter(b => !bookId || b.bookId === bookId);
  }

  saveBookmark(bm) {
    if (!this.data.bookmarks) this.data.bookmarks = [];
    if (!bm.id) {
      bm.id = 'bm_' + Date.now();
      bm.createdAt = new Date().toISOString();
      this.data.bookmarks.push(bm);
    }
    this.save();
    return bm;
  }

  deleteBookmark(id) {
    if (!this.data.bookmarks) return;
    this.data.bookmarks = this.data.bookmarks.filter(b => b.id !== id);
    this.save();
  }

  // Notes
  getNotes(bookId) {
    return (this.data.notes || []).filter(n => !bookId || n.bookId === bookId);
  }

  saveNote(n) {
    if (!this.data.notes) this.data.notes = [];
    if (!n.id) {
      n.id = 'note_' + Date.now();
      n.createdAt = new Date().toISOString();
      this.data.notes.push(n);
    } else {
      const idx = this.data.notes.findIndex(item => item.id === n.id);
      if (idx !== -1) {
        this.data.notes[idx] = { ...this.data.notes[idx], ...n, updatedAt: new Date().toISOString() };
      }
    }
    this.save();
    return n;
  }

  deleteNote(id) {
    if (!this.data.notes) return;
    this.data.notes = this.data.notes.filter(n => n.id !== id);
    this.save();
  }

  // Reading Progress
  getProgress(bookId) {
    return (this.data.progress && this.data.progress[bookId]) || null;
  }

  saveProgress(bookId, currentPage, totalPages) {
    if (!this.data.progress) this.data.progress = {};
    const total = Math.max(1, totalPages || 1);
    const curr = Math.min(Math.max(1, currentPage), total);
    const percentage = Math.round((curr / total) * 100);

    const prog = {
      bookId,
      currentPage: curr,
      totalPages: total,
      percentage,
      updatedAt: new Date().toISOString()
    };

    this.data.progress[bookId] = prog;
    this.save();
    return prog;
  }

  // Reset to default
  resetToDefault() {
    localStorage.removeItem(this.USER_STORAGE_KEY);
    localStorage.removeItem(this.LEGACY_STORAGE_KEY);
    this.init();
  }

  // Export JSON
  exportData() {
    return JSON.stringify({
      highlights: this.data.highlights,
      bookmarks: this.data.bookmarks,
      notes: this.data.notes,
      progress: this.data.progress,
      categories: this.data.categories
    }, null, 2);
  }

  // Import JSON
  importData(jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.highlights) this.data.highlights = parsed.highlights;
      if (parsed.bookmarks) this.data.bookmarks = parsed.bookmarks;
      if (parsed.notes) this.data.notes = parsed.notes;
      if (parsed.progress) this.data.progress = parsed.progress;
      if (parsed.categories) this.data.categories = parsed.categories;
      this.save();
      return true;
    } catch (e) {
      console.error('Import error', e);
    }
    return false;
  }
}

// Global Singleton
window.BookDB = new LibraryDatabase();
