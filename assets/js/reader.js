/**
 * BookWeb - Client-Side Reader Engine with Full Search, Highlight & Note Creation
 */

let bookId = '';
let currentBook = null;
let currentPage = 1;
let totalPages = 1;
let currentFontSize = 19;
let currentFontFamily = 'Amiri';
let selectedTextSnippet = '';

document.addEventListener('DOMContentLoaded', () => {
  initReader();
  lucide.createIcons();
});

function initReader() {
  const urlParams = new URLSearchParams(window.location.search);
  bookId = urlParams.get('id');

  if (!bookId) {
    const books = window.BookDB.getBooks();
    if (books.length > 0) {
      bookId = books[0].id;
    } else {
      window.location.href = 'index.html';
      return;
    }
  }

  currentBook = window.BookDB.getBook(bookId);
  if (!currentBook) {
    window.location.href = 'index.html';
    return;
  }

  // Load preferences
  const savedTheme = localStorage.getItem('bookweb-theme') || 'dark';
  switchTheme(savedTheme);

  const savedFontSize = localStorage.getItem('bookweb-font-size');
  if (savedFontSize) currentFontSize = parseInt(savedFontSize);
  applyFontSize();

  const savedFont = localStorage.getItem('bookweb-font-family');
  if (savedFont) {
    currentFontFamily = savedFont;
    applyFontFamily();
  }

  // Calculate total pages
  const allTexts = window.BookDB.getAllBookTexts(bookId);
  const maxTextPage = allTexts.reduce((max, t) => Math.max(max, t.pageNumber), 1);
  totalPages = Math.max(currentBook.pageCount || 1, maxTextPage);

  // Set initial page from URL param or saved progress
  const targetPage = parseInt(urlParams.get('page'));
  if (!isNaN(targetPage) && targetPage >= 1) {
    currentPage = Math.min(targetPage, totalPages);
  } else if (currentBook.readingProgress && currentBook.readingProgress.currentPage) {
    currentPage = Math.min(currentBook.readingProgress.currentPage, totalPages);
  } else {
    currentPage = 1;
  }

  // Update header titles
  document.getElementById('readerBookTitle').textContent = currentBook.title;
  document.getElementById('readerBookAuthor').textContent = `المؤلف: ${currentBook.author || 'غير محدد'}`;
  document.title = `${currentBook.title} | قارئ الكتب الذكي`;

  // Render Category Dots for the selection toolbar & tab
  renderFloatingCategories();
  renderColorsTab();

  // Load page content and tabs
  renderCurrentPage();
  renderPagesTOC();
  renderBookHighlights();
  renderBookNotes();

  // Event listeners for text selection
  document.addEventListener('selectionchange', handleTextSelection);

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') {
      goToPage(currentPage + 1); // RTL next
    } else if (e.key === 'ArrowRight') {
      goToPage(currentPage - 1); // RTL prev
    }
  });
}

// Sidebar toggle
function toggleSidebar() {
  const sidebar = document.getElementById('readerSidebar');
  sidebar.classList.toggle('collapsed');
}

// Sidebar tab switch
function switchSidebarTab(tabName) {
  const tabs = document.querySelectorAll('.sidebar-tab-btn');
  const contents = document.querySelectorAll('.sidebar-tab-content');

  tabs.forEach(t => t.classList.remove('active'));
  contents.forEach(c => c.classList.remove('active'));

  const tabIndex = { search: 0, highlights: 1, notes: 2, toc: 3, colors: 4 };
  const idx = tabIndex[tabName] !== undefined ? tabIndex[tabName] : 0;
  if (tabs[idx]) tabs[idx].classList.add('active');

  const contentMap = {
    search: 'tabSearch',
    highlights: 'tabHighlights',
    notes: 'tabNotes',
    toc: 'tabToc',
    colors: 'tabColors'
  };
  const targetId = contentMap[tabName] || 'tabSearch';
  const targetContent = document.getElementById(targetId);
  if (targetContent) targetContent.classList.add('active');

  if (tabName === 'colors') renderColorsTab();
  if (tabName === 'search') document.getElementById('inBookSearchInput')?.focus();
  lucide.createIcons();
}

// Theme switch
function switchTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('bookweb-theme', theme);
}

// Font Size
function changeFontSize(delta) {
  currentFontSize = Math.max(14, Math.min(32, currentFontSize + delta));
  applyFontSize();
  localStorage.setItem('bookweb-font-size', currentFontSize);
}

function applyFontSize() {
  const sheet = document.getElementById('readerSheet');
  if (sheet) sheet.style.fontSize = `${currentFontSize}px`;
}

// Font Family
function changeFontFamily(font) {
  currentFontFamily = font;
  applyFontFamily();
  localStorage.setItem('bookweb-font-family', font);
}

function applyFontFamily() {
  const sheet = document.getElementById('readerSheet');
  if (sheet) sheet.style.fontFamily = `var(--font-${currentFontFamily.toLowerCase()})`;
}

// Page Navigation
function goToPage(pageNum) {
  if (pageNum < 1 || pageNum > totalPages) return;
  currentPage = pageNum;

  // Update URL without reload
  const url = new URL(window.location.href);
  url.searchParams.set('page', currentPage);
  window.history.replaceState(null, '', url.toString());

  // Save progress
  window.BookDB.saveProgress(bookId, currentPage, totalPages);

  // Re-render
  renderCurrentPage();
  renderPagesTOC();
  updateBookmarkButton();

  const noteBadge = document.getElementById('noteCurrentPageBadge');
  if (noteBadge) noteBadge.textContent = currentPage;

  // Scroll to top
  const viewport = document.getElementById('readerViewport');
  if (viewport) viewport.scrollTop = 0;
}

// Render Page Content with Highlights
function renderCurrentPage() {
  document.getElementById('jumpPageInput').value = currentPage;
  document.getElementById('readerTotalPages').textContent = totalPages;

  const pct = Math.round((currentPage / totalPages) * 100);
  document.getElementById('bottomProgressPct').textContent = `${pct}%`;

  const pageData = window.BookDB.getPageText(bookId, currentPage);
  const container = document.getElementById('pageTextContent');

  if (pageData && pageData.textContent && pageData.textContent.trim()) {
    let content = pageData.textContent;

    // Apply highlights for this page
    const pageHighlights = window.BookDB.getHighlights(bookId).filter(h => h.pageNumber === currentPage);

    let safeContent = escapeHtml(content);

    pageHighlights.forEach(h => {
      const phrase = escapeHtml(h.text.trim());
      if (phrase && phrase.length > 1) {
        const catColor = h.category?.colorHex || '#EF4444';
        const catName = h.category?.name || 'تظليل';
        const regex = new RegExp(`(${escapeRegExp(phrase)})`, 'gi');
        safeContent = safeContent.replace(regex, `<mark class="highlight-mark" style="background-color: ${catColor}44; border-bottom: 2.5px solid ${catColor};" title="${catName}: ${escapeHtml(h.note || '')}" onclick="showHighlightDetails('${h.id}')">$1</mark>`);
      }
    });

    // Format newlines
    safeContent = safeContent.split('\n').map(line => {
      if (!line.trim()) return '<br>';
      return `<p style="margin-bottom: 16px;">${line}</p>`;
    }).join('');

    container.innerHTML = safeContent;
  } else {
    container.innerHTML = `
      <div style="padding: 60px 20px; text-align: center; color: var(--text-muted);">
        <i data-lucide="book-open" style="width: 48px; height: 48px; margin: 0 auto 16px; opacity: 0.5;"></i>
        <h3 style="font-size: 1.2rem; color: var(--text-primary); margin-bottom: 8px;">صفحة ${currentPage}</h3>
        <p style="font-size: 0.9rem; margin-bottom: 20px;">هذه الصفحة عبارة عن غلاف أو وثيقة مصورة</p>
        <div style="display: flex; justify-content: center; gap: 10px;">
          <button class="btn btn-secondary" onclick="promptPastePageText()">
            <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
            <span>إضافة نص لهذه الصفحة</span>
          </button>
        </div>
      </div>
    `;
    lucide.createIcons();
  }

  updateBookmarkButton();
}

// Render TOC Grid
function renderPagesTOC() {
  const container = document.getElementById('pagesGridTOC');
  if (!container) return;

  let html = '';
  for (let p = 1; p <= totalPages; p++) {
    const isCurrent = p === currentPage;
    html += `
      <button class="btn ${isCurrent ? 'btn-primary' : 'btn-secondary'}" style="padding: 6px 2px; font-size: 0.78rem; justify-content: center; ${isCurrent ? 'font-weight: 700;' : ''}" onclick="goToPage(${p})">
        ${p}
      </button>
    `;
  }
  container.innerHTML = html;
}

// =========================================================================
// FEATURE 1: IN-BOOK SEARCH ("البحث الي داخل الكتاب")
// =========================================================================
function handleInBookSearch(query) {
  const container = document.getElementById('searchResultsList');
  const countEl = document.getElementById('searchMatchesCount');

  if (!query || !query.trim()) {
    container.innerHTML = '';
    countEl.textContent = '';
    return;
  }

  const results = window.BookDB.searchInBook(bookId, query);
  let totalMatches = 0;
  results.forEach(r => totalMatches += r.matches.length);

  countEl.textContent = `تم العثور على ${totalMatches} نتيجة في ${results.length} صفحة:`;

  if (results.length === 0) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">لا توجد نتائج مطابقة لبحثك في هذا الكتاب</div>';
    return;
  }

  let html = '';
  results.forEach(res => {
    res.matches.forEach(m => {
      const safeSnippet = escapeHtml(m.snippet);
      const safeQuery = escapeHtml(query.trim());
      const regex = new RegExp(`(${escapeRegExp(safeQuery)})`, 'gi');
      const highlightedSnippet = safeSnippet.replace(regex, '<span class="search-match-text">$1</span>');

      html += `
        <div style="padding: 10px 12px; border-radius: var(--radius-md); background: var(--bg-card); border: 1px solid var(--border-color); cursor: pointer; transition: background 0.15s ease;" onclick="goToPage(${res.pageNumber})">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 0.78rem; font-weight: 700; color: var(--accent-primary);">صفحة ${res.pageNumber}</span>
            <span style="font-size: 0.7rem; color: var(--text-muted);">انقر للانتقال</span>
          </div>
          <p style="font-size: 0.85rem; line-height: 1.5; font-family: var(--font-amiri); color: var(--text-primary);">${highlightedSnippet}</p>
        </div>
      `;
    });
  });

  container.innerHTML = html;
}

// =========================================================================
// FEATURE 2: CREATE & MANAGE HIGHLIGHTS ("إنشاء تظليل")
// =========================================================================
function renderBookHighlights() {
  const container = document.getElementById('bookHighlightsList');
  if (!container) return;

  const highlights = window.BookDB.getHighlights(bookId);

  if (highlights.length === 0) {
    container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">لا توجد تظليلات في هذا الكتاب بعد. حدد أي نص في الصفحة لتظليله أو اضغط على «+ إنشاء تظليل»!</div>';
    return;
  }

  let html = '';
  highlights.forEach(h => {
    const catColor = h.category?.colorHex || '#EF4444';
    const catName = h.category?.name || 'تظليل';

    html += `
      <div style="padding: 10px 12px; border-radius: var(--radius-md); background: var(--bg-card); border: 1px solid var(--border-color); border-right: 4px solid ${catColor};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 0.75rem; color: ${catColor}; font-weight: 700;">${catName} — ص ${h.pageNumber}</span>
          <div style="display: flex; gap: 4px;">
            <button class="btn-icon" style="width: 22px; height: 22px;" onclick="goToPage(${h.pageNumber})" title="انتقال"><i data-lucide="eye" style="width: 12px; height: 12px;"></i></button>
            <button class="btn-icon" style="width: 22px; height: 22px; color: var(--danger);" onclick="deleteHighlight('${h.id}')" title="حذف"><i data-lucide="trash-2" style="width: 12px; height: 12px;"></i></button>
          </div>
        </div>
        <p style="font-size: 0.88rem; line-height: 1.5; font-family: var(--font-amiri); color: var(--text-primary); cursor: pointer;" onclick="goToPage(${h.pageNumber})">${h.text}</p>
        ${h.note ? `<div style="margin-top: 6px; padding: 4px 8px; border-radius: 4px; background: rgba(255,255,255,0.05); font-size: 0.78rem; color: var(--accent-secondary);">${h.note}</div>` : ''}
      </div>
    `;
  });
  container.innerHTML = html;
  lucide.createIcons();
}

function openManualHighlightModal() {
  const selection = window.getSelection()?.toString().trim();
  document.getElementById('manualHighlightText').value = selection || '';
  
  const categories = window.BookDB.getCategories();
  const select = document.getElementById('manualHighlightCatSelect');
  select.innerHTML = categories.map(c => `<option value="${c.id}">${c.name} (${c.colorHex})</option>`).join('');

  document.getElementById('manualHighlightNote').value = '';
  document.getElementById('manualHighlightModal').style.display = 'flex';
}

function confirmSaveManualHighlight() {
  const text = document.getElementById('manualHighlightText').value.trim();
  const categoryId = document.getElementById('manualHighlightCatSelect').value;
  const note = document.getElementById('manualHighlightNote').value.trim();

  if (!text) {
    alert('يرجى تحديد أو كتابة النص المراد تظليله');
    return;
  }

  window.BookDB.saveHighlight({
    bookId,
    categoryId,
    pageNumber: currentPage,
    text,
    note: note || undefined
  });

  closeModal('manualHighlightModal');
  renderCurrentPage();
  renderBookHighlights();
  showReaderToast('تم إنشاء التظليل بنجاح');
}

function deleteHighlight(id) {
  window.BookDB.deleteHighlight(id);
  renderCurrentPage();
  renderBookHighlights();
  showReaderToast('تم حذف التظليل');
}

// =========================================================================
// FEATURE 3: CREATE & MANAGE COLOR CATEGORIES ("إنشاء لون جديد")
// =========================================================================
function renderFloatingCategories() {
  const container = document.getElementById('floatingCategoriesDots');
  if (!container) return;

  const categories = window.BookDB.getCategories();
  let html = '';
  categories.forEach(c => {
    html += `
      <div class="category-dot-btn" style="background: ${c.colorHex};" title="${c.name}" onclick="applyHighlightCategory('${c.id}')"></div>
    `;
  });
  container.innerHTML = html;
}

function renderColorsTab() {
  const container = document.getElementById('bookColorsList');
  if (!container) return;

  const categories = window.BookDB.getCategories();
  let html = '';
  categories.forEach(c => {
    html += `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: var(--radius-md); background: var(--bg-card); border: 1px solid var(--border-color);">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="width: 16px; height: 16px; border-radius: 50%; background: ${c.colorHex};"></span>
          <span style="font-size: 0.85rem; font-weight: 600;">${c.name}</span>
        </div>
        <span style="font-size: 0.72rem; color: var(--text-muted);">${c.colorHex}</span>
      </div>
    `;
  });
  container.innerHTML = html;
}

function openCreateColorModal() {
  document.getElementById('modalColorName').value = '';
  document.getElementById('modalColorPicker').value = '#10B981';
  document.getElementById('modalColorHex').value = '#10B981';
  document.getElementById('modalColorDesc').value = '';
  document.getElementById('colorModal').style.display = 'flex';
}

function confirmSaveNewColor() {
  const name = document.getElementById('modalColorName').value.trim();
  const colorHex = document.getElementById('modalColorHex').value.trim() || '#10B981';
  const description = document.getElementById('modalColorDesc').value.trim();

  if (!name) {
    alert('يرجى إدخال اسم التصنيف اللوني (مثل: معلومات تاريخية، اقتباسات، إلخ)');
    return;
  }

  const newCat = window.BookDB.saveCategory({
    name,
    colorHex,
    description
  });

  closeModal('colorModal');
  renderFloatingCategories();
  renderColorsTab();

  // If there's an active text selection, highlight with the new color immediately
  if (selectedTextSnippet) {
    applyHighlightCategory(newCat.id);
  }

  showReaderToast(`تم إنشاء اللون الجديد: ${name}`);
}

// =========================================================================
// FEATURE 4: CREATE & MANAGE NOTES ("إنشاء ملاحظة")
// =========================================================================
function renderBookNotes() {
  const container = document.getElementById('bookNotesList');
  if (!container) return;

  const notes = window.BookDB.getNotes(bookId);

  if (notes.length === 0) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">لا توجد ملاحظات على هذا الكتاب بعد.</div>';
    return;
  }

  let html = '';
  notes.forEach(n => {
    html += `
      <div style="padding: 10px 12px; border-radius: var(--radius-md); background: var(--bg-card); border: 1px solid var(--border-color);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 0.75rem; color: var(--accent-secondary); font-weight: 600;">صفحة ${n.pageNumber}</span>
          <div style="display: flex; gap: 4px;">
            <button class="btn-icon" style="width: 22px; height: 22px;" onclick="goToPage(${n.pageNumber})"><i data-lucide="eye" style="width: 12px; height: 12px;"></i></button>
            <button class="btn-icon" style="width: 22px; height: 22px; color: var(--danger);" onclick="deleteReaderNote('${n.id}')"><i data-lucide="trash-2" style="width: 12px; height: 12px;"></i></button>
          </div>
        </div>
        <p style="font-size: 0.85rem; line-height: 1.5; color: var(--text-primary);">${n.text}</p>
      </div>
    `;
  });
  container.innerHTML = html;
  lucide.createIcons();
}

function openAddNoteModal() {
  document.getElementById('noteSelectedTextPreview').textContent = `ملاحظة عامة على صفحة ${currentPage}`;
  document.getElementById('noteInputText').value = '';
  selectedTextSnippet = '';
  document.getElementById('noteModal').style.display = 'flex';
}

function saveCurrentPageNote() {
  const input = document.getElementById('newNoteInput');
  const text = input.value.trim();
  if (!text) return;

  window.BookDB.saveNote({
    bookId,
    pageNumber: currentPage,
    text
  });

  input.value = '';
  renderBookNotes();
  showReaderToast('تم إنشاء الملاحظة بنجاح');
}

function deleteReaderNote(id) {
  window.BookDB.deleteNote(id);
  renderBookNotes();
  showReaderToast('تم حذف الملاحظة');
}

// Bookmarks toggle
function updateBookmarkButton() {
  const bookmarks = window.BookDB.getBookmarks(bookId);
  const isBookmarked = bookmarks.some(b => b.pageNumber === currentPage);
  const btn = document.getElementById('btnPageBookmark');
  if (btn) {
    btn.style.color = isBookmarked ? 'var(--warning)' : '';
  }
}

function toggleBookmarkCurrentPage() {
  const bookmarks = window.BookDB.getBookmarks(bookId);
  const existing = bookmarks.find(b => b.pageNumber === currentPage);

  if (existing) {
    window.BookDB.deleteBookmark(existing.id);
    showReaderToast('تمت إزالة العلامة المرجعية');
  } else {
    window.BookDB.saveBookmark({
      bookId,
      pageNumber: currentPage,
      title: `علامة صفحة ${currentPage}`,
      textSnippet: `صفحة ${currentPage} في ${currentBook.title}`
    });
    showReaderToast('تمت إضافة علامة مرجعية');
  }
  updateBookmarkButton();
}

// Text Selection Handling
function handleTextSelection() {
  const selection = window.getSelection();
  const toolbar = document.getElementById('floatingToolbar');

  if (!selection || selection.isCollapsed || !selection.toString().trim()) {
    toolbar.classList.remove('active');
    return;
  }

  const text = selection.toString().trim();
  if (text.length < 2) {
    toolbar.classList.remove('active');
    return;
  }

  selectedTextSnippet = text;
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const sheetRect = document.getElementById('readerSheet').getBoundingClientRect();

  toolbar.style.top = `${rect.top - sheetRect.top - 8}px`;
  toolbar.style.left = `${rect.left - sheetRect.left + (rect.width / 2)}px`;
  toolbar.classList.add('active');
}

function handleDocumentClick(e) {
  if (!e.target.closest('#floatingToolbar') && !window.getSelection()?.toString().trim()) {
    document.getElementById('floatingToolbar')?.classList.remove('active');
  }
}

function applyHighlightCategory(catId) {
  if (!selectedTextSnippet) return;

  window.BookDB.saveHighlight({
    bookId,
    categoryId: catId,
    pageNumber: currentPage,
    text: selectedTextSnippet
  });

  window.getSelection()?.removeAllRanges();
  document.getElementById('floatingToolbar').classList.remove('active');

  renderCurrentPage();
  renderBookHighlights();
  showReaderToast('تم تظليل النص بنجاح');
}

function copySelectionText() {
  if (!selectedTextSnippet) return;
  navigator.clipboard.writeText(selectedTextSnippet);
  document.getElementById('floatingToolbar').classList.remove('active');
  showReaderToast('تم نسخ النص إلى الحافظة');
}

function addNoteFromSelection() {
  if (!selectedTextSnippet) return;
  document.getElementById('noteSelectedTextPreview').textContent = selectedTextSnippet;
  document.getElementById('noteInputText').value = '';
  document.getElementById('noteModal').style.display = 'flex';
  document.getElementById('floatingToolbar').classList.remove('active');
}

function closeNoteModal() {
  document.getElementById('noteModal').style.display = 'none';
}

function confirmSaveNoteFromSelection() {
  const note = document.getElementById('noteInputText').value.trim();
  if (note) {
    const textToSave = selectedTextSnippet ? `${note}\n(اقتباس: "${selectedTextSnippet}")` : note;
    window.BookDB.saveNote({
      bookId,
      pageNumber: currentPage,
      text: textToSave
    });
    renderBookNotes();
    closeNoteModal();
    showReaderToast('تم حفظ الملاحظة بنجاح');
  }
}

function showHighlightDetails(id) {
  const h = window.BookDB.getHighlights(bookId).find(item => item.id === id);
  if (!h) return;
  alert(`تصنيف: ${h.category?.name}\nالنص: ${h.text}\n${h.note ? 'الملاحظة: ' + h.note : ''}`);
}

function promptPastePageText() {
  const text = prompt(`أدخل أو الصق نص الصفحة ${currentPage}:`);
  if (text && text.trim()) {
    window.BookDB.savePageText(bookId, currentPage, text.trim());
    renderCurrentPage();
    showReaderToast('تم حفظ نص الصفحة');
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function showReaderToast(msg) {
  const toast = document.getElementById('readerToast');
  const text = document.getElementById('readerToastText');
  text.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
