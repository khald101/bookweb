'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import {
  Search,
  BookOpen,
  ArrowLeft,
  Loader2,
  Sparkles,
  CheckCircle2,
  Highlighter,
  StickyNote,
  Filter,
} from 'lucide-react';

interface SearchSnippetMatch {
  matchIndex: number;
  origStart: number;
  origEnd: number;
  exactMatch: string;
  snippet: string;
  score: number;
  matchType: 'exact' | 'spelling' | 'normalized' | 'flexible';
}

interface SearchResultBook {
  book: {
    id: string;
    title: string;
    author: string;
    format: string;
    collectionId: string | null;
  };
  totalMatches: number;
  maxScore: number;
  pages: {
    pageNumber: number;
    matches: SearchSnippetMatch[];
    maxScore: number;
  }[];
}

interface HighlightSearchResult {
  id: string;
  bookId: string;
  bookTitle: string;
  pageNumber: number;
  categoryId: string;
  categoryName?: string;
  categoryColor?: string;
  text: string;
  note?: string;
  matches: SearchSnippetMatch[];
}

interface NoteSearchResult {
  id: string;
  bookId: string;
  bookTitle: string;
  pageNumber: number;
  text: string;
  snippet?: string;
  matches: SearchSnippetMatch[];
}

interface CollectionItem {
  id: string;
  name: string;
}

export default function GlobalSearchPage() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'books' | 'highlights' | 'notes'>('all');
  const [results, setResults] = useState<SearchResultBook[]>([]);
  const [highlightResults, setHighlightResults] = useState<HighlightSearchResult[]>([]);
  const [noteResults, setNoteResults] = useState<NoteSearchResult[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [totalBookMatches, setTotalBookMatches] = useState(0);
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
        setHighlightResults(data.highlightsResults || []);
        setNoteResults(data.notesResults || []);
        setTotalMatches(data.totalMatches || 0);
        setTotalBookMatches(data.totalBookMatches || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to render highlighted match inside snippet
  const renderSnippetWithHighlight = (snippet: string, exactMatch: string) => {
    if (!snippet || !exactMatch) return snippet;
    
    // Split by exact match if present, else fallback
    if (snippet.includes(exactMatch)) {
      const parts = snippet.split(exactMatch);
      return (
        <span>
          {parts.map((part, i) => (
            <React.Fragment key={i}>
              {part}
              {i < parts.length - 1 && (
                <mark
                  style={{
                    backgroundColor: 'rgba(250, 204, 21, 0.35)',
                    color: 'inherit',
                    fontWeight: 700,
                    padding: '1px 4px',
                    borderRadius: '3px',
                    borderBottom: '2px solid #EAB308',
                  }}
                >
                  {exactMatch}
                </mark>
              )}
            </React.Fragment>
          ))}
        </span>
      );
    }

    return snippet;
  };

  return (
    <AppShell>
      <div className="page-title-box">
        <div>
          <h1 className="page-title">
            <Search size={28} style={{ color: 'var(--accent-primary)' }} />
            <span>البحث الذكي والمرن في المكتبة</span>
          </h1>
          <p className="page-subtitle">
            بحث متقدم يتجاهل التشكيل والمسافات وعلامات الترقيم وتطبيع الهمزات، مع التمييز التلقائي الدقيق عند فتح الكتاب
          </p>
        </div>
      </div>

      {/* Search Input Box */}
      <form onSubmit={handleSearch} style={{ marginBottom: '24px' }}>
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
              style={{ paddingRight: '48px', fontSize: '1rem', height: '48px' }}
              placeholder="اكتب كلمة أو عبارة للبحث (مثال: بن شجاع، أو بالتشكيل: بن شُجَاع)..."
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
            <span>بحث ذكي</span>
          </button>
        </div>
      </form>

      {/* Tabs Filter (Books, Highlights, Notes) */}
      {hasSearched && totalMatches > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button
            className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '0.86rem' }}
            onClick={() => setActiveTab('all')}
          >
            الكل ({totalMatches})
          </button>
          <button
            className={`btn ${activeTab === 'books' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '0.86rem' }}
            onClick={() => setActiveTab('books')}
          >
            <BookOpen size={15} />
            <span>في الكتب ({totalBookMatches})</span>
          </button>
          {highlightResults.length > 0 && (
            <button
              className={`btn ${activeTab === 'highlights' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.86rem' }}
              onClick={() => setActiveTab('highlights')}
            >
              <Highlighter size={15} />
              <span>في التظليلات ({highlightResults.length})</span>
            </button>
          )}
          {noteResults.length > 0 && (
            <button
              className={`btn ${activeTab === 'notes' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.86rem' }}
              onClick={() => setActiveTab('notes')}
            >
              <StickyNote size={15} />
              <span>في الملاحظات ({noteResults.length})</span>
            </button>
          )}
        </div>
      )}

      {/* Results Header Status */}
      {hasSearched && (
        <div style={{ marginBottom: '20px', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
              <span>جاري البحث الذكي ومطابقة التشكيل وعلامات الترقيم عبر الكتب...</span>
            </div>
          ) : totalMatches > 0 ? (
            <span>
              تم العثور على <strong>{totalMatches}</strong> موضع مطابق عبر <strong>{results.length}</strong> كتاب
              {highlightResults.length > 0 ? ` و${highlightResults.length} تظليل` : ''}
              {noteResults.length > 0 ? ` و${noteResults.length} ملاحظة` : ''}:
            </span>
          ) : (
            <span>لم يتم العثور على نتائج للبحث عن «{query}»</span>
          )}
        </div>
      )}

      {/* Highlights Section */}
      {(activeTab === 'all' || activeTab === 'highlights') && highlightResults.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
            <Highlighter size={18} style={{ color: 'var(--accent-secondary)' }} />
            <span>نتائج البحث في التظليلات ({highlightResults.length})</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
            {highlightResults.map((hl) => (
              <Link
                key={hl.id}
                href={`/reader/${hl.bookId}?page=${hl.pageNumber}&q=${encodeURIComponent(query)}`}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'all 0.15s ease',
                  borderRight: `4px solid ${hl.categoryColor || '#EF4444'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>{hl.bookTitle}</span>
                  <span>صفحة {hl.pageNumber}</span>
                </div>
                <div style={{ fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '6px', color: 'var(--text-primary)' }}>
                  {renderSnippetWithHighlight(hl.text, hl.matches[0]?.exactMatch || query)}
                </div>
                {hl.note && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '4px' }}>
                    💬 {hl.note}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Notes Section */}
      {(activeTab === 'all' || activeTab === 'notes') && noteResults.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
            <StickyNote size={18} style={{ color: '#10B981' }} />
            <span>نتائج البحث في الملاحظات ({noteResults.length})</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
            {noteResults.map((nt) => (
              <Link
                key={nt.id}
                href={`/reader/${nt.bookId}?page=${nt.pageNumber}&q=${encodeURIComponent(query)}`}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'all 0.15s ease',
                  borderRight: '4px solid #10B981',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>{nt.bookTitle}</span>
                  <span>صفحة {nt.pageNumber}</span>
                </div>
                <div style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                  {renderSnippetWithHighlight(nt.text, nt.matches[0]?.exactMatch || query)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Book Content Results Display */}
      {(activeTab === 'all' || activeTab === 'books') &&
        results.map((item) => (
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

              {item.pages[0]?.matches[0] && (
                <Link
                  href={`/reader/${item.book.id}?page=${item.pages[0].pageNumber}&q=${encodeURIComponent(query)}&matchIndex=${item.pages[0].matches[0].matchIndex}&start=${item.pages[0].matches[0].origStart}&end=${item.pages[0].matches[0].origEnd}`}
                  className="btn btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                >
                  <span>فتح الكتاب عند أول نتيجة</span>
                  <ArrowLeft size={16} />
                </Link>
              )}
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
                      marginBottom: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        className="item-badge"
                        style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-primary)', fontWeight: 700 }}
                      >
                        صفحة {p.pageNumber} ({p.matches.length} نتيجة)
                      </span>
                      {p.maxScore >= 85 ? (
                        <span className="search-match-badge exact">
                          <CheckCircle2 size={12} />
                          <span>تطابق تام</span>
                        </span>
                      ) : (
                        <span className="search-match-badge flexible">
                          <Sparkles size={12} />
                          <span>بحث مرن ذكي</span>
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/reader/${item.book.id}?page=${p.pageNumber}&q=${encodeURIComponent(query)}&matchIndex=${p.matches[0]?.matchIndex || 0}&start=${p.matches[0]?.origStart || 0}&end=${p.matches[0]?.origEnd || 0}`}
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
                      href={`/reader/${item.book.id}?page=${p.pageNumber}&q=${encodeURIComponent(query)}&matchIndex=${m.matchIndex}&start=${m.origStart}&end=${m.origEnd}`}
                      style={{
                        display: 'block',
                        fontSize: '0.92rem',
                        lineHeight: 1.7,
                        color: 'var(--text-primary)',
                        padding: '10px 14px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: '6px',
                        textDecoration: 'none',
                        border: '1px solid transparent',
                        transition: 'all 0.15s ease',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(234, 179, 8, 0.12)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(234, 179, 8, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.03)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                      }}
                      title="اضغط للانتقال إلى موضع النتيجة تحديداً وتمييزها تلقائياً داخل صفحة الكتاب"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                          نتيجة {m.matchIndex + 1}: «{m.exactMatch}»
                        </span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          اضغط للتمييز والانتقال ↖
                        </span>
                      </div>
                      <div>{renderSnippetWithHighlight(m.snippet, m.exactMatch)}</div>
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
