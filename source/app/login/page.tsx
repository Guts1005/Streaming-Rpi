'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = localStorage.getItem('savedAccounts');
      if (stored) setSavedAccounts(JSON.parse(stored));
    } catch(e) {}
  }, []);

  const handleQuickLogin = async (token: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/switch-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      if (res.ok) {
        window.location.href = '/dashboard';
      } else {
        setError('Saved session expired, please log in again.');
      }
    } catch(err: any) {
      setError(err.message || 'Network error');
    }
    setLoading(false);
  };

  const handleRemoveAccount = (id: number) => {
    const updated = savedAccounts.filter(a => a.id !== id);
    setSavedAccounts(updated);
    localStorage.setItem('savedAccounts', JSON.stringify(updated));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.token && data.user) {
          const savedAccounts = JSON.parse(localStorage.getItem('savedAccounts') || '[]');
          const existingIndex = savedAccounts.findIndex((a: any) => a.id === data.user.id);
          const newAccount = { ...data.user, token: data.token };
          if (existingIndex >= 0) {
            savedAccounts[existingIndex] = newAccount;
          } else {
            savedAccounts.push(newAccount);
          }
          localStorage.setItem('savedAccounts', JSON.stringify(savedAccounts));
        }
        const role = data.user.ac;
        const roleKey = data.user.ac.toLowerCase();
        const dashboardMap: Record<string, string> = {
          surveyor: "/survey-dashboard",
          survey: "/survey-dashboard",
          sports: "/sports-dashboard",
          site: "/dashboard",
          admin: "/admin-dashboard"
        };
        window.location.href = dashboardMap[roleKey] || '/dashboard';
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '32px', backgroundColor: '#1e293b', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '2.5/1', margin: '0 auto 16px', borderRadius: '6px', overflow: 'hidden' }}>
            <img src="/aspire-logo.jpg" alt="Aspire Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
          </div>
          <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: '14px' }}>Sign in to your account</p>
        </div>

        {error && <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '6px', marginBottom: '16px', fontSize: '14px', textAlign: 'center' }}>{error}</div>}

        {savedAccounts.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {savedAccounts.map(acc => (
                <div key={acc.id} style={{ display: 'flex', alignItems: 'center', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '12px' }}>
                  <div 
                    onClick={() => handleQuickLogin(acc.token)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                  >
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
                      {acc.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#f8fafc' }}>{acc.username}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{acc.company_name || acc.ac}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleRemoveAccount(acc.id)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '8px' }}
                    title="Remove Account"
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#334155' }}></div>
              <div style={{ padding: '0 12px', color: '#94a3b8', fontSize: '12px' }}>OR LOG IN WITH PASSWORD</div>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#334155' }}></div>
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
          
          <p style={{ textAlign: 'center', marginTop: '8px', color: '#94a3b8', fontSize: '14px' }}>
            Don't have an account? <a href="/register" style={{ color: '#3b82f6', textDecoration: 'none' }}>Sign up</a>
          </p>
        </form>
      </div>
    </div>
  );
}
