'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

export default function ConsumerRegister() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [ssid, setSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // The generated pairing string after successful registration
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Create user account, using their username as their isolated Company
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username, 
          password, 
          company_name: username + "'s Home", 
          ac: 'Admin'
        }),
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        // Automatically login the user
        const loginRes = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const loginData = await loginRes.json();
        
        if (loginRes.ok && loginData.success && loginData.token && loginData.user) {
          const savedAccounts = JSON.parse(localStorage.getItem('savedAccounts') || '[]');
          const existingIndex = savedAccounts.findIndex((a: any) => a.id === loginData.user.id);
          const newAccount = { ...loginData.user, token: loginData.token };
          if (existingIndex >= 0) {
            savedAccounts[existingIndex] = newAccount;
          } else {
            savedAccounts.push(newAccount);
          }
          localStorage.setItem('savedAccounts', JSON.stringify(savedAccounts));
        }

        // Generate the massive pairing string
        // Format: WIFI:S:{ssid};T:WPA;P:{password};; PAIR:{userId}
        const userId = data.id;
        const qrString = `WIFI:S:${ssid};T:WPA;P:${wifiPassword};; PAIR:${userId}`;
        setQrCodeData(qrString);
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    }
    setLoading(false);
  };

  const inputStyle = { width: '100%', padding: '12px 14px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', outline: 'none', fontSize: '15px' };
  const labelStyle = { display: 'block', marginBottom: '8px', fontSize: '14px', color: '#cbd5e1', fontWeight: 500 };

  const EyeIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
  );

  const EyeOffIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center', color: '#fff', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: qrCodeData ? '600px' : '450px', padding: '40px', backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid #1e293b', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/aspire-logo.jpg" alt="Aspire Logo" style={{ height: '72px', width: 'auto', margin: '0 auto 16px', objectFit: 'contain' }} />
          <h1 style={{ margin: '8px 0 0', color: '#f8fafc', fontSize: '24px', fontWeight: 600 }}>
            {qrCodeData ? 'Pair Your Helmet' : 'Create Your Account'}
          </h1>
          <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: '15px' }}>
            {qrCodeData 
              ? 'Turn on your Smart Helmet and point the camera at this QR code to automatically pair it.' 
              : 'Sign up to connect and view your Smart Helmet livestream.'}
          </p>
        </div>

        {error && <div style={{ padding: '14px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: '8px', marginBottom: '24px', fontSize: '14px', textAlign: 'center' }}>{error}</div>}

        {!qrCodeData ? (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={labelStyle}>Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} required style={inputStyle} placeholder="Choose a username" />
            </div>
            <div style={{ position: 'relative' }}>
              <label style={labelStyle}>Password</label>
              <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} placeholder="Create a password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '14px', top: '38px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            
            <div style={{ height: '1px', backgroundColor: '#1e293b', margin: '8px 0' }} />
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px', textAlign: 'center' }}>Helmet Wi-Fi Setup</p>
            
            <div>
              <label style={labelStyle}>Wi-Fi Network Name (SSID)</label>
              <input type="text" value={ssid} onChange={e => setSsid(e.target.value)} required style={inputStyle} placeholder="Your Home Wi-Fi Name" />
            </div>
            <div style={{ position: 'relative' }}>
              <label style={labelStyle}>Wi-Fi Password</label>
              <input type={showWifiPassword ? "text" : "password"} value={wifiPassword} onChange={e => setWifiPassword(e.target.value)} required style={inputStyle} placeholder="Your Wi-Fi Password" />
              <button type="button" onClick={() => setShowWifiPassword(!showWifiPassword)} style={{ position: 'absolute', right: '14px', top: '38px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>
                {showWifiPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>

            <button type="submit" disabled={loading} style={{ marginTop: '12px', padding: '14px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Creating Account...' : 'Register & Generate Pairing Code'}
            </button>
            
            <p style={{ textAlign: 'center', marginTop: '16px', color: '#94a3b8', fontSize: '14px' }}>
              Already have an account? <a href="/login?addAccount=true" style={{ color: '#3b82f6', textDecoration: 'none' }}>Log in</a>
            </p>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
            <div style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '16px', border: '4px solid #3b82f6' }}>
              <QRCodeSVG value={qrCodeData} size={300} level="M" />
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#94a3b8', fontSize: '15px', marginBottom: '24px', maxWidth: '400px', lineHeight: '1.5' }}>
                1. Turn on the Helmet<br/>
                2. Wait for the blue light to flash<br/>
                3. Point the camera at this screen<br/>
                4. Listen for the success chime!
              </p>
              
              <button onClick={() => router.push('/')} style={{ padding: '14px 32px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 600, cursor: 'pointer', transition: 'background-color 0.2s' }}>
                Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
