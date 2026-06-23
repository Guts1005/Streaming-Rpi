'use client';
import React, { useEffect, useState } from 'react';
import DynamicTable, { ColumnDef } from './DynamicTable';
import DynamicForm from './DynamicForm';

const columns: ColumnDef[] = [
  { key: 'id', label: 'ID', type: 'int', hidden: true },
  { key: 'company_id', label: 'Company', type: 'int', hidden: true },
  { key: 'user_id', label: 'User ID', type: 'int', hidden: true },
  { key: 'company_name', label: 'Company Name', type: 'varchar' },
  { key: 'cnm', label: 'Customer Name', type: 'varchar' },
  { key: 'customer_name_on_bill', label: 'Name on Bill', type: 'varchar' },
  { key: 'customer_address', label: 'Address', type: 'text' },
  { key: 'mobileno', label: 'Mobile No', type: 'varchar' },
  { key: 'emails', label: 'Email', type: 'varchar' },
  { key: 'gst_no', label: 'GST No', type: 'varchar' },
  { key: 'opening_bal', label: 'Opening Bal', type: 'int' },
  { key: 'actv', label: 'Active', type: 'varchar' },
  { key: 'csd', label: 'CSD', type: 'date', hidden: true },
  { key: 'ced', label: 'CED', type: 'date', hidden: true },
  { key: 'tdate', label: 'Created At', type: 'datetime', hidden: true }
];

const formColumns: ColumnDef[] = [
  { key: 'id', label: 'ID', type: 'int', hidden: true },
  { key: 'company_id', label: 'Company', type: 'int' },
  { key: 'user_id', label: 'User ID', type: 'int' },
  { key: 'cnm', label: 'Customer Name', type: 'varchar' },
  { key: 'customer_name_on_bill', label: 'Name on Bill', type: 'varchar' },
  { key: 'customer_address', label: 'Address', type: 'text' },
  { key: 'mobileno', label: 'Mobile No', type: 'varchar' },
  { key: 'emails', label: 'Email', type: 'varchar' },
  { key: 'gst_no', label: 'GST No', type: 'varchar' },
  { key: 'opening_bal', label: 'Opening Bal', type: 'int' },
  { key: 'actv', label: 'Active', type: 'varchar' },
  { key: 'csd', label: 'CSD', type: 'date' },
  { key: 'ced', label: 'CED', type: 'date' }
];

export default function CustomersScreen() {
  const [data, setData] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');

  const fetchCompanies = async () => {
    const res = await fetch('/api/mdm/companies');
    const json = await res.json();
    if (json.success) setCompanies(json.data);
  };

  const fetchData = async () => {
    let url = `/api/mdm/customers?`;
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (selectedCompany) url += `company_id=${selectedCompany}&`;
    
    const res = await fetch(url);
    const json = await res.json();
    if (json.success) setData(json.data);
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    fetchData();
  }, [search, selectedCompany]);

  const handleAdd = () => {
    setEditingItem(null);
    setShowForm(true);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleDelete = async (item: any) => {
    if (!confirm(`Are you sure you want to delete ${item.cnm}?`)) return;
    const res = await fetch(`/api/mdm/customers/${item.id}`, { method: 'DELETE' });
    if (res.ok) fetchData();
  };

  const handleSubmit = async (formData: any) => {
    const method = editingItem ? 'PUT' : 'POST';
    const url = editingItem ? `/api/mdm/customers/${editingItem.id}` : `/api/mdm/customers`;
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save');
    }
    
    setShowForm(false);
    fetchData();
  };

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Filter by Company:</label>
        <select 
          value={selectedCompany} 
          onChange={e => setSelectedCompany(e.target.value)}
          style={{ padding: '8px 12px', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
        >
          <option value="">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.cnm}</option>)}
        </select>
      </div>

      <DynamicTable 
        title="Customers Master"
        columns={columns}
        data={data}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSearch={setSearch}
      />
      
      {showForm && (
        <DynamicForm 
          title={editingItem ? 'Edit Customer' : 'Add Customer'}
          columns={formColumns}
          initialData={editingItem}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
          optionsMap={{
            company_id: companies.map(c => ({ label: c.cnm, value: c.id }))
          }}
        />
      )}
    </div>
  );
}
