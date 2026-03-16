import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Activity, Car, Clock, Navigation, Play, Square,
  Pause, RotateCcw, History, SkipBack, SkipForward
} from 'lucide-react';

const API = 'http://localhost:8000';

// SUMO XY → WGS84 (linear interpolation from network bounds)
const SUMO_W = 950.21, SUMO_H = 535.15;
const LAT_MIN = 33.594925, LAT_MAX = 33.599783;
const LON_MIN = -7.654880, LON_MAX = -7.644642;
const xy2ll = (x, y) => [
  LAT_MIN + (y / SUMO_H) * (LAT_MAX - LAT_MIN),
  LON_MIN + (x / SUMO_W) * (LON_MAX - LON_MIN),
];

const MAP_CENTER = xy2ll(563, 378);
const MAP_ZOOM   = 17;

// Canvas overlay for vehicles
function VehiclesOverlay({ vehicles }) {
  const map  = useMap();
  const canv = useRef(null);

  useEffect(() => {
    const canvas = canv.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const sz  = map.getSize();
    canvas.width  = sz.x;
    canvas.height = sz.y;
    ctx.clearRect(0, 0, sz.x, sz.y);
    (vehicles || []).forEach(v => {
      const ll = xy2ll(...v.position);
      const pt = map.latLngToContainerPoint(ll);
      ctx.shadowBlur  = 12;
      ctx.shadowColor = '#ef4444';
      ctx.fillStyle   = '#f87171';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur  = 0;
    });
  }, [vehicles, map]);

  return (
    <canvas ref={canv}
      style={{ position: 'absolute', top: 0, left: 0, zIndex: 450,
               pointerEvents: 'none', width: '100%', height: '100%' }} />
  );
}

// Trajectory polylines (for trails)
function Trajectories({ data }) {
  const paths = {};
  data.forEach(step => (step.vehicles || []).forEach(v => {
    if (!paths[v.vehicle_id]) paths[v.vehicle_id] = [];
    paths[v.vehicle_id].push(xy2ll(...v.position));
  }));
  return <>
    {Object.entries(paths).map(([id, pts]) => pts.length > 1
      ? <Polyline key={id} positions={pts}
          pathOptions={{ color: '#3b82f6', weight: 2, opacity: 0.45 }} />
      : null)}
  </>;
}

export default function App() {
  // Playback state
  const [replayInfo, setReplayInfo] = useState({ total_steps: 0, min_step: 0, max_step: 0 });
  const [playStep, setPlayStep]     = useState(0);
  const [playData, setPlayData]     = useState(null);
  const [playHistory, setPlayHistory] = useState([]);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [logs, setLogs]             = useState([]);
  const playRef = useRef(null);

  const addLog = useCallback((msg, type = 'info') =>
    setLogs(p => [{ msg, type, ts: new Date().toLocaleTimeString() }, ...p].slice(0, 40)), []);

  // Fetch replay info on mount
  useEffect(() => {
    fetch(`${API}/replay/info`)
      .then(r => r.json())
      .then(d => {
        setReplayInfo(d);
        if (d.total_steps > 0) {
          setPlayStep(d.min_step);
          addLog(`Historique chargé : ${d.total_steps} étapes trouvées.`, 'success');
        } else {
          addLog('Aucune donnée de simulation trouvée dans la base.', 'warning');
        }
      })
      .catch(() => addLog('Impossible de se connecter à l\'API.', 'error'));
  }, [addLog]);

  // Fetch a single step
  const fetchStep = useCallback(async (step) => {
    try {
      const r = await fetch(`${API}/replay/step/${step}`);
      const d = await r.json();
      if (!d.error) {
        setPlayData(d);
        setPlayHistory(prev => [...prev, d].slice(-20)); // Trail of last 20 steps
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (replayInfo.total_steps > 0) {
      fetchStep(playStep);
    }
  }, [playStep, replayInfo.total_steps, fetchStep]);

  // Auto-play
  useEffect(() => {
    if (!isPlaying) return;
    playRef.current = setInterval(() => {
      setPlayStep(s => {
        if (s >= replayInfo.max_step) { setIsPlaying(false); return s; }
        return s + 1;
      });
    }, 200);
    return () => clearInterval(playRef.current);
  }, [isPlaying, replayInfo.max_step]);

  const stats = [
    { label: 'Vehicles', value: playData?.vehicle_count ?? 0, color: '#3b82f6', icon: <Car size={16}/> },
    { label: 'Avg Speed', value: playData?.average_speed?.toFixed(2) ?? '0.00', color: '#10b981', icon: <Activity size={16}/> },
    { label: 'Avg Delay', value: playData?.total_waiting_time?.toFixed(2) ?? '0.00', color: '#f59e0b', icon: <Clock size={16}/> },
    { label: 'Step', value: playData?.step ?? playStep, color: '#8b5cf6', icon: <Navigation size={16}/> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f0f2f5', fontFamily: 'Inter,system-ui,sans-serif', overflow: 'hidden' }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 56, background: '#fff', borderBottom: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,.06)', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Navigation size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>Agent Carrefour</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>Playback Simulation Dashboard</div>
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#4f46e5', background: '#eff6ff', padding: '6px 14px', borderRadius: 20, border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: 6 }}>
          <History size={14} /> Mode Relecture
        </div>
      </header>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* Left: Map + Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, borderRight: '1px solid #e5e7eb' }}>
          
          {/* Map */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <MapContainer center={MAP_CENTER} zoom={MAP_ZOOM} style={{ width: '100%', height: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Trajectories data={playHistory} />
              <VehiclesOverlay vehicles={playData?.vehicles || []} />
            </MapContainer>

            {/* Float badge */}
            <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000, padding: '8px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(4px)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', fontSize: 13, fontWeight: 600, color: '#111827' }}>
              <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 500, marginBottom: 2 }}>Simulation Step</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 18, color: '#4f46e5' }}>{playStep}</span>
                <span style={{ color: '#9ca3af' }}>/ {replayInfo.max_step}</span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div style={{ background: '#fff', borderTop: '1px solid #e5e7eb', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button onClick={() => { setPlayStep(replayInfo.min_step); setPlayHistory([]); }} style={btnStyle('#374151', '#f9fafb', '#d1d5db')}>
                <SkipBack size={16}/> Début
              </button>
              <button onClick={() => setIsPlaying(!isPlaying)} style={btnStyle(isPlaying ? '#dc2626' : '#16a34a', isPlaying ? '#fee2e2' : '#dcfce7', isPlaying ? '#fca5a5' : '#86efac')}>
                {isPlaying ? <><Pause size={16}/> Pause</> : <><Play size={16}/> Lecture</>}
              </button>
              <button onClick={() => { setIsPlaying(false); setPlayStep(replayInfo.min_step); setPlayHistory([]); }} style={btnStyle('#dc2626', '#fee2e2', '#fca5a5')}>
                <Square size={16}/> Terminer
              </button>
              <button onClick={() => setPlayStep(replayInfo.max_step)} style={btnStyle('#374151', '#f9fafb', '#d1d5db')}>
                <SkipForward size={16}/> Fin
              </button>
              
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>Vitesse de lecture</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>5 FPS</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, minWidth: 40 }}>{replayInfo.min_step}</span>
              <input type="range" min={replayInfo.min_step} max={replayInfo.max_step} value={playStep}
                onChange={e => { setPlayStep(Number(e.target.value)); setPlayHistory([]); }}
                style={{ flex: 1, accentColor: '#4f46e5', cursor: 'pointer' }} />
              <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, minWidth: 40, textAlign: 'right' }}>{replayInfo.max_step}</span>
            </div>
          </div>
        </div>

        {/* Right: Sidebar */}
        <div style={{ width: 320, display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
            <h2 style={{ fontWeight: 700, fontSize: 18, color: '#111827', margin: 0 }}>Statistiques</h2>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0 0' }}>Analyse de l'étape sélectionnée</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 20, borderBottom: '1px solid #f3f4f6' }}>
            {stats.map((s, i) => (
              <div key={i} style={{ background: '#f9fafb', borderRadius: 12, padding: '16px', border: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9ca3af', fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>
                  <span style={{ color: s.color }}>{s.icon}</span>{s.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Traffic Lights */}
          {playData?.traffic_lights?.length > 0 && (
            <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 12px 0' }}>Feux de circulation</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {playData.traffic_lights.map((tl, i) => {
                  const green = tl.state.toLowerCase().includes('g');
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f9fafb', padding: '8px 12px', borderRadius: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: green ? '#22c55e' : '#ef4444', boxShadow: `0 0 8px ${green ? '#22c55e' : '#ef4444'}` }}/>
                      <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{tl.traffic_light_id}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>Phase {tl.phase}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Activity Log */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '20px 20px 10px 20px' }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', margin: 0 }}>Journal d'activités</h3>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {logs.length === 0 && <p style={{ fontSize: 12, color: '#d1d5db', fontStyle: 'italic', textAlign: 'center', marginTop: 20 }}>Aucune activité</p>}
              {logs.map((log, i) => {
                const colors = { error: '#b91c1c', warning: '#92400e', success: '#166534', info: '#1d4ed8' };
                const bg = { error: '#fef2f2', warning: '#fffbeb', success: '#f0fdf4', info: '#eff6ff' };
                return (
                  <div key={i} style={{ fontSize: 12, borderRadius: 8, padding: '10px 12px', background: bg[log.type], color: colors[log.type], border: `1px solid ${bg[log.type]}` }}>
                    <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 2 }}>{log.ts}</div>
                    <div style={{ fontWeight: 500 }}>{log.msg}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function btnStyle(color, bg, border) {
  return { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, border: `1px solid ${border}`, color, background: bg, cursor: 'pointer', transition: 'all 0.2s ease' };
}
