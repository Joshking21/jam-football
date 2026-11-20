// Implements SPEC §11.8 Tactics screen (office whiteboard wall) & §13.17 Tactical Depth
// Reference: docs/design/tactics/README.md & index.html
// Sideways whiteboard (1050x700, own goal on left, attacking right) with Our team & Opposition tabs.
// Clipboard with 4 dividers: With ball, Without ball, Transitions, Set pieces.
// Player file with role picker (fit, gives/costs) and player instructions.
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
  OnLoss,
  OnWin,
  Distribution,
  CornersFor,
  CornersAgainst,
  PlayerInstruction,
  OppOrder,
  RoleId,
  Player,
  PlayerId,
  FinalThird,
  CrossStyle,
  Tackling,
  ForceOpp,
  TimeWasting,
  FreeKicks,
  CornerSwing,
  PostMen,
  MenBack,
} from '../../core/types';
import { FORMATIONS } from '../../config/formations';
import {
  ROLES,
  getAvailableRolesForSlot,
  computeRoleFit,
  getDefaultRoleForPos,
} from '../../config/roles';
import { Magnet } from '../components/Magnet';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
import { validateLineup } from '../../core/game/advance';
import { ovrAt, getPrimaryOvr } from '../../core/player/ratings';
import {
  CheckCircle2,
  AlertCircle,
  Wand2,
  RotateCcw,
  X,
  Target,
  Shield,
  Zap,
  Flag,
  Crosshair,
} from 'lucide-react';

export const TacticsScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const updateUserTactics = useStore((state) => state.updateUserTactics);
  const autoPickBestLineup = useStore((state) => state.autoPickBestLineup);
  const swapLineupSlots = useStore((state) => state.swapLineupSlots);
  const swapLineupWithBench = useStore((state) => state.swapLineupWithBench);
  const showToast = useStore((state) => state.showToast);

  // Board tabs: 'us' vs 'opp'
  const [boardTab, setBoardTab] = useState<'us' | 'opp'>('us');

  // Clipboard tabs: 'withBall' | 'withoutBall' | 'transitions' | 'setPieces'
  const [clipboardTab, setClipboardTab] = useState<
    'withBall' | 'withoutBall' | 'transitions' | 'setPieces'
  >('withBall');

  // Selection state
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [selectedBenchIndex, setSelectedBenchIndex] = useState<number | null>(null);
  const [selectedOppSlot, setSelectedOppSlot] = useState<number | null>(null);

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  const tactics = userClub.tactics;
  const formationDef = FORMATIONS[tactics.formation] ?? FORMATIONS['4-4-2'];
  const familiarity = userClub.formationFamiliarity[tactics.formation] ?? 60;

  // Next fixture determination for opponent tab
  const nextFixture = gameState.fixtures.find(
    (f) =>
      f.matchday === gameState.matchday && (f.homeId === userClub.id || f.awayId === userClub.id),
  );
  const isHome = nextFixture ? nextFixture.homeId === userClub.id : true;
  const oppClubId = nextFixture
    ? isHome
      ? nextFixture.awayId
      : nextFixture.homeId
    : (userClub.rivals[0] ?? 'c02');
  const oppClub = gameState.clubs[oppClubId] ?? Object.values(gameState.clubs)[0]!;
  const oppFormationDef = FORMATIONS[oppClub.style.formation] ?? FORMATIONS['4-4-2'];

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
        setSelectedOppSlot(null);
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
      // Open player file
      setSelectedSlot(slotIndex);
    } else if (selectedSlot === slotIndex) {
      // Toggle duty on repeated click as shortcut
      const currentRole = tactics.roles[slotIndex] ?? 'cm';
      setSelectedSlot(slotIndex);
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

  // Selected player for player file
  const selectedStarterId = selectedSlot !== null ? tactics.lineup[selectedSlot] : null;
  const selectedPlayer = getPlayer(selectedStarterId);
  const selectedSlotDef = selectedSlot !== null ? formationDef.slots[selectedSlot] : null;
  const availableRoles = selectedSlotDef ? getAvailableRolesForSlot(selectedSlotDef.position) : [];

  // Toggle player instruction (max 2 per player, clears conflicting instructions)
  const togglePlayerInstruction = (inst: PlayerInstruction) => {
    if (selectedSlot === null) return;
    let currentPIs = [...(tactics.playerInstructions[selectedSlot] ?? [])];
    const idx = currentPIs.indexOf(inst);
    if (idx >= 0) {
      currentPIs.splice(idx, 1);
    } else {
      const clashes: Record<string, string[]> = {
        shootMore: ['shootLess'],
        shootLess: ['shootMore'],
        dribbleMore: ['dribbleLess'],
        dribbleLess: ['dribbleMore'],
        crossMore: ['crossLess'],
        crossLess: ['crossMore'],
        getForward: ['holdPosition'],
        holdPosition: ['getForward', 'roam'],
        roam: ['holdPosition'],
        stayWider: ['sitNarrower'],
        sitNarrower: ['stayWider'],
        crossFromByline: ['crossFromDeep'],
        crossFromDeep: ['crossFromByline'],
        riskyPasses: ['playSafe'],
        playSafe: ['riskyPasses'],
      };

      const toRemove = clashes[inst] ?? [];
      currentPIs = currentPIs.filter((p) => !toRemove.includes(p));

      if (currentPIs.length >= 2) {
        showToast('Max 2 player instructions per player', 'warning');
        return;
      }
      currentPIs.push(inst);
    }
    const newAllPIs = tactics.playerInstructions.map((p, i) =>
      i === selectedSlot ? currentPIs : [...p],
    );
    updateUserTactics({ playerInstructions: newAllPIs });
  };

  // Opposition order toggle
  const toggleOppOrder = (
    targetPlayerId: PlayerId,
    kind: 'tightMark' | 'doubleUp' | 'pressOnBall' | 'showInside' | 'showOutside',
  ) => {
    const orders = [...(tactics.opposition ?? [])];
    const existingIdx = orders.findIndex((o) => o.target === targetPlayerId);

    if (existingIdx >= 0) {
      if (orders[existingIdx]!.kind === kind) {
        // Toggle off
        orders.splice(existingIdx, 1);
      } else {
        orders[existingIdx]!.kind = kind;
      }
    } else {
      if (orders.length >= 3) {
        showToast('Maximum 3 opposition orders allowed (§13.17.3)', 'warning');
        return;
      }
      orders.push({ kind, target: targetPlayerId });
    }

    updateUserTactics({ opposition: orders });
  };

  // Squad injury filter for bench
  const squadPlayers = userClub.squad.map((id) => gameState.players[id]).filter((p) => p != null);
  const injuredPlayers = squadPlayers.filter((p) => p.injury !== null);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '16px 24px 28px',
        overflow: 'auto',
      }}
    >
      {/* Top Banner Validation Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          marginBottom: '16px',
          backgroundColor: validation.valid
            ? 'rgba(24, 199, 122, 0.12)'
            : 'rgba(255, 77, 94, 0.12)',
          border: `1px solid ${validation.valid ? 'var(--win)' : 'var(--loss)'}`,
          borderRadius: 'var(--radius-m)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          {validation.valid ? (
            <>
              <CheckCircle2 size={16} color="var(--win)" />
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>
                Tactical shape valid for kickoff
              </span>
            </>
          ) : (
            <>
              <AlertCircle size={16} color="var(--loss)" />
              <span style={{ color: 'var(--loss)', fontWeight: 600 }}>
                {validation.reason ?? 'Lineup invalid'}
              </span>
            </>
          )}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
          {tactics.bench.length} substitutes named · {tactics.opposition?.length ?? 0}/3 orders set
        </div>
      </div>

      {/* Main Tactical Desk: Whiteboard (Left) + Clipboard (Right) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(340px, 420px)',
          gap: '24px',
          flex: 1,
          alignItems: 'start',
        }}
      >
        {/* Left: The Whiteboard Wall */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Whiteboard Top Folder Tabs */}
          <div style={{ display: 'flex', gap: '4px', paddingLeft: '16px' }}>
            <button
              onClick={() => {
                setBoardTab('us');
                setSelectedOppSlot(null);
              }}
              style={{
                height: '34px',
                padding: '0 18px',
                borderRadius: '4px 4px 0 0',
                backgroundColor: boardTab === 'us' ? 'var(--board)' : 'var(--paper-2)',
                color: boardTab === 'us' ? 'var(--board-ink)' : 'var(--paper-dim)',
                fontFamily: 'var(--font-head)',
                fontWeight: 700,
                fontSize: '14px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Our Team
            </button>
            <button
              onClick={() => {
                setBoardTab('opp');
                setSelectedSlot(null);
              }}
              style={{
                height: '34px',
                padding: '0 18px',
                borderRadius: '4px 4px 0 0',
                backgroundColor: boardTab === 'opp' ? 'var(--board)' : 'var(--paper-2)',
                color: boardTab === 'opp' ? 'var(--marker-red)' : 'var(--paper-dim)',
                fontFamily: 'var(--font-head)',
                fontWeight: 700,
                fontSize: '14px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>Opposition ({oppClub.shortName})</span>
              <span
                style={{
                  fontSize: '11px',
                  backgroundColor: 'rgba(196, 43, 43, 0.15)',
                  padding: '2px 6px',
                  borderRadius: '10px',
                }}
              >
                {tactics.opposition?.length ?? 0}/3
              </span>
            </button>
          </div>

          {/* Aluminium Framed Whiteboard Surface (1050x700 aspect ratio) */}
          <div
            style={{
              position: 'relative',
              padding: '10px',
              borderRadius: '5px',
              background: 'linear-gradient(160deg, #CDD2D6, #9AA1A8)',
              boxShadow: 'var(--shadow-paper)',
            }}
          >
            <div
              style={{
                position: 'relative',
                backgroundColor: 'var(--board)',
                borderRadius: '2px',
                aspectRatio: '1050 / 700',
                overflow: 'hidden',
                touchAction: 'none',
              }}
            >
              {/* Sideways Pitch SVG Lines (Own goal Left, Attacking goal Right) */}
              <svg
                viewBox="0 0 1050 700"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                }}
              >
                {/* Touchlines & Goal Lines */}
                <rect
                  x="40"
                  y="40"
                  width="970"
                  height="620"
                  fill="none"
                  stroke="var(--board-ink)"
                  strokeOpacity="0.35"
                  strokeWidth="3"
                />
                {/* Halfway Line */}
                <line
                  x1="525"
                  y1="40"
                  x2="525"
                  y2="660"
                  stroke="var(--board-ink)"
                  strokeOpacity="0.35"
                  strokeWidth="3"
                />
                {/* Centre Circle & Spot */}
                <circle
                  cx="525"
                  cy="350"
                  r="92"
                  fill="none"
                  stroke="var(--board-ink)"
                  strokeOpacity="0.35"
                  strokeWidth="3"
                />
                <circle cx="525" cy="350" r="4" fill="var(--board-ink)" fillOpacity="0.35" />

                {/* Left (Own) Penalty Area: 16.5m depth (x=40..192), 40.3m height (y=140..560) */}
                <rect
                  x="40"
                  y="145"
                  width="152"
                  height="410"
                  fill="none"
                  stroke="var(--board-ink)"
                  strokeOpacity="0.35"
                  strokeWidth="3"
                />
                {/* Left Six Yard Box */}
                <rect
                  x="40"
                  y="245"
                  width="52"
                  height="210"
                  fill="none"
                  stroke="var(--board-ink)"
                  strokeOpacity="0.35"
                  strokeWidth="3"
                />
                {/* Left Penalty Spot & Arc */}
                <circle cx="142" cy="350" r="4" fill="var(--board-ink)" fillOpacity="0.35" />
                <path
                  d="M 192 285 A 92 92 0 0 1 192 415"
                  fill="none"
                  stroke="var(--board-ink)"
                  strokeOpacity="0.35"
                  strokeWidth="3"
                />

                {/* Right (Opponent) Penalty Area */}
                <rect
                  x="858"
                  y="145"
                  width="152"
                  height="410"
                  fill="none"
                  stroke="var(--board-ink)"
                  strokeOpacity="0.35"
                  strokeWidth="3"
                />
                {/* Right Six Yard Box */}
                <rect
                  x="958"
                  y="245"
                  width="52"
                  height="210"
                  fill="none"
                  stroke="var(--board-ink)"
                  strokeOpacity="0.35"
                  strokeWidth="3"
                />
                {/* Right Penalty Spot & Arc */}
                <circle cx="908" cy="350" r="4" fill="var(--board-ink)" fillOpacity="0.35" />
                <path
                  d="M 858 285 A 92 92 0 0 0 858 415"
                  fill="none"
                  stroke="var(--board-ink)"
                  strokeOpacity="0.35"
                  strokeWidth="3"
                />

                {/* Tactical Guideline Markers (Dashed vertical lines for Line & Press) */}
                {boardTab === 'us' && (
                  <>
                    {/* Defensive line marker */}
                    <line
                      x1={
                        tactics.instructions.line === 'Deep'
                          ? 180
                          : tactics.instructions.line === 'High'
                            ? 350
                            : 260
                      }
                      y1="50"
                      x2={
                        tactics.instructions.line === 'Deep'
                          ? 180
                          : tactics.instructions.line === 'High'
                            ? 350
                            : 260
                      }
                      y2="650"
                      stroke="var(--marker-blue)"
                      strokeOpacity="0.3"
                      strokeWidth="2"
                      strokeDasharray="6 6"
                    />
                    {/* Pressing line marker */}
                    <line
                      x1={
                        tactics.instructions.pressing === 'Low'
                          ? 550
                          : tactics.instructions.pressing === 'High'
                            ? 820
                            : 680
                      }
                      y1="50"
                      x2={
                        tactics.instructions.pressing === 'Low'
                          ? 550
                          : tactics.instructions.pressing === 'High'
                            ? 820
                            : 680
                      }
                      y2="650"
                      stroke="var(--marker-blue)"
                      strokeOpacity="0.3"
                      strokeWidth="2"
                      strokeDasharray="6 6"
                    />
                  </>
                )}
              </svg>

              {/* TAB 1: OUR TEAM XI MAGNETS */}
              {boardTab === 'us' && (
                <>
                  {formationDef.slots.map((slotDef) => {
                    const playerId = tactics.lineup[slotDef.slot];
                    const player = getPlayer(playerId);
                    const roleId =
                      tactics.roles[slotDef.slot] ?? getDefaultRoleForPos(slotDef.position);
                    const roleDef = ROLES[roleId];
                    const isSelected = selectedSlot === slotDef.slot;

                    // Fit calculation
                    const fitScore = player ? computeRoleFit(roleId, player.attributes).score : 50;
                    const primaryOvr = player ? getPrimaryOvr(player) : 70;
                    const slotOvr = player ? ovrAt(player, slotDef.position) : 70;
                    const isNatural = slotOvr >= primaryOvr - 2;

                    // Sideways coordinate mapping (own goal on left, x=0..105, y=0..68)
                    const leftPercent = (slotDef.anchor.x / 105) * 82 + 9;
                    const topPercent = (slotDef.anchor.y / 68) * 78 + 11;

                    return (
                      <div
                        key={slotDef.slot}
                        style={{
                          position: 'absolute',
                          top: `${topPercent}%`,
                          left: `${leftPercent}%`,
                          transform: 'translate(-50%, -50%)',
                          zIndex: isSelected ? 30 : 15,
                        }}
                      >
                        <Magnet
                          number={player?.squadNumber ?? slotDef.slot + 1}
                          surname={player ? (player.knownAs ?? player.lastName) : slotDef.role}
                          roleLabel={roleDef?.name ?? slotDef.role}
                          kitColor={userClub.colors.primary}
                          textColor="#FFFFFF"
                          isSelected={isSelected}
                          onClick={() => handleSlotClick(slotDef.slot)}
                        />
                        {/* Role fit badge */}
                        {player && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '-6px',
                              right: '-10px',
                              backgroundColor: isNatural
                                ? 'var(--win)'
                                : fitScore >= 60
                                  ? 'var(--warning)'
                                  : 'var(--loss)',
                              color: '#FFFFFF',
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '1px 4px',
                              borderRadius: '2px',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                            }}
                          >
                            {Math.round(slotOvr)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {/* TAB 2: OPPOSITION SHAPE & ORDERS */}
              {boardTab === 'opp' && (
                <>
                  {oppFormationDef.slots.map((slotDef) => {
                    const oppPlayerId = oppClub.squad[slotDef.slot];
                    const oppPlayer = oppPlayerId ? gameState.players[oppPlayerId] : undefined;
                    const existingOrder = tactics.opposition?.find((o) => o.target === oppPlayerId);
                    const isSelected = selectedOppSlot === slotDef.slot;

                    // Opponent attacking towards left, goal on right (inverted x, inverted y)
                    const leftPercent = ((105 - slotDef.anchor.x) / 105) * 82 + 9;
                    const topPercent = ((68 - slotDef.anchor.y) / 68) * 78 + 11;

                    return (
                      <div
                        key={slotDef.slot}
                        onClick={() => setSelectedOppSlot(isSelected ? null : slotDef.slot)}
                        style={{
                          position: 'absolute',
                          top: `${topPercent}%`,
                          left: `${leftPercent}%`,
                          transform: 'translate(-50%, -50%)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          cursor: 'pointer',
                          zIndex: isSelected ? 30 : 15,
                        }}
                      >
                        <div
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '50%',
                            border: `2px solid ${existingOrder ? 'var(--marker-red)' : 'var(--board-ink)'}`,
                            backgroundColor: existingOrder
                              ? 'rgba(196, 43, 43, 0.2)'
                              : 'rgba(255, 255, 255, 0.8)',
                            color: existingOrder ? 'var(--marker-red)' : 'var(--board-ink)',
                            display: 'grid',
                            placeItems: 'center',
                            fontFamily: 'var(--font-head)',
                            fontWeight: 700,
                            fontSize: '16px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            outline: isSelected ? '2px dashed var(--marker-red)' : 'none',
                            outlineOffset: '3px',
                          }}
                        >
                          {oppPlayer?.squadNumber ?? slotDef.slot + 1}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--board-ink)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {oppPlayer ? (oppPlayer.knownAs ?? oppPlayer.lastName) : slotDef.role}
                        </div>
                        {existingOrder && (
                          <div
                            style={{
                              backgroundColor: 'var(--marker-red)',
                              color: '#FFFFFF',
                              fontSize: '9px',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '2px',
                              textTransform: 'uppercase',
                            }}
                          >
                            {existingOrder.kind}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Marker Tray underneath the whiteboard */}
            <div
              style={{
                height: '32px',
                margin: '0 30px',
                borderRadius: '0 0 6px 6px',
                background: 'linear-gradient(#9AA1A8, #80878E)',
                boxShadow: '0 6px 12px rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                fontSize: '11px',
                color: 'var(--board-ink)',
                fontWeight: 600,
              }}
            >
              <span>Meridian League Pitch Specification · 105m × 68m</span>
              <span style={{ display: 'flex', gap: '12px' }}>
                <span style={{ color: 'var(--marker-blue)' }}>● Blue: Tactics & Lines</span>
                <span style={{ color: 'var(--marker-red)' }}>● Red: Opposition Orders</span>
              </span>
            </div>

            {/* Bench Strip & Injured Room */}
            <div
              style={{
                marginTop: '12px',
                padding: '12px 16px',
                backgroundColor: 'rgba(255, 255, 255, 0.45)',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              {/* Bench strip */}
              <div style={{ flex: 1 }}>
                <div
                  className="broadcast-label"
                  style={{ color: 'var(--board-ink)', fontSize: '11px', marginBottom: '8px' }}
                >
                  BENCH ({tactics.bench.length} / 9) · CLICK TO SWAP INTO XI
                </div>
                <div
                  style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '2px' }}
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

              {/* Injured Corner */}
              {injuredPlayers.length > 0 && (
                <div
                  style={{
                    borderLeft: '1px solid rgba(30, 42, 56, 0.2)',
                    paddingLeft: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div
                    className="broadcast-label"
                    style={{ color: 'var(--marker-red)', fontSize: '11px' }}
                  >
                    TREATMENT ROOM ({injuredPlayers.length})
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {injuredPlayers.map((p) => (
                      <div
                        key={p.id}
                        title={`${p.firstName} ${p.lastName}: ${p.injury?.kind} (${p.injury?.matchdaysOut} matchdays)`}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(196, 43, 43, 0.15)',
                          border: '1px solid var(--marker-red)',
                          display: 'grid',
                          placeItems: 'center',
                          color: 'var(--marker-red)',
                          fontFamily: 'var(--font-head)',
                          fontWeight: 700,
                          fontSize: '12px',
                        }}
                      >
                        {p.squadNumber ?? '+'}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: The Clipboard or Player File */}
        <div style={{ position: 'relative' }}>
          {/* PLAYER FILE (When a Starter Slot is Selected) */}
          {selectedSlot !== null && selectedPlayer && selectedSlotDef ? (
            <Sheet id="tactics-player-file" variant="file">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* File Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    borderBottom: '2px solid var(--paper-ink)',
                    paddingBottom: '10px',
                  }}
                >
                  <div>
                    <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                      PLAYER FILE · SLOT {selectedSlot + 1} ({selectedSlotDef.position})
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-head)',
                        fontWeight: 700,
                        fontSize: '22px',
                        color: 'var(--paper-ink)',
                      }}
                    >
                      #{selectedPlayer.squadNumber} {selectedPlayer.firstName}{' '}
                      {selectedPlayer.lastName}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--paper-dim)' }}>
                      Primary: {selectedPlayer.positions[0]?.pos} · OVR{' '}
                      {ovrAt(selectedPlayer, selectedSlotDef.position)}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedSlot(null)}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: 'var(--paper-dim)',
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Role Picker for this Slot */}
                <div>
                  <div
                    className="broadcast-label"
                    style={{ color: 'var(--paper-dim)', marginBottom: '8px' }}
                  >
                    CHOSEN ROLE & FIT (§13.17.2)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {availableRoles.map((role) => {
                      const isCurrent =
                        (tactics.roles[selectedSlot] ??
                          getDefaultRoleForPos(selectedSlotDef.position)) === role.id;
                      const fit = computeRoleFit(role.id, selectedPlayer.attributes);
                      return (
                        <div
                          key={role.id}
                          onClick={() => {
                            const newRoles = [...tactics.roles];
                            newRoles[selectedSlot] = role.id;
                            updateUserTactics({ roles: newRoles });
                          }}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '3px',
                            backgroundColor: isCurrent ? 'var(--paper-ink)' : 'var(--paper-2)',
                            color: isCurrent ? 'var(--paper)' : 'var(--paper-ink)',
                            border: '1px solid var(--paper-rule)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span style={{ fontWeight: 700, fontSize: '14px' }}>{role.name}</span>
                            <span style={{ fontSize: '12px', fontWeight: 600 }}>
                              {'★'.repeat(fit.stars)}
                              {'☆'.repeat(5 - fit.stars)} ({fit.score})
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', opacity: 0.85 }}>{role.description}</div>
                          {isCurrent && !role.isNeutral && (
                            <div
                              style={{
                                marginTop: '4px',
                                paddingTop: '4px',
                                borderTop: '1px dashed rgba(255,255,255,0.2)',
                                fontSize: '11px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                              }}
                            >
                              <div style={{ color: 'var(--win)' }}>+ Gives: {role.gives}</div>
                              <div style={{ color: 'var(--loss)' }}>− Costs: {role.costs}</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Player Instructions (up to 2) */}
                <div style={{ borderTop: '1px solid var(--paper-rule)', paddingTop: '12px' }}>
                  <div
                    className="broadcast-label"
                    style={{ color: 'var(--paper-dim)', marginBottom: '8px' }}
                  >
                    PLAYER INSTRUCTIONS ({tactics.playerInstructions[selectedSlot]?.length ?? 0}/2)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {(
                      [
                        { id: 'shootMore', label: 'Shoot More' },
                        { id: 'shootLess', label: 'Shoot Less' },
                        { id: 'dribbleMore', label: 'Dribble More' },
                        { id: 'dribbleLess', label: 'Dribble Less' },
                        { id: 'crossMore', label: 'Cross More' },
                        { id: 'crossLess', label: 'Cross Less' },
                        { id: 'getForward', label: 'Get Forward' },
                        { id: 'holdPosition', label: 'Hold Position' },
                        { id: 'stayWider', label: 'Stay Wider' },
                        { id: 'sitNarrower', label: 'Sit Narrower' },
                        { id: 'closeDownMore', label: 'Close Down More' },
                        { id: 'stayOnFeet', label: 'Stay On Feet' },
                        { id: 'roam', label: 'Roam From Position' },
                        { id: 'crossFromByline', label: 'Cross From Byline' },
                        { id: 'crossFromDeep', label: 'Cross From Deep' },
                        { id: 'riskyPasses', label: 'Take More Risks' },
                        { id: 'playSafe', label: 'Play Safer' },
                        { id: 'longThrows', label: 'Long Throws' },
                      ] as { id: PlayerInstruction; label: string }[]
                    ).map(({ id: pi, label }) => {
                      const isActive =
                        tactics.playerInstructions[selectedSlot]?.includes(pi) ?? false;
                      const isWide = selectedSlotDef
                        ? ['LB', 'RB', 'LWB', 'RWB', 'LM', 'RM', 'LW', 'RW'].includes(
                            selectedSlotDef.position,
                          )
                        : false;
                      const isWideOnly = pi === 'crossFromByline' || pi === 'crossFromDeep';
                      const isDisabled = isWideOnly && !isWide;

                      return (
                        <button
                          key={pi}
                          disabled={isDisabled}
                          onClick={() => togglePlayerInstruction(pi)}
                          title={isDisabled ? 'Wide positions only' : undefined}
                          style={{
                            padding: '6px 8px',
                            borderRadius: '3px',
                            backgroundColor: isActive
                              ? 'var(--marker-blue)'
                              : isDisabled
                                ? 'var(--paper-rule)'
                                : 'var(--paper-2)',
                            color: isActive
                              ? '#FFFFFF'
                              : isDisabled
                                ? 'var(--paper-dim)'
                                : 'var(--paper-ink)',
                            border: '1px solid var(--paper-rule)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            textAlign: 'left',
                            opacity: isDisabled ? 0.6 : 1.0,
                          }}
                        >
                          {isActive ? '✓ ' : ''}
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Sheet>
          ) : (
            /* CLIPBOARD (Normal View with 4 Dividers) */
            <Sheet id="tactics-clipboard" variant="clipboard">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Tactical Plans Tabs: Plan A, Plan B, Plan C (SPEC §13.18.10) */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['Plan A', 'Plan B', 'Plan C'] as const).map((planName, pIdx) => {
                    const isActive = (tactics.activePlan ?? 0) === pIdx;
                    return (
                      <button
                        key={planName}
                        onClick={() => {
                          updateUserTactics({ activePlan: pIdx as 0 | 1 | 2 });
                          showToast(`Switched to ${planName}`, 'info');
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          backgroundColor: isActive ? 'var(--paper-ink)' : 'var(--paper-2)',
                          color: isActive ? 'var(--paper)' : 'var(--paper-ink)',
                          border: isActive
                            ? '1px solid var(--paper-ink)'
                            : '1px solid var(--paper-rule)',
                          borderRadius: '4px',
                          fontWeight: 700,
                          fontSize: '11px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        {isActive && <CheckCircle2 size={12} color="var(--marker-green)" />}
                        <span>{planName}</span>
                        {isActive && (
                          <span
                            style={{
                              fontSize: '9px',
                              padding: '1px 4px',
                              borderRadius: '2px',
                              backgroundColor: 'rgba(255,255,255,0.2)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            ACTIVE
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

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
                            padding: '4px 8px',
                            borderRadius: '3px',
                            backgroundColor: 'var(--paper-2)',
                            border: '1px solid var(--paper-rule)',
                            color: 'var(--paper-ink)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {p}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                {/* 4 Clipboard Divider Tabs */}
                <div
                  style={{
                    display: 'flex',
                    borderBottom: '2px solid var(--paper-ink)',
                    gap: '2px',
                  }}
                >
                  {[
                    { id: 'withBall', label: 'With Ball' },
                    { id: 'withoutBall', label: 'Without Ball' },
                    { id: 'transitions', label: 'Transitions' },
                    { id: 'setPieces', label: 'Set Pieces' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setClipboardTab(tab.id as any)}
                      style={{
                        flex: 1,
                        padding: '6px 2px',
                        backgroundColor:
                          clipboardTab === tab.id ? 'var(--paper-ink)' : 'var(--paper-2)',
                        color: clipboardTab === tab.id ? 'var(--paper)' : 'var(--paper-ink)',
                        border: 'none',
                        borderRadius: '3px 3px 0 0',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* TAB 1: WITH BALL */}
                {clipboardTab === 'withBall' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Mentality */}
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                      >
                        MENTALITY (5-STEP, §13.18.1)
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        {[
                          { id: 'VeryDefensive', label: 'Very Def' },
                          { id: 'Defensive', label: 'Defensive' },
                          { id: 'Balanced', label: 'Balanced' },
                          { id: 'Attacking', label: 'Attacking' },
                          { id: 'VeryAttacking', label: 'Very Att' },
                        ].map(({ id, label }) => (
                          <button
                            key={id}
                            onClick={() =>
                              updateUserTactics({
                                instructions: {
                                  ...tactics.instructions,
                                  mentality: id as Mentality,
                                },
                              })
                            }
                            style={{
                              flex: 1,
                              padding: '5px 2px',
                              backgroundColor:
                                tactics.instructions.mentality === id
                                  ? 'var(--paper-ink)'
                                  : 'var(--paper-2)',
                              color:
                                tactics.instructions.mentality === id
                                  ? 'var(--paper)'
                                  : 'var(--paper-ink)',
                              border: '1px solid var(--paper-rule)',
                              borderRadius: '2px',
                              fontSize: '10px',
                              fontWeight: 600,
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Passing */}
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                      >
                        PASSING STYLE
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        {(['Short', 'Mixed', 'Direct'] as PassingStyle[]).map((p) => (
                          <button
                            key={p}
                            onClick={() =>
                              updateUserTactics({
                                instructions: { ...tactics.instructions, passing: p },
                              })
                            }
                            style={{
                              flex: 1,
                              padding: '5px',
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
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tempo */}
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                      >
                        TEMPO
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        {(['Slow', 'Normal', 'Fast'] as Tempo[]).map((t) => (
                          <button
                            key={t}
                            onClick={() =>
                              updateUserTactics({
                                instructions: { ...tactics.instructions, tempo: t },
                              })
                            }
                            style={{
                              flex: 1,
                              padding: '5px',
                              backgroundColor:
                                tactics.instructions.tempo === t
                                  ? 'var(--paper-ink)'
                                  : 'var(--paper-2)',
                              color:
                                tactics.instructions.tempo === t
                                  ? 'var(--paper)'
                                  : 'var(--paper-ink)',
                              border: '1px solid var(--paper-rule)',
                              borderRadius: '2px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Width */}
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                      >
                        ATTACKING WIDTH
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        {(['Narrow', 'Normal', 'Wide'] as Width[]).map((w) => (
                          <button
                            key={w}
                            onClick={() =>
                              updateUserTactics({
                                instructions: { ...tactics.instructions, width: w },
                              })
                            }
                            style={{
                              flex: 1,
                              padding: '5px',
                              backgroundColor:
                                tactics.instructions.width === w
                                  ? 'var(--paper-ink)'
                                  : 'var(--paper-2)',
                              color:
                                tactics.instructions.width === w
                                  ? 'var(--paper)'
                                  : 'var(--paper-ink)',
                              border: '1px solid var(--paper-rule)',
                              borderRadius: '2px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Focus */}
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                      >
                        PLAY FOCUS
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        {(['Left', 'Centre', 'Right', 'Mixed'] as Focus[]).map((fc) => (
                          <button
                            key={fc}
                            onClick={() =>
                              updateUserTactics({
                                instructions: { ...tactics.instructions, focus: fc },
                              })
                            }
                            style={{
                              flex: 1,
                              padding: '5px',
                              backgroundColor:
                                tactics.instructions.focus === fc
                                  ? 'var(--paper-ink)'
                                  : 'var(--paper-2)',
                              color:
                                tactics.instructions.focus === fc
                                  ? 'var(--paper)'
                                  : 'var(--paper-ink)',
                              border: '1px solid var(--paper-rule)',
                              borderRadius: '2px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {fc}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Final Third */}
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                      >
                        FINAL THIRD (§13.18.2)
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        {[
                          { id: 'WorkIntoBox', label: 'Work Into Box' },
                          { id: 'Mixed', label: 'Mixed' },
                          { id: 'ShootOnSight', label: 'Shoot On Sight' },
                        ].map(({ id, label }) => (
                          <button
                            key={id}
                            onClick={() =>
                              updateUserTactics({
                                instructions: {
                                  ...tactics.instructions,
                                  finalThird: id as FinalThird,
                                },
                              })
                            }
                            style={{
                              flex: 1,
                              padding: '5px',
                              backgroundColor:
                                tactics.instructions.finalThird === id
                                  ? 'var(--paper-ink)'
                                  : 'var(--paper-2)',
                              color:
                                tactics.instructions.finalThird === id
                                  ? 'var(--paper)'
                                  : 'var(--paper-ink)',
                              border: '1px solid var(--paper-rule)',
                              borderRadius: '2px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Crosses */}
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                      >
                        CROSSES (§13.18.3)
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        {[
                          { id: 'Low', label: 'Low' },
                          { id: 'Whipped', label: 'Whipped' },
                          { id: 'Floated', label: 'Floated' },
                          { id: 'Mixed', label: 'Mixed' },
                        ].map(({ id, label }) => (
                          <button
                            key={id}
                            onClick={() =>
                              updateUserTactics({
                                instructions: {
                                  ...tactics.instructions,
                                  crossStyle: id as CrossStyle,
                                },
                              })
                            }
                            style={{
                              flex: 1,
                              padding: '5px',
                              backgroundColor:
                                tactics.instructions.crossStyle === id
                                  ? 'var(--paper-ink)'
                                  : 'var(--paper-2)',
                              color:
                                tactics.instructions.crossStyle === id
                                  ? 'var(--paper)'
                                  : 'var(--paper-ink)',
                              border: '1px solid var(--paper-rule)',
                              borderRadius: '2px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: WITHOUT BALL */}
                {clipboardTab === 'withoutBall' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Pressing */}
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                      >
                        PRESSING INTENSITY
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        {(['Low', 'Mid', 'High'] as Pressing[]).map((pr) => (
                          <button
                            key={pr}
                            onClick={() =>
                              updateUserTactics({
                                instructions: { ...tactics.instructions, pressing: pr },
                              })
                            }
                            style={{
                              flex: 1,
                              padding: '5px',
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
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {pr}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Defensive Line */}
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                      >
                        DEFENSIVE LINE
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        {(['Deep', 'Normal', 'High'] as DefLine[]).map((dl) => (
                          <button
                            key={dl}
                            onClick={() =>
                              updateUserTactics({
                                instructions: { ...tactics.instructions, line: dl },
                              })
                            }
                            style={{
                              flex: 1,
                              padding: '5px',
                              backgroundColor:
                                tactics.instructions.line === dl
                                  ? 'var(--paper-ink)'
                                  : 'var(--paper-2)',
                              color:
                                tactics.instructions.line === dl
                                  ? 'var(--paper)'
                                  : 'var(--paper-ink)',
                              border: '1px solid var(--paper-rule)',
                              borderRadius: '2px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {dl}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Offside Trap */}
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                      >
                        OFFSIDE TRAP (§13.18.4)
                      </div>
                      <button
                        onClick={() =>
                          updateUserTactics({
                            instructions: {
                              ...tactics.instructions,
                              offsideTrap: !tactics.instructions.offsideTrap,
                            },
                          })
                        }
                        style={{
                          width: '100%',
                          marginTop: '2px',
                          padding: '6px',
                          backgroundColor: tactics.instructions.offsideTrap
                            ? 'var(--marker-blue)'
                            : 'var(--paper-2)',
                          color: tactics.instructions.offsideTrap ? '#FFFFFF' : 'var(--paper-ink)',
                          border: '1px solid var(--paper-rule)',
                          borderRadius: '2px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        {tactics.instructions.offsideTrap
                          ? '✓ Offside Trap Active (Step up together)'
                          : 'Offside Trap Inactive (Hold the line)'}
                      </button>
                    </div>

                    {/* Tackling */}
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                      >
                        TACKLING (§13.18.5)
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        {[
                          { id: 'StayOnFeet', label: 'Stay On Feet' },
                          { id: 'Mixed', label: 'Mixed' },
                          { id: 'GetStuckIn', label: 'Get Stuck In' },
                        ].map(({ id, label }) => (
                          <button
                            key={id}
                            onClick={() =>
                              updateUserTactics({
                                instructions: {
                                  ...tactics.instructions,
                                  tackling: id as Tackling,
                                },
                              })
                            }
                            style={{
                              flex: 1,
                              padding: '5px',
                              backgroundColor:
                                tactics.instructions.tackling === id
                                  ? 'var(--paper-ink)'
                                  : 'var(--paper-2)',
                              color:
                                tactics.instructions.tackling === id
                                  ? 'var(--paper)'
                                  : 'var(--paper-ink)',
                              border: '1px solid var(--paper-rule)',
                              borderRadius: '2px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Force Opposition */}
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                      >
                        FORCE OPPOSITION (§13.18.6)
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        {[
                          { id: 'Inside', label: 'Inside' },
                          { id: 'Mixed', label: 'Mixed' },
                          { id: 'Outside', label: 'Outside' },
                        ].map(({ id, label }) => (
                          <button
                            key={id}
                            onClick={() =>
                              updateUserTactics({
                                instructions: {
                                  ...tactics.instructions,
                                  forceOpp: id as ForceOpp,
                                },
                              })
                            }
                            style={{
                              flex: 1,
                              padding: '5px',
                              backgroundColor:
                                tactics.instructions.forceOpp === id
                                  ? 'var(--paper-ink)'
                                  : 'var(--paper-2)',
                              color:
                                tactics.instructions.forceOpp === id
                                  ? 'var(--paper)'
                                  : 'var(--paper-ink)',
                              border: '1px solid var(--paper-rule)',
                              borderRadius: '2px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: TRANSITIONS */}
                {clipboardTab === 'transitions' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Upon Loss */}
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                      >
                        UPON LOSING POSSESSION (§13.17.4)
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        {(['CounterPress', 'Regroup', 'Mixed'] as OnLoss[]).map((ol) => (
                          <button
                            key={ol}
                            onClick={() =>
                              updateUserTactics({
                                instructions: { ...tactics.instructions, onLoss: ol },
                              })
                            }
                            style={{
                              flex: 1,
                              padding: '5px',
                              backgroundColor:
                                tactics.instructions.onLoss === ol
                                  ? 'var(--paper-ink)'
                                  : 'var(--paper-2)',
                              color:
                                tactics.instructions.onLoss === ol
                                  ? 'var(--paper)'
                                  : 'var(--paper-ink)',
                              border: '1px solid var(--paper-rule)',
                              borderRadius: '2px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {ol}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Upon Win */}
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                      >
                        UPON WINNING POSSESSION (§13.17.4)
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        {(['Counter', 'KeepIt', 'Mixed'] as OnWin[]).map((ow) => (
                          <button
                            key={ow}
                            onClick={() =>
                              updateUserTactics({
                                instructions: { ...tactics.instructions, onWin: ow },
                              })
                            }
                            style={{
                              flex: 1,
                              padding: '5px',
                              backgroundColor:
                                tactics.instructions.onWin === ow
                                  ? 'var(--paper-ink)'
                                  : 'var(--paper-2)',
                              color:
                                tactics.instructions.onWin === ow
                                  ? 'var(--paper)'
                                  : 'var(--paper-ink)',
                              border: '1px solid var(--paper-rule)',
                              borderRadius: '2px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {ow}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Time-Wasting */}
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                      >
                        TIME-WASTING (§13.18.7)
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        {[
                          { id: 'Never', label: 'Never (Play on)' },
                          { id: 'WhenAhead', label: "When Ahead Late (70'+)" },
                        ].map(({ id, label }) => (
                          <button
                            key={id}
                            onClick={() =>
                              updateUserTactics({
                                instructions: {
                                  ...tactics.instructions,
                                  timeWasting: id as TimeWasting,
                                },
                              })
                            }
                            style={{
                              flex: 1,
                              padding: '5px',
                              backgroundColor:
                                tactics.instructions.timeWasting === id
                                  ? 'var(--paper-ink)'
                                  : 'var(--paper-2)',
                              color:
                                tactics.instructions.timeWasting === id
                                  ? 'var(--paper)'
                                  : 'var(--paper-ink)',
                              border: '1px solid var(--paper-rule)',
                              borderRadius: '2px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* GK Distribution */}
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                      >
                        GOALKEEPER DISTRIBUTION (§13.17.4)
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        {(['Short', 'Long', 'Wide', 'Mixed'] as Distribution[]).map((dst) => (
                          <button
                            key={dst}
                            onClick={() =>
                              updateUserTactics({
                                instructions: { ...tactics.instructions, distribution: dst },
                              })
                            }
                            style={{
                              flex: 1,
                              padding: '5px',
                              backgroundColor:
                                tactics.instructions.distribution === dst
                                  ? 'var(--paper-ink)'
                                  : 'var(--paper-2)',
                              color:
                                tactics.instructions.distribution === dst
                                  ? 'var(--paper)'
                                  : 'var(--paper-ink)',
                              border: '1px solid var(--paper-rule)',
                              borderRadius: '2px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {dst}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: SET PIECES */}
                {clipboardTab === 'setPieces' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Free Kicks */}
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                      >
                        FREE KICKS (ATT CENTRE WITHIN 30M, §13.18.8)
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        {[
                          { id: 'Shoot', label: 'Shoot' },
                          { id: 'Cross', label: 'Cross' },
                          { id: 'Short', label: 'Short' },
                          { id: 'Mixed', label: 'Mixed' },
                        ].map(({ id, label }) => (
                          <button
                            key={id}
                            onClick={() =>
                              updateUserTactics({
                                instructions: {
                                  ...tactics.instructions,
                                  freeKicks: id as FreeKicks,
                                },
                              })
                            }
                            style={{
                              flex: 1,
                              padding: '5px',
                              backgroundColor:
                                tactics.instructions.freeKicks === id
                                  ? 'var(--paper-ink)'
                                  : 'var(--paper-2)',
                              color:
                                tactics.instructions.freeKicks === id
                                  ? 'var(--paper)'
                                  : 'var(--paper-ink)',
                              border: '1px solid var(--paper-rule)',
                              borderRadius: '2px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Corners For */}
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                      >
                        CORNER ROUTINE (§13.17.5)
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        {(['NearPost', 'FarPost', 'Short', 'Mixed'] as CornersFor[]).map((cf) => (
                          <button
                            key={cf}
                            onClick={() =>
                              updateUserTactics({
                                instructions: { ...tactics.instructions, cornersFor: cf },
                              })
                            }
                            style={{
                              flex: 1,
                              padding: '5px',
                              backgroundColor:
                                tactics.instructions.cornersFor === cf
                                  ? 'var(--paper-ink)'
                                  : 'var(--paper-2)',
                              color:
                                tactics.instructions.cornersFor === cf
                                  ? 'var(--paper)'
                                  : 'var(--paper-ink)',
                              border: '1px solid var(--paper-rule)',
                              borderRadius: '2px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {cf}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Corner Swing */}
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                      >
                        CORNER DELIVERY SWING (§13.18.8)
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        {[
                          { id: 'Inswinger', label: 'Inswinger' },
                          { id: 'Outswinger', label: 'Outswinger' },
                          { id: 'Mixed', label: 'Mixed' },
                        ].map(({ id, label }) => (
                          <button
                            key={id}
                            onClick={() =>
                              updateUserTactics({
                                instructions: {
                                  ...tactics.instructions,
                                  cornerSwing: id as CornerSwing,
                                },
                              })
                            }
                            style={{
                              flex: 1,
                              padding: '5px',
                              backgroundColor:
                                tactics.instructions.cornerSwing === id
                                  ? 'var(--paper-ink)'
                                  : 'var(--paper-2)',
                              color:
                                tactics.instructions.cornerSwing === id
                                  ? 'var(--paper)'
                                  : 'var(--paper-ink)',
                              border: '1px solid var(--paper-rule)',
                              borderRadius: '2px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Corners Against */}
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                      >
                        CORNER DEFENDING (§13.17.5)
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        {(['Zonal', 'ManMark', 'Mixed'] as CornersAgainst[]).map((ca) => (
                          <button
                            key={ca}
                            onClick={() =>
                              updateUserTactics({
                                instructions: { ...tactics.instructions, cornersAgainst: ca },
                              })
                            }
                            style={{
                              flex: 1,
                              padding: '5px',
                              backgroundColor:
                                tactics.instructions.cornersAgainst === ca
                                  ? 'var(--paper-ink)'
                                  : 'var(--paper-2)',
                              color:
                                tactics.instructions.cornersAgainst === ca
                                  ? 'var(--paper)'
                                  : 'var(--paper-ink)',
                              border: '1px solid var(--paper-rule)',
                              borderRadius: '2px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {ca}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Men Back */}
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                      >
                        MEN BACK AT CORNERS (§13.18.8)
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        {[
                          { id: 1, label: '1 Back (Counter Risk)' },
                          { id: 2, label: '2 Back (Balanced)' },
                          { id: 3, label: '3 Back (Safe)' },
                        ].map(({ id, label }) => (
                          <button
                            key={id}
                            onClick={() =>
                              updateUserTactics({
                                instructions: {
                                  ...tactics.instructions,
                                  menBack: id as MenBack,
                                },
                              })
                            }
                            style={{
                              flex: 1,
                              padding: '5px',
                              backgroundColor:
                                tactics.instructions.menBack === id
                                  ? 'var(--paper-ink)'
                                  : 'var(--paper-2)',
                              color:
                                tactics.instructions.menBack === id
                                  ? 'var(--paper)'
                                  : 'var(--paper-ink)',
                              border: '1px solid var(--paper-rule)',
                              borderRadius: '2px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Defending Men on Posts */}
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--paper-dim)', fontSize: '11px' }}
                      >
                        DEFENDING MEN ON POSTS (§13.18.8)
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        {[
                          { id: 'None', label: 'None (Pack Box)' },
                          { id: 'Near', label: 'Near Post' },
                          { id: 'Both', label: 'Both Posts' },
                        ].map(({ id, label }) => (
                          <button
                            key={id}
                            onClick={() =>
                              updateUserTactics({
                                instructions: {
                                  ...tactics.instructions,
                                  postMen: id as PostMen,
                                },
                              })
                            }
                            style={{
                              flex: 1,
                              padding: '5px',
                              backgroundColor:
                                tactics.instructions.postMen === id
                                  ? 'var(--paper-ink)'
                                  : 'var(--paper-2)',
                              color:
                                tactics.instructions.postMen === id
                                  ? 'var(--paper)'
                                  : 'var(--paper-ink)',
                              border: '1px solid var(--paper-rule)',
                              borderRadius: '2px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    borderTop: '2px solid var(--paper-rule)',
                    paddingTop: '12px',
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
                      autoPickBestLineup();
                      showToast('Reset tactics to club identity', 'info');
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </Sheet>
          )}

          {/* OPPOSITION ORDER MODAL / OVERLAY (When an opp slot is selected in opp tab) */}
          {boardTab === 'opp' && selectedOppSlot !== null && (
            <div
              style={{
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                zIndex: 50,
                backgroundColor: 'var(--paper)',
                color: 'var(--paper-ink)',
                borderRadius: '4px',
                padding: '16px',
                boxShadow: 'var(--shadow-2)',
                border: '2px solid var(--marker-red)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--marker-red)' }}>
                  OPPOSITION ORDER (§13.17.3)
                </div>
                <button
                  onClick={() => setSelectedOppSlot(null)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              {oppClub.squad[selectedOppSlot] && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>
                    Target:{' '}
                    {(() => {
                      const oppP = getPlayer(oppClub.squad[selectedOppSlot]);
                      return oppP ? `${oppP.firstName} ${oppP.lastName}` : 'Opponent Player';
                    })()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(
                      [
                        { id: 'tightMark', label: 'Tight Mark (20–35% less touches)' },
                        { id: 'doubleUp', label: 'Double Up (forces early passes)' },
                        { id: 'pressOnBall', label: 'Press On Ball (presses carrier)' },
                        { id: 'showInside', label: 'Show Inside (funnels inside)' },
                        { id: 'showOutside', label: 'Show Outside (funnels wide)' },
                      ] as const
                    ).map((order) => {
                      const targetId = oppClub.squad[selectedOppSlot!];
                      const isActive =
                        targetId &&
                        (tactics.opposition?.some(
                          (o) => o.target === targetId && o.kind === order.id,
                        ) ??
                          false);
                      return (
                        <button
                          key={order.id}
                          onClick={() => {
                            if (targetId) {
                              toggleOppOrder(targetId, order.id);
                            }
                            setSelectedOppSlot(null);
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '3px',
                            backgroundColor: isActive ? 'var(--marker-red)' : 'var(--paper-2)',
                            color: isActive ? '#FFFFFF' : 'var(--paper-ink)',
                            border: '1px solid var(--paper-rule)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          {isActive ? '✓ ' : ''}
                          {order.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
