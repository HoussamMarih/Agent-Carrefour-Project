import React, { useEffect, useRef, useState } from 'react';
import { Activity, Car, Clock, Navigation } from 'lucide-react';
import { motion } from 'framer-motion';

const TRAJECTORY_API = 'http://localhost:8000';

function SimulationCanvas() {
  const canvasRef = useRef(null);
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [trajRes, statsRes] = await Promise.all([
          fetch(`${TRAJECTORY_API}/trajectories?limit=5`),
          fetch(`${TRAJECTORY_API}/stats`)
        ]);
        if (!trajRes.ok || !statsRes.ok) throw new Error("Server error");
        const trajData = await trajRes.json();
        const statsData = await statsRes.json();
        setData(trajData);
        setStats(statsData);
        setIsConnected(true);
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setIsConnected(false);
      }
    };

    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = 'rgba(48, 54, 61, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 50) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke();
    }
    for (let i = 0; i < height; i += 50) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(width, i); ctx.stroke();
    }

    // Draw vehicles
    const lastStep = data[data.length - 1];
    if (lastStep && lastStep.vehicles) {
      lastStep.vehicles.forEach(vehicle => {
        const [x, y] = vehicle.position;
        
        // Accurate scaling for 950x535 network to 1000x700 canvas
        const scX = x + 25; // Slight padding
        const scY = (height - y) - 50; // Flip Y for screen coords

        // Draw car
        ctx.fillStyle = '#58a6ff';
        ctx.beginPath();
        ctx.arc(scX, scY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Glow effect
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#58a6ff';
        ctx.stroke();
        ctx.shadowBlur = 0;
      });
    }

    // Draw Traffic Lights (Refined locations)
    if (lastStep && lastStep.traffic_lights) {
        lastStep.traffic_lights.forEach((tl, idx) => {
            const isGreen = tl.state.toLowerCase().includes('g');
            ctx.fillStyle = isGreen ? '#3fb950' : '#f85149';
            ctx.beginPath();
            ctx.arc(500, 350 + (idx * 30), 8, 0, Math.PI * 2);
            ctx.fill();
        });
    }

  }, [data]);

  return (
    <div className="dashboard">
      <div className="canvas-container">
        <canvas ref={canvasRef} width={1000} height={700} />
      </div>

      <div className="stats-panel">
        <div className={`stat-card ${isConnected ? 'connected' : 'disconnected'}`}>
          <div className="stat-label">Statut Backend</div>
          <div className="stat-value">{isConnected ? 'Connecté' : 'Hors ligne'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><Car className="inline w-4 h-4 mr-1" /> Véhicules Actifs</div>
          <div className="stat-value">{stats?.vehicle_count || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><Clock className="inline w-4 h-4 mr-1" /> Étape Simulation</div>
          <div className="stat-value">{stats?.step || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><Activity className="inline w-4 h-4 mr-1" /> Attente Totale</div>
          <div className="stat-value">{stats?.total_waiting_time?.toFixed(1) || 0}s</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><Navigation className="inline w-4 h-4 mr-1" /> Queue Moyenne</div>
          <div className="stat-value">{stats?.total_queue_length || 0}</div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div>
      <h1>Agent Carrefour : Visualisation Live</h1>
      <SimulationCanvas />
    </div>
  );
}
