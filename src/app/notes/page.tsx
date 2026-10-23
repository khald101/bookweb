'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { FileText, Search, Edit2, Trash2, ArrowLeft, X, Check } from 'lucide-react';

interface NoteItem {
  id: string;
  bookId: string;
  pageNumber: number;
  text: string;
  snippet?: string;
  createdAt: string;
  updatedAt: string;
  bookTitle?: string;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Edit Note Modal
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [editText, setEditText] = useState('');

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notes');
      const data = await res.json();
      if (data.success) {
        setNotes(data.notes || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleUpdateNote = async () => {
    if (!editingNote || !editText.trim()) return;

    try {
      const res = await fetch(`/api/notes/${editingNote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editText.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingNote(null);
        fetchNotes();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = notes.filter((n) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        n.text.toLowerCase().includes(q) ||
        (n.snippet && n.snippet.toLowerCase().includes(q)) ||
        (n.bookTitle && n.bookTitle.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <AppShell>
      <div className="page-title-box">
        <div>
          <h1 className="page-title">
            <FileText size={28} style={{ color: 'var(--accent-primary)' }} />
            <span>ملاحظاتي الشخصية</span>
          </h1>
          <p className="page-subtitle">
            سجل أفكارك وتأملاتك المرتبطة بالصفحات والنصوص، وابحث فيها واسترجعها في أي وقت
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
          placeholder="ابحث في محتوى الملاحظات..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Notes List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          جاري تحميل الملاحظات...
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
          <FileText size={44} style={{ color: 'var(--text-muted)', margin: '0 auto 14px' }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>لا توجد ملاحظات مسجلة</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            أثناء قراءة أي كتاب، حدد نصاً واضغط «ملاحظة» لتدوين تعليقاتك وأفكارك
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '20px' }}>
          {filtered.map((note) => (
            <div
              key={note.id}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="item-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' }}>
                  صفحة {note.pageNumber}
                </span>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="btn-icon"
                    style={{ width: '34px', height: '34px' }}
                    onClick={() => {
                      setEditingNote(note);
                      setEditText(note.text);
                    }}
                    title="تعديل الملاحظة"
                  >
                    <Edit2 size={14} />
                  </button>

                  <button
                    className="btn-icon"
                    style={{ width: '34px', height: '34px', color: 'var(--danger)' }}
                    onClick={() => handleDelete(note.id)}
                    title="حذف الملاحظة"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600, wordBreak: 'break-word' }}>
                كتاب: {note.bookTitle}
              </div>

              {note.snippet && (
                <div
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--text-muted)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontStyle: 'italic',
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                  }}
                >
                  «{note.snippet}»
                </div>
              )}

              <div style={{ fontSize: '1rem', lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {note.text}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 'auto',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-color)',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {new Date(note.createdAt).toLocaleDateString('ar-EG')}
                </span>

                <Link
                  href={`/reader/${note.bookId}?page=${note.pageNumber}`}
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

      {/* Edit Note Modal */}
      {editingNote && (
        <div className="modal-overlay" onClick={() => setEditingNote(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">تعديل الملاحظة</h3>
              <button className="btn-icon" onClick={() => setEditingNote(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">نص الملاحظة</label>
                <textarea
                  className="form-textarea"
                  rows={5}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingNote(null)}>
                إلغاء
              </button>
              <button className="btn btn-primary" onClick={handleUpdateNote}>
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
