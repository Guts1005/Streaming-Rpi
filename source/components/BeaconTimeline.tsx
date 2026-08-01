import React, { useEffect, useState } from 'react';
import { BeaconLog, BeaconMaster, LocationChapter, calculateVideoChapters, calculateLiveChapters } from '../lib/beaconUtils';

type BeaconTimelineProps = {
  videoName?: string;
  videoStartMs?: number | null;
  videoDurationMs?: number | null; // null if metadata not loaded
  logs: BeaconLog[];
  masterBeacons: BeaconMaster[];
  onSeek?: (seconds: number) => void;
  isLive?: boolean;
};

function formatAbsoluteTime(timestamp: string) {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function SvgIcon({ path, className, style }: { path: string, className?: string, style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="currentColor" viewBox="0 0 24 24">
      <path d={path} />
    </svg>
  );
}

export default function BeaconTimeline({ 
  videoName, 
  videoStartMs, 
  videoDurationMs, 
  logs, 
  masterBeacons, 
  onSeek,
  isLive = false
}: BeaconTimelineProps) {
  const [chapters, setChapters] = useState<LocationChapter[]>([]);
  const [filterZone, setFilterZone] = useState<string>('All Zones');
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  useEffect(() => {
    if (isLive) {
      if (logs.length > 0) {
        setChapters(calculateLiveChapters(logs, masterBeacons));
      } else {
        setChapters([]);
      }
    } else {
      if (!videoStartMs || !videoDurationMs || logs.length === 0) return;
      setChapters(calculateVideoChapters(videoStartMs, videoDurationMs, logs, masterBeacons));
    }
  }, [videoStartMs, videoDurationMs, logs, masterBeacons, isLive]);

  if (!isLive && !videoStartMs) {
    return <div style={{ fontSize: '12px', color: '#64748b' }}>Cannot determine video start time for timeline.</div>;
  }

  if (chapters.length === 0) {
    return <div style={{ fontSize: '12px', color: '#64748b', padding: '16px' }}>No location telemetry found.</div>;
  }

  // Filter logic
  let displayChapters = chapters;
  if (filterZone !== 'All Zones') {
    displayChapters = chapters.filter(c => c.beaconMac.includes(filterZone));
  }

  // Generate unique zones for filter dropdown
  const uniqueZones = Array.from(new Set(chapters.map(c => c.beaconMac.substring(c.beaconMac.length - 4).toUpperCase())));

  const handleMarkerClick = (chap: LocationChapter, idx: number) => {
    setActiveIdx(idx);
    if (!isLive && onSeek) {
      onSeek(chap.videoTimeSeconds);
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const zone = e.target.value;
    setFilterZone(zone);
    
    // Automatically seek to the first occurrence if it's a specific zone
    if (zone !== 'All Zones' && !isLive && onSeek) {
      const firstOccur = chapters.find(c => c.beaconMac.includes(zone));
      if (firstOccur) {
        setActiveIdx(0);
        onSeek(firstOccur.videoTimeSeconds);
      }
    } else {
      setActiveIdx(null);
    }
  };

  const handlePrev = () => {
    if (activeIdx === null || activeIdx <= 0) return;
    const prevChap = displayChapters[activeIdx - 1];
    if (prevChap) {
      setActiveIdx(activeIdx - 1);
      if (onSeek) onSeek(prevChap.videoTimeSeconds);
    }
  };

  const handleNext = () => {
    if (activeIdx === null) {
      const nextChap = displayChapters[0];
      if (nextChap) {
        setActiveIdx(0);
        if (onSeek) onSeek(nextChap.videoTimeSeconds);
      }
      return;
    }
    if (activeIdx >= displayChapters.length - 1) return;
    const nextChap = displayChapters[activeIdx + 1];
    if (nextChap) {
      setActiveIdx(activeIdx + 1);
      if (onSeek) onSeek(nextChap.videoTimeSeconds);
    }
  };

  return (
    <div style={{ 
      background: '#0f172a', 
      border: '1px solid #1e293b', 
      borderRadius: '8px', 
      padding: '16px 24px', 
      marginTop: '16px',
      color: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#f8fafc' }}>Timeline Markers (Beacons)</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#94a3b8' }}>
          <span>Filter:</span>
          <select 
            value={filterZone} 
            onChange={handleFilterChange}
            style={{ 
              padding: '6px 32px 6px 12px', 
              borderRadius: '6px', 
              border: '1px solid #334155',
              background: '#1e293b',
              color: '#f8fafc',
              fontWeight: 500,
              outline: 'none',
              cursor: 'pointer',
              appearance: 'none',
              backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px top 50%',
              backgroundSize: '10px auto'
            }}
          >
            <option value="All Zones">All Zones</option>
            {uniqueZones.map(z => <option key={z} value={z}>Zone {z}</option>)}
          </select>
          <button 
            onClick={handlePrev} 
            disabled={activeIdx === null || activeIdx <= 0}
            style={{ 
              background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', borderRadius: '4px', padding: '6px 12px', 
              cursor: (activeIdx === null || activeIdx <= 0) ? 'not-allowed' : 'pointer',
              opacity: (activeIdx === null || activeIdx <= 0) ? 0.5 : 1,
              transition: 'background 0.2s ease'
            }}>
            Prev
          </button>
          <button 
            onClick={handleNext} 
            disabled={activeIdx !== null && activeIdx >= displayChapters.length - 1}
            style={{ 
              background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', borderRadius: '4px', padding: '6px 12px', 
              cursor: (activeIdx !== null && activeIdx >= displayChapters.length - 1) ? 'not-allowed' : 'pointer',
              opacity: (activeIdx !== null && activeIdx >= displayChapters.length - 1) ? 0.5 : 1,
              transition: 'background 0.2s ease'
            }}>
            Next
          </button>
        </div>
      </div>

      {/* Timeline Track */}
      <div style={{ position: 'relative', width: '100%', padding: '0 10px', minHeight: '120px' }}>
        {/* The Track Line */}
        <div style={{ 
          position: 'absolute', 
          top: '44px', // 28px (timestamp text height + margin) + 12px (half of 24px icon) + 4px (container padding top)
          left: 0, 
          right: 0, 
          height: '2px', 
          background: '#334155',
          zIndex: 0
        }}></div>

        {/* Markers Container */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          position: 'relative', 
          zIndex: 1,
          overflowX: 'auto',
          paddingBottom: '16px',
          paddingTop: '4px',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          scrollbarColor: '#475569 transparent',
          gap: '16px'
        }}>
          {displayChapters.map((chap, idx) => {
            const isSelected = activeIdx === idx;
            const zoneId = chap.beaconMac.substring(chap.beaconMac.length - 4).toUpperCase();
            
            // Assign a pseudo-random color based on zone string
            const colors = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#22d3ee', '#c084fc'];
            const colorIdx = zoneId.charCodeAt(0) % colors.length;
            const markerColor = colors[colorIdx];

            return (
              <div 
                key={idx} 
                onClick={() => handleMarkerClick(chap, idx)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                  width: '120px',
                  minWidth: '120px',
                  position: 'relative'
                }}
              >
                {/* Timestamp above */}
                <div style={{ 
                  fontSize: '12px', 
                  color: isSelected ? '#f8fafc' : '#94a3b8', 
                  fontWeight: isSelected ? 700 : 500, 
                  marginBottom: '14px',
                  transition: 'color 0.2s ease'
                }}>
                  {isLive ? formatAbsoluteTime(chap.absoluteTimestamp) : formatAbsoluteTime(chap.absoluteTimestamp)}
                </div>

                {/* Pin Icon */}
                <div style={{ 
                  color: isSelected ? '#c084fc' : markerColor, 
                  marginBottom: '14px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: isSelected ? 'scale(1.2)' : 'scale(1)',
                  filter: isSelected ? `drop-shadow(0 0 8px ${markerColor}66)` : 'none'
                }}>
                  <SvgIcon path="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" 
                           style={{ width: '24px', height: '24px' }} />
                </div>

                {/* Details Box */}
                <div style={{
                  background: isSelected ? '#1e293b' : 'transparent',
                  border: isSelected ? `1px solid ${markerColor}66` : '1px solid transparent',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  textAlign: 'center',
                  minWidth: '110px',
                  transition: 'all 0.3s ease',
                  boxShadow: isSelected ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' : 'none'
                }}>
                  <div style={{ color: isSelected ? '#f8fafc' : markerColor, fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {chap.locationName || `Zone ${zoneId}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
