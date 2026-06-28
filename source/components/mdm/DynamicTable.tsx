'use client';
import React, { useState } from 'react';

export interface ColumnDef {
  key: string;
  label: string;
  type?: 'text' | 'varchar' | 'int' | 'bigint' | 'date' | 'datetime';
  hidden?: boolean;
}

interface DynamicTableProps {
  columns: ColumnDef[];
  data: any[];
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
  onAdd: () => void;
  onSearch: (query: string) => void;
  title: string;
  alignControlsLeft?: boolean;
  onClose?: () => void;
}

export default function DynamicTable({ columns, data, onEdit, onDelete, onAdd, onSearch, title, alignControlsLeft, onClose }: DynamicTableProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    onSearch(e.target.value);
    setPage(1);
  };

  const visibleColumns = columns.filter(c => !c.hidden && c.key !== 'id' && c.key !== 'created_at' && c.key !== 'updated_at');

  const startIndex = (page - 1) * itemsPerPage;
  const paginatedData = data.slice(startIndex, startIndex + itemsPerPage);
  const totalPages = Math.ceil(data.length / itemsPerPage);

  return (
    <div style={{ padding: '20px', background: 'var(--bg-panel)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{title}</h2>
          {onClose && (
            <button 
              onClick={onClose}
              style={{ 
                background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', 
                padding: '8px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: '6px'
              }}>
              ✕ Close
            </button>
          )}
        </div>
        <div style={{ 
          display: 'flex', 
          justifyContent: alignControlsLeft ? 'flex-start' : 'space-between',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="Search..." 
              value={search} 
              onChange={handleSearch}
              style={{ 
                padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', 
                background: 'var(--bg-input)', color: 'var(--text-primary)' 
              }}
            />
            <button 
              onClick={onAdd}
              style={{ 
                background: 'var(--accent-blue)', color: '#fff', border: 'none', 
                padding: '8px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 500
              }}>
              Add New
            </button>
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              {visibleColumns.map(col => (
                <th key={col.key} style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600 }}>{col.label}</th>
              ))}
              <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, width: '100px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr><td colSpan={visibleColumns.length + 1} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No records found.</td></tr>
            ) : paginatedData.map(row => (
              <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                {visibleColumns.map(col => (
                  <td key={col.key} style={{ padding: '12px 16px', fontSize: '14px' }}>
                    {row[col.key] || '-'}
                  </td>
                ))}
                <td style={{ padding: '12px 16px' }}>
                  <button onClick={() => onEdit(row)} style={{ background: 'transparent', color: 'var(--status-cyan)', border: 'none', cursor: 'pointer', marginRight: '10px', fontSize: '13px' }}>Edit</button>
                  <button onClick={() => onDelete(row)} style={{ background: 'transparent', color: 'var(--status-live)', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        <span>Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, data.length)} of {data.length} entries</span>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button 
            disabled={page === 1} 
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>
            Prev
          </button>
          <button 
            disabled={page >= totalPages || totalPages === 0} 
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
