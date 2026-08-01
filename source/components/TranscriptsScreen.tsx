import React, { useState, useEffect, useRef } from 'react';
import { get, set } from 'idb-keyval';
import BeaconTimeline from './BeaconTimeline';
import { BeaconLog, BeaconMaster, parseVideoStartTime } from '../lib/beaconUtils';

// NOTE: This relies on the Google Generative AI REST API to avoid requiring the SDK in the browser bundle
// which could cause webpack issues or expose too much. 
// Added persistent video player for beacon timeline interactivity.

type TranscriptsScreenProps = {
  currentUser: any;
  onClose: () => void;
};

// --- Child Component for Individual Transcripts ---
function TranscriptItem({ video, localFile, initialData, apiKey, generateTranscript, globalStatus, logs, masterBeacons }: { video: string, localFile?: File, initialData: any, apiKey: string, generateTranscript: (v: string, f?: File) => void, globalStatus: string, logs: BeaconLog[], masterBeacons: BeaconMaster[] }) {
  const [displayData, setDisplayData] = useState(initialData);
  const [targetLang, setTargetLang] = useState('English');
  const [isTranslating, setIsTranslating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  const videoStartTime = parseVideoStartTime(video);

  const handleSeek = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play().catch(e => console.log('Autoplay prevented', e));
    }
  };

  // Update display data if initialData changes (e.g. freshly generated)
  useEffect(() => {
    setDisplayData(initialData);
    setTargetLang('English');
  }, [initialData]);

  const handleTranslate = async (lang: string) => {
    setTargetLang(lang);
    if (lang === 'English') {
      setDisplayData(initialData);
      return;
    }
    
    setIsTranslating(true);
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
      const aiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `Translate the following JSON object's values into ${lang}. Keep the exact same JSON structure and keys ('summary' and 'transcript'). Do not add markdown.\n\n${JSON.stringify(initialData)}` }]
          }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const aiData = await aiRes.json();
      const aiText = aiData.candidates[0].content.parts[0].text;
      
      let cleanText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const match = cleanText.match(/\{[\s\S]*\}/);
      if (match) cleanText = match[0];
      setDisplayData(JSON.parse(cleanText));
    } catch (e) {
      console.error(e);
      alert('Translation failed. Please try again.');
      setTargetLang('English');
      setDisplayData(initialData);
    }
    setIsTranslating(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`Summary:\n${currentData.summary}\n\nTranscript:\n${currentData.transcript}`);
    alert('Copied to clipboard!');
  };

  const handleDownloadWord = () => {
    const content = `
      <html xmlns:w="urn:schemas-microsoft-com:office:word">
      <head><meta charset="utf-8"></head>
      <body>
        <h1>Transcript for ${video}</h1>
        <h2>Executive Summary</h2>
        <p>${currentData.summary.replace(/\n/g, '<br/>')}</p>
        <h2>Full Transcript</h2>
        <p>${currentData.transcript.replace(/\n/g, '<br/>')}</p>
      </body>
      </html>
    `;
    const blob = new Blob([content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Transcript_${video}.doc`;
    a.click();
  };

  const handleDownloadPDF = () => {
    const printWindow = window.open('', '', 'height=800,width=800');
    if (!printWindow) {
      alert("Please allow popups to generate PDF");
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>Transcript_${video}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #000; background: #fff; }
            h1 { color: #333; font-size: 24px; border-bottom: 2px solid #ccc; padding-bottom: 10px; }
            h2 { color: #555; margin-top: 30px; font-size: 20px; }
            p { white-space: pre-wrap; font-size: 14px; }
            .alert { color: #d32f2f; font-weight: bold; padding: 10px; border: 1px solid #d32f2f; background: #ffebee; }
          </style>
        </head>
        <body>
          <h1>Video Transcript: ${video}</h1>
          <h2>Executive Summary</h2>
          <p>${currentData.summary.replace(/\[SAFETY ALERTS\]:[\s\S]*/, '')}</p>
          ${currentData.summary.includes('[SAFETY ALERTS]:') ? `
            <h2>Safety Alerts</h2>
            <div class="alert"><p>${currentData.summary.split('[SAFETY ALERTS]:')[1]}</p></div>
          ` : ''}
          <h2>Full Transcript</h2>
          <p>${currentData.transcript}</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const highlightText = (text: string) => {
    if (!searchQuery) return text;
    const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === searchQuery.toLowerCase() ? <span key={i} style={{ background: '#fef08a', color: '#854d0e', padding: '0 2px', borderRadius: '3px', fontWeight: 'bold' }}>{part}</span> : part
    );
  };

  // Use derived data to prevent render crashes when initialData updates before useEffect runs
  const currentData = displayData || initialData;

  let normalSummary = currentData?.summary || '';
  let safetyAlerts = '';
  
  if (currentData?.safety_alerts && Array.isArray(currentData.safety_alerts) && currentData.safety_alerts.length > 0) {
    safetyAlerts = currentData.safety_alerts.map((alert: string) => `• ${alert}`).join('\n');
  } else if (normalSummary.includes('[SAFETY ALERTS]:')) {
    // Fallback for older transcripts that used the string format
    const parts = normalSummary.split('[SAFETY ALERTS]:');
    normalSummary = parts[0];
    safetyAlerts = parts[1];
  }

  return (
    <div style={{ 
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.08)', 
      padding: '24px', 
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      transition: 'transform 0.2s ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '8px', borderRadius: '8px' }}>🎥</span>
          <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem', wordBreak: 'break-all' }}>{video}</h3>
        </div>
        
        {!initialData && !globalStatus && (
          <button 
            onClick={() => generateTranscript(video, localFile)}
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px',
              fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center',
              gap: '8px', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)', transition: 'transform 0.1s'
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            ✨ Generate AI Transcript
          </button>
        )}
      </div>
      
      {/* Persistent Video Player with Beacon Timeline */}
      <div style={{ marginTop: '16px', background: '#000', borderRadius: '8px', overflow: 'hidden' }}>
        <video 
          ref={videoRef}
          src={localFile ? URL.createObjectURL(localFile) : `/api/device/data/${encodeURIComponent(video)}`} 
          controls 
          style={{ width: '100%', maxHeight: '400px', display: 'block' }} 
          onLoadedMetadata={() => {
            if (videoRef.current) setVideoDuration(videoRef.current.duration * 1000);
          }}
        />
      </div>

      <BeaconTimeline 
        videoName={video}
        videoStartMs={videoStartTime}
        videoDurationMs={videoDuration}
        logs={logs}
        masterBeacons={masterBeacons}
        onSeek={handleSeek}
      />

      {initialData && currentData && (
        <div style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Action Bar (Export, Translate, Search) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '12px 15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select 
                value={targetLang} 
                onChange={(e) => handleTranslate(e.target.value)}
                disabled={isTranslating}
                style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '6px', outline: 'none' }}
              >
                <option value="English" style={{color: '#000'}}>🇺🇸 English</option>
                <option value="Hindi" style={{color: '#000'}}>🇮🇳 Hindi</option>
                <option value="Marathi" style={{color: '#000'}}>🚩 Marathi</option>
                <option value="Bengali" style={{color: '#000'}}>🐅 Bengali</option>
                <option value="Telugu" style={{color: '#000'}}>🌅 Telugu</option>
                <option value="Tamil" style={{color: '#000'}}>🛕 Tamil</option>
                <option value="Gujarati" style={{color: '#000'}}>🦁 Gujarati</option>
                <option value="Kannada" style={{color: '#000'}}>🐘 Kannada</option>
                <option value="Malayalam" style={{color: '#000'}}>🌴 Malayalam</option>
              </select>
              {isTranslating && <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Translating...</span>}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
              <input 
                type="text" 
                placeholder="🔍 Search transcript..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '6px', outline: 'none', width: '180px', flexGrow: 1 }}
              />
              <button onClick={() => { if(window.confirm('Are you sure you want to regenerate? This will overwrite the current transcript.')) generateTranscript(video, localFile); }} title="Regenerate Transcript" style={{ background: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(139, 92, 246, 0.5)', color: '#a78bfa', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', flexGrow: 1 }}>🔄 Regenerate</button>
              <button onClick={handleCopy} title="Copy to Clipboard" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', flexGrow: 1 }}>📋 Copy</button>
              <button onClick={handleDownloadWord} title="Download Word Doc" style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.5)', color: '#60a5fa', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', flexGrow: 1 }}>📝 Word</button>
              <button onClick={handleDownloadPDF} title="Download PDF" style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#f87171', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', flexGrow: 1 }}>📄 PDF</button>
            </div>
          </div>

          {/* Safety Alerts */}
          {safetyAlerts && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '16px', borderRadius: '10px', borderLeft: '4px solid #ef4444', borderRight: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#f87171', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚠️ Safety Alerts Detected
              </h4>
              <p style={{ margin: 0, color: '#fca5a5', lineHeight: '1.6', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
                {highlightText(safetyAlerts.trim())}
              </p>
            </div>
          )}

          {/* Summary Block */}
          <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '20px', borderRadius: '10px', borderLeft: '4px solid #3b82f6', borderRight: '1px solid rgba(255,255,255,0.03)' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#60a5fa', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📋 Executive Summary
            </h4>
            <p style={{ margin: 0, color: '#e2e8f0', lineHeight: '1.6', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
              {highlightText(normalSummary.trim())}
            </p>
          </div>

          {/* Full Transcript Block */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', color: '#94a3b8', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📝 Full Transcript
            </h4>
            <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '20px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)', maxHeight: '350px', overflowY: 'auto' }}>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#cbd5e1', lineHeight: '1.7', fontSize: '0.9rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {highlightText(currentData.transcript)}
              </p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}


// --- Main Screen ---
export default function TranscriptsScreen({ currentUser, onClose }: TranscriptsScreenProps) {
  const [videos, setVideos] = useState<string[]>([]);
  const [localVideos, setLocalVideos] = useState<{name: string, file: File}[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [transcripts, setTranscripts] = useState<Record<string, any>>({});
  
  const [beaconLogs, setBeaconLogs] = useState<BeaconLog[]>([]);
  const [masterBeacons, setMasterBeacons] = useState<BeaconMaster[]>([]);

  useEffect(() => {
    fetchVideos();
    fetchApiKey();
    loadLocalDirectory(true); // Attempt silent restore from IndexedDB
    fetchBeaconData();
  }, []);

  const fetchBeaconData = async () => {
    try {
      // 1. Fetch master beacons for site
      const mRes = await fetch(`/api/beacons/master?site_id=${currentUser.site_id || 1}`);
      const mData = await mRes.json();
      if (mData.success) setMasterBeacons(mData.data);

      // 2. Fetch logs for device (batch fetch everything for now, can be optimized later with start/end if needed)
      // activeDeviceId is needed here, assuming currentUser.r_pi_id or from localStorage
      const activeDeviceId = localStorage.getItem('activeDeviceId') || currentUser.device_id || currentUser.site_id || '1';
      const lRes = await fetch(`/api/beacons/logs?r_pi_id=${activeDeviceId}&site_id=${currentUser.site_id || 1}`);
      const lData = await lRes.json();
      if (lData.success) setBeaconLogs(lData.data);
    } catch (e) {
      console.error("Failed to load beacon data:", e);
    }
  };

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/device/api/list_media');
      const data = await res.json();
      
      let videoNames: string[] = [];
      if (Array.isArray(data)) {
        data.forEach(item => {
          if (item.type === 'batch') {
            item.chunks?.forEach((c: any) => {
              if (c.name?.endsWith('.mp4')) videoNames.push(c.name);
            });
          } else if (item.name?.endsWith('.mp4')) {
            videoNames.push(item.name);
          }
        });
      }
      setVideos(videoNames);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchApiKey = async () => {
    try {
      const res = await fetch('/api/transcripts/config');
      const data = await res.json();
      if (data.key) setApiKey(data.key);
    } catch (e) {
      console.error(e);
    }
  };

  const loadExistingTranscript = async (videoName: string) => {
    try {
      const res = await fetch(`/api/transcripts?video_name=${encodeURIComponent(videoName)}`);
      const data = await res.json();
      if (data.found) {
        setTranscripts(prev => ({ ...prev, [videoName]: data.data }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const allVideos = [...videos, ...localVideos.map(v => v.name)];
    // deduplicate slightly by passing a Set
    Array.from(new Set(allVideos)).forEach(v => loadExistingTranscript(v));
  }, [videos, localVideos]);

  const loadLocalDirectory = async (silent = false) => {
    try {
      let handle: FileSystemDirectoryHandle | undefined;
      if (silent) {
        handle = await get('downloads_dir_handle');
        if (handle) {
          // verify permission without triggering prompt
          const perm = await (handle as any).queryPermission({ mode: 'read' });
          if (perm !== 'granted') return; // wait for explicit action
        } else {
          return;
        }
      } else {
        if (!('showDirectoryPicker' in window)) {
          // Fallback handled by the input type="file" button logic in render
          return;
        }
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
      const unique = combined.filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);
      return unique;
    });
  };

  const generateTranscript = async (videoName: string, localFile?: File) => {
    if (!apiKey) {
      alert("API Key not configured");
      return;
    }
    
    try {
      let fileDataPayload: any = null;
      let inlineDataPayload: any = null;

      if (localFile) {
        setStatus(`Uploading ${videoName} directly to Gemini (Local Sync)...`);
        const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=media&key=${apiKey}`;
        const uploadRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'video/mp4' },
          body: localFile
        });
        const uploadData = await uploadRes.json();
        if (uploadData.error) throw new Error(uploadData.error.message);
        
        // Wait for file processing to complete
        let fileState = uploadData.file.state;
        while (fileState === 'PROCESSING') {
          setStatus(`Processing video on Gemini (this may take a minute)...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          const checkRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${uploadData.file.name}?key=${apiKey}`);
          const checkData = await checkRes.json();
          fileState = checkData.state;
          if (fileState === 'FAILED') throw new Error('Gemini failed to process the video file.');
        }

        fileDataPayload = { mimeType: 'video/mp4', fileUri: uploadData.file.uri };
      } else {
        setStatus(`Extracting audio for ${videoName} (this takes ~1-2s)...`);
        const proxyUrl = `/api/device/api/extract_audio/${encodeURIComponent(videoName)}`;
        const audioRes = await fetch(proxyUrl);
        if (!audioRes.ok) throw new Error("Failed to extract audio from helmet.");
        
        const audioBlob = await audioRes.blob();
        setStatus(`Preparing audio data (this takes ~2s)...`);
        const base64Audio = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(audioBlob);
        });
        inlineDataPayload = { mimeType: "audio/mp3", data: base64Audio };
      }

      setStatus(`Generating transcript...`);

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
      const aiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Listen to this audio. Provide a full word-for-word transcript. Format the transcript like a script with speakers (e.g., 'Speaker 1: Hello.', 'Speaker 2: Hi.'). If you can figure out their names, titles, or roles from the context of the audio, use those instead of 'Speaker 1'. Break it into readable paragraphs when speakers change. Then provide a short executive summary. Also, identify any safety hazards or crucial action items mentioned and put them in a list. Return it as a JSON object with three keys: 'transcript', 'summary', and 'safety_alerts' (an array of strings). If there are no safety alerts, return an empty array for that key." },
              fileDataPayload ? { fileData: fileDataPayload } : { inlineData: inlineDataPayload }
            ]
          }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const aiData = await aiRes.json();
      if (aiData.error) throw new Error(aiData.error.message);

      const aiText = aiData.candidates[0].content.parts[0].text;
      
      let parsed;
      try {
        let cleanText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const match = cleanText.match(/\{[\s\S]*\}/);
        if (match) cleanText = match[0];
        parsed = JSON.parse(cleanText);
      } catch (err) {
        console.error("AI Output:", aiText);
        throw new Error("AI returned malformed JSON structure.");
      }

      setStatus(`Saving transcript...`);

      // Inject safety alerts directly into summary to avoid needing a DB migration
      let finalSummary = parsed.summary;
      if (parsed.safety_alerts && Array.isArray(parsed.safety_alerts) && parsed.safety_alerts.length > 0) {
        finalSummary += `\n\n[SAFETY ALERTS]:\n- ` + parsed.safety_alerts.join('\n- ');
      }

      const saveRes = await fetch('/api/transcripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_name: videoName,
          site_id: currentUser?.site_id || 0,
          transcript: parsed.transcript,
          summary: finalSummary
        })
      });

      const saveData = await saveRes.json();
      if (saveData.success) {
        setTranscripts(prev => ({ ...prev, [videoName]: saveData.data }));
        setStatus('');
      } else {
        throw new Error("Failed to save to database");
      }
      
    } catch (e: any) {
      console.error(e);
      alert(`Error: ${e.message}`);
      setStatus('');
    }
  };

  return (
    <div className="card full-width" style={{ position: 'relative' }}>
      {/* Top Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '1.6rem' }}>
          <span style={{ fontSize: '1.8rem' }}>🎙️</span> Video Transcripts
        </h2>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* File System Access Sync Button */}
          <button 
            onClick={() => loadLocalDirectory(false)}
            style={{ 
              background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.4)', 
              padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            🔗 Sync Local Folder
          </button>
          
          {/* Fallback File Input for unsupported browsers */}
          <label style={{ 
              background: 'rgba(255, 255, 255, 0.1)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.2)', 
              padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
          }}>
            📁 Select Files
            <input type="file" multiple accept="video/mp4" onChange={handleManualFiles} style={{ display: 'none' }} />
          </label>

          <button 
            className="btn-secondary" 
            onClick={onClose}
            style={{ 
              background: 'rgba(255, 255, 255, 0.05)', color: '#cbd5e1', border: '1px solid rgba(255, 255, 255, 0.1)', 
              padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease'
            }}
          >
            ✕ Close
          </button>
        </div>
      </div>

      {status && (
        <div style={{ padding: '16px 20px', background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)', borderLeft: '4px solid #8b5cf6', color: '#e2e8f0', borderRadius: '8px', marginBottom: '25px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
          <span className="spinner" style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }}></span>
          {status}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
          <div className="spinner" style={{ margin: '0 auto 15px auto', width: '30px', height: '30px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          Loading your recordings...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {!loading && videos.length === 0 && localVideos.length === 0 && (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
            No recorded videos found on the helmet. Sync a local folder to upload downloaded videos.
          </div>
        )}
        
        {localVideos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ color: '#4ade80', margin: '0 0 -10px 0', fontSize: '1.1rem' }}>💻 Locally Synced Videos</h3>
            {localVideos.map(lv => (
              <TranscriptItem 
                key={lv.name} 
                video={lv.name} 
                localFile={lv.file}
                initialData={transcripts[lv.name]} 
                apiKey={apiKey}
                generateTranscript={generateTranscript}
                globalStatus={status}
                logs={beaconLogs}
                masterBeacons={masterBeacons}
              />
            ))}
          </div>
        )}

        {videos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ color: '#60a5fa', margin: '0 0 -10px 0', fontSize: '1.1rem' }}>🎥 Helmet Videos</h3>
            {videos.map(v => (
              <TranscriptItem 
                key={v} 
                video={v} 
                initialData={transcripts[v]} 
                apiKey={apiKey}
                generateTranscript={generateTranscript}
                globalStatus={status}
                logs={beaconLogs}
                masterBeacons={masterBeacons}
              />
            ))}
          </div>
        )}
        </div>
      )}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        div::-webkit-scrollbar { width: 8px; }
        div::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.1); border-radius: 4px; }
        div::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 4px; }
        div::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.25); }
      `}} />
    </div>
  );
}
