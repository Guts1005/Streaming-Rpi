'use client';
import React, { useEffect, useState } from 'react';
import DynamicTable, { ColumnDef } from './DynamicTable';

const columns: ColumnDef[] = [
  { key: 'id', label: 'ID', type: 'int', hidden: true },
  { key: 'device_name', label: 'Device Name', type: 'varchar' },
  { key: 'device_id', label: 'Device ID', type: 'varchar' },
  { key: 'mac_id', label: 'MAC ID', type: 'varchar' },
  { key: 'site_name', label: 'Assigned Site', type: 'varchar' },
  { key: 'status', label: 'Status', type: 'varchar' }
];

export default function DevicesScreen({ currentUser, onClose }: { currentUser?: any, onClose?: () => void }) {
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<any>(null);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const fetchData = async () => {
    if (!currentUser?.company_id) return;
    try {
      const res = await fetch(`/api/mdm/devices?company_id=${currentUser.company_id}`);
      const json = await res.json();
      if (json.success) {
        // Map site_id to site_name for display
        const sitesMap: Record<string, string> = {};
        (currentUser.sites || []).forEach((s: any) => {
          sitesMap[s.id.toString()] = s.site_name;
        });

        const formattedData = json.data.map((d: any) => ({
          ...d,
          site_name: d.site_id ? (sitesMap[d.site_id.toString()] || `Site ${d.site_id}`) : 'Unassigned',
          status: 'N/A', // Status placeholder
        }));
        
        // Filter by search
        const filtered = search 
          ? formattedData.filter((d: any) => 
              (d.device_name || '').toLowerCase().includes(search.toLowerCase()) || 
              (d.device_id || '').toLowerCase().includes(search.toLowerCase())
            )
          : formattedData;
          
        setData(filtered);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, currentUser]);

  const handleEdit = (item: any) => {
    setEditingDevice(item);
    setSelectedSiteId(item.site_id ? item.site_id.toString() : '');
    setShowAssignModal(true);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleSaveAssignment = async () => {
    if (!selectedSiteId || selectedSiteId === '') {
      showToast('Please select a site.');
      return;
    }
    
    try {
      const res = await fetch('/api/mdm/devices/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: editingDevice.id, site_id: selectedSiteId })
      });
      const json = await res.json();
      if (json.success) {
        showToast('Device assigned successfully.');
        setShowAssignModal(false);
        fetchData();
        // Reload page to refresh sidebar sites and default devices if necessary
        setTimeout(() => window.location.reload(), 1000);
      } else {
        showToast(json.error || 'Failed to assign device.');
      }
    } catch (e) {
      showToast('Error assigning device.');
    }
  };

  return (
    <div className="mdm-screen">
      <DynamicTable 
        title="Device Master"
        columns={columns}
        data={data}
        onAdd={() => {}} // Not needed as we're not adding devices here
        onEdit={handleEdit}
        onDelete={() => {}} // Disable delete for now
        onSearch={setSearch}
        alignControlsLeft={true}
        onClose={onClose}
      />
      
      {showAssignModal && editingDevice && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '8px', width: '450px', maxWidth: '90%', border: '1px solid var(--border-color)', position: 'relative' }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px' }}>Assign Device to Site</h2>
            
            {toastMsg && (
              <div style={{ backgroundColor: '#22c55e', color: 'white', padding: '10px', borderRadius: '4px', marginBottom: '16px', textAlign: 'center' }}>
                {toastMsg}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Device Name</label>
              <input 
                type="text" 
                value={editingDevice.device_name || ''} 
                readOnly 
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'not-allowed' }}
              />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Device ID</label>
              <input 
                type="text" 
                value={editingDevice.device_id || ''} 
                readOnly 
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'not-allowed' }}
              />
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Site</label>
              <select 
                value={selectedSiteId} 
                onChange={(e) => setSelectedSiteId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
              >
                <option value="" disabled>Select Site</option>
                {(currentUser?.sites || []).map((s: any) => (
                  <option key={s.id} value={s.id.toString()}>{s.site_name}</option>
                ))}
              </select>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                onClick={() => setShowAssignModal(false)}
                style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveAssignment}
                style={{ background: 'var(--accent-blue)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
