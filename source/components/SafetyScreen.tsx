import React, { useState, useEffect, useRef } from 'react';
import { get, set } from 'idb-keyval';
import pptxgen from 'pptxgenjs';
import BeaconTimeline from './BeaconTimeline';
import { BeaconLog, BeaconMaster, parseVideoStartTime } from '../lib/beaconUtils';

const HazardVideoPlayer = ({ src, timestamp }: { src: string, timestamp: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    if (videoRef.current) {
      const parts = timestamp.split(':');
      if (parts.length === 3) {
        videoRef.current.currentTime = parseInt(parts[0])*3600 + parseInt(parts[1])*60 + parseInt(parts[2]);
      }
      videoRef.current.play().catch(e => console.log("Autoplay prevented", e));
    }
  }, [src, timestamp]);
  
  return (
    <video 
      ref={videoRef}
      src={src} 
      controls 
      style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} 
    />
  );
};



type SafetyScreenProps = {
  currentUser: any;
  onClose: () => void;
};

type SafetyHazard = {
  timestamp: string;
  severity: "Critical" | "Warning" | "Low";
  category: string;
  observation: string;
  recommendation: string;
  imageBase64?: string;
};

type AIReport = {
  hazards: SafetyHazard[];
  overall_score: number;
};

export default function SafetyScreen({ currentUser, onClose }: SafetyScreenProps) {
  const [apiKey, setApiKey] = useState('');
  const [videos, setVideos] = useState<string[]>([]);
  const [localVideos, setLocalVideos] = useState<{name: string, file: File}[]>([]);
  const [beaconLogs, setBeaconLogs] = useState<BeaconLog[]>([]);
  const [masterBeacons, setMasterBeacons] = useState<BeaconMaster[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  
  const [processingVideo, setProcessingVideo] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState("");
  const [playingHazard, setPlayingHazard] = useState<string | null>(null);
  const [collapsedReports, setCollapsedReports] = useState<Record<string, boolean>>({});
  
  // Stored reports
  const [reports, setReports] = useState<Record<string, AIReport>>({});

  // Cache for local video Object URLs to prevent re-renders from recreating them
  const localUrlsRef = useRef<Record<string, string>>({});

  // Hidden video ref for frame extraction
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const locations = useMemo(() => {
    const locs = new Set<string>();
    masterBeacons.forEach(mb => {
      if (mb.location_name) locs.add(mb.location_name);
    });
    return Array.from(locs);
  }, [masterBeacons]);

  useEffect(() => {
    if (locations.length > 0 && !selectedLocation) {
      setSelectedLocation(locations[0]);
    }
  }, [locations, selectedLocation]);

  const filterVideoByLocation = (v: string) => {
    if (!selectedLocation) return true;
    if (v.includes("site_1_")) return true; // BYPASS RULE
    const macs = masterBeacons.filter(mb => mb.location_name === selectedLocation).map(mb => mb.beacon_mac);
    const relevantLogs = beaconLogs.filter(log => macs.includes(log.beacon_mac));
    if (relevantLogs.length === 0) return false;

    const startMs = parseVideoStartTime(v);
    if (!startMs) return false;
    let endMs = startMs + 120000;
    const match = v.match(/(?:site_[A-Za-z0-9_-]+_)?uploaded_\d{8}_\d{6}_to_(\d{6})/);
    if (match) {
      const timeStr = match[1];
      const dateStr = v.match(/(?:site_[A-Za-z0-9_-]+_)?uploaded_(\d{8})/)?.[1] || "";
      if (dateStr) {
         const isoStr = `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}T${timeStr.substring(0,2)}:${timeStr.substring(2,4)}:${timeStr.substring(4,6)}+05:30`;
         endMs = new Date(isoStr).getTime();
      }
    }
    return relevantLogs.some(l => {
      const t = new Date(l.timestamp).getTime();
      return t >= startMs && t <= endMs;
    });
  };

  const filteredVideos = useMemo(() => videos.filter(filterVideoByLocation), [videos, selectedLocation, masterBeacons, beaconLogs]);
  const filteredLocalVideos = useMemo(() => localVideos.filter(lv => filterVideoByLocation(lv.name)), [localVideos, selectedLocation, masterBeacons, beaconLogs]);

  useEffect(() => {
    fetch('/api/transcripts/config').then(r => r.json()).then(d => {
      if (d.key) setApiKey(d.key);
    }).catch(e => console.error("Error fetching Gemini key:", e));

    fetch('/api/device/api/list_media')
      .then(res => res.json())
      .then(data => {
        let videoNames: string[] = [];
        if (Array.isArray(data)) {
          data.forEach(item => {
            if (item.type === 'batch') {
              item.chunks?.forEach((c: any) => {
                if (/\.mp4$/i.test(c.name || '')) videoNames.push(c.name);
              });
            } else if (/\.mp4$/i.test(item.name || '')) {
              videoNames.push(item.name);
            }
          });
        }
        setVideos(videoNames.sort((a, b) => b.localeCompare(a)));
      })
      .catch(err => console.error("Failed to load device media", err));
      
    // Load existing reports from IndexedDB
    get('safety_reports').then(data => {
      if (data) setReports(data);
    });

    // Auto-load previously synced local directory
    loadLocalDirectory(true);
    fetchBeaconData();
  }, []);

  const saveReport = async (videoName: string, report: AIReport) => {
    const updated = { ...reports, [videoName]: report };
    setReports(updated);
    await set('safety_reports', updated);
  };

  const loadLocalDirectory = async (silent = false) => {
    try {
      let handle: FileSystemDirectoryHandle | undefined;
      if (silent) {
        handle = await get('downloads_dir_handle');
        if (handle) {
          let perm = await (handle as any).queryPermission({ mode: 'read' });
          if (perm === 'prompt') {
            if (perm !== 'granted') return;
          } else if (perm !== 'granted') {
            return;
          }
        } else {
          return;
        }
      } else {
        if (!('showDirectoryPicker' in window)) return;
        handle = await (window as any).showDirectoryPicker({ mode: 'read' });
        await set('downloads_dir_handle', handle);
      }

      if (!handle) return;
      const foundFiles: {name: string, file: File}[] = [];
      const regex = /\.mp4$/i;
      
      for await (const entry of (handle as any).values()) {
        if (entry.kind === 'file' && regex.test(entry.name)) {
          const file = await entry.getFile();
          foundFiles.push({ name: entry.name, file });
        }
      }
      setLocalVideos(foundFiles.sort((a,b) => b.name.localeCompare(a.name)));
    } catch (err: any) {
      if (err.name !== 'AbortError') console.error("Failed to load directory", err);
    }
  };

  const handleManualFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => /\.mp4$/i.test(f.name));
    setLocalVideos(prev => {
      const combined = [...prev, ...valid.map(f => ({name: f.name, file: f}))];
      // deduplicate
      return combined.filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);
    });
  };

  const extractFrame = (videoUrl: string, timestampString: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = hiddenVideoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return reject("No video/canvas ref");

      // Parse "HH:MM:SS" to seconds
      const parts = timestampString.split(':');
      let seconds = 0;
      if (parts.length === 3) {
        seconds = parseInt(parts[0])*3600 + parseInt(parts[1])*60 + parseInt(parts[2]);
      } else if (parts.length === 2) {
        seconds = parseInt(parts[0])*60 + parseInt(parts[1]);
      } else {
        seconds = parseInt(parts[0]);
      }

      video.crossOrigin = "anonymous"; // Fix tainted canvas for proxied urls
      
      const onSeeked = () => {
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const base64 = canvas.toDataURL('image/jpeg', 0.8);
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', onError);
          resolve(base64);
        } else {
          reject("No canvas context");
        }
      };

      const onError = (e: any) => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
        reject("Video load/seek error");
      };

      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', onError);
      
      video.src = videoUrl;
      video.currentTime = seconds;
    });
  };

  const processVideo = async (videoName: string, localFile?: File) => {
    if (!apiKey) return alert("API Key not configured");
    setProcessingVideo(videoName);
    
    try {
      let fileDataPayload: any = null;

      if (localFile) {
        setProgressMsg("Uploading video locally to Gemini...");
        const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=media&key=${apiKey}`;
        const uploadRes = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': 'video/mp4' }, body: localFile });
        const uploadData = await uploadRes.json();
        if (uploadData.error) throw new Error(uploadData.error.message);
        
        let fileState = uploadData.file.state;
        while (fileState === 'PROCESSING') {
          setProgressMsg(`Processing video on Gemini (this may take 1-3 minutes)...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          const checkRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${uploadData.file.name}?key=${apiKey}`);
          const checkData = await checkRes.json();
          fileState = checkData.state;
          if (fileState === 'FAILED') throw new Error('Gemini failed to process the video file.');
        }
        fileDataPayload = { mimeType: 'video/mp4', fileUri: uploadData.file.uri };
      } else {
        // If it's a remote file, we need to download it as a Blob first so we can upload it to Gemini directly from browser.
        // Or proxy it. Due to size limits on Vercel, downloading to browser then uploading is safer.
        setProgressMsg(`Downloading remote video to browser memory...`);
        const proxyUrl = `/api/device/data/${encodeURIComponent(videoName)}`;
        const vidRes = await fetch(proxyUrl);
        const vidBlob = await vidRes.blob();
        
        setProgressMsg("Uploading downloaded video to Gemini...");
        const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=media&key=${apiKey}`;
        const uploadRes = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': 'video/mp4' }, body: vidBlob });
        const uploadData = await uploadRes.json();
        if (uploadData.error) throw new Error(uploadData.error.message);
        
        let fileState = uploadData.file.state;
        while (fileState === 'PROCESSING') {
          setProgressMsg(`Processing remote video on Gemini (this may take 1-3 minutes)...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          const checkRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${uploadData.file.name}?key=${apiKey}`);
          const checkData = await checkRes.json();
          fileState = checkData.state;
          if (fileState === 'FAILED') throw new Error('Gemini failed to process the video file.');
        }
        fileDataPayload = { mimeType: 'video/mp4', fileUri: uploadData.file.uri };
      }

      setProgressMsg("Generating AI Safety Report...");
      const prompt = `Analyze this construction site video for safety hazards. 
Identify the top 10 most critical distinct safety violations (e.g. missing hardhats, poor scaffolding, trip hazards).
For each, provide:
1. Exact timestamp (HH:MM:SS format).
2. Severity ("Critical", "Warning", or "Low").
3. Category (e.g., "PPE Violation", "Housekeeping").
4. Observation (What did you see?).
5. Recommendation (How to fix it).

Also calculate an overall_score out of 100 (100 is perfectly safe, deduct points for severity).

Output STRICTLY in this JSON format:
{
  "overall_score": 85,
  "hazards": [
    {
      "timestamp": "00:01:23",
      "severity": "Critical",
      "category": "PPE Violation",
      "observation": "Worker on left not wearing a hardhat",
      "recommendation": "Provide hardhat immediately"
    }
  ]
}`;

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
      const aiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [ { fileData: fileDataPayload }, { text: prompt } ] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      
      const aiData = await aiRes.json();
      if (aiData.error) {
        throw new Error(`Gemini API Error: ${aiData.error.message || JSON.stringify(aiData.error)}`);
      }
      if (aiData.promptFeedback && aiData.promptFeedback.blockReason) {
        throw new Error(`Safety block by Gemini: ${aiData.promptFeedback.blockReason}`);
      }
      if (!aiData.candidates || aiData.candidates.length === 0) {
        throw new Error(`No response from AI: ${JSON.stringify(aiData)}`);
      }
      const aiText = aiData.candidates[0].content.parts[0].text;
      
      let parsed: AIReport;
      try {
        let cleanText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const match = cleanText.match(/\{[\s\S]*\}/);
        if (match) cleanText = match[0];
        parsed = JSON.parse(cleanText);
      } catch (e) {
        throw new Error("Failed to parse JSON from AI.");
      }

      setProgressMsg("Extracting Photo Evidence from video timestamps...");
      const videoUrl = localFile ? URL.createObjectURL(localFile) : `/api/device/data/${encodeURIComponent(videoName)}`;
      
      // Extract photos for each hazard
      const enrichedHazards: SafetyHazard[] = [];
      for (const h of parsed.hazards || []) {
        try {
          const imgBase64 = await extractFrame(videoUrl, h.timestamp);
          enrichedHazards.push({ ...h, imageBase64: imgBase64 });
        } catch (e) {
          console.error("Frame extraction error:", e);
          enrichedHazards.push(h); // Keep without image if extraction fails
        }
      }
      parsed.hazards = enrichedHazards;

      await saveReport(videoName, parsed);
      
    } catch (err: any) {
      alert(`Error processing safety report: ${err.message}`);
    }
    setProcessingVideo(null);
  };

  const handleExportPPT = (videoName: string, report: AIReport) => {
    let pres = new pptxgen();
    pres.author = "Aspire Smart Helmet AI";
    pres.company = "Aspire";
    pres.title = `Safety Report - ${videoName}`;

    // Title Slide
    let slide = pres.addSlide();
    slide.background = { color: "1e293b" }; // slate-800
    slide.addText(`AI Safety Report`, { x: 1, y: 1.5, w: "80%", h: 1, fontSize: 36, color: "ffffff", bold: true });
    slide.addText(`Video: ${videoName}`, { x: 1, y: 2.5, w: "80%", h: 0.5, fontSize: 18, color: "cbd5e1" });
    slide.addText(`Overall Safety Score: ${report.overall_score}/100`, { x: 1, y: 3.5, w: "80%", h: 0.5, fontSize: 24, color: report.overall_score > 80 ? "22c55e" : report.overall_score > 60 ? "eab308" : "ef4444", bold: true });
    slide.addText(`Hazards Detected: ${report.hazards.length}`, { x: 1, y: 4, w: "80%", h: 0.5, fontSize: 18, color: "cbd5e1" });

    // Hazard Slides
    report.hazards.forEach((hazard, idx) => {
      let hazardSlide = pres.addSlide();
      hazardSlide.background = { color: "f8fafc" };
      
      const badgeColor = hazard.severity === 'Critical' ? 'ef4444' : hazard.severity === 'Warning' ? 'f59e0b' : '3b82f6';
      
      // Header
      hazardSlide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.8, fill: { color: badgeColor } });
      hazardSlide.addText(`Violation ${idx + 1}: ${hazard.category}`, { x: 0.5, y: 0.1, w: "90%", h: 0.6, fontSize: 24, color: "ffffff", bold: true });
      
      // Image
      if (hazard.imageBase64) {
        hazardSlide.addImage({ data: hazard.imageBase64, x: 0.5, y: 1.2, w: 4.5, h: 3 });
      }

      // Details
      let textX = 5.2;
      hazardSlide.addText(`Time: ${hazard.timestamp}`, { x: textX, y: 1.2, w: 4, h: 0.4, fontSize: 16, bold: true, color: "334155" });
      hazardSlide.addText(`Severity: ${hazard.severity}`, { x: textX, y: 1.7, w: 4, h: 0.4, fontSize: 16, bold: true, color: badgeColor });
      hazardSlide.addText(`Observation:\n${hazard.observation}`, { x: textX, y: 2.2, w: 4, h: 1, fontSize: 14, color: "475569" });
      hazardSlide.addText(`Recommendation:\n${hazard.recommendation}`, { x: textX, y: 3.2, w: 4, h: 1, fontSize: 14, color: "0f172a", bold: true });
    });

    pres.writeFile({ fileName: `Safety_Report_${videoName}.pptx` });
  };

  const getSeverityBadge = (sev: string) => {
    if (sev === 'Critical') return <span style={{ background: '#fef2f2', color: '#ef4444', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #fecaca' }}>CRITICAL</span>;
    if (sev === 'Warning') return <span style={{ background: '#fefce8', color: '#eab308', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #fef08a' }}>WARNING</span>;
    return <span style={{ background: '#f0fdfa', color: '#0d9488', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #ccfbf1' }}>LOW</span>;
  };

  const fetchBeaconData = async () => {
    try {
      const mRes = await fetch(`/api/beacons/master?site_id=${currentUser.site_id || 1}`);
      const mData = await mRes.json();
      if (mData.success) setMasterBeacons(mData.data);

      const activeDeviceId = localStorage.getItem('activeDeviceId') || currentUser.device_id || currentUser.site_id || '1';
      const lRes = await fetch(`/api/beacons/logs?r_pi_id=${activeDeviceId}&site_id=${currentUser.site_id || 1}`);
      const lData = await lRes.json();
      if (lData.success) setBeaconLogs(lData.data);
    } catch (e) {
      console.error("Failed to load beacon data:", e);
    }
  };

// Refactored SafetyVideoCard to hold its own videoRef for timeline seeking
function SafetyVideoCard({ video, isLocal, isProcessing, report, progressMsg, collapsedReports, setCollapsedReports, playingHazard, setPlayingHazard, handleExportPPT, processVideo, getSeverityBadge, beaconLogs, masterBeacons }: any) {
  const localUrlRef = useRef<string | null>(null);
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  const videoStartTime = parseVideoStartTime(video);

  const handleSeek = (seconds: number) => {
    if (mainVideoRef.current) {
      mainVideoRef.current.currentTime = seconds;
      mainVideoRef.current.play().catch(e => console.log('Autoplay prevented', e));
    }
  };

  const getVideoSrc = () => {
    if (isLocal?.file) {
      if (!localUrlRef.current) {
        localUrlRef.current = URL.createObjectURL(isLocal.file);
      }
      return localUrlRef.current;
    }
    return `/api/device/data/${encodeURIComponent(video)}`;
  };

  return (
    <div className="card" style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {video} {isLocal && <span style={{ fontSize: '12px', background: '#3b82f6', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>Local Sync</span>}
          </h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
            {report ? `Analyzed on ${new Date().toLocaleDateString()}` : 'No safety analysis run yet.'}
          </p>
        </div>
        
        {report ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Safety Score</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: report.overall_score > 80 ? '#4ade80' : report.overall_score > 60 ? '#facc15' : '#ef4444' }}>
                {report.overall_score}/100
              </div>
            </div>
            <button className="btn-primary" onClick={() => handleExportPPT(video, report)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#e11d48', padding: '8px 16px', height: '40px', fontWeight: 'bold' }}>
              Download PPT
            </button>
            <button className="btn-outline" onClick={() => processVideo(video, isLocal?.file)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', height: '40px', fontWeight: 'bold' }}>
              Re-Analyze
            </button>
          </div>
        ) : (
          <button className="btn-primary" onClick={() => processVideo(video, isLocal?.file)} disabled={isProcessing} style={{ background: '#3b82f6', padding: '8px 16px', height: '40px', fontWeight: 'bold' }}>
            {isProcessing ? "Processing..." : "Generate AI Safety Report"}
          </button>
        )}
      </div>

      <div style={{ marginTop: '16px', background: '#000', borderRadius: '8px', overflow: 'hidden' }}>
        <video 
          ref={mainVideoRef}
          src={getVideoSrc()} 
          controls 
          style={{ width: '100%', maxHeight: '400px', display: 'block' }} 
          onLoadedMetadata={() => {
            if (mainVideoRef.current) setVideoDuration(mainVideoRef.current.duration * 1000);
          }}
        />
      </div>

      <BeaconTimeline 
        videoName={video}
        videoStartMs={videoStartTime}
        videoDurationMs={videoDuration}
        logs={beaconLogs}
        masterBeacons={masterBeacons}
        onSeek={handleSeek}
      />

        {isProcessing && (
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59,130,246,0.3)', padding: '16px', borderRadius: '8px', marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#60a5fa' }}>
              <div className="spinner" style={{ width: '20px', height: '20px', borderTopColor: '#60a5fa' }}></div>
              <span style={{ fontWeight: 500 }}>{progressMsg}</span>
            </div>
          </div>
        )}

        {report && (
          <>
            <div style={{ marginTop: '24px', display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
                  {report.hazards.filter((h: any) => h.severity === 'Critical').length}
                </div>
                <div style={{ fontSize: '12px', color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Critical</div>
              </div>
              <div style={{ flex: 1, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
                  {report.hazards.filter((h: any) => h.severity === 'Warning').length}
                </div>
                <div style={{ fontSize: '12px', color: '#fcd34d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Warning</div>
              </div>
              <div style={{ flex: 1, background: 'rgba(13, 148, 136, 0.1)', border: '1px solid rgba(13, 148, 136, 0.2)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0d9488' }}>
                  {report.hazards.filter((h: any) => h.severity === 'Low').length}
                </div>
                <div style={{ fontSize: '12px', color: '#5eead4', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Low</div>
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '16px', color: '#cbd5e1' }}>Detected Violations ({report.hazards.length})</h4>
                <button 
                  onClick={() => setCollapsedReports((prev: any) => ({ ...prev, [video]: !prev[video] }))} 
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', fontWeight: 'bold' }}
                >
                  {collapsedReports[video] ? '▼ Show' : '▲ Hide'}
                </button>
              </div>
            
            {!collapsedReports[video] && (
              report.hazards.length === 0 ? (
                <div style={{ padding: '24px', background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', borderRadius: '8px', textAlign: 'center', border: '1px dashed #4ade80' }}>
                  ✅ Perfect! No safety violations detected in this video.
                </div>
              ) : (
                report.hazards.map((h: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', gap: '20px', background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b' }}>
                    
                    <div style={{ width: '240px', height: '135px', background: '#000', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                      {playingHazard === `${video}_${h.timestamp}` ? (
                        <HazardVideoPlayer 
                          src={getVideoSrc()} 
                          timestamp={h.timestamp}
                        />
                      ) : (
                        <>
                          {h.imageBase64 ? (
                            <img src={h.imageBase64} alt="Evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '12px' }}>No Image</div>
                          )}
                          <button 
                            onClick={() => setPlayingHazard(`${video}_${h.timestamp}`)}
                            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', color: '#fff' }}
                          >
                            <svg style={{ width: '48px', height: '48px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                          </button>
                        </>
                      )}
                    </div>

                    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <h5 style={{ margin: 0, fontSize: '16px', color: '#f1f5f9' }}>{h.category}</h5>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', color: '#94a3b8', background: '#1e293b', padding: '2px 8px', borderRadius: '4px' }}>{h.timestamp}</span>
                            {getSeverityBadge(h.severity)}
                          </div>
                        </div>
                        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#94a3b8', lineHeight: '1.5' }}>
                          <strong style={{ color: '#cbd5e1' }}>Observation:</strong> {h.observation}
                        </p>
                      </div>
                      <p style={{ margin: 0, fontSize: '14px', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '8px 12px', borderRadius: '6px' }}>
                        <strong>Recommendation:</strong> {h.recommendation}
                      </p>
                    </div>
                  </div>
                ))
              )
            )}
            </div>
          </>
        )}
      </div>
  );
}

  return (
    <div className="animate-fade-in" style={{ padding: '0 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 600 }}>AI Safety Command Center</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Identify hazards, view photo evidence, and export presentation reports instantly.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select 
            value={selectedLocation} 
            onChange={e => setSelectedLocation(e.target.value)}
            style={{
              padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.2)',
              background: 'rgba(255, 255, 255, 0.1)', color: '#fff', outline: 'none'
            }}
          >
            {locations.length === 0 && <option value="">No Beacons Found</option>}
            {locations.map(loc => (
              <option key={loc} value={loc} style={{color: '#000'}}>{loc}</option>
            ))}
          </select>
          
          <button onClick={() => loadLocalDirectory(false)} style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.4)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            🔗 Sync Local Folder
          </button>
          
          <label style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            📁 Select Files
            <input type="file" multiple accept="video/mp4" onChange={handleManualFiles} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Hidden elements for native processing */}
      <video ref={hiddenVideoRef} style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {filteredVideos.length === 0 && filteredLocalVideos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            No videos found for this location. Upload videos to the device or sync a local folder.
          </div>
        )}

        {filteredLocalVideos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 style={{ color: '#4ade80', margin: '0 0 10px 0', fontSize: '1.1rem' }}>💻 Locally Synced Videos</h3>
            {filteredLocalVideos.map(lv => (
              <SafetyVideoCard 
                key={lv.name}
                video={lv.name}
                isLocal={lv}
                isProcessing={processingVideo === lv.name}
                report={reports[lv.name]}
                progressMsg={progressMsg}
                collapsedReports={collapsedReports}
                setCollapsedReports={setCollapsedReports}
                playingHazard={playingHazard}
                setPlayingHazard={setPlayingHazard}
                handleExportPPT={handleExportPPT}
                processVideo={processVideo}
                getSeverityBadge={getSeverityBadge}
                beaconLogs={beaconLogs}
                masterBeacons={masterBeacons}
              />
            ))}
          </div>
        )}

        {filteredVideos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 style={{ color: '#60a5fa', margin: '0 0 10px 0', fontSize: '1.1rem' }}>🎥 Helmet Videos</h3>
            {filteredVideos.map(v => (
              <SafetyVideoCard 
                key={v}
                video={v}
                isProcessing={processingVideo === v}
                report={reports[v]}
                progressMsg={progressMsg}
                collapsedReports={collapsedReports}
                setCollapsedReports={setCollapsedReports}
                playingHazard={playingHazard}
                setPlayingHazard={setPlayingHazard}
                handleExportPPT={handleExportPPT}
                processVideo={processVideo}
                getSeverityBadge={getSeverityBadge}
                beaconLogs={beaconLogs}
                masterBeacons={masterBeacons}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

