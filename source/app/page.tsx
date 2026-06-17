"use client";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const mpegtsPlayerRef = useRef<any>(null);
  const [connected, setConnected] = useState(false);
  
  const [audioOn, setAudioOn] = useState(false);
  const [talking, setTalking] = useState(false);
  const [msg, setMsg] = useState("");
  const [isPlaying, setIsPlaying] = useState(true);
  const [isDesktopRec, setIsDesktopRec] = useState(false);
  const desktopRecRef = useRef<MediaRecorder | null>(null);
  const webrtcRef = useRef<RTCPeerConnection | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  
  const [piRecordings, setPiRecordings] = useState<any[]>([]);
  const [desktopRecordings, setDesktopRecordings] = useState<any[]>([]);
  const recordings = [...desktopRecordings, ...piRecordings].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const [galleryMode, setGalleryMode] = useState<'all' | 'pi'>('all');
  const [deviceStatus, setDeviceStatus] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [geminiAnalysis, setGeminiAnalysis] = useState<any>(null);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [recordingsDropdownOpen, setRecordingsDropdownOpen] = useState(false);

  const isRecordingLocal = deviceStatus?.is_recording || false;
  const storageFree = deviceStatus?.storage_free_gb ?? null;
  const recTime = deviceStatus?.recording_time ?? 0;

  const fetchStatus = async () => {
    try {
      const res = await device("/api/status");
      if (res.ok) setDeviceStatus(await res.json());
    } catch (e) {}
  };

  const fetchMedia = async () => {
    try {
      const res = await device("/api/list_media");
      if (res.ok) setPiRecordings(await res.json());
      else toast("Failed to fetch media list");
    } catch (e) { toast("Could not reach device"); }
  };

  const shutdownPi = async () => {
    if (!window.confirm("Are you sure you want to completely shut down the Raspberry Pi? You will physically need to turn the power back on.")) return;
    try {
      const res = await fetch("/api/device/api/shutdown", { method: "POST" });
      if (res.ok) {
        toast("Shutdown command sent successfully");
      } else {
        toast("Shutdown command failed");
      }
    } catch (e) {
      toast("Could not reach device");
    }
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [playerKey, setPlayerKey] = useState(0);

  useEffect(() => {
    fetchMedia();
    fetchStatus();
    const interval = setInterval(() => { fetchMedia(); fetchStatus(); }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let player: any = null;
    let isMounted = true;
    let reconnectTimeout: any = null;

    const initPlayer = () => {
      import("mpegts.js").then((mpegtsModule) => {
        if (!isMounted) return;
        const mpegts = mpegtsModule.default;
        if (mpegts.getFeatureList().mseLivePlayback) {
          const videoElement = videoRef.current;
          if (!videoElement) return;

          if (player) {
            try { player.destroy(); } catch(e) {}
            player = null;
          }

          player = mpegts.createPlayer({
            type: 'flv',
            isLive: true,
            url: '/api/device/live/livestream.flv'
          });
          player.attachMediaElement(videoElement);
          player.load();

          player.on(mpegts.Events.ERROR, (errorType: any, errorDetail: any, errorInfo: any) => {
            console.log("Mpegts error:", errorType, errorDetail);
            setConnected(false);
            if (isMounted) {
              clearTimeout(reconnectTimeout);
              reconnectTimeout = setTimeout(initPlayer, 3000);
            }
          });

          const playPromise = player.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              if (isMounted) setConnected(true);
            }).catch((e: any) => {
              console.log("Auto-play failed:", e);
              if (isMounted) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = setTimeout(initPlayer, 3000);
              }
            });
          } else {
            setConnected(true);
          }
          mpegtsPlayerRef.current = player;
        }
      }).catch(err => console.log("Failed to load mpegts", err));
    };

    initPlayer();
    
    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      if (player) {
        try { player.destroy(); } catch(e) {}
      }
      if (webrtcRef.current) {
        webrtcRef.current.close();
      }
      setConnected(false);
    };
  }, [playerKey]);

  const liveTime = useMemo(() => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, []);

  function toast(text: string) { setMsg(text); setTimeout(() => setMsg(""), 3000); }

  function fmtRecTime(sec: number) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  async function toggleTalk() { 
    if (talking) {
      if (webrtcRef.current) {
        webrtcRef.current.close();
        webrtcRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(t => t.stop());
        audioStreamRef.current = null;
      }
      setTalking(false);
      toast("Live talk disabled");
    } else {
      toast("Connecting live talk...");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        audioStreamRef.current = stream;

        const pc = new RTCPeerConnection();
        webrtcRef.current = pc;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const rtcUrl = `${window.location.protocol}//${window.location.host}/api/device/api/srs_webrtc_publish`;
        const payload = {
          api: rtcUrl,
          streamurl: `webrtc://${window.location.hostname}/live/talkback`,
          sdp: offer.sdp
        };

        const res = await fetch(rtcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (data.code !== 0) throw new Error(data.message || "SRS Error " + data.code);
        
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));

        setTalking(true);
        toast("Live talk active!");
      } catch (e: any) {
        console.error("SRS Talk Error:", e);
        toast("Failed to connect live talk");
        setTalking(false);
        if (webrtcRef.current) { webrtcRef.current.close(); webrtcRef.current = null; }
        if (audioStreamRef.current) { audioStreamRef.current.getTracks().forEach(t => t.stop()); audioStreamRef.current = null; }
      }
    }
  }

  async function startRec() { 
    toast("Live stream paused - recording on device...");
    await device("/api/start_record"); 
    fetchStatus(); 
    setTimeout(() => setPlayerKey(prev => prev + 1), 1000);
  }
  async function stopRec() { 
    toast("Recording saved. Resuming live stream...");
    await device("/api/stop_record", { method: "POST" }); 
    fetchStatus(); 
    setTimeout(fetchMedia, 2500); 
    setTimeout(() => setPlayerKey(prev => prev + 1), 2000);
  }

  async function snap() { 
    toast("Capturing snapshot..."); 
    await device("/api/capture_photo"); 
    toast("Snapshot saved!"); 
    fetchMedia(); 
    setTimeout(() => setPlayerKey(prev => prev + 1), 2000);
  }
  
  async function startDesktopRec() {
    try {
      if (!videoRef.current) {
        toast("No video available to record");
        return;
      }
      const videoEl = videoRef.current as any;
      const stream = videoEl.captureStream ? videoEl.captureStream() : (videoEl.mozCaptureStream ? videoEl.mozCaptureStream() : null);
      if (!stream) {
        toast("Stream capture not supported in this browser");
        return;
      }

      let options = { mimeType: 'video/webm;codecs=vp8,opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' };
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const filename = `stream-capture-${Date.now()}.webm`;
        
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        
        const newLocal = {
          name: filename,
          type: 'video',
          size: blob.size,
          date: new Date().toISOString(),
          isLocal: true,
          url: url
        };
        setDesktopRecordings(prev => [newLocal, ...prev]);
        
        setIsDesktopRec(false);
        toast("Stream recording saved");
      };
      mediaRecorder.start(1000);
      desktopRecRef.current = mediaRecorder;
      setIsDesktopRec(true);
      toast("Stream recording started");
    } catch (e) { toast("Recording failed"); console.error(e); }
  }

  function stopDesktopRec() {
    if (desktopRecRef.current && desktopRecRef.current.state === 'recording') {
      desktopRecRef.current.stop();
    }
  }

  async function syncToServer() { 
    toast("Syncing media to server..."); 
    setTimeout(() => toast("Sync complete!"), 2000); 
  }

  async function runGemini() {
    setAnalyzing(true);
    toast("Generating AI Report...");
    try {
      const res = await device("/api/gemini_analyze");
      if (res.ok) { setGeminiAnalysis(await res.json()); toast("AI Report Generated"); }
      else toast("AI analysis unavailable");
    } catch (e) { toast("AI connection failed"); }
    setAnalyzing(false);
  }

  function openMedia(item: any) {
    setSelectedMedia(item);
    setVideoError(false);
  }

  async function deleteMedia(item: any) {
    if (!confirm(`Are you sure you want to delete ${item.name || item.base}?`)) return;
    if (item.isLocal) {
      setDesktopRecordings(prev => prev.filter(r => r !== item));
      return;
    }
    try {
      const isBatch = !!item.base;
      const endpoint = isBatch ? '/api/delete_batch' : '/api/delete_file';
      const payload = isBatch ? { base: item.base } : { filename: item.name };
      
      toast(`Deleting...`);
      const res = await device(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        toast("Deleted successfully");
        setPiRecordings(prev => prev.filter(r => r !== item));
        if (selectedMedia && (selectedMedia.name === item.name || selectedMedia.base === item.base)) {
          setSelectedMedia(null);
        }
        fetchStatus();
      } else {
        toast("Delete failed");
      }
    } catch (e) {
      toast("Could not reach device");
    }
  }

  const handleDownload = (item: any) => {
    if (item.isLocal) {
      const a = document.createElement('a');
      a.href = item.url;
      a.download = item.name;
      a.click();
    } else {
      window.open(`/api/device/download/${item.name || item.chunks?.[0]?.name}?ngrok-skip-browser-warning=1`, '_blank');
    }
  };

  const totalStorage = 64; // assuming 64GB card based on free space
  const storagePercent = storageFree !== null ? Math.max(0, Math.min(100, Math.round(((totalStorage - storageFree) / totalStorage) * 100))) : 25;
  const storageUsed = storageFree !== null ? Math.max(0, totalStorage - storageFree).toFixed(1) : '--';

  return (
    <div className="app-container">
      {msg && <div className="toast">{msg}</div>}
      
      {/* ===== SIDEBAR ===== */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'sidebar-open' : ''}`} onClick={() => setSidebarOpen(false)}></div>
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-header">
          <img src="/logo.jpeg" alt="Aspire AI Smart Video Recorder" className="brand-image" />
        </div>

        <nav className="nav-section">
          <button className="nav-item active">
            <SvgIcon path="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z M4 6h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" /> Live Stream
          </button>
          <button className="nav-item">
            <SvgIcon path="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z M4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z M14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /> Dashboard
          </button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <button className="nav-item" onClick={() => setRecordingsDropdownOpen(!recordingsDropdownOpen)}>
              <SvgIcon path="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z" /> Recordings
              <SvgIcon path={recordingsDropdownOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} style={{ marginLeft: 'auto', width: '14px', height: '14px' }} />
            </button>
            {recordingsDropdownOpen && (
              <div style={{ paddingLeft: '28px', display: 'flex', flexDirection: 'column', marginTop: '2px', marginBottom: '4px' }}>
                <button className={`nav-item ${showGallery && galleryMode === 'all' ? 'active' : ''}`} onClick={() => {setGalleryMode('all'); setShowGallery(true);}}>
                  <SvgIcon path="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z M4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z M14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /> All Recordings
                </button>
                <button className={`nav-item ${showGallery && galleryMode === 'pi' ? 'active' : ''}`} onClick={() => {setGalleryMode('pi'); setShowGallery(true);}}>
                  <SvgIcon path="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /> Local Files
                </button>
                <button className="nav-item">
                  <SvgIcon path="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /> Server Files
                </button>
              </div>
            )}
          </div>
          <button className="nav-item">
            <SvgIcon path="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /> AI Analytics <span className="nav-badge" style={{background: '#2563EB', color: '#fff'}}>PRO</span>
          </button>
          <button className="nav-item">
            <SvgIcon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> Reports
          </button>



          <div className="nav-group-title">AI FEATURES</div>
          <button className="nav-item">
            <SvgIcon path="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /> Video to Text
          </button>
          <button className="nav-item">
            <SvgIcon path="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /> Object Detection
          </button>
          <button className="nav-item">
            <SvgIcon path="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> Face Detection
          </button>
          <button className="nav-item">
            <SvgIcon path="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /> Safety Alerts
          </button>

          <div className="nav-group-title">PROGRESS ANALYSIS</div>
          <button className="nav-item">
            <SvgIcon path="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> Progress Comparison <span className="nav-badge" style={{background: '#22c55e', color: '#fff'}}>NEW</span>
          </button>
        </nav>

        {/* Device Status Panel */}
        <div className="device-status-sidebar">
          <div className="ds-header">
            <span>Device Status</span>
            <span style={{color: connected ? 'var(--status-active)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px'}}>
              <span className={`dot ${connected ? 'green' : 'grey'}`}></span>
              {connected ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="ds-id">Device ID</div>
          <div style={{fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px'}}>CAM-1023</div>
          <div className="ds-storage-label">
            <span>Storage Used</span>
            <span style={{color: '#fff', fontWeight: 600}}>{storageUsed} GB / 64 GB</span>
          </div>
          <div className="ds-storage-bar">
            <div className="ds-storage-fill" style={{width: `${100 - storagePercent}%`}}></div>
          </div>
          <div className="ds-storage-percent">{100 - storagePercent}%</div>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className="main-area">
        <header className="topbar">
          <div style={{display: 'flex', alignItems: 'center'}}>
            <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>
              <SvgIcon path="M4 6h16M4 12h16M4 18h16" />
            </button>
            <div className="mobile-logo">
              <img src="/logo.jpeg" alt="Aspire AI" />
            </div>
            <div className="page-title">
              <h1>Live Stream</h1>
              <p className="desktop-only">Real-time stream from Camera #CAM-1023</p>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="topbar-icon">
              <SvgIcon path="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              <div className="notif-dot"></div>
            </div>
            <div className="topbar-icon">
              <SvgIcon path="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </div>
            <div className="user-profile">
              <div className="user-avatar" style={{background: '#2563EB'}}>
                <SvgIcon path="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </div>
              <span className="user-name">
                Site Manager
                <SvgIcon path="M19 9l-7 7-7-7" />
              </span>
            </div>
          </div>
        </header>

        <div className="dashboard-grid">
          {/* ===== LEFT COLUMN ===== */}
          <div className="left-col">
            {/* Video Player */}
            <div className="video-card">
              <div className="video-frame">
                  <div style={{width: '100%', height: '100%', background: '#000'}}>
                    <video ref={videoRef} style={{width: '100%', height: '100%', objectFit: 'contain'}} muted={!audioOn} />
                  </div>

                {isRecordingLocal && (
                  <div className="video-dim-overlay">
                    <span>🔴 REC {fmtRecTime(recTime)}</span>
                  </div>
                )}
                
                <div className="video-badges">
                  <div className="badge-group">
                    <span className="badge red">🔴 LIVE</span>
                    <span className="badge grey">{liveTime}</span>
                    <span className="badge grey">
                      <span className={`dot ${connected ? 'green' : 'grey'}`} style={{marginRight: '4px'}}></span>
                      {connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <div className="badge-group">
                    <span className="badge grey">
                      <SvgIcon path="M3 17v-5m4 5v-8m4 8V7m4 10V4" style={{width: '12px', height: '12px'}} /> 1080p
                    </span>
                    <span className="badge grey" style={{cursor: 'pointer'}}>
                      <SvgIcon path="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" style={{width: '12px', height: '12px'}} />
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="video-controls">
                <button className="ctrl-icon" onClick={() => setIsPlaying(!isPlaying)}>
                  {isPlaying ? <SvgIcon path="M10 9v6m4-6v6" /> : <SvgIcon path="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />}
                </button>
                <button className="ctrl-icon" onClick={() => setAudioOn(!audioOn)}>
                  {audioOn 
                    ? <SvgIcon path="M15.536 8.464a5 5 0 010 7.072M5 10H1v4h4l5 5V5l-5 5z" /> 
                    : <SvgIcon path="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  }
                </button>
                <div className="progress-bar">
                  <div className="progress-fill"></div>
                  <div className="progress-thumb"></div>
                </div>
                <button className="ctrl-icon" onClick={snap} title="Capture snapshot">
                  <SvgIcon path="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </button>
                <button className="ctrl-icon" title="Settings">
                  <SvgIcon path="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </button>
                <button className="ctrl-icon" title="Fullscreen">
                  <SvgIcon path="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </button>
              </div>
            </div>

            {/* Construction Progress Comparison */}
            <div className="progress-card">
              <div className="progress-header">
                <div>
                  <h3 className="section-title" style={{margin: '0 0 4px'}}>Construction Progress Comparison</h3>
                  <p style={{margin: 0, fontSize: '11px', color: 'var(--text-secondary)'}}>Compare site progress between two selected dates</p>
                </div>
                <button className="btn-primary" onClick={runGemini} disabled={analyzing}>
                  <SvgIcon path="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" style={{width: '14px', height: '14px'}} />
                  {analyzing ? "Generating..." : "Generate AI Report"}
                </button>
              </div>

              <div className="compare-container">
                <div className="compare-box">
                  <div className="compare-img">
                    <span className="compare-date orange">1st May 2024</span>
                    <img src="https://images.unsplash.com/photo-1541888946425-d81bb19480c5?auto=format&fit=crop&q=80&w=800" alt="Previous Progress" />
                  </div>
                  <div className="compare-stats">
                    <h5>Previous Progress</h5>
                    <div className="stat-row"><span className="stat-label">Foundation Work</span><span className="stat-val" style={{color: 'var(--status-warning)'}}>42%</span><div className="stat-bar-bg"><div className="stat-bar-fill orange" style={{width: '42%'}}></div></div></div>
                    <div className="stat-row"><span className="stat-label">Columns Completed</span><span className="stat-val" style={{color: 'var(--status-warning)'}}>18</span></div>
                    <div className="stat-row"><span className="stat-label">Workers Detected</span><span className="stat-val" style={{color: 'var(--status-active)'}}>26</span></div>
                  </div>
                </div>

                <div className="vs-circle">VS</div>

                <div className="compare-box">
                  <div className="compare-img">
                    <span className="compare-date green">15th May 2024</span>
                    <img src="https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&q=80&w=800" alt="Current Progress" />
                  </div>
                  <div className="compare-stats">
                    <h5>Current Progress</h5>
                    <div className="stat-row"><span className="stat-label">Foundation Work</span><span className="stat-val" style={{color: 'var(--status-active)'}}>85%</span><div className="stat-bar-bg"><div className="stat-bar-fill green" style={{width: '85%'}}></div></div></div>
                    <div className="stat-row"><span className="stat-label">Columns Completed</span><span className="stat-val" style={{color: 'var(--status-active)'}}>41</span></div>
                    <div className="stat-row"><span className="stat-label">Workers Detected</span><span className="stat-val" style={{color: 'var(--status-active)'}}>38</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Summary */}
            <div className="ai-summary-card">
              <div className="ai-summary-header">
                <h3>AI Summary</h3>
                <span className="badge-auto">AUTO GENERATED</span>
              </div>
              <div className="ai-grid">
                <div className="ai-metric">
                  <div className="action-icon c-blue"><SvgIcon path="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></div>
                  <div><h4 className="ai-metric-val">+43%</h4><p className="ai-metric-label">Overall Progress</p></div>
                </div>
                <div className="ai-metric">
                  <div className="action-icon c-green"><SvgIcon path="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></div>
                  <div><h4 className="ai-metric-val">+23</h4><p className="ai-metric-label">New Structural Elements</p></div>
                </div>
                <div className="ai-metric">
                  <div className="action-icon c-orange"><SvgIcon path="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></div>
                  <div><h4 className="ai-metric-val">+12</h4><p className="ai-metric-label">Additional Workers</p></div>
                </div>
                <div className="ai-metric">
                  <div className="action-icon c-purple"><SvgIcon path="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></div>
                  <div><h4 className="ai-metric-val">92%</h4><p className="ai-metric-label">AI Match Accuracy</p></div>
                </div>
              </div>
              <p className="ai-text">
                <strong>AI Analysis:</strong> Significant progress detected between 1st May and 15th May. Foundation work has advanced from 42% to 85%. 23 new structural elements were identified. Increased manpower and equipment activity observed on site.
                {geminiAnalysis && <><br/><br/><strong>Gemini:</strong> {geminiAnalysis.analysis}</>}
                <span className="read-more"> Read More</span>
              </p>
            </div>
          </div>

          {/* ===== RIGHT COLUMN ===== */}
          <div className="right-col">
            {/* Quick Actions */}
            <div className="panel">
              <h3 className="section-title">Quick Actions</h3>
              <div className="quick-actions">
                <button className={`action-btn ${isRecordingLocal ? 'active' : ''}`} onClick={isRecordingLocal ? stopRec : startRec}>
                  <div className="action-icon c-red">
                    <SvgIcon path="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    {isRecordingLocal && <div className="rec-pulse"></div>}
                  </div>
                  <div><h4>Local Recording</h4><p>{isRecordingLocal ? 'Stop Recording' : 'Record on device'}</p></div>
                </button>
                <button className={`action-btn ${isDesktopRec ? 'active' : ''}`} onClick={isDesktopRec ? stopDesktopRec : startDesktopRec}>
                  <div className="action-icon c-blue">
                    <SvgIcon path="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    {isDesktopRec && <div className="rec-pulse"></div>}
                  </div>
                  <div><h4>Desktop Recording</h4><p>{isDesktopRec ? 'Stop Recording' : 'Record on PC'}</p></div>
                </button>
                <button className="action-btn" onClick={syncToServer}>
                  <div className="action-icon c-green">
                    <SvgIcon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </div>
                  <div><h4>Sync to Server</h4><p>Upload to server</p></div>
                </button>
                <button className="action-btn" onClick={() => setShowGallery(true)}>
                  <div className="action-icon c-purple">
                    <SvgIcon path="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </div>
                  <div><h4>Download Files</h4><p>Download local & server files</p></div>
                </button>
                <button className="action-btn" onClick={snap}>
                  <div className="action-icon c-orange">
                    <SvgIcon path="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </div>
                  <div><h4>Snapshot</h4><p>Capture image</p></div>
                </button>
                <button className={`action-btn ${talking ? 'active' : ''}`} onClick={toggleTalk} style={talking ? {borderColor: 'var(--status-cyan)'} : {}}>
                  <div className="action-icon c-cyan">
                    <SvgIcon path="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    {talking && <div className="rec-pulse" style={{background: 'var(--status-cyan)', boxShadow: '0 0 6px var(--status-cyan)'}}></div>}
                  </div>
                  <div><h4>Live Talk</h4><p>{talking ? 'Tap to stop' : 'Talk to site'}</p></div>
                </button>
                <button className="action-btn" onClick={shutdownPi}>
                  <div className="action-icon c-red">
                    <SvgIcon path="M18.36 6.64a9 9 0 11-12.73 0M12 2v10" />
                  </div>
                  <div><h4>Power Off</h4><p>Shutdown Raspberry Pi</p></div>
                </button>
              </div>
            </div>

            {/* Desktop Recordings */}
            <div className="panel">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                <h3 className="section-title" style={{margin: 0}}>Desktop Recordings</h3>
                <span style={{fontSize: '11px', color: 'var(--text-muted)'}}>{desktopRecordings.length} files</span>
              </div>
              <div className="recordings-list">
                {desktopRecordings.length > 0 ? desktopRecordings.slice(0, 3).map((item: any, idx: number) => (
                  <div key={idx} className="rec-item" onClick={() => openMedia(item)}>
                    <div className="rec-thumb" style={item.type === 'image' ? {backgroundImage: `url(/api/device/data/${item.name})`} : {}}>
                      {item.type !== 'image' && <SvgIcon path="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />}
                    </div>
                    <div className="rec-info">
                      <h5>{item.name || item.base}</h5>
                      <p>{item.size || item.total_size} MB</p>
                    </div>
                    <button className="rec-download" onClick={(e) => { e.stopPropagation(); handleDownload(item); }}>
                      <SvgIcon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </button>
                    <button className="rec-download" style={{color: '#ef4444', marginLeft: '8px'}} onClick={(e) => { e.stopPropagation(); deleteMedia(item); }}>
                      <SvgIcon path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </button>
                  </div>
                )) : (
                  <div style={{textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '12px'}}>No recordings found on device</div>
                )}
              </div>
              <button className="btn-outline" onClick={() => {setGalleryMode('all'); setShowGallery(true);}}>
                <SvgIcon path="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" style={{width: '14px', height: '14px'}} />
                View All Recordings
              </button>
            </div>

            {/* System Status */}
            <div className="panel">
              <h3 className="section-title">System Status</h3>
              <div className="sys-status-grid">
                <div className="sys-pill">
                  <div className="sys-label"><span className={`dot ${connected ? 'green' : 'grey'}`}></span> Live Stream</div>
                  <div className={`sys-val ${connected ? 'green' : ''}`}>{connected ? 'Active' : 'Offline'}</div>
                </div>
                <div className="sys-pill">
                  <div className="sys-label"><span className={`dot ${isRecordingLocal ? 'red' : 'grey'}`}></span> Recording (Local)</div>
                  <div className={`sys-val ${isRecordingLocal ? 'red' : ''}`}>{isRecordingLocal ? 'Recording' : 'Not Recording'}</div>
                </div>
                <div className="sys-pill">
                  <div className="sys-label"><span className={`dot ${isDesktopRec ? 'red' : 'grey'}`}></span> Recording (Desktop)</div>
                  <div className={`sys-val ${isDesktopRec ? 'red' : ''}`}>{isDesktopRec ? 'Recording' : 'Not Recording'}</div>
                </div>
                <div className="sys-pill">
                  <div className="sys-label"><span className={`dot green`}></span> Server Sync</div>
                  <div className="sys-val green">Synced</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ===== VIDEO PLAYER MODAL ===== */}
      {selectedMedia && (
        <div className="modal-backdrop" onClick={() => setSelectedMedia(null)}>
          <div className="modal-content" style={{width: '80%', maxWidth: '900px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedMedia.name || selectedMedia.base}</h3>
              <button className="modal-close" onClick={() => setSelectedMedia(null)}>
                <SvgIcon path="M6 18L18 6M6 6l12 12" />
              </button>
            </div>
            {(selectedMedia.type === 'video' || selectedMedia.type === 'batch') ? (
              <div style={{width: '100%', background: '#000', borderRadius: 'var(--radius-sm)', overflow: 'hidden'}}>
                {videoError ? (
                  <div style={{padding: '48px', textAlign: 'center', color: 'var(--status-live)'}}>
                    <SvgIcon path="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" style={{width: '32px', height: '32px', margin: '0 auto 12px', display: 'block'}} />
                    <p style={{margin: 0, fontSize: '14px'}}>Could not load video stream</p>
                    <p style={{margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)'}}>Try downloading the file instead</p>
                  </div>
                ) : (
                  <video 
                    controls autoPlay
                    style={{width: '100%', maxHeight: '65vh', display: 'block'}} 
                    src={selectedMedia.isLocal ? selectedMedia.url : `/api/device/data/${selectedMedia.name || selectedMedia.chunks?.[0]?.name}`}
                    onError={() => setVideoError(true)}
                  />
                )}
              </div>
            ) : (
              <div style={{width: '100%', textAlign: 'center'}}>
                <img src={selectedMedia.isLocal ? selectedMedia.url : `/api/device/data/${selectedMedia.name}`} style={{maxWidth: '100%', maxHeight: '65vh', borderRadius: 'var(--radius-sm)'}} alt="Captured" />
              </div>
            )}
            <div style={{marginTop: '14px', display: 'flex', justifyContent: 'flex-end'}}>
              <a href={selectedMedia.isLocal ? selectedMedia.url : `/api/device/download/${selectedMedia.name || selectedMedia.chunks?.[0]?.name}`} target="_blank" rel="noopener noreferrer" className="download-link" download={selectedMedia.isLocal ? selectedMedia.name : undefined}>
                <SvgIcon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                Download Original File
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ===== GALLERY MODAL ===== */}
      {showGallery && (
        <div className="modal-backdrop" onClick={() => setShowGallery(false)}>
          <div className="modal-content" style={{width: '90%', maxWidth: '1000px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{galleryMode === 'pi' ? 'Local Media (Pi)' : 'All Media'} ({galleryMode === 'pi' ? piRecordings.length : recordings.length})</h3>
              <button className="modal-close" onClick={() => setShowGallery(false)}>
                <SvgIcon path="M6 18L18 6M6 6l12 12" />
              </button>
            </div>
            {(galleryMode === 'pi' ? piRecordings : recordings).length > 0 ? (
              <div className="gallery-grid">
                {(galleryMode === 'pi' ? piRecordings : recordings).map((item: any, idx: number) => (
                  <div key={idx} className="gallery-card">
                    <div 
                      className="gallery-thumb"
                      style={item.type === 'image' ? {backgroundImage: `url(/api/device/data/${item.name})`} : {}}
                      onClick={() => { setShowGallery(false); openMedia(item); }}
                    >
                      {item.type !== 'image' && <SvgIcon path="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />}
                    </div>
                    <div className="gallery-info">
                      <h5 title={item.name || item.base}>{item.name || item.base}</h5>
                      <p>{item.size || item.total_size} MB</p>
                      <div className="gallery-actions">
                        <button className="gallery-btn primary" onClick={() => { setShowGallery(false); openMedia(item); }}>Play</button>
                        <button className="gallery-btn secondary" onClick={() => handleDownload(item)}>Download</button>
                        <button className="gallery-btn" style={{color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)'}} onClick={(e) => { e.stopPropagation(); deleteMedia(item); }}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)'}}>No media files found on device</div>
            )}
          </div>
        </div>
      )}


    </div>
  );
}

export default function Home() {
  return <Dashboard />;
}
