'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterUser() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [ac, setAc] = useState('Site');
  const [showPassword, setShowPassword] = useState(false);
  
  const [companies, setCompanies] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await fetch('/api/mdm/companies');
        const data = await res.json();
        if (res.ok && data.success) {
          setCompanies(data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch companies', err);
      }
    };
    fetchCompanies();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username, 
          password, 
          company_name: companyName, 
          ac 
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess('User created successfully');
        setUsername('');
        setPassword('');
        setCompanyName('');
        setAc('Site');
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    }
    setLoading(false);
  };

  const inputStyle = { width: '100%', padding: '10px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', outline: 'none' };
  const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '13px', color: '#cbd5e1' };

  const EyeIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
  );

  const EyeOffIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', color: '#fff', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '32px', backgroundColor: '#1e293b', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img src="/aspire-logo.jpg" alt="Aspire Logo" style={{ height: '64px', width: 'auto', margin: '0 auto 16px', objectFit: 'contain' }} />
          <p style={{ margin: '8px 0 0', color: '#cbd5e1', fontSize: '18px', fontWeight: 500 }}>Create New User</p>
        </div>

        {error && <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '6px', marginBottom: '16px', fontSize: '14px', textAlign: 'center' }}>{error}</div>}
        {success && <div style={{ padding: '12px', backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22c55e', color: '#22c55e', borderRadius: '6px', marginBottom: '16px', fontSize: '14px', textAlign: 'center' }}>{success}</div>}

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required style={inputStyle} placeholder="Enter username" />
          </div>
          <div style={{ position: 'relative' }}>
            <label style={labelStyle}>Password</label>
            <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} placeholder="Enter password" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '34px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}>
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <label style={labelStyle}>Company</label>
            <input 
              type="text" 
              list="company-options" 
              value={companyName} 
              onChange={e => setCompanyName(e.target.value)} 
              required 
              style={inputStyle} 
              placeholder="Type or select company"
              autoComplete="off"
            />
            <datalist id="company-options">
              {companies.map(c => (
                <option key={c.id} value={c.cnm} />
              ))}
            </datalist>
          </div>
          <div>
            <label style={labelStyle}>User Type</label>
            <select value={ac} onChange={e => setAc(e.target.value)} required style={inputStyle}>
              <option value="Admin">Admin</option>
              <option value="Sports">Sports</option>
              <option value="Surveyor">Surveyor</option>
              <option value="Site">Site</option>
            </select>
          </div>
          <button type="submit" disabled={loading} style={{ marginTop: '8px', padding: '12px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Saving...' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  );
}
