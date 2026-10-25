'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  Search,
  Highlighter,
  Bookmark,
  FileText,
  Palette,
  List,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  Coffee,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Sliders,
  Type,
  Loader2,
  Eye,
  FileCode,
  MousePointer,
  HelpCircle,
  StickyNote,
} from 'lucide-react';
import { findArabicMatches, normalizeArabicText, SearchSnippetMatch } from '@/lib/arabic';

export interface ActiveSearchTarget {
  query: string;
  matchIndex: number;
  origStart?: number;
  origEnd?: number;
  exactMatch?: string;
}

interface HighlightCategory {
  id: string;
  name: string;
  colorHex: string;
  description?: string;
}

interface Highlight {
  id: string;
  bookId: string;
  categoryId: string;
  pageNumber: number;
  text: string;
  positionData: any;
  note?: string;
  category?: HighlightCategory;
}

interface BookmarkItem {
  id: string;
  bookId: string;
  pageNumber: number;
  title: string;
  textSnippet: string;
  createdAt: string;
}

interface NoteItem {
  id: string;
  bookId: string;
  pageNumber: number;
  text: string;
  snippet?: string;
  highlightId?: string;
  createdAt: string;
}

interface PageData {
  pageNumber: number;
  textContent: string;
}

interface BookDetails {
  id: string;
  title: string;
  author: string;
  format: 'pdf' | 'epub' | 'txt' | 'docx';
  pageCount: number;
  coverUrl?: string;
  isOcr: boolean;
  ocrStatus: string;
}

interface BoxCoords {
  x: number;
  y: number;
  width: number;
  height: number;
}

function BookReaderComponent({ params }: { params: Promise<{ id: string }> }) {
  const { id: bookId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Book & Content state
  const [book, setBook] = useState<BookDetails | null>(null);
  const [pages, setPages] = useState<PageData[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  // PDF.js State
  const [pdfLibReady, setPdfLibReady] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfDocLoading, setPdfDocLoading] = useState(false);
  const [pdfDocError, setPdfDocError] = useState<string | null>(null);
  const [pdfRendering, setPdfRendering] = useState(false);
  const [pdfViewMode, setPdfViewMode] = useState<'original' | 'text'>('original');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const pdfDocRef = useRef<any>(null);
  const loadedBookIdRef = useRef<string | null>(null);

  // Visual Highlighting on Scanned PDF state
  const [isHighlightMode, setIsHighlightMode] = useState(true);
  const [isDraggingHighlight, setIsDraggingHighlight] = useState(false);
  const [dragStartPercent, setDragStartPercent] = useState<{ x: number; y: number } | null>(null);
  const [currentDragBox, setCurrentDragBox] = useState<BoxCoords | null>(null);
  const [pendingBoxHighlight, setPendingBoxHighlight] = useState<{
    box: BoxCoords;
    screenX: number;
    screenY: number;
  } | null>(null);
  const [selectedHighlight, setSelectedHighlight] = useState<Highlight | null>(null);
  const [pendingBoxText, setPendingBoxText] = useState<string>('');
  const [isExtractingBoxText, setIsExtractingBoxText] = useState(false);

  // In-Browser OCR state
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrTextResult, setOcrTextResult] = useState<string | null>(null);

  // Categories & Annotations
  const [categories, setCategories] = useState<HighlightCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('cat_important');
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);

  // Reader Settings & Themes
  const [theme, setTheme] = useState<'dark' | 'light' | 'sepia'>('dark');
  const [fontSize, setFontSize] = useState<number>(19);
  const [fontFamily, setFontFamily] = useState<'Cairo' | 'Amiri' | 'Tajawal'>('Cairo');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1000);

  useEffect(() => {
    let timer: any;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (typeof window !== 'undefined') {
          setWindowWidth(window.innerWidth);
        }
      }, 150);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      clearTimeout(timer);
    };
  }, []);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'toc' | 'search' | 'highlights' | 'categories' | 'bookmarks' | 'notes'>('toc');

  // In-book Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchTotalMatches, setSearchTotalMatches] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDurationMs, setSearchDurationMs] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeSearchTarget, setActiveSearchTarget] = useState<ActiveSearchTarget | null>(null);
  const [activeScannedSearchBox, setActiveScannedSearchBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    exactMatch: string;
    isEstimated?: boolean;
  } | null>(null);

  // Progressive Scanned Book Search & Indexing state
  const [isScannedSearching, setIsScannedSearching] = useState(false);
  const [scannedSearchProgress, setScannedSearchProgress] = useState<{
    current: number;
    total: number;
    found: number;
  }>({ current: 0, total: 0, found: 0 });
  const isScanningActiveRef = useRef(false);

  const [isIndexingBook, setIsIndexingBook] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState<{
    current: number;
    total: number;
    percent: number;
  }>({ current: 0, total: 0, percent: 0 });
  const isIndexingActiveRef = useRef(false);

  // Floating Selection Toolbar state (for DOM text selection)
  const [selectionRange, setSelectionRange] = useState<{
    text: string;
    x: number;
    y: number;
    page: number;
  } | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [newCatModalOpen, setNewCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#10B981');
  const [newCatDesc, setNewCatDesc] = useState('');

  // Note dialog state
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [pendingNoteSnippet, setPendingNoteSnippet] = useState('');
  const [pendingNoteHighlightId, setPendingNoteHighlightId] = useState<string | null>(null);

  // Page input jump state
  const [pageInputVal, setPageInputVal] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);

  const readerContainerRef = useRef<HTMLDivElement>(null);
  const pageViewRef = useRef<HTMLDivElement>(null);
  const lastSavedPageRef = useRef<number | null>(null);
  const hasAttemptedCoverRef = useRef(false);

  // 1. Dynamically load PDF.js script in browser
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!(window as any).pdfjsLib) {
      const script = document.createElement('script');
      script.src = '/pdf.min.js';
      script.async = true;
      script.onload = () => {
        if ((window as any).pdfjsLib) {
          (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
          setPdfLibReady(true);
        }
      };
      document.body.appendChild(script);
    } else {
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      setPdfLibReady(true);
    }
  }, []);

  // 2. Load Book and Annotations
  const loadBookData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/books/${bookId}`);
      const data = await res.json();
      if (!data.success) {
        router.push('/');
        return;
      }

      setBook(data.book);
      setPages(data.pages || []);
      setHighlights(data.highlights || []);
      setBookmarks(data.bookmarks || []);
      setNotes(data.notes || []);

      const count = Math.max(1, data.book.pageCount, (data.pages || []).length);
      setTotalPages(count);

      // Check if target page was passed in query parameter (e.g. from global search, bookmark, note)
      const pageQuery = searchParams.get('page');
      const targetPage = pageQuery ? parseInt(pageQuery, 10) : NaN;

      if (!isNaN(targetPage) && targetPage >= 1) {
        setCurrentPage(Math.min(targetPage, count));
      } else if (data.progress && data.progress.currentPage) {
        setCurrentPage(Math.min(data.progress.currentPage, count));
      } else {
        setCurrentPage(1);
      }

      // Check if search query or specific match was passed in URL
      const qParam = searchParams.get('q');
      const matchIndexParam = searchParams.get('matchIndex');
      const startParam = searchParams.get('start');
      const endParam = searchParams.get('end');

      if (qParam && qParam.trim()) {
        const matchIdx = matchIndexParam ? parseInt(matchIndexParam, 10) : 0;
        const oStart = startParam ? parseInt(startParam, 10) : undefined;
        const oEnd = endParam ? parseInt(endParam, 10) : undefined;

        setActiveSearchTarget({
          query: qParam.trim(),
          matchIndex: isNaN(matchIdx) ? 0 : matchIdx,
          origStart: oStart !== undefined && !isNaN(oStart) ? oStart : undefined,
          origEnd: oEnd !== undefined && !isNaN(oEnd) ? oEnd : undefined,
        });

        setSearchQuery(qParam.trim());

        if (data.book?.format === 'pdf') {
          if (data.book.isOcr || (data.pages && data.pages.length > 0)) {
            setPdfViewMode('original');
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (data.success && data.categories?.length > 0) {
        setCategories(data.categories);
        setActiveCategoryId(data.categories[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadBookData();
    loadCategories();

    const savedTheme = localStorage.getItem('app-theme') as 'dark' | 'light' | 'sepia' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, [bookId]);

  // Synchronize URL search parameters with activeSearchTarget
  useEffect(() => {
    const qParam = searchParams.get('q');
    if (qParam && qParam.trim()) {
      const cleanQ = qParam.trim();
      const pageQuery = searchParams.get('page');
      const pNum = pageQuery ? parseInt(pageQuery, 10) : NaN;
      if (!isNaN(pNum) && pNum >= 1) {
        setCurrentPage((prev) => (prev === pNum ? prev : pNum));
      }

      const matchIndexParam = searchParams.get('matchIndex');
      const startParam = searchParams.get('start');
      const endParam = searchParams.get('end');
      const matchIdx = matchIndexParam ? parseInt(matchIndexParam, 10) : 0;
      const oStart = startParam ? parseInt(startParam, 10) : undefined;
      const oEnd = endParam ? parseInt(endParam, 10) : undefined;

      setActiveSearchTarget((prev) => {
        if (
          prev &&
          prev.query === cleanQ &&
          prev.matchIndex === matchIdx &&
          prev.origStart === oStart &&
          prev.origEnd === oEnd
        ) {
          return prev;
        }
        return {
          query: cleanQ,
          matchIndex: isNaN(matchIdx) ? 0 : matchIdx,
          origStart: oStart !== undefined && !isNaN(oStart) ? oStart : undefined,
          origEnd: oEnd !== undefined && !isNaN(oEnd) ? oEnd : undefined,
        };
      });

      setSearchQuery((prev) => (prev === cleanQ ? prev : cleanQ));

      if (book?.format === 'pdf') {
        if (book.isOcr) {
          setPdfViewMode((prev) => (prev === 'original' ? prev : 'original'));
        }
      }
    }
  }, [searchParams, book?.format, book?.isOcr]);

  // Load or calculate exact/proportional search highlight box on scanned book page
  useEffect(() => {
    if (!activeSearchTarget || !activeSearchTarget.query || book?.format !== 'pdf') {
      setActiveScannedSearchBox(null);
      return;
    }

    let isMounted = true;
    const query = activeSearchTarget.query.trim();

    // 1. Immediately calculate proportional fallback if page text contains match (zero latency)
    const currentText = pages.find((p) => p.pageNumber === currentPage)?.textContent || ocrTextResult || '';
    if (currentText) {
      const normText = normalizeArabicText(currentText);
      const normQuery = normalizeArabicText(query);
      const matchIdx = activeSearchTarget.origStart !== undefined ? activeSearchTarget.origStart : normText.indexOf(normQuery);
      if (matchIdx !== -1) {
        const frac = matchIdx / Math.max(1, currentText.length);
        const estimatedY = Math.max(7, Math.min(88, 8 + frac * 80));
        setActiveScannedSearchBox({
          x: 7,
          y: Math.round(estimatedY * 10) / 10,
          width: 86,
          height: 4.5,
          exactMatch: activeSearchTarget.exactMatch || query,
          isEstimated: true,
        });
      }
    }

    // 2. Fetch exact bounding box from server API
    fetch(`/api/books/${bookId}/search-box?page=${currentPage}&q=${encodeURIComponent(query)}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && data.box) {
          setActiveScannedSearchBox(data.box);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [activeSearchTarget, currentPage, bookId, book?.format, pages, ocrTextResult]);

  // Automatically scroll smooth to the active search highlight on the page
  useEffect(() => {
    if (!activeSearchTarget) return;
    const timer = setTimeout(() => {
      const el = document.getElementById('active-search-highlight');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [activeSearchTarget, activeScannedSearchBox, currentPage, pdfViewMode, pages, ocrTextResult]);


  // 3. Load PDF Document when pdfjsLib is ready
  useEffect(() => {
    if (!pdfLibReady || !bookId || book?.format !== 'pdf') return;

    if (loadedBookIdRef.current === bookId && pdfDocRef.current) {
      if (!pdfDoc) {
        setPdfDoc(pdfDocRef.current);
      }
      setPdfDocLoading(false);
      return;
    }

    let isMounted = true;
    const loadPdfDoc = async () => {
      try {
        setPdfDocLoading(true);
        setPdfDocError(null);
        const pdfjs = (window as any).pdfjsLib;
        const pdfUrl = `/uploads/books/${bookId}.pdf`;
        const loadingTask = pdfjs.getDocument({
          url: pdfUrl,
          disableAutoFetch: false,
          disableStream: false,
          rangeChunkSize: 65536,
          enableXfa: false,
          isEvalSupported: false,
        });
        const doc = await loadingTask.promise;
        pdfDocRef.current = doc;
        loadedBookIdRef.current = bookId;
        if (isMounted) {
          setPdfDoc(doc);
          setPdfDocLoading(false);
          setTotalPages(doc.numPages);

          const pageQuery = searchParams.get('page');
          const targetPage = pageQuery ? parseInt(pageQuery, 10) : NaN;
          if (!isNaN(targetPage) && targetPage >= 1) {
            setCurrentPage(Math.min(targetPage, doc.numPages));
          }
        }
      } catch (err: any) {
        console.error('Error loading PDF document:', err);
        if (isMounted) {
          setPdfDocLoading(false);
          setPdfDocError('تعذر فتح ملف الكتاب الأصلي');
        }
      }
    };

    loadPdfDoc();
    return () => {
      isMounted = false;
    };
  }, [pdfLibReady, bookId, book?.format]);

  // 4. Render PDF Page on Canvas when currentPage or zoom changes
  useEffect(() => {
    if (!pdfDoc || book?.format !== 'pdf' || pdfViewMode !== 'original') return;

    let cancelRender = false;
    const renderPdfPage = async () => {
      // Cancel previous ongoing render task to avoid "Cannot use the same canvas during multiple render() operations"
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {}
        renderTaskRef.current = null;
      }

      try {
        setPdfRendering(true);
        const page = await pdfDoc.getPage(currentPage);
        if (cancelRender) return;

        let canvas = canvasRef.current;
        if (!canvas) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          canvas = canvasRef.current;
        }
        if (!canvas || cancelRender) return;

        const defaultViewport = page.getViewport({ scale: 1 });
        const currentWinWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
        const targetWidth = currentWinWidth <= 640
          ? Math.max(260, currentWinWidth - 20)
          : Math.min(840, currentWinWidth - 80);
        const baseScale = targetWidth / defaultViewport.width;
        const finalScale = baseScale * (zoomLevel / 100);

        const viewport = page.getViewport({ scale: finalScale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        renderTaskRef.current = null;

        // Auto-generate cover thumbnail from page 1 if not yet generated
        if (currentPage === 1 && book && !book.coverUrl && !hasAttemptedCoverRef.current) {
          hasAttemptedCoverRef.current = true;
          try {
            const thumbCanvas = document.createElement('canvas');
            const thumbViewport = page.getViewport({ scale: 0.4 });
            thumbCanvas.width = thumbViewport.width;
            thumbCanvas.height = thumbViewport.height;
            const thumbCtx = thumbCanvas.getContext('2d');
            if (thumbCtx) {
              await page.render({ canvasContext: thumbCtx, viewport: thumbViewport }).promise;
              const coverUrl = thumbCanvas.toDataURL('image/jpeg', 0.8);
              fetch(`/api/books/${bookId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coverUrl }),
              });
              setBook((prev) => (prev ? { ...prev, coverUrl } : null));
            }
          } catch (e) {
            console.error('Auto cover error:', e);
          }
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Render PDF page error:', err);
        }
      } finally {
        if (!cancelRender) {
          setPdfRendering(false);
        }
      }
    };

    renderPdfPage();
    return () => {
      cancelRender = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {}
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, currentPage, zoomLevel, pdfViewMode, bookId, book?.format, windowWidth]);

  // 5. Auto-save reading progress on page change
  useEffect(() => {
    if (!bookId || !currentPage || currentPage === lastSavedPageRef.current) return;

    const timer = setTimeout(() => {
      lastSavedPageRef.current = currentPage;
      fetch(`/api/books/${bookId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPage,
          totalPages,
          lastPosition: { page: currentPage },
        }),
      }).catch(console.error);
    }, 1200);

    return () => clearTimeout(timer);
  }, [currentPage, totalPages, bookId]);

  // ---------------------------------------------------------------------
  // Visual Scanned Page Highlighting Handlers (Mouse & Touch)
  // ---------------------------------------------------------------------
  const getRelativePercentCoords = (clientX: number, clientY: number) => {
    if (!canvasWrapperRef.current) return null;
    const rect = canvasWrapperRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (!isHighlightMode) return;
    if ((e.target as HTMLElement).closest('.page-visual-highlight')) return;
    if ((e.target as HTMLElement).closest('.floating-selection-bar')) return;

    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    const coords = getRelativePercentCoords(e.clientX, e.clientY);
    if (!coords) return;

    setIsDraggingHighlight(true);
    setDragStartPercent(coords);
    setCurrentDragBox({ x: coords.x, y: coords.y, width: 0, height: 0 });
    setPendingBoxHighlight(null);
    setSelectedHighlight(null);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingHighlight || !dragStartPercent) return;
    e.preventDefault();

    const coords = getRelativePercentCoords(e.clientX, e.clientY);
    if (!coords) return;

    const x = Math.min(dragStartPercent.x, coords.x);
    const y = Math.min(dragStartPercent.y, coords.y);
    const width = Math.abs(coords.x - dragStartPercent.x);
    const height = Math.abs(coords.y - dragStartPercent.y);

    setCurrentDragBox({ x, y, width, height });
  };

  const handleCanvasPointerUp = (e: React.PointerEvent) => {
    if (!isDraggingHighlight) return;
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    setIsDraggingHighlight(false);

    if (currentDragBox && currentDragBox.width > 0.8 && currentDragBox.height > 0.4) {
      const box = currentDragBox;
      setPendingBoxHighlight({
        box,
        screenX: e.clientX,
        screenY: e.clientY,
      });
      setPendingBoxText('');
      // Immediately extract Arabic text from the selected box
      extractTextFromBox(box);
    }
    setCurrentDragBox(null);
    setDragStartPercent(null);
  };

  // Fast Automatic Box Text Extraction via /api/highlights/ocr-box
  const extractTextFromBox = async (box: BoxCoords): Promise<string> => {
    if (!canvasRef.current) return '';
    try {
      setIsExtractingBoxText(true);
      const canvas = canvasRef.current;
      const cropCanvas = document.createElement('canvas');
      const cropX = (box.x / 100) * canvas.width;
      const cropY = (box.y / 100) * canvas.height;
      const cropW = (box.width / 100) * canvas.width;
      const cropH = (box.height / 100) * canvas.height;

      cropCanvas.width = Math.max(10, Math.floor(cropW));
      cropCanvas.height = Math.max(10, Math.floor(cropH));
      const ctx = cropCanvas.getContext('2d');
      if (!ctx) return '';
      ctx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropCanvas.width, cropCanvas.height);
      const imageBase64 = cropCanvas.toDataURL('image/jpeg', 0.85);

      const res = await fetch('/api/highlights/ocr-box', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });
      const data = await res.json();
      if (data.success && data.text) {
        setPendingBoxText(data.text);
        return data.text;
      }
    } catch (err) {
      console.error('Fast box OCR error:', err);
    } finally {
      setIsExtractingBoxText(false);
    }
    return '';
  };

  // Save Visual Highlight Box
  const handleApplyBoxHighlight = async (categoryId: string, customText?: string): Promise<string | null> => {
    if (!pendingBoxHighlight) return null;

    const cat = catMap.get(categoryId);
    const catName = cat?.name || 'تظليل مخصص';
    let chosenText = customText !== undefined ? customText : pendingBoxText;

    // If still extracting and user clicked immediately, wait for fast OCR
    if (!chosenText && isExtractingBoxText) {
      chosenText = await extractTextFromBox(pendingBoxHighlight.box);
    }

    const text = (chosenText && chosenText.trim()) ? chosenText.trim() : `تظليل في الصفحة ${currentPage} (${catName})`;

    try {
      const res = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          categoryId,
          pageNumber: currentPage,
          text,
          positionData: {
            type: 'box',
            box: pendingBoxHighlight.box,
            page: currentPage,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        setHighlights((prev) => [...prev, data.highlight]);
        setPendingBoxHighlight(null);
        setPendingBoxText('');
        return data.highlight.id as string;
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  // Extract OCR Arabic Text for the Highlighted Box
  const handleOcrOnPendingBox = async (categoryId: string) => {
    if (!pendingBoxHighlight || !canvasRef.current) return;
    const box = pendingBoxHighlight.box;
    setIsOcrProcessing(true);
    try {
      const canvas = canvasRef.current;
      const cropCanvas = document.createElement('canvas');
      const cropX = (box.x / 100) * canvas.width;
      const cropY = (box.y / 100) * canvas.height;
      const cropW = (box.width / 100) * canvas.width;
      const cropH = (box.height / 100) * canvas.height;

      cropCanvas.width = Math.max(10, cropW);
      cropCanvas.height = Math.max(10, cropH);
      const ctx = cropCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropCanvas.width, cropCanvas.height);
        const dataUrl = cropCanvas.toDataURL('image/png');
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('ara+eng');
        const ret = await worker.recognize(dataUrl);
        await worker.terminate();
        const recognized = ret.data.text.trim();
        if (recognized) {
          await handleApplyBoxHighlight(categoryId, recognized);
        } else {
          await handleApplyBoxHighlight(categoryId);
        }
      }
    } catch (e) {
      console.error('Box OCR error:', e);
      await handleApplyBoxHighlight(categoryId);
    } finally {
      setIsOcrProcessing(false);
    }
  };

  // Quick Bookmark toggle for current page without needing text selection
  const isPageBookmarked = bookmarks.some((b) => b.pageNumber === currentPage);
  const handleTogglePageBookmark = async () => {
    const existing = bookmarks.find((b) => b.pageNumber === currentPage);
    if (existing) {
      await handleDeleteBookmark(existing.id);
    } else {
      await handleAddBookmark();
    }
  };

  // Normal Text Selection in Document
  const handleTextSelection = () => {
    if (isPdf && pdfViewMode === 'original' && isHighlightMode) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setSelectionRange(null);
      setCategoryPickerOpen(false);
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 2) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setSelectionRange({
      text,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      page: currentPage,
    });
  };

  const switchTheme = (newTheme: 'dark' | 'light' | 'sepia') => {
    setTheme(newTheme);
    localStorage.setItem('app-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Sync page when query param ?page= changes
  useEffect(() => {
    const pageQuery = searchParams.get('page');
    if (pageQuery) {
      const pageNum = parseInt(pageQuery, 10);
      if (!isNaN(pageNum) && pageNum >= 1) {
        setCurrentPage((prev) => {
          const target = totalPages > 1 ? Math.min(pageNum, totalPages) : pageNum;
          return prev === target ? prev : target;
        });
      }
    }
  }, [searchParams, totalPages]);

  const goToPage = (num: number) => {
    const valid = Math.max(1, Math.min(num, totalPages));
    setCurrentPage(valid);
    setSelectionRange(null);
    setCategoryPickerOpen(false);
    setOcrTextResult(null);
    setPendingBoxHighlight(null);
    setSelectedHighlight(null);
    if (pageViewRef.current) {
      pageViewRef.current.scrollTop = 0;
    }
    // Update URL query param smoothly without reload
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('page') !== valid.toString()) {
        url.searchParams.set('page', valid.toString());
        window.history.replaceState(null, '', url.toString());
      }
    } catch (e) {
      // ignore
    }
  };

  // In-Browser OCR Runner for Scanned Pages
  const handleRunOcrOnPage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsOcrProcessing(true);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('ara+eng');
      const dataUrl = canvas.toDataURL('image/png');
      const ret = await worker.recognize(dataUrl);
      const text = ret.data.text.trim();
      await worker.terminate();

      if (text) {
        setOcrTextResult(text);
        setPages((prev) => {
          const next = [...prev];
          const idx = next.findIndex((p) => p.pageNumber === currentPage);
          if (idx !== -1) {
            next[idx].textContent = text;
          } else {
            next.push({ pageNumber: currentPage, textContent: text });
          }
          return next;
        });

        // Persist recognized text to backend library.json and index for search
        try {
          await fetch(`/api/books/${bookId}/ocr-page`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pageNumber: currentPage, textContent: text }),
          });
        } catch (e) {
          console.error('Failed to persist OCR text', e);
        }

        // Switch to text mode so the user can interact with the recognized words
        setPdfViewMode('text');
      }
    } catch (err) {
      console.error('OCR Error on page:', err);
    } finally {
      setIsOcrProcessing(false);
    }
  };

  // Add Highlight for Normal Text Selection
  const handleApplyHighlight = async (categoryId: string) => {
    if (!selectionRange) return;

    try {
      const res = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          categoryId,
          pageNumber: currentPage,
          text: selectionRange.text,
          positionData: {
            page: currentPage,
            timestamp: Date.now(),
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        setHighlights((prev) => [...prev, data.highlight]);
        setSelectionRange(null);
        setCategoryPickerOpen(false);
        window.getSelection()?.removeAllRanges();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Remove Highlight
  const handleDeleteHighlight = async (id: string) => {
    try {
      const res = await fetch(`/api/highlights/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setHighlights((prev) => prev.filter((h) => h.id !== id));
        setSelectedHighlight(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Add Bookmark
  const handleAddBookmark = async () => {
    const textSnippet = selectionRange ? selectionRange.text.slice(0, 100) : `إشارة مرجعية - صفحة ${currentPage}`;
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          pageNumber: currentPage,
          title: `علامة - صفحة ${currentPage}`,
          textSnippet,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBookmarks((prev) => [...prev, data.bookmark]);
        setSelectionRange(null);
        window.getSelection()?.removeAllRanges();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete Bookmark
  const handleDeleteBookmark = async (id: string) => {
    try {
      const res = await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setBookmarks((prev) => prev.filter((b) => b.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Save Note
  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          pageNumber: currentPage,
          text: noteText.trim(),
          snippet: pendingNoteSnippet,
          highlightId: pendingNoteHighlightId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotes((prev) => [...prev, data.note]);
        setNoteModalOpen(false);
        setNoteText('');
        setPendingNoteSnippet('');
        setPendingNoteHighlightId(null);
        setSelectionRange(null);
        window.getSelection()?.removeAllRanges();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete Note
  const handleDeleteNote = async (id: string) => {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Create Category on the Fly
  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCatName.trim(),
          colorHex: newCatColor,
          description: newCatDesc.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCategories((prev) => [...prev, data.category]);
        setActiveCategoryId(data.category.id);
        setNewCatModalOpen(false);
        setNewCatName('');
        setNewCatDesc('');
        if (pendingBoxHighlight) {
          handleApplyBoxHighlight(data.category.id);
        } else if (selectionRange) {
          handleApplyHighlight(data.category.id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Progressive live search across scanned pages
  const startScannedSearch = async (queryText: string) => {
    if (!queryText.trim() || !book) return;
    setIsScannedSearching(true);
    isScanningActiveRef.current = true;

    let fromPage = 1;
    let keepScanning = true;
    const batchSize = 12;

    while (keepScanning && isScanningActiveRef.current) {
      try {
        const res = await fetch(
          `/api/books/${bookId}/search-scanned?q=${encodeURIComponent(queryText)}&from=${fromPage}&batchSize=${batchSize}`
        );
        const data = await res.json();
        if (!data.success) break;

        if (data.matches && data.matches.length > 0) {
          setSearchResults((prev) => {
            const next = [...prev];
            data.matches.forEach((m: any) => {
              const existingPage = next.find((p) => p.pageNumber === m.pageNumber);
              if (existingPage) {
                if (!existingPage.matches.some((em: any) => em.snippet === m.snippet)) {
                  existingPage.matches.push(m);
                }
              } else {
                next.push({
                  pageNumber: m.pageNumber,
                  matches: [m],
                });
              }
            });
            return next.sort((a, b) => a.pageNumber - b.pageNumber);
          });
          setSearchTotalMatches((t) => t + data.matches.length);
        }

        setScannedSearchProgress({
          current: data.endPage,
          total: data.totalPages,
          found: data.matches?.length || 0,
        });

        if (!data.hasMore || !data.nextPage || !isScanningActiveRef.current) {
          keepScanning = false;
        } else {
          fromPage = data.nextPage;
        }
      } catch (err) {
        console.error('Error during progressive scanned search:', err);
        break;
      }
    }

    setIsScannedSearching(false);
    isScanningActiveRef.current = false;
  };

  const stopScannedSearch = () => {
    isScanningActiveRef.current = false;
    setIsScannedSearching(false);
  };

  // Full-book background OCR Indexing
  const startFullBookIndexing = async () => {
    if (!book) return;
    setIsIndexingBook(true);
    isIndexingActiveRef.current = true;

    let fromPage = 1;
    let keepIndexing = true;
    const batchSize = 16;

    while (keepIndexing && isIndexingActiveRef.current) {
      try {
        const res = await fetch(`/api/books/${bookId}/index-scanned`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: fromPage, batchSize }),
        });
        const data = await res.json();
        if (!data.success) break;

        setIndexingProgress({
          current: data.endPage,
          total: data.totalPages,
          percent: data.percentIndexed,
        });

        if (!data.hasMore || !data.nextPage || !isIndexingActiveRef.current) {
          keepIndexing = false;
        } else {
          fromPage = data.nextPage;
        }
      } catch (err) {
        console.error('Error during book indexing:', err);
        break;
      }
    }

    setIsIndexingBook(false);
    isIndexingActiveRef.current = false;
  };

  const stopFullBookIndexing = () => {
    isIndexingActiveRef.current = false;
    setIsIndexingBook(false);
  };

  // Search inside book (ultra-fast instant search matching global search speed)
  const handleInBookSearch = async (overrideQuery?: string) => {
    const q = (overrideQuery !== undefined ? overrideQuery : searchQuery).trim();
    if (!q) {
      setSearchResults([]);
      setSearchTotalMatches(0);
      setHasSearched(false);
      setSearchDurationMs(null);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    const startTime = performance.now();

    try {
      const res = await fetch(`/api/books/${bookId}/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const duration = Math.round(performance.now() - startTime);
      setSearchDurationMs(duration);

      if (data.success) {
        setSearchResults(data.results || []);
        setSearchTotalMatches(data.totalMatches || 0);
      } else {
        setSearchResults([]);
        setSearchTotalMatches(0);
      }
    } catch (e) {
      console.error('Error during in-book search:', e);
      setSearchResults([]);
      setSearchTotalMatches(0);
    } finally {
      setIsSearching(false);
    }
  };

  // Live debounced search when user types in search box ("اكتب وعلى طول يعطيني")
  useEffect(() => {
    if (sidebarTab !== 'search') return;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchTotalMatches(0);
      setHasSearched(false);
      setSearchDurationMs(null);
      return;
    }
    if (trimmed.length < 2) return;

    const timer = setTimeout(() => {
      handleInBookSearch(trimmed);
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery, sidebarTab]);

  // Highlight search term inside snippet
  const highlightSnippet = (snippet: string, q: string) => {
    if (!q || !q.trim() || !snippet) return snippet;
    const clean = q.trim();
    const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = snippet.split(new RegExp(`(${escaped})`, 'gi'));
    if (parts.length <= 1) return snippet;
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === clean.toLowerCase() ? (
            <mark
              key={i}
              style={{
                background: 'rgba(239, 68, 68, 0.28)',
                color: 'inherit',
                borderRadius: '3px',
                padding: '1px 3px',
                fontWeight: 700,
              }}
            >
              {part}
            </mark>
          ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
          )
        )}
      </span>
    );
  };

  // Copy text to clipboard
  const handleCopyText = () => {
    if (!selectionRange) return;
    navigator.clipboard.writeText(selectionRange.text);
    setCopyFeedback(true);
    setTimeout(() => {
      setCopyFeedback(false);
      setSelectionRange(null);
      window.getSelection()?.removeAllRanges();
    }, 1000);
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      readerContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Current page text content
  const currentPageData = pages.find((p) => p.pageNumber === currentPage);
  const currentText = ocrTextResult || (currentPageData ? currentPageData.textContent : '');

  // Highlight categories lookup map
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const activeCategory = catMap.get(activeCategoryId) || categories[0];
  const activeCategoryColor = activeCategory?.colorHex || '#EF4444';

  // Active highlights on this page
  const pageHighlights = highlights.filter((h) => h.pageNumber === currentPage);

  // Current page search matches lookup
  const currentPageSearchMatches =
    activeSearchTarget?.query && currentText
      ? findArabicMatches(currentText, activeSearchTarget.query)
      : [];

  const currentMatchIndex = activeSearchTarget?.matchIndex ?? 0;

  const goToNextSearchMatch = () => {
    if (currentPageSearchMatches.length <= 1 || !activeSearchTarget) return;
    const nextIdx = (currentMatchIndex + 1) % currentPageSearchMatches.length;
    const m = currentPageSearchMatches[nextIdx];
    if (m) {
      setActiveSearchTarget({
        query: activeSearchTarget.query,
        matchIndex: m.matchIndex,
        origStart: m.origStart,
        origEnd: m.origEnd,
        exactMatch: m.exactMatch,
      });
    }
  };

  const goToPrevSearchMatch = () => {
    if (currentPageSearchMatches.length <= 1 || !activeSearchTarget) return;
    const prevIdx =
      (currentMatchIndex - 1 + currentPageSearchMatches.length) % currentPageSearchMatches.length;
    const m = currentPageSearchMatches[prevIdx];
    if (m) {
      setActiveSearchTarget({
        query: activeSearchTarget.query,
        matchIndex: m.matchIndex,
        origStart: m.origStart,
        origEnd: m.origEnd,
        exactMatch: m.exactMatch,
      });
    }
  };

  const handleSelectInBookSearchResult = (pageNumber: number, m: any) => {
    if (isPdf && book?.isOcr) {
      setPdfViewMode('original');
    }
    goToPage(pageNumber);
    setActiveSearchTarget({
      query: searchQuery.trim(),
      matchIndex: m.matchIndex ?? 0,
      origStart: m.origStart,
      origEnd: m.origEnd,
      exactMatch: m.exactMatch,
    });
  };

  // Render reflowable text with highlight overlays & smart search highlights
  const renderHighlightedContent = () => {
    if (!currentText || currentText.trim().length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <Sparkles size={32} style={{ margin: '0 auto 12px', color: 'var(--accent-secondary)' }} />
          <p style={{ fontSize: '1rem', marginBottom: '8px' }}>
            هذه الصفحة لا تحتوي على نص رقمي مدمج (كتاب مصور).
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            يمكنك استعراض الصفحة المصورة وتظليلها مباشرة، أو استخراج نصها بالتعرف الضوئي:
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <button
              className="btn btn-primary"
              onClick={() => setPdfViewMode('original')}
            >
              <Eye size={16} />
              <span>عرض صفحة الكتاب وتظليلها مباشرة</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleRunOcrOnPage}
              disabled={isOcrProcessing}
            >
              {isOcrProcessing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              <span>استخراج النص (OCR)</span>
            </button>
          </div>
        </div>
      );
    }

    // 1. Gather all search matches on current page if activeSearchTarget is set
    const searchMatches = activeSearchTarget?.query
      ? findArabicMatches(currentText, activeSearchTarget.query)
      : [];

    // Find the target match: match by matchIndex, origStart, or default to first
    let targetMatch: SearchSnippetMatch | undefined;
    if (searchMatches.length > 0 && activeSearchTarget) {
      targetMatch =
        searchMatches.find((m) => m.matchIndex === activeSearchTarget.matchIndex) ||
        (activeSearchTarget.origStart !== undefined
          ? searchMatches.find((m) => m.origStart === activeSearchTarget.origStart)
          : undefined) ||
        searchMatches[0];
    }

    // 2. Build non-overlapping intervals
    interface TextInterval {
      start: number;
      end: number;
      type: 'search-target' | 'search-secondary' | 'permanent';
      matchIndex?: number;
      hl?: Highlight;
    }

    const intervals: TextInterval[] = [];

    // Add search matches
    searchMatches.forEach((m) => {
      const isTarget = targetMatch && m.matchIndex === targetMatch.matchIndex;
      intervals.push({
        start: m.origStart,
        end: m.origEnd,
        type: isTarget ? 'search-target' : 'search-secondary',
        matchIndex: m.matchIndex,
      });
    });

    // Add permanent highlights
    pageHighlights.forEach((hl) => {
      if (!hl.text) return;
      let startIdx = currentText.indexOf(hl.text);
      while (startIdx !== -1) {
        const endIdx = startIdx + hl.text.length;
        intervals.push({
          start: startIdx,
          end: endIdx,
          type: 'permanent',
          hl,
        });
        startIdx = currentText.indexOf(hl.text, endIdx);
      }
    });

    // Sort intervals by start ascending, priority to search-target, then search-secondary, then permanent
    intervals.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      const rank = (t: string) => (t === 'search-target' ? 3 : t === 'search-secondary' ? 2 : 1);
      return rank(b.type) - rank(a.type);
    });

    // Filter out overlapping intervals
    const cleanIntervals: TextInterval[] = [];
    let lastEnd = 0;
    for (const intv of intervals) {
      if (intv.start >= lastEnd && intv.end > intv.start) {
        cleanIntervals.push(intv);
        lastEnd = intv.end;
      }
    }

    // 3. Render segmented text preserving original formatting
    const elements: React.ReactNode[] = [];
    let cursor = 0;

    cleanIntervals.forEach((interval, idx) => {
      if (interval.start > cursor) {
        elements.push(
          <React.Fragment key={`txt_${cursor}`}>
            {currentText.slice(cursor, interval.start)}
          </React.Fragment>
        );
      }

      const sliceText = currentText.slice(interval.start, interval.end);

      if (interval.type === 'search-target') {
        elements.push(
          <mark
            key={`st_${idx}`}
            id="active-search-highlight"
            className="search-highlight-active"
            title={`نتيجة البحث: ${sliceText}`}
          >
            {sliceText}
          </mark>
        );
      } else if (interval.type === 'search-secondary') {
        elements.push(
          <mark
            key={`ss_${idx}`}
            className="search-highlight-secondary"
            onClick={() => {
              setActiveSearchTarget((prev) =>
                prev
                  ? {
                      ...prev,
                      matchIndex: interval.matchIndex ?? 0,
                      origStart: interval.start,
                      origEnd: interval.end,
                      exactMatch: sliceText,
                    }
                  : null
              );
            }}
            title="موضع بحث آخر في الصفحة — اضغط للانتقال إليه"
          >
            {sliceText}
          </mark>
        );
      } else if (interval.type === 'permanent' && interval.hl) {
        const hl = interval.hl;
        const cat = catMap.get(hl.categoryId);
        const color = cat?.colorHex || '#EF4444';
        elements.push(
          <mark
            key={`hl_${hl.id}_${idx}`}
            className="app-highlight"
            style={{
              backgroundColor: `${color}33`,
              borderBottom: `2.5px solid ${color}`,
              color: 'inherit',
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedHighlight(hl);
            }}
            title={`${cat?.name || 'تظليل'}: ${hl.note || ''}`}
          >
            {sliceText}
          </mark>
        );
      }

      cursor = interval.end;
    });

    if (cursor < currentText.length) {
      elements.push(
        <React.Fragment key={`txt_${cursor}`}>
          {currentText.slice(cursor)}
        </React.Fragment>
      );
    }

    return (
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 2.1, wordBreak: 'break-word' }}>
        {elements}
      </div>
    );
  };

  const isPdf = book?.format === 'pdf';

  return (
    <div
      ref={readerContainerRef}
      className="reader-container"
      data-theme={theme}
      style={{
        fontFamily: `var(--font-${fontFamily.toLowerCase()})`,
      }}
    >
      {/* 1. TOP HEADER CONTROLS */}
      <header className="reader-header">
        {/* Left: Back & Title & Format */}
        <div className="reader-header-left" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <Link href="/" className="btn-icon" title="العودة إلى المكتبة" style={{ flexShrink: 0 }}>
            <ArrowRight size={18} />
          </Link>
          <div className="reader-header-title" title={book?.title}>
            {book?.title || 'قارئ الكتب'}
          </div>
          <span
            className="cover-badge"
            style={{ position: 'static', textTransform: 'uppercase', flexShrink: 0 }}
          >
            {book?.format}
          </span>

          {/* Toggle PDF View Mode */}
          {isPdf && (
            <div className="reader-view-mode-toggle" style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-sm)', padding: '2px', flexShrink: 0 }}>
              <button
                className={`btn ${pdfViewMode === 'original' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                onClick={() => setPdfViewMode('original')}
                title="عرض وتظليل الصفحة الأصلية المصورة"
              >
                <Eye size={13} />
                <span className="mode-btn-label">الأصلية</span>
              </button>
              <button
                className={`btn ${pdfViewMode === 'text' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                onClick={() => setPdfViewMode('text')}
                title="عرض النص المستخرج"
              >
                <FileCode size={13} />
                <span className="mode-btn-label">الرقمي</span>
              </button>
            </div>
          )}
        </div>

        {/* Center: Highlight Tool & Active Category Selector (Desktop) */}
        <div className="reader-header-center" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isPdf && pdfViewMode === 'original' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: isHighlightMode ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.05)',
                border: `1.5px solid ${isHighlightMode ? activeCategoryColor : 'var(--border-color)'}`,
                padding: '4px 12px',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: isHighlightMode ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
                onClick={() => setIsHighlightMode(!isHighlightMode)}
                title="تفعيل/تعطيل أداة التظليل بالسحب على الصفحة"
              >
                <Highlighter size={16} style={{ color: activeCategoryColor }} />
                <span>{isHighlightMode ? 'أداة التظليل مفعّلة' : 'تفعيل أداة التظليل'}</span>
              </button>

              {/* Quick Category Color Picker Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderRight: '1px solid var(--border-color)', paddingRight: '8px' }}>
                {categories.slice(0, 5).map((c) => (
                  <button
                    key={c.id}
                    title={`التظليل بتصنيف: ${c.name}`}
                    onClick={() => {
                      setActiveCategoryId(c.id);
                      setIsHighlightMode(true);
                    }}
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: c.colorHex,
                      border: activeCategoryId === c.id ? '2.5px solid #fff' : '1px solid rgba(0,0,0,0.3)',
                      cursor: 'pointer',
                      transform: activeCategoryId === c.id ? 'scale(1.2)' : 'scale(1)',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <span className="reader-header-page-indicator" style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            صفحة {currentPage} من {totalPages}
          </span>
        </div>

        {/* Right: Controls & Sidebar Toggle */}
        <div className="reader-header-right" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Mobile Display & Quick Settings Button */}
          <button
            className="btn-icon mobile-only-btn"
            onClick={() => setMobileSettingsOpen(true)}
            title="خيارات العرض والقراءة"
            style={{ width: '38px', height: '38px' }}
          >
            <Sliders size={18} />
          </button>

          {/* Desktop-only action controls */}
          <div className="desktop-only-controls">
            {/* Quick Page Actions: Bookmark, Note, OCR */}
            <button
              className={`btn-icon ${isPageBookmarked ? 'active' : ''}`}
              style={{
                color: isPageBookmarked ? '#F59E0B' : 'inherit',
                background: isPageBookmarked ? 'rgba(245, 158, 11, 0.15)' : undefined,
                borderColor: isPageBookmarked ? '#F59E0B' : undefined,
              }}
              title={isPageBookmarked ? 'إزالة الإشارة المرجعية من هذه الصفحة' : 'حفظ إشارة مرجعية لهذه الصفحة'}
              onClick={handleTogglePageBookmark}
            >
              <Bookmark size={16} fill={isPageBookmarked ? '#F59E0B' : 'none'} />
            </button>

            <button
              className="btn-icon"
              title="إضافة ملاحظة على هذه الصفحة"
              onClick={() => {
                setPendingNoteSnippet(`صفحة ${currentPage}`);
                setPendingNoteHighlightId(null);
                setNoteText('');
                setNoteModalOpen(true);
              }}
            >
              <StickyNote size={16} />
            </button>

            {isPdf && (
              <button
                className="btn btn-secondary"
                style={{ padding: '5px 10px', fontSize: '0.78rem', gap: '5px' }}
                title="استخراج النص العربي من هذه الصفحة المصورة (OCR)"
                onClick={handleRunOcrOnPage}
                disabled={isOcrProcessing}
              >
                {isOcrProcessing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} style={{ color: 'var(--accent-secondary)' }} />}
                <span>استخراج النص</span>
              </button>
            )}

            {/* Zoom Controls */}
            <button
              className="btn-icon"
              title="تكبير"
              onClick={() => setZoomLevel((z) => Math.min(160, z + 10))}
            >
              <ZoomIn size={16} />
            </button>
            <button
              className="btn-icon"
              title="تصغير"
              onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
            >
              <ZoomOut size={16} />
            </button>

            {/* Theme switcher */}
            <button
              className={`btn-icon ${theme === 'dark' ? 'active' : ''}`}
              title="داكن"
              onClick={() => switchTheme('dark')}
            >
              <Moon size={16} />
            </button>
            <button
              className={`btn-icon ${theme === 'light' ? 'active' : ''}`}
              title="فاتح"
              onClick={() => switchTheme('light')}
            >
              <Sun size={16} />
            </button>
            <button
              className={`btn-icon ${theme === 'sepia' ? 'active' : ''}`}
              title="دافئ / ورق"
              onClick={() => switchTheme('sepia')}
            >
              <Coffee size={16} />
            </button>

            {/* Fullscreen */}
            <button className="btn-icon" title="ملء الشاشة" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>

          {/* Sidebar Toggle */}
          <button
            className={`btn ${sidebarOpen ? 'btn-primary' : 'btn-secondary'} reader-sidebar-toggle-btn`}
            style={{ padding: '6px 10px', fontSize: '0.82rem', minHeight: '38px' }}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="فهرس ومحتويات وتظليلات الكتاب"
          >
            <List size={16} />
            <span className="reader-sidebar-btn-label">اللوحة</span>
            {highlights.length + bookmarks.length > 0 && (
              <span
                style={{
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '1px 5px',
                  fontSize: '0.7rem',
                }}
              >
                {highlights.length + bookmarks.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* 1.5 DEDICATED MOBILE & TABLET TOOLS STRIP */}
      <div className="reader-mobile-tools-bar hide-scrollbar">
        {/* Highlight Tool on Mobile */}
        {isPdf && pdfViewMode === 'original' && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: isHighlightMode ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isHighlightMode ? activeCategoryColor : 'var(--border-color)'}`, borderRadius: 'var(--radius-md)', padding: '4px 8px', flexShrink: 0 }}>
            <button
              style={{
                background: 'none',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                color: isHighlightMode ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '0.8rem',
                fontWeight: 600,
                padding: '2px',
              }}
              onClick={() => setIsHighlightMode(!isHighlightMode)}
            >
              <Highlighter size={15} style={{ color: activeCategoryColor }} />
              <span>{isHighlightMode ? 'تظليل مفعّل' : 'تفعيل'}</span>
            </button>

            {/* Quick Color Dots */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderRight: '1px solid var(--border-color)', paddingRight: '6px' }}>
              {categories.slice(0, 5).map((c) => (
                <button
                  key={c.id}
                  title={c.name}
                  onClick={() => {
                    setActiveCategoryId(c.id);
                    setIsHighlightMode(true);
                  }}
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: c.colorHex,
                    border: activeCategoryId === c.id ? '2px solid #fff' : '1px solid rgba(0,0,0,0.3)',
                    cursor: 'pointer',
                    transform: activeCategoryId === c.id ? 'scale(1.2)' : 'scale(1)',
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Bookmark Quick Button */}
        <button
          className={`btn-icon ${isPageBookmarked ? 'active' : ''}`}
          style={{
            width: '36px',
            height: '36px',
            color: isPageBookmarked ? '#F59E0B' : 'inherit',
            background: isPageBookmarked ? 'rgba(245, 158, 11, 0.15)' : undefined,
            borderColor: isPageBookmarked ? '#F59E0B' : undefined,
            flexShrink: 0,
          }}
          title={isPageBookmarked ? 'إزالة الإشارة المرجعية' : 'حفظ إشارة مرجعية'}
          onClick={handleTogglePageBookmark}
        >
          <Bookmark size={15} fill={isPageBookmarked ? '#F59E0B' : 'none'} />
        </button>

        {/* Add Note Quick Button */}
        <button
          className="btn-icon"
          style={{ width: '36px', height: '36px', flexShrink: 0 }}
          title="إضافة ملاحظة"
          onClick={() => {
            setPendingNoteSnippet(`صفحة ${currentPage}`);
            setPendingNoteHighlightId(null);
            setNoteText('');
            setNoteModalOpen(true);
          }}
        >
          <StickyNote size={15} />
        </button>

        {/* OCR Button on Mobile (PDF) */}
        {isPdf && (
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.76rem', gap: '4px', height: '36px', flexShrink: 0 }}
            title="استخراج النص (OCR)"
            onClick={handleRunOcrOnPage}
            disabled={isOcrProcessing}
          >
            {isOcrProcessing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} style={{ color: 'var(--accent-secondary)' }} />}
            <span>OCR</span>
          </button>
        )}

        {/* Zoom Controls */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)', padding: '2px', flexShrink: 0 }}>
          <button
            className="btn-icon"
            style={{ width: '32px', height: '32px', border: 'none', background: 'transparent' }}
            title="تكبير"
            onClick={() => setZoomLevel((z) => Math.min(160, z + 10))}
          >
            <ZoomIn size={15} />
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 3px' }}>{zoomLevel}%</span>
          <button
            className="btn-icon"
            style={{ width: '32px', height: '32px', border: 'none', background: 'transparent' }}
            title="تصغير"
            onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
          >
            <ZoomOut size={15} />
          </button>
        </div>

        {/* Theme switcher */}
        <div style={{ display: 'inline-flex', gap: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)', padding: '2px', flexShrink: 0 }}>
          <button
            className={`btn-icon ${theme === 'dark' ? 'active' : ''}`}
            style={{ width: '32px', height: '32px', border: 'none', background: theme === 'dark' ? 'rgba(99, 102, 241, 0.25)' : 'transparent', color: theme === 'dark' ? 'var(--accent-primary)' : 'inherit' }}
            title="داكن"
            onClick={() => switchTheme('dark')}
          >
            <Moon size={14} />
          </button>
          <button
            className={`btn-icon ${theme === 'light' ? 'active' : ''}`}
            style={{ width: '32px', height: '32px', border: 'none', background: theme === 'light' ? 'rgba(99, 102, 241, 0.25)' : 'transparent', color: theme === 'light' ? 'var(--accent-primary)' : 'inherit' }}
            title="فاتح"
            onClick={() => switchTheme('light')}
          >
            <Sun size={14} />
          </button>
          <button
            className={`btn-icon ${theme === 'sepia' ? 'active' : ''}`}
            style={{ width: '32px', height: '32px', border: 'none', background: theme === 'sepia' ? 'rgba(99, 102, 241, 0.25)' : 'transparent', color: theme === 'sepia' ? 'var(--accent-primary)' : 'inherit' }}
            title="ورق"
            onClick={() => switchTheme('sepia')}
          >
            <Coffee size={14} />
          </button>
        </div>

        {/* Fullscreen Button */}
        <button
          className="btn-icon"
          style={{ width: '36px', height: '36px', flexShrink: 0 }}
          title="ملء الشاشة"
          onClick={toggleFullscreen}
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>

        {/* Page indicator */}
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', paddingRight: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {currentPage} / {totalPages}
        </span>
      </div>

      {/* 2. MAIN READING VIEWPORT */}
      <div className="reader-main">
        <div
          ref={pageViewRef}
          className="reader-viewport"
          onMouseUp={handleTextSelection}
          onTouchEnd={handleTextSelection}
        >
          {loading ? (
            <div style={{ marginTop: '100px', textAlign: 'center', color: 'var(--text-muted)' }}>
              جاري فتح الكتاب وتجهيز الصفحات...
            </div>
          ) : isPdf && pdfViewMode === 'original' ? (
            /* PDF CANVAS MODE: Renders the real scanned or digital PDF page with Interactive Highlighting Layer */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
              }}
            >
              {/* Highlight instructions banner */}
              <div
                style={{
                  background: 'var(--bg-glass)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 16px',
                  marginBottom: '12px',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Highlighter size={14} style={{ color: activeCategoryColor }} />
                <span>
                  <strong>طريقة التظليل المباشر:</strong> اسحب بالفأرة أو الإصبع فوق أي سطر أو فقرة لتظليلها فوراً بتصنيف «{activeCategory?.name}» وحفظها بشكل دائم.
                </span>
              </div>

              {/* Loading State or Error when pdfDoc is not yet ready */}
              {pdfDocLoading || (!pdfDoc && !pdfDocError) ? (
                <div
                  style={{
                    width: '100%',
                    maxWidth: '800px',
                    minHeight: '440px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px',
                    color: 'var(--text-secondary)',
                    margin: '20px auto',
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  <Loader2 size={38} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    جاري فتح وتجهيز صفحات الكتاب الأصلية...
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    يتم قراءة الصفحة بدقة عالية مع تفعيل التظليل والبحث المباشر
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ marginTop: '10px', fontSize: '0.85rem' }}
                    onClick={() => setPdfViewMode('text')}
                  >
                    <FileText size={14} />
                    <span>الانتقال للقراءة النصية الرقمية</span>
                  </button>
                </div>
              ) : pdfDocError ? (
                <div
                  style={{
                    width: '100%',
                    maxWidth: '600px',
                    padding: '30px 20px',
                    textAlign: 'center',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    margin: '20px auto',
                  }}
                >
                  <div style={{ color: '#EF4444', marginBottom: '14px', fontSize: '1.05rem', fontWeight: 600 }}>
                    {pdfDocError}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        loadedBookIdRef.current = null;
                        pdfDocRef.current = null;
                        setPdfDocError(null);
                        setPdfDoc(null);
                        setPdfLibReady(true);
                      }}
                    >
                      إعادة المحاولة
                    </button>
                    <button className="btn btn-secondary" onClick={() => setPdfViewMode('text')}>
                      عرض النص الرقمي
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {pdfRendering && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '50px',
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(0,0,0,0.7)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.85rem',
                        zIndex: 20,
                      }}
                    >
                      <Loader2 size={16} className="animate-spin" />
                      <span>جاري رسم صفحة الكتاب...</span>
                    </div>
                  )}

                  {/* The Interactive Page Canvas & Highlight Overlay Wrapper */}
                  <div
                    ref={canvasWrapperRef}
                    style={{
                      position: 'relative',
                      display: 'inline-block',
                      background: '#fff',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-lg)',
                      margin: '0 auto',
                      border: '1px solid var(--border-color)',
                      cursor: isHighlightMode ? 'crosshair' : 'default',
                      userSelect: 'none',
                      touchAction: isHighlightMode ? 'none' : 'auto',
                    }}
                    onPointerDown={handleCanvasPointerDown}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerUp={handleCanvasPointerUp}
                  >
                    {/* 1. Underlying Real Scanned Page Canvas */}
                    <canvas
                      ref={canvasRef}
                      style={{ display: 'block', maxWidth: '100%', height: 'auto', pointerEvents: 'none' }}
                    />

                {/* 2. Visual Highlights Rendered Over the Scanned Page */}
                {pageHighlights.map((hl) => {
                  if (!hl.positionData?.box) return null;
                  const cat = catMap.get(hl.categoryId);
                  const color = cat?.colorHex || '#EF4444';
                  const box = hl.positionData.box;

                  return (
                    <div
                      key={hl.id}
                      className="page-visual-highlight"
                      style={{
                        position: 'absolute',
                        left: `${box.x}%`,
                        top: `${box.y}%`,
                        width: `${box.width}%`,
                        height: `${box.height}%`,
                        backgroundColor: `${color}40`,
                        borderBottom: `3px solid ${color}`,
                        borderRadius: '3px',
                        cursor: 'pointer',
                        pointerEvents: 'auto',
                        boxShadow: `0 0 10px ${color}40`,
                        transition: 'filter 0.15s ease',
                        zIndex: 5,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedHighlight(hl);
                      }}
                      title={`${cat?.name || 'تظليل'}${hl.note ? ': ' + hl.note : ''}`}
                    />
                  );
                })}

                {/* 2.5 Active Search Highlight on Scanned Book Page */}
                {activeScannedSearchBox && (
                  <div
                    id="active-search-highlight"
                    className="scanned-search-highlight-marker"
                    style={{
                      position: 'absolute',
                      left: `${activeScannedSearchBox.x}%`,
                      top: `${activeScannedSearchBox.y}%`,
                      width: `${activeScannedSearchBox.width}%`,
                      height: `${activeScannedSearchBox.height}%`,
                      backgroundColor: 'rgba(234, 179, 8, 0.4)',
                      border: '3px solid #EAB308',
                      borderRadius: '6px',
                      boxShadow: '0 0 25px rgba(234, 179, 8, 0.85), inset 0 0 12px rgba(234, 179, 8, 0.45)',
                      pointerEvents: 'auto',
                      zIndex: 25,
                      animation: 'pulseGlow 2s infinite ease-in-out',
                      cursor: 'pointer',
                      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    title={`نتيجة البحث: ${activeScannedSearchBox.exactMatch || activeSearchTarget?.query}`}
                  >
                    {/* Floating Pill Label */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '100%',
                        right: '0',
                        marginBottom: '6px',
                        background: '#EAB308',
                        color: '#000',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        pointerEvents: 'none',
                      }}
                    >
                      <Sparkles size={12} />
                      <span>نتيجة البحث: «{activeScannedSearchBox.exactMatch || activeSearchTarget?.query}»</span>
                    </div>
                  </div>
                )}

                {/* 3. Live Dragging Highlight Box Preview */}
                {currentDragBox && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${currentDragBox.x}%`,
                      top: `${currentDragBox.y}%`,
                      width: `${currentDragBox.width}%`,
                      height: `${currentDragBox.height}%`,
                      backgroundColor: `${activeCategoryColor}45`,
                      border: `2px dashed ${activeCategoryColor}`,
                      borderRadius: '3px',
                      pointerEvents: 'none',
                      zIndex: 10,
                    }}
                  />
                )}

                {/* 4. Popover when a highlight box is finished dragging - ANCHORED DIRECTLY OVER THE BOX */}
                {pendingBoxHighlight && (
                  <div
                    className="floating-selection-bar"
                    style={{
                      position: 'absolute',
                      left: `${Math.max(25, Math.min(75, pendingBoxHighlight.box.x + pendingBoxHighlight.box.width / 2))}%`,
                      top: `${pendingBoxHighlight.box.y > 20 ? pendingBoxHighlight.box.y : pendingBoxHighlight.box.y + pendingBoxHighlight.box.height + 2}%`,
                      transform: pendingBoxHighlight.box.y > 20 ? 'translate(-50%, -105%)' : 'translate(-50%, 5%)',
                      zIndex: 100,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '10px 14px',
                      boxShadow: '0 12px 35px rgba(0,0,0,0.7)',
                      pointerEvents: 'auto',
                      minWidth: 'min(92vw, 300px)',
                      maxWidth: 'min(94vw, 440px)',
                      boxSizing: 'border-box',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Live extracted text display & edit */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Sparkles size={13} style={{ color: 'var(--accent-secondary)' }} />
                          <strong>النص المضلل عليه:</strong>
                        </span>
                        {isExtractingBoxText && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-secondary)' }}>
                            <Loader2 size={12} className="animate-spin" />
                            <span>جاري القراءة...</span>
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        className="form-input"
                        style={{
                          padding: '6px 10px',
                          fontSize: '0.88rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(0, 0, 0, 0.35)',
                          borderColor: isExtractingBoxText ? 'var(--accent-secondary)' : 'var(--border-color)',
                          color: 'var(--text-primary)',
                          width: '100%',
                        }}
                        placeholder={isExtractingBoxText ? 'جاري استخراج النص من التظليل...' : 'اكتب أو عدّل النص هنا...'}
                        value={pendingBoxText}
                        onChange={(e) => setPendingBoxText(e.target.value)}
                        dir="rtl"
                      />
                    </div>

                    {/* Categories & Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        حفظ كـ:
                      </div>

                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          className="selection-btn"
                          onClick={() => handleApplyBoxHighlight(cat.id)}
                          style={{
                            borderColor: cat.id === activeCategoryId ? cat.colorHex : 'rgba(255,255,255,0.1)',
                            borderWidth: '1px',
                            borderStyle: 'solid',
                            background: cat.id === activeCategoryId ? `${cat.colorHex}22` : undefined,
                            padding: '4px 8px',
                            fontSize: '0.78rem',
                          }}
                          title={`حفظ بتصنيف: ${cat.name}`}
                        >
                          <span className="category-dot" style={{ backgroundColor: cat.colorHex, width: '9px', height: '9px' }} />
                          <span>{cat.name}</span>
                        </button>
                      ))}

                      <button
                        className="selection-btn"
                        style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                        onClick={() => {
                          handleApplyBoxHighlight(activeCategoryId).then((hlId) => {
                            if (hlId) {
                              setPendingNoteSnippet(pendingBoxText || `تظليل في الصفحة ${currentPage}`);
                              setPendingNoteHighlightId(hlId);
                              setNoteText('');
                              setNoteModalOpen(true);
                            }
                          });
                        }}
                        title="حفظ وإضافة ملاحظة"
                      >
                        <StickyNote size={13} />
                        <span>ملاحظة</span>
                      </button>

                      <button
                        className="btn-icon"
                        style={{ width: '24px', height: '24px', padding: 0, marginRight: 'auto' }}
                        onClick={() => {
                          setPendingBoxHighlight(null);
                          setPendingBoxText('');
                        }}
                        title="إلغاء"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* 5. Popover when clicking an existing highlight on the page */}
                {selectedHighlight && selectedHighlight.positionData?.box && (
                  <div
                    className="floating-selection-bar"
                    style={{
                      position: 'absolute',
                      left: `${Math.max(25, Math.min(75, selectedHighlight.positionData.box.x + selectedHighlight.positionData.box.width / 2))}%`,
                      top: `${selectedHighlight.positionData.box.y > 15 ? selectedHighlight.positionData.box.y : selectedHighlight.positionData.box.y + selectedHighlight.positionData.box.height + 2}%`,
                      transform: selectedHighlight.positionData.box.y > 15 ? 'translate(-50%, -105%)' : 'translate(-50%, 5%)',
                      zIndex: 100,
                      minWidth: 'min(90vw, 260px)',
                      maxWidth: 'min(94vw, 380px)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '10px 14px',
                      pointerEvents: 'auto',
                      boxSizing: 'border-box',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          className="category-dot"
                          style={{ backgroundColor: selectedHighlight.category?.colorHex || '#EF4444' }}
                        />
                        <strong style={{ fontSize: '0.9rem' }}>
                          {selectedHighlight.category?.name || 'تظليل'}
                        </strong>
                      </div>

                      <button
                        className="btn-icon"
                        style={{ width: '24px', height: '24px', color: 'var(--danger)' }}
                        onClick={() => handleDeleteHighlight(selectedHighlight.id)}
                        title="إزالة التظليل"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {selectedHighlight.text && !selectedHighlight.text.startsWith('تظليل في الصفحة') && (
                      <div
                        style={{
                          fontSize: '0.82rem',
                          color: 'var(--text-secondary)',
                          background: 'rgba(0,0,0,0.2)',
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-sm)',
                          maxHeight: '80px',
                          overflowY: 'auto',
                          lineHeight: 1.6,
                        }}
                      >
                        {selectedHighlight.text}
                      </div>
                    )}

                    {selectedHighlight.note ? (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.04)', padding: '6px', borderRadius: '4px' }}>
                        💬 {selectedHighlight.note}
                      </div>
                    ) : null}

                    <div style={{ display: 'flex', gap: '8px', width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ flex: 1, padding: '4px 8px', fontSize: '0.78rem' }}
                        onClick={() => {
                          setPendingNoteHighlightId(selectedHighlight.id);
                          setPendingNoteSnippet(selectedHighlight.text || `تظليل في الصفحة ${currentPage}`);
                          setNoteText(selectedHighlight.note || '');
                          setNoteModalOpen(true);
                        }}
                      >
                        <StickyNote size={12} />
                        <span>{selectedHighlight.note ? 'تعديل الملاحظة' : 'إضافة ملاحظة'}</span>
                      </button>

                      {selectedHighlight.text && !selectedHighlight.text.startsWith('تظليل في الصفحة') && (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                          onClick={() => {
                            navigator.clipboard.writeText(selectedHighlight.text);
                            alert('تم نسخ نص التظليل بنجاح');
                          }}
                          title="نسخ النص"
                        >
                          <Copy size={13} />
                        </button>
                      )}

                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                        onClick={() => setSelectedHighlight(null)}
                      >
                        إغلاق
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
            /* REFLOWABLE TEXT MODE (For EPUB, DOCX, TXT, or OCR text) */
            <div
              className="reader-page-card"
              style={{
                fontSize: `${fontSize}px`,
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: 'top center',
                fontFamily: `var(--font-${fontFamily.toLowerCase()})`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '12px',
                  marginBottom: '28px',
                }}
              >
                <span>{book?.title}</span>
                <span>صفحة {currentPage}</span>
              </div>

              {renderHighlightedContent()}

              <div
                style={{
                  textAlign: 'center',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  marginTop: '40px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                — {currentPage} —
              </div>
            </div>
          )}
        </div>

        {/* 3. FLOATING TEXT SELECTION TOOLBAR FOR NORMAL TEXT */}
        {selectionRange && (
          <div
            className="floating-selection-bar"
            style={{
              position: 'fixed',
              left: `${Math.max(16, Math.min((typeof window !== 'undefined' ? window.innerWidth : 400) - 16, selectionRange.x))}px`,
              top: `${Math.max(68, Math.min((typeof window !== 'undefined' ? window.innerHeight : 800) - 90, selectionRange.y))}px`,
              zIndex: 1000,
              maxWidth: 'calc(100vw - 24px)',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ position: 'relative' }}>
              <button
                className="selection-btn"
                style={{ color: 'var(--accent-secondary)' }}
                onClick={() => setCategoryPickerOpen(!categoryPickerOpen)}
              >
                <Highlighter size={16} />
                <span>تظليل</span>
              </button>

              {categoryPickerOpen && (
                <div className="category-picker-menu">
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '4px 8px', fontWeight: 700 }}>
                    اختر تصنيف التظليل:
                  </div>

                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      className="category-picker-item"
                      onClick={() => handleApplyHighlight(cat.id)}
                    >
                      <span className="category-dot" style={{ backgroundColor: cat.colorHex }} />
                      <span style={{ flex: 1 }}>{cat.name}</span>
                    </button>
                  ))}

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '4px', marginTop: '4px' }}>
                    <button
                      className="category-picker-item"
                      style={{ color: 'var(--accent-primary)', fontWeight: 600 }}
                      onClick={() => {
                        setCategoryPickerOpen(false);
                        setNewCatModalOpen(true);
                      }}
                    >
                      <Plus size={14} />
                      <span>إضافة تصنيف جديد...</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button className="selection-btn" onClick={handleAddBookmark}>
              <Bookmark size={16} />
              <span>علامة</span>
            </button>

            <button
              className="selection-btn"
              onClick={() => {
                setPendingNoteSnippet(selectionRange.text);
                setNoteModalOpen(true);
              }}
            >
              <FileText size={16} />
              <span>ملاحظة</span>
            </button>

            <button className="selection-btn" onClick={handleCopyText}>
              {copyFeedback ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
              <span>{copyFeedback ? 'تم النسخ' : 'نسخ'}</span>
            </button>

            <button
              className="btn-icon"
              style={{ width: '28px', height: '28px' }}
              onClick={() => {
                setSelectionRange(null);
                setCategoryPickerOpen(false);
                window.getSelection()?.removeAllRanges();
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* 4. READER SIDEBAR (6 TABS) */}
        {sidebarOpen && (
          <>
            <div className="reader-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
            <aside className="reader-sidebar">
              <div className="reader-sidebar-header">
                <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>محتويات وقائمة الكتاب</span>
                <button
                  className="btn-icon"
                  style={{ width: '28px', height: '28px' }}
                  onClick={() => setSidebarOpen(false)}
                  title="إغلاق"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="sidebar-tabs hide-scrollbar">
                <button
                  className={`sidebar-tab-btn ${sidebarTab === 'toc' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('toc')}
                >
                  <span>الفهرس</span>
                </button>

              <button
                className={`sidebar-tab-btn ${sidebarTab === 'search' ? 'active' : ''}`}
                onClick={() => setSidebarTab('search')}
              >
                <span>البحث</span>
              </button>

              <button
                className={`sidebar-tab-btn ${sidebarTab === 'highlights' ? 'active' : ''}`}
                onClick={() => setSidebarTab('highlights')}
              >
                <span>التظليلات ({highlights.length})</span>
              </button>

              <button
                className={`sidebar-tab-btn ${sidebarTab === 'categories' ? 'active' : ''}`}
                onClick={() => setSidebarTab('categories')}
              >
                <span>الألوان</span>
              </button>

              <button
                className={`sidebar-tab-btn ${sidebarTab === 'bookmarks' ? 'active' : ''}`}
                onClick={() => setSidebarTab('bookmarks')}
              >
                <span>العلامات ({bookmarks.length})</span>
              </button>

              <button
                className={`sidebar-tab-btn ${sidebarTab === 'notes' ? 'active' : ''}`}
                onClick={() => setSidebarTab('notes')}
              >
                <span>الملاحظات ({notes.length})</span>
              </button>
            </div>

            <div className="sidebar-content">
              {/* TAB 1: TOC */}
              {sidebarTab === 'toc' && (
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px' }}>
                    فهرس محتويات الكتاب
                  </div>
                  {pages.length > 0 ? (
                    pages.slice(0, 100).map((p) => {
                      const previewText = p.textContent.slice(0, 45).replace(/\n/g, ' ');
                      return (
                        <div
                          key={p.pageNumber}
                          className="item-card"
                          style={p.pageNumber === currentPage ? { borderColor: 'var(--accent-primary)' } : {}}
                          onClick={() => goToPage(p.pageNumber)}
                        >
                          <div className="item-header">
                            <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                              صفحة {p.pageNumber}
                            </span>
                            {p.pageNumber === currentPage && (
                              <span className="item-badge" style={{ background: 'var(--accent-primary)', color: '#fff' }}>
                                الصفحة الحالية
                              </span>
                            )}
                          </div>
                          {previewText && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {previewText}...
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    Array.from({ length: Math.min(totalPages, 50) }, (_, i) => i + 1).map((num) => (
                      <div
                        key={num}
                        className="item-card"
                        style={num === currentPage ? { borderColor: 'var(--accent-primary)' } : {}}
                        onClick={() => goToPage(num)}
                      >
                        <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>صفحة {num}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 2: IN-BOOK SEARCH */}
              {sidebarTab === 'search' && (
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', position: 'relative' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type="text"
                        className="form-input"
                        style={{ paddingLeft: searchQuery ? '32px' : '12px', width: '100%' }}
                        placeholder="ابحث عن كلمة أو عبارة في الكتاب..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleInBookSearch()}
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            handleInBookSearch('');
                          }}
                          style={{
                            position: 'absolute',
                            left: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="مسح البحث"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleInBookSearch()}
                      disabled={isSearching}
                      title="بحث فوري"
                    >
                      {isSearching ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Search size={16} />
                      )}
                    </button>
                  </div>

                  {/* 1. Progressive Scanned Search Progress Banner (Optional OCR Scan) */}
                  {isScannedSearching && (
                    <div
                      style={{
                        background: 'rgba(99, 102, 241, 0.12)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        padding: '10px 14px',
                        marginBottom: '14px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                          <Loader2 size={13} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
                          <span>جاري فحص الصفحات المصوّرة (OCR)...</span>
                        </div>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                          onClick={stopScannedSearch}
                        >
                          إيقاف
                        </button>
                      </div>

                      <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', marginBottom: '5px' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.round((scannedSearchProgress.current / (scannedSearchProgress.total || totalPages || 1)) * 100)}%`,
                            background: 'var(--accent-primary)',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                        <span>صفحة {scannedSearchProgress.current} من {scannedSearchProgress.total || totalPages}</span>
                        <span>{Math.round((scannedSearchProgress.current / (scannedSearchProgress.total || totalPages || 1)) * 100)}%</span>
                      </div>
                    </div>
                  )}

                  {/* 2. Full-Book Background Indexing Card (for Scanned Books) */}
                  {isPdf && !isScannedSearching && (
                    <div
                      style={{
                        background: 'var(--bg-glass)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: '8px 12px',
                        marginBottom: '14px',
                        fontSize: '0.78rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Sparkles size={13} style={{ color: 'var(--accent-secondary)' }} />
                          <span>فهرسة الكتاب كاملاً للبحث</span>
                        </div>

                        {isIndexingBook ? (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                            onClick={stopFullBookIndexing}
                          >
                            إيقاف
                          </button>
                        ) : (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                            onClick={startFullBookIndexing}
                            title="فهرسة جميع صفحات الكتاب المصور في الخلفية لتسريع البحث المستقبلي"
                          >
                            ⚡ بدء الفهرسة
                          </button>
                        )}
                      </div>

                      {isIndexingBook && (
                        <div style={{ marginTop: '6px' }}>
                          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginBottom: '4px' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${indexingProgress.percent || 0}%`,
                                background: 'var(--accent-secondary)',
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            جاري فهرسة صفحة {indexingProgress.current} من {indexingProgress.total || totalPages} ({indexingProgress.percent || 0}%)...
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. Search Results */}
                  {searchResults.length > 0 ? (
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          borderRadius: 'var(--radius-md)',
                          marginBottom: '14px',
                          fontSize: '0.82rem',
                        }}
                      >
                        <span style={{ color: 'var(--text-primary)' }}>
                          تم العثور على <strong>{searchTotalMatches}</strong> نتيجة في <strong>{searchResults.length}</strong> صفحة
                        </span>
                        {searchDurationMs !== null && (
                          <span style={{ fontSize: '0.74rem', color: '#10B981', fontWeight: 600 }}>
                            ⚡ {searchDurationMs}ms
                          </span>
                        )}
                      </div>

                      {searchResults.map((res) => (
                        <div
                          key={res.pageNumber}
                          style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            padding: '12px',
                            marginBottom: '10px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '8px',
                            }}
                          >
                            <span
                              className="item-badge"
                              style={{
                                background: 'rgba(99, 102, 241, 0.15)',
                                color: 'var(--accent-primary)',
                                fontWeight: 700,
                              }}
                            >
                              صفحة {res.pageNumber} ({res.matches.length} نتيجة)
                            </span>

                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                              onClick={() => goToPage(res.pageNumber)}
                            >
                              <span>انتقال للصفحة</span>
                              <ChevronLeft size={13} />
                            </button>
                          </div>

                          {res.matches.map((m: any, idx: number) => {
                            const isMatchActive =
                              currentPage === res.pageNumber &&
                              (activeSearchTarget?.origStart === m.origStart ||
                                activeSearchTarget?.matchIndex === m.matchIndex);

                            return (
                              <div
                                key={idx}
                                className="item-card"
                                style={{
                                  padding: '9px 12px',
                                  marginBottom: '7px',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                  lineHeight: 1.6,
                                  background: isMatchActive
                                    ? 'rgba(234, 179, 8, 0.16)'
                                    : 'rgba(255, 255, 255, 0.03)',
                                  border: isMatchActive
                                    ? '1.5px solid #EAB308'
                                    : '1px solid transparent',
                                  borderRadius: 'var(--radius-sm)',
                                  transition: 'all 0.15s ease',
                                }}
                                onClick={() => handleSelectInBookSearchResult(res.pageNumber, m)}
                                title="اضغط للانتقال إلى موضع النتيجة تحديداً وتمييزها في الصفحة"
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span style={{ fontSize: '0.76rem', color: isMatchActive ? '#EAB308' : 'var(--accent-primary)', fontWeight: 700 }}>
                                    موضع {m.matchIndex + 1}: «{m.exactMatch}»
                                  </span>
                                  {m.score >= 85 ? (
                                    <span className="search-match-badge exact" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                                      تطابق تام
                                    </span>
                                  ) : (
                                    <span className="search-match-badge flexible" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                                      بحث مرن
                                    </span>
                                  )}
                                </div>
                                <div>{highlightSnippet(m.snippet, m.exactMatch || searchQuery)}</div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ) : isSearching ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: 'var(--accent-primary)' }} />
                      <div style={{ fontSize: '0.85rem' }}>جاري البحث الفوري في صفحات الكتاب...</div>
                    </div>
                  ) : hasSearched && searchQuery.trim() && !isScannedSearching ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                      <p style={{ marginBottom: '10px', fontSize: '0.85rem' }}>لم يتم العثور على نتائج في النص المباشر للكتاب.</p>
                      {isPdf && (
                        <div
                          style={{
                            background: 'rgba(99, 102, 241, 0.08)',
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                            borderRadius: 'var(--radius-md)',
                            padding: '14px',
                            marginTop: '10px',
                          }}
                        >
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                            إذا كانت الصفحة مصوّرة كصورة، يمكنك إجراء بحث معمّق بالتعرف الضوئي (OCR):
                          </p>
                          <button
                            className="btn btn-secondary"
                            style={{ margin: '0 auto', fontSize: '0.8rem' }}
                            onClick={() => startScannedSearch(searchQuery.trim())}
                          >
                            <Sparkles size={14} style={{ color: 'var(--accent-secondary)' }} />
                            <span>فحص الصفحات المصورة بالـ OCR</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px', fontSize: '0.82rem' }}>
                      اكتب أي كلمة للبحث الفوري في محتوى الكتاب. النتائج تظهر فوراً مع رقم الصفحة والنص المحيط.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: HIGHLIGHTS */}
              {sidebarTab === 'highlights' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                      جميع التظليلات المحفوظة
                    </span>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                      onClick={() => setNewCatModalOpen(true)}
                    >
                      <Plus size={12} />
                      <span>تصنيف جديد</span>
                    </button>
                  </div>

                  {highlights.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px', fontSize: '0.85rem' }}>
                      اسحب فوق أي سطر في الصفحة لتظليله بألوانك وتصنيفاتك المخصصة
                    </div>
                  ) : (
                    highlights.map((hl) => {
                      const cat = catMap.get(hl.categoryId);
                      const color = cat?.colorHex || '#EF4444';

                      return (
                        <div key={hl.id} className="item-card" onClick={() => goToPage(hl.pageNumber)}>
                          <div className="item-header">
                            <span
                              className="item-badge"
                              style={{
                                backgroundColor: `${color}25`,
                                color: color,
                                border: `1px solid ${color}60`,
                              }}
                            >
                              <span className="category-dot" style={{ backgroundColor: color, width: '8px', height: '8px' }} />
                              {cat?.name || 'تظليل'} — صفحة {hl.pageNumber}
                            </span>

                            <button
                              className="btn-icon"
                              style={{ width: '24px', height: '24px', color: 'var(--danger)' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteHighlight(hl.id);
                              }}
                              title="حذف التظليل"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>

                          <div className="item-text" style={{ fontStyle: 'italic' }}>
                            «{hl.text}»
                          </div>

                          {hl.note && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.04)', padding: '6px', borderRadius: '4px' }}>
                              📝 {hl.note}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 4: CATEGORIES MANAGER */}
              {sidebarTab === 'categories' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                      تصنيفات الألوان المخصصة
                    </span>
                    <button
                      className="btn btn-primary"
                      style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                      onClick={() => setNewCatModalOpen(true)}
                    >
                      <Plus size={14} />
                      <span>إضافة</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {categories.map((c) => {
                      const count = highlights.filter((h) => h.categoryId === c.id).length;
                      return (
                        <div
                          key={c.id}
                          className="item-card"
                          style={{
                            borderRight: `4px solid ${c.colorHex}`,
                            borderColor: activeCategoryId === c.id ? c.colorHex : undefined,
                          }}
                          onClick={() => {
                            setActiveCategoryId(c.id);
                            setIsHighlightMode(true);
                          }}
                        >
                          <div className="item-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="category-dot" style={{ backgroundColor: c.colorHex }} />
                              <strong style={{ fontSize: '0.9rem' }}>{c.name}</strong>
                              {activeCategoryId === c.id && (
                                <span className="item-badge" style={{ background: 'var(--accent-primary)', color: '#fff', fontSize: '0.65rem' }}>
                                  المختار حالياً
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {count} تظليل
                            </span>
                          </div>
                          {c.description && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              {c.description}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 5: BOOKMARKS */}
              {sidebarTab === 'bookmarks' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                      العلامات المرجعية
                    </span>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                      onClick={handleAddBookmark}
                    >
                      <Plus size={14} />
                      <span>إضافة لهذه الصفحة</span>
                    </button>
                  </div>

                  {bookmarks.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px', fontSize: '0.85rem' }}>
                      لا توجد علامات مرجعية في هذا الكتاب بعد
                    </div>
                  ) : (
                    bookmarks.map((bm) => (
                      <div key={bm.id} className="item-card" onClick={() => goToPage(bm.pageNumber)}>
                        <div className="item-header">
                          <span className="item-badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: 'var(--accent-primary)' }}>
                            <Bookmark size={11} />
                            صفحة {bm.pageNumber}
                          </span>
                          <button
                            className="btn-icon"
                            style={{ width: '24px', height: '24px', color: 'var(--danger)' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBookmark(bm.id);
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{bm.title}</div>
                        {bm.textSnippet && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            «{bm.textSnippet}»
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 6: NOTES */}
              {sidebarTab === 'notes' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                      ملاحظاتي الشخصية
                    </span>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                      onClick={() => {
                        setPendingNoteSnippet(`ملاحظة على الصفحة ${currentPage}`);
                        setNoteModalOpen(true);
                      }}
                    >
                      <Plus size={14} />
                      <span>ملاحظة جديدة</span>
                    </button>
                  </div>

                  {notes.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px', fontSize: '0.85rem' }}>
                      لا توجد ملاحظات مسجلة في هذا الكتاب
                    </div>
                  ) : (
                    notes.map((note) => (
                      <div key={note.id} className="item-card" onClick={() => goToPage(note.pageNumber)}>
                        <div className="item-header">
                          <span className="item-badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: 'var(--warning)' }}>
                            <FileText size={11} />
                            صفحة {note.pageNumber}
                          </span>
                          <button
                            className="btn-icon"
                            style={{ width: '24px', height: '24px', color: 'var(--danger)' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNote(note.id);
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{note.text}</div>
                        {note.snippet && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '4px' }}>
                            النص المرتبط: «{note.snippet}»
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </aside>
        </>
      )}
      </div>

      {/* 5. BOTTOM NAVIGATION BAR */}
      <footer className="reader-footer">
        <button
          className="btn btn-secondary reader-nav-btn"
          disabled={currentPage <= 1}
          onClick={() => goToPage(currentPage - 1)}
        >
          <ChevronRight size={18} />
          <span className="reader-nav-label">السابقة</span>
        </button>

        <div className="reader-progress-slider">
          <input
            type="range"
            min={1}
            max={totalPages}
            value={currentPage}
            onChange={(e) => goToPage(parseInt(e.target.value, 10))}
            className="slider-input"
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={pageInputVal || currentPage}
              onChange={(e) => setPageInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = parseInt(pageInputVal, 10);
                  if (!isNaN(val)) goToPage(val);
                  setPageInputVal('');
                }
              }}
              style={{
                width: '48px',
                padding: '4px 6px',
                textAlign: 'center',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                fontSize: '0.85rem',
              }}
            />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>/ {totalPages}</span>
          </div>
        </div>

        <button
          className="btn btn-secondary reader-nav-btn"
          disabled={currentPage >= totalPages}
          onClick={() => goToPage(currentPage + 1)}
        >
          <span className="reader-nav-label">التالية</span>
          <ChevronLeft size={18} />
        </button>
      </footer>

      {/* 6. CREATE NEW COLOR CATEGORY MODAL */}
      {newCatModalOpen && (
        <div className="modal-overlay" onClick={() => setNewCatModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">إضافة تصنيف تظليل مخصص جديد</h3>
              <button className="btn-icon" onClick={() => setNewCatModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">اسم التصنيف (حسب المعنى الذي تريده)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: معلومات مهمة، أدلة شرعية، فوائد لغوية..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">لون التصنيف</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="color"
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                    style={{
                      width: '46px',
                      height: '46px',
                      padding: '2px',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      background: 'transparent',
                    }}
                  />
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: '120px' }}
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                  />
                  <div
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: `${newCatColor}33`,
                      border: `1.5px solid ${newCatColor}`,
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                    }}
                  >
                    معاينة التظليل
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">الوصف أو الغرض من الاستخدام (اختياري)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: النصوص التي أريد الرجوع إليها سريعاً..."
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setNewCatModalOpen(false)}>
                إلغاء
              </button>
              <button className="btn btn-primary" onClick={handleCreateCategory}>
                حفظ التصنيف وتطبيقه
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. ADD NOTE MODAL */}
      {noteModalOpen && (
        <div className="modal-overlay" onClick={() => setNoteModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">إضافة ملاحظة شخصية</h3>
              <button className="btn-icon" onClick={() => setNoteModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {pendingNoteSnippet && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    fontStyle: 'italic',
                  }}
                >
                  «{pendingNoteSnippet}»
                </div>
              )}
              <div className="form-group">
                <label className="form-label">نص الملاحظة (صفحة {currentPage})</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="اكتب فكرتك أو تحليلك أو تعليقك هنا..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setNoteModalOpen(false)}>
                إلغاء
              </button>
              <button className="btn btn-primary" onClick={handleSaveNote}>
                حفظ الملاحظة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MOBILE DISPLAY & QUICK ACTIONS MODAL */}
      {mobileSettingsOpen && (
        <div className="modal-overlay" onClick={() => setMobileSettingsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={18} style={{ color: 'var(--accent-primary)' }} />
                <span>خيارات العرض والقراءة</span>
              </h3>
              <button className="btn-icon" onClick={() => setMobileSettingsOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ gap: '16px' }}>
              {/* Theme Selection */}
              <div>
                <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>مظهر القراءة والتباين</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  <button
                    className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '8px 4px', fontSize: '0.85rem' }}
                    onClick={() => switchTheme('dark')}
                  >
                    <Moon size={15} />
                    <span>داكن</span>
                  </button>
                  <button
                    className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '8px 4px', fontSize: '0.85rem' }}
                    onClick={() => switchTheme('light')}
                  >
                    <Sun size={15} />
                    <span>فاتح</span>
                  </button>
                  <button
                    className={`btn ${theme === 'sepia' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '8px 4px', fontSize: '0.85rem' }}
                    onClick={() => switchTheme('sepia')}
                  >
                    <Coffee size={15} />
                    <span>ورق دافئ</span>
                  </button>
                </div>
              </div>

              {/* Zoom Controls */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label">مستوى التكبير ({zoomLevel}%)</label>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                    onClick={() => setZoomLevel(100)}
                  >
                    إعادة ضبط 100%
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '8px' }}
                    onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
                  >
                    <ZoomOut size={16} />
                    <span>تصغير</span>
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '8px' }}
                    onClick={() => setZoomLevel((z) => Math.min(160, z + 10))}
                  >
                    <ZoomIn size={16} />
                    <span>تكبير</span>
                  </button>
                </div>
              </div>

              {/* Font controls */}
              <div>
                <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>نوع وحجم الخط</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
                  {(['Cairo', 'Amiri', 'Tajawal'] as const).map((f) => (
                    <button
                      key={f}
                      className={`btn ${fontFamily === f ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '6px', fontSize: '0.82rem' }}
                      onClick={() => setFontFamily(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min={14}
                  max={30}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="slider-input"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Page Quick Actions */}
              <div>
                <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>إجراءات الصفحة</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
                    onClick={() => {
                      handleTogglePageBookmark();
                      setMobileSettingsOpen(false);
                    }}
                  >
                    <Bookmark size={16} fill={isPageBookmarked ? '#F59E0B' : 'none'} style={{ color: isPageBookmarked ? '#F59E0B' : 'inherit' }} />
                    <span>{isPageBookmarked ? 'إزالة العلامة المرجعية' : 'حفظ إشارة مرجعية للصفحة'}</span>
                  </button>

                  <button
                    className="btn btn-secondary"
                    style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
                    onClick={() => {
                      setPendingNoteSnippet(`صفحة ${currentPage}`);
                      setPendingNoteHighlightId(null);
                      setNoteText('');
                      setMobileSettingsOpen(false);
                      setNoteModalOpen(true);
                    }}
                  >
                    <StickyNote size={16} />
                    <span>كتابة ملاحظة على الصفحة</span>
                  </button>

                  {isPdf && (
                    <button
                      className="btn btn-secondary"
                      style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
                      onClick={() => {
                        setMobileSettingsOpen(false);
                        handleRunOcrOnPage();
                      }}
                      disabled={isOcrProcessing}
                    >
                      <Sparkles size={16} style={{ color: 'var(--accent-secondary)' }} />
                      <span>{isOcrProcessing ? 'جاري التعرف...' : 'استخراج نص الصفحة (OCR)'}</span>
                    </button>
                  )}

                  <button
                    className="btn btn-secondary"
                    style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
                    onClick={() => {
                      toggleFullscreen();
                      setMobileSettingsOpen(false);
                    }}
                  >
                    {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    <span>{isFullscreen ? 'الخروج من ملء الشاشة' : 'تفعيل ملء الشاشة'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setMobileSettingsOpen(false)}>
                تم وحفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Active Search Result Navigation Banner */}
      {activeSearchTarget && (
        <div className="search-active-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={16} style={{ color: '#FACC15', flexShrink: 0 }} />
            <span>
              تمييز نتيجة البحث عن: <strong>«{activeSearchTarget.query}»</strong>
              {currentPageSearchMatches.length > 0 && (
                <span style={{ marginRight: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  (موضع {currentMatchIndex + 1} من {currentPageSearchMatches.length} في الصفحة)
                </span>
              )}
            </span>
          </div>

          {currentPageSearchMatches.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '3px 8px', fontSize: '0.75rem', height: '28px' }}
                onClick={goToPrevSearchMatch}
                title="الموضع السابق في الصفحة"
              >
                السابق
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '3px 8px', fontSize: '0.75rem', height: '28px' }}
                onClick={goToNextSearchMatch}
                title="الموضع التالي في الصفحة"
              >
                التالي
              </button>
            </div>
          )}

          <button
            className="btn-icon"
            style={{ width: '28px', height: '28px', padding: 0, border: 'none', background: 'transparent' }}
            onClick={() => setActiveSearchTarget(null)}
            title="إزالة تمييز البحث المؤقت"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function BookReaderPage(props: { params: Promise<{ id: string }> }) {
  return (
    <React.Suspense
      fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
          <div className="spinner"></div>
        </div>
      }
    >
      <BookReaderComponent {...props} />
    </React.Suspense>
  );
}
