'use client';

import React, { useState, useEffect } from 'react';

export default function CustomersView() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    customer_id: '', customer_name: '', company_name: '',
    mobile_number: '', email: '', address: '',
    city: '', state: '', country: '', device_id: '', status: 'active'
  });

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers?search=${search}&page=${page}`);
      const data = await res.json();
      if (res.ok) {
        setCustomers(data.customers || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, [search, page]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    fetchCustomers();
  };

  const handleEdit = (customer: any) => {
    setEditId(customer.id);
    setFormData(customer);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editId ? 'PUT' : 'POST';
    const url = editId ? `/api/customers/${editId}` : '/api/customers';
    
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    setShowModal(false);
    setEditId(null);
    setFormData({ customer_id: '', customer_name: '', company_name: '', mobile_number: '', email: '', address: '', city: '', state: '', country: '', device_id: '', status: 'active' });
    fetchCustomers();
  };

  return (
    <div className="panel" style={{ margin: '0 28px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 className="section-title" style={{ margin: 0 }}>Customer Management</h3>
        <button className="btn-primary" onClick={() => { setEditId(null); setShowModal(true); }}>
          + Add Customer
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <input 
          type="text" 
          placeholder="Search by name, company, or device ID..." 
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ width: '100%', maxWidth: '400px', padding: '10px 14px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
        />
      </div>

      {loading ? (
        <p>Loading customers...</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                <th style={{ padding: '12px 8px' }}>Customer ID</th>
                <th style={{ padding: '12px 8px' }}>Name</th>
                <th style={{ padding: '12px 8px' }}>Company</th>
                <th style={{ padding: '12px 8px' }}>Email</th>
                <th style={{ padding: '12px 8px' }}>Device ID</th>
                <th style={{ padding: '12px 8px' }}>Status</th>
                <th style={{ padding: '12px 8px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '12px 8px', color: '#fff' }}>{c.customer_id}</td>
                  <td style={{ padding: '12px 8px', color: '#fff' }}>{c.customer_name}</td>
                  <td style={{ padding: '12px 8px', color: '#fff' }}>{c.company_name}</td>
                  <td style={{ padding: '12px 8px', color: '#fff' }}>{c.email}</td>
                  <td style={{ padding: '12px 8px', color: '#60a5fa' }}>{c.device_id || 'Unassigned'}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '4px', background: c.status === 'active' ? '#064e3b' : '#7f1d1d', color: c.status === 'active' ? '#34d399' : '#f87171' }}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <button style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', marginRight: '8px' }} onClick={() => handleEdit(c)}>Edit</button>
                    <button style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }} onClick={() => handleDelete(c.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No customers found</td></tr>
              )}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', color: '#94a3b8', fontSize: '12px' }}>
            <span>Showing {customers.length} of {total}</span>
            <div>
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ marginRight: '8px', background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Prev</button>
              <button disabled={customers.length < 10} onClick={() => setPage(p => p + 1)} style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Next</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)} style={{ zIndex: 10000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '500px', maxWidth: '90%' }}>
            <div className="modal-header">
              <h3>{editId ? 'Edit Customer' : 'Add Customer'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input required placeholder="Customer ID" value={formData.customer_id} onChange={e => setFormData({...formData, customer_id: e.target.value})} disabled={!!editId} style={{ flex: 1, padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
                <input required placeholder="Device ID (Optional)" value={formData.device_id} onChange={e => setFormData({...formData, device_id: e.target.value})} style={{ flex: 1, padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
              </div>
              <input required placeholder="Customer Name" value={formData.customer_name} onChange={e => setFormData({...formData, customer_name: e.target.value})} style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
              <input required placeholder="Company Name" value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
              <div style={{ display: 'flex', gap: '12px' }}>
                <input required placeholder="Email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={{ flex: 1, padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
                <input required placeholder="Mobile" value={formData.mobile_number} onChange={e => setFormData({...formData, mobile_number: e.target.value})} style={{ flex: 1, padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
              </div>
              <input placeholder="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
              <div style={{ display: 'flex', gap: '12px' }}>
                <input placeholder="City" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} style={{ flex: 1, padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
                <input placeholder="State" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} style={{ flex: 1, padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input placeholder="Country" value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} style={{ flex: 1, padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} style={{ flex: 1, padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '8px', justifyContent: 'center' }}>Save Customer</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
