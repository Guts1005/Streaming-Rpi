"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import "./sports.css";

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

export default function SportsDashboard() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mpegtsPlayerRef = useRef<any>(null);
  const [connected, setConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [streamUptime, setStreamUptime] = useState(0);
  const [streamRes, setStreamRes] = useState("Unknown");
  const [talkState, setTalkState] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected');
  const [errorMsg, setErrorMsg] = useState("");
  
  const [audioOn, setAudioOn] = useState(false);
  const [talking, setTalking] = useState(false);
  const [msg, setMsg] = useState("");
  const [isPlaying, setIsPlaying] = useState(true);

  const webrtcRef = useRef<RTCPeerConnection | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  
  const [recordings, setRecordings] = useState<any[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<any>(null);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const isRecordingLocal = deviceStatus?.is_recording || false;
  const storageFree = deviceStatus?.storage_free_gb ?? 371.5; // Mock data to match 128.5 used of 500
  const totalStorage = 500;
  
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
    } catch (e) { }
  };

  useEffect(() => {
    fetchMedia();
    fetchStatus();
    const interval = setInterval(() => { fetchMedia(); fetchStatus(); }, 10000);
    
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setCurrentUser(data.user);
          const headerValue = data.user.company_name || data.user.organization_name || 'Account';
          console.log("User Data:", data.user);
          console.log("Company ID:", data.user.company_id);
          console.log("Company Name:", data.user.company_name);
          console.log("Displayed Header Value:", headerValue);
        }
      })
      .catch(() => {});
      
    return () => clearInterval(interval);
  }, []);
  const [playerKey, setPlayerKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let interval: any;
    if (connected) {
      interval = setInterval(() => setStreamUptime(prev => prev + 1), 1000);
    } else {
      setStreamUptime(0);
    }
    return () => clearInterval(interval);
  }, [connected]);

  const fmtRecTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  const toggleFullscreen = () => {
    const container = videoRef.current?.parentElement;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen().catch(err => console.error("Fullscreen error:", err));
    }
  };

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

          player.on(mpegts.Events.MEDIA_INFO, (info: any) => {
            if (info?.metadata?.width) {
              setStreamRes(`${info.metadata.width}x${info.metadata.height}`);
            }
            setErrorMsg("");
          });

          player.on(mpegts.Events.ERROR, (errorType: any, errorDetail: any, errorInfo: any) => {
            if (errorDetail?.includes('502')) setErrorMsg("Camera unit unreachable (502)");
            else setErrorMsg("Stream disconnected or unavailable");
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
              if (isMounted) {
                setConnected(true);
                setErrorMsg("");
              }
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

  function toast(text: string) { setMsg(text); setTimeout(() => setMsg(""), 3000); }

  async function toggleTalk() { 
    if (talking) {
      if (webrtcRef.current) {
        webrtcRef.current.close();
        webrtcRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t: any) => t.stop());
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

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connecting') {
            setStreamRes("Connecting...");
          } else if (pc.connectionState === 'connected') {
            setStreamRes("Connected");
            setTalking(true);
            toast("Live talk active!");
          } else if (pc.connectionState === 'failed') {
            setStreamRes("Failed");
            setTalking(false);
            toast("Talk failed");
          }
        };

        stream.getTracks().forEach((track: any) => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const rtcUrl = `${window.location.protocol}//${window.location.host}/api/device/api/srs_webrtc_publish`;
        const payload = {
          api: rtcUrl,
          streamurl: "webrtc://localhost/live/talkback",
          sdp: offer.sdp
        };

        const res = await fetch(rtcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (data.code !== 0) throw new Error(data.server + " error");
        
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
      } catch (e: any) {
        console.error("SRS Talk Error:", e);
        toast("Failed to connect live talk");
        setTalking(false);
        if (webrtcRef.current) { webrtcRef.current.close(); webrtcRef.current = null; }
        if (audioStreamRef.current) { audioStreamRef.current.getTracks().forEach((t: any) => t.stop()); audioStreamRef.current = null; }
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

  async function syncToServer() { 
    toast("Syncing media to server..."); 
    setTimeout(() => toast("Sync complete!"), 2000); 
  }

  function openMedia(item: any) {
    setSelectedMedia(item);
    setVideoError(false);
  }

  const storageUsed = Math.max(0, totalStorage - storageFree).toFixed(1);
  const storagePercent = Math.round((parseFloat(storageUsed) / totalStorage) * 100);

  return (
    <div className="sd-container">
      {msg && <div className="sd-toast">{msg}</div>}
      
      {/* Sidebar */}
      <div className={`sd-sidebar-overlay ${sidebarOpen ? 'sidebar-open' : ''}`} onClick={() => setSidebarOpen(false)}></div>
      <aside className={`sd-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sd-brand">
          <div className="sd-brand-icon">
            <SvgIcon path="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z M4 6h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" />
          </div>
          <div className="sd-brand-text">
            <h2>Aspire Smart Recorder</h2>
            <p>Capture. Stream. Connect.</p>
          </div>
        </div>

        <nav className="sd-nav">
          <button className="sd-nav-item active">
            <SvgIcon path="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z M4 6h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" />
            Live Stream
          </button>
          <button className="sd-nav-item">
            <SvgIcon path="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z M4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z" />
            Dashboard
          </button>
          <button className="sd-nav-item" onClick={() => setShowGallery(true)}>
            <SvgIcon path="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z" />
            Recordings
          </button>
          <button className="sd-nav-item">
            <SvgIcon path="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            Events / Projects
          </button>
          <button className="sd-nav-item">
            <SvgIcon path="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            Talk & Guide
          </button>
          <button className="sd-nav-item">
            <SvgIcon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            Reports
          </button>
          <button className="sd-nav-item">
            <SvgIcon path="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            Analytics
          </button>

          <div className="sd-nav-group-title">LIBRARY</div>
          <button className="sd-nav-item" onClick={() => setShowGallery(true)}>
            <SvgIcon path="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            Videos
          </button>
          <button className="sd-nav-item">
            <SvgIcon path="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            Snapshots
          </button>

          <div className="sd-nav-group-title">SETUP & DEVICES</div>
          <button className="sd-nav-item">
            <SvgIcon path="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            Tripod Units
          </button>
          <button className="sd-nav-item">
            <SvgIcon path="M13 10V3L4 14h7v7l9-11h-7z" />
            Network & Sync
          </button>
          <button className="sd-nav-item">
            <SvgIcon path="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            Settings
          </button>
        </nav>

        <div className="sd-device-status">
          <div className="sd-device-status-header">DEVICE STATUS</div>
          <div className="sd-device-id-row">
            <span className="sd-device-id">Tripod ID</span>
            <span className="sd-device-online">
              <span className={`sd-dot ${connected ? 'green' : 'red'}`}></span>
              {connected ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="sd-device-id-val">{deviceStatus?.id || 'Unknown Device'}</div>
          
          <div className="sd-progress-label">
            <span>Storage Used</span>
            <span className="sd-progress-val">{storageUsed} GB / {totalStorage} GB</span>
          </div>
          <div className="sd-progress-bar">
            <div className="sd-progress-fill" style={{ width: `${storagePercent}%` }}></div>
          </div>
          
          <div className="sd-progress-label">
            <span>Battery Level</span>
            <span className="sd-progress-val">85%</span>
          </div>
          <div className="sd-progress-bar">
            <div className="sd-progress-fill green" style={{ width: '85%' }}></div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="sd-main">
        {/* Header */}
        <header className="sd-header">
          <div style={{display: 'flex', alignItems: 'center'}}>
            <button className="sd-hamburger-btn" onClick={() => setSidebarOpen(true)}>
              <SvgIcon path="M4 6h16M4 12h16M4 18h16" />
            </button>
            <div className="sd-page-title">
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h1>{currentUser?.ac ? (currentUser.ac.toLowerCase() === 'surveyor' ? 'Survey' : currentUser.ac) : 'Site'} Live Streaming</h1>
                {currentUser && <span style={{ fontSize: '14px', color: '#94a3b8', marginTop: '-4px' }}>{currentUser?.company_name || currentUser?.organization_name || currentUser?.username || 'Account'}</span>}
              </div>
            <p>Tripod Unit - {deviceStatus?.id || 'Unknown'}</p>
          </div>
          </div>
            <div className="sd-header-actions">
            <button className="sd-icon-btn">
              <SvgIcon path="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              <div className="sd-notif-badge">3</div>
            </button>
            <button className="sd-icon-btn">
              <SvgIcon path="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </button>
            <div className="sd-user-profile">
              <div className="sd-avatar">
                <SvgIcon path="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </div>
              <div className="sd-user-info">
                {currentUser?.company_name || currentUser?.organization_name || currentUser?.username || 'Account'}
                <SvgIcon path="M19 9l-7 7-7-7" />
              </div>
            </div>
          </div>
        </header>

        <div className="sd-grid">
          {/* Left Column */}
          <div className="sd-col">
            {/* Video Player */}
            <div className="sd-video-card">
              <div className="sd-video-container">
                <video ref={videoRef} muted={!audioOn} poster="https://images.unsplash.com/photo-1534158914592-062992fbe900?auto=format&fit=crop&q=80&w=1200" />
                <div className="sd-video-overlays">
                  <div className="sd-video-badges-left">
                    <span className="sd-badge red">LIVE</span>
                    <span className="sd-badge dark">00:27:58</span>
                  </div>
                  <div className="sd-video-badges-right">
                    <span className="sd-badge dark">
                      <SvgIcon path="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" style={{width: '14px', height: '14px', color: '#22c55e'}} />
                      {streamRes}
                      <SvgIcon path="M19 9l-7 7-7-7" style={{width: '12px', height: '12px'}} />
                    </span>
                    <button className="sd-icon-btn" onClick={toggleFullscreen} style={{background: 'rgba(0,0,0,0.6)', color: '#fff', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer'}}>
                      <SvgIcon path="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" style={{width: '14px', height: '14px'}} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="sd-video-controls">
                <button className="sd-vc-btn" onClick={() => setIsPlaying(!isPlaying)}>
                  {isPlaying ? <SvgIcon path="M10 9v6m4-6v6" /> : <SvgIcon path="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />}
                </button>
                <button className="sd-vc-btn" onClick={() => setAudioOn(!audioOn)}>
                  {audioOn ? <SvgIcon path="M15.536 8.464a5 5 0 010 7.072M5 10H1v4h4l5 5V5l-5 5z" /> : <SvgIcon path="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />}
                </button>
                
                <div style={{ flex: 1 }}></div>

                <button className="sd-vc-btn" onClick={snap}><SvgIcon path="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></button>
                <button className="sd-vc-btn" onClick={toggleTalk} style={{color: talking ? '#22c55e' : ''}}><SvgIcon path="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></button>
                <button className="sd-vc-btn"><SvgIcon path="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></button>
              </div>
            </div>
            {/* Session Overview */}
            <div className="sd-panel">
              <div className="sd-panel-header" style={{marginBottom: '16px'}}>
                <div>
                  <h3 className="sd-panel-title">Session Overview</h3>
                  <p className="sd-panel-subtitle">Real-time stream & device information</p>
                </div>
              </div>
              <div className="sd-stats-row">

                <div className="sd-stat-card">
                  <div className="sd-stat-header">
                    <div className="sd-stat-icon red"><SvgIcon path="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z" /></div>
                    <span className="sd-stat-title">Recording</span>
                  </div>
                  <h4 className="sd-stat-val">{isRecordingLocal ? 'On' : 'Off'}</h4>
                  <p className="sd-stat-sub">{isRecordingLocal ? 'Recording Live' : 'Ready'}</p>
                </div>
                <div className="sd-stat-card">
                  <div className="sd-stat-header">
                    <div className="sd-stat-icon green"><SvgIcon path="M4 11a1 1 0 112 0v1a1 1 0 11-2 0v-1zm6-4a1 1 0 112 0v5a1 1 0 11-2 0V7zM4 15a1 1 0 112 0v1a1 1 0 11-2 0v-1zm6-8a1 1 0 112 0v1a1 1 0 11-2 0V7zm0 6a1 1 0 112 0v5a1 1 0 11-2 0v-5zm6-10a1 1 0 112 0v5a1 1 0 11-2 0V3z" /></div>
                    <span className="sd-stat-title">Battery</span>
                  </div>
                  <h4 className="sd-stat-val">85%</h4>
                  <p className="sd-stat-sub">2h 10m left</p>
                </div>
                <div className="sd-stat-card">
                  <div className="sd-stat-header">
                    <div className="sd-stat-icon gray"><SvgIcon path="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></div>
                    <span className="sd-stat-title">Storage</span>
                  </div>
                  <h4 className="sd-stat-val">{storageUsed} GB</h4>
                  <p className="sd-stat-sub">of 500 GB used</p>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column */}
          <div className="sd-col">
            {/* Quick Actions */}
            <div className="sd-panel">
              <h3 className="sd-panel-title" style={{marginBottom: '16px'}}>Quick Actions</h3>
              <div className="sd-actions-grid">
                <button className="sd-action-btn">
                  <div className="sd-action-icon red"><SvgIcon path="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></div>
                  <div className="sd-action-info">
                    <h5>Start / Stop Stream</h5>
                    <p>Go Live or Stop</p>
                  </div>
                </button>
                <button className={`sd-action-btn ${isRecordingLocal ? 'active' : ''}`} onClick={isRecordingLocal ? stopRec : startRec}>
                  <div className="sd-action-icon blue"><SvgIcon path="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></div>
                  <div className="sd-action-info">
                    <h5>Record / Stop</h5>
                    <p>Start or stop recording</p>
                  </div>
                </button>
                <button className="sd-action-btn" onClick={snap}>
                  <div className="sd-action-icon yellow"><SvgIcon path="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></div>
                  <div className="sd-action-info">
                    <h5>Snapshot</h5>
                    <p>Capture still image</p>
                  </div>
                </button>
                <button className={`sd-action-btn ${talking ? 'active' : ''}`} onClick={toggleTalk}>
                  <div className="sd-action-icon teal"><SvgIcon path="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></div>
                  <div className="sd-action-info">
                    <h5>Talk to Site</h5>
                    <p>Speak to field unit</p>
                  </div>
                </button>
                <button className="sd-action-btn" onClick={syncToServer}>
                  <div className="sd-action-icon green"><SvgIcon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></div>
                  <div className="sd-action-info">
                    <h5>Sync to Server</h5>
                    <p>Upload live stream</p>
                  </div>
                </button>
                <button className="sd-action-btn" onClick={() => setShowGallery(true)}>
                  <div className="sd-action-icon purple"><SvgIcon path="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></div>
                  <div className="sd-action-info">
                    <h5>Download Files</h5>
                    <p>Download videos</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Two-Way Audio Panel */}
            <div className="sd-panel">
              <div className="sd-audio-header">
                <h3 className="sd-panel-title">Two-Way Audio</h3>
                <span className="sd-audio-status"><span className="sd-dot green"></span> Connected</span>
              </div>
              <div className="sd-audio-visualizer">
                <div className="sd-audio-party">
                  <span>{currentUser ? `You (${currentUser.role || 'User'})` : 'You (Anonymous)'}</span>
                  <div className={`sd-audio-mic ${talking ? 'active' : 'inactive'}`}>
                    <SvgIcon path="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </div>
                  <span style={{color: talking ? 'var(--status-active)' : 'var(--text-muted)'}}>{talking ? 'You are speaking' : 'Muted'}</span>
                </div>
                <div className="sd-audio-waves">
                  <svg viewBox="0 0 64 24" fill="currentColor">
                    <rect x="0" y="8" width="4" height="8" rx="2" />
                    <rect x="8" y="4" width="4" height="16" rx="2" />
                    <rect x="16" y="0" width="4" height="24" rx="2" />
                    <rect x="24" y="6" width="4" height="12" rx="2" />
                    <rect x="32" y="2" width="4" height="20" rx="2" />
                    <rect x="40" y="8" width="4" height="8" rx="2" />
                    <rect x="48" y="5" width="4" height="14" rx="2" />
                    <rect x="56" y="10" width="4" height="4" rx="2" />
                  </svg>
                </div>
                <div className="sd-audio-party">
                  <span>Tripod Unit</span>
                  <div className="sd-audio-mic inactive">
                    <SvgIcon path="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </div>
                  <span>Field audio active</span>
                </div>
              </div>
              <div className="sd-audio-footer">
                <div className="sd-audio-quality">
                  Audio Quality: <span style={{color: 'var(--status-active)', fontWeight: 600}}>Good</span>
                  <div className="sd-quality-bars">
                    <div></div><div></div><div></div><div></div>
                  </div>
                </div>
                <button className="sd-btn-mute" onClick={toggleTalk}>{talking ? 'Mute' : 'Unmute'}</button>
              </div>
            </div>

            {/* Recent Recordings */}
            <div className="sd-panel">
              <div className="sd-rec-header">
                <h3 className="sd-panel-title">Recent Recordings</h3>
                <span className="sd-view-all" onClick={() => setShowGallery(true)}>View All</span>
              </div>
              <div className="sd-rec-list">
                {recordings.slice(0, 5).map((rec, idx) => (
                  <div key={idx} className="sd-rec-item" onClick={() => openMedia(rec)}>
                    <div className="sd-rec-thumb" style={{background: '#000'}}>
                      <SvgIcon path="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </div>
                    <div className="sd-rec-info">
                      <h5 style={{maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{rec.name || rec.chunks?.[0]?.name}</h5>
                      <p>{new Date(rec.time * 1000).toLocaleString()}</p>
                    </div>
                    <button className="sd-rec-download" onClick={(e) => {
                      e.stopPropagation();
                      window.open(`/api/device/download/${rec.name || rec.chunks?.[0]?.name}?ngrok-skip-browser-warning=1`, '_blank');
                    }}>
                      <SvgIcon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </button>
                  </div>
                ))}
              </div>
              <button className="sd-btn-full" onClick={() => setShowGallery(true)}>
                <SvgIcon path="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                View All Recordings
              </button>
            </div>

          </div>
        </div>
      </main>

      {/* Gallery Modal (reused from existing logic) */}
      {showGallery && (
        <div className="sd-modal-backdrop" onClick={() => setShowGallery(false)}>
          <div className="sd-modal-content" onClick={e => e.stopPropagation()}>
            <div className="sd-modal-header">
              <h3>Recordings Gallery</h3>
              <button className="sd-modal-close" onClick={() => setShowGallery(false)}>
                <SvgIcon path="M6 18L18 6M6 6l12 12" />
              </button>
            </div>
            {recordings.length > 0 ? (
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px'}}>
                {recordings.map((item, idx) => (
                  <div key={idx} style={{background: 'var(--bg-input)', padding: '12px', borderRadius: '8px'}}>
                    <div style={{height: '100px', background: '#000', borderRadius: '4px', marginBottom: '8px', display: 'grid', placeItems: 'center'}}>
                      <SvgIcon path="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" style={{width: '24px', height: '24px', color: '#fff'}} />
                    </div>
                    <div style={{fontSize: '12px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{item.name || item.base}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{textAlign: 'center', color: 'var(--text-muted)'}}>No recordings available on device.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
