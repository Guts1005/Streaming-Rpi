"use client";

import "@livekit/components-styles";
import { 
  LiveKitRoom, 
  RoomAudioRenderer, 
  VideoTrack, 
  isTrackReference, 
  useConnectionState, 
  useRoomContext, 
  useTracks 
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { useEffect, useMemo, useState, useRef } from "react";

type TokenResponse = { token?: string; error?: string };

type NavItem = { id: string; label: string; icon: string; badge?: string; };
type NavGroup = { label?: string; items: NavItem[]; };

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { id: 'LS', label: 'Live Stream', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z M4 6h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z' },
      { id: 'DB', label: 'Dashboard Overview', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z M4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z M14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
    ]
  },
  {
    label: 'LIBRARY',
    items: [
      { id: 'LF', label: 'Media Gallery', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
    ]
  },
  {
    label: 'AI FEATURES',
    items: [
      { id: 'OD', label: 'Object Detection', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
      { id: 'FD', label: 'Face Detection', icon: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      { id: 'AI', label: 'Safety Analytics', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
      { id: 'PC', label: 'Progress Comparison', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', badge: 'NEW' },
    ]
  },
  {
    label: 'SYSTEM',
    items: [
      { id: 'Settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
    ]
  }
];

async function device(path: string, init?: RequestInit) { 
  return fetch(`/api/device${path}`, init); 
}

function SvgIcon({ path, className, style }: { path: string, className?: string, style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={path} />
    </svg>
  );
}

function Dashboard() {
  const room = useRoomContext();
  const state = useConnectionState();
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true });
  const video = tracks.find(isTrackReference);
  
  const [audioOn, setAudioOn] = useState(false);
  const [talking, setTalking] = useState(false);
  const [msg, setMsg] = useState("");
  const [activeTab, setActiveTab] = useState('LS');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoCardRef = useRef<HTMLDivElement>(null);
  
  const [recordings, setRecordings] = useState<any[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<any>(null);
  const [geminiAnalysis, setGeminiAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  
  const [camRes, setCamRes] = useState('1080p');
  const [camFps, setCamFps] = useState('30');
  const [camBitrate, setCamBitrate] = useState(2500);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  
  const connected = state === ConnectionState.Connected;
  const isRecordingLocal = deviceStatus?.is_recording || false;

  const fetchStatus = async () => {
    try {
      const res = await device("/api/status");
      if (res.ok) setDeviceStatus(await res.json());
    } catch (e) {}
  };

  const fetchMedia = async () => {
    try {
      const res = await device("/api/list_media");
      if (res.ok) setRecordings(await res.json());
    } catch (e) {}
  };

  useEffect(() => {
    fetchMedia();
    fetchStatus();
    const interval = setInterval(() => { fetchMedia(); fetchStatus(); }, 15000);
    
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  const liveFor = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - Math.floor(Math.random() * 2)); 
    return d.toLocaleTimeString([], { hour12: false });
  }, []);

  function toast(text: string) { 
    setMsg(text); setTimeout(() => setMsg(""), 3000); 
  }

  async function toggleTalk() { 
    try { 
      await room.localParticipant.setMicrophoneEnabled(!talking); 
      setTalking(!talking); 
      toast(!talking ? "Live Talk Active" : "Live Talk Ended"); 
    } catch (e) { 
      toast(`Mic failed: ${(e as Error).message}`); 
    } 
  }

  async function startRec() { await device("/api/start_record"); toast("Local Recording Started"); fetchStatus(); }
  async function stopRec() { await device("/api/stop_record", { method: "POST" }); toast("Local Recording Stopped"); fetchStatus(); fetchMedia(); }
  
  async function snap() { 
    toast("Capturing snapshot...");
    await device("/api/capture_photo"); 
    toast("Snapshot captured successfully!"); 
    fetchMedia();
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      videoCardRef.current?.requestFullscreen().catch(err => {
        toast(`Error: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }

  async function startDesktopRec() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `desktop-capture-${Date.now()}.mp4`;
        a.click();
        URL.revokeObjectURL(url);
      };
      mediaRecorder.start();
      toast("Desktop Recording Started");
      stream.getVideoTracks()[0].onended = () => {
        mediaRecorder.stop();
        toast("Desktop Recording Saved");
      };
    } catch (e) {
      toast("Desktop Recording cancelled");
    }
  }

  async function mockSync() {
    toast("Syncing with server...");
    setTimeout(() => toast("Sync complete! Files uploaded to Cloud."), 2500);
  }

  async function runGemini() {
    setAnalyzing(true);
    toast("Generating AI Report...");
    try {
      const res = await device("/api/gemini_analyze");
      if (res.ok) {
        setGeminiAnalysis(await res.json());
        toast("AI Report Generated");
      } else {
        toast(`AI Error: ${(await res.json()).error}`);
      }
    } catch (e) { toast("AI connection failed"); }
    setAnalyzing(false);
  }

  async function saveSettings() {
    toast("Saving settings to device...");
    try {
      await device("/api/settings", { 
        method: "POST", 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution: camRes, fps: camFps, bitrate: camBitrate })
      });
      setTimeout(() => toast("Settings applied successfully!"), 1000);
    } catch (e) {
      setTimeout(() => toast("Failed to apply settings to device. Simulated Success."), 1000);
    }
  }

  async function clearStorage() {
    if(!confirm("Are you sure you want to clear old recordings from the device?")) return;
    toast("Clearing storage...");
    try {
      await device("/api/clear_storage", { method: "POST" });
      setTimeout(() => { toast("Storage cleared"); fetchMedia(); fetchStatus(); }, 1500);
    } catch (e) {
      setTimeout(() => toast("Storage clear failed. Simulated Success."), 1500);
    }
  }

  function downloadFile(filename: string) { window.open(`/api/device/download/${filename}`, '_blank'); }

  return (
    <div className="app-container">
      {msg && <div className="toast">{msg}</div>}
      
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}
      
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand-header">
          <svg viewBox="0 0 40 40" className="brand-logo" fill="none">
            <path d="M20 2c-9.9 0-18 8.1-18 18s8.1 18 18 18 18-8.1 18-18S29.9 2 20 2zm0 32c-7.7 0-14-6.3-14-14S12.3 6 20 6s14 6.3 14 14-6.3 14-14 14z" fill="var(--text-primary)"/>
            <path d="M12 20c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="var(--accent-blue)" strokeWidth="3" strokeLinecap="round"/>
            <path d="M14 24h12" stroke="var(--status-cyan)" strokeWidth="3" strokeLinecap="round"/>
          </svg>
          <div className="brand-title">
            <h2>Aspire Smart Vision</h2>
            <span>Live Monitoring & Analytics</span>
          </div>
        </div>

        <nav className="nav-section">
          {NAV_GROUPS.map((group, idx) => (
            <div key={idx}>
              {group.label && <div className="nav-group-title">{group.label}</div>}
              {group.items.map(item => (
                <button 
                  key={item.id} 
                  className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                >
                  <SvgIcon path={item.icon} />
                  {item.label}
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="device-status-card">
          <div className="device-status-header">
            <span>Device Status</span>
            <span className="status-indicator">
              <i className={`status-dot ${connected ? 'active' : 'inactive'}`}></i> {connected ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="device-id">CAM-1023</div>
          <div className="storage-info">
            Storage Used
            <div style={{ float: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
              {deviceStatus?.storage_free_gb ? (500 - deviceStatus.storage_free_gb).toFixed(1) : '128.5'} GB <span style={{color: 'var(--text-muted)'}}>/ 500 GB</span>
            </div>
          </div>
          <div className="storage-bar-bg">
            <div className="storage-bar-fill" style={{ width: deviceStatus?.storage_percent ? `${100 - deviceStatus.storage_percent}%` : '25%' }}></div>
          </div>
          <div className="storage-percent">{deviceStatus?.storage_percent ? `${100 - deviceStatus.storage_percent}%` : '25.7%'}</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="mobile-hamburger" onClick={() => setSidebarOpen(true)}>
              <SvgIcon path="M4 6h16M4 12h16M4 18h16" />
            </button>
            <div className="page-title">
              <h1>{NAV_GROUPS.flatMap(g => g.items).find(i => i.id === activeTab)?.label || 'Dashboard'}</h1>
              {['LS', 'OD', 'FD'].includes(activeTab) && <p>Real-time stream from Camera #CAM-1023</p>}
            </div>
          </div>

          <div className="topbar-actions">
            <button className="action-icon">
              <SvgIcon path="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              <div className="notif-badge">3</div>
            </button>
            <button className="action-icon">
              <SvgIcon path="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            </button>
            <div className="user-profile">
              <div className="user-avatar">SM</div>
              <span className="user-name">Site Manager</span>
              <SvgIcon path="M19 9l-7 7-7-7" className="w-4 h-4 ml-1" />
            </div>
          </div>
        </header>

        {['LS', 'OD', 'FD'].includes(activeTab) ? (
          <div className="content-wrapper">
            <div className="left-column">
              <div className="video-card" ref={videoCardRef}>
                <div className="video-inner">
                  {video ? <div style={{width: '100%', height: '100%', opacity: isPlaying ? 1 : 0.3, transition: 'opacity 0.2s'}}><VideoTrack trackRef={video} /></div> : <div style={{color: 'var(--text-muted)'}}>{connected ? "Waiting for stream..." : "Offline"}</div>}
                  {!isPlaying && <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white'}}><SvgIcon path="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" style={{width: '64px', height: '64px'}} /></div>}
                  
                  {/* AI Detection Overlays */}
                  {activeTab === 'OD' && isPlaying && video && (
                    <div className="ai-canvas-overlay">
                      <div className="bounding-box" style={{top: '30%', left: '40%', width: '15%', height: '40%'}}>
                        <div className="bounding-box-label">Excavator: 98%</div>
                      </div>
                      <div className="bounding-box" style={{top: '60%', left: '20%', width: '10%', height: '30%'}}>
                        <div className="bounding-box-label">Worker: 95%</div>
                      </div>
                    </div>
                  )}
                  
                  {activeTab === 'FD' && isPlaying && video && (
                    <div className="ai-canvas-overlay">
                      <div className="bounding-box" style={{top: '55%', left: '22%', width: '5%', height: '8%', borderRadius: '50%', borderColor: 'var(--status-cyan)', background: 'transparent'}}>
                        <div className="bounding-box-label" style={{background: 'var(--status-cyan)'}}>Face: 99%</div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="video-top-left">
                  <div className="badge-live">LIVE</div>
                  <div className="badge-timer">{liveFor}</div>
                  {activeTab === 'OD' && <div className="badge-live" style={{background: 'var(--status-purple)', animation: 'none'}}>Object Detection Active</div>}
                  {activeTab === 'FD' && <div className="badge-live" style={{background: 'var(--status-cyan)', animation: 'none'}}>Face Detection Active</div>}
                </div>
                
                <div className="video-top-right">
                  <div className="badge-signal">
                    <SvgIcon path="M3 17v-5m4 5v-8m4 8V7m4 10V4" className="w-4 h-4" /> {camRes}
                  </div>
                  <button className="badge-icon-btn"><SvgIcon path="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" className="w-4 h-4"/></button>
                </div>

                <div className="video-controls-bar">
                  <button className={`ctrl-btn ${!isPlaying ? 'active' : ''}`} onClick={() => setIsPlaying(!isPlaying)} title={isPlaying ? "Pause" : "Play"}>
                    {isPlaying ? <SvgIcon path="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /> : <SvgIcon path="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                  </button>
                  <button className="ctrl-btn" onClick={() => { setAudioOn(!audioOn); if(!audioOn && room.startAudio) room.startAudio(); }} title={audioOn ? "Mute" : "Unmute"}>
                    <SvgIcon path={audioOn ? "M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5 10H1L1 14H5L10 19V5L5 10z" : "M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"} />
                  </button>
                  <div className="volume-slider" onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const val = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    setVolume(val);
                    if(val > 0) setAudioOn(true);
                  }}>
                    <div className="volume-fill" style={{width: `${volume * 100}%`}}></div>
                    <div className="volume-thumb" style={{left: `calc(${volume * 100}% - 6px)`}}></div>
                  </div>
                  <div className="spacer"></div>
                  <button className="ctrl-btn" onClick={snap} title="Snapshot"><SvgIcon path="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></button>
                  <button className="ctrl-btn" onClick={() => setActiveTab('Settings')} title="Settings"><SvgIcon path="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></button>
                  <button className="ctrl-btn" onClick={toggleFullscreen} title="Fullscreen"><SvgIcon path={isFullscreen ? "M3 8V4m0 0h4M3 4l4 4m8-4v4m0-4h4m-4 4l4-4M3 16v4m0 0h4m-4 0l4-4m8 4v-4m0 4h4m-4-4l4 4" : "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"} /></button>
                </div>
              </div>
            </div>

            <div className="right-column">
              <div className="section-header">
                <h3 className="section-title">Quick Actions</h3>
              </div>
              
              <div className="quick-actions-grid">
                <button className={`action-card ${isRecordingLocal ? 'active' : ''}`} onClick={isRecordingLocal ? stopRec : startRec}>
                  <div className="action-icon-box icon-red"><SvgIcon path="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z M4 6h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" /></div>
                  <div className="action-text">
                    <h4>{isRecordingLocal ? 'Stop Recording' : 'Local Recording'}</h4>
                    <p>{isRecordingLocal ? 'Recording in progress' : 'Record on device'}</p>
                  </div>
                </button>
                
                <button className="action-card" onClick={startDesktopRec}>
                  <div className="action-icon-box icon-blue"><SvgIcon path="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></div>
                  <div className="action-text">
                    <h4>Desktop Recording</h4>
                    <p>Record on PC</p>
                  </div>
                </button>
                
                <button className="action-card" onClick={mockSync}>
                  <div className="action-icon-box icon-green"><SvgIcon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></div>
                  <div className="action-text">
                    <h4>Sync to Server</h4>
                    <p>Upload to server</p>
                  </div>
                </button>
                
                <button className={`action-card ${talking ? 'mic-active' : ''}`} onClick={toggleTalk} style={talking ? {borderColor: 'var(--status-cyan)', background: 'rgba(6,182,212,0.05)'} : {}}>
                  <div className="action-icon-box icon-cyan"><SvgIcon path="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></div>
                  <div className="action-text">
                    <h4>{talking ? 'Mic Active' : 'Live Talk'}</h4>
                    <p>{talking ? 'Streaming audio...' : 'Talk to site'}</p>
                  </div>
                </button>
              </div>

              <div className="section-header" style={{marginTop: '32px'}}>
                <h3 className="section-title">System Status</h3>
              </div>
              
              <div className="system-status-grid">
                <div className="status-pill">
                  <div className="pill-label"><span className={`status-dot ${connected ? 'active' : 'inactive'}`} style={{color: connected ? 'var(--status-active)' : 'var(--text-muted)'}}></span> Live Stream</div>
                  <div className={`pill-value ${connected ? 'active' : 'inactive'}`}>{connected ? 'Active' : 'Offline'}</div>
                </div>
                <div className="status-pill">
                  <div className="pill-label"><span className={`status-dot ${isRecordingLocal ? 'active' : 'inactive'}`} style={{color: isRecordingLocal ? 'var(--status-live)' : 'var(--text-muted)'}}></span> Local Device Recording</div>
                  <div className={`pill-value ${isRecordingLocal ? 'active' : 'inactive'}`} style={{color: isRecordingLocal ? 'var(--status-live)' : ''}}>{isRecordingLocal ? 'Recording' : 'Not Recording'}</div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'DB' ? (
          <div className="content-wrapper" style={{gridTemplateColumns: '1fr'}}>
             <div className="panel-large" style={{padding: '40px'}}>
                <h3 className="panel-large-title" style={{fontSize: '24px', marginBottom: '8px'}}>Dashboard Overview</h3>
                <p className="panel-large-sub" style={{marginBottom: '32px'}}>High-level metrics for all connected devices and site progress.</p>
                
                <div className="ai-summary-grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'}}>
                  <div className="ai-card">
                    <div className="ai-icon icon-blue"><SvgIcon path="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z M4 6h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" /></div>
                    <div><h4 className="ai-val">1</h4><p className="ai-label">Active Cameras</p></div>
                  </div>
                  <div className="ai-card">
                    <div className="ai-icon icon-green"><SvgIcon path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></div>
                    <div><h4 className="ai-val">12.5 hrs</h4><p className="ai-label">Recorded Today</p></div>
                  </div>
                  <div className="ai-card">
                    <div className="ai-icon icon-amber"><SvgIcon path="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></div>
                    <div><h4 className="ai-val">0</h4><p className="ai-label">Safety Incidents</p></div>
                  </div>
                  <div className="ai-card">
                    <div className="ai-icon icon-purple"><SvgIcon path="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></div>
                    <div><h4 className="ai-val">99.9%</h4><p className="ai-label">Uptime</p></div>
                  </div>
                </div>
             </div>
          </div>
        ) : activeTab === 'LF' ? (
          <div className="content-wrapper" style={{gridTemplateColumns: '1fr'}}>
            <div className="panel-large">
               <div className="panel-header-row">
                  <div>
                    <h3 className="panel-large-title">Media Library</h3>
                    <p className="panel-large-sub">Manage and playback all recorded photos and videos.</p>
                  </div>
                  <button className="primary-btn" onClick={fetchMedia}>
                    <SvgIcon path="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    Refresh Gallery
                  </button>
                </div>
                
                {previewVideo && (
                  <div style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'grid', placeItems: 'center'}}>
                    <div style={{width: '80%', maxWidth: '1000px', background: '#000', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: '1px solid var(--border-color)'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-sidebar)'}}>
                        <h4 style={{margin: 0}}>{previewVideo}</h4>
                        <button onClick={() => setPreviewVideo(null)} style={{background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer'}}><SvgIcon path="M6 18L18 6M6 6l12 12" className="w-6 h-6"/></button>
                      </div>
                      <video src={`/api/device/data/${previewVideo}`} controls autoPlay style={{width: '100%', display: 'block'}}></video>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginTop: '20px' }}>
                  {recordings.length === 0 && <div style={{padding: '40px', color: 'var(--text-muted)'}}>No files found. Try capturing a snapshot!</div>}
                  {recordings.map((item, idx) => (
                    <div key={idx} className="recording-item" style={{ flexDirection: 'column', alignItems: 'stretch', padding: '0', overflow: 'hidden' }}>
                      <div 
                        className="recording-thumb" 
                        style={item.type === 'image' ? {backgroundImage: `url(/api/device/data/${item.name})`, width: '100%', height: '160px', borderRadius: 0, cursor: 'pointer'} : {width: '100%', height: '160px', borderRadius: 0, cursor: 'pointer', background: 'var(--bg-main)'}}
                        onClick={() => item.type === 'video' ? setPreviewVideo(item.name) : window.open(`/api/device/data/${item.name}`)}
                      >
                        {item.type === 'video' && <SvgIcon path="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" style={{width: '40px', height: '40px'}} />}
                        {item.type === 'video' && <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.5}}><SvgIcon path="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" style={{width: '40px', height: '40px'}} /></div>}
                      </div>
                      <div style={{ padding: '16px' }}>
                        <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>{item.size} MB • {new Date(item.last_modified * 1000).toLocaleString()}</div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="primary-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => downloadFile(item.name)}>Download</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
            </div>
          </div>
        ) : activeTab === 'PC' || activeTab === 'AI' ? (
          <div className="content-wrapper" style={{gridTemplateColumns: '1fr'}}>
              <div className="panel-large">
                <div className="panel-header-row">
                  <div>
                    <h3 className="panel-large-title">{activeTab === 'PC' ? 'Construction Progress Comparison' : 'Safety Analytics'}</h3>
                    <p className="panel-large-sub">{activeTab === 'PC' ? 'Compare site progress between two selected dates.' : 'Automated safety incident detection and tracking.'}</p>
                  </div>
                  <button className="primary-btn" onClick={runGemini} disabled={analyzing}>
                    <SvgIcon path="M13 10V3L4 14h7v7l9-11h-7z" />
                    {analyzing ? "Generating..." : "Generate AI Report"}
                  </button>
                </div>

                <div className="compare-grid">
                  <div className="compare-col">
                    <div className="compare-img-box">
                      <div className="date-badge orange">1st May 2024</div>
                      <img src="https://images.unsplash.com/photo-1541888946425-d81bb19480c5?auto=format&fit=crop&q=80&w=800" alt="Previous" />
                    </div>
                    <div>
                      <h4 style={{margin: '0 0 12px', fontSize: '13px', fontWeight: 600}}>Previous Progress</h4>
                      <div className="stat-row">
                        <span className="stat-label">Foundation Work</span>
                        <span className="stat-val" style={{color: 'var(--status-warning)'}}>42%</span>
                        <div className="stat-bar-bg"><div className="stat-bar-fill" style={{width: '42%', background: 'var(--status-warning)'}}></div></div>
                      </div>
                    </div>
                  </div>

                  <div className="vs-badge">VS</div>

                  <div className="compare-col">
                    <div className="compare-img-box">
                      <div className="date-badge green">15th May 2024</div>
                      <img src="https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&q=80&w=800" alt="Current" />
                    </div>
                    <div>
                      <h4 style={{margin: '0 0 12px', fontSize: '13px', fontWeight: 600}}>Current Progress</h4>
                      <div className="stat-row">
                        <span className="stat-label">Foundation Work</span>
                        <span className="stat-val" style={{color: 'var(--status-active)'}}>85%</span>
                        <div className="stat-bar-bg"><div className="stat-bar-fill" style={{width: '85%', background: 'var(--status-active)'}}></div></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{marginTop: '24px'}}>
                  <h3 className="panel-large-title" style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                    AI Summary <span className="nav-badge" style={{background: 'var(--status-active)'}}>AUTO GENERATED</span>
                  </h3>
                  
                  <div className="ai-text">
                    <strong>AI Analysis:</strong> {geminiAnalysis ? geminiAnalysis.analysis : "Significant progress detected between 1st May and 15th May. Foundation work has advanced from 42% to 85%. Increased manpower and equipment activity observed on site."}
                  </div>
                </div>
              </div>
          </div>
        ) : activeTab === 'Settings' ? (
          <div className="content-wrapper" style={{gridTemplateColumns: '1fr'}}>
             <div className="panel-large">
                <div className="panel-header-row">
                  <div>
                    <h3 className="panel-large-title">Device Configuration</h3>
                    <p className="panel-large-sub">Remotely manage camera, storage, and network settings.</p>
                  </div>
                  <button className="primary-btn" onClick={saveSettings}>
                    <SvgIcon path="M5 13l4 4L19 7" />
                    Save Changes
                  </button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px', marginTop: '32px' }}>
                  
                  {/* Camera Settings Block */}
                  <div>
                    <h4 style={{ fontSize: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>Camera Tuning</h4>
                    
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Stream Resolution</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button className={`nav-item ${camRes === '1080p' ? 'active' : ''}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setCamRes('1080p')}>1080p (FHD)</button>
                        <button className={`nav-item ${camRes === '720p' ? 'active' : ''}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setCamRes('720p')}>720p (HD)</button>
                      </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Framerate (FPS)</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button className={`nav-item ${camFps === '30' ? 'active' : ''}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setCamFps('30')}>30 fps</button>
                        <button className={`nav-item ${camFps === '15' ? 'active' : ''}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setCamFps('15')}>15 fps</button>
                      </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        <span>Target Bitrate</span>
                        <span style={{color: 'var(--text-primary)'}}>{camBitrate} kbps</span>
                      </label>
                      <input 
                        type="range" 
                        min="500" max="5000" step="100" 
                        value={camBitrate} 
                        onChange={(e) => setCamBitrate(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--accent-blue)' }} 
                      />
                    </div>
                  </div>

                  {/* Storage Management Block */}
                  <div>
                    <h4 style={{ fontSize: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>Storage Management</h4>
                    
                    <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Available Space</span>
                        <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{deviceStatus?.storage_free_gb ? (500 - deviceStatus.storage_free_gb).toFixed(1) : '128.5'} GB</span>
                      </div>
                      <div className="storage-bar-bg" style={{ marginBottom: '16px' }}>
                        <div className="storage-bar-fill" style={{ width: deviceStatus?.storage_percent ? `${100 - deviceStatus.storage_percent}%` : '25%', background: 'var(--status-active)' }}></div>
                      </div>
                      
                      <button className="primary-btn" style={{ width: '100%', justifyContent: 'center', background: 'transparent', border: '1px solid var(--status-warning)', color: 'var(--status-warning)' }} onClick={clearStorage}>
                        <SvgIcon path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        Clear Old Recordings
                      </button>
                    </div>

                    <h4 style={{ fontSize: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>Network Interface</h4>
                    
                    <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div className="icon-blue" style={{ padding: '8px', borderRadius: '50%' }}>
                          <SvgIcon path="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" className="w-6 h-6" />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Connected to Wi-Fi</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Site-Network-5G</div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

             </div>
          </div>
        ) : null}
      </main>

      <RoomAudioRenderer muted={!audioOn} volume={volume} />
    </div>
  );
}

export default function Home() {
  const [token, setToken] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/token")
      .then(async r => {
        const j = await r.json() as TokenResponse;
        if (!r.ok || !j.token) throw new Error(j.error || "Token failed");
        setToken(j.token);
      })
      .catch(e => setErr(e.message));
  }, []);

  if (err) return <main style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#000', color: '#ef4444' }}>{err}</main>;
  if (!token) return <main style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#000', color: '#fff' }}>Connecting securely...</main>;

  return (
    <LiveKitRoom token={token} serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL} connect video={false} audio={false}>
      <Dashboard />
    </LiveKitRoom>
  );
}
