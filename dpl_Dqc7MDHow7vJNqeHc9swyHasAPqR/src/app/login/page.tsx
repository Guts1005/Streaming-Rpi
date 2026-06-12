'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, company_id: companyId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        router.push('/');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '32px', backgroundColor: '#1e293b', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <svg viewBox="0 0 40 40" style={{ width: '48px', height: '48px', margin: '0 auto 16px' }} fill="none">
            <circle cx="20" cy="20" r="18" stroke="#fff" strokeWidth="2" fill="none"/>
            <path d="M12 20c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <path d="M14 25h12" stroke="#06B6D4" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Smart Helmet</h1>
          <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: '14px' }}>Sign in to your account</p>
        </div>

        {error && <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '6px', marginBottom: '16px', fontSize: '14px', textAlign: 'center' }}>{error}</div>}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#cbd5e1' }}>Company ID</label>
            <input type="text" value={companyId} onChange={e => setCompanyId(e.target.value)} required style={{ width: '100%', padding: '10px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', outline: 'none' }} placeholder="Enter Company ID" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#cbd5e1' }}>Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required style={{ width: '100%', padding: '10px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', outline: 'none' }} placeholder="Enter username" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#cbd5e1' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '10px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', outline: 'none' }} placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} style={{ marginTop: '8px', padding: '12px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
