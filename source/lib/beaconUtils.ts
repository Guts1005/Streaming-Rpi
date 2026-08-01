export function parseVideoStartTime(filename: string): number | null {
  // Support old format: 2026-07-27_10-15-30
  let match = filename.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/);
  if (match) {
    const str = match[1]; // "2026-07-27_10-15-30"
    const isoStr = `${str.substring(0, 10)}T${str.substring(11, 13)}:${str.substring(14, 16)}:${str.substring(17, 19)}+05:30`;
    return new Date(isoStr).getTime();
  }

  // Support new format: (uploaded_)?20260730_200113_to_200138.mp4
  match = filename.match(/(?:uploaded_)?(\d{8})_(\d{6})/);
  if (match) {
    const dateStr = match[1]; // 20260730
    const timeStr = match[2]; // 200113
    const isoStr = `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}T${timeStr.substring(0,2)}:${timeStr.substring(2,4)}:${timeStr.substring(4,6)}+05:30`;
    return new Date(isoStr).getTime();
  }

  return null;
}

export type BeaconLog = {
  id: number;
  timestamp: string;
  r_pi_id: string;
  beacon_mac: string;
  site_id: number;
};

export type BeaconMaster = {
  beacon_mac: string;
  location_name: string;
  lat: number;
  lon: number;
};

export type LocationChapter = {
  locationName: string;
  videoTimeSeconds: number;
  beaconMac: string;
  absoluteTimestamp: string;
};

export function calculateVideoChapters(
  videoStartMs: number,
  videoDurationMs: number,
  logs: BeaconLog[],
  masterBeacons: BeaconMaster[]
): LocationChapter[] {
  const videoEndMs = videoStartMs + videoDurationMs;
  
  // Sort logs by time
  const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  // 1. Find the last known beacon right before the video started
  const logsBeforeVideo = sortedLogs.filter(l => new Date(l.timestamp).getTime() <= videoStartMs);
  const initialLog = logsBeforeVideo.length > 0 ? logsBeforeVideo[logsBeforeVideo.length - 1] : null;

  // 2. Find logs that happened DURING the video
  const logsDuringVideo = sortedLogs.filter(l => {
    const t = new Date(l.timestamp).getTime();
    return t > videoStartMs && t <= videoEndMs;
  });

  const timelineLogs = [];
  if (initialLog) timelineLogs.push(initialLog);
  timelineLogs.push(...logsDuringVideo);

  if (timelineLogs.length === 0) return [];

  const chapters: LocationChapter[] = [];
  let currentMac = '';

  for (const log of timelineLogs) {
    if (log.beacon_mac === currentMac) continue;

    const logTimeMs = new Date(log.timestamp).getTime();
    
    // If this log is before the video, it becomes the 00:00 chapter
    let videoTimeSeconds = 0;
    if (logTimeMs > videoStartMs) {
      videoTimeSeconds = Math.floor((logTimeMs - videoStartMs) / 1000);
    }

    // Debounce: if the time difference between this chapter and the last is less than 10 seconds, 
    // we overwrite the previous one if it was a quick bounce
    if (chapters.length > 0) {
      const timeSinceLast = videoTimeSeconds - chapters[chapters.length - 1].videoTimeSeconds;
      if (timeSinceLast < 10) {
        chapters.pop();
      }
    }

    const master = masterBeacons.find(m => m.beacon_mac === log.beacon_mac);
    const locName = master?.location_name || `Unknown (${log.beacon_mac.substring(0,8)})`;

    // Only push if it's a new location after popping
    if (chapters.length === 0 || chapters[chapters.length - 1].locationName !== locName) {
      chapters.push({
        locationName: locName,
        videoTimeSeconds: videoTimeSeconds,
        beaconMac: log.beacon_mac,
        absoluteTimestamp: log.timestamp
      });
      currentMac = log.beacon_mac;
    }
  }

  // Ensure there's always a chapter at 00:00 if chapters exist
  if (chapters.length > 0 && chapters[0].videoTimeSeconds > 0) {
    chapters[0].videoTimeSeconds = 0;
  }

  return chapters;
}

export function calculateLiveChapters(
  logs: BeaconLog[],
  masterBeacons: BeaconMaster[]
): LocationChapter[] {
  if (logs.length === 0) return [];
  
  const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  const chapters: LocationChapter[] = [];
  let currentMac = '';

  for (const log of sortedLogs) {
    if (log.beacon_mac === currentMac) continue;

    const logTimeMs = new Date(log.timestamp).getTime();
    
    if (chapters.length > 0) {
      const lastTimeMs = new Date(chapters[chapters.length - 1].absoluteTimestamp).getTime();
      const timeSinceLast = (logTimeMs - lastTimeMs) / 1000;
      if (timeSinceLast < 10) {
        chapters.pop();
      }
    }

    const master = masterBeacons.find(m => m.beacon_mac === log.beacon_mac);
    const locName = master?.location_name || `Unknown (${log.beacon_mac.substring(0,8)})`;

    if (chapters.length === 0 || chapters[chapters.length - 1].locationName !== locName) {
      chapters.push({
        locationName: locName,
        videoTimeSeconds: 0, // Not used in live mode
        beaconMac: log.beacon_mac,
        absoluteTimestamp: log.timestamp
      });
      currentMac = log.beacon_mac;
    }
  }

  // Return last 6 chapters to avoid overflowing the UI
  return chapters.slice(-6);
}
