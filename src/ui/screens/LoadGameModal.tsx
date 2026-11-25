// Implements SPEC §11.23, §20.1–20.4 Save & Load Game Modal
import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '@/state/store';
import {
  SaveMeta,
  SaveSlotKey,
  listAllSaves,
  loadGame,
  saveGame,
  deleteSaveSlot,
  exportSaveToFile,
  importSaveFromFile,
} from '@/state/saves';
import { applyClubTheme } from '@/config/clubThemes';
import { FolderOpen, Download, Upload, Trash2, Save, Play, X } from 'lucide-react';

export const LoadGameModal: React.FC = () => {
  const isLoadGameOpen = useStore((state) => state.isLoadGameOpen);
  const closeLoadGame = useStore((state) => state.closeLoadGame);
  const gameState = useStore((state) => state.gameState);
  const setGameState = useStore((state) => state.setGameState);
  const setScreen = useStore((state) => state.setScreen);
  const showToast = useStore((state) => state.showToast);

  const [saves, setSaves] = useState<Record<string, SaveMeta>>({});
  const [loadingSlot, setLoadingSlot] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshSaves = async () => {
    const list = await listAllSaves();
    const map: Record<string, SaveMeta> = {};
    for (const item of list) {
      map[item.slot] = item.meta;
    }
    setSaves(map);
  };

  useEffect(() => {
    if (isLoadGameOpen) {
      refreshSaves();
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLoadGame();
      }
    };
    if (isLoadGameOpen) {
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
    }
  }, [isLoadGameOpen, closeLoadGame]);

  if (!isLoadGameOpen) return null;

  const handleLoad = async (slot: string) => {
    setLoadingSlot(slot);
    try {
      const loaded = await loadGame(slot);
      if (loaded) {
        setGameState(loaded);
        applyClubTheme(loaded.userClubId);
        showToast(`Loaded ${saves[slot]?.clubName ?? slot}!`, 'success');
        closeLoadGame();
        setScreen(
          loaded.phase === 'Preseason' ? 'hub' : loaded.phase === 'PreMatch' ? 'preMatch' : 'hub',
        );
      } else {
        showToast('Failed to load save file.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error loading save', 'error');
    } finally {
      setLoadingSlot(null);
    }
  };

  const handleSaveToSlot = async (slot: SaveSlotKey) => {
    if (!gameState) return;
    try {
      await saveGame(slot, gameState);
      showToast(`Game saved to ${slot}!`, 'success');
      await refreshSaves();
    } catch {
      showToast('Failed to save game.', 'error');
    }
  };

  const handleDelete = async (slot: string) => {
    if (confirm(`Are you sure you want to delete ${slot}?`)) {
      await deleteSaveSlot(slot);
      showToast(`Deleted ${slot}`, 'info');
      await refreshSaves();
    }
  };

  const handleExport = async (slot: string) => {
    const success = await exportSaveToFile(slot);
    if (success) {
      showToast('Save exported to file.', 'success');
    } else {
      showToast('Export failed.', 'error');
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await importSaveFromFile(file, 'slot-1');
    if (res.success && res.state) {
      showToast(res.message, 'success');
      setGameState(res.state);
      applyClubTheme(res.state.userClubId);
      await refreshSaves();
      closeLoadGame();
      setScreen('hub');
    } else {
      showToast(res.message, 'error');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const slots: { key: SaveSlotKey; label: string }[] = [
    { key: 'autosave', label: 'Autosave' },
    { key: 'slot-1', label: 'Save Slot 1' },
    { key: 'slot-2', label: 'Save Slot 2' },
    { key: 'slot-3', label: 'Save Slot 3' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(7, 12, 24, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeLoadGame();
      }}
    >
      <div
        style={{
          width: '90%',
          maxWidth: '680px',
          background: '#0D1424',
          border: '1px solid #1E293B',
          borderRadius: '12px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #1E293B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#0A0F1D',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FolderOpen size={24} color="#00E58F" />
            <h2
              style={{
                margin: 0,
                fontFamily: 'Barlow Condensed, sans-serif',
                fontSize: '24px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#F3F6FB',
              }}
            >
              Career Saves & Load
            </h2>
          </div>
          <button
            onClick={closeLoadGame}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8E9AA8',
              cursor: 'pointer',
              padding: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Slot List */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {slots.map((s) => {
            const meta = saves[s.key];
            const isPopulated = Boolean(meta);
            return (
              <div
                key={s.key}
                style={{
                  background: isPopulated ? '#141D30' : '#0B111F',
                  border: isPopulated ? '1px solid #283750' : '1px dashed #1E293B',
                  borderRadius: '8px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        fontFamily: 'Barlow Condensed, sans-serif',
                        fontSize: '18px',
                        fontWeight: 700,
                        color: s.key === 'autosave' ? '#F2B705' : '#F3F6FB',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {s.label}
                    </span>
                    {meta && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#00E58F',
                          background: 'rgba(0, 229, 143, 0.12)',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontWeight: 600,
                        }}
                      >
                        MD {meta.matchday}
                      </span>
                    )}
                  </div>
                  {meta ? (
                    <div style={{ color: '#8E9AA8', fontSize: '13px', marginTop: '4px' }}>
                      <strong style={{ color: '#D6E0EC' }}>{meta.clubName}</strong> · Manager{' '}
                      {meta.managerName} ·{' '}
                      {new Date(meta.savedAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  ) : (
                    <div style={{ color: '#56667A', fontSize: '13px', marginTop: '4px' }}>
                      Empty Save Slot
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isPopulated && (
                    <button
                      onClick={() => handleLoad(s.key)}
                      disabled={loadingSlot === s.key}
                      style={{
                        padding: '8px 14px',
                        background: '#00E58F',
                        color: '#070C18',
                        fontWeight: 700,
                        fontFamily: 'Barlow Condensed, sans-serif',
                        fontSize: '14px',
                        letterSpacing: '0.04em',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Play size={14} />
                      LOAD
                    </button>
                  )}

                  {gameState && s.key !== 'autosave' && (
                    <button
                      onClick={() => handleSaveToSlot(s.key)}
                      style={{
                        padding: '8px 12px',
                        background: '#1E293B',
                        color: '#D6E0EC',
                        fontFamily: 'Barlow Condensed, sans-serif',
                        fontSize: '14px',
                        fontWeight: 600,
                        border: '1px solid #334155',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Save size={14} />
                      SAVE
                    </button>
                  )}

                  {isPopulated && (
                    <>
                      <button
                        title="Export JSON"
                        onClick={() => handleExport(s.key)}
                        style={{
                          padding: '8px',
                          background: 'transparent',
                          color: '#8E9AA8',
                          border: '1px solid #1E293B',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        <Download size={15} />
                      </button>
                      {s.key !== 'autosave' && (
                        <button
                          title="Delete Slot"
                          onClick={() => handleDelete(s.key)}
                          style={{
                            padding: '8px',
                            background: 'transparent',
                            color: '#E53E3E',
                            border: '1px solid #1E293B',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with File Import */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #1E293B',
            background: '#0A0F1D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ color: '#8E9AA8', fontSize: '12px' }}>
            All saves stored locally via IndexedDB with offline backup.
          </div>
          <div>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileImport}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '8px 16px',
                background: '#1E293B',
                color: '#F3F6FB',
                border: '1px solid #334155',
                borderRadius: '6px',
                fontFamily: 'Barlow Condensed, sans-serif',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Upload size={14} />
              IMPORT JSON SAVE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
