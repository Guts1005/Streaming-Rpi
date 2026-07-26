import React, { useState, useEffect } from 'react';

// NOTE: This relies on the Google Generative AI REST API to avoid requiring the SDK in the browser bundle
// which could cause webpack issues or expose too much. 

type TranscriptsScreenProps = {
  currentUser: any;
  onClose: () => void;
};

// --- Child Component for Individual Transcripts ---
function TranscriptItem({ video, initialData, apiKey, generateTranscript, globalStatus }: { video: string, initialData: any, apiKey: string, generateTranscript: (v: string) => void, globalStatus: string }) {
  const [displayData, setDisplayData] = useState(initialData);
  const [targetLang, setTargetLang] = useState('English');
  const [isTranslating, setIsTranslating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
  if (normalSummary.includes('[SAFETY ALERTS]:')) {
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
            onClick={() => generateTranscript(video)}
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
              </select>
              {isTranslating && <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Translating...</span>}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                placeholder="🔍 Search transcript..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '6px', outline: 'none', width: '180px' }}
              />
              <button onClick={handleCopy} title="Copy to Clipboard" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>📋 Copy</button>
              <button onClick={handleDownloadWord} title="Download Word Doc" style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.5)', color: '#60a5fa', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>📝 Word</button>
              <button onClick={handleDownloadPDF} title="Download PDF" style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#f87171', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>📄 PDF</button>
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
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [transcripts, setTranscripts] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchVideos();
    fetchApiKey();
  }, []);

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
    videos.forEach(v => loadExistingTranscript(v));
  }, [videos]);

  const generateTranscript = async (videoName: string) => {
    if (!apiKey) {
      alert("API Key not configured");
      return;
    }
    
    try {
      setStatus(`Extracting audio for ${videoName} (this takes ~1-2s)...`);
      const proxyUrl = `/api/device/api/extract_audio/${encodeURIComponent(videoName)}`;
      const audioRes = await fetch(proxyUrl);
      if (!audioRes.ok) throw new Error("Failed to extract audio from helmet.");
      
      const audioBlob = await audioRes.blob();
      
      setStatus(`Uploading to Gemini (this takes ~2s)...`);
      const base64Audio = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(audioBlob);
      });

      setStatus(`Generating transcript...`);

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
      const aiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Listen to this audio. Provide a full word-for-word transcript. Then provide a short executive summary. Also, identify any safety hazards or crucial action items mentioned and put them in a list. Return it as a JSON object with three keys: 'transcript', 'summary', and 'safety_alerts' (an array of strings). If there are no safety alerts, return an empty array for that key." },
              { inlineData: { mimeType: "audio/mp3", data: base64Audio } }
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
          <span style={{ fontSize: '1.5rem' }}>🎙️</span> Video Transcripts
        </h2>
        <button 
          onClick={onClose}
          style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#e2e8f0', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s ease' }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
        >
          ✕ Close
        </button>
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
      ) : videos.filter(v => v.endsWith('.mp4')).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '10px' }}>📁</span>
          No video files found on the device.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {videos.filter(v => v.endsWith('.mp4')).map(video => (
            <TranscriptItem 
              key={video}
              video={video}
              initialData={transcripts[video]}
              apiKey={apiKey}
              generateTranscript={generateTranscript}
              globalStatus={status}
            />
          ))}
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
