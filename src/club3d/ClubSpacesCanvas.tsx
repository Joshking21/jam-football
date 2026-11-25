// SPEC §11.25 React Canvas integration for Club spaces
import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { ClubScene } from './ClubScene';

export const ClubSpacesCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ClubScene | null>(null);
  const [hint, setHint] = useState<string | null>(null);

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
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'auto',
      }}
    >
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
    </div>
  );
};
