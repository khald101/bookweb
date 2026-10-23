'use client';

import React, { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import {
  Palette,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Highlighter,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface HighlightCategory {
  id: string;
  name: string;
  colorHex: string;
  description?: string;
  isDefault?: boolean;
  usageCount?: number;
  createdAt: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<HighlightCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('#EF4444');
  const [catDesc, setCatDesc] = useState('');

  // Delete modal
  const [deletingCat, setDeletingCat] = useState<HighlightCategory | null>(null);
  const [reassignTarget, setReassignTarget] = useState<string>('');

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setCatName('');
    setCatColor('#3B82F6');
    setCatDesc('');
    setModalOpen(true);
  };

  const handleOpenEdit = (cat: HighlightCategory) => {
    setEditingId(cat.id);
    setCatName(cat.name);
    setCatColor(cat.colorHex);
    setCatDesc(cat.description || '');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!catName.trim()) return;

    try {
      if (editingId) {
        // Update
        const res = await fetch(`/api/categories/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: catName.trim(),
            colorHex: catColor,
            description: catDesc.trim(),
          }),
        });
        const data = await res.json();
        if (data.success) {
          setModalOpen(false);
          fetchCategories();
        }
      } else {
        // Create
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: catName.trim(),
            colorHex: catColor,
            description: catDesc.trim(),
          }),
        });
        const data = await res.json();
        if (data.success) {
          setModalOpen(false);
          fetchCategories();
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!deletingCat) return;

    try {
      const url = `/api/categories/${deletingCat.id}?reassignTo=${encodeURIComponent(reassignTarget)}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setDeletingCat(null);
        fetchCategories();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AppShell>
      <div className="page-title-box">
        <div>
          <h1 className="page-title">
            <Palette size={28} style={{ color: 'var(--accent-primary)' }} />
            <span>نظام التظليل والألوان المخصصة</span>
          </h1>
          <p className="page-subtitle">
            أنشئ تصنيفاتك وألوانك الخاصة بحرية تامة وسمّها بحسب معناها، مثل «معلومات مهمة»، «معلومات دينية»، «معلومات تاريخية»
          </p>
        </div>

        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={16} />
          <span>إضافة تصنيف جديد</span>
        </button>
      </div>

      {/* Info Card */}
      <div
        style={{
          background: 'var(--bg-glass)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          fontSize: '0.88rem',
          lineHeight: 1.6,
          color: 'var(--text-secondary)',
        }}
      >
        <Highlighter size={24} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
        <div>
          <strong>قاعدة الحفظ المتقدم:</strong> ترتبط التظليلات بمعرّف التصنيف وليس برمز اللون وحده. إذا قمت بتغيير لون أو اسم تصنيف «معلومات دينية» مستقبلاً، فستتحدث كافة التظليلات المرتبطة به في جميع كتبك تلقائياً دون فقدان أي بيانات.
        </div>
      </div>

      {/* Categories Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
          gap: '16px',
        }}
      >
        {categories.map((cat) => (
          <div
            key={cat.id}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRight: `6px solid ${cat.colorHex}`,
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: cat.colorHex,
                    display: 'inline-block',
                    boxShadow: `0 0 10px ${cat.colorHex}66`,
                  }}
                />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {cat.name}
                </h3>
              </div>

              <span
                className="item-badge"
                style={{
                  backgroundColor: `${cat.colorHex}20`,
                  color: cat.colorHex,
                  border: `1px solid ${cat.colorHex}50`,
                }}
              >
                {cat.usageCount || 0} تظليل
              </span>
            </div>

            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', minHeight: '38px', lineHeight: 1.6 }}>
              {cat.description || 'لا يوجد وصف محدد لهذا التصنيف'}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>رمز اللون: <strong style={{ color: 'var(--text-primary)' }}>{cat.colorHex}</strong></span>
            </div>

            {/* Actions */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '8px',
                marginTop: 'auto',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-color)',
              }}
            >
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={() => handleOpenEdit(cat)}
              >
                <Edit2 size={13} />
                <span>تعديل</span>
              </button>

              <button
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--danger)' }}
                onClick={() => {
                  setDeletingCat(cat);
                  // Find a default alternative
                  const other = categories.find((c) => c.id !== cat.id);
                  setReassignTarget(other ? other.id : '');
                }}
              >
                <Trash2 size={13} />
                <span>حذف</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Category Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingId ? 'تعديل تصنيف التظليل' : 'إنشاء تصنيف تظليل جديد'}
              </h3>
              <button className="btn-icon" onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">اسم التصنيف (المعنى الدلالي)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: معلومات دينية، تاريخ الحضارات، قواعد لغوية، اقتباسات..."
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">اختيار اللون</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="color"
                      value={catColor}
                      onChange={(e) => setCatColor(e.target.value)}
                      style={{
                        width: '48px',
                        height: '48px',
                        padding: '2px',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        cursor: 'pointer',
                        background: 'transparent',
                        flexShrink: 0,
                      }}
                    />
                    <input
                      type="text"
                      className="form-input"
                      style={{ width: '110px' }}
                      value={catColor}
                      onChange={(e) => setCatColor(e.target.value)}
                    />
                  </div>

                  {/* Preset Quick Swatches */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {['#EF4444', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#F97316', '#EC4899', '#14B8A6'].map(
                      (hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => setCatColor(hex)}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: hex,
                            border: catColor === hex ? '2.5px solid #fff' : 'none',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        />
                      )
                    )}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">معاينة التظليل كما سيظهر في الكتاب</label>
                <div
                  style={{
                    padding: '12px 18px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-primary)',
                    fontSize: '1rem',
                    lineHeight: 1.8,
                  }}
                >
                  نص عادي من الكتاب و{' '}
                  <mark
                    style={{
                      backgroundColor: `${catColor}33`,
                      borderBottom: `2.5px solid ${catColor}`,
                      color: 'inherit',
                      padding: '2px 6px',
                      borderRadius: '3px',
                    }}
                  >
                    هذا مثال على النص المظلل بتصنيف «{catName || 'التصنيف'}»
                  </mark>{' '}
                  ثم يستمر النص بصورة طبيعية.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">الوصف أو الغرض من الاستخدام (اختياري)</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="اكتب المعنى أو الغرض الذي تستخدم هذا التصنيف من أجله..."
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                إلغاء
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editingId ? 'حفظ التعديلات' : 'إنشاء التصنيف'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation with Reassignment Modal */}
      {deletingCat && (
        <div className="modal-overlay" onClick={() => setDeletingCat(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} />
                <span>حذف تصنيف التظليل</span>
              </h3>
              <button className="btn-icon" onClick={() => setDeletingCat(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ lineHeight: 1.6 }}>
                أنت على وشك حذف تصنيف: <strong>«{deletingCat.name}»</strong> الذي يحتوي على <strong>{deletingCat.usageCount || 0}</strong> تظليل.
              </p>

              {(deletingCat.usageCount || 0) > 0 && (
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">
                    لحماية تظليلاتك من الحذف الصامت، اختر تصنيفاً لنقل التظليلات السابقة إليه:
                  </label>
                  <select
                    className="form-select"
                    value={reassignTarget}
                    onChange={(e) => setReassignTarget(e.target.value)}
                  >
                    {categories
                      .filter((c) => c.id !== deletingCat.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.colorHex})
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeletingCat(null)}>
                إلغاء
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                تأكيد الحذف وإعادة التعيين
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
