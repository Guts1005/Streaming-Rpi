'use client';
import React, { useEffect, useState } from 'react';
import DynamicTable, { ColumnDef } from './DynamicTable';
import DynamicForm from './DynamicForm';

const columns: ColumnDef[] = [
  { key: 'id', label: 'ID', type: 'int', hidden: true },
  { key: 'company_id', label: 'Company', type: 'int', hidden: true },
  { key: 'customer_id', label: 'Customer', type: 'int', hidden: true },
  { key: 'user_id', label: 'User ID', type: 'int', hidden: true },
  { key: 'company_name', label: 'Company Name', type: 'varchar' },
  { key: 'customer_name', label: 'Customer Name', type: 'varchar' },
  { key: 'site_name', label: 'Site Name', type: 'varchar' },
  { key: 'address', label: 'Address', type: 'text' },
  { key: 'device_id', label: 'Device ID', type: 'varchar' },
  { key: 'actv', label: 'Active', type: 'varchar' },
  { key: 'dlvry_address', label: 'Delivery Address', type: 'text', hidden: true },
  { key: 'client_mail', label: 'Client Mail', type: 'varchar', hidden: true },
  { key: 'contact_person1', label: 'Contact 1', type: 'varchar', hidden: true },
  { key: 'contact_person1_mobile', label: 'Contact 1 Mobile', type: 'varchar', hidden: true },
  { key: 'contact_person1_mail', label: 'Contact 1 Mail', type: 'varchar', hidden: true },
  { key: 'contact_person2', label: 'Contact 2', type: 'varchar', hidden: true },
  { key: 'contact_person2_mobile', label: 'Contact 2 Mobile', type: 'varchar', hidden: true },
  { key: 'contact_person2_mail', label: 'Contact 2 Mail', type: 'varchar', hidden: true },
  { key: 'boq_amount', label: 'BOQ Amount', type: 'varchar', hidden: true },
  { key: 'pmc', label: 'PMC', type: 'varchar', hidden: true },
  { key: 'from_date', label: 'From Date', type: 'date', hidden: true },
  { key: 'end_date', label: 'End Date', type: 'date', hidden: true },
  { key: 'HOD', label: 'HOD', type: 'date', hidden: true },
  { key: 'fl', label: 'FL', type: 'text', hidden: true },
  { key: 'company_logo', label: 'Company Logo', type: 'text', hidden: true },
  { key: 'PMC_logo', label: 'PMC Logo', type: 'text', hidden: true },
  { key: 'our_logo', label: 'Our Logo', type: 'text', hidden: true },
  { key: 'graph', label: 'Graph', type: 'varchar', hidden: true },
  { key: 'max_permissible_indents', label: 'Max Indents', type: 'int', hidden: true },
  { key: 'boq_added', label: 'BOQ Added', type: 'varchar', hidden: true },
  { key: 'sft', label: 'SFT', type: 'varchar', hidden: true },
  { key: 'purchase_sft', label: 'Purchase SFT', type: 'varchar', hidden: true },
  { key: 'internal', label: 'Internal', type: 'varchar', hidden: true },
  { key: 'ongoing', label: 'Ongoing', type: 'varchar', hidden: true },
  { key: 'sft_block', label: 'SFT Block', type: 'varchar', hidden: true },
  { key: 'feedback', label: 'Feedback', type: 'varchar', hidden: true },
  { key: 'tdate', label: 'Created At', type: 'datetime', hidden: true },
  { key: 'udate', label: 'Updated At', type: 'datetime', hidden: true }
];

const formColumns: ColumnDef[] = [
  { key: 'id', label: 'ID', type: 'int', hidden: true },
  { key: 'company_id', label: 'Company', type: 'int' },
  { key: 'customer_id', label: 'Customer', type: 'int', hidden: true },
  { key: 'user_id', label: 'User ID', type: 'int', hidden: true },
  { key: 'site_name', label: 'Site Name', type: 'varchar' },
  { key: 'address', label: 'Address', type: 'text', hidden: true },
  { key: 'dlvry_address', label: 'Delivery Address', type: 'text', hidden: true },
  { key: 'client_mail', label: 'Client Mail', type: 'varchar', hidden: true },
  { key: 'contact_person1', label: 'Contact Person 1', type: 'varchar', hidden: true },
  { key: 'contact_person1_mobile', label: 'Contact 1 Mobile', type: 'varchar', hidden: true },
  { key: 'contact_person1_mail', label: 'Contact 1 Email', type: 'varchar', hidden: true },
  { key: 'contact_person2', label: 'Contact Person 2', type: 'varchar', hidden: true },
  { key: 'contact_person2_mobile', label: 'Contact 2 Mobile', type: 'varchar', hidden: true },
  { key: 'contact_person2_mail', label: 'Contact 2 Email', type: 'varchar', hidden: true },
  { key: 'actv', label: 'Active', type: 'varchar' },
  { key: 'boq_amount', label: 'BOQ Amount', type: 'varchar', hidden: true },
  { key: 'pmc', label: 'PMC', type: 'varchar', hidden: true },
  { key: 'from_date', label: 'From Date', type: 'date', hidden: true },
  { key: 'end_date', label: 'End Date', type: 'date', hidden: true },
  { key: 'HOD', label: 'HOD Date', type: 'date', hidden: true },
  { key: 'fl', label: 'FL', type: 'text', hidden: true },
  { key: 'company_logo', label: 'Company Logo URL', type: 'text', hidden: true },
  { key: 'PMC_logo', label: 'PMC Logo URL', type: 'text', hidden: true },
  { key: 'our_logo', label: 'Our Logo URL', type: 'text', hidden: true },
  { key: 'graph', label: 'Graph', type: 'varchar', hidden: true },
  { key: 'max_permissible_indents', label: 'Max Permissible Indents', type: 'int', hidden: true },
  { key: 'boq_added', label: 'BOQ Added', type: 'varchar', hidden: true },
  { key: 'sft', label: 'SFT', type: 'varchar', hidden: true },
  { key: 'purchase_sft', label: 'Purchase SFT', type: 'varchar', hidden: true },
  { key: 'internal', label: 'Internal', type: 'varchar', hidden: true },
  { key: 'ongoing', label: 'Ongoing', type: 'varchar', hidden: true },
  { key: 'sft_block', label: 'SFT Block', type: 'varchar', hidden: true },
  { key: 'feedback', label: 'Feedback', type: 'varchar', hidden: true },
  { key: 'device_id', label: 'Device ID', type: 'varchar', hidden: true }
];

export default function SitesScreen({ currentUser, onClose }: { currentUser?: any, onClose?: () => void }) {
  const [data, setData] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');

  const fetchCompanies = async () => {
    const res = await fetch('/api/mdm/companies');
    const json = await res.json();
    if (json.success) setCompanies(json.data);
  };

  const fetchCustomersForFilter = async () => {
    let url = '/api/mdm/customers';
    if (selectedCompany) url += `?company_id=${selectedCompany}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.success) setCustomers(json.data);
  };

  const fetchData = async () => {
    let url = `/api/mdm/sites?`;
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (selectedCompany) url += `company_id=${selectedCompany}&`;
    if (selectedCustomer) url += `customer_id=${selectedCustomer}&`;
    
    const res = await fetch(url);
    const json = await res.json();
    if (json.success) setData(json.data);
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    fetchCustomersForFilter();
    setSelectedCustomer('');
  }, [selectedCompany]);

  useEffect(() => {
    fetchData();
  }, [search, selectedCompany, selectedCustomer]);

  const handleAdd = () => {
    setEditingItem(null);
    setShowForm(true);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleDelete = async (item: any) => {
    if (!confirm(`Are you sure you want to delete ${item.site_name}?`)) return;
    const res = await fetch(`/api/mdm/sites/${item.id}`, { method: 'DELETE' });
    if (res.ok) fetchData();
  };

  const handleSubmit = async (formData: any) => {
    const method = editingItem ? 'PUT' : 'POST';
    const url = editingItem ? `/api/mdm/sites/${editingItem.id}` : `/api/mdm/sites`;
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

  const isAdmin = currentUser?.account_type === 'admin';

  return (
    <div>
      {isAdmin && (
        <div style={{ marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Filter:</label>
          <select 
            value={selectedCompany} 
            onChange={e => setSelectedCompany(e.target.value)}
            style={{ padding: '8px 12px', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
          >
            <option value="">All Companies</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.cnm}</option>)}
          </select>
          
          <select 
            value={selectedCustomer} 
            onChange={e => setSelectedCustomer(e.target.value)}
            style={{ padding: '8px 12px', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
          >
            <option value="">All Customers</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.cnm}</option>)}
          </select>
        </div>
      )}

      <DynamicTable 
        title="Sites Master"
        columns={columns}
        data={data}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSearch={setSearch}
        alignControlsLeft={!isAdmin}
        onClose={onClose}
      />
      
      {showForm && (
        <DynamicForm 
          title={editingItem ? 'Edit Site' : 'Add Site'}
          columns={formColumns}
          initialData={editingItem}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
          optionsMap={{
            company_id: companies.map(c => ({ label: c.cnm, value: c.id })),
            customer_id: customers.map(c => ({ label: c.cnm, value: c.id }))
          }}
        />
      )}
    </div>
  );
}
