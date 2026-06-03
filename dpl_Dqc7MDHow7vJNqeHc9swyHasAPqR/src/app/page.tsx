"use client";

import "@livekit/components-styles";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  isTrackReference,
  useConnectionState,
  useParticipants,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";

type TokenResponse = {
  token?: string;
  error?: string;
};

type Tone = "green" | "yellow" | "red";

type MediaItem = {
  name: string;
  size?: number | string;
  type?: "video" | "image" | "batch";
  uploaded?: boolean;
  converting?: boolean;
  incomplete?: boolean;
  failed?: boolean;
  chunks?: MediaItem[];
  chunk_count?: number;
  uploaded_count?: number;
  incomplete_count?: number;
  base?: string;
};

type LocalFile = {
  name: string;
  url: string;
  size: string;
  type: "video" | "image";
  created: Date;
};

type GpsState = {
  label: string;
  detail: string;
  tone: Tone;
};

type LogItem = {
  name: string;
  size_mb?: number;
  last_modified?: number;
};

const DEVICE_API_BASE = process.env.NEXT_PUBLIC_DEVICE_API_BASE || "";
const ROOM_NAME = process.env.NEXT_PUBLIC_LIVEKIT_ROOM || "helmet-live";

function apiUrl(path: string) {
  return DEVICE_API_BASE ? `${DEVICE_API_BASE.replace(/\/$/, "")}${path}` : `/api/device${path}`;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), options);
  const text = await response.text();
  let payload: unknown = text;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {}

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error?: string }).error)
        : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  return payload as T;
}

function Dot({ tone }: { tone: Tone }) {
  return <span className={`dot ${tone}`} />;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h ? `${String(h).padStart(2, "0")}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function sizeLabel(value?: number | string) {
  if (value === undefined || value === null || value === "") return "--";
  if (typeof value === "number") return `${value} MB`;
  return value.includes("MB") ? value : `${value} MB`;
}

function useTicker(intervalMs: number) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((tick) => tick + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
}

function LiveTalkPanel({
  onToast,
}: {
  onToast: (message: string, type?: "good" | "bad") => void;
}) {
  const room = useRoomContext();
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [micId, setMicId] = useState("");
  const [speakerId, setSpeakerId] = useState("");
  const [muted, setMuted] = useState(false);
  const [talking, setTalking] = useState(false);
  const [level, setLevel] = useState(0);
  const meterRef = useRef<number | null>(null);

  useEffect(() => {
    async function loadDevices() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        setInputs(devices.filter((device) => device.kind === "audioinput"));
        setOutputs(devices.filter((device) => device.kind === "audiooutput"));
      } catch (error) {
        onToast(`Microphone permission needed: ${(error as Error).message}`, "bad");
      }
    }
    if (navigator.mediaDevices) void loadDevices();
  }, [onToast]);

  async function startTalk() {
    if (muted) {
      onToast("Live Talk is muted", "bad");
      return;
    }
    try {
      if (micId) await room.switchActiveDevice("audioinput", micId);
      await room.localParticipant.setMicrophoneEnabled(true);
      setTalking(true);
      meterRef.current = window.setInterval(() => setLevel(Math.floor(4 + Math.random() * 14)), 120);
    } catch (error) {
      onToast(`Live Talk failed: ${(error as Error).message}`, "bad");
    }
  }

  async function stopTalk() {
    if (meterRef.current) window.clearInterval(meterRef.current);
    meterRef.current = null;
    setLevel(0);
    setTalking(false);
    try {
      await room.localParticipant.setMicrophoneEnabled(false);
    } catch {}
  }

  async function updateSpeaker(deviceId: string) {
    setSpeakerId(deviceId);
    try {
      if (deviceId) await room.switchActiveDevice("audiooutput", deviceId);
    } catch {
      onToast("Speaker switching is not supported by this browser", "bad");
    }
  }

  return (
    <section className="action-card talk-card">
      <h3>Live Talk</h3>
      <div className="talk-grid">
        <label>
          Microphone
          <select value={micId} onChange={(event) => setMicId(event.target.value)}>
            <option value="">Default microphone</option>
            {inputs.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${index + 1}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          Speaker
          <select value={speakerId} onChange={(event) => void updateSpeaker(event.target.value)}>
            <option value="">Default speaker</option>
            {outputs.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Speaker ${index + 1}`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="action-row">
        <button
          className={`ptt ${talking ? "active" : ""}`}
          type="button"
          onMouseDown={() => void startTalk()}
          onMouseUp={() => void stopTalk()}
          onMouseLeave={() => talking && void stopTalk()}
          onTouchStart={(event) => {
            event.preventDefault();
            void startTalk();
          }}
          onTouchEnd={() => void stopTalk()}
        >
          HOLD TO TALK
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => {
            setMuted((value) => !value);
            if (!muted) void stopTalk();
          }}
        >
          {muted ? "Unmute" : "Mute"}
        </button>
      </div>
      <div className="status-line">
        <span>Connection</span>
        <strong>
          <Dot tone={talking ? "green" : muted ? "red" : "yellow"} />
          {talking ? "Transmitting" : muted ? "Muted" : "Ready"}
        </strong>
      </div>
      <div className="voice-meter">
        {Array.from({ length: 18 }).map((_, index) => (
          <span key={index} className={index < level ? "active" : ""} style={{ height: index < level ? 8 + index : 5 }} />
        ))}
      </div>
    </section>
  );
}

function HelmetDashboard() {
  const connectionState = useConnectionState();
  const participants = useParticipants();
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }]);
  const videoWrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [activePage, setActivePage] = useState("live");
  const [toast, setToast] = useState<{ message: string; type: "good" | "bad" } | null>(null);
  const [gps, setGps] = useState<GpsState>({ label: "GPS: Initializing", detail: "Waiting for browser GPS", tone: "yellow" });
  const [frameCount, setFrameCount] = useState(0);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordStart, setRecordStart] = useState<number | null>(null);
  const [desktopStart, setDesktopStart] = useState<number | null>(null);
  const [desktopUrl, setDesktopUrl] = useState("");
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const [snapshot, setSnapshot] = useState<LocalFile | null>(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [streamPaused, setStreamPaused] = useState(false);
  const [quality, setQuality] = useState("1080p");
  const [muted, setMuted] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});

  useTicker(1000);

  const realTracks = tracks.filter(isTrackReference);
  const streamTrack = realTracks.find((track) => track.participant.identity === "helmet-pi") || realTracks[0];
  const online = connectionState === ConnectionState.Connected;
  const streamOnline = online && Boolean(streamTrack);
  const remoteParticipant = participants.find((participant) => participant.identity === "helmet-pi") || participants[0];
  const participantLabel = remoteParticipant?.name || remoteParticipant?.identity || "--";
  const elapsed = Math.floor((Date.now() - (recordStart || Date.now())) / 1000);
  const desktopElapsed = Math.floor((Date.now() - (desktopStart || Date.now())) / 1000);

  const showToast = useCallback((message: string, type: "good" | "bad" = "good") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    if (!streamOnline) return;
    const id = window.setInterval(() => setFrameCount((count) => count + 24), 1000);
    return () => window.clearInterval(id);
  }, [streamOnline]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      const id = window.setTimeout(
        () => setGps({ label: "GPS: Not supported", detail: "Browser GPS is not supported", tone: "red" }),
        0,
      );
      return () => window.clearTimeout(id);
    }
    const watchId = navigator.geolocation.watchPosition(
      (position) =>
        setGps({
          label: "GPS: Locked",
          detail: `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)} / +/- ${Math.round(
            position.coords.accuracy || 0,
          )} m`,
          tone: "green",
        }),
      (error) => setGps({ label: "GPS: Error", detail: error.message, tone: "red" }),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const loadMedia = useCallback(async () => {
    try {
      const data = await apiFetch<MediaItem[]>("/api/list_media");
      setMedia(Array.isArray(data) ? data : []);
    } catch {
      setMedia([]);
    }
  }, []);

  useEffect(() => {
    const firstLoadId = window.setTimeout(() => void loadMedia(), 0);
    const id = window.setInterval(() => void loadMedia(), 7000);
    return () => {
      window.clearTimeout(firstLoadId);
      window.clearInterval(id);
    };
  }, [loadMedia]);

  function flatMedia() {
    const output: MediaItem[] = [];
    for (const item of media) {
      if (item.type === "batch") output.push(...(item.chunks || []).map((chunk) => ({ ...chunk, type: "video" as const })));
      else output.push(item);
    }
    return output;
  }

  function drawVideoFrame() {
    const video = videoWrapRef.current?.querySelector("video");
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  async function captureSnapshot(download = false) {
    const canvas = drawVideoFrame();
    if (!canvas) {
      showToast("No active video frame to capture", "bad");
      return;
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return;
    const file: LocalFile = {
      name: `snapshot_${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`,
      url: URL.createObjectURL(blob),
      size: (blob.size / 1048576).toFixed(2),
      type: "image",
      created: new Date(),
    };
    setSnapshot(file);
    setLocalFiles((files) => [file, ...files]);
    if (download) downloadUrl(file.url, file.name);
    try {
      await apiFetch("/api/capture_photo");
    } catch {}
    showToast("Snapshot captured");
  }

  function startDesktopRecording() {
    const video = videoWrapRef.current?.querySelector("video") as
      | (HTMLVideoElement & { captureStream?: () => MediaStream })
      | null;
    const stream = video?.captureStream?.();
    if (!stream) {
      showToast("Desktop recording needs an active LiveKit video stream", "bad");
      return;
    }
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    recorder.ondataavailable = (event) => event.data.size && chunksRef.current.push(event.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setDesktopUrl(url);
      setLocalFiles((files) => [
        {
          name: `desktop_recording_${new Date().toISOString().replace(/[:.]/g, "-")}.webm`,
          url,
          size: (blob.size / 1048576).toFixed(2),
          type: "video",
          created: new Date(),
        },
        ...files,
      ]);
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setDesktopStart(Date.now());
    showToast("Desktop recording started");
  }

  function stopDesktopRecording() {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== "recording") {
      showToast("Desktop recorder is not active", "bad");
      return;
    }
    mediaRecorderRef.current.stop();
    setDesktopStart(null);
    showToast("Desktop recording stopped");
  }

  function downloadUrl(url: string, name: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function startLocalRecording() {
    try {
      await apiFetch("/api/start_record");
      setRecording(true);
      setRecordStart(Date.now());
      showToast("Local recording requested");
    } catch (error) {
      showToast(`Local recording unavailable: ${(error as Error).message}`, "bad");
    }
  }

  async function stopLocalRecording() {
    try {
      await apiFetch("/api/stop_record", { method: "POST" });
      setRecording(false);
      setRecordStart(null);
      showToast("Local recording stopped");
      void loadMedia();
    } catch (error) {
      showToast(`Stop recording failed: ${(error as Error).message}`, "bad");
    }
  }

  async function uploadMedia(item: MediaItem, ask = true) {
    if (ask && !confirm(`Upload ${item.name} to server?`)) return;
    try {
      await apiFetch(item.type === "image" ? "/api/upload_image" : "/api/upload_cloud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: item.name }),
      });
      showToast("Upload started");
      setSyncProgress(100);
      void loadMedia();
    } catch (error) {
      showToast(`Upload failed: ${(error as Error).message}`, "bad");
    }
  }

  async function deleteMedia(item: MediaItem) {
    if (!confirm(`Delete ${item.name}?`)) return;
    try {
      await apiFetch("/api/delete_file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: item.name }),
      });
      showToast("Deleted");
      void loadMedia();
    } catch (error) {
      showToast(`Delete failed: ${(error as Error).message}`, "bad");
    }
  }

  async function syncType(type: "video" | "image") {
    const items = flatMedia().filter((item) => (type === "image" ? item.type === "image" : item.type !== "image"));
    if (!items.length) {
      showToast(`No ${type} files available to sync`, "bad");
      return;
    }
    setSyncProgress(0);
    for (let index = 0; index < items.length; index++) {
      setSyncProgress(Math.round((index / items.length) * 100));
      await uploadMedia(items[index], false);
    }
    setSyncProgress(100);
  }

  function downloadLatest(type: "video" | "image") {
    const item = flatMedia().find((entry) => (type === "image" ? entry.type === "image" : entry.type !== "image"));
    if (!item) {
      showToast(`No ${type} files available`, "bad");
      return;
    }
    window.location.href = apiUrl(`/api/download/${encodeURIComponent(item.name)}`);
  }

  async function downloadLatestLog() {
    try {
      const logs = await apiFetch<LogItem[]>("/api/list_logs");
      const latest = Array.isArray(logs) ? logs[0] : null;
      if (!latest?.name) {
        showToast("No logs available", "bad");
        return;
      }
      window.location.href = apiUrl(`/api/download_log/${encodeURIComponent(latest.name)}`);
    } catch (error) {
      showToast(`Log download failed: ${(error as Error).message}`, "bad");
    }
  }

  function saveSettings() {
    localStorage.setItem("helmet-livekit-settings", JSON.stringify(settings));
    showToast("Settings saved locally");
  }

  const recent = flatMedia().slice(0, 5);
  const localRecordingTone: Tone = recording ? "green" : "yellow";
  const desktopTone: Tone = desktopStart ? "green" : desktopUrl ? "yellow" : "yellow";
  const syncTone: Tone = syncProgress > 0 && syncProgress < 100 ? "green" : "yellow";

  const navItems = [
    ["live", "LS", "Live Stream"],
    ["dashboard", "DB", "Dashboard"],
    ["recordings", "RC", "Recordings"],
    ["local", "LF", "Local Files"],
    ["server", "SF", "Server Files"],
    ["settings", "ST", "Settings"],
  ];

  return (
    <div className="app">
      {toast && <div className={`toast show ${toast.type}`}>{toast.message}</div>}
      <canvas ref={canvasRef} className="hidden-canvas" />

      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" />
          <span>Aspire Smart Helmet</span>
        </div>
        <nav className="nav">
          {navItems.map(([page, icon, label]) => (
            <button key={page} className={`nav-btn ${activePage === page ? "active" : ""}`} onClick={() => setActivePage(page)}>
              <span className="icon">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="device-card">
          <h3>Device Status</h3>
          <InfoRow label="State" value={<><Dot tone={online ? "green" : "yellow"} />{online ? "Online" : "Waiting"}</>} />
          <InfoRow label="Device ID" value={participantLabel} />
          <InfoRow label="Storage" value="Cloud viewer" />
          <div className="bar"><span style={{ width: "35%" }} /></div>
          <InfoRow label="Connection" value={connectionState} />
          <InfoRow label="Server Sync" value={syncProgress === 100 ? "Complete" : syncProgress > 0 ? "Syncing" : "Idle"} />
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{activePage === "live" ? "Live Stream" : activePage.charAt(0).toUpperCase() + activePage.slice(1)}</h1>
            <div className="subtitle">Enterprise LiveKit monitoring room: {ROOM_NAME}</div>
          </div>
          <div className="top-actions">
            <span className="circle">N</span>
            <button className="circle" onClick={() => setActivePage("settings")}>S</button>
            <span className="avatar">A</span>
            <strong>Admin</strong>
          </div>
        </header>

        <section className={`page ${activePage === "live" ? "active" : ""}`}>
          <div className="monitor-grid">
            <div className="left-stack">
              <section className="panel stream-card">
                <div ref={videoWrapRef} className="stream-stage">
                  {streamTrack && !streamPaused ? (
                    <VideoTrack trackRef={streamTrack} className="live-video" />
                  ) : (
                    <div className="feed-empty">
                      <div>{streamPaused ? "Stream paused" : "Waiting for helmet stream"}</div>
                      <span>LiveKit publisher identity: helmet-pi</span>
                    </div>
                  )}
                  <div className="overlay">
                    <div className="top-overlay">
                      <div className="badge-row">
                        <span className="badge live">{recording ? "REC" : "LIVE"}</span>
                        <span className="badge">{formatDuration(frameCount / 24)}</span>
                        <span className="badge"><Dot tone={streamOnline ? "green" : "yellow"} />{streamOnline ? "Connected" : "Waiting"}</span>
                      </div>
                      <div className="badge-row">
                        <span className="badge">{quality}</span>
                        <span className="badge signal-badge"><span className="signal"><i /><i /><i /><i /></span>{streamOnline ? "Strong" : "Weak"}</span>
                      </div>
                    </div>
                    <div className="bottom-controls">
                      <div className="control-cluster">
                        <button className="player-btn" onClick={() => setStreamPaused(false)}>PLY</button>
                        <button className="player-btn" onClick={() => setStreamPaused(true)}>PAU</button>
                        <button className="player-btn" onClick={() => setStreamPaused(true)}>STP</button>
                      </div>
                      <div className="volume">
                        <button className="player-btn" onClick={() => setMuted((value) => !value)}>{muted ? "UNM" : "MUT"}</button>
                        <input type="range" min="0" max="100" defaultValue="72" />
                      </div>
                      <div className="control-cluster">
                        <button className="player-btn" onClick={() => void captureSnapshot(false)}>IMG</button>
                        <button className="player-btn" onClick={() => videoWrapRef.current?.requestFullscreen?.()}>FS</button>
                        <select className="select" value={quality} onChange={(event) => setQuality(event.target.value)}>
                          <option>1080p</option>
                          <option>720p</option>
                          <option>480p</option>
                          <option>Auto</option>
                        </select>
                        <button className="player-btn" onClick={() => setActivePage("settings")}>SET</button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="info-grid">
                <div className="panel panel-pad">
                  <h2 className="panel-title">Stream Information</h2>
                  <InfoRow label="Mode" value="LiveKit WebRTC" />
                  <InfoRow label="Resolution" value={quality} />
                  <InfoRow label="FPS" value="24 target" />
                  <InfoRow label="Frames" value={String(frameCount)} />
                </div>
                <div className="panel panel-pad">
                  <h2 className="panel-title">System Status</h2>
                  <InfoRow label="Stream" value={<><Dot tone={streamOnline ? "green" : "yellow"} />{streamOnline ? "Active" : "Waiting"}</>} />
                  <InfoRow label="Local Rec" value={<><Dot tone={localRecordingTone} />{recording ? "Active" : "Idle"}</>} />
                  <InfoRow label="Desktop Rec" value={<><Dot tone={desktopTone} />{desktopStart ? "Active" : "Idle"}</>} />
                  <InfoRow label="Live Talk" value={<><Dot tone="yellow" />Ready</>} />
                </div>
                <div className="panel panel-pad">
                  <h2 className="panel-title">Connection</h2>
                  <InfoRow label="Room" value={ROOM_NAME} />
                  <InfoRow label="Publisher" value={participantLabel} />
                  <InfoRow label="GPS" value={gps.detail} />
                </div>
              </section>

              <section className="panel panel-pad">
                <div className="panel-head">
                  <h2 className="panel-title">Recent Recordings</h2>
                  <button className="btn" onClick={() => setActivePage("recordings")}>View All Recordings</button>
                </div>
                <RecordList items={recent} onDelete={deleteMedia} onSync={uploadMedia} />
              </section>
            </div>

            <aside className="right-stack">
              <section className="action-card">
                <h3>Local Recording</h3>
                <InfoRow label="State" value={<><Dot tone={localRecordingTone} />{recording ? "Recording" : "Idle"}</>} />
                <InfoRow label="Duration" value={recordStart ? formatDuration(elapsed) : "00:00"} />
                <div className="action-row">
                  <button className="btn green" onClick={() => void startLocalRecording()}>Start recording</button>
                  <button className="btn red" onClick={() => void stopLocalRecording()}>Stop recording</button>
                </div>
              </section>

              <section className="action-card">
                <h3>Desktop Recording</h3>
                <InfoRow label="State" value={<><Dot tone={desktopTone} />{desktopStart ? "Recording" : desktopUrl ? "Ready" : "Idle"}</>} />
                <InfoRow label="Duration" value={desktopStart ? formatDuration(desktopElapsed) : "00:00"} />
                <div className="action-row">
                  <button className="btn green" onClick={startDesktopRecording}>Record stream</button>
                  <button className="btn red" onClick={stopDesktopRecording}>Stop</button>
                  <button className="btn primary" onClick={() => desktopUrl ? downloadUrl(desktopUrl, "desktop_recording.webm") : showToast("No desktop recording yet", "bad")}>Download</button>
                </div>
              </section>

              <section className="action-card">
                <h3>Sync To Server</h3>
                <InfoRow label="Progress" value={`${syncProgress}%`} />
                <div className="meter"><span style={{ width: `${syncProgress}%` }} /></div>
                <div className="action-row">
                  <button className="btn green" onClick={() => void syncType("video")}>Upload recordings</button>
                  <button className="btn green" onClick={() => void syncType("image")}>Upload snapshots</button>
                </div>
              </section>

              <section className="action-card">
                <h3>Download Files</h3>
                <div className="action-row">
                  <button className="btn primary" onClick={() => downloadLatest("video")}>Download recordings</button>
                  <button className="btn primary" onClick={() => downloadLatest("image")}>Download snapshots</button>
                  <button className="btn" onClick={() => void downloadLatestLog()}>Download logs</button>
                </div>
              </section>

              <section className="action-card">
                <h3>Snapshot</h3>
                <InfoRow label="Last capture" value={snapshot?.name || "None"} />
                <div className="action-row">
                  <button className="btn primary" onClick={() => void captureSnapshot(false)}>Capture frame</button>
                  <button className="btn" onClick={() => void captureSnapshot(true)}>Save locally</button>
                  <button className="btn" onClick={() => snapshot ? window.open(snapshot.url, "_blank") : showToast("No snapshot captured yet", "bad")}>Preview captured image</button>
                </div>
              </section>

              <LiveTalkPanel onToast={showToast} />
            </aside>
          </div>
        </section>

        <section className={`page ${activePage === "dashboard" ? "active" : ""}`}>
          <section className="panel panel-pad">
            <div className="panel-head"><h2 className="panel-title">System Status</h2><span className="panel-sub">Live indicators</span></div>
            <div className="system-grid">
              <StatusTile label="Stream" tone={streamOnline ? "green" : "yellow"} detail={streamOnline ? "Active" : "Waiting"} />
              <StatusTile label="Local Recording" tone={localRecordingTone} detail={recording ? "Active" : "Idle"} />
              <StatusTile label="Desktop Recording" tone={desktopTone} detail={desktopStart ? "Active" : "Idle"} />
              <StatusTile label="Live Talk" tone="yellow" detail="Ready" />
              <StatusTile label="Server Sync" tone={syncTone} detail={syncProgress ? `${syncProgress}%` : "Idle"} />
              <StatusTile label="Device Connection" tone={online ? "green" : "yellow"} detail={connectionState} />
            </div>
          </section>
        </section>

        <section className={`page ${activePage === "recordings" ? "active" : ""}`}>
          <section className="panel panel-pad">
            <div className="panel-head"><h2 className="panel-title">Recordings</h2><span className="panel-sub">{flatMedia().length} file(s)</span></div>
            <RecordList items={flatMedia()} onDelete={deleteMedia} onSync={uploadMedia} />
          </section>
        </section>

        <section className={`page ${activePage === "local" ? "active" : ""}`}>
          <section className="panel panel-pad">
            <div className="panel-head"><h2 className="panel-title">Local Files</h2><span className="panel-sub">Browser captures</span></div>
            <LocalList files={localFiles} onDownload={downloadUrl} />
          </section>
        </section>

        <section className={`page ${activePage === "server" ? "active" : ""}`}>
          <section className="panel panel-pad">
            <div className="panel-head"><h2 className="panel-title">Server Files</h2><span className="panel-sub">Device API media</span></div>
            <RecordList items={flatMedia()} onDelete={deleteMedia} onSync={uploadMedia} />
          </section>
        </section>

        <section className={`page ${activePage === "settings" ? "active" : ""}`}>
          <section className="panel panel-pad">
            <div className="panel-head"><h2 className="panel-title">Settings</h2><span className="panel-sub">Stored locally in browser</span></div>
            <div className="settings-grid">
              <SettingsCard title="Stream Settings" fields={[["resolution", "Resolution", ["1080p", "720p", "480p"]], ["fps", "FPS", "30"], ["bitrate", "Bitrate", "4.5 Mbps"], ["codec", "Codec", ["LiveKit", "H.264", "MJPEG"]]]} values={settings} setValues={setSettings} />
              <SettingsCard title="Recording Settings" fields={[["localPath", "Local path", "Downloads/Aspire"], ["format", "Format", ["webm", "mp4"]], ["autoRecord", "Auto-record", ["Off", "On connect", "Scheduled"]]]} values={settings} setValues={setSettings} />
              <SettingsCard title="Audio Settings" fields={[["input", "Input device", "Default microphone"], ["output", "Output device", "Default speaker"], ["volume", "Volume", "72"]]} values={settings} setValues={setSettings} />
              <SettingsCard title="Server Settings" fields={[["serverUrl", "Server URL", DEVICE_API_BASE || "Vercel device proxy"], ["syncInterval", "Sync interval", ["Manual", "5 min", "15 min", "Hourly"]], ["auth", "Authentication", "Token"]]} values={settings} setValues={setSettings} />
              <SettingsCard title="UI Settings" fields={[["theme", "Theme", ["Dark surveillance", "High contrast"]], ["sidebar", "Sidebar behavior", ["Fixed", "Auto collapse"]], ["layout", "Layout", ["Desktop monitoring", "Compact"]]]} values={settings} setValues={setSettings} />
            </div>
            <div className="settings-actions"><button className="btn primary" onClick={saveSettings}>Save settings</button></div>
          </section>
        </section>
      </main>

      <RoomAudioRenderer muted={muted} />
    </div>
  );
}

function StatusTile({ label, tone, detail }: { label: string; tone: Tone; detail: string }) {
  return (
    <div className="sys">
      <strong><Dot tone={tone} />{label}</strong>
      <div>{detail}</div>
    </div>
  );
}

function RecordList({
  items,
  onDelete,
  onSync,
}: {
  items: MediaItem[];
  onDelete: (item: MediaItem) => void;
  onSync: (item: MediaItem) => void;
}) {
  if (!items.length) return <div className="empty-state">No recordings available</div>;
  return (
    <div className="recent-list">
      {items.map((item) => (
        <div className="record-item" key={item.name}>
          <div className="thumb">{item.type === "image" ? "IMG" : "MP4"}</div>
          <div>
            <div className="file-name">{item.name}</div>
            <div className="file-meta">
              {new Date().toLocaleDateString()} - {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {sizeLabel(item.size)} - -- duration
            </div>
          </div>
          <div className="file-actions">
            <a className="mini-btn blue" href={apiUrl(`/api/download/${encodeURIComponent(item.name)}`)} download>
              Download
            </a>
            <button className="mini-btn red" onClick={() => onDelete(item)}>Delete</button>
            <button className="mini-btn green" onClick={() => onSync(item)}>Sync</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function LocalList({ files, onDownload }: { files: LocalFile[]; onDownload: (url: string, name: string) => void }) {
  if (!files.length) return <div className="empty-state">No local captures yet</div>;
  return (
    <div className="recent-list">
      {files.map((file) => (
        <div className="record-item" key={file.url}>
          <div className="thumb">{file.type === "image" ? "IMG" : "WEBM"}</div>
          <div>
            <div className="file-name">{file.name}</div>
            <div className="file-meta">{file.created.toLocaleString()} - {file.size} MB</div>
          </div>
          <div className="file-actions">
            <button className="mini-btn blue" onClick={() => onDownload(file.url, file.name)}>Download</button>
          </div>
        </div>
      ))}
    </div>
  );
}

type SettingField = [string, string, string | string[]];

function SettingsCard({
  title,
  fields,
  values,
  setValues,
}: {
  title: string;
  fields: SettingField[];
  values: Record<string, string>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  return (
    <div className="settings-card">
      <h3>{title}</h3>
      {fields.map(([key, label, config]) => (
        <label key={key}>
          {label}
          {Array.isArray(config) ? (
            <select value={values[key] || config[0]} onChange={(event) => setValues((prev) => ({ ...prev, [key]: event.target.value }))}>
              {config.map((option) => <option key={option}>{option}</option>)}
            </select>
          ) : (
            <input value={values[key] || config} onChange={(event) => setValues((prev) => ({ ...prev, [key]: event.target.value }))} />
          )}
        </label>
      ))}
    </div>
  );
}

export default function Home() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/token")
      .then(async (response) => {
        const data = (await response.json()) as TokenResponse;
        if (!response.ok || !data.token) throw new Error(data.error || "Unable to create LiveKit token");
        setToken(data.token);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <main className="status-screen">
        <h1>Aspire Smart Helmet</h1>
        <p>{error}</p>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="status-screen">
        <h1>Aspire Smart Helmet</h1>
        <p>Connecting to LiveKit...</p>
      </main>
    );
  }

  return (
    <LiveKitRoom token={token} serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL} connect video={false} audio={false}>
      <HelmetDashboard />
    </LiveKitRoom>
  );
}
