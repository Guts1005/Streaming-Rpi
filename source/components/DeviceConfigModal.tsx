"use client";

import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

function SvgIcon({ path, className, style }: { path: string, className?: string, style?: React.CSSProperties }) {
  return (
    <svg className={className} style={{ width: '20px', height: '20px', ...style }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={path} />
    </svg>
  );
}

export default function DeviceConfigModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'wifi' | 'bluetooth' | 'hotspot'>('wifi');
  const [msg, setMsg] = useState("");

  const toast = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{
        backgroundColor: '#1e293b', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '500px',
        color: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '20px'
      }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Device Connections</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <SvgIcon path="M6 18L18 6M6 6l12 12" />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', background: '#0f172a', padding: '4px', borderRadius: '8px' }}>
          <button 
            style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 500,
              background: activeTab === 'wifi' ? '#2563eb' : 'transparent', color: activeTab === 'wifi' ? '#fff' : '#94a3b8'
            }}
            onClick={() => setActiveTab('wifi')}
          >Wi-Fi Setup</button>
          <button 
            style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 500,
              background: activeTab === 'bluetooth' ? '#2563eb' : 'transparent', color: activeTab === 'bluetooth' ? '#fff' : '#94a3b8'
            }}
            onClick={() => setActiveTab('bluetooth')}
          >Bluetooth Audio</button>
          <button 
            style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 500,
              background: activeTab === 'hotspot' ? '#2563eb' : 'transparent', color: activeTab === 'hotspot' ? '#fff' : '#94a3b8'
            }}
            onClick={() => setActiveTab('hotspot')}
          >Hotspot</button>
        </div>

        <div style={{ minHeight: '300px' }}>
          {activeTab === 'wifi' && <WifiSetup toast={toast} />}
          {activeTab === 'bluetooth' && <BluetoothSetup toast={toast} />}
          {activeTab === 'hotspot' && <HotspotSetup toast={toast} />}
        </div>

        {msg && <div style={{
          position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          background: '#334155', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', zIndex: 2000
        }}>{msg}</div>}
      </div>
    </div>
  );
}

function WifiSetup({ toast }: { toast: (msg: string) => void }) {
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [qrMode, setQrMode] = useState<'none' | 'generate' | 'scan'>('none');
  const [scannerActive, setScannerActive] = useState(false);

  const connectWifi = async (wifiSsid: string, wifiPass: string) => {
    if (!wifiSsid) return toast('SSID is required');
    toast(`Connecting Pi to ${wifiSsid}...`);
    try {
      const res = await fetch('/api/device/api/wifi/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssid: wifiSsid, password: wifiPass })
      });
      if (res.ok) toast('Wi-Fi config sent to device!');
      else toast('Failed to send config');
    } catch (e) {
      toast('Error communicating with device');
    }
  };

  useEffect(() => {
    if (qrMode === 'scan' && !scannerActive) {
      import('html5-qrcode').then(({ Html5Qrcode }) => {
        const html5QrCode = new Html5Qrcode("reader");
        html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText, decodedResult) => {
            console.log(`Scan result: ${decodedText}`);
            // Parse WIFI:S:SSID;T:WPA;P:PASS;;
            const ssidMatch = decodedText.match(/S:([^;]+);/);
            const passMatch = decodedText.match(/P:([^;]+);/);
            if (ssidMatch) {
              setSsid(ssidMatch[1]);
              if (passMatch) setPassword(passMatch[1]);
              html5QrCode.stop();
              setQrMode('none');
              toast('Wi-Fi credentials loaded from QR');
            } else {
              toast('Invalid Wi-Fi QR Code');
            }
          },
          (errorMessage) => { }
        ).then(() => setScannerActive(true)).catch(err => toast("Camera error"));
      });
    }
  }, [qrMode]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Configure the Raspberry Pi to connect to a known Wi-Fi or Mobile Hotspot.</p>
      
      {qrMode === 'none' && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', color: '#cbd5e1' }}>Network Name (SSID)</label>
            <input 
              type="text" value={ssid} onChange={e => setSsid(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', outline: 'none' }}
              placeholder="e.g. MyHomeNetwork"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', color: '#cbd5e1' }}>Password</label>
            <input 
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', outline: 'none' }}
              placeholder="••••••••"
            />
          </div>
          
          <button 
            onClick={() => connectWifi(ssid, password)}
            style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, marginTop: '8px' }}
          >Connect Device to Wi-Fi</button>

          <div style={{ display: 'flex', alignItems: 'center', margin: '8px 0' }}>
            <div style={{ flex: 1, height: '1px', background: '#334155' }}></div>
            <span style={{ margin: '0 12px', color: '#64748b', fontSize: '12px' }}>OR</span>
            <div style={{ flex: 1, height: '1px', background: '#334155' }}></div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setQrMode('generate')} style={{ flex: 1, background: '#334155', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
              Show QR to Pi Camera
            </button>
            <button onClick={() => setQrMode('scan')} style={{ flex: 1, background: '#334155', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
              Scan Router QR
            </button>
          </div>
        </>
      )}

      {qrMode === 'generate' && (
        <div style={{ textAlign: 'center', background: '#fff', padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <QRCodeSVG value={`WIFI:T:WPA;S:${ssid};P:${password};;`} size={200} />
          <p style={{ color: '#0f172a', fontSize: '14px', marginTop: '16px', fontWeight: 500 }}>Hold this code in front of the Pi's camera</p>
          <button onClick={() => setQrMode('none')} style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', marginTop: '12px' }}>Back</button>
        </div>
      )}

      {qrMode === 'scan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <div id="reader" style={{ width: '100%', maxWidth: '300px', background: '#000', borderRadius: '8px', overflow: 'hidden' }}></div>
          <button onClick={() => { setQrMode('none'); setScannerActive(false); }} style={{ background: '#334155', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>Cancel Scan</button>
        </div>
      )}
    </div>
  );
}

function BluetoothSetup({ toast }: { toast: (msg: string) => void }) {
  const [devices, setDevices] = useState<{name: string, mac: string}[]>([]);
  const [scanning, setScanning] = useState(false);

  const scanBluetooth = async () => {
    setScanning(true);
    toast('Scanning for Bluetooth devices...');
    try {
      const res = await fetch('/api/device/api/bluetooth/scan');
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
        toast(`Found ${data.devices?.length || 0} devices`);
      } else {
        toast('Failed to scan for devices');
      }
    } catch (e) {
      toast('Error communicating with device');
    }
    setScanning(false);
  };

  const connectBluetooth = async (mac: string) => {
    toast(`Connecting to ${mac}...`);
    try {
      const res = await fetch('/api/device/api/bluetooth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac })
      });
      if (res.ok) toast('Connected successfully!');
      else toast('Failed to connect to device');
    } catch (e) {
      toast('Error communicating with device');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Connect wireless headphones for streaming audio and Live Talk.</p>
      
      <button 
        onClick={scanBluetooth} disabled={scanning}
        style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', cursor: scanning ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: scanning ? 0.7 : 1 }}
      >{scanning ? 'Scanning...' : 'Scan for Devices'}</button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', maxHeight: '200px', overflowY: 'auto' }}>
        {devices.length === 0 && !scanning && (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>No devices found. Ensure your headphones are in pairing mode.</div>
        )}
        {devices.map((dev, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '14px', fontWeight: 500 }}>{dev.name || 'Unknown Device'}</span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>{dev.mac}</span>
            </div>
            <button 
              onClick={() => connectBluetooth(dev.mac)}
              style={{ background: '#334155', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
            >Connect</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function HotspotSetup({ toast }: { toast: (msg: string) => void }) {
  const [gatewayIp, setGatewayIp] = useState('192.168.43.1');
  const [searching, setSearching] = useState(false);

  const discoverDevice = async () => {
    if (!gatewayIp) return toast('Gateway IP required');
    setSearching(true);
    toast('Searching local network for device IP...');
    try {
      const res = await fetch('/api/device/api/hotspot/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateway: gatewayIp })
      });
      if (res.ok) {
        const data = await res.json();
        toast(`Found device at ${data.ip}`);
      } else {
        toast('Device not found on this network');
      }
    } catch (e) {
      toast('Error pinging network');
    }
    setSearching(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>If the device is connected to a mobile hotspot, you can attempt to discover its local IP address automatically.</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '13px', color: '#cbd5e1' }}>Hotspot Gateway IP</label>
        <input 
          type="text" value={gatewayIp} onChange={e => setGatewayIp(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', outline: 'none' }}
          placeholder="e.g. 192.168.43.1"
        />
        <span style={{ fontSize: '11px', color: '#64748b' }}>Common mobile hotspot gateways: 192.168.43.1 (Android) or 172.20.10.1 (iOS)</span>
      </div>
      
      <button 
        onClick={discoverDevice} disabled={searching}
        style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', cursor: searching ? 'not-allowed' : 'pointer', fontWeight: 600, marginTop: '8px', opacity: searching ? 0.7 : 1 }}
      >{searching ? 'Searching...' : 'Find Device IP'}</button>
    </div>
  );
}
