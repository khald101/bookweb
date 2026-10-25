/**
 * BookWeb - Main Application Logic & View Controller
 */

let currentMainView = 'library';
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
  populateGlobalSearchCollections();
  lucide.createIcons();
});

// View Switching
function switchMainView(viewName) {
  currentMainView = viewName;

  // Update nav links
  document.querySelectorAll('.app-nav .nav-link').forEach(link => link.classList.remove('active'));
  const activeLink = document.getElementById(`navLink-${viewName}`);
  if (activeLink) activeLink.classList.add('active');

  // Update view sections
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  const targetSec = document.getElementById(`view-${viewName}`);
  if (targetSec) targetSec.classList.add('active');

  // Title on mobile
  const titles = {
    library: 'المكتبة',
    search: 'البحث الشامل',
    categories: 'تصنيفات الألوان',
    highlights: 'تظليلاتي',
    notes: 'ملاحظاتي',
    bookmarks: 'علاماتي المرجعية',
    backup: 'النسخ الاحتياطي'
  };
  const titleEl = document.getElementById('mobileHeaderTitle');
  if (titleEl) titleEl.textContent = titles[viewName] || 'المكتبة الذكية';

  // Specific view loaders
  if (viewName === 'categories') {
    renderCategoriesView();
  } else if (viewName === 'highlights') {
    renderHighlightsView();
  } else if (viewName === 'notes') {
    renderNotesView();
  } else if (viewName === 'bookmarks') {
    renderBookmarksView();
  } else if (viewName === 'search') {
    populateGlobalSearchCollections();
    setTimeout(() => document.getElementById('globalSearchInput')?.focus(), 100);
  }

  // Close mobile sidebar if open
  document.getElementById('appSidebar')?.classList.remove('open');
  lucide.createIcons();
}

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

// View Mode (Grid / List)
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

// Live Search in Library
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

// Render Collections Pills in Library
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

// Render Books Grid & List
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

  // Grid
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

  // List
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

// =========================================================================
// FEATURE 1: GLOBAL SEARCH ACROSS ALL BOOKS ("البحث بكل الكتب")
// =========================================================================
function populateGlobalSearchCollections() {
  const select = document.getElementById('globalSearchCollectionSelect');
  if (!select) return;
  const cols = window.BookDB.getCollections();
  select.innerHTML = '<option value="">كافة المجموعات</option>' +
    cols.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function executeGlobalSearch() {
  const input = document.getElementById('globalSearchInput');
  const query = (input?.value || '').trim();
  const colId = document.getElementById('globalSearchCollectionSelect')?.value || null;
  const header = document.getElementById('globalSearchResultsHeader');
  const container = document.getElementById('globalSearchResultsContainer');

  if (!query) {
    header.textContent = 'يرجى كتابة كلمة أو عبارة للبحث.';
    container.innerHTML = '';
    return;
  }

  const { results, totalMatches } = window.BookDB.searchGlobal(query, colId);

  if (results.length === 0) {
    header.innerHTML = `لم يتم العثور على نتائج للبحث عن «<strong>${escapeHtml(query)}</strong>»`;
    container.innerHTML = `
      <div style="padding: 50px 20px; text-align: center; background: var(--bg-card); border-radius: var(--radius-xl); border: 1px dashed var(--border-color); color: var(--text-muted);">
        <i data-lucide="search-x" style="width: 44px; height: 44px; margin: 0 auto 12px; opacity: 0.6;"></i>
        <h3 style="font-size: 1.15rem; color: var(--text-primary); margin-bottom: 6px;">لا توجد تطابقات</h3>
        <p style="font-size: 0.9rem;">جرب كتابة جزء من الكلمة أو مرادف آخر</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  header.innerHTML = `تم العثور على <strong>${totalMatches}</strong> نتيجة مطابقة في <strong>${results.length}</strong> كتاب للبحث عن «<strong>${escapeHtml(query)}</strong>»:`;

  let html = '';
  results.forEach(res => {
    const book = res.book;
    html += `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-xl); padding: 22px;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 14px; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="cover-badge ${book.format}" style="position: static;">${book.format}</span>
            <div>
              <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary);">${book.title}</h3>
              <div style="font-size: 0.82rem; color: var(--text-muted);">المؤلف: ${book.author} — ${res.totalMatches} موضع مطابق في هذا الكتاب</div>
            </div>
          </div>

          <a href="reader.html?id=${book.id}&page=${res.pages[0]?.pageNumber || 1}&q=${encodeURIComponent(query)}" class="btn btn-secondary" style="padding: 6px 14px; font-size: 0.85rem;">
            <span>فتح الكتاب في القارئ</span>
            <i data-lucide="arrow-left" style="width: 14px; height: 14px;"></i>
          </a>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${res.pages.map(p => `
            <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span class="badge-pill" style="background: rgba(99, 102, 241, 0.2); color: var(--accent-primary);">صفحة ${p.pageNumber}</span>
                <a href="reader.html?id=${book.id}&page=${p.pageNumber}&q=${encodeURIComponent(query)}" class="btn btn-secondary" style="font-size: 0.78rem; padding: 4px 10px;">انتقال للصفحة ${p.pageNumber}</a>
              </div>
              ${p.matches.map(m => `
                <a href="reader.html?id=${book.id}&page=${p.pageNumber}&q=${encodeURIComponent(query)}" style="display: block; font-size: 0.92rem; line-height: 1.7; color: var(--text-primary); padding: 8px 12px; background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-sm); margin-bottom: 6px; text-decoration: none; font-family: var(--font-amiri);">
                  ${highlightMatchInSnippet(m.snippet, query)}
                </a>
              `).join('')}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  lucide.createIcons();
}

function highlightMatchInSnippet(snippet, query) {
  const safeSnippet = escapeHtml(snippet);
  const safeQuery = escapeHtml(query.trim());
  const regex = new RegExp(`(${escapeRegExp(safeQuery)})`, 'gi');
  return safeSnippet.replace(regex, '<mark style="background: rgba(245, 158, 11, 0.45); color: #fff; padding: 1px 4px; border-radius: 3px; font-weight: 700;">$1</mark>');
}

// =========================================================================
// FEATURE 2: CREATE & MANAGE COLOR CATEGORIES ("إنشاء لون وتصنيف جديد")
// =========================================================================
function renderCategoriesView() {
  const categories = window.BookDB.getCategories();
  const allHighlights = window.BookDB.getHighlights();
  const container = document.getElementById('categoriesCardsGrid');
  if (!container) return;

  let html = '';
  categories.forEach(cat => {
    const count = allHighlights.filter(h => h.categoryId === cat.id).length;
    html += `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-right: 6px solid ${cat.colorHex}; border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; gap: 12px; box-shadow: var(--shadow-sm);">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="width: 22px; height: 22px; border-radius: 50%; background-color: ${cat.colorHex}; display: inline-block; box-shadow: 0 0 10px ${cat.colorHex}66;"></span>
            <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary);">${cat.name}</h3>
          </div>
          <span class="badge-pill" style="background-color: ${cat.colorHex}22; color: ${cat.colorHex}; border: 1px solid ${cat.colorHex}55;">
            ${count} تظليل
          </span>
        </div>

        <div style="font-size: 0.88rem; color: var(--text-secondary); min-height: 38px; line-height: 1.6;">
          ${cat.description || 'لا يوجد وصف محدد لهذا التصنيف'}
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted); margin-top: auto; padding-top: 12px; border-top: 1px solid var(--border-color);">
          <span>رمز اللون: <strong style="color: var(--text-primary);">${cat.colorHex}</strong></span>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.78rem;" onclick="openEditCategoryModal('${cat.id}')">
              <i data-lucide="edit-2" style="width: 12px; height: 12px;"></i>
              <span>تعديل</span>
            </button>
            <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.78rem; color: var(--danger);" onclick="deleteCategoryAction('${cat.id}')">
              <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
              <span>حذف</span>
            </button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  lucide.createIcons();
}

function openCreateCategoryModal() {
  document.getElementById('editCatId').value = '';
  document.getElementById('catModalTitle').textContent = 'إنشاء تصنيف ولون تظليل جديد';
  document.getElementById('catInputName').value = '';
  document.getElementById('catInputColor').value = '#3B82F6';
  document.getElementById('catInputHex').value = '#3B82F6';
  document.getElementById('catInputDesc').value = '';
  updateCatPreview();
  openModal('categoryModal');
}

function openEditCategoryModal(id) {
  const cat = window.BookDB.getCategory(id);
  if (!cat) return;
  document.getElementById('editCatId').value = cat.id;
  document.getElementById('catModalTitle').textContent = 'تعديل تصنيف ولون التظليل';
  document.getElementById('catInputName').value = cat.name;
  document.getElementById('catInputColor').value = cat.colorHex;
  document.getElementById('catInputHex').value = cat.colorHex;
  document.getElementById('catInputDesc').value = cat.description || '';
  updateCatPreview();
  openModal('categoryModal');
}

function selectCatColorPreset(hex) {
  document.getElementById('catInputColor').value = hex;
  document.getElementById('catInputHex').value = hex;
  updateCatPreview();
}

function updateCatPreview() {
  const hex = document.getElementById('catInputHex').value || '#3B82F6';
  const name = document.getElementById('catInputName').value.trim() || 'التصنيف';
  const mark = document.getElementById('catPreviewMark');
  if (mark) {
    mark.style.backgroundColor = `${hex}44`;
    mark.style.borderBottom = `2.5px solid ${hex}`;
    mark.textContent = `هذا مثال على النص المظلل بتصنيف «${name}»`;
  }
}

function saveCategoryModal() {
  const id = document.getElementById('editCatId').value;
  const name = document.getElementById('catInputName').value.trim();
  const colorHex = document.getElementById('catInputHex').value.trim() || '#3B82F6';
  const description = document.getElementById('catInputDesc').value.trim();

  if (!name) {
    alert('يرجى كتابة اسم التصنيف المعنوي (مثل: معلومات تاريخية، فوائد دينية، إلخ)');
    return;
  }

  window.BookDB.saveCategory({
    id: id || undefined,
    name,
    colorHex,
    description
  });

  closeModal('categoryModal');
  renderCategoriesView();
  showToast(id ? 'تم تعديل اللون والتصنيف بنجاح' : 'تم إنشاء التصنيف واللون الجديد بنجاح');
}

function deleteCategoryAction(id) {
  if (confirm('هل أنت متأكد من حذف هذا التصنيف اللوني؟')) {
    window.BookDB.deleteCategory(id);
    renderCategoriesView();
    showToast('تم حذف التصنيف');
  }
}

// =========================================================================
// FEATURE 3: ALL HIGHLIGHTS VIEW
// =========================================================================
function renderHighlightsView() {
  const filterCat = document.getElementById('highlightsFilterCategory')?.value || '';
  const allHighlights = window.BookDB.getHighlights();
  const categories = window.BookDB.getCategories();
  const books = window.BookDB.getBooks();
  const bookMap = new Map(books.map(b => [b.id, b.title]));
  const container = document.getElementById('highlightsFullContainer');
  const catSelect = document.getElementById('highlightsFilterCategory');

  // Populate category filter dropdown if empty
  if (catSelect && catSelect.options.length <= 1) {
    catSelect.innerHTML = '<option value="">جميع الألوان والتصنيفات</option>' +
      categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }

  const filtered = allHighlights.filter(h => !filterCat || h.categoryId === filterCat);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 60px 20px; text-align: center; background: var(--bg-card); border-radius: var(--radius-xl); border: 1px dashed var(--border-color); color: var(--text-muted);">
        <i data-lucide="highlighter" style="width: 44px; height: 44px; margin: 0 auto 14px; opacity: 0.5;"></i>
        <h3 style="font-size: 1.15rem; color: var(--text-primary); margin-bottom: 6px;">لا توجد تظليلات محفوظة</h3>
        <p style="font-size: 0.9rem;">افتح أي كتاب وظلل الكلمات والعبارات التي تهمك لحفظها هنا تلقائياً!</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  let html = '';
  filtered.forEach(h => {
    const bTitle = bookMap.get(h.bookId) || 'كتاب';
    const catColor = h.category?.colorHex || '#EF4444';
    const catName = h.category?.name || 'تظليل';

    html += `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-right: 5px solid ${catColor}; border-radius: var(--radius-lg); padding: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="badge-pill" style="background: ${catColor}22; color: ${catColor}; border: 1px solid ${catColor}55;">${catName}</span>
            <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">${bTitle} — صفحة ${h.pageNumber}</span>
          </div>

          <div style="display: flex; gap: 6px;">
            <a href="reader.html?id=${h.bookId}&page=${h.pageNumber}" class="btn btn-secondary" style="padding: 4px 12px; font-size: 0.8rem;">
              <span>انتقال للصفحة</span>
              <i data-lucide="arrow-left" style="width: 12px; height: 12px;"></i>
            </a>
            <button class="btn-icon" style="color: var(--danger); width: 32px; height: 32px;" onclick="deleteHighlightInApp('${h.id}')" title="حذف التظليل">
              <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
            </button>
          </div>
        </div>

        <p style="font-size: 1.05rem; line-height: 1.8; color: var(--text-primary); font-family: var(--font-amiri); padding: 10px 14px; background: rgba(255,255,255,0.02); border-radius: var(--radius-md);">
          ${h.text}
        </p>
      </div>
    `;
  });

  container.innerHTML = html;
  lucide.createIcons();
}

function deleteHighlightInApp(id) {
  window.BookDB.deleteHighlight(id);
  renderHighlightsView();
  updateBadges();
  showToast('تم حذف التظليل بنجاح');
}

// =========================================================================
// FEATURE 4: CREATE & MANAGE NOTES ("إنشاء ملاحظة جديدة")
// =========================================================================
function renderNotesView() {
  const allNotes = window.BookDB.getNotes();
  const books = window.BookDB.getBooks();
  const bookMap = new Map(books.map(b => [b.id, b.title]));
  const container = document.getElementById('notesFullContainer');

  if (allNotes.length === 0) {
    container.innerHTML = `
      <div style="padding: 60px 20px; text-align: center; background: var(--bg-card); border-radius: var(--radius-xl); border: 1px dashed var(--border-color); color: var(--text-muted);">
        <i data-lucide="file-text" style="width: 44px; height: 44px; margin: 0 auto 14px; opacity: 0.5;"></i>
        <h3 style="font-size: 1.15rem; color: var(--text-primary); margin-bottom: 6px;">لا توجد ملاحظات مسجلة بعد</h3>
        <p style="font-size: 0.9rem; margin-bottom: 16px;">اضغط على الزر أدناه لكتابة أول ملاحظة وفائدة في مكتبتك!</p>
        <button class="btn btn-primary" onclick="openCreateNoteModal()">
          <i data-lucide="plus"></i>
          <span>+ إنشاء ملاحظة جديدة</span>
        </button>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  let html = '';
  allNotes.forEach(n => {
    const bTitle = bookMap.get(n.bookId) || 'كتاب';
    html += `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="file-text" style="color: var(--accent-secondary); width: 16px; height: 16px;"></i>
            <span style="font-weight: 700; font-size: 0.95rem;">${bTitle}</span>
            <span class="badge-pill" style="background: rgba(56, 189, 248, 0.15); color: var(--accent-secondary);">صفحة ${n.pageNumber}</span>
          </div>

          <div style="display: flex; gap: 6px;">
            <a href="reader.html?id=${n.bookId}&page=${n.pageNumber}" class="btn btn-secondary" style="padding: 4px 12px; font-size: 0.8rem;">انتقال للصفحة</a>
            <button class="btn-icon" style="color: var(--danger); width: 32px; height: 32px;" onclick="deleteNoteInApp('${n.id}')">
              <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
            </button>
          </div>
        </div>

        <p style="font-size: 0.95rem; line-height: 1.7; color: var(--text-primary); background: rgba(255,255,255,0.02); padding: 12px 14px; border-radius: var(--radius-md); white-space: pre-wrap;">
          ${escapeHtml(n.text)}
        </p>
      </div>
    `;
  });

  container.innerHTML = html;
  lucide.createIcons();
}

function openCreateNoteModal() {
  const books = window.BookDB.getBooks();
  const select = document.getElementById('noteModalBookSelect');
  select.innerHTML = books.map(b => `<option value="${b.id}">${b.title}</option>`).join('');
  document.getElementById('noteModalPageInput').value = 1;
  document.getElementById('noteModalTextInput').value = '';
  openModal('createNoteModal');
}

function saveNewNoteFromModal() {
  const bookId = document.getElementById('noteModalBookSelect').value;
  const pageNumber = parseInt(document.getElementById('noteModalPageInput').value) || 1;
  const text = document.getElementById('noteModalTextInput').value.trim();

  if (!text) {
    alert('يرجى كتابة نص الملاحظة');
    return;
  }

  window.BookDB.saveNote({
    bookId,
    pageNumber,
    text
  });

  closeModal('createNoteModal');
  renderNotesView();
  updateBadges();
  showToast('تمت إضافة الملاحظة الجديدة بنجاح');
}

function deleteNoteInApp(id) {
  window.BookDB.deleteNote(id);
  renderNotesView();
  updateBadges();
  showToast('تم حذف الملاحظة');
}

// =========================================================================
// FEATURE 5: BOOKMARKS VIEW
// =========================================================================
function renderBookmarksView() {
  const bookmarks = window.BookDB.getBookmarks();
  const books = window.BookDB.getBooks();
  const bookMap = new Map(books.map(b => [b.id, b.title]));
  const container = document.getElementById('bookmarksFullContainer');

  if (bookmarks.length === 0) {
    container.innerHTML = `
      <div style="padding: 60px 20px; text-align: center; background: var(--bg-card); border-radius: var(--radius-xl); border: 1px dashed var(--border-color); color: var(--text-muted);">
        <i data-lucide="bookmark" style="width: 44px; height: 44px; margin: 0 auto 14px; opacity: 0.5;"></i>
        <h3 style="font-size: 1.15rem; color: var(--text-primary); margin-bottom: 6px;">لا توجد علامات مرجعية</h3>
        <p style="font-size: 0.9rem;">أثناء قراءة أي كتاب، انقر على زر العلامة المرجعية لحفظ موضع الصفحة هنا فوراً</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  let html = '';
  bookmarks.forEach(bm => {
    const bTitle = bookMap.get(bm.bookId) || 'كتاب';
    html += `
      <div style="padding: 14px 18px; border-radius: var(--radius-lg); background: var(--bg-card); border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <div style="font-weight: 700; font-size: 1rem; margin-bottom: 4px;">${bm.title || 'علامة مرجعية'}</div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">${bTitle} — صفحة ${bm.pageNumber}</div>
        </div>

        <div style="display: flex; gap: 8px;">
          <a href="reader.html?id=${bm.bookId}&page=${bm.pageNumber}" class="btn btn-primary" style="padding: 6px 14px; font-size: 0.85rem;">
            <span>فتح في القارئ</span>
            <i data-lucide="arrow-left" style="width: 14px; height: 14px;"></i>
          </a>
          <button class="btn-icon" style="color: var(--danger); width: 34px; height: 34px;" onclick="deleteBookmarkInApp('${bm.id}')">
            <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  lucide.createIcons();
}

function deleteBookmarkInApp(id) {
  window.BookDB.deleteBookmark(id);
  renderBookmarksView();
  updateBadges();
  showToast('تمت إزالة العلامة المرجعية');
}

// =========================================================================
// GENERAL MODALS & BACKUP
// =========================================================================
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

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
    showToast('تمت إعادة ضبط البيانات للأصل بنجاح');
  }
}

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
    window.BookDB.saveBook(newBook);
    renderBooks();
    renderCollections();
    showToast(`تمت إضافة كتاب: ${title}`);
  }

  event.target.value = '';
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
