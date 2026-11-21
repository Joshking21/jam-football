// Implements SPEC §11.8 Tactics Screen (v4 3-Column Layout, SPEC 1.6 & §23 M3b Task 3)
// Reference: docs/design/tactics/README.md "v4 layout (build this)"
// Column 1 (Left): Player File (who he is) with RadarChart, or Team Sheet when nothing selected
// Column 2 (Middle): Vertical Whiteboard (68:105 ratio), Our team/Opposition tabs, With/Without ball switch, vertical bench
// Column 3 (Right): Orders (what he's told) - Team tab (5 dividers) & Player tab (roles, gives/costs, instructions with fit & clashes)
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  DefRoleId,
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
  DefInstruction,
} from '../../core/types';
import { FORMATIONS } from '../../config/formations';
import {
  ROLES,
  DEF_ROLES,
  ATT_SLOT,
  DEF_SLOT,
  getAvailableRolesForSlot,
  getAvailableAttRolesForSlot,
  computeRoleFit,
  computeDefRoleFit,
  getDefaultRoleForPos,
  getDefaultDefRoleForPos,
  ATT_ALLOW,
  DEF_ALLOW,
  ATT_PIS,
  DEF_PIS,
} from '../../config/roles';
import { Magnet } from '../components/Magnet';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
import { RadarChart } from '../components/RadarChart';
import { getAllRoleShapes } from '../../core/player/roleShapes';
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
  ChevronRight,
  ChevronDown,
  Star,
  Users,
  Eye,
  Sliders,
  Check,
  AlertTriangle,
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

  // Ball phase: 'withBall' vs 'withoutBall' (synced between board and orders)
  const [phase, setPhase] = useState<'withBall' | 'withoutBall'>('withBall');

  // Right column tab: 'team' vs 'player'
  const [ordersTab, setOrdersTab] = useState<'team' | 'player'>('team');

  // Team orders divider: 'buildup' | 'attack' | 'defend' | 'transition' | 'setpieces'
  const [activeDivider, setActiveDivider] = useState<
    'buildup' | 'attack' | 'defend' | 'transition' | 'setpieces'
  >('buildup');

  // Selection state
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [selectedBenchIndex, setSelectedBenchIndex] = useState<number | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [selectedOppSlot, setSelectedOppSlot] = useState<number | null>(null);

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  const tactics = userClub.tactics;
  const tacticsRoles = tactics.roles ?? [];
  const tacticsAttRoles = tactics.attRoles ?? tacticsRoles;
  const tacticsDefRoles = tactics.defRoles ?? [];
  const tacticsPIs = tactics.playerInstructions ?? [];
  const tacticsAttPIs = tactics.attInstructions ?? tacticsPIs;
  const tacticsDefPIs = tactics.defInstructions ?? [];

  const formationDef = FORMATIONS[tactics.formation] ?? FORMATIONS['4-4-2'];
  const familiarity = userClub.familiarity ?? {
    formation: { [tactics.formation]: 65 },
    mentality: { [tactics.instructions.mentality]: 70 },
    passing: { [tactics.instructions.passing]: 75 },
    pressing: { [tactics.instructions.pressing]: 68 },
  };

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

  // World role shapes (cached)
  const worldPlayers = useMemo(
    () => Object.values(gameState.players) as Player[],
    [gameState.players],
  );
  const roleShapes = useMemo(() => getAllRoleShapes(worldPlayers), [worldPlayers]);

  // Validation
  const validation = validateLineup(tactics, gameState.players);

  // Helper to get player by id
  const getPlayer = (id: string | null | undefined): Player | undefined => {
    return id ? gameState.players[id] : undefined;
  };

  // Switch right column to player tab when slot selected
  const handleSelectSlot = (slotIndex: number | null) => {
    setSelectedSlot(slotIndex);
    if (slotIndex !== null) {
      setOrdersTab('player');
    } else {
      setOrdersTab('team');
    }
  };

  // Global Keyboard Navigation (SPEC §11.0 & §11.8)
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
        handleSelectSlot(null);
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
      handleSelectSlot(null);
      showToast('Swapped bench player into starting XI', 'info');
    } else if (selectedSlot === null) {
      // Open player file
      handleSelectSlot(slotIndex);
    } else if (selectedSlot === slotIndex) {
      // Repeated click keeps selection
      handleSelectSlot(slotIndex);
    } else {
      // Swap starter slot A with starter slot B
      swapLineupSlots(selectedSlot, slotIndex);
      handleSelectSlot(null);
      showToast('Swapped player positions', 'info');
    }
  };

  const handleBenchClick = (benchIndex: number) => {
    if (selectedSlot !== null) {
      // Pitch -> Bench swap
      swapLineupWithBench(selectedSlot, benchIndex);
      handleSelectSlot(null);
      setSelectedBenchIndex(null);
      showToast('Swapped player to bench', 'info');
    } else {
      setSelectedBenchIndex(selectedBenchIndex === benchIndex ? null : benchIndex);
    }
  };

  // Selected player for file and orders
  const selectedStarterId = selectedSlot !== null ? tactics.lineup[selectedSlot] : null;
  const selectedPlayer = getPlayer(selectedStarterId);
  const selectedSlotDef = selectedSlot !== null ? formationDef.slots[selectedSlot] : null;

  // Drag over player for comparison
  const dragOverPlayer =
    dragOverSlot !== null && dragOverSlot !== selectedSlot
      ? getPlayer(tactics.lineup[dragOverSlot])
      : null;

  // Available roles for selected slot
  const availableAttRoles = selectedSlotDef
    ? getAvailableAttRolesForSlot(selectedSlotDef.position)
    : [];
  const currentAttRoleId =
    selectedSlot !== null
      ? (tacticsAttRoles[selectedSlot] ?? getDefaultRoleForPos(selectedSlotDef?.position ?? 'CM'))
      : 'cm';
  const currentDefRoleId =
    selectedSlot !== null
      ? (tacticsDefRoles[selectedSlot] ??
        getDefaultDefRoleForPos(selectedSlotDef?.position ?? 'CM'))
      : 'cm_press';

  // Role need shape for radar chart
  const currentRoleShape = useMemo(() => {
    if (phase === 'withBall') {
      return roleShapes.att[currentAttRoleId] ?? [60, 60, 60, 60, 60, 60];
    } else {
      return roleShapes.def[currentDefRoleId] ?? [60, 60, 60, 60, 60, 60];
    }
  }, [phase, currentAttRoleId, currentDefRoleId, roleShapes]);

  // Set active plan (A, B, C)
  const handleSelectPlan = (planIdx: number) => {
    updateUserTactics({ activePlan: planIdx as 0 | 1 | 2 });
    showToast(`Switched to Plan ${['A', 'B', 'C'][planIdx]}`, 'info');
  };

  // Toggle attacking instruction
  const toggleAttInstruction = (inst: PlayerInstruction) => {
    if (selectedSlot === null) return;
    let current = [...(tacticsAttPIs[selectedSlot] ?? [])];
    const idx = current.indexOf(inst);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      const info = ATT_PIS[inst];
      const clashes = info?.clashesWith ?? [];
      current = current.filter((p) => !clashes.includes(p));
      if (current.length >= 2) {
        showToast('Max 2 attacking instructions per player', 'warning');
        return;
      }
      current.push(inst);
    }
    const nextAll = Array.from({ length: 11 }, (_, i) =>
      i === selectedSlot ? current : [...(tacticsAttPIs[i] ?? [])],
    );
    updateUserTactics({ attInstructions: nextAll });
  };

  // Toggle defensive instruction
  const toggleDefInstruction = (inst: DefInstruction) => {
    if (selectedSlot === null) return;
    let current = [...(tacticsDefPIs[selectedSlot] ?? [])];
    const idx = current.indexOf(inst);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current = [inst]; // max 1 per player
    }
    const nextAll = Array.from({ length: 11 }, (_, i) =>
      i === selectedSlot ? current : [...(tacticsDefPIs[i] ?? [])],
    );
    updateUserTactics({ defInstructions: nextAll });
  };

  // Change attacking role
  const handleSetAttRole = (roleId: RoleId) => {
    if (selectedSlot === null) return;
    const next = [...tacticsAttRoles];
    next[selectedSlot] = roleId;
    updateUserTactics({ attRoles: next });
  };

  // Change defensive role
  const handleSetDefRole = (roleId: DefRoleId) => {
    if (selectedSlot === null) return;
    const next = [...tacticsDefRoles];
    next[selectedSlot] = roleId;
    updateUserTactics({ defRoles: next });
  };

  // Opposition order toggle
  const toggleOppOrder = (
    target: PlayerId,
    kind: 'tightMark' | 'doubleUp' | 'pressOnBall' | 'showInside' | 'showOutside',
  ) => {
    const orders = [...(tactics.opposition ?? [])];
    const existingIdx = orders.findIndex((o) => o.target === target && o.kind === kind);

    if (existingIdx >= 0) {
      orders.splice(existingIdx, 1);
    } else {
      if (orders.length >= 3) {
        showToast('Maximum 3 opposition orders allowed (SPEC §13.17.3)', 'warning');
        return;
      }
      orders.push({ kind, target });
    }
    updateUserTactics({ opposition: orders });
  };

  // Starters list
  const starters = formationDef.slots.map((slotDef) => {
    const pId = tactics.lineup[slotDef.slot];
    const p = getPlayer(pId);
    const primOvr = p ? getPrimaryOvr(p) : 70;
    const slotOvr = p ? ovrAt(p, slotDef.position) : 70;
    return {
      slotDef,
      player: p,
      slotOvr,
      isNatural: slotOvr >= primOvr - 2,
    };
  });

  // Bench list
  const benchPlayers = (tactics.bench ?? []).map((pId, idx) => {
    const p = getPlayer(pId);
    return {
      idx,
      player: p,
      primaryOvr: p ? getPrimaryOvr(p) : 70,
    };
  });

  // Active plan index
  const activePlanIdx = tactics.activePlan ?? 0;
  const plans = tactics.plans ?? [
    { name: 'Club style' },
    { name: 'Chasing game' },
    { name: 'Protect lead' },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(330px, 1fr) auto minmax(360px, 1.1fr)',
        gap: '16px',
        height: 'calc(100vh - 56px)',
        padding: '16px 20px',
        backgroundColor: 'var(--desk)',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* ============================================================== */}
      {/* COLUMN 1 (LEFT): WHO HE IS (The File or Team Sheet)           */}
      {/* ============================================================== */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflowY: 'auto',
          paddingRight: '4px',
        }}
      >
        {selectedPlayer && selectedSlotDef ? (
          /* 1A: PLAYER FILE (Selected Player) */
          <div
            className="settle-spring"
            style={{
              backgroundColor: 'var(--paper)',
              color: 'var(--paper-ink)',
              borderRadius: 'var(--radius-s)',
              padding: '20px',
              boxShadow: 'var(--shadow-paper)',
              border: '1px solid var(--paper-rule)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Manila Header Tab */}
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
                <span
                  style={{
                    backgroundColor: '#D9C9A3',
                    color: '#2B2317',
                    padding: '3px 8px',
                    borderRadius: '3px 3px 0 0',
                    fontWeight: 700,
                    fontSize: '11px',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  DOSSIER #{selectedPlayer.id}
                </span>
                <h2
                  style={{
                    fontFamily: 'var(--font-head)',
                    fontSize: '22px',
                    margin: '6px 0 0',
                    lineHeight: 1.1,
                  }}
                >
                  {selectedPlayer.firstName} {selectedPlayer.lastName}
                </h2>
                <div style={{ fontSize: '13px', color: 'var(--paper-dim)' }}>
                  {selectedSlotDef.role} · Age {selectedPlayer.age} · {selectedPlayer.foot} Footed
                </div>
              </div>

              <button
                onClick={() => handleSelectSlot(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: 'var(--paper-dim)',
                }}
                title="Return to Team Sheet (Esc)"
              >
                <X size={20} />
              </button>
            </div>

            {/* Condition & Morale Bars */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                fontSize: '12px',
              }}
            >
              <div>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}
                >
                  <span style={{ fontWeight: 600 }}>Condition</span>
                  <span>{selectedPlayer.condition}%</span>
                </div>
                <div
                  style={{
                    height: '6px',
                    background: '#E5E7EB',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${selectedPlayer.condition}%`,
                      backgroundColor: selectedPlayer.condition > 80 ? 'var(--win)' : 'var(--warn)',
                    }}
                  />
                </div>
              </div>
              <div>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}
                >
                  <span style={{ fontWeight: 600 }}>Morale</span>
                  <span>{selectedPlayer.morale}%</span>
                </div>
                <div
                  style={{
                    height: '6px',
                    background: '#E5E7EB',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${selectedPlayer.morale}%`,
                      backgroundColor: 'var(--gold)',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* RadarChart: His shape vs Role Need */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                className="broadcast-label"
                style={{
                  color: 'var(--paper-dim)',
                  fontSize: '11px',
                  marginBottom: '8px',
                  alignSelf: 'flex-start',
                }}
              >
                TACTICAL RADAR · {phase === 'withBall' ? 'ATTACKING NEED' : 'DEFENSIVE NEED'}
              </div>
              <RadarChart
                player={selectedPlayer}
                roleShape={currentRoleShape}
                comparePlayer={dragOverPlayer}
                size={220}
              />
              <div
                style={{
                  display: 'flex',
                  gap: '14px',
                  fontSize: '11px',
                  color: 'var(--paper-dim)',
                  marginTop: '8px',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#1D4ED8',
                      borderRadius: '50%',
                    }}
                  />
                  Player Shape
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '12px', borderTop: '2px dashed #DC2626' }} />
                  Role Need
                </span>
                {dragOverPlayer && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        backgroundColor: '#6B7280',
                        borderRadius: '50%',
                      }}
                    />
                    {dragOverPlayer.lastName}
                  </span>
                )}
              </div>
            </div>

            {/* Compact Attributes (2 columns of 20px rows) */}
            <div>
              <div
                className="broadcast-label"
                style={{
                  color: 'var(--paper-dim)',
                  fontSize: '11px',
                  marginBottom: '6px',
                  borderTop: '1px solid var(--paper-rule)',
                  paddingTop: '10px',
                }}
              >
                KEY ATTRIBUTES
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '6px 14px',
                  fontSize: '12px',
                }}
              >
                {[
                  { name: 'Pace', val: selectedPlayer.attributes.pace },
                  { name: 'Finishing', val: selectedPlayer.attributes.finishing },
                  { name: 'Passing', val: selectedPlayer.attributes.passing },
                  { name: 'Tackling', val: selectedPlayer.attributes.tackling },
                  { name: 'Dribbling', val: selectedPlayer.attributes.dribbling },
                  { name: 'Positioning', val: selectedPlayer.attributes.positioning },
                  { name: 'Work Rate', val: selectedPlayer.attributes.workRate },
                  { name: 'Stamina', val: selectedPlayer.attributes.stamina },
                  { name: 'Strength', val: selectedPlayer.attributes.strength },
                  { name: 'Composure', val: selectedPlayer.attributes.composure },
                ].map(({ name, val }) => (
                  <div
                    key={name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      height: '20px',
                    }}
                  >
                    <span>{name}</span>
                    <span
                      style={{
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        color:
                          val >= 75 ? 'var(--win)' : val >= 65 ? 'var(--paper-ink)' : 'var(--warn)',
                      }}
                    >
                      {val}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Season Stats Row */}
            <div
              style={{
                borderTop: '1px solid var(--paper-rule)',
                paddingTop: '10px',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                textAlign: 'center',
                fontSize: '12px',
              }}
            >
              <div>
                <div style={{ color: 'var(--paper-dim)', fontSize: '10px' }}>APPS</div>
                <div style={{ fontWeight: 700 }}>{selectedPlayer.stats.apps}</div>
              </div>
              <div>
                <div style={{ color: 'var(--paper-dim)', fontSize: '10px' }}>GOALS</div>
                <div style={{ fontWeight: 700 }}>{selectedPlayer.stats.goals}</div>
              </div>
              <div>
                <div style={{ color: 'var(--paper-dim)', fontSize: '10px' }}>ASSISTS</div>
                <div style={{ fontWeight: 700 }}>{selectedPlayer.stats.assists}</div>
              </div>
              <div>
                <div style={{ color: 'var(--paper-dim)', fontSize: '10px' }}>AVG RTG</div>
                <div style={{ fontWeight: 700 }}>
                  {selectedPlayer.stats.ratedApps > 0
                    ? (selectedPlayer.stats.ratingSum / selectedPlayer.stats.ratedApps).toFixed(1)
                    : '—'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* 1B: TEAM SHEET (When Nothing Selected) */
          <div
            className="settle-spring"
            style={{
              backgroundColor: 'var(--paper)',
              color: 'var(--paper-ink)',
              borderRadius: 'var(--radius-s)',
              padding: '18px',
              boxShadow: 'var(--shadow-paper)',
              border: '1px solid var(--paper-rule)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {/* Plans A / B / C Tabs */}
            <div>
              <div
                className="broadcast-label"
                style={{ color: 'var(--paper-dim)', fontSize: '10px', marginBottom: '6px' }}
              >
                TACTICAL PLAN
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {plans.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectPlan(idx)}
                    style={{
                      padding: '8px 4px',
                      borderRadius: '3px',
                      fontSize: '11px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-head)',
                      textAlign: 'center',
                      border:
                        activePlanIdx === idx ? '2px solid #1D4ED8' : '1px solid var(--paper-rule)',
                      backgroundColor: activePlanIdx === idx ? '#EFF6FF' : 'var(--paper-2)',
                      color: activePlanIdx === idx ? '#1D4ED8' : 'var(--paper-ink)',
                      cursor: 'pointer',
                    }}
                  >
                    PLAN {['A', 'B', 'C'][idx]}
                    <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--paper-dim)' }}>
                      {p.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Formation Dropdown & Familiarity Bars */}
            <div style={{ borderTop: '1px solid var(--paper-rule)', paddingTop: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <span
                  className="broadcast-label"
                  style={{ color: 'var(--paper-dim)', fontSize: '10px' }}
                >
                  FORMATION
                </span>
                <select
                  value={tactics.formation}
                  onChange={(e) => updateUserTactics({ formation: e.target.value as Formation })}
                  style={{
                    fontFamily: 'var(--font-head)',
                    fontWeight: 700,
                    fontSize: '13px',
                    padding: '4px 8px',
                    borderRadius: '3px',
                    border: '1px solid var(--paper-rule)',
                    backgroundColor: 'var(--paper-2)',
                    color: 'var(--paper-ink)',
                  }}
                >
                  {Object.keys(FORMATIONS).map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4 Familiarity Bars (Formation, Mentality, Passing, Pressing) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px 12px',
                  fontSize: '11px',
                }}
              >
                {[
                  { label: 'Formation', val: familiarity.formation[tactics.formation] ?? 65 },
                  {
                    label: 'Mentality',
                    val: familiarity.mentality[tactics.instructions.mentality] ?? 70,
                  },
                  {
                    label: 'Passing',
                    val: familiarity.passing[tactics.instructions.passing] ?? 75,
                  },
                  {
                    label: 'Pressing',
                    val: familiarity.pressing[tactics.instructions.pressing] ?? 68,
                  },
                ].map(({ label, val }) => (
                  <div
                    key={label}
                    title={val < 70 ? 'Not sharp yet. It improves every week you use it.' : ''}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '2px',
                      }}
                    >
                      <span style={{ color: val < 70 ? 'var(--warn)' : 'var(--paper-dim)' }}>
                        {label}
                      </span>
                      <span style={{ fontWeight: 600 }}>{val}%</span>
                    </div>
                    <div
                      style={{
                        height: '4px',
                        background: '#E5E7EB',
                        borderRadius: '2px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${val}%`,
                          backgroundColor: val < 70 ? 'var(--warn)' : 'var(--win)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* XI Starters List */}
            <div style={{ borderTop: '1px solid var(--paper-rule)', paddingTop: '10px' }}>
              <div
                className="broadcast-label"
                style={{ color: 'var(--paper-dim)', fontSize: '10px', marginBottom: '6px' }}
              >
                STARTING XI
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {starters.map(({ slotDef, player, slotOvr, isNatural }) => (
                  <div
                    key={slotDef.slot}
                    onMouseEnter={() => setHoveredSlot(slotDef.slot)}
                    onMouseLeave={() => setHoveredSlot(null)}
                    onClick={() => handleSelectSlot(slotDef.slot)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 8px',
                      borderRadius: '3px',
                      backgroundColor:
                        hoveredSlot === slotDef.slot ? 'var(--paper-2)' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '24px',
                          fontWeight: 700,
                          color: 'var(--paper-dim)',
                          fontSize: '10px',
                        }}
                      >
                        {slotDef.role}
                      </span>
                      <span style={{ fontWeight: 600 }}>
                        {player ? (
                          player.lastName
                        ) : (
                          <span style={{ color: 'var(--warn)' }}>Empty</span>
                        )}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {player && (
                        <span
                          style={{
                            fontWeight: 700,
                            color: isNatural ? 'var(--win)' : 'var(--warn)',
                          }}
                        >
                          {slotOvr}
                        </span>
                      )}
                      <ChevronRight size={14} color="var(--paper-dim)" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Actions: Best XI & Reset */}
            <div
              style={{
                borderTop: '1px solid var(--paper-rule)',
                paddingTop: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: validation.valid ? 'var(--win)' : 'var(--warn)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {validation.valid ? (
                  <>
                    <CheckCircle2 size={14} /> Team readiness: sharp & eligible
                  </>
                ) : (
                  <>
                    <AlertTriangle size={14} /> {validation.reason ?? 'Lineup needs attention'}
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="secondary"
                  size="s"
                  icon={<Wand2 size={14} />}
                  onClick={autoPickBestLineup}
                  style={{ flex: 1 }}
                >
                  Best XI
                </Button>
                <Button
                  variant="secondary"
                  size="s"
                  icon={<RotateCcw size={14} />}
                  onClick={() => {
                    updateUserTactics({
                      formation: userClub.style.formation,
                      instructions: {
                        mentality: userClub.style.mentality,
                        passing: userClub.style.passing,
                        tempo: userClub.style.tempo,
                        pressing: userClub.style.pressing,
                        line: userClub.style.line,
                        width: userClub.style.width,
                        focus: userClub.style.focus,
                        onLoss: userClub.style.onLoss,
                        onWin: userClub.style.onWin,
                        distribution: userClub.style.distribution,
                        cornersFor: userClub.style.cornersFor,
                        cornersAgainst: userClub.style.cornersAgainst,
                        finalThird: 'Mixed',
                        crossStyle: 'Mixed',
                        offsideTrap: false,
                        tackling: 'Mixed',
                        forceOpp: 'Mixed',
                        timeWasting: 'Never',
                        freeKicks: 'Mixed',
                        cornerSwing: 'Mixed',
                        menBack: 2,
                        postMen: 'None',
                      },
                    });
                    showToast('Reset tactics to club identity', 'info');
                  }}
                  style={{ flex: 1 }}
                >
                  Reset Style
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* COLUMN 2 (MIDDLE): THE WHITEBOARD (Vertical, 68:105 ratio)     */}
      {/* ============================================================== */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          height: '100%',
        }}
      >
        {/* Board Top Edge: Folder Tabs & Ball Switch */}
        <div
          style={{
            width: '100%',
            maxWidth: '520px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '6px',
            padding: '0 4px',
          }}
        >
          {/* Tabs: Our Team vs Opposition */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setBoardTab('us')}
              style={{
                padding: '6px 14px',
                borderRadius: '4px 4px 0 0',
                fontFamily: 'var(--font-head)',
                fontWeight: 700,
                fontSize: '12px',
                border: 'none',
                backgroundColor: boardTab === 'us' ? 'var(--board)' : 'var(--surface-2)',
                color: boardTab === 'us' ? 'var(--board-ink)' : 'var(--text-dim)',
                cursor: 'pointer',
              }}
            >
              OUR TEAM
            </button>
            <button
              onClick={() => setBoardTab('opp')}
              style={{
                padding: '6px 14px',
                borderRadius: '4px 4px 0 0',
                fontFamily: 'var(--font-head)',
                fontWeight: 700,
                fontSize: '12px',
                border: 'none',
                backgroundColor: boardTab === 'opp' ? 'var(--board)' : 'var(--surface-2)',
                color: boardTab === 'opp' ? '#DC2626' : 'var(--text-dim)',
                cursor: 'pointer',
              }}
            >
              OPPOSITION
            </button>
          </div>

          {/* With Ball / Without Ball Switch */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--surface-2)',
              borderRadius: '16px',
              padding: '2px',
            }}
          >
            <button
              onClick={() => setPhase('withBall')}
              style={{
                padding: '4px 10px',
                borderRadius: '14px',
                border: 'none',
                fontFamily: 'var(--font-head)',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: phase === 'withBall' ? '#1D4ED8' : 'transparent',
                color: phase === 'withBall' ? '#FFFFFF' : 'var(--text-dim)',
                cursor: 'pointer',
              }}
            >
              WITH BALL
            </button>
            <button
              onClick={() => setPhase('withoutBall')}
              style={{
                padding: '4px 10px',
                borderRadius: '14px',
                border: 'none',
                fontFamily: 'var(--font-head)',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: phase === 'withoutBall' ? '#1D4ED8' : 'transparent',
                color: phase === 'withoutBall' ? '#FFFFFF' : 'var(--text-dim)',
                cursor: 'pointer',
              }}
            >
              WITHOUT BALL
            </button>
          </div>
        </div>

        {/* The Whiteboard Frame */}
        <div
          style={{
            position: 'relative',
            height: 'calc(100% - 40px)',
            aspectRatio: '68 / 105',
            backgroundColor: 'var(--board, #F8F9FA)',
            borderRadius: '6px',
            border: '8px solid #94A3B8', // Aluminium frame
            boxShadow: 'var(--shadow-2), inset 0 0 16px rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}
        >
          {/* Pitch Markings SVG (680 x 1050) */}
          <svg
            viewBox="0 0 680 1050"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            {/* Outer touchline */}
            <rect
              x="20"
              y="20"
              width="640"
              height="1010"
              fill="none"
              stroke="#64748B"
              strokeWidth="2"
              opacity="0.35"
            />
            {/* Halfway line */}
            <line
              x1="20"
              y1="525"
              x2="660"
              y2="525"
              stroke="#64748B"
              strokeWidth="2"
              opacity="0.35"
            />
            {/* Center circle & spot */}
            <circle
              cx="340"
              cy="525"
              r="91.5"
              fill="none"
              stroke="#64748B"
              strokeWidth="2"
              opacity="0.35"
            />
            <circle cx="340" cy="525" r="4" fill="#64748B" opacity="0.35" />

            {/* Own Penalty Box (Bottom) */}
            <rect
              x="136"
              y="845"
              width="408"
              height="185"
              fill="none"
              stroke="#64748B"
              strokeWidth="2"
              opacity="0.35"
            />
            {/* Own 6-yard box */}
            <rect
              x="238"
              y="965"
              width="204"
              height="65"
              fill="none"
              stroke="#64748B"
              strokeWidth="2"
              opacity="0.35"
            />
            <circle cx="340" cy="915" r="4" fill="#64748B" opacity="0.35" />

            {/* Opp Penalty Box (Top) */}
            <rect
              x="136"
              y="20"
              width="408"
              height="185"
              fill="none"
              stroke="#64748B"
              strokeWidth="2"
              opacity="0.35"
            />
            {/* Opp 6-yard box */}
            <rect
              x="238"
              y="20"
              width="204"
              height="65"
              fill="none"
              stroke="#64748B"
              strokeWidth="2"
              opacity="0.35"
            />
            <circle cx="340" cy="135" r="4" fill="#64748B" opacity="0.35" />

            {/* Goal lines */}
            <rect
              x="295"
              y="1025"
              width="90"
              height="15"
              fill="none"
              stroke="#64748B"
              strokeWidth="2"
              opacity="0.35"
            />
            <rect
              x="295"
              y="10"
              width="90"
              height="15"
              fill="none"
              stroke="#64748B"
              strokeWidth="2"
              opacity="0.35"
            />

            {/* Line Marker: Sliding dashed horizontal line */}
            <g
              style={{
                transform: `translateY(${
                  tactics.instructions.line === 'High'
                    ? -60
                    : tactics.instructions.line === 'Deep'
                      ? 50
                      : 0
                }px)`,
                transition: 'transform 520ms ease',
              }}
            >
              <line
                x1="30"
                y1="820"
                x2="650"
                y2="820"
                stroke="#2563EB"
                strokeWidth="2"
                strokeDasharray="6 4"
                opacity="0.75"
              />
              <text
                x="40"
                y="814"
                fill="#2563EB"
                fontSize="12"
                fontWeight="700"
                fontFamily="var(--font-head)"
              >
                DEFENSIVE LINE {tactics.instructions.offsideTrap ? '· TRAP' : ''}
              </text>
            </g>

            {/* Pressing Marker: Sliding dashed line */}
            <g
              style={{
                transform: `translateY(${
                  tactics.instructions.pressing === 'High'
                    ? -60
                    : tactics.instructions.pressing === 'Low'
                      ? 50
                      : 0
                }px)`,
                transition: 'transform 520ms ease',
              }}
            >
              <line
                x1="30"
                y1="500"
                x2="650"
                y2="500"
                stroke="#DC2626"
                strokeWidth="2"
                strokeDasharray="6 4"
                opacity="0.75"
              />
              <text
                x="40"
                y="494"
                fill="#DC2626"
                fontSize="12"
                fontWeight="700"
                fontFamily="var(--font-head)"
              >
                PRESSING LINE
              </text>
            </g>
          </svg>

          {/* Interactive Pitch Board Magnets */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
          >
            {formationDef.slots.map((slotDef) => {
              const pId = tactics.lineup[slotDef.slot];
              const p = getPlayer(pId);
              const isSelected = selectedSlot === slotDef.slot;
              const isHovered = hoveredSlot === slotDef.slot;

              // Anchor coordinates (105x68 grid converted to percentage)
              let posX = (slotDef.anchor.y / 68) * 100;
              let posY = 100 - (slotDef.anchor.x / 105) * 100;

              // Defensive shape transformation per SPEC §13.19.6
              if (phase === 'withoutBall') {
                const normX = slotDef.anchor.x / 105;
                const defNormX = 0.07 + (normX - 0.05) * 0.62;
                posY = 100 - defNormX * 100;
              }

              const primOvr = p ? getPrimaryOvr(p) : 70;
              const slotOvr = p ? ovrAt(p, slotDef.position) : 70;
              const fitColor =
                slotOvr >= primOvr - 2
                  ? 'var(--win)'
                  : slotOvr >= primOvr - 6
                    ? 'var(--gold)'
                    : 'var(--warn)';

              return (
                <div
                  key={slotDef.slot}
                  onClick={() => handleSlotClick(slotDef.slot)}
                  onMouseEnter={() => setHoveredSlot(slotDef.slot)}
                  onMouseLeave={() => setHoveredSlot(null)}
                  style={{
                    position: 'absolute',
                    left: `${posX}%`,
                    top: `${posY}%`,
                    transform: 'translate(-50%, -50%)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    transition: 'left 420ms ease, top 420ms ease',
                    zIndex: isSelected ? 20 : 10,
                  }}
                >
                  {/* Magnet Circle (44px) */}
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: userClub.colors.primary,
                      border: `3px solid ${isSelected ? '#FFFFFF' : userClub.colors.secondary}`,
                      boxShadow: isSelected
                        ? '0 0 0 3px #1D4ED8, 0 8px 16px rgba(0,0,0,0.35)'
                        : isHovered
                          ? '0 6px 12px rgba(0,0,0,0.25)'
                          : '0 3px 6px rgba(0,0,0,0.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: userClub.colors.secondary,
                      fontFamily: 'var(--font-head)',
                      fontWeight: 700,
                      fontSize: '15px',
                      position: 'relative',
                    }}
                  >
                    <span>{slotDef.slot + 1}</span>

                    {/* OVR fit badge */}
                    {p && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '-4px',
                          right: '-4px',
                          backgroundColor: fitColor,
                          color: '#FFFFFF',
                          fontSize: '9px',
                          fontWeight: 700,
                          borderRadius: '8px',
                          padding: '1px 3px',
                          lineHeight: 1,
                        }}
                      >
                        {slotOvr}
                      </span>
                    )}
                  </div>

                  {/* Player Surname Label */}
                  <div
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-head)',
                      fontWeight: 600,
                      color: 'var(--board-ink, #0F172A)',
                      marginTop: '2px',
                      whiteSpace: 'nowrap',
                      backgroundColor: 'rgba(255, 255, 255, 0.85)',
                      padding: '1px 4px',
                      borderRadius: '2px',
                    }}
                  >
                    {p ? p.lastName : slotDef.role}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vertical Bench Strip on Right Edge */}
          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              bottom: '8px',
              width: '48px',
              backgroundColor: 'rgba(255, 255, 255, 0.75)',
              borderRadius: '4px',
              border: '1px solid rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '6px 2px',
              gap: '6px',
            }}
          >
            <span
              className="broadcast-label"
              style={{ fontSize: '9px', color: 'var(--board-ink)', opacity: 0.6 }}
            >
              BENCH
            </span>
            {benchPlayers.slice(0, 7).map(({ idx, player, primaryOvr }) => (
              <div
                key={idx}
                onClick={() => handleBenchClick(idx)}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: userClub.colors.primary,
                  border: `2px solid ${selectedBenchIndex === idx ? '#1D4ED8' : userClub.colors.secondary}`,
                  color: userClub.colors.secondary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-head)',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                }}
                title={player ? `${player.firstName} ${player.lastName} (${primaryOvr})` : 'Empty'}
              >
                {player ? player.lastName.slice(0, 3).toUpperCase() : `S${idx + 1}`}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* COLUMN 3 (RIGHT): ORDERS (Team Orders & Player Orders)        */}
      {/* ============================================================== */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflowY: 'auto',
          paddingLeft: '4px',
        }}
      >
        {/* Top Order Tabs: TEAM vs [SURNAME] */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
          <button
            onClick={() => setOrdersTab('team')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '4px 4px 0 0',
              fontFamily: 'var(--font-head)',
              fontWeight: 700,
              fontSize: '13px',
              border: 'none',
              backgroundColor: ordersTab === 'team' ? 'var(--paper)' : 'var(--surface-2)',
              color: ordersTab === 'team' ? 'var(--paper-ink)' : 'var(--text-dim)',
              cursor: 'pointer',
            }}
          >
            TEAM ORDERS
          </button>
          {selectedPlayer && (
            <button
              onClick={() => setOrdersTab('player')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '4px 4px 0 0',
                fontFamily: 'var(--font-head)',
                fontWeight: 700,
                fontSize: '13px',
                border: 'none',
                backgroundColor: ordersTab === 'player' ? 'var(--paper)' : 'var(--surface-2)',
                color: ordersTab === 'player' ? '#1D4ED8' : 'var(--text-dim)',
                cursor: 'pointer',
              }}
            >
              {selectedPlayer.lastName.toUpperCase()} ORDERS
            </button>
          )}
        </div>

        {ordersTab === 'player' && selectedPlayer && selectedSlotDef ? (
          /* 3A: PLAYER ORDERS (Roles, Gives/Costs, Player Instructions) */
          <div
            className="settle-spring"
            style={{
              backgroundColor: 'var(--paper)',
              color: 'var(--paper-ink)',
              borderRadius: 'var(--radius-s)',
              padding: '18px',
              boxShadow: 'var(--shadow-paper)',
              border: '1px solid var(--paper-rule)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {/* Header with Phase Switch */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span
                  className="broadcast-label"
                  style={{ color: 'var(--paper-dim)', fontSize: '10px' }}
                >
                  PLAYER ROLE & INSTRUCTIONS
                </span>
                <h3 style={{ margin: '2px 0 0', fontFamily: 'var(--font-head)', fontSize: '18px' }}>
                  {selectedSlotDef.role} · {selectedPlayer.lastName}
                </h3>
              </div>

              {/* Sync switch */}
              <div
                style={{
                  display: 'flex',
                  backgroundColor: '#E5E7EB',
                  borderRadius: '12px',
                  padding: '2px',
                }}
              >
                <button
                  onClick={() => setPhase('withBall')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '10px',
                    border: 'none',
                    fontSize: '10px',
                    fontWeight: 700,
                    backgroundColor: phase === 'withBall' ? '#1D4ED8' : 'transparent',
                    color: phase === 'withBall' ? '#FFFFFF' : 'var(--paper-dim)',
                    cursor: 'pointer',
                  }}
                >
                  ATTACK
                </button>
                <button
                  onClick={() => setPhase('withoutBall')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '10px',
                    border: 'none',
                    fontSize: '10px',
                    fontWeight: 700,
                    backgroundColor: phase === 'withoutBall' ? '#1D4ED8' : 'transparent',
                    color: phase === 'withoutBall' ? '#FFFFFF' : 'var(--paper-dim)',
                    cursor: 'pointer',
                  }}
                >
                  DEFENCE
                </button>
              </div>
            </div>

            {/* Role Rows with Fit Stars */}
            <div>
              <div
                className="broadcast-label"
                style={{ color: 'var(--paper-dim)', fontSize: '10px', marginBottom: '6px' }}
              >
                {phase === 'withBall' ? 'ATTACKING ROLES (§13.19.1)' : 'DEFENSIVE ROLES (§13.19.2)'}
              </div>

              {phase === 'withBall' ? (
                /* Attacking Role Choices */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {availableAttRoles.map((role) => {
                    const isCurrent = currentAttRoleId === role.id;
                    const fit = computeRoleFit(role.id, selectedPlayer.attributes);
                    return (
                      <div
                        key={role.id}
                        onClick={() => handleSetAttRole(role.id)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '4px',
                          border: isCurrent ? '2px solid #1D4ED8' : '1px solid var(--paper-rule)',
                          backgroundColor: isCurrent ? '#EFF6FF' : 'var(--paper-2)',
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>{role.name}</span>
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                size={12}
                                fill={s <= fit.stars ? 'var(--gold)' : 'transparent'}
                                color={s <= fit.stars ? 'var(--gold)' : '#CBD5E1'}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Open Role Gives / Costs */}
                        {isCurrent && (
                          <div
                            style={{
                              marginTop: '8px',
                              fontSize: '11px',
                              color: 'var(--paper-ink)',
                            }}
                          >
                            <div style={{ fontStyle: 'italic', marginBottom: '6px' }}>
                              {role.description}
                            </div>
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '8px',
                              }}
                            >
                              <div style={{ color: 'var(--win)' }}>
                                <strong>Gives you:</strong> {role.gives}
                              </div>
                              <div style={{ color: 'var(--warn)' }}>
                                <strong>Costs you:</strong> {role.costs}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Defensive Role Choices */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(DEF_SLOT[selectedSlotDef.position] ?? []).map((defId) => {
                    const defDef = DEF_ROLES[defId];
                    if (!defDef) return null;
                    const isCurrent = currentDefRoleId === defId;
                    const fit = computeDefRoleFit(selectedPlayer.attributes, defId);
                    return (
                      <div
                        key={defId}
                        onClick={() => handleSetDefRole(defId)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '4px',
                          border: isCurrent ? '2px solid #1D4ED8' : '1px solid var(--paper-rule)',
                          backgroundColor: isCurrent ? '#EFF6FF' : 'var(--paper-2)',
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>{defDef.name}</span>
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                size={12}
                                fill={s <= fit.stars ? 'var(--gold)' : 'transparent'}
                                color={s <= fit.stars ? 'var(--gold)' : '#CBD5E1'}
                              />
                            ))}
                          </div>
                        </div>

                        {isCurrent && (
                          <div
                            style={{
                              marginTop: '8px',
                              fontSize: '11px',
                              color: 'var(--paper-ink)',
                            }}
                          >
                            <div style={{ fontStyle: 'italic', marginBottom: '6px' }}>
                              {defDef.description}
                            </div>
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '8px',
                              }}
                            >
                              <div style={{ color: 'var(--win)' }}>
                                <strong>Gives you:</strong> {defDef.gives}
                              </div>
                              <div style={{ color: 'var(--warn)' }}>
                                <strong>Costs you:</strong> {defDef.costs}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Instructions Offered by Selected Role */}
            <div style={{ borderTop: '1px solid var(--paper-rule)', paddingTop: '10px' }}>
              <div
                className="broadcast-label"
                style={{ color: 'var(--paper-dim)', fontSize: '10px', marginBottom: '6px' }}
              >
                {phase === 'withBall'
                  ? `ATTACKING INSTRUCTIONS (${selectedSlot !== null ? (tacticsAttPIs[selectedSlot]?.length ?? 0) : 0}/2)`
                  : `DEFENSIVE INSTRUCTION (${selectedSlot !== null ? (tacticsDefPIs[selectedSlot]?.length ?? 0) : 0}/1)`}
              </div>

              {phase === 'withBall' ? (
                /* Attacking Instructions */
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {(ATT_ALLOW[currentAttRoleId] ?? []).map((inst) => {
                    const isActive =
                      selectedSlot !== null &&
                      (tacticsAttPIs[selectedSlot]?.includes(inst) ?? false);
                    const info = ATT_PIS[inst];
                    const label = info ? info.wording.split(':')[0] : inst;
                    return (
                      <button
                        key={inst}
                        onClick={() => toggleAttInstruction(inst)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '3px',
                          fontSize: '11px',
                          fontWeight: 600,
                          textAlign: 'left',
                          border: isActive ? '1px solid #1D4ED8' : '1px solid var(--paper-rule)',
                          backgroundColor: isActive ? '#EFF6FF' : 'var(--paper-2)',
                          color: isActive ? '#1D4ED8' : 'var(--paper-ink)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>{label}</span>
                        {isActive && <Check size={12} strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Defensive Instructions */
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {(DEF_ALLOW[currentDefRoleId] ?? []).map((inst) => {
                    const isActive =
                      selectedSlot !== null &&
                      (tacticsDefPIs[selectedSlot]?.includes(inst) ?? false);
                    const info = DEF_PIS[inst];
                    const label = info ? info.wording.split('.')[0] : inst;
                    return (
                      <button
                        key={inst}
                        onClick={() => toggleDefInstruction(inst)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '3px',
                          fontSize: '11px',
                          fontWeight: 600,
                          textAlign: 'left',
                          border: isActive ? '1px solid #1D4ED8' : '1px solid var(--paper-rule)',
                          backgroundColor: isActive ? '#EFF6FF' : 'var(--paper-2)',
                          color: isActive ? '#1D4ED8' : 'var(--paper-ink)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>{label}</span>
                        {isActive && <Check size={12} strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 3B: TEAM ORDERS (5 Dividers: Build-up, Attack, Defend, Transition, Set pieces) */
          <div
            className="settle-spring"
            style={{
              backgroundColor: 'var(--paper)',
              color: 'var(--paper-ink)',
              borderRadius: 'var(--radius-s)',
              padding: '18px',
              boxShadow: 'var(--shadow-paper)',
              border: '1px solid var(--paper-rule)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Divider Tabs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '4px',
                borderBottom: '2px solid var(--paper-rule)',
                paddingBottom: '8px',
              }}
            >
              {[
                { id: 'buildup', label: 'Build-up' },
                { id: 'attack', label: 'Attack' },
                { id: 'defend', label: 'Defend' },
                { id: 'transition', label: 'Transition' },
                { id: 'setpieces', label: 'Set Pieces' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveDivider(id as any)}
                  style={{
                    padding: '6px 2px',
                    borderRadius: '3px',
                    fontSize: '11px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-head)',
                    border: 'none',
                    backgroundColor: activeDivider === id ? '#1D4ED8' : 'var(--paper-2)',
                    color: activeDivider === id ? '#FFFFFF' : 'var(--paper-dim)',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Divider Content */}
            {activeDivider === 'buildup' && (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}
              >
                {/* Mentality */}
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>Mentality</div>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}
                  >
                    {(
                      [
                        'Very Defensive',
                        'Defensive',
                        'Balanced',
                        'Attacking',
                        'Very Attacking',
                      ] as Mentality[]
                    ).map((m) => (
                      <button
                        key={m}
                        onClick={() =>
                          updateUserTactics({
                            instructions: { ...tactics.instructions, mentality: m },
                          })
                        }
                        style={{
                          padding: '6px 2px',
                          fontSize: '10px',
                          fontWeight: 700,
                          borderRadius: '3px',
                          border:
                            tactics.instructions.mentality === m
                              ? '2px solid #1D4ED8'
                              : '1px solid var(--paper-rule)',
                          backgroundColor:
                            tactics.instructions.mentality === m ? '#EFF6FF' : 'var(--paper-2)',
                          color:
                            tactics.instructions.mentality === m ? '#1D4ED8' : 'var(--paper-ink)',
                          cursor: 'pointer',
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Passing Style */}
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>Passing Style</div>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}
                  >
                    {(['Short', 'Mixed', 'Direct'] as PassingStyle[]).map((p) => (
                      <button
                        key={p}
                        onClick={() =>
                          updateUserTactics({
                            instructions: { ...tactics.instructions, passing: p },
                          })
                        }
                        style={{
                          padding: '6px 4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '3px',
                          border:
                            tactics.instructions.passing === p
                              ? '2px solid #1D4ED8'
                              : '1px solid var(--paper-rule)',
                          backgroundColor:
                            tactics.instructions.passing === p ? '#EFF6FF' : 'var(--paper-2)',
                          color:
                            tactics.instructions.passing === p ? '#1D4ED8' : 'var(--paper-ink)',
                          cursor: 'pointer',
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tempo */}
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>Tempo</div>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}
                  >
                    {(['Slow', 'Normal', 'Fast'] as Tempo[]).map((t) => (
                      <button
                        key={t}
                        onClick={() =>
                          updateUserTactics({ instructions: { ...tactics.instructions, tempo: t } })
                        }
                        style={{
                          padding: '6px 4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '3px',
                          border:
                            tactics.instructions.tempo === t
                              ? '2px solid #1D4ED8'
                              : '1px solid var(--paper-rule)',
                          backgroundColor:
                            tactics.instructions.tempo === t ? '#EFF6FF' : 'var(--paper-2)',
                          color: tactics.instructions.tempo === t ? '#1D4ED8' : 'var(--paper-ink)',
                          cursor: 'pointer',
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Width */}
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>Width</div>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}
                  >
                    {(['Narrow', 'Normal', 'Wide'] as Width[]).map((w) => (
                      <button
                        key={w}
                        onClick={() =>
                          updateUserTactics({ instructions: { ...tactics.instructions, width: w } })
                        }
                        style={{
                          padding: '6px 4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '3px',
                          border:
                            tactics.instructions.width === w
                              ? '2px solid #1D4ED8'
                              : '1px solid var(--paper-rule)',
                          backgroundColor:
                            tactics.instructions.width === w ? '#EFF6FF' : 'var(--paper-2)',
                          color: tactics.instructions.width === w ? '#1D4ED8' : 'var(--paper-ink)',
                          cursor: 'pointer',
                        }}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeDivider === 'attack' && (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}
              >
                {/* Attacking Focus */}
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>Focus</div>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}
                  >
                    {(['Left', 'Centre', 'Right', 'Mixed'] as Focus[]).map((f) => (
                      <button
                        key={f}
                        onClick={() =>
                          updateUserTactics({ instructions: { ...tactics.instructions, focus: f } })
                        }
                        style={{
                          padding: '6px 4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '3px',
                          border:
                            tactics.instructions.focus === f
                              ? '2px solid #1D4ED8'
                              : '1px solid var(--paper-rule)',
                          backgroundColor:
                            tactics.instructions.focus === f ? '#EFF6FF' : 'var(--paper-2)',
                          color: tactics.instructions.focus === f ? '#1D4ED8' : 'var(--paper-ink)',
                          cursor: 'pointer',
                        }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Final Third */}
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>Final Third</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                    {[
                      { id: 'WorkBallIntoBox', label: 'Work into box' },
                      { id: 'HitEarlyCrosses', label: 'Early crosses' },
                      { id: 'ShootOnSight', label: 'Shoot on sight' },
                      { id: 'Mixed', label: 'Mixed' },
                    ].map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() =>
                          updateUserTactics({
                            instructions: { ...tactics.instructions, finalThird: id as any },
                          })
                        }
                        style={{
                          padding: '6px 4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '3px',
                          border:
                            tactics.instructions.finalThird === id
                              ? '2px solid #1D4ED8'
                              : '1px solid var(--paper-rule)',
                          backgroundColor:
                            tactics.instructions.finalThird === id ? '#EFF6FF' : 'var(--paper-2)',
                          color:
                            tactics.instructions.finalThird === id ? '#1D4ED8' : 'var(--paper-ink)',
                          cursor: 'pointer',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cross Style */}
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>Crosses</div>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}
                  >
                    {(['Whipped', 'Low', 'Floated', 'Mixed'] as CrossStyle[]).map((cs) => (
                      <button
                        key={cs}
                        onClick={() =>
                          updateUserTactics({
                            instructions: { ...tactics.instructions, crossStyle: cs },
                          })
                        }
                        style={{
                          padding: '6px 4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '3px',
                          border:
                            tactics.instructions.crossStyle === cs
                              ? '2px solid #1D4ED8'
                              : '1px solid var(--paper-rule)',
                          backgroundColor:
                            tactics.instructions.crossStyle === cs ? '#EFF6FF' : 'var(--paper-2)',
                          color:
                            tactics.instructions.crossStyle === cs ? '#1D4ED8' : 'var(--paper-ink)',
                          cursor: 'pointer',
                        }}
                      >
                        {cs}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeDivider === 'defend' && (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}
              >
                {/* Pressing */}
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>Pressing Line</div>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}
                  >
                    {(['Low', 'Mid', 'High'] as Pressing[]).map((pr) => (
                      <button
                        key={pr}
                        onClick={() =>
                          updateUserTactics({
                            instructions: { ...tactics.instructions, pressing: pr },
                          })
                        }
                        style={{
                          padding: '6px 4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '3px',
                          border:
                            tactics.instructions.pressing === pr
                              ? '2px solid #1D4ED8'
                              : '1px solid var(--paper-rule)',
                          backgroundColor:
                            tactics.instructions.pressing === pr ? '#EFF6FF' : 'var(--paper-2)',
                          color:
                            tactics.instructions.pressing === pr ? '#1D4ED8' : 'var(--paper-ink)',
                          cursor: 'pointer',
                        }}
                      >
                        {pr}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Defensive Line */}
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>Defensive Line</div>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}
                  >
                    {(['Deep', 'Normal', 'High'] as DefLine[]).map((dl) => (
                      <button
                        key={dl}
                        onClick={() =>
                          updateUserTactics({ instructions: { ...tactics.instructions, line: dl } })
                        }
                        style={{
                          padding: '6px 4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '3px',
                          border:
                            tactics.instructions.line === dl
                              ? '2px solid #1D4ED8'
                              : '1px solid var(--paper-rule)',
                          backgroundColor:
                            tactics.instructions.line === dl ? '#EFF6FF' : 'var(--paper-2)',
                          color: tactics.instructions.line === dl ? '#1D4ED8' : 'var(--paper-ink)',
                          cursor: 'pointer',
                        }}
                      >
                        {dl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Offside Trap */}
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>Offside Trap</div>
                    <div style={{ fontSize: '11px', color: 'var(--paper-dim)' }}>
                      Hold the line together
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={tactics.instructions.offsideTrap}
                    onChange={(e) =>
                      updateUserTactics({
                        instructions: { ...tactics.instructions, offsideTrap: e.target.checked },
                      })
                    }
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </div>

                {/* Tackling */}
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>Tackling</div>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}
                  >
                    {(['StayOnFeet', 'Mixed', 'GetStuckIn'] as Tackling[]).map((tk) => (
                      <button
                        key={tk}
                        onClick={() =>
                          updateUserTactics({
                            instructions: { ...tactics.instructions, tackling: tk },
                          })
                        }
                        style={{
                          padding: '6px 4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '3px',
                          border:
                            tactics.instructions.tackling === tk
                              ? '2px solid #1D4ED8'
                              : '1px solid var(--paper-rule)',
                          backgroundColor:
                            tactics.instructions.tackling === tk ? '#EFF6FF' : 'var(--paper-2)',
                          color:
                            tactics.instructions.tackling === tk ? '#1D4ED8' : 'var(--paper-ink)',
                          cursor: 'pointer',
                        }}
                      >
                        {tk === 'StayOnFeet'
                          ? 'Stay on feet'
                          : tk === 'GetStuckIn'
                            ? 'Get stuck in'
                            : 'Mixed'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeDivider === 'transition' && (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}
              >
                {/* On Loss */}
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>When We Lose It</div>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}
                  >
                    {(['CounterPress', 'Regroup', 'Mixed'] as OnLoss[]).map((ol) => (
                      <button
                        key={ol}
                        onClick={() =>
                          updateUserTactics({
                            instructions: { ...tactics.instructions, onLoss: ol },
                          })
                        }
                        style={{
                          padding: '6px 4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '3px',
                          border:
                            tactics.instructions.onLoss === ol
                              ? '2px solid #1D4ED8'
                              : '1px solid var(--paper-rule)',
                          backgroundColor:
                            tactics.instructions.onLoss === ol ? '#EFF6FF' : 'var(--paper-2)',
                          color:
                            tactics.instructions.onLoss === ol ? '#1D4ED8' : 'var(--paper-ink)',
                          cursor: 'pointer',
                        }}
                      >
                        {ol === 'CounterPress' ? 'Counter-press' : ol}
                      </button>
                    ))}
                  </div>
                </div>

                {/* On Win */}
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>When We Win It</div>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}
                  >
                    {(['Counter', 'KeepIt', 'Mixed'] as OnWin[]).map((ow) => (
                      <button
                        key={ow}
                        onClick={() =>
                          updateUserTactics({
                            instructions: { ...tactics.instructions, onWin: ow },
                          })
                        }
                        style={{
                          padding: '6px 4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '3px',
                          border:
                            tactics.instructions.onWin === ow
                              ? '2px solid #1D4ED8'
                              : '1px solid var(--paper-rule)',
                          backgroundColor:
                            tactics.instructions.onWin === ow ? '#EFF6FF' : 'var(--paper-2)',
                          color: tactics.instructions.onWin === ow ? '#1D4ED8' : 'var(--paper-ink)',
                          cursor: 'pointer',
                        }}
                      >
                        {ow === 'KeepIt' ? 'Hold shape' : ow}
                      </button>
                    ))}
                  </div>
                </div>

                {/* GK Distribution */}
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                    Goalkeeper Distribution
                  </div>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}
                  >
                    {(['RollOut', 'LongKick', 'QuickThrow', 'Mixed'] as Distribution[]).map((d) => (
                      <button
                        key={d}
                        onClick={() =>
                          updateUserTactics({
                            instructions: { ...tactics.instructions, distribution: d },
                          })
                        }
                        style={{
                          padding: '6px 2px',
                          fontSize: '10px',
                          fontWeight: 600,
                          borderRadius: '3px',
                          border:
                            tactics.instructions.distribution === d
                              ? '2px solid #1D4ED8'
                              : '1px solid var(--paper-rule)',
                          backgroundColor:
                            tactics.instructions.distribution === d ? '#EFF6FF' : 'var(--paper-2)',
                          color:
                            tactics.instructions.distribution === d
                              ? '#1D4ED8'
                              : 'var(--paper-ink)',
                          cursor: 'pointer',
                        }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeDivider === 'setpieces' && (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}
              >
                {/* Men Back */}
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>Men Back at Corners</div>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}
                  >
                    {([1, 2, 3] as MenBack[]).map((mb) => (
                      <button
                        key={mb}
                        onClick={() =>
                          updateUserTactics({
                            instructions: { ...tactics.instructions, menBack: mb },
                          })
                        }
                        style={{
                          padding: '6px 4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '3px',
                          border:
                            tactics.instructions.menBack === mb
                              ? '2px solid #1D4ED8'
                              : '1px solid var(--paper-rule)',
                          backgroundColor:
                            tactics.instructions.menBack === mb ? '#EFF6FF' : 'var(--paper-2)',
                          color:
                            tactics.instructions.menBack === mb ? '#1D4ED8' : 'var(--paper-ink)',
                          cursor: 'pointer',
                        }}
                      >
                        {mb} Men Back
                      </button>
                    ))}
                  </div>
                </div>

                {/* Posts */}
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>Men on the Posts</div>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}
                  >
                    {(['None', 'NearPost', 'FarPost', 'Both'] as PostMen[]).map((pm) => (
                      <button
                        key={pm}
                        onClick={() =>
                          updateUserTactics({
                            instructions: { ...tactics.instructions, postMen: pm },
                          })
                        }
                        style={{
                          padding: '6px 2px',
                          fontSize: '10px',
                          fontWeight: 600,
                          borderRadius: '3px',
                          border:
                            tactics.instructions.postMen === pm
                              ? '2px solid #1D4ED8'
                              : '1px solid var(--paper-rule)',
                          backgroundColor:
                            tactics.instructions.postMen === pm ? '#EFF6FF' : 'var(--paper-2)',
                          color:
                            tactics.instructions.postMen === pm ? '#1D4ED8' : 'var(--paper-ink)',
                          cursor: 'pointer',
                        }}
                      >
                        {pm}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
