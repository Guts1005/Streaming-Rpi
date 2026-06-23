'use client';
import React, { useState, useEffect } from 'react';
import { ColumnDef } from './DynamicTable';
import FormFieldRenderer from './FormFieldRenderer';

interface DynamicFormProps {
  columns: ColumnDef[];
  initialData?: any;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  title: string;
  optionsMap?: Record<string, { label: string; value: string | number }[]>;
}

export default function DynamicForm({ columns, initialData, onSubmit, onCancel, title, optionsMap = {} }: DynamicFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({});
    }
  }, [initialData]);

  const handleChange = (key: string, val: any) => {
    setFormData(prev => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSubmit(formData);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const visibleColumns = columns.filter(c => !c.hidden && c.key !== 'id' && c.key !== 'created_at' && c.key !== 'updated_at');

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: 'var(--bg-panel)', width: '100%', maxWidth: '500px', borderRadius: 'var(--radius-lg)', 
        boxShadow: '0 24px 80px rgba(0, 0, 0, 0.4)', padding: '24px', border: '1px solid var(--border-color)',
        maxHeight: '90vh', overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h2>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '24px', lineHeight: 1 }}>&times;</button>
        </div>

        {error && <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--status-live)', color: 'var(--status-live)', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {visibleColumns.map(col => (
            <FormFieldRenderer 
              key={col.key} 
              column={col} 
              value={formData[col.key]} 
              onChange={handleChange}
              options={optionsMap[col.key]}
            />
          ))}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button type="button" onClick={onCancel} style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 500 }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={{ padding: '10px 16px', background: 'var(--accent-blue)', border: 'none', color: '#fff', borderRadius: 'var(--radius-sm)', cursor: loading ? 'wait' : 'pointer', fontWeight: 500 }}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
