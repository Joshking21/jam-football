// SPEC §11.25 React Canvas integration — GTA-style immersive 3D world
import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { ClubScene } from './ClubScene';
import type { Hotspot } from './types';

export const ClubSpacesCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ClubScene | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [focusedHotspot, setFocusedHotspot] = useState<Hotspot | null>(null);

  const screen = useStore((state) => state.screen);
  const setScreen = useStore((state) => state.setScreen);
  const settings = useStore((state) => state.settings);
  const gameState = useStore((state) => state.gameState);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new ClubScene(containerRef.current);
    sceneRef.current = scene;
    scene.setFreeRoam(true);

    scene.setOnHotspotClick((_hotspotId, targetScreen) => {
      if (targetScreen) {
        setScreen(targetScreen as any);
      }
    });

    scene.setOnInteractionPromptChange((p) => {
      setPrompt(p);
    });

    scene.setOnFocusChange((focused, hotspot) => {
      setFocusedHotspot(focused ? hotspot : null);
      const shell = document.querySelector('.app-shell');
      if (shell) {
        shell.classList.toggle('surface-focus', focused);
      }
    });

    // Push initial game data to surfaces right after scene init
    const gs = useStore.getState().gameState;
    if (gs) {
      const userClub = gs.clubs[gs.userClubId];
      if (userClub) {
        scene.surfaceManager.updateTactics(userClub.tactics, Object.values(gs.players));
      }
    }

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [setScreen]);

  // Feed tactics data to the whiteboard surface
  // Feed game data to 3D surface textures
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !gameState) return;
    const userClub = gameState.clubs[gameState.userClubId];
    if (!userClub) return;

    const players = Object.values(gameState.players);
    scene.surfaceManager.updateTactics(userClub.tactics, players);
    scene.applyGameState(gameState);
  }, [gameState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (e.key === 'Escape' && focusedHotspot) {
        sceneRef.current?.exitFocus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedHotspot]);

  useEffect(() => {
    if (sceneRef.current) {
      if (typeof window !== 'undefined') {
        const p = new URLSearchParams(window.location.search);
        const urlRoom = p.get('room');
        const urlFocus = p.get('focus');
        // Dev/capture: ?beat=monday_morning|wednesday_afternoon|friday_evening|matchday (§11.25.6).
        const urlBeat = p.get('beat');
        if (
          urlBeat === 'monday_morning' ||
          urlBeat === 'wednesday_afternoon' ||
          urlBeat === 'friday_evening' ||
          urlBeat === 'matchday'
        ) {
          sceneRef.current.timeOfDayController.setBeat(urlBeat, true);
        }
        if (urlRoom) {
          sceneRef.current.goToRoom(urlRoom as any, false);
          if (urlFocus) sceneRef.current.focusById(urlFocus);
          return;
        }
        if (urlFocus) {
          sceneRef.current.goToScreen(screen, false);
          sceneRef.current.focusById(urlFocus);
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

      {/* Interaction HUD */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          pointerEvents: 'none',
        }}
      >
        {prompt && !focusedHotspot && (
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
              textTransform: 'uppercase' as const,
              pointerEvents: 'none' as const,
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

        {/* Focus mode label */}
        {focusedHotspot && (
          <div
            style={{
              position: 'absolute',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(8, 10, 14, 0.85)',
              border: '1px solid rgba(242, 183, 5, 0.5)',
              color: '#F2B705',
              padding: '8px 24px',
              fontFamily: 'Barlow Condensed, sans-serif',
              fontWeight: 700,
              fontSize: '16px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              borderRadius: '4px',
            }}
          >
            {focusedHotspot.name} &middot; <span style={{ color: '#aaa' }}>ESC to exit</span>
          </div>
        )}

        {/* Controls HUD — bottom center */}
        {!focusedHotspot && (
          <div
            style={{
              position: 'absolute',
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(7, 12, 24, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              color: '#FFFFFF',
              padding: '6px 16px',
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: '13px',
              letterSpacing: '0.06em',
              pointerEvents: 'auto' as const,
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              boxShadow: '0 2px 12px rgba(0, 0, 0, 0.5)',
            }}
          >
            <span>
              <b>WASD / Arrows</b> Move
            </span>
            <span>
              <b>Shift</b> Run
            </span>
            <span>
              <b>Click</b> Mouse look
            </span>
            <span>
              <b>Wheel</b> Zoom
            </span>
            <span>
              <b>E</b> Interact
            </span>
            <span>
              <b>Esc</b> Free cursor
            </span>
          </div>
        )}
      </div>
    </>
  );
};
