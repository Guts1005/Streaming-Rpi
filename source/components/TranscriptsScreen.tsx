import React, { useState, useEffect } from 'react';

// NOTE: This relies on the Google Generative AI REST API to avoid requiring the SDK in the browser bundle
// which could cause webpack issues or expose too much. 

type TranscriptsScreenProps = {
  currentUser: any;
  onClose: () => void;
};

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
      // Fetch videos from Pi proxy
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
      
      // 1. Fetch Audio from Pi
      // /api/extract_audio/<filename> on the Pi
      const proxyUrl = `/api/device/api/extract_audio/${encodeURIComponent(videoName)}`;
      const audioRes = await fetch(proxyUrl);
      if (!audioRes.ok) throw new Error("Failed to extract audio from helmet.");
      
      const audioBlob = await audioRes.blob();
      
      setStatus(`Uploading to Gemini (this takes ~2s)...`);
      
      // 2. Upload to Gemini using REST API
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
              { text: "Listen to this audio. Provide a full word-for-word transcript. Then provide a short executive summary. Return it as a JSON object with two keys: 'transcript' and 'summary'." },
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
        // Extract just the first complete JSON object to ignore any trailing conversational text
        const match = cleanText.match(/\{[\s\S]*\}/);
        if (match) {
          cleanText = match[0];
        }
        parsed = JSON.parse(cleanText);
      } catch (err) {
        console.error("AI Output:", aiText);
        throw new Error("AI returned malformed JSON structure.");
      }

      setStatus(`Saving transcript...`);

      // 3. Save to Vercel Database
      const saveRes = await fetch('/api/transcripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_name: videoName,
          site_id: currentUser?.site_id || 0,
          transcript: parsed.transcript,
          summary: parsed.summary
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
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#e2e8f0',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.2s ease',
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
        >
          ✕ Close
        </button>
      </div>

      {status && (
        <div style={{ 
          padding: '16px 20px', 
          background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)', 
          borderLeft: '4px solid #8b5cf6',
          color: '#e2e8f0', 
          borderRadius: '8px', 
          marginBottom: '25px', 
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
        }}>
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
          {videos.filter(v => v.endsWith('.mp4')).map(video => {
            const transcriptData = transcripts[video];
            return (
              <div key={video} style={{ 
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
                  
                  {!transcriptData && !status && (
                    <button 
                      onClick={() => generateTranscript(video)}
                      style={{
                        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
                        transition: 'transform 0.1s'
                      }}
                      onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
                      onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      ✨ Generate AI Transcript
                    </button>
                  )}
                </div>

                {transcriptData && (
                  <div style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Summary Block */}
                    <div style={{ 
                      background: 'rgba(59, 130, 246, 0.05)', 
                      padding: '20px', 
                      borderRadius: '10px', 
                      borderLeft: '4px solid #3b82f6',
                      borderRight: '1px solid rgba(255,255,255,0.03)',
                      borderTop: '1px solid rgba(255,255,255,0.03)',
                      borderBottom: '1px solid rgba(255,255,255,0.03)'
                    }}>
                      <h4 style={{ margin: '0 0 12px 0', color: '#60a5fa', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📋 Executive Summary
                      </h4>
                      <p style={{ margin: 0, color: '#e2e8f0', lineHeight: '1.6', fontSize: '0.95rem' }}>{transcriptData.summary}</p>
                    </div>

                    {/* Full Transcript Block */}
                    <div>
                      <h4 style={{ margin: '0 0 12px 0', color: '#94a3b8', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📝 Full Transcript
                      </h4>
                      <div style={{ 
                        background: 'rgba(0, 0, 0, 0.3)', 
                        padding: '20px', 
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        maxHeight: '350px',
                        overflowY: 'auto'
                      }}>
                        <p style={{ 
                          margin: 0, 
                          whiteSpace: 'pre-wrap', 
                          color: '#cbd5e1', 
                          lineHeight: '1.7', 
                          fontSize: '0.9rem',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>
                          {transcriptData.transcript}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        /* Custom scrollbar for dark mode transcript box */
        div::-webkit-scrollbar {
          width: 8px;
        }
        div::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
        }
        div::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 4px;
        }
        div::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.25);
        }
      `}} />
    </div>
  );
}
