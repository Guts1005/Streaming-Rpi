"use client";

import "@livekit/components-styles";
import { LiveKitRoom, RoomAudioRenderer, VideoTrack, isTrackReference, useConnectionState, useRoomContext, useTracks } from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { useEffect, useMemo, useState } from "react";
import CustomersView from "@/components/CustomersView";

type TokenResponse = { token?: string; error?: string };
const ROOM = process.env.NEXT_PUBLIC_LIVEKIT_ROOM || "helmet-live";
const nav = [["Live Stream","LS"],["Customers","CS"],["Dashboard","DB"],["Recordings","RC"],["AI Analytics","AI"],["Reports","RP"],["Local Files","LF"],["Server Files","SF"],["Settings","ST"]];
function Dot({ ok }: { ok: boolean }) { return <span className={`dot ${ok ? "green" : "yellow"}`} />; }
async function device(path: string, init?: RequestInit) { return fetch(`/api/device${path}`, init); }
function Action({tone,title,sub,onClick,active}:{tone:string;title:string;sub:string;onClick?:()=>void;active?:boolean}){return <button onClick={onClick} className={`action ${active?"on":""}`}><i className={tone}/><span><b>{title}</b><small>{sub}</small></span></button>}
function Stat({label,value,ok}:{label:string;value:string;ok:boolean}){return <div className="stat"><b><Dot ok={ok}/>{label}</b><span>{value}</span></div>}

function Dashboard() {
  const room = useRoomContext();
  const state = useConnectionState();
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true });
  const video = tracks.find(isTrackReference);
  const [audioOn, setAudioOn] = useState(false);
  const [talking, setTalking] = useState(false);
  const [rec, setRec] = useState(false);
  const [msg, setMsg] = useState("");
  const [currentView, setCurrentView] = useState("Live Stream");
  const connected = state === ConnectionState.Connected;
  const liveFor = useMemo(() => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), []);
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const payload = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy || 0,
          speed: position.coords.speed || 0,
        };
        device("/api/update_gps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);
  async function toast(text: string) { setMsg(text); setTimeout(() => setMsg(""), 2200); }
  async function toggleAudio() { setAudioOn(v => !v); if (!audioOn && room.startAudio) await room.startAudio().catch(() => {}); }
  async function toggleTalk() { try { await room.localParticipant.setMicrophoneEnabled(!talking); setTalking(!talking); toast(!talking ? "Talk mode on" : "Talk mode off"); } catch (e) { toast(`Mic failed: ${(e as Error).message}`); } }
  async function startRec() { await device("/api/start_record"); setRec(true); toast("Recording started"); }
  async function stopRec() { await device("/api/stop_record", { method: "POST" }); setRec(false); toast("Recording stopped"); }
  async function snap() { await device("/api/capture_photo"); toast("Snapshot captured"); }
  return <div className="app-shell">{msg && <div className="toast">{msg}</div>}
    <aside className="side"><div className="brand"><span className="mark"/><div>Aspire Smart Vision<small>Live Monitoring & Analytics</small></div></div><nav>{nav.map(([x,ic],i)=><button key={x} onClick={()=>setCurrentView(x)} className={currentView===x?"nav active":"nav"}><em>{ic}</em>{x}</button>)}</nav><div className="device"><b>Device Status</b><p><Dot ok={connected}/>{connected?"Online":"Checking"}</p><p>Device ID <strong>Smart Helmet Pi</strong></p><p>Room <strong>{ROOM}</strong></p><div className="bar"><span/></div><p>Audio <strong>{audioOn?"Enabled":"Muted"}</strong></p></div></aside>
    <main className="main"><header><div><h1>{currentView}</h1><p>Real-time stream from Camera #CAM-1023</p></div><div className="top"><span>3</span><button>sun</button><b>A</b><strong onClick={async()=>{await fetch('/api/logout',{method:'POST'});window.location.href='/login';}} style={{cursor:'pointer'}}>Logout</strong></div></header>
      {currentView === "Customers" ? <CustomersView /> : (
      <section className="grid"><div className="left"><div className="stream-card"><div className="badges"><b>LIVE</b><span>{liveFor}</span><span><Dot ok={connected}/>{connected?"Connected":"Connecting"}</span></div><div className="quality"><Dot ok={connected}/>1080p</div>{video ? <VideoTrack trackRef={video} className="video" /> : <div className="black">Waiting for LiveKit video...</div>}<div className="controls"><button>PLY</button><button>PAU</button><button onClick={toggleAudio}>{audioOn?"AUD ON":"AUD OFF"}</button><input type="range" defaultValue={72}/><button onClick={snap}>IMG</button><button>FS</button></div></div><div className="compare"><div><h2>Construction Progress Comparison</h2><p>Compare site progress between selected dates</p></div><button>Generate AI Report</button><div className="cards"><section><label>1st May 2024</label></section><section><label>15th May 2024</label></section></div></div></div>
      <aside className="right"><h2>Quick Actions</h2><div className="actions"><Action tone="red" title="Local Recording" sub={rec?"Stop Recording":"Start Recording"} onClick={rec?stopRec:startRec} active={rec}/><Action tone="blue" title="Desktop Recording" sub="Record on PC"/><Action tone="green" title="Sync to Server" sub="Upload everything" onClick={()=>toast("Sync from Server Files")}/><Action tone="purple" title="Download Files" sub="View all captures"/><Action tone="orange" title="Snapshot" sub="Capture image" onClick={snap}/><Action tone="teal" title="Live Talk" sub={talking?"Talking - tap to stop":"Tap to speak"} onClick={toggleTalk} active={talking}/></div><div className="sync"><span>Sync Progress</span><b>0%</b><div><i/></div></div><section className="panel"><h2>Recent Recordings</h2><div className="empty">Loading recordings</div><button>View All Recordings</button></section><section className="panel"><h2>System Status</h2><div className="status"><Stat label="Live Stream" value={connected?"Active":"Connecting"} ok={connected}/><Stat label="Recording" value={rec?"Recording":"Idle"} ok={rec}/><Stat label="Audio" value={audioOn?"Enabled":"Muted"} ok={audioOn}/><Stat label="Talk" value={talking?"On":"Ready"} ok={talking}/></div></section></aside></section>
      )}
    </main><RoomAudioRenderer muted={!audioOn}/></div>;
}
export default function Home(){const[token,setToken]=useState("");const[err,setErr]=useState("");useEffect(()=>{fetch("/api/token").then(async r=>{const j=await r.json() as TokenResponse;if(!r.ok||!j.token)throw new Error(j.error||"Token failed");setToken(j.token)}).catch(e=>setErr(e.message))},[]);if(err)return <main className="black">{err}</main>;if(!token)return <main className="black">Connecting to LiveKit...</main>;return <LiveKitRoom token={token} serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL} connect video={false} audio={false}><Dashboard/></LiveKitRoom>}
