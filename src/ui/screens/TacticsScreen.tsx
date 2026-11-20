// Implements SPEC §11.8 Tactics screen (office whiteboard wall)
// Left: PitchBoard (whiteboard with --board, pitch lines drawn in --board-ink at 35%),
// 11 Magnets on the pitch + bench magnets on bottom edge. Drag/swap & keyboard swap.
// Right: Clipboard sheet with Formation selector, Familiarity, 7 instructions, duties, presets, and "Assistant picks best XI".
import React, { useState, useEffect } from 'react';
import { useStore } from '../../state/store';
import {
  Formation,
  Mentality,
  PassingStyle,
  Tempo,
  Pressing,
  DefLine,
  Width,
  Focus,
  Duty,
  Player,
} from '../../core/types';
import { FORMATIONS } from '../../config/formations';
import { Magnet } from '../components/Magnet';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
import { validateLineup } from '../../core/game/advance';
import { CheckCircle2, AlertCircle, Wand2, RotateCcw } from 'lucide-react';

export const TacticsScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const updateUserTactics = useStore((state) => state.updateUserTactics);
  const autoPickBestLineup = useStore((state) => state.autoPickBestLineup);
  const swapLineupSlots = useStore((state) => state.swapLineupSlots);
  const swapLineupWithBench = useStore((state) => state.swapLineupWithBench);
  const showToast = useStore((state) => state.showToast);

  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [selectedBenchIndex, setSelectedBenchIndex] = useState<number | null>(null);
  const [draggedSource, setDraggedSource] = useState<{
    type: 'pitch' | 'bench';
    index: number;
  } | null>(null);

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  const tactics = userClub.tactics;
  const formationDef = FORMATIONS[tactics.formation] ?? FORMATIONS['4-4-2'];
  const familiarity = userClub.formationFamiliarity[tactics.formation] ?? 60;

  // Validation
  const validation = validateLineup(tactics, gameState.players);

  // Helper to get player by id
  const getPlayer = (id: string | null | undefined): Player | undefined => {
    return id ? gameState.players[id] : undefined;
  };

  // Keyboard navigation across slots 0..10
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        const slot = parseInt(e.key, 10);
        if (slot >= 0 && slot <= 10) {
          handleSlotClick(slot);
        }
      } else if (e.key === 'Escape') {
        setSelectedSlot(null);
        setSelectedBenchIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSlot, selectedBenchIndex]);

  const handleSlotClick = (slotIndex: number) => {
    if (selectedBenchIndex !== null) {
      // Bench -> Pitch swap
      swapLineupWithBench(slotIndex, selectedBenchIndex);
      setSelectedBenchIndex(null);
      setSelectedSlot(null);
      showToast('Swapped bench player into starting XI', 'info');
    } else if (selectedSlot === null) {
      // Select starter slot
      setSelectedSlot(slotIndex);
    } else if (selectedSlot === slotIndex) {
      // Toggle duty on repeated click
      const currentDuty = tactics.duties?.[slotIndex] ?? 'Support';
      const nextDuty: Duty =
        currentDuty === 'Defend' ? 'Support' : currentDuty === 'Support' ? 'Attack' : 'Defend';
      const newDuties = [...(tactics.duties ?? new Array(11).fill('Support'))];
      newDuties[slotIndex] = nextDuty;
      updateUserTactics({ duties: newDuties });
    } else {
      // Swap starter slot A with starter slot B
      swapLineupSlots(selectedSlot, slotIndex);
      setSelectedSlot(null);
      showToast('Swapped player positions', 'info');
    }
  };

  const handleBenchClick = (benchIndex: number) => {
    if (selectedSlot !== null) {
      // Pitch -> Bench swap
      swapLineupWithBench(selectedSlot, benchIndex);
      setSelectedSlot(null);
      setSelectedBenchIndex(null);
      showToast('Swapped player to bench', 'info');
    } else {
      setSelectedBenchIndex(selectedBenchIndex === benchIndex ? null : benchIndex);
    }
  };

  // Tactical Presets (SPEC §11.8)
  const applyPreset = (presetName: string) => {
    switch (presetName) {
      case 'Park the bus':
        updateUserTactics({
          instructions: {
            ...tactics.instructions,
            mentality: 'Defensive',
            passing: 'Direct',
            tempo: 'Slow',
            pressing: 'Low',
            line: 'Deep',
            width: 'Narrow',
            focus: 'Centre',
            onLoss: 'Regroup',
            onWin: 'Counter',
          },
        });
        break;
      case 'Control':
        updateUserTactics({
          instructions: {
            ...tactics.instructions,
            mentality: 'Balanced',
            passing: 'Short',
            tempo: 'Slow',
            pressing: 'Mid',
            line: 'Normal',
            width: 'Normal',
            focus: 'Mixed',
            onLoss: 'Mixed',
            onWin: 'KeepIt',
          },
        });
        break;
      case 'Gegenpress':
        updateUserTactics({
          instructions: {
            ...tactics.instructions,
            mentality: 'Attacking',
            passing: 'Short',
            tempo: 'Fast',
            pressing: 'High',
            line: 'High',
            width: 'Normal',
            focus: 'Mixed',
            onLoss: 'CounterPress',
            onWin: 'Counter',
          },
        });
        break;
      case 'Counter':
        updateUserTactics({
          instructions: {
            ...tactics.instructions,
            mentality: 'Defensive',
            passing: 'Direct',
            tempo: 'Fast',
            pressing: 'Low',
            line: 'Deep',
            width: 'Wide',
            focus: 'Mixed',
            onLoss: 'Regroup',
            onWin: 'Counter',
          },
        });
        break;
      case 'All-out attack':
        updateUserTactics({
          instructions: {
            ...tactics.instructions,
            mentality: 'Attacking',
            passing: 'Mixed',
            tempo: 'Fast',
            pressing: 'High',
            line: 'High',
            width: 'Wide',
            focus: 'Mixed',
            onLoss: 'CounterPress',
            onWin: 'Counter',
          },
        });
        break;
    }
    showToast(`Applied preset: ${presetName}`, 'info');
  };

  return (
    <div className="app-content-area office-surface" style={{ height: '100%' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: '24px',
          height: '100%',
          alignItems: 'start',
        }}
      >
        {/* Left: Office Whiteboard Pitch & Bench (SPEC §11.8 & §19.5) */}
        <div
          style={{
            backgroundColor: 'var(--board)',
            border: '2px solid #C4C8D0',
            borderRadius: '4px',
            boxShadow: 'var(--shadow-paper)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Board Header Bar */}
          <div
            style={{
              padding: '12px 18px',
              borderBottom: '2px solid rgba(30, 42, 56, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(255, 255, 255, 0.4)',
            }}
          >
            <div>
              <div
                className="broadcast-label"
                style={{ color: 'var(--board-ink)', fontSize: '14px' }}
              >
                TACTICS WHITEBOARD · {tactics.formation}
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(30, 42, 56, 0.7)' }}>
                Click to select slot or swap · Click selected token to cycle duty
              </div>
            </div>

            {/* Lineup legality indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                color: validation.valid ? 'var(--marker-green)' : 'var(--marker-red)',
              }}
            >
              {validation.valid ? (
                <>
                  <CheckCircle2 size={16} /> Legal Starting XI
                </>
              ) : (
                <>
                  <AlertCircle size={16} /> {validation.reason}
                </>
              )}
            </div>
          </div>

          {/* Vertical SVG Pitch with Magnet Tokens */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '520px',
              backgroundColor: 'var(--board)',
              overflow: 'hidden',
            }}
          >
            {/* Whiteboard Pitch Markings in --board-ink at 35% */}
            <svg
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                opacity: 0.35,
              }}
              viewBox="0 0 100 140"
              preserveAspectRatio="none"
            >
              {/* Pitch outline */}
              <rect
                x="4"
                y="4"
                width="92"
                height="132"
                fill="none"
                stroke="var(--board-ink)"
                strokeWidth="0.8"
              />
              {/* Halfway line */}
              <line x1="4" y1="70" x2="96" y2="70" stroke="var(--board-ink)" strokeWidth="0.8" />
              {/* Centre circle */}
              <circle
                cx="50"
                cy="70"
                r="14"
                fill="none"
                stroke="var(--board-ink)"
                strokeWidth="0.8"
              />
              {/* Own penalty area (bottom) */}
              <rect
                x="22"
                y="104"
                width="56"
                height="32"
                fill="none"
                stroke="var(--board-ink)"
                strokeWidth="0.8"
              />
              {/* Opponent penalty area (top) */}
              <rect
                x="22"
                y="4"
                width="56"
                height="32"
                fill="none"
                stroke="var(--board-ink)"
                strokeWidth="0.8"
              />
            </svg>

            {/* 11 Starter Tokens mapped to anchor coordinates */}
            {formationDef.slots.map((slotDef) => {
              const playerId = tactics.lineup[slotDef.slot];
              const player = getPlayer(playerId);
              const duty = tactics.duties?.[slotDef.slot] ?? 'Support';
              const isSelected = selectedSlot === slotDef.slot;

              // Convert pitch coords (105x68, own frame x=0 goal, y=0 left) to screen %
              // Top of whiteboard = opponent half, bottom = own goal
              const topPercent = 90 - (slotDef.anchor.x / 105) * 80;
              const leftPercent = (slotDef.anchor.y / 68) * 85 + 7;

              return (
                <div
                  key={slotDef.slot}
                  style={{
                    position: 'absolute',
                    top: `${topPercent}%`,
                    left: `${leftPercent}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: isSelected ? 20 : 10,
                  }}
                >
                  <Magnet
                    number={player?.squadNumber ?? slotDef.slot + 1}
                    surname={player ? (player.knownAs ?? player.lastName) : slotDef.role}
                    roleLabel={duty}
                    kitColor={userClub.colors.primary}
                    textColor="#FFFFFF"
                    isSelected={isSelected}
                    onClick={() => handleSlotClick(slotDef.slot)}
                  />
                </div>
              );
            })}
          </div>

          {/* Bench Row along bottom edge of the whiteboard */}
          <div
            style={{
              padding: '12px 16px',
              borderTop: '2px solid rgba(30, 42, 56, 0.15)',
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
            }}
          >
            <div
              className="broadcast-label"
              style={{
                color: 'var(--board-ink)',
                fontSize: '11px',
                marginBottom: '8px',
              }}
            >
              BENCH ({tactics.bench.length} / 9)
            </div>
            <div
              style={{
                display: 'flex',
                gap: '12px',
                overflowX: 'auto',
                paddingBottom: '4px',
              }}
            >
              {tactics.bench.map((benchId, bIdx) => {
                const player = getPlayer(benchId);
                const isSelected = selectedBenchIndex === bIdx;
                return (
                  <Magnet
                    key={benchId}
                    number={player?.squadNumber ?? bIdx + 12}
                    surname={player ? (player.knownAs ?? player.lastName) : 'Sub'}
                    kitColor="rgba(30, 42, 56, 0.25)"
                    textColor="var(--board-ink)"
                    isSelected={isSelected}
                    onClick={() => handleBenchClick(bIdx)}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Clipboard Sheet with Instructions & Presets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Sheet id="tactics-clipboard" variant="clipboard">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Header: Formation & Familiarity */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '2px solid var(--paper-rule)',
                  paddingBottom: '12px',
                }}
              >
                <div>
                  <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                    SYSTEM & FAMILIARITY
                  </div>
                  <select
                    value={tactics.formation}
                    onChange={(e) =>
                      updateUserTactics({
                        formation: e.target.value as Formation,
                      })
                    }
                    style={{
                      fontFamily: 'var(--font-head)',
                      fontWeight: 700,
                      fontSize: '22px',
                      color: 'var(--paper-ink)',
                      backgroundColor: 'transparent',
                      border: 'none',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {(Object.keys(FORMATIONS) as Formation[]).map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                    FAMILIARITY
                  </div>
                  <div
                    className="tabular-nums"
                    style={{
                      fontFamily: 'var(--font-head)',
                      fontSize: '20px',
                      fontWeight: 700,
                      color: 'var(--paper-ink)',
                    }}
                  >
                    {familiarity}%
                  </div>
                </div>
              </div>

              {/* Presets Bar */}
              <div>
                <div
                  className="broadcast-label"
                  style={{ color: 'var(--paper-dim)', marginBottom: '6px' }}
                >
                  TACTICAL PRESETS
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {['Park the bus', 'Control', 'Gegenpress', 'Counter', 'All-out attack'].map(
                    (p) => (
                      <button
                        key={p}
                        onClick={() => applyPreset(p)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '3px',
                          backgroundColor: 'var(--paper-2)',
                          border: '1px solid var(--paper-rule)',
                          color: 'var(--paper-ink)',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        {p}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Seven Segmented Controls (§13.10) */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  borderTop: '1px solid var(--paper-rule)',
                  paddingTop: '12px',
                }}
              >
                {/* 1. Mentality */}
                <div>
                  <div
                    className="broadcast-label"
                    style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                  >
                    MENTALITY
                  </div>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
                    {(['Defensive', 'Balanced', 'Attacking'] as Mentality[]).map((m) => (
                      <button
                        key={m}
                        onClick={() =>
                          updateUserTactics({
                            instructions: {
                              ...tactics.instructions,
                              mentality: m,
                            },
                          })
                        }
                        style={{
                          flex: 1,
                          padding: '6px',
                          backgroundColor:
                            tactics.instructions.mentality === m
                              ? 'var(--paper-ink)'
                              : 'var(--paper-2)',
                          color:
                            tactics.instructions.mentality === m
                              ? 'var(--paper)'
                              : 'var(--paper-ink)',
                          border: '1px solid var(--paper-rule)',
                          borderRadius: '2px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Passing */}
                <div>
                  <div
                    className="broadcast-label"
                    style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                  >
                    PASSING STYLE
                  </div>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
                    {(['Short', 'Mixed', 'Direct'] as PassingStyle[]).map((p) => (
                      <button
                        key={p}
                        onClick={() =>
                          updateUserTactics({
                            instructions: {
                              ...tactics.instructions,
                              passing: p,
                            },
                          })
                        }
                        style={{
                          flex: 1,
                          padding: '6px',
                          backgroundColor:
                            tactics.instructions.passing === p
                              ? 'var(--paper-ink)'
                              : 'var(--paper-2)',
                          color:
                            tactics.instructions.passing === p
                              ? 'var(--paper)'
                              : 'var(--paper-ink)',
                          border: '1px solid var(--paper-rule)',
                          borderRadius: '2px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Tempo */}
                <div>
                  <div
                    className="broadcast-label"
                    style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                  >
                    TEMPO
                  </div>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
                    {(['Slow', 'Normal', 'Fast'] as Tempo[]).map((t) => (
                      <button
                        key={t}
                        onClick={() =>
                          updateUserTactics({
                            instructions: {
                              ...tactics.instructions,
                              tempo: t,
                            },
                          })
                        }
                        style={{
                          flex: 1,
                          padding: '6px',
                          backgroundColor:
                            tactics.instructions.tempo === t
                              ? 'var(--paper-ink)'
                              : 'var(--paper-2)',
                          color:
                            tactics.instructions.tempo === t ? 'var(--paper)' : 'var(--paper-ink)',
                          border: '1px solid var(--paper-rule)',
                          borderRadius: '2px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Pressing */}
                <div>
                  <div
                    className="broadcast-label"
                    style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                  >
                    PRESSING INTENSITY
                  </div>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
                    {(['Low', 'Mid', 'High'] as Pressing[]).map((pr) => (
                      <button
                        key={pr}
                        onClick={() =>
                          updateUserTactics({
                            instructions: {
                              ...tactics.instructions,
                              pressing: pr,
                            },
                          })
                        }
                        style={{
                          flex: 1,
                          padding: '6px',
                          backgroundColor:
                            tactics.instructions.pressing === pr
                              ? 'var(--paper-ink)'
                              : 'var(--paper-2)',
                          color:
                            tactics.instructions.pressing === pr
                              ? 'var(--paper)'
                              : 'var(--paper-ink)',
                          border: '1px solid var(--paper-rule)',
                          borderRadius: '2px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {pr}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  borderTop: '2px solid var(--paper-rule)',
                  paddingTop: '14px',
                }}
              >
                <Button
                  variant="primary"
                  size="m"
                  icon={<Wand2 size={16} />}
                  onClick={autoPickBestLineup}
                  style={{ flex: 1 }}
                >
                  Pick Best XI
                </Button>
                <Button
                  variant="secondary"
                  size="m"
                  icon={<RotateCcw size={16} />}
                  onClick={() => {
                    updateUserTactics({
                      formation: userClub.style.formation,
                      instructions: {
                        ...userClub.style,
                      },
                    });
                    showToast('Reset tactics to club identity', 'info');
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>
          </Sheet>
        </div>
      </div>
    </div>
  );
};
