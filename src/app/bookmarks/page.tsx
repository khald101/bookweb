'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { Bookmark, Search, Trash2, ArrowLeft, BookOpen, Clock } from 'lucide-react';

interface BookmarkItem {
  id: string;
  bookId: string;
  pageNumber: number;
  title: string;
  textSnippet: string;
  createdAt: string;
  bookTitle?: string;
}

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchBookmarks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/bookmarks');
      const data = await res.json();
      if (data.success) {
        setBookmarks(data.bookmarks || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const handleDelete = async (id: string) => {
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

  const filtered = bookmarks.filter((bm) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        bm.title.toLowerCase().includes(q) ||
        bm.textSnippet.toLowerCase().includes(q) ||
        (bm.bookTitle && bm.bookTitle.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <AppShell>
      <div className="page-title-box">
        <div>
          <h1 className="page-title">
            <Bookmark size={28} style={{ color: 'var(--accent-primary)' }} />
            <span>علاماتي المرجعية</span>
          </h1>
          <p className="page-subtitle">
            جميع الإشارات المرجعية التي قمت بتثبيتها عبر كتبك للرجوع السريع إلى أي صفحة أو فقرة
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', maxWidth: '480px', marginBottom: '24px' }}>
        <Search
          size={16}
          style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
        />
        <input
          type="text"
          className="form-input"
          style={{ paddingRight: '40px' }}
          placeholder="ابحث في العلامات المرجعية..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Bookmarks List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          جاري تحميل العلامات المرجعية...
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-xl)',
            border: '1px dashed var(--border-color)',
          }}
        >
          <Bookmark size={44} style={{ color: 'var(--text-muted)', margin: '0 auto 14px' }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>لا توجد علامات مرجعية</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            يمكنك إضافة علامة مرجعية لأي صفحة أو موضع قراءة من داخل القارئ
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '18px' }}>
          {filtered.map((bm) => (
            <div
              key={bm.id}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="item-badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-primary)' }}>
                  <Bookmark size={12} />
                  صفحة {bm.pageNumber}
                </span>

                <button
                  className="btn-icon"
                  style={{ width: '34px', height: '34px', color: 'var(--danger)' }}
                  onClick={() => handleDelete(bm.id)}
                  title="حذف العلامة"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                {bm.title}
              </h4>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, wordBreak: 'break-word' }}>
                كتاب: {bm.bookTitle}
              </div>

              {bm.textSnippet && (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.5, wordBreak: 'break-word' }}>
                  «{bm.textSnippet}»
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 'auto',
                  paddingTop: '10px',
                  borderTop: '1px solid var(--border-color)',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {new Date(bm.createdAt).toLocaleDateString('ar-EG')}
                </span>

                <Link
                  href={`/reader/${bm.bookId}?page=${bm.pageNumber}`}
                  className="btn btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '0.82rem', minHeight: '36px' }}
                >
                  <span>فتح في القارئ</span>
                  <ArrowLeft size={13} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
