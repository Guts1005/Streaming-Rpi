'use client';
import React, { useEffect, useState } from 'react';
import DynamicTable, { ColumnDef } from './DynamicTable';
import DynamicForm from './DynamicForm';

const columns: ColumnDef[] = [
  { key: 'id', label: 'ID', type: 'int', hidden: true },
  { key: 'company_id', label: 'Company', type: 'int', hidden: true },
  { key: 'customer_id', label: 'Customer', type: 'int' },
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
  { key: 'customer_id', label: 'Customer', type: 'int' },
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
  { key: 'device_id', label: 'Device', type: 'varchar' }
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
  
  const [modalCompanyId, setModalCompanyId] = useState<string>('');

  const fetchCompanies = async () => {
    const res = await fetch('/api/mdm/companies');
    const json = await res.json();
    if (json.success) setCompanies(json.data);
  };

  const fetchCustomersForFilter = async () => {
    let url = '/api/mdm/customers?';
    if (currentUser?.account_type !== 'admin' && currentUser?.company_id) {
      url += `company_id=${currentUser.company_id}`;
    } else if (selectedCompany) {
      url += `company_id=${selectedCompany}`;
    }
    const res = await fetch(url);
    const json = await res.json();
    if (json.success) setCustomers(json.data);
  };

  const fetchData = async () => {
    let url = `/api/mdm/sites?`;
    if (search) url += `search=${encodeURIComponent(search)}&`;
    
    if (currentUser?.account_type !== 'admin' && currentUser?.company_id) {
      url += `company_id=${currentUser.company_id}&`;
    } else if (selectedCompany) {
      url += `company_id=${selectedCompany}&`;
    }
    
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
    let initialCompany = '';
    if (currentUser?.company_id) {
      initialCompany = currentUser.company_id.toString();
    }
    setModalCompanyId(initialCompany);
    setEditingItem({ actv: 'Y', company_id: initialCompany });
    setShowForm(true);
  };

  const handleEdit = (item: any) => {
    console.log('Opening Edit Site');
    console.log('Site ID:', item.id);
    console.log('Company ID:', item.company_id);
    console.log('Company Name:', item.company_name);
    console.log('Assigned Device ID:', item.device_id);
    // Find device name from currentUser.all_devices if possible
    const assignedDevice = currentUser?.all_devices?.find((d: any) => d.id.toString() === item.device_id?.toString());
    console.log('Assigned Device Name:', assignedDevice ? assignedDevice.device_name : 'N/A');

    const formattedItem = {
      ...item,
      company_id: item.company_id ? item.company_id.toString() : '',
      device_id: item.device_id ? item.device_id.toString() : ''
    };

    setModalCompanyId(formattedItem.company_id);
    setEditingItem(formattedItem);
    setShowForm(true);
  };

  const handleDelete = async (item: any) => {
    if (!confirm(`Are you sure you want to delete ${item.site_name}?`)) return;
    const res = await fetch(`/api/mdm/sites/${item.id}`, { method: 'DELETE' });
    if (res.ok) fetchData();
  };

  const handleSubmit = async (formData: any) => {
    const isEditing = !!editingItem?.id;
    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing ? `/api/mdm/sites/${editingItem.id}` : `/api/mdm/sites`;
    
    const payload = { ...formData };
    if (!isEditing) {
      if (payload.device_id !== undefined) delete payload.device_id;
      if (payload.customer_id !== undefined) delete payload.customer_id;
    }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const json = await res.json();
    if (json.success) {
      setShowForm(false);
      fetchData();
      if (formData.device_id) {
        setTimeout(() => window.location.reload(), 1000);
      }
    } else {
      throw new Error(json.error || 'Failed to save');
    }
  };

  const isAdmin = currentUser?.account_type === 'admin' || currentUser?.account_type === 'Admin' || currentUser?.ac === 'Admin' || currentUser?.ac === 'admin';
  let deviceOptions: any[] = [];
  if (currentUser?.all_devices) {
    deviceOptions = currentUser.all_devices
      .filter((d: any) => modalCompanyId ? d.company_id?.toString() === modalCompanyId : true)
      .map((d: any) => ({ label: d.device_name || `Device ${d.id}`, value: d.id.toString() }));
  }

  const optionsMap = {
    company_id: companies.map(c => ({ label: c.cnm, value: c.id.toString() })),
    customer_id: customers
      .filter((c: any) => modalCompanyId ? c.company_id?.toString() === modalCompanyId : true)
      .map(c => ({ label: c.cnm, value: c.id.toString() })),
    actv: [ { label: 'Yes', value: 'Y' }, { label: 'No', value: 'N' } ],
    device_id: deviceOptions
  };

  const dynamicFormColumns = formColumns.map(col => {
    if (col.key === 'company_id') {
      return { ...col, readonly: !editingItem?.id ? true : !isAdmin };
    }
    if (col.key === 'customer_id') {
      return { ...col, required: false };
    }
    return col;
  }).filter(col => {
    // Hide device_id and customer_id for Add Site
    if ((col.key === 'device_id' || col.key === 'customer_id') && !editingItem?.id) {
      return false;
    }
    return true;
  });

  return (
    <div className="mdm-screen">
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
            {customers
              .filter(c => selectedCompany ? c.company_id?.toString() === selectedCompany : true)
              .map(c => <option key={c.id} value={c.id}>{c.cnm}</option>)}
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
          title={editingItem?.id ? 'Edit Site' : 'Add Site'}
          columns={dynamicFormColumns}
          initialData={editingItem}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
          optionsMap={optionsMap}
          onFieldChange={(key, val) => {
            if (key === 'company_id') setModalCompanyId(val ? val.toString() : '');
          }}
        />
      )}
    </div>
  );
}
