// SPEC §11.25 React Canvas integration for Club spaces
import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { ClubScene } from './ClubScene';

export const ClubSpacesCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ClubScene | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [isRoaming, setIsRoaming] = useState(false);

  const screen = useStore((state) => state.screen);
  const setScreen = useStore((state) => state.setScreen);
  const settings = useStore((state) => state.settings);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new ClubScene(containerRef.current);
    sceneRef.current = scene;

    scene.setOnHotspotClick((_hotspotId, targetScreen) => {
      if (targetScreen) {
        setScreen(targetScreen as any);
        scene.setFreeRoam(false);
      }
    });

    scene.setOnInteractionPromptChange((p) => {
      setPrompt(p);
    });

    scene.setOnFreeRoamChange((roaming) => {
      setIsRoaming(roaming);
      const shell = document.querySelector('.app-shell');
      if (shell) {
        if (roaming) shell.classList.add('free-roam-active');
        else shell.classList.remove('free-roam-active');
      }
    });

    scene.lookAroundController.setCallbacks((fading) => {
      const shell = document.querySelector('.app-shell');
      if (shell) {
        if (fading) shell.classList.add('panel-fade');
        else shell.classList.remove('panel-fade');
      }
    });

    const interval = setInterval(() => {
      setHint(scene.lookAroundController.getActiveHint());
    }, 200);

    return () => {
      clearInterval(interval);
      scene.dispose();
      sceneRef.current = null;
    };
  }, [setScreen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (e.key.toLowerCase() === 'v') {
        if (sceneRef.current) {
          sceneRef.current.setFreeRoam(!sceneRef.current.isFreeRoam);
        }
      } else if (e.key === 'Escape' && isRoaming) {
        if (sceneRef.current) {
          sceneRef.current.setFreeRoam(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRoaming]);

  useEffect(() => {
    if (sceneRef.current) {
      if (typeof window !== 'undefined') {
        const p = new URLSearchParams(window.location.search);
        const urlRoom = p.get('room');
        const stateParam = p.get('state');
        if (urlRoom) {
          sceneRef.current.goToRoom(urlRoom as any, false);
          return;
        }
        if (stateParam === 'corridor' || stateParam === 'door' || stateParam === 'corridor-brush') {
          sceneRef.current.goToRoom('corridor', false);
          return;
        }
        if (stateParam === 'press') {
          sceneRef.current.goToRoom('press', false);
          return;
        }
      }
      const walksEnabled = settings?.reduceMotion ? false : true;
      sceneRef.current.goToScreen(screen, walksEnabled);
    }
  }, [screen, settings]);

  return (
    <>
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'auto',
        }}
      />

      {/* Top-layer HUD and Roam Controls */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          pointerEvents: 'none',
        }}
      >
        {prompt && (
          <div
            style={{
              position: 'absolute',
              bottom: '72px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(8, 10, 14, 0.92)',
              border: '2px solid #F2B705',
              boxShadow: '0 0 20px rgba(242, 183, 5, 0.4)',
              color: '#FFFFFF',
              padding: '10px 22px',
              fontFamily: 'Barlow Condensed, sans-serif',
              fontWeight: 800,
              fontSize: '18px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              pointerEvents: 'none',
              zIndex: 20,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <span style={{ color: '#F2B705' }}>INTERACT:</span>
            <span>{prompt}</span>
          </div>
        )}

        {hint && (
          <div
            style={{
              position: 'absolute',
              bottom: '24px',
              right: '24px',
              background: 'rgba(8, 10, 14, 0.85)',
              border: '1px solid #F2B705',
              color: '#F2B705',
              padding: '8px 14px',
              fontFamily: 'Barlow Condensed, sans-serif',
              fontWeight: 700,
              fontSize: '14px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            {hint}
          </div>
        )}

        {/* 3D Walkaround Controls HUD */}
        {isRoaming && (
          <div
            style={{
              position: 'absolute',
              bottom: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(7, 12, 24, 0.92)',
              border: '1px solid #00E58F',
              borderRadius: '6px',
              color: '#FFFFFF',
              padding: '8px 20px',
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: '15px',
              letterSpacing: '0.06em',
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
            }}
          >
            <span style={{ color: '#00E58F', fontWeight: 700 }}>3D FREE ROAM</span>
            <span><b>[W][A][S][D]</b> Walk</span>
            <span><b>[Shift]</b> Run</span>
            <span><b>[Right-Drag]</b> Camera</span>
            <span><b>[E]</b> Interact</span>
            <button
              onClick={() => sceneRef.current?.setFreeRoam(false)}
              style={{
                background: '#00E58F',
                color: '#070C18',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 10px',
                fontWeight: 800,
                cursor: 'pointer',
                marginLeft: '8px',
              }}
            >
              [V] Open Panels
            </button>
          </div>
        )}

        {/* Floating Walk Around Button when in panel view */}
        {!isRoaming && (
          <button
            onClick={() => sceneRef.current?.setFreeRoam(true)}
            style={{
              position: 'absolute',
              bottom: '24px',
              left: '24px',
              background: 'rgba(7, 12, 24, 0.90)',
              border: '1px solid #00E58F',
              color: '#00E58F',
              padding: '8px 16px',
              fontFamily: 'Barlow Condensed, sans-serif',
              fontWeight: 700,
              fontSize: '14px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              borderRadius: '4px',
              cursor: 'pointer',
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.4)',
            }}
          >
            <span>🎮 Walk Around [V]</span>
          </button>
        )}
      </div>
    </>
  );
};
