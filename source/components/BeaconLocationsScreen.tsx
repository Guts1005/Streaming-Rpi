import React, { useState, useMemo, useEffect } from 'react';
import { get, set } from 'idb-keyval';
import { BeaconMaster, BeaconLog, parseVideoStartTime } from '../lib/beaconUtils';

type MediaItem = {
  name: string;
  size: string;
  url: string;
  type: string;
  date: string;
  analysis?: any;
  isLocal?: boolean;
};

type BeaconLocationsScreenProps = {
  masterBeacons: BeaconMaster[];
  beaconLogs: BeaconLog[];
  mediaFiles: MediaItem[];
  onPlayVideo: (media: MediaItem) => void;
};

export default function BeaconLocationsScreen({
  masterBeacons,
  beaconLogs,
  mediaFiles,
  onPlayVideo
}: BeaconLocationsScreenProps) {
  const [selectedLocation, setSelectedLocation] = useState<string>('All Locations');
  const [localVideos, setLocalVideos] = useState<MediaItem[]>([]);

  useEffect(() => {
    loadLocalDirectory(true);
  }, []);

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
      const foundFiles: MediaItem[] = [];
      const regex = /\.mp4$/i;
      
      for await (const entry of (handle as any).values()) {
        if (entry.kind === 'file' && regex.test(entry.name)) {
          const file = await entry.getFile();
          foundFiles.push({
            name: file.name,
            size: (file.size / 1024 / 1024).toFixed(1) + 'MB',
            url: URL.createObjectURL(file),
            type: 'video',
            date: new Date(file.lastModified).toLocaleString(),
            isLocal: true
          });
        }
      }
      setLocalVideos(foundFiles.sort((a,b) => b.name.localeCompare(a.name)));
    } catch (err: any) {
      if (err.name !== 'AbortError') console.error("Failed to load directory", err);
    }
  };

  const handleManualFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newMedia = files.filter(f => f.name.toLowerCase().endsWith('.mp4')).map(file => ({
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(1) + 'MB',
      url: URL.createObjectURL(file),
      type: 'video',
      date: new Date(file.lastModified).toLocaleString(),
      isLocal: true
    }));
    setLocalVideos(prev => [...prev, ...newMedia]);
  };


  // Find all unique locations from master beacons
  const locations = useMemo(() => {
    const locs = new Set<string>();
    masterBeacons.forEach(mb => {
      if (mb.location_name) locs.add(mb.location_name);
    });
    return Array.from(locs);
  }, [masterBeacons]);

  const allMediaFiles = useMemo(() => [...mediaFiles, ...localVideos], [mediaFiles, localVideos]);

  // For the selected location, find which videos have a beacon log corresponding to this location
  const videosForLocation = useMemo(() => {
    if (!selectedLocation) return [];

    const isAllLocations = selectedLocation === 'All Locations';

    // Find all macs for the selected location (or all macs if All Locations)
    const macs = isAllLocations 
      ? masterBeacons.map(mb => mb.beacon_mac)
      : masterBeacons.filter(mb => mb.location_name === selectedLocation).map(mb => mb.beacon_mac);
    
    // Filter beacon logs that match these macs
    const relevantLogs = beaconLogs.filter(log => macs.includes(log.beacon_mac));
    // if (relevantLogs.length === 0) return []; // Removed so we can force site_1 videos

    const videos: { media: MediaItem, detectionCount: number, durationStr: string }[] = [];

    // Group logs by video
    allMediaFiles.forEach(media => {
      if (!media.name || !media.name.endsWith('.mp4')) return;
      
      const startMs = parseVideoStartTime(media.name);
      
      let endMs = 0;
      let logsInVideo: typeof relevantLogs = [];
      
      if (startMs) {
        endMs = startMs + 120000;
        const match = media.name.match(/(?:site_[A-Za-z0-9_-]+_)?uploaded_\d{8}_\d{6}_to_(\d{6})/);
        if (match) {
          const timeStr = match[1];
          const dateStr = media.name.match(/(?:site_[A-Za-z0-9_-]+_)?uploaded_(\d{8})/)?.[1] || "";
          if (dateStr) {
             const isoStr = `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}T${timeStr.substring(0,2)}:${timeStr.substring(2,4)}:${timeStr.substring(4,6)}+05:30`;
             endMs = new Date(isoStr).getTime();
          }
        }

        logsInVideo = relevantLogs.filter(l => {
          const t = new Date(l.timestamp).getTime();
          return t >= startMs && t <= endMs;
        });
      }

      if (isAllLocations || logsInVideo.length > 0) {
        const durationSec = (endMs && startMs) ? Math.floor((endMs - startMs) / 1000) : 0;
        const mins = Math.floor(durationSec / 60);
        const secs = durationSec % 60;
        videos.push({
          media,
          detectionCount: logsInVideo.length,
          durationStr: durationSec > 0 ? `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` : "Unknown"
        });
      }
    });

    return videos;
  }, [selectedLocation, masterBeacons, beaconLogs, allMediaFiles]);

  const totalAlerts = useMemo(() => videosForLocation.reduce((acc, v) => acc + (v.media.analysis?.violations?.length || 0), 0), [videosForLocation]);

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
            Home &gt; Sites &gt; {selectedLocation || 'No Location'}
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, margin: 0, color: '#f8fafc' }}>
            {selectedLocation || 'Beacon Locations'}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => loadLocalDirectory(false)}
            style={{ padding: '8px 16px', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
            Sync Local Folder
          </button>
          
          <label style={{ padding: '8px 16px', background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
            Select Files
            <input type="file" multiple accept="video/mp4" onChange={handleManualFiles} style={{ display: 'none' }} />
          </label>
          <select 
            value={selectedLocation} 
            onChange={e => setSelectedLocation(e.target.value)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #334155',
              background: '#1e293b',
              color: '#f8fafc',
              outline: 'none',
              minWidth: '200px'
            }}
          >
            <option value="All Locations">All Locations</option>
            {locations.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ background: '#1e293b', borderRadius: '8px', border: '1px solid #334155', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, color: '#f8fafc' }}>Videos where this location was detected <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', marginLeft: '8px' }}>{videosForLocation.length} Videos</span></div>
            </div>
            
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {videosForLocation.length === 0 && (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>
                  No videos found for this location.
                </div>
              )}
              {videosForLocation.map((v, idx) => {
                const totalAlerts = v.media.analysis?.violations ? v.media.analysis.violations.length : 0;
                
                return (
                  <div key={idx} style={{ display: 'flex', border: '1px solid #334155', background: '#0f172a', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.2s' }} onClick={() => onPlayVideo(v.media)} onMouseOver={e => e.currentTarget.style.borderColor = '#64748b'} onMouseOut={e => e.currentTarget.style.borderColor = '#334155'}>
                    <div style={{ width: '200px', background: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="white" style={{ opacity: 0.8, cursor: 'pointer' }}>
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '12px', padding: '2px 6px', borderRadius: '4px' }}>
                        {v.durationStr}
                      </div>
                    </div>
                    <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', gap: '16px', color: '#94a3b8', fontSize: '14px', marginBottom: '8px', fontWeight: 500 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                              {v.media.date}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '16px', color: '#64748b', fontSize: '13px' }}>
                            <span>Duration: {v.durationStr}</span>
                            <span>|</span>
                            <span>Size: {v.media.size}</span>
                          </div>
                        </div>
                        {totalAlerts > 0 && (
                          <div style={{ border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '4px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            {totalAlerts} Alerts
                          </div>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
                        <span style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500 }}>
                          Beacon Detected
                        </span>
                        <span style={{ color: '#64748b', fontSize: '13px' }}>
                          Times in video: {v.detectionCount}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ background: '#1e293b', borderRadius: '8px', border: '1px solid #334155', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#cbd5e1', fontWeight: 600 }}>Location Overview</h3>
            <div style={{ background: '#0f172a', borderRadius: '6px', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '12px', flexDirection: 'column', gap: '8px' }}>
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              Map View Unavailable
            </div>
          </div>

          <div style={{ background: '#1e293b', borderRadius: '8px', border: '1px solid #334155', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#cbd5e1', fontWeight: 600 }}>Safety Summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Total Videos</div>
                <div style={{ fontSize: '24px', fontWeight: 600, color: '#f8fafc' }}>{videosForLocation.length}</div>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '16px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div style={{ fontSize: '11px', color: '#ef4444', marginBottom: '4px' }}>Total Alerts</div>
                <div style={{ fontSize: '24px', fontWeight: 600, color: '#ef4444' }}>{totalAlerts}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
