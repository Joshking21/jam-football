// Implements SPEC §11.16 & §14.1 Top-Right Broadcast Controls
import React from 'react';
import { PlaybackMode } from './playback';
import { CameraMode } from '../../../render3d/types';
import { Play, Pause, Camera, Zap, BarChart2, MessageSquare, Maximize2 } from 'lucide-react';

interface MatchControlsProps {
  paused: boolean;
  mode: PlaybackMode;
  fullSpeed: 2 | 4 | 8;
  cameraMode: CameraMode;
  statsOpen: boolean;
  assistantOpen: boolean;
  onTogglePause: () => void;
  onSelectMode: (mode: PlaybackMode) => void;
  onCycleFullSpeed: () => void;
  onCycleCamera: () => void;
  onToggleStats: () => void;
  onToggleAssistant: () => void;
  onInstantResult: () => void;
  onToggleFullscreen: () => void;
}

export const MatchControls: React.FC<MatchControlsProps> = ({
  paused,
  mode,
  fullSpeed,
  cameraMode,
  statsOpen,
  assistantOpen,
  onTogglePause,
  onSelectMode,
  onCycleFullSpeed,
  onCycleCamera,
  onToggleStats,
  onToggleAssistant,
  onInstantResult,
  onToggleFullscreen,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        right: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(10, 14, 20, 0.85)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: 8,
        padding: '6px 10px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
        zIndex: 50,
        userSelect: 'none',
      }}
    >
      {/* Play/Pause */}
      <button
        onClick={onTogglePause}
        title="Play / Pause (Space / P)"
        style={{
          background: paused ? '#2563EB' : 'rgba(255, 255, 255, 0.1)',
          color: '#FFF',
          border: 'none',
          borderRadius: 6,
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 12,
        }}
      >
        {paused ? <Play size={15} fill="#FFF" /> : <Pause size={15} />}
        <span>{paused ? 'Play' : 'Pause'}</span>
      </button>

      {/* Speed Mode Selector */}
      <div
        style={{
          display: 'flex',
          background: 'rgba(0, 0, 0, 0.4)',
          borderRadius: 6,
          padding: 2,
        }}
      >
        <button
          onClick={() => onSelectMode('key')}
          title="Key Highlights (1)"
          style={{
            background: mode === 'key' ? 'var(--color-accent, #2563EB)' : 'transparent',
            color: mode === 'key' ? '#FFF' : 'rgba(255, 255, 255, 0.6)',
            border: 'none',
            borderRadius: 4,
            padding: '5px 9px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Key
        </button>
        <button
          onClick={() => onSelectMode('extended')}
          title="Extended Highlights (2)"
          style={{
            background: mode === 'extended' ? 'var(--color-accent, #2563EB)' : 'transparent',
            color: mode === 'extended' ? '#FFF' : 'rgba(255, 255, 255, 0.6)',
            border: 'none',
            borderRadius: 4,
            padding: '5px 9px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Ext
        </button>
        <button
          onClick={() => {
            if (mode === 'full') {
              onCycleFullSpeed();
            } else {
              onSelectMode('full');
            }
          }}
          title="Full Match (3) / Toggle Speed (+/-)"
          style={{
            background: mode === 'full' ? 'var(--color-accent, #2563EB)' : 'transparent',
            color: mode === 'full' ? '#FFF' : 'rgba(255, 255, 255, 0.6)',
            border: 'none',
            borderRadius: 4,
            padding: '5px 9px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Full {mode === 'full' ? `${fullSpeed}×` : ''}
        </button>
      </div>

      {/* Instant Result */}
      <button
        onClick={onInstantResult}
        title="Instant Result (I)"
        style={{
          background: 'rgba(255, 255, 255, 0.08)',
          color: '#E2E8F0',
          border: 'none',
          borderRadius: 6,
          padding: '6px 8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <Zap size={14} color="#F4B41A" />
        <span>Instant</span>
      </button>

      {/* Camera Switch */}
      <button
        onClick={onCycleCamera}
        title={`Cycle Camera (C) - Current: ${cameraMode}`}
        style={{
          background: 'rgba(255, 255, 255, 0.08)',
          color: '#E2E8F0',
          border: 'none',
          borderRadius: 6,
          padding: '6px 8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <Camera size={14} />
        <span style={{ textTransform: 'capitalize' }}>{cameraMode}</span>
      </button>

      {/* Stats Drawer Toggle */}
      <button
        onClick={onToggleStats}
        title="Toggle Match Stats"
        style={{
          background: statsOpen ? '#2563EB' : 'rgba(255, 255, 255, 0.08)',
          color: '#FFF',
          border: 'none',
          borderRadius: 6,
          padding: '6px 8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <BarChart2 size={15} />
      </button>

      {/* Assistant Drawer Toggle */}
      <button
        onClick={onToggleAssistant}
        title="Toggle Assistant Advice"
        style={{
          background: assistantOpen ? '#2563EB' : 'rgba(255, 255, 255, 0.08)',
          color: '#FFF',
          border: 'none',
          borderRadius: 6,
          padding: '6px 8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <MessageSquare size={15} />
      </button>

      {/* Fullscreen */}
      <button
        onClick={onToggleFullscreen}
        title="Toggle Fullscreen (F)"
        style={{
          background: 'rgba(255, 255, 255, 0.08)',
          color: '#FFF',
          border: 'none',
          borderRadius: 6,
          padding: '6px 8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Maximize2 size={15} />
      </button>
    </div>
  );
};
