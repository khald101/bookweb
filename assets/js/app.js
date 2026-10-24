/**
 * BookWeb - Library Application Logic
 */

let currentViewMode = 'grid';
let activeFormatFilter = null;
let activeCollectionFilter = null;
let searchQuery = '';
let pendingDeleteBookId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  renderCollections();
  renderBooks();
  updateBadges();
  lucide.createIcons();
});

// Theme Management
function initTheme() {
  const saved = localStorage.getItem('bookweb-theme') || 'dark';
  setTheme(saved);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('bookweb-theme', theme);
}

// Sidebar toggle for mobile
function toggleSidebar() {
  const sidebar = document.getElementById('appSidebar');
  sidebar.classList.toggle('open');
}

// Toast alerts
function showToast(text, isError = false) {
  const toast = document.getElementById('toastMessage');
  const toastText = document.getElementById('toastText');
  toastText.textContent = text;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// View Mode
function setViewMode(mode) {
  currentViewMode = mode;
  document.getElementById('btnViewGrid').classList.toggle('active', mode === 'grid');
  document.getElementById('btnViewList').classList.toggle('active', mode === 'list');
  document.getElementById('booksGridContainer').style.display = mode === 'grid' ? 'grid' : 'none';
  document.getElementById('booksListContainer').style.display = mode === 'list' ? 'flex' : 'none';
}

// Filter Format
function filterFormat(fmt) {
  activeFormatFilter = fmt;
  const pills = document.querySelectorAll('#formatPills button');
  pills.forEach((p, idx) => {
    if ((fmt === null && idx === 0) || (fmt && p.textContent.trim().toLowerCase() === fmt)) {
      p.className = 'btn btn-primary';
    } else {
      p.className = 'btn btn-secondary';
    }
  });
  renderBooks();
}

// Filter Collection
function filterCollection(colId) {
  activeCollectionFilter = colId;
  renderCollections();
  renderBooks();
}

// Live Search
function handleSearch(val) {
  searchQuery = (val || '').trim().toLowerCase();
  renderBooks();
}

// Update Badges Count
function updateBadges() {
  const highlights = window.BookDB.getHighlights();
  const bookmarks = window.BookDB.getBookmarks();
  const notes = window.BookDB.getNotes();

  document.getElementById('navHighlightsCount').textContent = highlights.length;
  document.getElementById('navBookmarksCount').textContent = bookmarks.length;
  document.getElementById('navNotesCount').textContent = notes.length;
}

// Render Collections Pills
function renderCollections() {
  const collections = window.BookDB.getCollections();
  const container = document.getElementById('collectionPills');
  if (!container) return;

  let html = `
    <button class="btn ${activeCollectionFilter === null ? 'btn-primary' : 'btn-secondary'}" style="padding: 6px 12px; font-size: 0.82rem; white-space: nowrap;" onclick="filterCollection(null)">
      <i data-lucide="folder" style="width: 14px; height: 14px;"></i>
      <span>جميع المجموعات</span>
    </button>
  `;

  collections.forEach(col => {
    const isActive = activeCollectionFilter === col.id;
    html += `
      <button class="btn ${isActive ? 'btn-primary' : 'btn-secondary'}" style="padding: 6px 12px; font-size: 0.82rem; white-space: nowrap;" onclick="filterCollection('${col.id}')">
        <i data-lucide="folder" style="width: 14px; height: 14px; color: ${col.color || 'var(--accent-primary)'};"></i>
        <span>${col.name} (${col.bookCount})</span>
      </button>
    `;
  });

  html += `
    <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.82rem; white-space: nowrap; border-style: dashed;" onclick="openModal('newCollectionModal')">
      <i data-lucide="folder-plus" style="width: 14px; height: 14px;"></i>
      <span>مجموعة جديدة</span>
    </button>
  `;

  container.innerHTML = html;
  lucide.createIcons();
}

// Render Books
function renderBooks() {
  const allBooks = window.BookDB.getBooks();
  const filtered = allBooks.filter(book => {
    if (activeFormatFilter && book.format !== activeFormatFilter) return false;
    if (activeCollectionFilter && book.collectionId !== activeCollectionFilter) return false;
    if (searchQuery) {
      const matchTitle = (book.title || '').toLowerCase().includes(searchQuery);
      const matchAuthor = (book.author || '').toLowerCase().includes(searchQuery);
      const matchDesc = (book.description || '').toLowerCase().includes(searchQuery);
      return matchTitle || matchAuthor || matchDesc;
    }
    return true;
  });

  document.getElementById('libraryStatsSub').textContent = `لديك ${allBooks.length} كتاب في المكتبة — اقرأ، وابحث، وظلل بنظام التصنيفات المخصص`;

  const gridContainer = document.getElementById('booksGridContainer');
  const listContainer = document.getElementById('booksListContainer');

  if (filtered.length === 0) {
    const emptyHtml = `
      <div style="grid-column: 1 / -1; padding: 60px 20px; text-align: center; background: var(--bg-card); border-radius: var(--radius-xl); border: 1px dashed var(--border-color);">
        <i data-lucide="book-open" style="width: 48px; height: 48px; color: var(--text-muted); margin: 0 auto 16px;"></i>
        <h3 style="font-size: 1.2rem; margin-bottom: 8px;">لا توجد كتب مطابقة</h3>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 20px;">لم نجد كتباً في هذا التصنيف أو لم يتم العثور على نتائج بحث</p>
        <button class="btn btn-primary" onclick="document.getElementById('fileUploadInput').click()">
          <i data-lucide="upload" style="width: 16px; height: 16px;"></i>
          <span>إضافة كتاب جديد</span>
        </button>
      </div>
    `;
    gridContainer.innerHTML = emptyHtml;
    listContainer.innerHTML = emptyHtml;
    lucide.createIcons();
    return;
  }

  // Build Grid HTML
  let gridHtml = '';
  filtered.forEach(book => {
    const progress = book.readingProgress;
    const percentage = progress ? progress.percentage : 0;
    const currentPage = progress ? progress.currentPage : 1;

    gridHtml += `
      <div class="book-card">
        <a href="reader.html?id=${book.id}" style="text-decoration: none;">
          <div class="book-cover">
            <span class="cover-badge ${book.format}">${book.format}</span>
            ${book.coverUrl ? `
              <img src="${book.coverUrl}" alt="${book.title}" style="width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
              <div style="display: none; width: 100%; height: 100%; flex-direction: column; align-items: center; justify-content: center; padding: 16px; text-align: center;">
                <i data-lucide="book-open" style="width: 36px; height: 36px; color: rgba(255,255,255,0.4); margin-bottom: 14px;"></i>
                <div class="cover-title">${book.title}</div>
                <div class="cover-author">${book.author}</div>
              </div>
            ` : `
              <i data-lucide="book-open" style="width: 36px; height: 36px; color: rgba(255,255,255,0.4); margin-bottom: 14px;"></i>
              <div class="cover-title">${book.title}</div>
              <div class="cover-author">${book.author}</div>
            `}
          </div>
        </a>

        <div class="book-info">
          <div class="book-progress-box">
            <div class="progress-labels">
              <span>${percentage}% مكتمل</span>
              <span>صفحة ${currentPage} من ${book.pageCount}</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${percentage}%;"></div>
            </div>
          </div>

          <div class="book-actions-row">
            <a href="reader.html?id=${book.id}" class="btn btn-primary" style="padding: 6px 12px; font-size: 0.82rem; min-height: 34px;">
              <i data-lucide="eye" style="width: 14px; height: 14px;"></i>
              <span>قراءة</span>
            </a>

            <div style="display: flex; gap: 6px;">
              <button class="btn-icon" style="width: 34px; height: 34px;" title="تعديل البيانات" onclick="openEditBookModal('${book.id}')">
                <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
              </button>
              <button class="btn-icon" style="width: 34px; height: 34px; color: var(--danger);" title="حذف الكتاب" onclick="openDeleteBookModal('${book.id}')">
                <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  });
  gridContainer.innerHTML = gridHtml;

  // Build List HTML
  let listHtml = '';
  filtered.forEach(book => {
    const progress = book.readingProgress;
    const percentage = progress ? progress.percentage : 0;
    const currentPage = progress ? progress.currentPage : 1;
    const sizeMb = (book.fileSize / 1024 / 1024).toFixed(2);

    listHtml += `
      <div class="book-list-item">
        <div class="book-list-info">
          ${book.coverUrl ? `
            <img src="${book.coverUrl}" alt="${book.title}" class="book-list-thumb">
          ` : `
            <span class="cover-badge ${book.format}" style="position: static; flex-shrink: 0;">${book.format}</span>
          `}
          <div style="min-width: 0; flex: 1;">
            <a href="reader.html?id=${book.id}" class="book-list-title">${book.title}</a>
            <div class="book-list-meta">
              المؤلف: ${book.author} — ${book.pageCount} صفحة — ${sizeMb} ميجابايت
            </div>
          </div>
        </div>

        <div class="book-list-progress">
          <div class="progress-labels">
            <span>${percentage}%</span>
            <span>صفحة ${currentPage}/${book.pageCount}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${percentage}%;"></div>
          </div>
        </div>

        <div class="book-list-actions">
          <a href="reader.html?id=${book.id}" class="btn btn-primary" style="padding: 6px 14px; font-size: 0.85rem; min-height: 36px;">
            <i data-lucide="eye" style="width: 14px; height: 14px;"></i>
            <span>قراءة</span>
          </a>

          <div style="display: flex; gap: 6px;">
            <button class="btn-icon" style="width: 36px; height: 36px;" title="تعديل" onclick="openEditBookModal('${book.id}')">
              <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
            </button>
            <button class="btn-icon" style="width: 36px; height: 36px; color: var(--danger);" title="حذف" onclick="openDeleteBookModal('${book.id}')">
              <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  });
  listContainer.innerHTML = listHtml;

  lucide.createIcons();
}

// Modal open/close helpers
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// Edit Book Metadata Modal
function openEditBookModal(bookId) {
  const book = window.BookDB.getBook(bookId);
  if (!book) return;

  document.getElementById('editBookId').value = book.id;
  document.getElementById('editBookTitle').value = book.title;
  document.getElementById('editBookAuthor').value = book.author;
  document.getElementById('editBookDesc').value = book.description || '';

  const collections = window.BookDB.getCollections();
  const select = document.getElementById('editBookCollection');
  select.innerHTML = '<option value="">بدون مجموعة (عام)</option>' +
    collections.map(c => `<option value="${c.id}" ${book.collectionId === c.id ? 'selected' : ''}>${c.name}</option>`).join('');

  openModal('editBookModal');
}

function saveBookMetadata() {
  const id = document.getElementById('editBookId').value;
  const book = window.BookDB.getBook(id);
  if (!book) return;

  book.title = document.getElementById('editBookTitle').value.trim() || book.title;
  book.author = document.getElementById('editBookAuthor').value.trim() || book.author;
  book.description = document.getElementById('editBookDesc').value.trim();
  book.collectionId = document.getElementById('editBookCollection').value || null;

  window.BookDB.saveBook(book);
  closeModal('editBookModal');
  renderBooks();
  renderCollections();
  showToast('تم حفظ تعديلات الكتاب بنجاح');
}

// Delete Book Modal
function openDeleteBookModal(bookId) {
  const book = window.BookDB.getBook(bookId);
  if (!book) return;
  pendingDeleteBookId = bookId;
  document.getElementById('deleteBookTitleName').textContent = `«${book.title}»`;
  openModal('deleteBookModal');
}

function confirmDeleteBook() {
  if (!pendingDeleteBookId) return;
  window.BookDB.deleteBook(pendingDeleteBookId);
  pendingDeleteBookId = null;
  closeModal('deleteBookModal');
  renderBooks();
  renderCollections();
  updateBadges();
  showToast('تم حذف الكتاب بنجاح');
}

// New Collection
function createCollection() {
  const name = document.getElementById('newColName').value.trim();
  const desc = document.getElementById('newColDesc').value.trim();
  if (!name) return;

  window.BookDB.saveCollection({
    name,
    description: desc,
    color: '#6366f1'
  });

  document.getElementById('newColName').value = '';
  document.getElementById('newColDesc').value = '';
  closeModal('newCollectionModal');
  renderCollections();
  showToast('تمت إضافة المجموعة الجديدة');
}

// All Highlights Modal
function openHighlightsModal() {
  const list = window.BookDB.getHighlights();
  const body = document.getElementById('highlightsListBody');
  const books = window.BookDB.getBooks();
  const bookMap = new Map(books.map(b => [b.id, b.title]));

  if (list.length === 0) {
    body.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-muted);">
        <i data-lucide="highlighter" style="width: 40px; height: 40px; margin-bottom: 12px;"></i>
        <p>لا توجد تظليلات محفوظة بعد. افتح أي كتاب وظلل النصوص الهامة!</p>
      </div>
    `;
  } else {
    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
    list.forEach(h => {
      const bTitle = bookMap.get(h.bookId) || 'كتاب';
      const catColor = h.category?.colorHex || '#EF4444';
      const catName = h.category?.name || 'تظليل';

      html += `
        <div style="padding: 14px; border-radius: var(--radius-md); background: var(--bg-card); border-right: 4px solid ${catColor}; border-top: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); border-left: 1px solid var(--border-color);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge-pill" style="background: ${catColor}22; color: ${catColor};">${catName}</span>
              <span style="font-size: 0.8rem; color: var(--text-muted);">${bTitle} — صفحة ${h.pageNumber}</span>
            </div>
            <a href="reader.html?id=${h.bookId}&page=${h.pageNumber}" class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;">انتقال للصفحة</a>
          </div>
          <p style="font-size: 0.95rem; line-height: 1.7; color: var(--text-primary); font-family: var(--font-amiri);">${h.text}</p>
        </div>
      `;
    });
    html += '</div>';
    body.innerHTML = html;
  }

  openModal('highlightsModal');
  lucide.createIcons();
}

// All Bookmarks Modal
function openBookmarksModal() {
  const list = window.BookDB.getBookmarks();
  const body = document.getElementById('bookmarksListBody');
  const books = window.BookDB.getBooks();
  const bookMap = new Map(books.map(b => [b.id, b.title]));

  if (list.length === 0) {
    body.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-muted);">
        <i data-lucide="bookmark" style="width: 40px; height: 40px; margin-bottom: 12px;"></i>
        <p>لا توجد إشارات مرجعية محفوظة.</p>
      </div>
    `;
  } else {
    let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
    list.forEach(bm => {
      const bTitle = bookMap.get(bm.bookId) || 'كتاب';
      html += `
        <div style="padding: 12px 14px; border-radius: var(--radius-md); background: var(--bg-card); border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;">${bm.title || 'علامة مرجعية'}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${bTitle} — صفحة ${bm.pageNumber}</div>
          </div>
          <div style="display: flex; gap: 6px;">
            <a href="reader.html?id=${bm.bookId}&page=${bm.pageNumber}" class="btn btn-primary" style="padding: 4px 10px; font-size: 0.8rem;">فتح</a>
            <button class="btn-icon" style="color: var(--danger); width: 32px; height: 32px;" onclick="deleteBookmark('${bm.id}')"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i></button>
          </div>
        </div>
      `;
    });
    html += '</div>';
    body.innerHTML = html;
  }

  openModal('bookmarksModal');
  lucide.createIcons();
}

function deleteBookmark(id) {
  window.BookDB.deleteBookmark(id);
  openBookmarksModal();
  updateBadges();
  showToast('تم حذف العلامة المرجعية');
}

// All Notes Modal
function openNotesModal() {
  const list = window.BookDB.getNotes();
  const body = document.getElementById('notesListBody');
  const books = window.BookDB.getBooks();
  const bookMap = new Map(books.map(b => [b.id, b.title]));

  if (list.length === 0) {
    body.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-muted);">
        <i data-lucide="file-text" style="width: 40px; height: 40px; margin-bottom: 12px;"></i>
        <p>لا توجد ملاحظات مسجلة بعد.</p>
      </div>
    `;
  } else {
    let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
    list.forEach(n => {
      const bTitle = bookMap.get(n.bookId) || 'كتاب';
      html += `
        <div style="padding: 14px; border-radius: var(--radius-md); background: var(--bg-card); border: 1px solid var(--border-color);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 0.8rem; color: var(--text-muted);">${bTitle} — صفحة ${n.pageNumber}</span>
            <div style="display: flex; gap: 6px;">
              <a href="reader.html?id=${n.bookId}&page=${n.pageNumber}" class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;">انتقال</a>
              <button class="btn-icon" style="color: var(--danger); width: 28px; height: 28px;" onclick="deleteNote('${n.id}')"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i></button>
            </div>
          </div>
          <p style="font-size: 0.95rem; line-height: 1.6; color: var(--text-primary);">${n.text}</p>
        </div>
      `;
    });
    html += '</div>';
    body.innerHTML = html;
  }

  openModal('notesModal');
  lucide.createIcons();
}

function deleteNote(id) {
  window.BookDB.deleteNote(id);
  openNotesModal();
  updateBadges();
  showToast('تم حذف الملاحظة');
}

// Categories Management Modal
function openCategoriesModal() {
  const cats = window.BookDB.getCategories();
  const body = document.getElementById('categoriesListBody');

  let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
  cats.forEach(c => {
    html += `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: var(--radius-md); background: var(--bg-card); border: 1px solid var(--border-color);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 18px; height: 18px; border-radius: 50%; background: ${c.colorHex}; flex-shrink: 0;"></div>
          <div>
            <div style="font-weight: 600; font-size: 0.95rem;">${c.name}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${c.description || ''}</div>
          </div>
        </div>
      </div>
    `;
  });
  html += '</div>';
  body.innerHTML = html;

  openModal('categoriesModal');
}

// Backup & Restore
function openBackupModal() {
  openModal('backupModal');
}

function downloadDataBackup() {
  const jsonStr = window.BookDB.exportData();
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bookweb_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('تم تحميل النسخة الاحتياطية بنجاح');
}

function handleImportBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const success = window.BookDB.importData(event.target.result);
    if (success) {
      renderBooks();
      renderCollections();
      updateBadges();
      closeModal('backupModal');
      showToast('تم استيراد البيانات وتحديث المكتبة بنجاح!');
    } else {
      showToast('خطأ: الملف المختار غير صالح', true);
    }
  };
  reader.readAsText(file);
}

function confirmResetData() {
  if (confirm('هل أنت متأكد من رغبتك في إعادة ضبط البيانات إلى الوضع الأصلي؟')) {
    window.BookDB.resetToDefault();
    renderBooks();
    renderCollections();
    updateBadges();
    closeModal('backupModal');
    showToast('تمت إعادة ضبط البيانات للأصل بنجاح');
  }
}

// Local File Upload in Browser
function handleLocalFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const ext = file.name.split('.').pop().toLowerCase();
  const title = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  const bookId = 'book_' + Date.now();

  const newBook = {
    id: bookId,
    title,
    author: 'غير محدد',
    description: 'تمت إضافته من الملف المحلي',
    format: ext,
    fileSize: file.size,
    fileName: file.name,
    collectionId: activeCollectionFilter || null,
    pageCount: 1,
    status: 'ready',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // If text file, read content immediately
  if (ext === 'txt') {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const linesPerPage = 35;
      const lines = content.split('\n');
      const totalP = Math.max(1, Math.ceil(lines.length / linesPerPage));
      newBook.pageCount = totalP;

      for (let p = 1; p <= totalP; p++) {
        const pageContent = lines.slice((p - 1) * linesPerPage, p * linesPerPage).join('\n');
        window.BookDB.savePageText(bookId, p, pageContent);
      }

      window.BookDB.saveBook(newBook);
      renderBooks();
      renderCollections();
      showToast(`تمت إضافة كتاب: ${title}`);
    };
    reader.readAsText(file);
  } else {
    // PDF / other
    window.BookDB.saveBook(newBook);
    renderBooks();
    renderCollections();
    showToast(`تمت إضافة كتاب: ${title}`);
  }

  event.target.value = '';
}
