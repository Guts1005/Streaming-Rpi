'use client';
import React, { useEffect, useState } from 'react';
import DynamicTable, { ColumnDef } from './DynamicTable';
import DynamicForm from './DynamicForm';

const columns: ColumnDef[] = [
  { key: 'id', label: 'ID', type: 'int', hidden: true },
  { key: 'cnm', label: 'Company Name', type: 'varchar' },
  { key: 'company_name_on_bill', label: 'Name on Bill', type: 'varchar' },
  { key: 'company_address', label: 'Address', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'varchar' },
  { key: 'emails', label: 'Email', type: 'varchar' },
  { key: 'gst_number', label: 'GST Number', type: 'varchar' },
  { key: 'opening_bal', label: 'Opening Bal', type: 'bigint' },
  { key: 'csd', label: 'CSD', type: 'date', hidden: true },
  { key: 'ced', label: 'CED', type: 'date', hidden: true },
  { key: 'phone2', label: 'Phone 2', type: 'varchar', hidden: true },
  { key: 'SMS', label: 'SMS', type: 'varchar', hidden: true },
  { key: 'registration_no', label: 'Reg No', type: 'varchar', hidden: true },
  { key: 'service_tax_no', label: 'Service Tax No', type: 'varchar', hidden: true },
  { key: 'tin_no', label: 'TIN No', type: 'varchar', hidden: true },
  { key: 'cst_no', label: 'CST No', type: 'varchar', hidden: true },
  { key: 'voucher_adjust_date', label: 'Voucher Adj Date', type: 'date', hidden: true },
  { key: 'tdate', label: 'Created At', type: 'datetime', hidden: true }
];

export default function CompaniesScreen() {
  const [data, setData] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [search, setSearch] = useState('');

  const fetchData = async (query = '') => {
    const res = await fetch(`/api/mdm/companies${query ? `?search=${encodeURIComponent(query)}` : ''}`);
    const json = await res.json();
    if (json.success) setData(json.data);
  };

  useEffect(() => {
    fetchData(search);
  }, [search]);

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
    const res = await fetch(`/api/mdm/companies/${item.id}`, { method: 'DELETE' });
    if (res.ok) fetchData(search);
  };

  const handleSubmit = async (formData: any) => {
    const method = editingItem ? 'PUT' : 'POST';
    const url = editingItem ? `/api/mdm/companies/${editingItem.id}` : `/api/mdm/companies`;
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
    fetchData(search);
  };

  return (
    <div>
      <DynamicTable 
        title="Companies Master"
        columns={columns}
        data={data}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSearch={setSearch}
      />
      {showForm && (
        <DynamicForm 
          title={editingItem ? 'Edit Company' : 'Add Company'}
          columns={columns}
          initialData={editingItem}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
