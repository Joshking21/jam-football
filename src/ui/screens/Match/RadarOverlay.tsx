// Implements SPEC §14.1 & §11.16 2D Radar Time-Lapse Overlay
import React from 'react';
import { FastForward } from 'lucide-react';

interface RadarOverlayProps {
  ballX: number; // 0..105 (absolute pitch coords)
  ballY: number; // 0..68
  speedMultiplier: number;
  timeLapseProgress: number; // 0..1
}

export const RadarOverlay: React.FC<RadarOverlayProps> = ({ ballX, ballY, speedMultiplier }) => {
  // Pitch dimensions in radar: 200 x 130
  const width = 210;
  const height = 136;

  // Map 0..105 to 5..205, 0..68 to 5..131
  const bx = 5 + (ballX / 105) * (width - 10);
  const by = 5 + (ballY / 68) * (height - 10);

  return (
    <div
      style={{
        position: 'absolute',
        top: 80,
        right: 24,
        background: 'rgba(10, 14, 20, 0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: 8,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        zIndex: 40,
        pointerEvents: 'none',
        animation: 'fadeIn 0.3s ease-out',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: '#F4B41A',
          fontSize: 11,
          fontFamily: 'var(--font-heading)',
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        <FastForward size={14} className="animate-pulse" />
        <span>Time-Lapse {Math.round(speedMultiplier)}×</span>
      </div>

      {/* Mini 2D pitch radar */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{
          background: 'rgba(20, 35, 25, 0.95)',
          borderRadius: 4,
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        {/* Outer boundary */}
        <rect
          x={5}
          y={5}
          width={width - 10}
          height={height - 10}
          fill="none"
          stroke="rgba(255, 255, 255, 0.4)"
          strokeWidth="1.2"
        />

        {/* Halfway line */}
        <line
          x1={width / 2}
          y1={5}
          x2={width / 2}
          y2={height - 5}
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth="1.2"
        />

        {/* Center circle */}
        <circle
          cx={width / 2}
          cy={height / 2}
          r={18}
          fill="none"
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth="1.2"
        />

        {/* Left penalty box */}
        <rect
          x={5}
          y={height / 2 - 32}
          width={32}
          height={64}
          fill="none"
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth="1"
        />

        {/* Right penalty box */}
        <rect
          x={width - 37}
          y={height / 2 - 32}
          width={32}
          height={64}
          fill="none"
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth="1"
        />

        {/* Moving Match Ball */}
        <circle
          cx={bx}
          cy={by}
          r={4}
          fill="#FFF"
          stroke="#000"
          strokeWidth="1"
          style={{
            filter: 'drop-shadow(0 0 4px #F4B41A)',
            transition: 'cx 0.08s linear, cy 0.08s linear',
          }}
        />
      </svg>
    </div>
  );
};
