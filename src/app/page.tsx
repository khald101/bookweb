'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import {
  BookOpen,
  Search,
  Grid,
  List,
  Folder,
  FolderPlus,
  MoreVertical,
  Edit2,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  Sparkles,
  Bookmark,
  Highlighter,
  FileText,
  X,
  Upload,
} from 'lucide-react';

interface BookItem {
  id: string;
  title: string;
  author: string;
  description: string;
  format: 'pdf' | 'epub' | 'txt' | 'docx';
  fileSize: number;
  fileName: string;
  collectionId: string | null;
  pageCount: number;
  status: 'ready' | 'processing' | 'error';
  isOcr: boolean;
  ocrStatus: 'none' | 'pending' | 'processing' | 'completed' | 'failed';
  coverUrl?: string;
  readingProgress?: {
    currentPage: number;
    totalPages: number;
    percentage: number;
    updatedAt: string;
  };
}

interface CollectionItem {
  id: string;
  name: string;
  description?: string;
  color?: string;
  bookCount: number;
}

export default function LibraryPage() {
  const [books, setBooks] = useState<BookItem[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);

  // Edit Metadata Modal state
  const [editingBook, setEditingBook] = useState<BookItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColId, setEditColId] = useState<string>('');

  // Delete Confirmation Modal state
  const [deletingBook, setDeletingBook] = useState<BookItem | null>(null);

  // New Collection Modal state
  const [newColModal, setNewColModal] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColDesc, setNewColDesc] = useState('');

  const fetchBooks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/books');
      const data = await res.json();
      if (data.success) {
        setBooks(data.books || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCollections = async () => {
    try {
      const res = await fetch('/api/collections');
      const data = await res.json();
      if (data.success) {
        setCollections(data.collections || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBooks();
    fetchCollections();
  }, []);

  const handleSaveMetadata = async () => {
    if (!editingBook) return;
    try {
      const res = await fetch(`/api/books/${editingBook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          author: editAuthor,
          description: editDesc,
          collectionId: editColId || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingBook(null);
        fetchBooks();
        fetchCollections();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteBook = async () => {
    if (!deletingBook) return;
    try {
      const res = await fetch(`/api/books/${deletingBook.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setDeletingBook(null);
        fetchBooks();
        fetchCollections();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateCollection = async () => {
    if (!newColName.trim()) return;
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newColName, description: newColDesc }),
      });
      const data = await res.json();
      if (data.success) {
        setNewColName('');
        setNewColDesc('');
        setNewColModal(false);
        fetchCollections();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerOcr = async (bookId: string) => {
    try {
      await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId }),
      });
      fetchBooks();
    } catch (e) {
      console.error(e);
    }
  };

  // Filter books
  const filteredBooks = books.filter((b) => {
    if (selectedCollection && b.collectionId !== selectedCollection) return false;
    if (selectedFormat && b.format !== selectedFormat) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <AppShell onBookUploaded={fetchBooks}>
      {/* Top Banner / Stats */}
      <div className="page-title-box">
        <div>
          <h1 className="page-title">
            <BookOpen size={28} style={{ color: 'var(--accent-primary)' }} />
            <span>مكتبتي الشخصية</span>
          </h1>
          <p className="page-subtitle">
            لديك {books.length} كتاب في المكتبة — اقرأ، وابحث، وظلل بنظام التصنيفات المخصص
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-md)', padding: '3px' }}>
            <button
              className={`btn-icon ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="عرض الأغلفة"
              style={viewMode === 'grid' ? { background: 'var(--accent-primary)', color: '#fff' } : {}}
            >
              <Grid size={16} />
            </button>
            <button
              className={`btn-icon ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="عرض القائمة"
              style={viewMode === 'list' ? { background: 'var(--accent-primary)', color: '#fff' } : {}}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          padding: '12px 14px',
          background: 'var(--bg-glass)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
        }}
      >
        {/* Search input */}
        <div style={{ position: 'relative', minWidth: 'min(100%, 240px)', flex: '1 1 220px' }}>
          <Search size={16} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingRight: '40px' }}
            placeholder="ابحث بالعنوان أو اسم المؤلف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Format Filter Pills */}
        <div className="hide-scrollbar" style={{ display: 'flex', gap: '6px', overflowX: 'auto', maxWidth: '100%', paddingBottom: '2px' }}>
          <button
            className={`btn ${selectedFormat === null ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            onClick={() => setSelectedFormat(null)}
          >
            الكل ({books.length})
          </button>
          {['pdf', 'epub', 'txt', 'docx'].map((fmt) => {
            const count = books.filter((b) => b.format === fmt).length;
            return (
              <button
                key={fmt}
                className={`btn ${selectedFormat === fmt ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '0.8rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}
                onClick={() => setSelectedFormat(selectedFormat === fmt ? null : fmt)}
              >
                {fmt} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Collections Pills */}
      <div className="hide-scrollbar" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          className={`btn ${selectedCollection === null ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '6px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
          onClick={() => setSelectedCollection(null)}
        >
          <Folder size={14} />
          <span>جميع المجموعات</span>
        </button>

        {collections.map((col) => (
          <button
            key={col.id}
            className={`btn ${selectedCollection === col.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
            onClick={() => setSelectedCollection(selectedCollection === col.id ? null : col.id)}
          >
            <Folder size={14} style={{ color: col.color || 'var(--accent-primary)' }} />
            <span>{col.name} ({col.bookCount})</span>
          </button>
        ))}

        <button
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap', borderStyle: 'dashed' }}
          onClick={() => setNewColModal(true)}
        >
          <FolderPlus size={14} />
          <span>مجموعة جديدة</span>
        </button>
      </div>

      {/* Books Display */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          جاري تحميل المكتبة...
        </div>
      ) : filteredBooks.length === 0 ? (
        <div
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-xl)',
            border: '1px dashed var(--border-color)',
          }}
        >
          <BookOpen size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>لا توجد كتب مطابقة</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
            لم نجد كتباً في هذا التصنيف أو لم يتم رفع كتب بعد
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              const input = document.getElementById('book-file-input');
              input?.click();
            }}
          >
            <Upload size={16} />
            <span>ارفع كتابك الأول الآن</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="books-grid">
          {filteredBooks.map((book) => {
            const progress = book.readingProgress;
            const percentage = progress ? progress.percentage : 0;
            const currentPage = progress ? progress.currentPage : 1;

            return (
              <div key={book.id} className="book-card">
                {/* Book Cover */}
                <Link href={`/reader/${book.id}`} style={{ textDecoration: 'none' }}>
                  <div className="book-cover">
                    <span className={`cover-badge ${book.format}`}>{book.format}</span>
                    {book.coverUrl ? (
                      <img
                        src={book.coverUrl}
                        alt={book.title}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          position: 'absolute',
                          inset: 0,
                        }}
                      />
                    ) : (
                      <>
                        <BookOpen size={36} style={{ color: 'rgba(255, 255, 255, 0.4)', marginBottom: '14px' }} />
                        <div className="cover-title" title={book.title}>
                          {book.title}
                        </div>
                        <div className="cover-author">{book.author}</div>
                      </>
                    )}
                  </div>
                </Link>

                {/* Info & Progress */}
                <div className="book-info">
                  {/* Progress bar */}
                  <div className="book-progress-box">
                    <div className="progress-labels">
                      <span>{percentage}% مكتمل</span>
                      <span>
                        صفحة {currentPage} من {book.pageCount}
                      </span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>

                  {/* Scanned / OCR badge if applicable */}
                  {book.isOcr && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--accent-secondary)' }}>
                      <Sparkles size={12} />
                      <span>
                        {book.ocrStatus === 'completed'
                          ? 'تم التعرف الضوئي (OCR)'
                          : book.ocrStatus === 'processing'
                          ? 'جاري فحص OCR...'
                          : 'مستند مصور (يتطلب OCR)'}
                      </span>
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="book-actions-row">
                    <Link
                      href={`/reader/${book.id}`}
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '0.82rem', minHeight: '34px' }}
                    >
                      <Eye size={14} />
                      <span>قراءة</span>
                    </Link>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn-icon"
                        style={{ width: '34px', height: '34px' }}
                        title="تعديل البيانات"
                        onClick={() => {
                          setEditingBook(book);
                          setEditTitle(book.title);
                          setEditAuthor(book.author);
                          setEditDesc(book.description || '');
                          setEditColId(book.collectionId || '');
                        }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="btn-icon"
                        style={{ width: '34px', height: '34px', color: 'var(--danger)' }}
                        title="حذف الكتاب"
                        onClick={() => setDeletingBook(book)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredBooks.map((book) => {
            const progress = book.readingProgress;
            const percentage = progress ? progress.percentage : 0;
            const currentPage = progress ? progress.currentPage : 1;

            return (
              <div
                key={book.id}
                className="book-list-item"
              >
                <div className="book-list-info">
                  {book.coverUrl ? (
                    <img
                      src={book.coverUrl}
                      alt={book.title}
                      className="book-list-thumb"
                    />
                  ) : (
                    <span className={`cover-badge ${book.format}`} style={{ position: 'static', flexShrink: 0 }}>
                      {book.format}
                    </span>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Link
                      href={`/reader/${book.id}`}
                      className="book-list-title"
                    >
                      {book.title}
                    </Link>
                    <div className="book-list-meta">
                      المؤلف: {book.author} — {book.pageCount} صفحة — {(book.fileSize / 1024 / 1024).toFixed(2)} ميجابايت
                    </div>
                  </div>
                </div>

                <div className="book-list-progress">
                  <div className="progress-labels">
                    <span>{percentage}%</span>
                    <span>صفحة {currentPage}/{book.pageCount}</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${percentage}%` }} />
                  </div>
                </div>

                <div className="book-list-actions">
                  <Link
                    href={`/reader/${book.id}`}
                    className="btn btn-primary"
                    style={{ padding: '6px 14px', fontSize: '0.85rem', minHeight: '36px' }}
                  >
                    <Eye size={14} />
                    <span>قراءة</span>
                  </Link>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="btn-icon"
                      style={{ width: '36px', height: '36px' }}
                      title="تعديل"
                      onClick={() => {
                        setEditingBook(book);
                        setEditTitle(book.title);
                        setEditAuthor(book.author);
                        setEditDesc(book.description || '');
                        setEditColId(book.collectionId || '');
                      }}
                    >
                      <Edit2 size={14} />
                    </button>

                    <button
                      className="btn-icon"
                      style={{ width: '36px', height: '36px', color: 'var(--danger)' }}
                      title="حذف"
                      onClick={() => setDeletingBook(book)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Metadata Modal */}
      {editingBook && (
        <div className="modal-overlay" onClick={() => setEditingBook(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">تعديل بيانات الكتاب</h3>
              <button className="btn-icon" onClick={() => setEditingBook(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">عنوان الكتاب</label>
                <input
                  type="text"
                  className="form-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">اسم المؤلف</label>
                <input
                  type="text"
                  className="form-input"
                  value={editAuthor}
                  onChange={(e) => setEditAuthor(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">المجموعة / المجلد</label>
                <select
                  className="form-select"
                  value={editColId}
                  onChange={(e) => setEditColId(e.target.value)}
                >
                  <option value="">بدون مجموعة (عام)</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">الوصف أو النبذة</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="اكتب نبذة مختصرة عن هذا الكتاب..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingBook(null)}>
                إلغاء
              </button>
              <button className="btn btn-primary" onClick={handleSaveMetadata}>
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBook && (
        <div className="modal-overlay" onClick={() => setDeletingBook(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} />
                <span>تأكيد حذف الكتاب</span>
              </h3>
              <button className="btn-icon" onClick={() => setDeletingBook(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '1rem', lineHeight: 1.6 }}>
                هل أنت متأكد من رغبتك في حذف كتاب: <strong>«{deletingBook.title}»</strong>؟
              </p>
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  fontSize: '0.85rem',
                  color: 'var(--danger)',
                  lineHeight: 1.6,
                }}
              >
                ⚠️ <strong>تنبيه هام حول البيانات المرتبطة:</strong> سيؤدي الحذف إلى إزالة ملف الكتاب من التخزين الدائم وحذف فهرس البحث الخاص به، مع إزالة التظليلات والعلامات المرجعية والملاحظات المرتبطة به.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeletingBook(null)}>
                إلغاء التراجع
              </button>
              <button className="btn btn-danger" onClick={handleDeleteBook}>
                نعم، احذف الكتاب نهائياً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Collection Modal */}
      {newColModal && (
        <div className="modal-overlay" onClick={() => setNewColModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">إنشاء مجموعة جديدة لتنظيم الكتب</h3>
              <button className="btn-icon" onClick={() => setNewColModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">اسم المجموعة / المجلد</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: كتب الفقه، دراسات تاريخية، روايات..."
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">وصف اختياري</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="وصف المجموعة..."
                  value={newColDesc}
                  onChange={(e) => setNewColDesc(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setNewColModal(false)}>
                إلغاء
              </button>
              <button className="btn btn-primary" onClick={handleCreateCollection}>
                إنشاء المجموعة
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
