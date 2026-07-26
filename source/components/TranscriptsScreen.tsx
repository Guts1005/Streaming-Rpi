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
      const parsed = JSON.parse(aiText);

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
    <div className="card full-width">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Video Transcripts</h2>
        <button className="btn-secondary" onClick={onClose}>Close</button>
      </div>

      {status && (
        <div style={{ padding: '15px', background: '#e0f7fa', color: '#006064', borderRadius: '8px', marginBottom: '20px', fontWeight: 'bold' }}>
          ⏳ {status}
        </div>
      )}

      {loading ? (
        <p>Loading videos...</p>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {videos.filter(v => v.endsWith('.mp4')).map(video => {
            const transcriptData = transcripts[video];
            return (
              <div key={video} style={{ border: '1px solid #eee', padding: '20px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>{video}</h3>
                  {!transcriptData && !status && (
                    <button className="btn-primary" onClick={() => generateTranscript(video)}>
                      Generate Transcript
                    </button>
                  )}
                </div>

                {transcriptData && (
                  <div style={{ marginTop: '15px' }}>
                    <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '6px', marginBottom: '10px' }}>
                      <strong>Summary:</strong>
                      <p style={{ margin: '10px 0 0 0' }}>{transcriptData.summary}</p>
                    </div>
                    <div>
                      <strong>Full Transcript:</strong>
                      <p style={{ whiteSpace: 'pre-wrap', color: '#555' }}>{transcriptData.transcript}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {videos.filter(v => v.endsWith('.mp4')).length === 0 && (
            <p>No video files found on the device.</p>
          )}
        </div>
      )}
    </div>
  );
}
