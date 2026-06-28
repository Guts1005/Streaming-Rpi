import React from 'react';
import { ColumnDef } from './DynamicTable';

interface FormFieldRendererProps {
  column: ColumnDef;
  value: any;
  onChange: (key: string, val: any) => void;
  options?: { label: string; value: string | number }[]; // For dropdowns like company_id, customer_id
}

export default function FormFieldRenderer({ column, value, onChange, options }: FormFieldRendererProps) {
  const commonStyle = {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    marginTop: '6px'
  };

  // If options are provided, render a select dropdown
  if (options) {
    return (
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>{column.label}</label>
        <select 
          style={{ ...commonStyle, opacity: column.readonly ? 0.6 : 1, cursor: column.readonly ? 'not-allowed' : 'pointer' }} 
          value={value || ''} 
          onChange={e => { if (!column.readonly) onChange(column.key, e.target.value); }}
          disabled={column.readonly}
        >
          <option value="">Select {column.label}</option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  }

  const renderInput = () => {
    switch (column.type) {
      case 'text':
        return <textarea style={{ ...commonStyle, minHeight: '80px', resize: 'vertical' }} value={value || ''} onChange={e => onChange(column.key, e.target.value)} />;
      case 'int':
      case 'bigint':
        return <input type="number" style={commonStyle} value={value || ''} onChange={e => onChange(column.key, e.target.value)} />;
      case 'date':
        return <input type="date" style={commonStyle} value={value || ''} onChange={e => onChange(column.key, e.target.value)} />;
      case 'datetime':
        return <input type="datetime-local" style={commonStyle} value={value || ''} onChange={e => onChange(column.key, e.target.value)} />;
      case 'varchar':
      default:
        return <input type="text" style={commonStyle} value={value || ''} onChange={e => onChange(column.key, e.target.value)} />;
    }
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>{column.label}</label>
      {renderInput()}
    </div>
  );
}
