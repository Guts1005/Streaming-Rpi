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
import { useEffect, useState, useRef, useCallback } from "react";

type TokenResponse = { token?: string; error?: string };

interface ActivityEvent {
  id: number;
  action: string;
  timestamp: Date;
  icon: string;
}

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

function getFileStatusBadge(name: string): { label: string; color: string } | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower.startsWith('uploaded_') || lower.includes('_uploaded')) return { label: 'Uploaded', color: '#22c55e' };
  if (lower.startsWith('failed_') || lower.includes('_failed')) return { label: 'Failed', color: '#ef4444' };
  if (lower.startsWith('converting_') || lower.includes('_converting')) return { label: 'Converting', color: '#f59e0b' };
  if (lower.startsWith('incomplete_') || lower.includes('_incomplete') || lower.endsWith('.part')) return { label: 'Incomplete', color: '#f59e0b' };
  return null;
}

type ViewMode = 'dashboard' | 'object-detection' | 'face-detection' | 'safety-alerts';

function Dashboard() {
  const room = useRoomContext();
  const state = useConnectionState();
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true });
  const video = tracks.find(isTrackReference);
  
  const [audioOn, setAudioOn] = useState(false);
  const [talking, setTalking] = useState(false);
  const [msg, setMsg] = useState("");
  const [isPlaying, setIsPlaying] = useState(true);
  const [isDesktopRec, setIsDesktopRec] = useState(false);
  const desktopRecRef = useRef<MediaRecorder | null>(null);
  
  const [recordings, setRecordings] = useState<any[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [geminiAnalysis, setGeminiAnalysis] = useState<any>(null);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [videoError, setVideoError] = useState(false);

  // --- Gap 1: Mobile hamburger menu ---
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // --- Gap 2: Live clock ---
  const [liveTime, setLiveTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  // --- Gap 5: AI Feature Views ---
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [aiViewResult, setAiViewResult] = useState<string | null>(null);
  const [aiViewLoading, setAiViewLoading] = useState(false);

  // --- Gap 7: Recording timer live update ---
  const [localRecTimer, setLocalRecTimer] = useState(0);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Innovation: Night Vision ---
  const [nightVision, setNightVision] = useState(false);

  // --- Innovation: Keyboard Shortcuts ---
  const [showShortcuts, setShowShortcuts] = useState(false);

  // --- Innovation: Session Activity Timeline ---
  const [activityLog, setActivityLog] = useState<ActivityEvent[]>([]);
  const activityIdRef = useRef(0);

  // --- Gallery Delete confirmation ---
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);

  // --- Syncing state ---
  const [isSyncing, setIsSyncing] = useState(false);

  const videoFrameRef = useRef<HTMLDivElement>(null);

  const connected = state === ConnectionState.Connected;
  const isRecordingLocal = deviceStatus?.is_recording || false;
  const storageFree = deviceStatus?.storage_free_gb ?? null;
  const recTime = deviceStatus?.recording_time ?? 0;

  const addActivity = useCallback((action: string, icon: string) => {
    setActivityLog(prev => {
      const next = [{ id: ++activityIdRef.current, action, timestamp: new Date(), icon }, ...prev];
      return next.slice(0, 50); // keep last 50 events
    });
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await device("/api/status");
      if (res.ok) setDeviceStatus(await res.json());
    } catch (e) { /* device unreachable */ }
  };

  const fetchMedia = async () => {
    try {
      const res = await device("/api/list_media");
      if (res.ok) setRecordings(await res.json());
      else toast("Failed to fetch media list");
    } catch (e) { toast("Could not reach device"); }
  };

  useEffect(() => {
    fetchMedia();
    fetchStatus();
    const interval = setInterval(() => { fetchMedia(); fetchStatus(); }, 10000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- GPS Geolocation Sync ---
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const payload = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy || 0,
          speed: position.coords.speed || 0,
        };
        device("/api/update_gps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // --- Gap 2: Live clock update every second ---
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Gap 7: Recording timer live update ---
  useEffect(() => {
    if (isRecordingLocal) {
      setLocalRecTimer(recTime);
      recTimerRef.current = setInterval(() => {
        setLocalRecTimer(prev => prev + 1);
      }, 1000);
    } else {
      setLocalRecTimer(0);
      if (recTimerRef.current) {
        clearInterval(recTimerRef.current);
        recTimerRef.current = null;
      }
    }
    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
    };
  }, [isRecordingLocal, recTime]);

  // --- Innovation: Keyboard shortcuts ---
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Don't fire if typing in an input or if modal open
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      switch (e.key.toLowerCase()) {
        case '?':
          setShowShortcuts(prev => !prev);
          break;
        case 'r':
          if (isRecordingLocal) { stopRec(); } else { startRec(); }
          break;
        case 's':
          snap();
          break;
        case 't':
          toggleTalk();
          break;
        case 'f':
          handleFullscreen();
          break;
        case 'm':
          setAudioOn(prev => !prev);
          break;
        case 'g':
          setShowGallery(prev => !prev);
          break;
        case 'n':
          setNightVision(prev => !prev);
          break;
        case 'escape':
          setShowShortcuts(false);
          setSidebarOpen(false);
          break;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecordingLocal, talking]);

  function toast(text: string) { setMsg(text); setTimeout(() => setMsg(""), 3000); }

  function fmtRecTime(sec: number) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  async function toggleTalk() { 
    try { 
      await room.localParticipant.setMicrophoneEnabled(!talking); 
      setTalking(!talking); 
      const newState = !talking;
      toast(newState ? "Live Talk Active" : "Live Talk Ended");
      addActivity(newState ? 'Live talk started' : 'Live talk ended', 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z');
    } catch (e) { toast(`Mic failed: ${(e as Error).message}`); } 
  }

  async function startRec() { 
    toast("Live stream paused — recording on device...");
    addActivity('Local recording started', 'M21 12a9 9 0 11-18 0 9 9 0 0118 0z');
    try {
      const res = await device("/api/start_record", { method: "POST" }); 
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(data.error || "Failed to start recording — check device connection");
        return;
      }
    } catch (e) {
      toast("Could not reach device — check DEVICE_API_BASE");
      return;
    }
    fetchStatus(); 
  }
  async function stopRec() { 
    toast("Recording saved. Resuming live stream...");
    addActivity('Local recording stopped', 'M21 12a9 9 0 11-18 0 9 9 0 0118 0z');
    try {
      await device("/api/stop_record", { method: "POST" }); 
    } catch (e) {
      toast("Could not reach device to stop recording");
    }
    fetchStatus(); 
    setTimeout(fetchMedia, 2500); 
  }

  async function snap() { 
    toast("Capturing snapshot..."); 
    addActivity('Snapshot captured', 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z');
    try {
      const res = await device("/api/capture_photo", { method: "POST" }); 
      if (res.ok) {
        toast("Snapshot saved!"); 
      } else {
        toast("Snapshot failed — check device connection");
      }
    } catch (e) {
      toast("Could not reach device for snapshot");
      return;
    }
    fetchMedia(); 
  }
  
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
        setIsDesktopRec(false);
        toast("Desktop recording saved");
        addActivity('Desktop recording saved', 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z');
      };
      mediaRecorder.start();
      desktopRecRef.current = mediaRecorder;
      setIsDesktopRec(true);
      toast("Desktop recording started");
      addActivity('Desktop recording started', 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z');
      stream.getVideoTracks()[0].onended = () => { mediaRecorder.stop(); };
    } catch (e) { toast("Desktop recording cancelled"); }
  }

  function stopDesktopRec() {
    if (desktopRecRef.current && desktopRecRef.current.state === 'recording') {
      desktopRecRef.current.stop();
    }
  }

  // --- Gap 4: Sync to server fix ---
  async function syncToServer() { 
    if (isSyncing) return;
    setIsSyncing(true);
    toast("Syncing media to server..."); 
    addActivity('Cloud sync started', 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12');
    try {
      let uploadCount = 0;
      for (const item of recordings) {
        const fname = item.name || item.base;
        if (!fname) continue;
        try {
          await device('/api/upload_cloud', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: fname }),
          });
          uploadCount++;
        } catch (err) {
          // individual file upload failed, continue
        }
      }
      toast(`Sync complete! ${uploadCount} file(s) uploaded.`);
      addActivity(`Cloud sync completed (${uploadCount} files)`, 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12');
      fetchMedia();
    } catch (e) {
      toast("Sync failed — could not reach device");
    }
    setIsSyncing(false);
  }

  async function runGemini() {
    setAnalyzing(true);
    toast("Generating AI Report...");
    addActivity('AI analysis started', 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707');
    try {
      const res = await device("/api/gemini_analyze");
      if (res.ok) { 
        const data = await res.json();
        setGeminiAnalysis(data); 
        toast("AI Report Generated");
        addActivity('AI analysis completed', 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707');
      }
      else toast("AI analysis unavailable");
    } catch (e) { toast("AI connection failed"); }
    setAnalyzing(false);
  }

  // --- Gap 5: AI View analysis ---
  async function runAiViewAnalysis(view: ViewMode) {
    setAiViewLoading(true);
    setAiViewResult(null);
    addActivity(`${view.replace('-', ' ')} analysis started`, 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z');
    try {
      const res = await device("/api/gemini_analyze");
      if (res.ok) {
        const data = await res.json();
        setAiViewResult(data.analysis || data.summary || JSON.stringify(data));
        addActivity(`${view.replace('-', ' ')} analysis completed`, 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z');
      } else {
        setAiViewResult("AI analysis is currently unavailable. Make sure GEMINI_API_KEY is configured.");
      }
    } catch (e) {
      setAiViewResult("Could not connect to device for AI analysis.");
    }
    setAiViewLoading(false);
  }

  function openMedia(item: any) {
    setSelectedMedia(item);
    setVideoError(false);
  }

  // --- Gap 3: Gallery delete ---
  async function deleteFile(item: any) {
    const fname = item.name || item.base;
    toast(`Deleting ${fname}...`);
    addActivity(`Deleted file: ${fname}`, 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16');
    try {
      if (item.type === 'batch' && item.base) {
        await device('/api/delete_batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base: item.base }),
        });
      } else {
        await device('/api/delete_file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: item.name }),
        });
      }
      toast(`Deleted ${fname}`);
      setDeleteConfirm(null);
      fetchMedia();
    } catch (e) {
      toast("Delete failed — could not reach device");
    }
  }

  // --- Gap 6: Fullscreen ---
  function handleFullscreen() {
    const el = videoFrameRef.current;
    if (!el) {
      document.documentElement.requestFullscreen?.();
      return;
    }
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      el.requestFullscreen?.();
    }
  }

  // --- Innovation: Picture-in-Picture ---
  async function handlePiP() {
    try {
      const videoEl = videoFrameRef.current?.querySelector('video');
      if (!videoEl) { toast("No video available for PiP"); return; }
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        addActivity('Picture-in-Picture closed', 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z');
      } else {
        await videoEl.requestPictureInPicture();
        addActivity('Picture-in-Picture opened', 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z');
        toast("Picture-in-Picture activated");
      }
    } catch (e) { toast("PiP not available"); }
  }

  // --- Navigation handler for sidebar with view switching ---
  function handleNavClick(view: ViewMode) {
    setCurrentView(view);
    setSidebarOpen(false);
    if (view !== 'dashboard') {
      runAiViewAnalysis(view);
    }
  }

  const storagePercent = storageFree !== null ? Math.max(0, Math.min(100, Math.round((storageFree / 32) * 100))) : 25;
  const storageUsed = storageFree !== null ? (32 - storageFree).toFixed(1) : '—';

  const nightVisionStyle: React.CSSProperties = nightVision
    ? { filter: 'hue-rotate(80deg) saturate(1.5) brightness(1.2)' }
    : {};

  // AI View overlay title
  const aiViewTitles: Record<ViewMode, string> = {
    'dashboard': '',
    'object-detection': 'Object Detection',
    'face-detection': 'Face Detection',
    'safety-alerts': 'Safety Alerts',
  };

  return (
    <div className="app-container">
      {msg && <div className="toast">{msg}</div>}
      
      {/* --- Gap 1: Mobile sidebar overlay --- */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ===== SIDEBAR ===== */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-header">
          <svg viewBox="0 0 40 40" className="brand-logo" fill="none">
            <circle cx="20" cy="20" r="18" stroke="#fff" strokeWidth="2" fill="none"/>
            <path d="M12 20c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <path d="M14 25h12" stroke="#06B6D4" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <div className="brand-title">
            <h2>Aspire Smart Vision</h2>
            <span>Live Monitoring &amp; Analytics</span>
          </div>
          {/* Close button visible on mobile only */}
          <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}>
            <SvgIcon path="M6 18L18 6M6 6l12 12" />
          </button>
        </div>

        <nav className="nav-section">
          <button className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => handleNavClick('dashboard')}>
            <SvgIcon path="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z M4 6h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" /> Live Stream
          </button>
          <button className={`nav-item`} onClick={() => handleNavClick('dashboard')}>
            <SvgIcon path="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z M4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z M14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /> Dashboard
          </button>
          <button className="nav-item" onClick={() => { setShowGallery(true); setSidebarOpen(false); }}>
            <SvgIcon path="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z" /> Recordings
          </button>
          <button className="nav-item">
            <SvgIcon path="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /> AI Analytics <span className="nav-badge" style={{background: '#2563EB', color: '#fff'}}>PRO</span>
          </button>
          <button className="nav-item">
            <SvgIcon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> Reports
          </button>

          <div className="nav-group-title">LIBRARY</div>
          <button className="nav-item" onClick={() => { fetchMedia(); setSidebarOpen(false); }}>
            <SvgIcon path="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /> Local Files
          </button>
          <button className="nav-item">
            <SvgIcon path="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /> Server Files
          </button>

          <div className="nav-group-title">AI FEATURES</div>
          <button className="nav-item">
            <SvgIcon path="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /> Video to Text
          </button>
          <button className={`nav-item ${currentView === 'object-detection' ? 'active' : ''}`} onClick={() => handleNavClick('object-detection')}>
            <SvgIcon path="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /> Object Detection
          </button>
          <button className={`nav-item ${currentView === 'face-detection' ? 'active' : ''}`} onClick={() => handleNavClick('face-detection')}>
            <SvgIcon path="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> Face Detection
          </button>
          <button className={`nav-item ${currentView === 'safety-alerts' ? 'active' : ''}`} onClick={() => handleNavClick('safety-alerts')}>
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
            <span style={{color: '#fff', fontWeight: 600}}>{storageUsed} GB / 32 GB</span>
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
          {/* --- Gap 1: Hamburger button for mobile --- */}
          <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <SvgIcon path="M4 6h16M4 12h16M4 18h16" />
          </button>
          <div className="page-title">
            <h1>{currentView === 'dashboard' ? 'Live Stream' : aiViewTitles[currentView]}</h1>
            <p>{currentView === 'dashboard' ? 'Real-time stream from Camera #CAM-1023' : `AI-powered ${aiViewTitles[currentView].toLowerCase()} analysis`}</p>
          </div>
          <div className="topbar-actions">
            {/* Innovation: Night vision toggle */}
            <div className="topbar-icon" onClick={() => { setNightVision(!nightVision); toast(nightVision ? 'Night Vision Off' : 'Night Vision On'); }} title="Night Vision (N)">
              <SvgIcon path="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              {nightVision && <div className="notif-dot" style={{background: '#22c55e'}}></div>}
            </div>
            {/* Keyboard shortcuts */}
            <div className="topbar-icon" onClick={() => setShowShortcuts(true)} title="Keyboard Shortcuts (?)">
              <SvgIcon path="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </div>
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

        {/* ===== AI FEATURE VIEW MODE ===== */}
        {currentView !== 'dashboard' ? (
          <div className="ai-view-container" style={{padding: '0 28px 32px'}}>
            <div className="ai-view-layout">
              {/* Video feed */}
              <div className="ai-view-video">
                <div className="video-card">
                  <div className="video-frame" ref={videoFrameRef} style={nightVisionStyle}>
                    {video ? (
                      <div style={{width: '100%', height: '100%'}}>
                        <VideoTrack trackRef={video} />
                      </div>
                    ) : (
                      <div style={{color: 'var(--text-muted)', textAlign: 'center', paddingTop: '20%', fontSize: '14px'}}>
                        Waiting for LiveKit video stream…
                      </div>
                    )}
                    <div className="video-badges">
                      <div className="badge-group">
                        <span className="badge red">● LIVE</span>
                        <span className="badge grey">{liveTime}</span>
                      </div>
                      <div className="badge-group">
                        <span className="badge" style={{background: 'rgba(37,99,235,0.8)'}}>{aiViewTitles[currentView]}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* AI Results Panel */}
              <div className="ai-view-results panel">
                <h3 className="section-title" style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <SvgIcon path="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" style={{width: '16px', height: '16px'}} />
                  {aiViewTitles[currentView]} Results
                </h3>
                {aiViewLoading ? (
                  <div className="ai-view-loading">
                    <div className="spinner"></div>
                    <p>Running AI analysis on live feed...</p>
                  </div>
                ) : aiViewResult ? (
                  <div className="ai-view-result-content">
                    <p style={{fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap'}}>{aiViewResult}</p>
                  </div>
                ) : (
                  <div style={{color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '24px 0'}}>
                    Analysis results will appear here.
                  </div>
                )}
                <button className="btn-primary" style={{marginTop: '16px', width: '100%', justifyContent: 'center'}} onClick={() => runAiViewAnalysis(currentView)} disabled={aiViewLoading}>
                  <SvgIcon path="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" style={{width: '14px', height: '14px'}} />
                  {aiViewLoading ? 'Analyzing...' : 'Re-run Analysis'}
                </button>
                <button className="btn-outline" style={{marginTop: '8px'}} onClick={() => setCurrentView('dashboard')}>
                  ← Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ===== NORMAL DASHBOARD VIEW ===== */
          <div className="dashboard-grid">
            {/* ===== LEFT COLUMN ===== */}
            <div className="left-col">
              {/* Video Player */}
              <div className="video-card">
                <div className="video-frame" ref={videoFrameRef} style={nightVisionStyle}>
                  {video ? (
                    <div style={{width: '100%', height: '100%'}}>
                      <VideoTrack trackRef={video} />
                    </div>
                  ) : (
                    <div style={{color: 'var(--text-muted)', textAlign: 'center', paddingTop: '20%', fontSize: '14px'}}>
                      Waiting for LiveKit video stream…
                    </div>
                  )}

                  {isRecordingLocal && (
                    <div className="video-dim-overlay">
                      <span>● REC {fmtRecTime(localRecTimer)}</span>
                    </div>
                  )}
                  
                  <div className="video-badges">
                    <div className="badge-group">
                      <span className="badge red">● LIVE</span>
                      <span className="badge grey">{liveTime}</span>
                      <span className="badge grey">
                        <span className={`dot ${connected ? 'green' : 'grey'}`} style={{marginRight: '4px'}}></span>
                        {connected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                    <div className="badge-group">
                      {nightVision && <span className="badge" style={{background: 'rgba(34,197,94,0.8)'}}>🌙 NV</span>}
                      <span className="badge grey">
                        <SvgIcon path="M3 17v-5m4 5v-8m4 8V7m4 10V4" style={{width: '12px', height: '12px'}} /> 1080p
                      </span>
                      <span className="badge grey" style={{cursor: 'pointer'}} onClick={handleFullscreen}>
                        <SvgIcon path="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" style={{width: '12px', height: '12px'}} />
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="video-controls">
                  <button className="ctrl-icon" onClick={() => setIsPlaying(!isPlaying)}>
                    {isPlaying ? <SvgIcon path="M10 9v6m4-6v6" /> : <SvgIcon path="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />}
                  </button>
                  <button className="ctrl-icon" onClick={() => setAudioOn(!audioOn)} title="Mute/Unmute (M)">
                    {audioOn 
                      ? <SvgIcon path="M15.536 8.464a5 5 0 010 7.072M5 10H1v4h4l5 5V5l-5 5z" /> 
                      : <SvgIcon path="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    }
                  </button>
                  <div className="progress-bar">
                    <div className="progress-fill"></div>
                    <div className="progress-thumb"></div>
                  </div>
                  <button className="ctrl-icon" onClick={snap} title="Capture snapshot (S)">
                    <SvgIcon path="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </button>
                  {/* Innovation: PiP */}
                  <button className="ctrl-icon" onClick={handlePiP} title="Picture-in-Picture">
                    <SvgIcon path="M18 8h2a1 1 0 011 1v6a1 1 0 01-1 1h-6a1 1 0 01-1-1v-2M3 5h12a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1z" />
                  </button>
                  <button className="ctrl-icon" title="Settings">
                    <SvgIcon path="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </button>
                  {/* Gap 6: Fullscreen */}
                  <button className="ctrl-icon" onClick={handleFullscreen} title="Fullscreen (F)">
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
                    <div><h4>Local Recording</h4><p>{isRecordingLocal ? `Stop (${fmtRecTime(localRecTimer)})` : 'Record on device'}</p></div>
                  </button>
                  <button className={`action-btn ${isDesktopRec ? 'active' : ''}`} onClick={isDesktopRec ? stopDesktopRec : startDesktopRec}>
                    <div className="action-icon c-blue">
                      <SvgIcon path="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      {isDesktopRec && <div className="rec-pulse"></div>}
                    </div>
                    <div><h4>Desktop Recording</h4><p>{isDesktopRec ? 'Stop Recording' : 'Record on PC'}</p></div>
                  </button>
                  <button className={`action-btn ${isSyncing ? 'active' : ''}`} onClick={syncToServer} disabled={isSyncing}>
                    <div className="action-icon c-green">
                      <SvgIcon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      {isSyncing && <div className="rec-pulse" style={{background: 'var(--status-active)', boxShadow: '0 0 6px var(--status-active)'}}></div>}
                    </div>
                    <div><h4>Sync to Server</h4><p>{isSyncing ? 'Uploading...' : 'Upload to server'}</p></div>
                  </button>
                  <button className="action-btn" onClick={() => setShowGallery(true)}>
                    <div className="action-icon c-purple">
                      <SvgIcon path="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </div>
                    <div><h4>Download Files</h4><p>Download local &amp; server files</p></div>
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
                </div>
              </div>

              {/* Recent Recordings */}
              <div className="panel">
                <div className="section-header">
                  <h3 className="section-title" style={{margin: 0}}>Recent Recordings</h3>
                  <span className="view-all" onClick={() => setShowGallery(true)}>View All</span>
                </div>
                <div className="recordings-list">
                  {recordings.length > 0 ? recordings.slice(0, 3).map((item: any, idx: number) => (
                    <div key={idx} className="rec-item" onClick={() => openMedia(item)}>
                      <div className="rec-thumb" style={item.type === 'image' ? {backgroundImage: `url(/api/device/data/${item.name})`} : {}}>
                        {item.type !== 'image' && <SvgIcon path="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />}
                      </div>
                      <div className="rec-info">
                        <h5>{item.name || item.base}</h5>
                        <p>{item.size || item.total_size} MB{(() => { const badge = getFileStatusBadge(item.name || item.base); return badge ? ` • ${badge.label}` : ''; })()}</p>
                      </div>
                      <button className="rec-download" onClick={(e) => { e.stopPropagation(); window.open(`/api/device/download/${item.name || item.chunks?.[0]?.name}`, '_blank'); }}>
                        <SvgIcon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </button>
                    </div>
                  )) : (
                    <div style={{textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '12px'}}>No recordings found on device</div>
                  )}
                </div>
                <button className="btn-outline" onClick={() => setShowGallery(true)}>
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
                    <div className={`sys-val ${isRecordingLocal ? 'red' : ''}`}>{isRecordingLocal ? `Recording ${fmtRecTime(localRecTimer)}` : 'Not Recording'}</div>
                  </div>
                  <div className="sys-pill">
                    <div className="sys-label"><span className={`dot ${isDesktopRec ? 'red' : 'grey'}`}></span> Recording (Desktop)</div>
                    <div className={`sys-val ${isDesktopRec ? 'red' : ''}`}>{isDesktopRec ? 'Recording' : 'Not Recording'}</div>
                  </div>
                  <div className="sys-pill">
                    <div className="sys-label"><span className={`dot ${isSyncing ? 'red' : 'green'}`}></span> Server Sync</div>
                    <div className={`sys-val ${isSyncing ? 'red' : 'green'}`}>{isSyncing ? 'Syncing...' : 'Synced'}</div>
                  </div>
                </div>
              </div>

              {/* Innovation: Session Activity Timeline */}
              <div className="panel">
                <h3 className="section-title" style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <SvgIcon path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" style={{width: '16px', height: '16px'}} />
                  Activity Timeline
                </h3>
                <div className="activity-timeline">
                  {activityLog.length > 0 ? activityLog.slice(0, 8).map(ev => (
                    <div key={ev.id} className="activity-item">
                      <div className="activity-dot-line">
                        <div className="activity-dot"></div>
                        <div className="activity-line"></div>
                      </div>
                      <div className="activity-content">
                        <p className="activity-action">{ev.action}</p>
                        <p className="activity-time">{ev.timestamp.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'})}</p>
                      </div>
                    </div>
                  )) : (
                    <div style={{textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: '12px'}}>No activity yet. Actions will appear here.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
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
                    src={`/api/device/data/${selectedMedia.name || selectedMedia.chunks?.[0]?.name}`}
                    onError={() => setVideoError(true)}
                  />
                )}
              </div>
            ) : (
              <div style={{width: '100%', textAlign: 'center'}}>
                <img src={`/api/device/data/${selectedMedia.name}`} style={{maxWidth: '100%', maxHeight: '65vh', borderRadius: 'var(--radius-sm)'}} alt="Captured" />
              </div>
            )}
            <div style={{marginTop: '14px', display: 'flex', justifyContent: 'flex-end'}}>
              <a href={`/api/device/download/${selectedMedia.name || selectedMedia.chunks?.[0]?.name}`} target="_blank" rel="noopener noreferrer" className="download-link">
                <SvgIcon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /> Download instead
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
              <h3>All Media ({recordings.length})</h3>
              <button className="modal-close" onClick={() => setShowGallery(false)}>
                <SvgIcon path="M6 18L18 6M6 6l12 12" />
              </button>
            </div>
            {recordings.length > 0 ? (
              <div className="gallery-grid">
                {recordings.map((item: any, idx: number) => {
                  const statusBadge = getFileStatusBadge(item.name || item.base);
                  return (
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
                        <p style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                          {item.size || item.total_size} MB
                          {statusBadge && (
                            <span className="file-status-badge" style={{background: statusBadge.color + '22', color: statusBadge.color}}>{statusBadge.label}</span>
                          )}
                        </p>
                        <div className="gallery-actions">
                          <button className="gallery-btn primary" onClick={() => { setShowGallery(false); openMedia(item); }}>Play</button>
                          <button className="gallery-btn secondary" onClick={() => window.open(`/api/device/download/${item.name || item.chunks?.[0]?.name}`, '_blank')}>Download</button>
                          <button className="gallery-btn danger" onClick={() => setDeleteConfirm(item)}>Delete</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)'}}>No media files found on device</div>
            )}
          </div>
        </div>
      )}

      {/* ===== DELETE CONFIRMATION MODAL ===== */}
      {deleteConfirm && (
        <div className="modal-backdrop" style={{zIndex: 10001}} onClick={() => setDeleteConfirm(null)}>
          <div className="modal-content" style={{width: '400px', maxWidth: '90%'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>
                <SvgIcon path="M6 18L18 6M6 6l12 12" />
              </button>
            </div>
            <p style={{fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.6}}>
              Are you sure you want to delete <strong style={{color: '#fff'}}>{deleteConfirm.name || deleteConfirm.base}</strong>? This action cannot be undone.
            </p>
            <div style={{display: 'flex', gap: '8px', justifyContent: 'flex-end'}}>
              <button className="gallery-btn secondary" style={{flex: 'none', padding: '8px 16px'}} onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="gallery-btn danger" style={{flex: 'none', padding: '8px 16px'}} onClick={() => deleteFile(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== KEYBOARD SHORTCUTS MODAL ===== */}
      {showShortcuts && (
        <div className="modal-backdrop" onClick={() => setShowShortcuts(false)}>
          <div className="modal-content" style={{width: '440px', maxWidth: '90%'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⌨️ Keyboard Shortcuts</h3>
              <button className="modal-close" onClick={() => setShowShortcuts(false)}>
                <SvgIcon path="M6 18L18 6M6 6l12 12" />
              </button>
            </div>
            <div className="shortcuts-list">
              <div className="shortcut-row"><kbd>R</kbd><span>Toggle local recording</span></div>
              <div className="shortcut-row"><kbd>S</kbd><span>Take snapshot</span></div>
              <div className="shortcut-row"><kbd>T</kbd><span>Toggle live talk</span></div>
              <div className="shortcut-row"><kbd>F</kbd><span>Toggle fullscreen</span></div>
              <div className="shortcut-row"><kbd>M</kbd><span>Mute / unmute audio</span></div>
              <div className="shortcut-row"><kbd>G</kbd><span>Open / close gallery</span></div>
              <div className="shortcut-row"><kbd>N</kbd><span>Toggle night vision</span></div>
              <div className="shortcut-row"><kbd>?</kbd><span>Show this help</span></div>
              <div className="shortcut-row"><kbd>Esc</kbd><span>Close dialogs</span></div>
            </div>
          </div>
        </div>
      )}

      <RoomAudioRenderer muted={!audioOn} volume={1} />
    </div>
  );
}

export default function Home() {
  const [token, setToken] = useState("");
  useEffect(() => {
    fetch("/api/token").then(async r => { setToken((await r.json() as TokenResponse).token || ""); }).catch(() => {});
  }, []);
  if (!token) return (
    <main style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#0a0e17', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
      <div style={{textAlign: 'center'}}>
        <div style={{width: '32px', height: '32px', border: '3px solid #2563EB', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px'}}></div>
        <p style={{fontSize: '14px', color: '#94a3b8'}}>Connecting to LiveKit…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </main>
  );
  return (
    <LiveKitRoom token={token} serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL} connect video={false} audio={false}>
      <Dashboard />
    </LiveKitRoom>
  );
}
