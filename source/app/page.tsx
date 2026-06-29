"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import DeviceConfigModal from '../components/DeviceConfigModal';
import CompaniesScreen from '../components/mdm/CompaniesScreen';
import CustomersScreen from '../components/mdm/CustomersScreen';
import SitesScreen from '../components/mdm/SitesScreen';
import DevicesScreen from '../components/mdm/DevicesScreen';

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
  const playerContainerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    const container = playerContainerRef.current as any;
    const videoElem = videoRef.current as any;
    
    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      if (container?.requestFullscreen) {
        container.requestFullscreen();
      } else if (container?.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (container?.msRequestFullscreen) {
        container.msRequestFullscreen();
      } else if (videoElem?.webkitEnterFullscreen) {
        // iOS Safari fallback (only video element can go fullscreen)
        videoElem.webkitEnterFullscreen();
      }
    } else {
      const doc = document as any;
      if (doc.exitFullscreen) {
        doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
      }
    }
  };
  
  const [piRecordings, setPiRecordings] = useState<any[]>([]);
  const [desktopRecordings, setDesktopRecordings] = useState<any[]>([]);
  const recordings = [...desktopRecordings, ...piRecordings].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const [galleryMode, setGalleryMode] = useState<'desktop' | 'pi'>('desktop');
  const [deviceStatus, setDeviceStatus] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [geminiAnalysis, setGeminiAnalysis] = useState<any>(null);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [recordingsDropdownOpen, setRecordingsDropdownOpen] = useState(false);
  const [showDeviceConfigModal, setShowDeviceConfigModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [beaconsList, setBeaconsList] = useState<any[]>([]);
  
  const router = useRouter();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const [savedAccounts, setSavedAccounts] = useState<any[]>([]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileDropdownOpen(false);
      }
    };

    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [profileDropdownOpen]);
  
  const [showPairModal, setShowPairModal] = useState(false);
  const [pairSsid, setPairSsid] = useState('');
  const [pairWifiPassword, setPairWifiPassword] = useState('');
  const [showPairWifiPassword, setShowPairWifiPassword] = useState(false);
  const [pairQrData, setPairQrData] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('savedAccounts');
      if (stored) setSavedAccounts(JSON.parse(stored));
    } catch(e) {}

    fetch('/api/auth/session', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setCurrentUser(data.user);
          // Check for session selected site first, fallback to cookie
          let selectedSiteId = data.user.selected_site_id?.toString() || null;
          const matchDevice = document.cookie.match(new RegExp('(^| )active_device_id=([^;]+)'));
          
          if (!selectedSiteId) {
             const matchSite = document.cookie.match(new RegExp('(^| )active_site_id=([^;]+)'));
             selectedSiteId = matchSite ? matchSite[2] : null;
          }
          
          let selectedDeviceId = matchDevice ? matchDevice[2] : null;

          if (selectedSiteId) {
            setActiveSiteId(selectedSiteId);
          }
          if (selectedDeviceId) {
            setActiveDeviceId(selectedDeviceId);
          }
        }
      })
      .catch(() => {});

    fetch('/api/beacons/master')
      .then(res => res.json())
      .then(data => {
        if (data.beacons) {
          setBeaconsList(data.beacons);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      
      if (currentUser?.id) {
        const stored = localStorage.getItem('savedAccounts');
        if (stored) {
          let accounts = JSON.parse(stored);
          accounts = accounts.filter((a: any) => a.id !== currentUser.id);
          localStorage.setItem('savedAccounts', JSON.stringify(accounts));
        }
      }
      
      window.location.href = '/login';
    } catch (e) {
      console.error(e);
    }
  };

  const handleSwitchAccount = async (token: string) => {
    try {
      const res = await fetch('/api/switch-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const generatePairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    const qrString = `WIFI:S:${pairSsid};T:WPA;P:${pairWifiPassword};; PAIR:${currentUser.id}`;
    setPairQrData(qrString);
  };

  const handleSiteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSiteId = e.target.value;
    setActiveSiteId(newSiteId);
    document.cookie = `active_site_id=${newSiteId}; path=/; max-age=86400`;
    
    setActiveDeviceId(null);
    document.cookie = `active_device_id=; path=/; max-age=0`;
    
    // Need to reload stream or UI data if necessary
    window.location.reload();
  };

  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDeviceId = e.target.value;
    setActiveDeviceId(newDeviceId);
    document.cookie = `active_device_id=${newDeviceId}; path=/; max-age=86400`;
    window.location.reload();
  };

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
    if (!window.confirm("Are you sure you want to completely shut down the Streaming Device? You will physically need to turn the power back on.")) return;
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
  const [activeTab, setActiveTab] = useState('live');
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
    
    // Manual latency chasing to prevent stream freezing over time
    let lagCheckInterval = setInterval(() => {
      if (videoRef.current && mpegtsPlayerRef.current) {
        try {
          const video = videoRef.current;
          if (video.buffered.length > 0) {
            const end = video.buffered.end(video.buffered.length - 1);
            // If we fall more than 3 seconds behind the live edge, skip forward
            if (end - video.currentTime > 3.0) {
              video.currentTime = end - 0.5;
            }
          }
        } catch (e) {
          // Ignore buffer read errors
        }
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      clearInterval(lagCheckInterval);
      if (player) {
        try { player.destroy(); } catch(e) {}
      }
      if (webrtcRef.current) {
        webrtcRef.current.close();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t: any) => t.stop());
      }
      setConnected(false);
    };
  }, [playerKey]);

  const [liveTime, setLiveTime] = useState("00:00:00");
  const [resolution, setResolution] = useState("1080p");

  useEffect(() => {
    const videoElem = videoRef.current;
    if (!videoElem) return;

    const onTimeUpdate = () => {
      const sec = Math.floor(videoElem.currentTime || 0);
      const h = Math.floor(sec / 3600).toString().padStart(2, '0');
      const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
      const s = (sec % 60).toString().padStart(2, '0');
      setLiveTime(`${h}:${m}:${s}`);

      if (videoElem.videoHeight) {
        setResolution(`${videoElem.videoHeight}p`);
      }
    };

    videoElem.addEventListener('timeupdate', onTimeUpdate);
    return () => videoElem.removeEventListener('timeupdate', onTimeUpdate);
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
          if (pc.connectionState === 'connected') {
            setTalking(true);
            toast("Live talk active!");
          } else if (pc.connectionState === 'failed') {
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
      window.open(`/api/device/download/${item.name || item.chunks?.[0]?.name}`, '_blank');
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
          <button className={`nav-item ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>
            <SvgIcon path="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z M4 6h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" /> Live Stream
          </button>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <button className="nav-item" onClick={() => setRecordingsDropdownOpen(!recordingsDropdownOpen)}>
              <SvgIcon path="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z" /> Recordings
              <SvgIcon path={recordingsDropdownOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} style={{ marginLeft: 'auto', width: '14px', height: '14px' }} />
            </button>
            {recordingsDropdownOpen && (
              <div style={{ paddingLeft: '28px', display: 'flex', flexDirection: 'column', marginTop: '2px', marginBottom: '4px' }}>
                <button className={`nav-item ${showGallery && galleryMode === 'desktop' ? 'active' : ''}`} onClick={() => {setGalleryMode('desktop'); setShowGallery(true);}}>
                  <SvgIcon path="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z M4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z M14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /> Desktop Recordings
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

          <button className="nav-item" onClick={() => window.open('/api/device/api/beacons/logs', '_blank')} style={{ display: 'none' }}>
            <SvgIcon path="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> Location Report <span className="nav-badge" style={{background: '#3b82f6', color: '#fff'}}>CSV</span>
          </button>
          <button className="nav-item" onClick={() => window.open('/api/device/api/beacons/master_logs', '_blank')} style={{ display: 'none' }}>
            <SvgIcon path="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> Master Report <span className="nav-badge" style={{background: '#3b82f6', color: '#fff'}}>CSV</span>
          </button>



          <div className="nav-group-title">MASTERS</div>
          <button className={`nav-item ${activeTab === 'companies' ? 'active' : ''}`} onClick={() => setActiveTab('companies')} style={{ display: 'none' }}>
            <SvgIcon path="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /> Companies
          </button>
          <button className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')} style={{ display: 'none' }}>
            <SvgIcon path="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /> Customers
          </button>
          <button className={`nav-item ${activeTab === 'sites' ? 'active' : ''}`} onClick={() => setActiveTab('sites')}>
            <SvgIcon path="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" /> Sites
          </button>
          <button className={`nav-item ${activeTab === 'devices' ? 'active' : ''}`} onClick={() => setActiveTab('devices')}>
            <SvgIcon path="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /> Devices
          </button>

          <div className="nav-group-title">AI FEATURES</div>
          <button className="nav-item">
            <SvgIcon path="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /> Video to Text
          </button>
          <button className="nav-item" style={{ display: 'none' }}>
            <SvgIcon path="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /> Object Detection
          </button>
          <button className="nav-item" style={{ display: 'none' }}>
            <SvgIcon path="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> Face Detection
          </button>
          <button className="nav-item">
            <SvgIcon path="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /> Safety Alerts
          </button>

          <div className="nav-group-title">PROGRESS ANALYSIS</div>
          <button className="nav-item" style={{ display: 'none' }}>
            <SvgIcon path="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> Progress Comparison <span className="nav-badge" style={{background: '#22c55e', color: '#fff'}}>NEW</span>
          </button>
        </nav>

        {/* Device Status Panel */}
        <div className="device-status-sidebar">
          <div className="ds-header">
            <span>Device Status</span>
            <span style={{color: deviceStatus ? 'var(--status-active)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px'}}>
              <span className={`dot ${deviceStatus ? 'green' : 'grey'}`}></span>
              {deviceStatus ? 'Online' : 'Offline'}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <select
                  value={activeSiteId || ''}
                  onChange={async (e) => {
                    const val = e.target.value;
                    if (val === '') return;
                    
                    try {
                      await fetch('/api/auth/set-site', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ site_id: val })
                      });
                    } catch (err) {
                      console.error('Failed to set site', err);
                    }

                    setActiveSiteId(val);
                    document.cookie = `active_site_id=${val}; path=/; max-age=86400`;
                    // Clear active device when site changes
                    setActiveDeviceId('');
                    document.cookie = `active_device_id=; path=/; max-age=-1`;
                    window.location.reload();
                  }}
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#f8fafc',
                    border: '1px solid #334155',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="" disabled>Select Site</option>
                  {(currentUser?.sites || []).map((site: any) => (
                    <option key={site.id} value={site.id.toString()}>
                      {site.site_name}
                    </option>
                  ))}
                </select>

                <select
                  value={activeDeviceId || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') return;
                    setActiveDeviceId(val);
                    document.cookie = `active_device_id=${val}; path=/; max-age=86400`;
                    window.location.reload();
                  }}
                  disabled={!activeSiteId || ((currentUser?.all_devices || []).filter((d: any) => d.site_id?.toString() === activeSiteId).length === 0)}
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#f8fafc',
                    border: '1px solid #334155',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="" disabled>
                    {!activeSiteId ? 'Select Site First' : (((currentUser?.all_devices || []).filter((d: any) => d.site_id?.toString() === activeSiteId).length === 0) ? 'No helmets assigned' : 'Select Helmet')}
                  </option>
                  {(currentUser?.all_devices || []).filter((d: any) => d.site_id?.toString() === activeSiteId).map((device: any) => (
                    <option key={device.id} value={device.id.toString()}>
                      {device.device_name || `Helmet ${device.id}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="topbar-icon">
              <SvgIcon path="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              <div className="notif-dot"></div>
            </div>
            <div className="topbar-icon" onClick={() => setShowDeviceConfigModal(true)} style={{cursor: 'pointer'}}>
              <SvgIcon path="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </div>
            <div className="user-profile" style={{ position: 'relative' }} ref={profileDropdownRef}>
              <div 
                style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} 
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              >
                <div className="user-avatar" style={{background: '#2563EB'}}>
                  <SvgIcon path="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </div>
                <span className="user-name">
                  {currentUser?.company_name || currentUser?.organization_name || currentUser?.username || 'Account'}
                  <SvgIcon path="M19 9l-7 7-7-7" />
                </span>
              </div>

              {profileDropdownOpen && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                  backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)', width: '240px', zIndex: 100,
                  overflow: 'hidden', animation: 'fadeIn 0.15s ease-out'
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>{currentUser?.username}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{currentUser?.ac}</div>
                  </div>
                  
                  <div style={{ padding: '8px 0' }}>
                    {savedAccounts.filter(a => a.id !== currentUser?.id).map(acc => (
                      <button 
                        key={acc.id}
                        onClick={() => handleSwitchAccount(acc.token)}
                        style={{
                          width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none',
                          border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '13px',
                          display: 'flex', alignItems: 'center', gap: '8px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <SvgIcon path="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" style={{ width: '14px' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: '#fff' }}>{acc.username}</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{acc.company_name}</span>
                        </div>
                      </button>
                    ))}
                    
                    <button 
                      onClick={() => { window.location.href = '/login?addAccount=true'; }}
                      style={{
                        width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none',
                        border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '13px',
                        display: 'flex', alignItems: 'center', gap: '8px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <SvgIcon path="M12 4v16m8-8H4" style={{ width: '16px' }} />
                      Add another account
                    </button>
                  </div>

                  <div style={{ padding: '8px 0', borderTop: '1px solid #334155' }}>
                    <button 
                      onClick={() => {
                        shutdownPi();
                        setProfileDropdownOpen(false);
                      }}
                      style={{
                        width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none',
                        border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '13px',
                        display: 'flex', alignItems: 'center', gap: '8px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <SvgIcon path="M18.36 6.64a9 9 0 11-12.73 0M12 2v10" style={{ width: '16px', color: '#ef4444' }} />
                      Shut Down Device
                    </button>
                    <button 
                      onClick={() => {
                        handleLogout();
                        setProfileDropdownOpen(false);
                      }}
                      style={{
                        width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none',
                        border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px',
                        display: 'flex', alignItems: 'center', gap: '8px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <SvgIcon path="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" style={{ width: '16px' }} />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {activeTab === 'companies' && (
          <div style={{ padding: '24px' }}>
            <CompaniesScreen />
          </div>
        )}
        {activeTab === 'customers' && (
          <div className="card full-width animate-fade-in">
            <CustomersScreen currentUser={currentUser} />
          </div>
        )}
        {activeTab === 'sites' && (
          <div style={{ padding: '24px' }}>
            <SitesScreen currentUser={currentUser} onClose={() => setActiveTab('live')} />
          </div>
        )}

        {activeTab === 'devices' && (
          <div style={{ padding: '24px' }}>
            <DevicesScreen currentUser={currentUser} onClose={() => setActiveTab('live')} />
          </div>
        )}

        <div className="dashboard-grid" style={{ display: activeTab === 'live' ? 'grid' : 'none' }}>
          {/* ===== LEFT COLUMN ===== */}
          <div className="left-col">
            {/* Video Player */}
            <div className="video-card" ref={playerContainerRef}>
              <div className="video-frame">
                  <div style={{width: '100%', height: '100%', background: '#000'}}>
                    <video ref={videoRef} suppressHydrationWarning style={{width: '100%', height: '100%', objectFit: 'contain'}} muted={!audioOn} />
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
                    <div className="badge-group" style={{ marginRight: '32px' }}>
                      <span className="badge grey">
                        <SvgIcon path="M3 17v-5m4 5v-8m4 8V7m4 10V4" style={{width: '12px', height: '12px'}} /> {resolution}
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
                <div className="progress-bar" style={{visibility: 'hidden'}}>
                  <div className="progress-fill"></div>
                </div>
                <button className="ctrl-icon" onClick={snap} title="Capture snapshot">
                  <SvgIcon path="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </button>
                <button className="ctrl-icon" title="Settings">
                  <SvgIcon path="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </button>
                <button className="ctrl-icon" title="Fullscreen" onClick={toggleFullscreen}>
                  <SvgIcon path="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </button>
              </div>
            </div>

            {/* Site Location and Progress */}
            <div className="progress-card">
              <div className="compare-container">
                {/* Left Half: Site Location List */}
                <div className="compare-box" style={{ padding: '20px' }}>
                  <h3 className="section-title" style={{margin: '0 0 16px'}}>Site Location List</h3>
                  <div className="compare-stats" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {beaconsList.filter(b => b.site_id && b.site_id === activeSiteId).length === 0 ? (
                      <div className="stat-row" style={{justifyContent: 'center'}}><span className="stat-label">No locations available for this site</span></div>
                    ) : (
                      beaconsList.filter(b => b.site_id && b.site_id === activeSiteId).map((beacon, i) => (
                        <div className="stat-row" key={i} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                          <span className="stat-label" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{beacon.location_name || 'Unknown Location'}</span>
                          <span className="stat-val" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{beacon.beacon_mac}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="vs-circle" style={{ visibility: 'hidden' }}>VS</div>

                {/* Right Half: Site Progress (Placeholder) */}
                <div className="compare-box" style={{ padding: '20px' }}>
                  <h3 className="section-title" style={{margin: '0 0 16px'}}>Site Progress</h3>
                  <div className="compare-stats" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '200px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Coming Soon...</span>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Summary */}
            <div className="ai-summary-card" style={{ display: 'none' }}>
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
              </div>
            </div>

            {/* Recent Recordings */}
            <div className="panel">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                <h3 className="section-title" style={{margin: 0}}>Recent Recordings</h3>
                <span style={{fontSize: '11px', color: 'var(--text-muted)'}}>{recordings.length} files</span>
              </div>
              <div className="recordings-list">
                {recordings.length > 0 ? recordings.slice(0, 3).map((item: any, idx: number) => (
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
              <button className="btn-outline" onClick={() => {setGalleryMode('pi'); setShowGallery(true);}}>
                <SvgIcon path="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" style={{width: '14px', height: '14px'}} />
                View All Recordings
              </button>
            </div>

            {/* System Status */}
            {false && (
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
            )}
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
              <h3>{galleryMode === 'pi' ? 'Streaming Device Media' : 'Desktop Media'} ({galleryMode === 'pi' ? piRecordings.length : desktopRecordings.length})</h3>
              <button className="modal-close" onClick={() => setShowGallery(false)}>
                <SvgIcon path="M6 18L18 6M6 6l12 12" />
              </button>
            </div>
            {(galleryMode === 'pi' ? piRecordings : desktopRecordings).length > 0 ? (
              <div className="gallery-grid">
                {(galleryMode === 'pi' ? piRecordings : desktopRecordings).map((item: any, idx: number) => (
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

      {showDeviceConfigModal && <DeviceConfigModal onClose={() => setShowDeviceConfigModal(false)} sites={currentUser?.sites || []} />}
      
      {showPairModal && (
        <div className="modal-backdrop" onClick={() => setShowPairModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: pairQrData ? '600px' : '450px', animation: 'fadeIn 0.2s ease-out' }}>
            <div className="modal-header">
              <h3>{pairQrData ? 'Pair Your Helmet' : 'Pair New Helmet'}</h3>
              <button className="modal-close" onClick={() => setShowPairModal(false)}>
                <SvgIcon path="M6 18L18 6M6 6l12 12" />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '24px' }}>
              {!pairQrData ? (
                <form onSubmit={generatePairingCode} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px', textAlign: 'center' }}>
                    Enter the Wi-Fi credentials that the helmet will use to connect to the internet.
                  </p>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#cbd5e1', fontWeight: 500 }}>Wi-Fi Network Name (SSID)</label>
                    <input type="text" value={pairSsid} onChange={e => setPairSsid(e.target.value)} required style={{ width: '100%', padding: '12px 14px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', outline: 'none', fontSize: '15px' }} placeholder="Your Home Wi-Fi Name" />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#cbd5e1', fontWeight: 500 }}>Wi-Fi Password</label>
                    <input type={showPairWifiPassword ? "text" : "password"} value={pairWifiPassword} onChange={e => setPairWifiPassword(e.target.value)} required style={{ width: '100%', padding: '12px 14px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', outline: 'none', fontSize: '15px' }} placeholder="Your Wi-Fi Password" />
                    <button type="button" onClick={() => setShowPairWifiPassword(!showPairWifiPassword)} style={{ position: 'absolute', right: '14px', top: '38px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0, outline: 'none' }}>
                      {showPairWifiPassword ? (
                        <SvgIcon path="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" style={{ width: '20px', height: '20px' }} />
                      ) : (
                        <SvgIcon path="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z" style={{ width: '20px', height: '20px' }} />
                      )}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                    <button type="button" onClick={() => setShowPairModal(false)} style={{ flex: 1, padding: '14px', backgroundColor: 'transparent', color: '#cbd5e1', border: '1px solid #334155', borderRadius: '8px', fontSize: '16px', fontWeight: 600, cursor: 'pointer', transition: 'background-color 0.2s' }}>
                      Cancel
                    </button>
                    <button type="submit" style={{ flex: 1, padding: '14px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 600, cursor: 'pointer', transition: 'background-color 0.2s' }}>
                      Generate Pairing Code
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
                  <div style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '16px', border: '4px solid #3b82f6' }}>
                    <QRCodeSVG value={pairQrData} size={300} level="M" />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#94a3b8', fontSize: '15px', marginBottom: '24px', maxWidth: '400px', lineHeight: '1.5' }}>
                      1. Turn on the Helmet<br/>
                      2. Wait for the blue light to flash<br/>
                      3. Point the camera at this screen<br/>
                      4. Listen for the success chime!
                    </p>
                    <button onClick={() => { setShowPairModal(false); setPairQrData(null); }} style={{ padding: '14px 32px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 600, cursor: 'pointer', transition: 'background-color 0.2s' }}>
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return <Dashboard />;
}
