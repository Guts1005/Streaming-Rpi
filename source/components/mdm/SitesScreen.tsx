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

function DeviceAssignModal({ currentUser, onClose }: { currentUser: any, onClose: () => void }) {
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedSites, setSelectedSites] = useState<Record<string, string>>({});
  const [toastMsg, setToastMsg] = useState('');

  const fetchDevices = async () => {
    if (!currentUser?.company_id) return;
    const res = await fetch(`/api/mdm/devices?company_id=${currentUser.company_id}`);
    const json = await res.json();
    if (json.success) {
      setDevices(json.data);
      const initialSites: Record<string, string> = {};
      json.data.forEach((d: any) => {
        initialSites[d.id] = d.site_id ? d.site_id.toString() : '';
      });
      setSelectedSites(initialSites);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [currentUser]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleSave = async (device: any) => {
    const siteId = selectedSites[device.id];
    if (!siteId || siteId === '') {
      showToast('Please select a site.');
      return;
    }
    
    try {
      const res = await fetch('/api/mdm/devices/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: device.id, site_id: siteId })
      });
      const json = await res.json();
      if (json.success) {
        showToast('Device assigned successfully.');
        fetchDevices();
      } else {
        showToast(json.error || 'Failed to assign device.');
      }
    } catch (e) {
      showToast('Error assigning device.');
    }
  };

  const sites = currentUser?.sites || [];

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '8px', width: '600px', maxWidth: '90%', border: '1px solid var(--border-color)', position: 'relative' }}>
        <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px' }}>Assign Device to Site</h2>
        
        {toastMsg && (
          <div style={{ backgroundColor: '#22c55e', color: 'white', padding: '10px', borderRadius: '4px', marginBottom: '16px', textAlign: 'center' }}>
            {toastMsg}
          </div>
        )}

        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '8px' }}>Device</th>
                <th style={{ padding: '8px' }}>Site</th>
                <th style={{ padding: '8px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {devices.map(d => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 8px' }}>{d.device_name || d.device_id}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <select 
                      value={selectedSites[d.id] || ''} 
                      onChange={(e) => setSelectedSites({...selectedSites, [d.id]: e.target.value})}
                      style={{ padding: '6px', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', width: '100%' }}
                    >
                      <option value="" disabled>Select Site</option>
                      {sites.map((s: any) => <option key={s.id} value={s.id.toString()}>{s.site_name}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <button 
                      onClick={() => handleSave(d)}
                      style={{ background: 'var(--accent-blue)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Save
                    </button>
                  </td>
                </tr>
              ))}
              {devices.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '20px' }}>No devices found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            onClick={onClose}
            style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SitesScreen({ currentUser, onClose }: { currentUser?: any, onClose?: () => void }) {
  const [data, setData] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  
  const [showForm, setShowForm] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
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
    const method = editingItem ? 'PUT' : 'POST';
    const url = editingItem ? `/api/mdm/sites/${editingItem.id}` : `/api/mdm/sites`;
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
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
      return { ...col, readonly: !isAdmin };
    }
    return col;
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
        onDeviceClick={() => setShowDeviceModal(true)}
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

      {showDeviceModal && (
        <DeviceAssignModal 
          currentUser={currentUser} 
          onClose={() => setShowDeviceModal(false)} 
        />
      )}
    </div>
  );
}
