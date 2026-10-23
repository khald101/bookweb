'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Search,
  Palette,
  Highlighter,
  Bookmark,
  FileText,
  Settings,
  Upload,
  Sun,
  Moon,
  Coffee,
  Menu,
  X,
  Plus,
  FolderPlus,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
  onBookUploaded?: () => void;
}

export default function AppShell({ children, onBookUploaded }: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light' | 'sepia'>('dark');
  
  // Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    // Load theme from localStorage or document
    const savedTheme = localStorage.getItem('app-theme') as 'dark' | 'light' | 'sepia' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  const switchTheme = (newTheme: 'dark' | 'light' | 'sepia') => {
    setTheme(newTheme);
    localStorage.setItem('app-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadProgressText(`جاري رفع ومعالجة ${files.length} كتاب...`);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setUploadProgressText(`تم الرفع والمعالجة بنجاح!`);
        setTimeout(() => {
          setIsUploading(false);
          setUploadModalOpen(false);
          if (onBookUploaded) onBookUploaded();
          // Reload page to reflect new books if on library
          window.location.reload();
        }, 1200);
      } else {
        setUploadError(data.error || 'حدث خطأ أثناء معالجة الملفات');
        setIsUploading(false);
      }
    } catch (err: any) {
      setUploadError(err.message || 'فشل الاتصال بالخادم');
      setIsUploading(false);
    }
  };

  const navLinks = [
    { href: '/', label: 'المكتبة', icon: BookOpen },
    { href: '/search', label: 'البحث الشامل', icon: Search },
    { href: '/categories', label: 'تصنيفات الألوان', icon: Palette },
    { href: '/highlights', label: 'تظليلاتي', icon: Highlighter },
    { href: '/bookmarks', label: 'علاماتي المرجعية', icon: Bookmark },
    { href: '/notes', label: 'ملاحظاتي', icon: FileText },
    { href: '/settings', label: 'الإعدادات والتخزين', icon: Settings },
  ];

  return (
    <div className="app-layout">
      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div
          className="modal-overlay"
          style={{ zIndex: 35 }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Navigation Sidebar */}
      <aside className={`app-nav ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="nav-brand" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="brand-icon">
              <BookOpen size={24} />
            </div>
            <div>
              <div className="brand-title">مكتبتي الخاصة</div>
              <div className="brand-sub">نظام القراءة والألوان المخصصة</div>
            </div>
          </div>

          <button
            className="btn-icon nav-close-btn"
            style={{ width: '38px', height: '38px' }}
            onClick={() => setMobileMenuOpen(false)}
            title="إغلاق القائمة"
            aria-label="إغلاق القائمة"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="nav-menu">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Theme Switcher in Sidebar Footer */}
        <div className="nav-footer">
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className={`btn-icon ${theme === 'dark' ? 'active' : ''}`}
              title="الوضع الداكن"
              onClick={() => switchTheme('dark')}
              style={theme === 'dark' ? { borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' } : {}}
            >
              <Moon size={16} />
            </button>
            <button
              className={`btn-icon ${theme === 'light' ? 'active' : ''}`}
              title="الوضع الفاتح"
              onClick={() => switchTheme('light')}
              style={theme === 'light' ? { borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' } : {}}
            >
              <Sun size={16} />
            </button>
            <button
              className={`btn-icon ${theme === 'sepia' ? 'active' : ''}`}
              title="وضع القراءة الدافئ (ورق)"
              onClick={() => switchTheme('sepia')}
              style={theme === 'sepia' ? { borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' } : {}}
            >
              <Coffee size={16} />
            </button>
          </div>
          <button
            className="btn btn-primary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            onClick={() => setUploadModalOpen(true)}
          >
            <Plus size={14} />
            <span>رفع كتاب</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="app-main">
        {/* Top Header */}
        <header className="top-header">
          <div className="header-brand-wrap" style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <button
              className="btn-icon mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              title="القائمة"
              aria-label="فتح القائمة الرئيسية"
              style={{ width: '40px', height: '40px', flexShrink: 0 }}
            >
              <Menu size={20} />
            </button>
            <span className="header-app-title">
              المكتبة الإلكترونية الشخصية
            </span>
          </div>

          <div className="header-actions">
            <button
              className="btn btn-primary top-upload-btn"
              onClick={() => setUploadModalOpen(true)}
              title="رفع كتب جديدة إلى المكتبة"
            >
              <Upload size={16} />
              <span className="top-upload-label">رفع كتب جديدة</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="content-container">{children}</main>
      </div>

      {/* Upload Books Modal */}
      {uploadModalOpen && (
        <div className="modal-overlay" onClick={() => !isUploading && setUploadModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">رفع كتب جديدة إلى مكتبتك</h3>
              {!isUploading && (
                <button
                  className="btn-icon"
                  onClick={() => setUploadModalOpen(false)}
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="modal-body">
              {uploadError && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: 'var(--danger)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.9rem',
                  }}
                >
                  <AlertCircle size={18} />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Drag & Drop Upload Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files) handleFileUpload(e.dataTransfer.files);
                }}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '40px 20px',
                  textAlign: 'center',
                  background: dragOver ? 'var(--accent-glow)' : 'rgba(255, 255, 255, 0.02)',
                  transition: 'all 0.2s ease',
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
                onClick={() => {
                  if (!isUploading) {
                    const input = document.getElementById('book-file-input');
                    input?.click();
                  }
                }}
              >
                <input
                  id="book-file-input"
                  type="file"
                  multiple
                  accept=".pdf,.epub,.txt,.docx"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileUpload(e.target.files)}
                  disabled={isUploading}
                />

                {isUploading ? (
                  <>
                    <Loader2 size={44} className="animate-spin" style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
                    <div style={{ fontSize: '1rem', fontWeight: 600 }}>{uploadProgressText}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      جاري استخراج النصوص وفهرسة الصفحات للبحث والتظليل الدائم...
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'rgba(99, 102, 241, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-primary)',
                      }}
                    >
                      <Upload size={28} />
                    </div>
                    <div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '4px' }}>
                        اضغط لاختيار الكتب أو اسحب الملفات هنا
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        يمكنك رفع عدة كتب دفعة واحدة دون حد أقصى
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        marginTop: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      <span className="cover-badge pdf" style={{ position: 'static' }}>PDF</span>
                      <span className="cover-badge epub" style={{ position: 'static' }}>EPUB</span>
                      <span className="cover-badge txt" style={{ position: 'static' }}>TXT</span>
                      <span className="cover-badge docx" style={{ position: 'static' }}>DOCX</span>
                    </div>
                  </>
                )}
              </div>

              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                💡 تُحفظ جميع الكتب في تخزين دائم مع استخراج النص التلقائي لتمكين البحث الشامل والتظليل وحفظ مواضع القراءة بدقة.
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setUploadModalOpen(false)}
                disabled={isUploading}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
