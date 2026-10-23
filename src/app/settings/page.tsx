'use client';

import React, { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import {
  Settings,
  Database,
  HardDrive,
  Download,
  BookOpen,
  Highlighter,
  Bookmark,
  FileText,
  Palette,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

export default function SettingsPage() {
  const [theme, setTheme] = useState<'dark' | 'light' | 'sepia'>('dark');
  const [fontFamily, setFontFamily] = useState('Cairo');
  const [fontSize, setFontSize] = useState(19);
  const [stats, setStats] = useState({
    booksCount: 0,
    highlightsCount: 0,
    categoriesCount: 0,
    bookmarksCount: 0,
    notesCount: 0,
  });
  const [savedNotification, setSavedNotification] = useState(false);

  useEffect(() => {
    // Load current theme
    const savedTheme = localStorage.getItem('app-theme') as 'dark' | 'light' | 'sepia' | null;
    if (savedTheme) setTheme(savedTheme);

    // Fetch stats
    Promise.all([
      fetch('/api/books').then((r) => r.json()),
      fetch('/api/highlights').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/bookmarks').then((r) => r.json()),
      fetch('/api/notes').then((r) => r.json()),
    ])
      .then(([b, h, c, bm, n]) => {
        setStats({
          booksCount: b.books?.length || 0,
          highlightsCount: h.highlights?.length || 0,
          categoriesCount: c.categories?.length || 0,
          bookmarksCount: bm.bookmarks?.length || 0,
          notesCount: n.notes?.length || 0,
        });
      })
      .catch(console.error);
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem('app-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    setSavedNotification(true);
    setTimeout(() => setSavedNotification(false), 2000);
  };

  const handleExportBackup = () => {
    // Generate backup JSON from current endpoints
    Promise.all([
      fetch('/api/books').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/highlights').then((r) => r.json()),
      fetch('/api/bookmarks').then((r) => r.json()),
      fetch('/api/notes').then((r) => r.json()),
    ]).then(([b, c, h, bm, n]) => {
      const backupData = {
        exportedAt: new Date().toISOString(),
        libraryTitle: 'نسخة احتياطية لمكتبتي الإلكترونية الشخصية',
        books: b.books || [],
        categories: c.categories || [],
        highlights: h.highlights || [],
        bookmarks: bm.bookmarks || [],
        notes: n.notes || [],
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my_library_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <AppShell>
      <div className="page-title-box">
        <div>
          <h1 className="page-title">
            <Settings size={28} style={{ color: 'var(--accent-primary)' }} />
            <span>الإعدادات والتخزين الدائم</span>
          </h1>
          <p className="page-subtitle">
            إدارة تفضيلات القراءة والخطوط والمزامنة، وتفقد إحصائيات التخزين الدائم لبياناتك
          </p>
        </div>
      </div>

      {savedNotification && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: 'var(--success)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '20px',
            fontSize: '0.9rem',
          }}
        >
          <CheckCircle2 size={18} />
          <span>تم حفظ الإعدادات بنجاح وتطبيقها فوراً!</span>
        </div>
      )}

      {/* Grid of Settings Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px' }}>
        {/* 1. Storage Statistics */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-xl)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <HardDrive size={22} style={{ color: 'var(--accent-primary)' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>حالة التخزين الدائم</h3>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            جميع كتبك وتظليلاتك ومواضع قراءتك محفوظة بشكل دائم على الخادم وقاعدة البيانات، ولا تتأثر بإغلاق المتصفح أو تسجيل الخروج.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>الكتب المحفوظة</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {stats.booksCount}
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>التظليلات المخصصة</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-secondary)', marginTop: '4px' }}>
                {stats.highlightsCount}
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>تصنيفات الألوان</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--warning)', marginTop: '4px' }}>
                {stats.categoriesCount}
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>العلامات والملاحظات</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)', marginTop: '4px' }}>
                {stats.bookmarksCount + stats.notesCount}
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: 'auto' }}>
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleExportBackup}>
              <Download size={16} />
              <span>تصدير نسخة احتياطية كاملة (JSON)</span>
            </button>
          </div>
        </div>

        {/* 2. Reading Appearance Settings */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-xl)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Palette size={22} style={{ color: 'var(--accent-secondary)' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>تفضيلات مظهر القراءة</h3>
          </div>

          <div className="form-group">
            <label className="form-label">السمة اللونية المفضلة (Theme)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(85px, 1fr))', gap: '8px' }}>
              <button
                type="button"
                className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.82rem', padding: '8px 6px', textAlign: 'center' }}
                onClick={() => setTheme('dark')}
              >
                الداكن
              </button>
              <button
                type="button"
                className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.82rem', padding: '8px 6px', textAlign: 'center' }}
                onClick={() => setTheme('light')}
              >
                الفاتح
              </button>
              <button
                type="button"
                className={`btn ${theme === 'sepia' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.82rem', padding: '8px 6px', textAlign: 'center' }}
                onClick={() => setTheme('sepia')}
              >
                الدافئ
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">نوع الخط العربي الأساسي</label>
            <select
              className="form-select"
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
            >
              <option value="Cairo">خط القاهرة (Cairo - حديث وعصري)</option>
              <option value="Amiri">خط أميري (Amiri - نسخ عربي كلاسيكي للكتب)</option>
              <option value="Tajawal">خط تجوال (Tajawal - ناعم ومريح للعين)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">حجم الخط الافتراضي للقراءة: {fontSize}px</label>
            <input
              type="range"
              min={14}
              max={28}
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
              className="slider-input"
            />
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: 'auto' }}>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSaveSettings}>
              <span>حفظ الإعدادات</span>
            </button>
          </div>
        </div>

        {/* 3. Privacy & Device Sync */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-xl)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={22} style={{ color: 'var(--success)' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>الخصوصية والتوافق مع الأجهزة</h3>
          </div>

          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <p style={{ marginBottom: '10px' }}>
              🔒 <strong>مكتبة خاصة بالكامل:</strong> ملفاتك وبياناتك لا يتم مشاركتها مع أي جهة خارجية أو أطراف ثالثة.
            </p>
            <p style={{ marginBottom: '10px' }}>
              📱 <strong>متوافق مع جميع الأجهزة:</strong> يعمل النظام بكفاءة على الحواسيب الشخصية، وأجهزة Android، وهواتف iPhone، وأجهزة iPad والتابلت مع دعم كامل للمس.
            </p>
            <p>
              ⚡ <strong>تزامن المواضع الدقيق:</strong> تظل التظليلات والعلامات المرجعية والملاحظات مرتبطة بمواقعها الصحيحة حتى عند تغيير أبعاد الشاشة أو تكبير الخط.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
