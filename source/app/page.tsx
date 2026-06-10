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

function SvgIcon({ path, className, style }: { path: string, className?: string, style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={path} />
    </svg>
  );
}

async function device(path: string, init?: RequestInit) { 
  return fetch(`/api/device${path}`, init); 
}

function Dashboard() {
  const room = useRoomContext();
  const state = useConnectionState();
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true });
  const video = tracks.find(isTrackReference);
  
  const [audioOn, setAudioOn] = useState(false);
  const [talking, setTalking] = useState(false);
  const [msg, setMsg] = useState("");
  const [isPlaying, setIsPlaying] = useState(true);
  
  const [recordings, setRecordings] = useState<any[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [geminiAnalysis, setGeminiAnalysis] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('LS');

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
    return () => clearInterval(interval);
  }, []);

  const liveFor = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - Math.floor(Math.random() * 2)); 
    return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' });
  }, []);

  function toast(text: string) { setMsg(text); setTimeout(() => setMsg(""), 3000); }

  async function toggleTalk() { 
    try { 
      await room.localParticipant.setMicrophoneEnabled(!talking); 
      setTalking(!talking); 
      toast(!talking ? "Live Talk Active" : "Live Talk Ended"); 
    } catch (e) { toast(`Mic failed: ${(e as Error).message}`); } 
  }

  async function startRec() { await device("/api/start_record"); toast("Local Recording Started"); fetchStatus(); }
  async function stopRec() { await device("/api/stop_record", { method: "POST" }); toast("Local Recording Stopped"); fetchStatus(); fetchMedia(); }
  async function snap() { toast("Capturing snapshot..."); await device("/api/capture_photo"); toast("Snapshot captured successfully!"); fetchMedia(); }
  
  async function startDesktopRec() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const url = URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
        const a = document.createElement('a');
        a.href = url; a.download = `desktop-capture-${Date.now()}.mp4`; a.click();
        URL.revokeObjectURL(url);
      };
      mediaRecorder.start(); toast("Desktop Recording Started");
      stream.getVideoTracks()[0].onended = () => { mediaRecorder.stop(); toast("Desktop Recording Saved"); };
    } catch (e) { toast("Desktop Recording cancelled"); }
  }

  async function mockSync() { toast("Syncing with server..."); setTimeout(() => toast("Sync complete!"), 2000); }
  function downloadFile(filename: string) { window.open(`/api/device/download/${filename}`, '_blank'); }

  async function runGemini() {
    setAnalyzing(true);
    toast("Generating AI Report...");
    try {
      const res = await device("/api/gemini_analyze");
      if (res.ok) { setGeminiAnalysis(await res.json()); toast("AI Report Generated"); }
    } catch (e) { toast("AI connection failed"); }
    setAnalyzing(false);
  }

  return (
    <div className="app-container">
      {msg && <div className="toast">{msg}</div>}
      
      {/* Sidebar - Matches Mentor Design precisely */}
      <aside className="sidebar">
        <div className="brand-header">
          <svg viewBox="0 0 40 40" className="brand-logo" fill="none">
            <path d="M20 2c-9.9 0-18 8.1-18 18s8.1 18 18 18 18-8.1 18-18S29.9 2 20 2zm0 32c-7.7 0-14-6.3-14-14S12.3 6 20 6s14 6.3 14 14-6.3 14-14 14z" fill="#fff"/>
            <path d="M12 20c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="#1D4ED8" strokeWidth="3" strokeLinecap="round"/>
            <path d="M14 24h12" stroke="#06B6D4" strokeWidth="3" strokeLinecap="round"/>
          </svg>
          <div className="brand-title">
            <h2>Aspire Smart Vision</h2>
            <span>Live Monitoring & Analytics</span>
          </div>
        </div>

        <nav className="nav-section">
          <div className="nav-group-title">MONITORING</div>
          <button className={`nav-item ${activeTab === 'LS' ? 'active' : ''}`} onClick={() => setActiveTab('LS')}>
            <SvgIcon path="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z M4 6h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" /> Live Stream
          </button>
          <button className={`nav-item ${activeTab === 'DB' ? 'active' : ''}`} onClick={() => setActiveTab('DB')}>
            <SvgIcon path="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z M4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z M14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /> Dashboard
          </button>
          <button className="nav-item">
            <SvgIcon path="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z" /> Recordings
          </button>
          <button className="nav-item">
            <SvgIcon path="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066" /> AI Analytics <span className="nav-badge" style={{background: '#1D4ED8', color: '#fff'}}>PRO</span>
          </button>
          <button className="nav-item">
            <SvgIcon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> Reports
          </button>
          <button className="nav-item" onClick={fetchMedia}>
            <SvgIcon path="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /> Local Files
          </button>
          <button className="nav-item">
            <SvgIcon path="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /> Server Files
          </button>
          <button className="nav-item">
            <SvgIcon path="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0" /> Settings
          </button>
        </nav>

        <div className="device-status-sidebar">
          <div className="ds-header">
            <span>Device Status</span>
            <span style={{color: connected ? 'var(--status-active)' : 'var(--text-muted)'}}>
              <span className={`dot ${connected ? 'green' : 'grey'}`} style={{display: 'inline-block', marginRight: '4px'}}></span>
              {connected ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="ds-id">Smart Helmet Pi<br/><span style={{fontSize: '11px', color: 'var(--status-active)', fontWeight: 500}}>helmet-live</span></div>
          <div className="ds-storage-label">
            <span>Audio</span>
            <span style={{color: '#fff'}}>{audioOn ? 'Active' : 'Muted'}</span>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="page-title">
            <h1>Live Stream</h1>
            <p>Real-time stream from Camera #CAM-1023</p>
          </div>
          <div className="topbar-actions">
            <div className="topbar-icon" style={{position: 'relative'}}>
              <SvgIcon path="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              <div style={{position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: '50%', background: 'var(--status-live)'}}></div>
            </div>
            <div className="topbar-icon">
              <SvgIcon path="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572" />
            </div>
            <div className="user-profile">
              <div className="user-avatar" style={{background: '#1D4ED8'}}><SvgIcon path="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" className="w-5 h-5 text-white" /></div>
              <span className="user-name">Site Manager <SvgIcon path="M19 9l-7 7-7-7" className="w-4 h-4 ml-1" style={{display:'inline-block'}} /></span>
            </div>
          </div>
        </header>

        <div className="dashboard-grid">
          {/* LEFT COLUMN */}
          <div className="left-col">
            <div className="video-card">
              <div className="video-frame">
                {video ? <div style={{width: '100%', height: '100%', opacity: isPlaying ? 1 : 0.3}}><VideoTrack trackRef={video} /></div> : <div style={{color: 'var(--text-muted)', textAlign: 'center', paddingTop: '20%'}}>Waiting for LiveKit video stream...</div>}
                
                <div className="video-badges">
                  <div className="badge-group">
                    <span className="badge red">LIVE</span>
                    <span className="badge grey">{liveFor} AM</span>
                    <span className="badge grey" style={{color: connected ? 'var(--status-active)' : 'var(--text-muted)', background: 'rgba(0,0,0,0.8)'}}>
                      <span className={`dot ${connected ? 'green' : 'grey'}`} style={{display: 'inline-block', marginRight: '6px'}}></span> Connected
                    </span>
                  </div>
                  <span className="badge grey" style={{color: 'var(--status-active)'}}>
                    <SvgIcon path="M3 17v-5m4 5v-8m4 8V7m4 10V4" className="w-3 h-3" style={{display: 'inline-block', marginRight: '4px'}} /> 1080p
                  </span>
                </div>
              </div>
              
              <div className="video-controls">
                <button className="ctrl-icon" onClick={() => setIsPlaying(!isPlaying)}>
                  {isPlaying ? <SvgIcon path="M10 9v6m4-6v6" /> : <SvgIcon path="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />}
                </button>
                <button className="ctrl-icon"><SvgIcon path="M15.536 8.464a5 5 0 010 7.072M5 10H1L1 14H5L10 19V5L5 10z" /></button>
                <div className="progress-bar">
                  <div className="progress-fill"></div>
                  <div className="progress-thumb"></div>
                </div>
                <button className="ctrl-icon"><SvgIcon path="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></button>
                <button className="ctrl-icon"><SvgIcon path="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></button>
                <button className="ctrl-icon"><SvgIcon path="M5 12h14M12 5l7 7-7 7" /></button>
              </div>
            </div>

            <div className="progress-card">
              <div className="progress-header">
                <div>
                  <h3 className="section-title" style={{margin: '0 0 4px'}}>Construction Progress Comparison</h3>
                  <p style={{margin: 0, fontSize: '11px', color: 'var(--text-secondary)'}}>Select two media files to compare side-by-side</p>
                </div>
                <button className="btn-primary" onClick={runGemini} disabled={analyzing}>
                  {analyzing ? "Generating..." : "Analyze Latest with Gemini"}
                </button>
              </div>

              <div className="compare-container">
                <div className="compare-box">
                  <div className="compare-img">
                    <span className="compare-date orange">Baseline</span>
                    <img src="https://images.unsplash.com/photo-1541888946425-d81bb19480c5?auto=format&fit=crop&q=80&w=800" alt="Previous" />
                  </div>
                  <div className="compare-stats">
                    <h5>Initial Foundation</h5>
                    <div className="stat-row"><span className="stat-label">Type</span><span className="stat-val" style={{color: 'var(--text-secondary)', fontWeight: 500}}>Image</span></div>
                    <div className="stat-row"><span className="stat-label">Size</span><span className="stat-val" style={{color: 'var(--text-secondary)', fontWeight: 500}}>1.2 MB</span></div>
                  </div>
                </div>

                <div className="vs-circle">VS</div>

                <div className="compare-box">
                  <div className="compare-img">
                    <span className="compare-date green">Latest</span>
                    <img src="https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&q=80&w=800" alt="Current" />
                  </div>
                  <div className="compare-stats">
                    <h5>Current Structure</h5>
                    <div className="stat-row"><span className="stat-label">Type</span><span className="stat-val" style={{color: 'var(--text-secondary)', fontWeight: 500}}>Image</span></div>
                    <div className="stat-row"><span className="stat-label">Size</span><span className="stat-val" style={{color: 'var(--text-secondary)', fontWeight: 500}}>2.4 MB</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="ai-summary-card">
              <div className="ai-summary-header">
                <h3>AI Site Summary</h3>
              </div>
              <p className="ai-text">
                Analyzing site activity... today's activity shows <strong>12% increase</strong> in structural completion.
                {geminiAnalysis ? <><br/><br/><strong>Gemini Note:</strong> {geminiAnalysis.analysis}</> : null}
              </p>
            </div>
            
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px'}}>
               <div className="ai-metric" style={{background: 'var(--bg-sidebar)'}}>
                 <div className="action-icon c-blue"><SvgIcon path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></div>
                 <div><h4 className="ai-metric-val">24h</h4><p className="ai-metric-label">Uptime</p></div>
               </div>
               <div className="ai-metric" style={{background: 'var(--bg-sidebar)'}}>
                 <div className="action-icon c-purple"><SvgIcon path="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z" /></div>
                 <div><h4 className="ai-metric-val">0</h4><p className="ai-metric-label">Recent</p></div>
               </div>
               <div className="ai-metric" style={{background: 'var(--bg-sidebar)'}}>
                 <div className="action-icon c-orange"><SvgIcon path="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></div>
                 <div><h4 className="ai-metric-val">0.8s</h4><p className="ai-metric-label">Latency</p></div>
               </div>
               <div className="ai-metric" style={{background: 'var(--bg-sidebar)'}}>
                 <div className="action-icon c-cyan"><SvgIcon path="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></div>
                 <div><h4 className="ai-metric-val">84%</h4><p className="ai-metric-label">Free Space</p></div>
               </div>
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div className="right-col">
            
            <div style={{background: 'var(--bg-panel)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)'}}>
                <h3 className="section-title">Quick Actions</h3>
                <div className="quick-actions">
                  <button className={`action-btn ${isRecordingLocal ? 'active' : ''}`} onClick={isRecordingLocal ? stopRec : startRec}>
                    <div className="action-icon c-red"><SvgIcon path="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z" /></div>
                    <div><h4>Local Recording</h4><p>{isRecordingLocal ? 'Stop Recording' : 'Start Recording'}</p></div>
                  </button>
                  <button className="action-btn" onClick={startDesktopRec}>
                    <div className="action-icon c-blue"><SvgIcon path="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></div>
                    <div><h4>Desktop Rec</h4><p>Record on PC</p></div>
                  </button>
                  <button className="action-btn" onClick={mockSync}>
                    <div className="action-icon c-green"><SvgIcon path="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></div>
                    <div><h4>Sync Server</h4><p>Upload Media</p></div>
                  </button>
                  <button className="action-btn" onClick={() => setActiveTab('LF')}>
                    <div className="action-icon c-purple"><SvgIcon path="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></div>
                    <div><h4>File Manager</h4><p>View Captures</p></div>
                  </button>
                  <button className="action-btn" onClick={snap}>
                    <div className="action-icon c-orange"><SvgIcon path="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></div>
                    <div><h4>Snapshot</h4><p>Capture Image</p></div>
                  </button>
                  <button className={`action-btn ${talking ? 'active' : ''}`} onClick={toggleTalk} style={talking ? {borderColor: 'var(--status-cyan)'} : {}}>
                    <div className="action-icon c-cyan"><SvgIcon path="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></div>
                    <div><h4>Live Talk</h4><p>Tap to Speak</p></div>
                  </button>
                </div>
                
                <div className="sync-status">
                  <span>Syncing to Cloud...</span>
                  <span style={{color: '#fff', fontWeight: 600}}>0%</span>
                </div>
                <div className="sync-bar"></div>
            </div>

            <div style={{background: 'var(--bg-panel)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)'}}>
              <h3 className="section-title">Recent Recordings</h3>
              <div className="recordings-list">
                {recordings.length > 0 ? recordings.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="rec-item">
                    <div className="rec-thumb" style={item.type === 'image' ? {backgroundImage: `url(/api/device/data/${item.name})`, backgroundSize: 'cover'} : {}}>
                      {item.type === 'video' && <SvgIcon path="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" style={{width: '16px', height: '16px'}} />}
                    </div>
                    <div className="rec-info">
                      <h5>{item.name}</h5>
                      <p>{item.size} MB</p>
                    </div>
                  </div>
                )) : (
                  <div style={{textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '12px'}}>No recordings found</div>
                )}
              </div>
              <button className="btn-outline">View All Media</button>
            </div>

            <div style={{background: 'var(--bg-panel)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)'}}>
              <h3 className="section-title">System Status</h3>
              <div className="sys-status-grid">
                <div className="sys-pill">
                  <div className="sys-label"><span className={`dot ${connected ? 'green' : 'grey'}`}></span> Stream</div>
                  <div className={`sys-val ${connected ? 'green' : ''}`}>{connected ? 'Active' : 'Offline'}</div>
                </div>
                <div className="sys-pill">
                  <div className="sys-label"><span className={`dot ${isRecordingLocal ? 'green' : 'grey'}`}></span> Rec</div>
                  <div className={`sys-val ${isRecordingLocal ? 'green' : ''}`}>{isRecordingLocal ? 'Active' : 'Idle'}</div>
                </div>
                <div className="sys-pill">
                  <div className="sys-label"><span className={`dot ${audioOn ? 'green' : 'grey'}`}></span> Audio</div>
                  <div className={`sys-val ${audioOn ? 'green' : ''}`}>{audioOn ? 'Live' : 'Muted'}</div>
                </div>
                <div className="sys-pill">
                  <div className="sys-label"><span className={`dot ${talking ? 'green' : 'grey'}`}></span> Talk</div>
                  <div className={`sys-val ${talking ? 'green' : ''}`}>{talking ? 'Live' : 'Ready'}</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      <RoomAudioRenderer muted={!audioOn} volume={1} />
    </div>
  );
}

export default function Home() {
  const [token, setToken] = useState("");
  useEffect(() => {
    fetch("/api/token").then(async r => { setToken((await r.json() as TokenResponse).token || ""); }).catch(() => {});
  }, []);
  if (!token) return <main style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#06090F', color: '#fff' }}>Connecting...</main>;
  return (
    <LiveKitRoom token={token} serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL} connect video={false} audio={false}>
      <Dashboard />
    </LiveKitRoom>
  );
}
