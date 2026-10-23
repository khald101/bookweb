'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import {
  Highlighter,
  Search,
  BookOpen,
  Filter,
  Trash2,
  ExternalLink,
  Tag,
  ArrowLeft,
  Edit3,
  Sparkles,
  Loader2,
  Check,
  X,
} from 'lucide-react';

interface HighlightCategory {
  id: string;
  name: string;
  colorHex: string;
}

interface HighlightItem {
  id: string;
  bookId: string;
  categoryId: string;
  pageNumber: number;
  text: string;
  positionData?: any;
  note?: string;
  createdAt: string;
  bookTitle?: string;
  category?: HighlightCategory;
}

export default function HighlightsPage() {
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [categories, setCategories] = useState<HighlightCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingHlId, setEditingHlId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [isExtractingId, setIsExtractingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [hlRes, catRes] = await Promise.all([
        fetch('/api/highlights'),
        fetch('/api/categories'),
      ]);

      const [hlData, catData] = await Promise.all([hlRes.json(), catRes.json()]);

      if (hlData.success) setHighlights(hlData.highlights || []);
      if (catData.success) setCategories(catData.categories || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/highlights/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setHighlights((prev) => prev.filter((h) => h.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveEditedText = async (id: string) => {
    if (!editingText.trim()) return;
    try {
      const res = await fetch(`/api/highlights/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editingText.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setHighlights((prev) => prev.map((h) => (h.id === id ? { ...h, text: editingText.trim() } : h)));
        setEditingHlId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOcrHighlight = async (hl: HighlightItem) => {
    if (!hl.positionData?.box) return;
    try {
      setIsExtractingId(hl.id);
      const res = await fetch('/api/highlights/ocr-box', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: hl.bookId,
          pageNumber: hl.pageNumber,
          box: hl.positionData.box,
          highlightId: hl.id,
        }),
      });
      const data = await res.json();
      if (data.success && data.text) {
        setHighlights((prev) => prev.map((h) => (h.id === hl.id ? { ...h, text: data.text } : h)));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsExtractingId(null);
    }
  };

  // Filter
  const filtered = highlights.filter((h) => {
    if (selectedCategory && h.categoryId !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const textMatch = h.text.toLowerCase().includes(q);
      const noteMatch = h.note ? h.note.toLowerCase().includes(q) : false;
      const catMatch = h.category ? h.category.name.toLowerCase().includes(q) : false;
      const bookMatch = h.bookTitle ? h.bookTitle.toLowerCase().includes(q) : false;
      return textMatch || noteMatch || catMatch || bookMatch;
    }
    return true;
  });

  return (
    <AppShell>
      <div className="page-title-box">
        <div>
          <h1 className="page-title">
            <Highlighter size={28} style={{ color: 'var(--accent-primary)' }} />
            <span>تظليلاتي المحفوظة</span>
          </h1>
          <p className="page-subtitle">
            استعرض جميع النصوص المظللة عبر كتبك، وفلترها بحسب التصنيفات المخصصة، وانتقل مباشرة لموضع القراءة
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          padding: '14px',
          background: 'var(--bg-glass)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: 'min(100%, 240px)', flex: '1 1 220px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              right: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingRight: '40px' }}
            placeholder="ابحث داخل نصوص التظليلات والملاحظات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Categories Pills */}
        <div className="hide-scrollbar" style={{ display: 'flex', gap: '6px', overflowX: 'auto', maxWidth: '100%', paddingBottom: '2px' }}>
          <button
            className={`btn ${selectedCategory === null ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            onClick={() => setSelectedCategory(null)}
          >
            كافة التصنيفات ({highlights.length})
          </button>

          {categories.map((c) => {
            const count = highlights.filter((h) => h.categoryId === c.id).length;
            const isSelected = selectedCategory === c.id;

            return (
              <button
                key={c.id}
                className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  borderColor: isSelected ? 'transparent' : `${c.colorHex}55`,
                }}
                onClick={() => setSelectedCategory(isSelected ? null : c.id)}
              >
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: c.colorHex,
                    display: 'inline-block',
                    marginLeft: '6px',
                  }}
                />
                <span>{c.name} ({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Highlights List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          جاري تحميل التظليلات...
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
          <Highlighter size={44} style={{ color: 'var(--text-muted)', margin: '0 auto 14px' }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>لا توجد تظليلات مطابقة</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            افتح أي كتاب وحدد نصاً لتظليله بتصنيفاتك وألوانك المفضلة
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filtered.map((hl) => {
            const color = hl.category?.colorHex || '#EF4444';
            const catName = hl.category?.name || 'بدون تصنيف';

            return (
              <div
                key={hl.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRight: `5px solid ${color}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Header info */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
                    <span
                      className="item-badge"
                      style={{
                        backgroundColor: `${color}20`,
                        color: color,
                        border: `1px solid ${color}60`,
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: color,
                        }}
                      />
                      {catName}
                    </span>

                    <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600, wordBreak: 'break-word' }}>
                      «{hl.bookTitle}» — الصفحة {hl.pageNumber}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Link
                      href={`/reader/${hl.bookId}?page=${hl.pageNumber}`}
                      className="btn btn-secondary"
                      style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                    >
                      <span>الانتقال للموضع</span>
                      <ArrowLeft size={14} />
                    </Link>

                    <button
                      className="btn-icon"
                      style={{ width: '32px', height: '32px', color: 'var(--danger)' }}
                      title="حذف التظليل"
                      onClick={() => handleDelete(hl.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Highlighted text or Edit Form */}
                {editingHlId === hl.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      style={{ fontSize: '0.98rem', fontFamily: 'var(--font-amiri)', lineHeight: 1.8 }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                        onClick={() => setEditingHlId(null)}
                      >
                        <X size={13} />
                        <span>إلغاء</span>
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                        onClick={() => handleSaveEditedText(hl.id)}
                      >
                        <Check size={13} />
                        <span>حفظ التعديل</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      position: 'relative',
                      fontSize: '1.05rem',
                      lineHeight: 1.8,
                      background: `${color}15`,
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      borderLeft: `2px solid ${color}`,
                      fontFamily: 'var(--font-amiri)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ flex: 1 }}>«{hl.text}»</div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          className="btn-icon"
                          style={{ width: '28px', height: '28px', color: 'var(--text-secondary)' }}
                          title="تعديل نص التظليل"
                          onClick={() => {
                            setEditingHlId(hl.id);
                            setEditingText(hl.text);
                          }}
                        >
                          <Edit3 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* OCR Button if generic text */}
                    {hl.positionData?.box && hl.text.startsWith('تظليل في الصفحة') && (
                      <button
                        className="btn btn-secondary"
                        style={{
                          alignSelf: 'flex-start',
                          padding: '4px 10px',
                          fontSize: '0.78rem',
                          color: 'var(--accent-secondary)',
                          borderColor: 'var(--accent-secondary)',
                        }}
                        disabled={isExtractingId === hl.id}
                        onClick={() => handleOcrHighlight(hl)}
                      >
                        {isExtractingId === hl.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Sparkles size={13} />
                        )}
                        <span>{isExtractingId === hl.id ? 'جاري استخراج النص...' : 'استخراج النص من الموضع بالذكاء الاصطناعي'}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Optional note */}
                {hl.note && (
                  <div
                    style={{
                      fontSize: '0.88rem',
                      color: 'var(--text-secondary)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    📝 <strong>ملاحظة ملحقة:</strong> {hl.note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
