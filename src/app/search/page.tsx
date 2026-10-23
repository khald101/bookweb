'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { Search, BookOpen, ExternalLink, Filter, Folder, ArrowLeft, Loader2 } from 'lucide-react';

interface SearchResultBook {
  book: {
    id: string;
    title: string;
    author: string;
    format: string;
    collectionId: string | null;
  };
  totalMatches: number;
  pages: {
    pageNumber: number;
    matches: {
      index: number;
      snippet: string;
      exactMatch: string;
    }[];
  }[];
}

interface CollectionItem {
  id: string;
  name: string;
}

export default function GlobalSearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultBook[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    fetch('/api/collections')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setCollections(data.collections || []);
      })
      .catch(console.error);
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);

    try {
      let url = `/api/search?q=${encodeURIComponent(query.trim())}`;
      if (selectedCollection) url += `&collectionId=${encodeURIComponent(selectedCollection)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setResults(data.results || []);
        setTotalMatches(data.totalMatches || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="page-title-box">
        <div>
          <h1 className="page-title">
            <Search size={28} style={{ color: 'var(--accent-primary)' }} />
            <span>البحث الشامل في جميع الكتب</span>
          </h1>
          <p className="page-subtitle">
            ابحث عن أي كلمة أو عبارة عبر محتوى جميع الكتب في مكتبتك بالكامل مع تطبيع الحروف والهمزات
          </p>
        </div>
      </div>

      {/* Search Input Box */}
      <form onSubmit={handleSearch} style={{ marginBottom: '28px' }}>
        <div
          style={{
            display: 'flex',
            gap: '12px',
            background: 'var(--bg-glass)',
            padding: '16px',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 min(100%, 280px)', minWidth: 'min(100%, 240px)' }}>
            <Search
              size={20}
              style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingRight: '48px', fontSize: '0.98rem', height: '48px' }}
              placeholder="اكتب كلمة أو عبارة للبحث في كافة الكتب..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>

          <div style={{ flex: '1 1 min(100%, 180px)', minWidth: 'min(100%, 160px)' }}>
            <select
              className="form-select"
              style={{ height: '48px' }}
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
            >
              <option value="">كافة المجموعات</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ height: '48px', padding: '0 24px', fontSize: '1rem', minWidth: 'min(100%, 140px)' }}
            disabled={loading}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            <span>بحث شامل</span>
          </button>
        </div>
      </form>

      {/* Results Header */}
      {hasSearched && (
        <div style={{ marginBottom: '20px', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
          {loading ? (
            <span>جاري مسح محتويات الكتب وفهرس البحث...</span>
          ) : results.length > 0 ? (
            <span>
              تم العثور على <strong>{totalMatches}</strong> نتيجة مطابقة في <strong>{results.length}</strong> كتاب:
            </span>
          ) : (
            <span>لم يتم العثور على نتائج للبحث عن «{query}»</span>
          )}
        </div>
      )}

      {/* Results Display */}
      {results.map((item) => (
        <div
          key={item.book.id}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-xl)',
            padding: '24px',
            marginBottom: '22px',
          }}
        >
          {/* Book Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '14px',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className={`cover-badge ${item.book.format}`} style={{ position: 'static' }}>
                {item.book.format}
              </span>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {item.book.title}
                </h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  المؤلف: {item.book.author} — {item.totalMatches} موضع مطابق
                </div>
              </div>
            </div>

            <Link
              href={item.pages[0]?.pageNumber ? `/reader/${item.book.id}?page=${item.pages[0].pageNumber}` : `/reader/${item.book.id}`}
              className="btn btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.85rem' }}
            >
              <span>فتح الكتاب</span>
              <ArrowLeft size={16} />
            </Link>
          </div>

          {/* Matches by Page */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {item.pages.map((p) => (
              <div
                key={p.pageNumber}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
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
                    style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-primary)' }}
                  >
                    صفحة {p.pageNumber}
                  </span>

                  <Link
                    href={`/reader/${item.book.id}?page=${p.pageNumber}`}
                    className="btn btn-secondary"
                    style={{
                      fontSize: '0.8rem',
                      padding: '4px 10px',
                      textDecoration: 'none',
                    }}
                  >
                    <span>الانتقال للصفحة {p.pageNumber}</span>
                    <ArrowLeft size={13} />
                  </Link>
                </div>

                {p.matches.map((m, idx) => (
                  <Link
                    key={idx}
                    href={`/reader/${item.book.id}?page=${p.pageNumber}`}
                    style={{
                      display: 'block',
                      fontSize: '0.92rem',
                      lineHeight: 1.7,
                      color: 'var(--text-primary)',
                      padding: '8px 12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: '6px',
                      textDecoration: 'none',
                      border: '1px solid transparent',
                      transition: 'all 0.15s ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(99, 102, 241, 0.1)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99, 102, 241, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.03)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                    }}
                  >
                    {m.snippet}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </AppShell>
  );
}
