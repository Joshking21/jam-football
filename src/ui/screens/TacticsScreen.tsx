// Implements SPEC §11.8 Tactics Screen (v5 Two-Column Sideways Layout, SPEC 1.7)
// Reference: docs/design/tactics/README.md "v5 layout (build this)" & docs/design/tactics/index.html
// Column 1 (Left): Dominant Whiteboard lying sideways (own goal left, attacking right), bench strip & injured corner under pitch, marker tray
// Column 2 (Right): Tall Panel: Clipboard when nothing selected, Player File (with RadarChart, Orders & Profile tabs) when player selected
import { MatchPlanSheet } from './Tactics/MatchPlanSheet';
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
  Attributes,
  CornerJob,
  CornerTarget,
  CornerSwingChoice,
  CentralFreeKickOption,
  WideFreeKickOption,
  DeepFreeKickOption,
  WallOption,
  LineHeightOption,
  SetPieceTactics,
  ForwardsUp,
  SetPieceTakers,
} from '../../core/types';
import { FORMATIONS } from '../../config/formations';
import {
  ROLES,
  DEF_ROLES,
  ATT_SLOT,
  DEF_SLOT,
  getAvailableAttRolesForSlot,
  getAvailableDefRolesForSlot,
  computeRoleFit,
  computeDefRoleFit,
  getDefaultRoleForPos,
  getDefaultDefRoleForPos,
  ATT_ALLOW,
  DEF_ALLOW,
  ATT_PIS,
  DEF_PIS,
  computeInstructionFit,
} from '../../config/roles';
import { RadarChart } from '../components/RadarChart';
import { getAllRoleShapes } from '../../core/player/roleShapes';
import { validateLineup } from '../../core/game/advance';
import { ovrAt, getPrimaryOvr } from '../../core/player/ratings';
import { createDefaultSetPieceTactics, generateAutoCornerJobs } from '../../core/match/setPieces';
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
  Star,
  Users,
  Eye,
  Check,
  AlertTriangle,
} from 'lucide-react';

// Pitch coordinates inside board SVG (viewBox 0 0 1050 790)
const P = { x: 34, y: 24, w: 982, h: 620 };
const BENCH_Y = 728;
const BENCH_X0 = 160;
const BENCH_DX = 86;
const TREAT_X = 966;

const JOB_INFO: Record<CornerJob, { label: string; max: number; desc: string }> = {
  nearPost: { label: 'NEAR', max: 2, desc: 'Near post header candidate' },
  farPost: { label: 'FAR', max: 2, desc: 'Far post header candidate' },
  penaltySpot: { label: 'SPOT', max: 2, desc: 'Penalty spot header candidate' },
  keeperScreen: { label: 'KEEPER', max: 1, desc: 'Screens the keeper' },
  edge: { label: 'EDGE', max: 2, desc: 'Second balls & long range shots' },
  short: { label: 'SHORT', max: 1, desc: 'Short corner option' },
  stayBack: { label: 'BACK', max: 3, desc: 'Stays back to prevent counters' },
};

const PRESETS: [
  string,
  {
    mentality: Mentality;
    passing: PassingStyle;
    tempo: Tempo;
    pressing: Pressing;
    line: DefLine;
    width: Width;
    focus: Focus;
  },
][] = [
  [
    'Park the bus',
    {
      mentality: 'Defensive',
      passing: 'Direct',
      tempo: 'Slow',
      pressing: 'Low',
      line: 'Deep',
      width: 'Narrow',
      focus: 'Centre',
    },
  ],
  [
    'Control',
    {
      mentality: 'Balanced',
      passing: 'Short',
      tempo: 'Slow',
      pressing: 'Mid',
      line: 'Normal',
      width: 'Normal',
      focus: 'Mixed',
    },
  ],
  [
    'Gegenpress',
    {
      mentality: 'Attacking',
      passing: 'Short',
      tempo: 'Fast',
      pressing: 'High',
      line: 'High',
      width: 'Normal',
      focus: 'Mixed',
    },
  ],
  [
    'Counter',
    {
      mentality: 'Defensive',
      passing: 'Direct',
      tempo: 'Fast',
      pressing: 'Low',
      line: 'Deep',
      width: 'Wide',
      focus: 'Mixed',
    },
  ],
  [
    'All-out attack',
    {
      mentality: 'Attacking',
      passing: 'Mixed',
      tempo: 'Fast',
      pressing: 'High',
      line: 'High',
      width: 'Wide',
      focus: 'Mixed',
    },
  ],
];

const ATTR_DISPLAY_NAMES: Record<string, string> = {
  pace: 'Pace',
  stamina: 'Stamina',
  strength: 'Strength',
  passing: 'Passing',
  crossing: 'Crossing',
  heading: 'Heading',
  finishing: 'Finishing',
  longShots: 'Long shots',
  tackling: 'Tackling',
  positioning: 'Positioning',
  decisions: 'Decisions',
  composure: 'Composure',
  workRate: 'Work rate',
  offTheBall: 'Off the ball',
  firstTouch: 'First touch',
  dribbling: 'Dribbling',
  oneOnOnes: 'One-on-ones',
  commandOfArea: 'Command of area',
  handling: 'Handling',
  reflexes: 'Reflexes',
  kicking: 'Kicking',
};

function getAttrColor(val: number): string {
  if (val < 40) return '#C42B2B';
  if (val < 55) return '#C8641A';
  if (val < 65) return '#B38A06';
  if (val < 75) return '#5E8F26';
  if (val < 85) return '#1E7B3C';
  return '#0B7A73';
}

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

  // Right column active divider: 'buildup' | 'attack' | 'defend' | 'transition' | 'setpieces' | 'matchplan'
  const [activeDivider, setActiveDivider] = useState<
    'buildup' | 'attack' | 'defend' | 'transition' | 'setpieces' | 'matchplan'
  >('buildup');

  // Player file sub-tab: 'orders' | 'profile'
  const [fileTab, setFileTab] = useState<'orders' | 'profile'>('orders');

  // Selection state
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [selectedBenchIndex, setSelectedBenchIndex] = useState<number | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [selectedOppSlot, setSelectedOppSlot] = useState<number | null>(null);

  // Set-piece mode state
  const [setPieceSubTab, setSetPieceSubTab] = useState<
    'ourCorners' | 'theirCorners' | 'ourFK' | 'theirFK' | 'takers'
  >('ourCorners');
  const [cornerSide, setCornerSide] = useState<'left' | 'right'>('left');
  const [routineIdx, setRoutineIdx] = useState<number>(0);
  const [editingRoutineName, setEditingRoutineName] = useState<string | null>(null);
  const [renamingText, setRenamingText] = useState<string>('');
  const [hoveredJob, setHoveredJob] = useState<CornerJob | null>(null);

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

  // Next fixture determination for opponent tab
  const targetMD = gameState.matchday === 0 ? 1 : gameState.matchday;
  const nextFixture = gameState.fixtures.find(
    (f) => f.matchday === targetMD && (f.homeId === userClub.id || f.awayId === userClub.id),
  );
  const isHome = nextFixture ? nextFixture.homeId === userClub.id : true;
  const oppClubId = nextFixture
    ? isHome
      ? nextFixture.awayId
      : nextFixture.homeId
    : (userClub.rivals[0] ?? 'c02');
  const oppClub = gameState.clubs[oppClubId] ?? Object.values(gameState.clubs)[0]!;
  const oppFormationDef = FORMATIONS[oppClub.style.formation] ?? FORMATIONS['4-4-2'];

  // Familiarity per area (§13.18.11)
  const mentalitySteps = ['VeryDefensive', 'Defensive', 'Balanced', 'Attacking', 'VeryAttacking'];
  const passingSteps = ['Short', 'Mixed', 'Direct'];
  const pressingSteps = ['Low', 'Mid', 'High'];

  const calcFamiliarity = (
    area: 'formation' | 'mentality' | 'passing' | 'pressing',
    val: string,
  ): number => {
    if (userClub.familiarity && userClub.familiarity[area]) {
      const recorded = (userClub.familiarity[area] as Record<string, number>)[val];
      if (typeof recorded === 'number') return recorded;
    }
    const clubStyle = userClub.style;
    if (area === 'formation') {
      if (val === clubStyle.formation) return 92;
      if (val.split('-')[0] === clubStyle.formation.split('-')[0]) return 68;
      return 45;
    }
    const targetVal =
      area === 'mentality'
        ? clubStyle.mentality
        : area === 'passing'
          ? clubStyle.passing
          : clubStyle.pressing;
    const list =
      area === 'mentality' ? mentalitySteps : area === 'passing' ? passingSteps : pressingSteps;
    const diff = Math.abs(list.indexOf(val) - list.indexOf(targetVal));
    return diff === 0 ? 90 : diff === 1 ? 65 : 45;
  };

  const famScores = {
    formation: calcFamiliarity('formation', tactics.formation),
    mentality: calcFamiliarity('mentality', tactics.instructions.mentality),
    passing: calcFamiliarity('passing', tactics.instructions.passing),
    pressing: calcFamiliarity('pressing', tactics.instructions.pressing),
  };

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

  // Keyboard Navigation (SPEC §11.0, §11.8)
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
      // Deselect on click again
      setSelectedSlot(null);
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
        showToast('Maximum 3 opposition orders allowed', 'warning');
        return;
      }
      if (kind === 'doubleUp' && orders.some((o) => o.kind === 'doubleUp')) {
        showToast('Only one double-up allowed per match', 'warning');
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

  // Injured players
  const injuredPlayers = Object.values(gameState.players).filter(
    (p) => p.clubId === userClub.id && p.injury !== null,
  );

  // Set-piece tactics and routines
  const setPieces: SetPieceTactics = useMemo(
    () => tactics.setPieces ?? createDefaultSetPieceTactics(),
    [tactics.setPieces],
  );

  const updateSetPieces = (updater: (sp: SetPieceTactics) => SetPieceTactics) => {
    const current = tactics.setPieces ?? createDefaultSetPieceTactics();
    const next = updater(JSON.parse(JSON.stringify(current)));
    updateUserTactics({ setPieces: next });
  };

  const activeSideRoutines = cornerSide === 'left' ? setPieces.leftCorners : setPieces.rightCorners;

  const currentRoutine = activeSideRoutines?.routines[routineIdx] ??
    activeSideRoutines?.routines[0] ?? {
      id: 'r1',
      name: 'Near-post flick',
      target: 'Near' as CornerTarget,
      swing: 'Auto' as CornerSwingChoice,
      familiarity: 70,
      jobs: {},
    };

  const assignJobToSlot = (slotIdx: number, targetJob: CornerJob) => {
    if (slotIdx <= 0 || slotIdx > 10) return;
    updateSetPieces((sp) => {
      const side = cornerSide === 'left' ? sp.leftCorners : sp.rightCorners;
      const routine = side?.routines[routineIdx];
      if (!routine) return sp;
      const currentJobs = { ...(routine.jobs ?? {}) };
      const prevJob = currentJobs[slotIdx];
      if (prevJob === targetJob) return sp;

      const maxCaps: Record<CornerJob, number> = {
        nearPost: 2,
        farPost: 2,
        penaltySpot: 2,
        keeperScreen: 1,
        edge: 2,
        short: 1,
        stayBack: 3,
      };

      const playersInJob = Object.entries(currentJobs)
        .filter(([s, j]) => j === targetJob && Number(s) !== slotIdx)
        .map(([s]) => Number(s));

      if (playersInJob.length >= maxCaps[targetJob] && playersInJob[0] !== undefined) {
        const swapSlot = playersInJob[0];
        if (prevJob) {
          currentJobs[swapSlot] = prevJob;
        } else {
          delete currentJobs[swapSlot];
        }
      }

      currentJobs[slotIdx] = targetJob;
      routine.jobs = currentJobs;
      return sp;
    });
  };

  const resetToAutoJobs = () => {
    const lineupPlayers = starters.map((s) => s.player ?? null);
    const curTarget = currentRoutine?.target ?? 'Mixed';
    const autoJobs = generateAutoCornerJobs(lineupPlayers, curTarget);
    updateSetPieces((sp) => {
      const side = cornerSide === 'left' ? sp.leftCorners : sp.rightCorners;
      const routine = side?.routines[routineIdx];
      if (routine) {
        routine.jobs = autoJobs;
      }
      return sp;
    });
  };

  const nearY = cornerSide === 'left' ? 280 : 390;
  const farY = cornerSide === 'left' ? 390 : 280;
  const shortY = cornerSide === 'left' ? 80 : 588;

  const JOB_COORDS: Record<CornerJob, { x: number; y: number }> = {
    nearPost: { x: 975, y: nearY },
    farPost: { x: 975, y: farY },
    penaltySpot: { x: 910, y: 334 },
    keeperScreen: { x: 980, y: 334 },
    edge: { x: 810, y: 334 },
    short: { x: 995, y: shortY },
    stayBack: { x: 640, y: 334 },
  };

  const isSetPieceZoomAttacking =
    activeDivider === 'setpieces' &&
    (setPieceSubTab === 'ourCorners' || setPieceSubTab === 'ourFK');
  const isSetPieceZoomDefending =
    activeDivider === 'setpieces' &&
    (setPieceSubTab === 'theirCorners' || setPieceSubTab === 'theirFK');

  // Active plan index
  const activePlanIdx = tactics.activePlan ?? 0;
  const plans = tactics.plans ?? [
    { name: 'Club style' },
    { name: 'Chasing a game' },
    { name: 'Protect a lead' },
  ];

  // Defensive line & pressing slider offsets for sideways whiteboard
  const lineX =
    tactics.instructions.line === 'High'
      ? 0.33
      : tactics.instructions.line === 'Deep'
        ? 0.16
        : 0.24;
  const pressX =
    tactics.instructions.pressing === 'High'
      ? 0.8
      : tactics.instructions.pressing === 'Low'
        ? 0.52
        : 0.65;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(400px, 34%)',
        gap: '16px',
        height: '100%',
        padding: '14px 18px',
        backgroundColor: 'var(--desk, #100E0C)',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* ============================================================== */}
      {/* COLUMN 1 (LEFT): WHITEBOARD SIDEWAYS (Dominant, 1050x790 ratio) */}
      {/* ============================================================== */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minWidth: 0,
        }}
      >
        {/* Frame Top Edge: Folder Tabs & Ball Switch (or Set Piece Tabs) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px 4px 8px',
          }}
        >
          {activeDivider === 'setpieces' ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
              }}
            >
              {/* Set Piece Mode Board Tabs (§13.20.7) */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {[
                  { id: 'ourCorners', label: 'Our Corners' },
                  { id: 'theirCorners', label: 'Their Corners' },
                  { id: 'ourFK', label: 'Our Free Kicks' },
                  { id: 'theirFK', label: 'Their Free Kicks' },
                  { id: 'takers', label: 'Takers' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setSetPieceSubTab(tab.id as any);
                      setSelectedSlot(null);
                    }}
                    style={{
                      height: '32px',
                      padding: '0 12px',
                      borderRadius: '4px 4px 0 0',
                      fontFamily: 'var(--font-head)',
                      fontWeight: 700,
                      fontSize: '12px',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      border: 'none',
                      backgroundColor:
                        setPieceSubTab === tab.id ? 'var(--paper, #EFEBE3)' : '#1C222C',
                      color: setPieceSubTab === tab.id ? 'var(--paper-ink, #1B1A17)' : '#A3ACBA',
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {setPieceSubTab === 'ourCorners' && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {/* Left / Right corner toggle */}
                  <div
                    style={{
                      display: 'flex',
                      backgroundColor: '#191613',
                      borderRadius: '14px',
                      padding: '2px',
                      border: '1px solid #2E2924',
                    }}
                  >
                    {(['left', 'right'] as const).map((side) => (
                      <button
                        key={side}
                        onClick={() => setCornerSide(side)}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          border: 'none',
                          fontFamily: 'var(--font-head)',
                          fontWeight: 700,
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          backgroundColor: cornerSide === side ? '#1F4FBF' : 'transparent',
                          color: cornerSide === side ? '#FFFFFF' : '#A3ACBA',
                        }}
                      >
                        {side}
                      </button>
                    ))}
                  </div>

                  {/* Routines 1, 2, 3 selector */}
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {[0, 1, 2].map((idx) => {
                      const side =
                        cornerSide === 'left' ? setPieces.leftCorners : setPieces.rightCorners;
                      const r = side?.routines[idx];
                      return (
                        <button
                          key={idx}
                          onClick={() => setRoutineIdx(idx)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '3px',
                            border: routineIdx === idx ? '1px solid #1F4FBF' : '1px solid #2E2924',
                            backgroundColor: routineIdx === idx ? '#1F4FBF' : '#191613',
                            color: routineIdx === idx ? '#FFFFFF' : '#A3ACBA',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {r?.name ? r.name.slice(0, 8) : `R${idx + 1}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Tabs: Our Team vs Opposition */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => {
                    setBoardTab('us');
                    setSelectedOppSlot(null);
                  }}
                  style={{
                    height: '32px',
                    padding: '0 16px',
                    borderRadius: '4px 4px 0 0',
                    fontFamily: 'var(--font-head)',
                    fontWeight: 700,
                    fontSize: '13px',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    border: 'none',
                    backgroundColor: boardTab === 'us' ? 'var(--paper, #EFEBE3)' : '#1C222C',
                    color: boardTab === 'us' ? 'var(--paper-ink, #1B1A17)' : '#A3ACBA',
                    cursor: 'pointer',
                  }}
                >
                  OUR TEAM
                </button>
                <button
                  onClick={() => {
                    setBoardTab('opp');
                    setSelectedSlot(null);
                  }}
                  style={{
                    height: '32px',
                    padding: '0 16px',
                    borderRadius: '4px 4px 0 0',
                    fontFamily: 'var(--font-head)',
                    fontWeight: 700,
                    fontSize: '13px',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    border: 'none',
                    backgroundColor: boardTab === 'opp' ? 'var(--paper, #EFEBE3)' : '#1C222C',
                    color: boardTab === 'opp' ? '#C42B2B' : '#A3ACBA',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>OPPOSITION</span>
                  <span
                    style={{
                      fontSize: '11px',
                      backgroundColor: boardTab === 'opp' ? '#C42B2B' : 'rgba(255,255,255,0.15)',
                      color: '#FFFFFF',
                      padding: '1px 5px',
                      borderRadius: '10px',
                    }}
                  >
                    {tactics.opposition?.length ?? 0}/3
                  </span>
                </button>
              </div>

              {/* With Ball / Without Ball Switch */}
              {boardTab === 'us' && (
                <div
                  style={{
                    display: 'flex',
                    backgroundColor: '#191613',
                    borderRadius: '16px',
                    padding: '2px',
                    border: '1px solid #2E2924',
                  }}
                >
                  <button
                    onClick={() => setPhase('withBall')}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '14px',
                      border: 'none',
                      fontFamily: 'var(--font-head)',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      backgroundColor: phase === 'withBall' ? '#1F4FBF' : 'transparent',
                      color: phase === 'withBall' ? '#FFFFFF' : '#A3ACBA',
                      cursor: 'pointer',
                      transition: 'background-color 140ms ease',
                    }}
                  >
                    WITH BALL
                  </button>
                  <button
                    onClick={() => setPhase('withoutBall')}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '14px',
                      border: 'none',
                      fontFamily: 'var(--font-head)',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      backgroundColor: phase === 'withoutBall' ? '#1F4FBF' : 'transparent',
                      color: phase === 'withoutBall' ? '#FFFFFF' : '#A3ACBA',
                      cursor: 'pointer',
                      transition: 'background-color 140ms ease',
                    }}
                  >
                    WITHOUT BALL
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* The Whiteboard Frame (Sideways: 1050 / 790 aspect ratio) */}
        <div
          style={{
            position: 'relative',
            flex: 1,
            aspectRatio: '1050 / 790',
            backgroundColor: 'var(--board, #E9ECEA)',
            borderRadius: '6px',
            border: '10px solid #9AA1A8',
            boxShadow: '0 1px 0 rgba(0,0,0,0.25), 0 10px 24px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          }}
        >
          {/* Zoomable pitch and magnets container (§13.20.7) */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              transformOrigin: isSetPieceZoomAttacking
                ? '88% 45%'
                : isSetPieceZoomDefending
                  ? '12% 45%'
                  : '50% 50%',
              transform: isSetPieceZoomAttacking
                ? 'scale(1.52)'
                : isSetPieceZoomDefending
                  ? 'scale(1.52)'
                  : 'scale(1)',
              transition: 'transform 480ms cubic-bezier(.2,.8,.2,1)',
            }}
          >
            {/* Pitch Markings SVG (1050 x 790) */}
            <svg
              viewBox="0 0 1050 790"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            >
              {/* Outer touchline (982 x 620) */}
              <rect
                x={P.x}
                y={P.y}
                width={P.w}
                height={P.h}
                fill="none"
                stroke="#1E2A38"
                strokeWidth="3"
                strokeOpacity="0.35"
                strokeLinecap="round"
              />

              {/* Halfway line */}
              <line
                x1={P.x + P.w / 2}
                y1={P.y}
                x2={P.x + P.w / 2}
                y2={P.y + P.h}
                stroke="#1E2A38"
                strokeWidth="3"
                strokeOpacity="0.35"
                strokeLinecap="round"
              />

              {/* Center circle & spot */}
              <circle
                cx={P.x + P.w / 2}
                cy={P.y + P.h / 2}
                r={P.h * 0.135}
                fill="none"
                stroke="#1E2A38"
                strokeWidth="3"
                strokeOpacity="0.35"
              />
              <circle
                cx={P.x + P.w / 2}
                cy={P.y + P.h / 2}
                r="3"
                fill="#1E2A38"
                fillOpacity="0.4"
              />

              {/* Left Penalty Area (Own Goal: 154 x 366) */}
              <rect
                x={P.x}
                y={P.y + P.h / 2 - (P.h * 0.59) / 2}
                width={P.w * 0.157}
                height={P.h * 0.59}
                fill="none"
                stroke="#1E2A38"
                strokeWidth="3"
                strokeOpacity="0.35"
                strokeLinecap="round"
              />
              {/* Left 6-yard box (51 x 168) */}
              <rect
                x={P.x}
                y={P.y + P.h / 2 - (P.h * 0.27) / 2}
                width={P.w * 0.052}
                height={P.h * 0.27}
                fill="none"
                stroke="#1E2A38"
                strokeWidth="3"
                strokeOpacity="0.35"
                strokeLinecap="round"
              />
              <circle
                cx={P.x + P.w * 0.105}
                cy={P.y + P.h / 2}
                r="3"
                fill="#1E2A38"
                fillOpacity="0.4"
              />
              <path
                d={`M ${P.x + P.w * 0.157} ${P.y + P.h / 2 - P.h * 0.11} A ${P.h * 0.135} ${P.h * 0.135} 0 0 1 ${P.x + P.w * 0.157} ${P.y + P.h / 2 + P.h * 0.11}`}
                fill="none"
                stroke="#1E2A38"
                strokeWidth="3"
                strokeOpacity="0.35"
              />

              {/* Right Penalty Area (Opp Goal: 154 x 366) */}
              <rect
                x={P.x + P.w - P.w * 0.157}
                y={P.y + P.h / 2 - (P.h * 0.59) / 2}
                width={P.w * 0.157}
                height={P.h * 0.59}
                fill="none"
                stroke="#1E2A38"
                strokeWidth="3"
                strokeOpacity="0.35"
                strokeLinecap="round"
              />
              {/* Right 6-yard box */}
              <rect
                x={P.x + P.w - P.w * 0.052}
                y={P.y + P.h / 2 - (P.h * 0.27) / 2}
                width={P.w * 0.052}
                height={P.h * 0.27}
                fill="none"
                stroke="#1E2A38"
                strokeWidth="3"
                strokeOpacity="0.35"
                strokeLinecap="round"
              />
              <circle
                cx={P.x + P.w * 0.895}
                cy={P.y + P.h / 2}
                r="3"
                fill="#1E2A38"
                fillOpacity="0.4"
              />
              <path
                d={`M ${P.x + P.w - P.w * 0.157} ${P.y + P.h / 2 - P.h * 0.11} A ${P.h * 0.135} ${P.h * 0.135} 0 0 0 ${P.x + P.w - P.w * 0.157} ${P.y + P.h / 2 + P.h * 0.11}`}
                fill="none"
                stroke="#1E2A38"
                strokeWidth="3"
                strokeOpacity="0.35"
              />

              {/* Bench Divider Dashed Line */}
              <line
                x1={P.x}
                y1={P.y + P.h + 26}
                x2={P.x + P.w}
                y2={P.y + P.h + 26}
                stroke="#1E2A38"
                strokeWidth="2"
                strokeDasharray="4 8"
                strokeOpacity="0.25"
              />

              {/* Bench Labels */}
              <text
                x={P.x + 8}
                y={BENCH_Y + 6}
                fill="#1E2A38"
                fillOpacity="0.55"
                fontFamily="var(--font-head)"
                fontSize="18"
                fontWeight="700"
                letterSpacing="0.08em"
              >
                BENCH
              </text>
              <line
                x1={TREAT_X - 60}
                y1={P.y + P.h + 32}
                x2={TREAT_X - 60}
                y2={BENCH_Y + 28}
                stroke="#1E2A38"
                strokeWidth="1.5"
                strokeOpacity="0.2"
              />
              <text
                x={TREAT_X - 44}
                y={P.y + P.h + 20}
                fill="#C42B2B"
                fillOpacity="0.65"
                fontFamily="var(--font-head)"
                fontSize="16"
                fontWeight="700"
                letterSpacing="0.06em"
              >
                INJURED
              </text>

              {boardTab === 'us' && (
                <>
                  {/* Defensive Line: Vertical dashed blue line sliding left-right */}
                  <g
                    style={{
                      transform: `translateX(${(P.x + lineX * P.w).toFixed(0)}px)`,
                      transition: 'transform 520ms cubic-bezier(.2,.8,.2,1)',
                    }}
                  >
                    <line
                      x1="0"
                      y1={P.y + 16}
                      x2="0"
                      y2={P.y + P.h - 16}
                      stroke="#1F4FBF"
                      strokeWidth="3"
                      strokeDasharray="12 10"
                      strokeOpacity="0.65"
                    />
                    <text
                      x="10"
                      y={P.y + 36}
                      fill="#1F4FBF"
                      fontFamily="var(--font-head)"
                      fontSize="18"
                      fontWeight="700"
                      letterSpacing="0.06em"
                    >
                      {tactics.instructions.offsideTrap ? 'LINE · TRAP' : 'LINE'}
                    </text>
                  </g>

                  {/* Pressing Line: Vertical dashed red line sliding left-right */}
                  <g
                    style={{
                      transform: `translateX(${(P.x + pressX * P.w).toFixed(0)}px)`,
                      transition: 'transform 520ms cubic-bezier(.2,.8,.2,1)',
                    }}
                  >
                    <line
                      x1="0"
                      y1={P.y + 16}
                      x2="0"
                      y2={P.y + P.h - 16}
                      stroke="#C42B2B"
                      strokeWidth="3"
                      strokeDasharray="12 10"
                      strokeOpacity="0.65"
                    />
                    <text
                      x="10"
                      y={P.y + 36}
                      fill="#C42B2B"
                      fontFamily="var(--font-head)"
                      fontSize="18"
                      fontWeight="700"
                      letterSpacing="0.06em"
                    >
                      PRESS
                    </text>
                  </g>

                  {/* Width Arrows on sidelines */}
                  {phase === 'withBall' && tactics.instructions.width === 'Wide' && (
                    <g
                      stroke="#1F4FBF"
                      strokeWidth="3"
                      strokeLinecap="round"
                      fill="none"
                      opacity="0.6"
                    >
                      {/* Top flank outward */}
                      <path d={`M 525 80 L 525 40 M 517 48 L 525 40 L 533 48`} />
                      {/* Bottom flank outward */}
                      <path d={`M 525 588 L 525 628 M 517 620 L 525 628 L 533 620`} />
                    </g>
                  )}
                  {phase === 'withBall' && tactics.instructions.width === 'Narrow' && (
                    <g
                      stroke="#1F4FBF"
                      strokeWidth="3"
                      strokeLinecap="round"
                      fill="none"
                      opacity="0.6"
                    >
                      {/* Top flank inward */}
                      <path d={`M 525 40 L 525 80 M 517 72 L 525 80 L 533 72`} />
                      {/* Bottom flank inward */}
                      <path d={`M 525 628 L 525 588 M 517 596 L 525 588 L 533 596`} />
                    </g>
                  )}

                  {/* Focus Arrow */}
                  {phase === 'withBall' && tactics.instructions.focus !== 'Mixed' && (
                    <g
                      stroke="#1F4FBF"
                      strokeWidth="3"
                      strokeLinecap="round"
                      fill="none"
                      opacity="0.7"
                    >
                      {tactics.instructions.focus === 'Left' && (
                        <path d={`M 720 120 L 860 120 M 850 112 L 860 120 L 850 128`} />
                      )}
                      {tactics.instructions.focus === 'Centre' && (
                        <path d={`M 720 334 L 860 334 M 850 326 L 860 334 L 850 342`} />
                      )}
                      {tactics.instructions.focus === 'Right' && (
                        <path d={`M 720 548 L 860 548 M 850 540 L 860 548 L 850 556`} />
                      )}
                    </g>
                  )}
                </>
              )}

              {/* Opposition Lines & Orders */}
              {boardTab === 'opp' && (
                <>
                  {/* Active Opposition Orders lines */}
                  {(tactics.opposition ?? []).map((order, oIdx) => {
                    const oppXI = oppFormationDef.slots;
                    const targetSlotIdx =
                      oppXI.findIndex((s) => tactics.lineup[s.slot] === order.target) || 0;
                    const targetSlot = oppXI[targetSlotIdx] ?? oppXI[0]!;
                    const tx = P.x + (1 - targetSlot.anchor.x / 105) * P.w;
                    const ty = P.y + (1 - targetSlot.anchor.y / 68) * P.h;

                    return (
                      <g key={oIdx}>
                        <line
                          x1={tx - 40}
                          y1={ty}
                          x2={tx}
                          y2={ty}
                          stroke="#C42B2B"
                          strokeWidth="3"
                          strokeDasharray="6 4"
                        />
                        <rect
                          x={tx + 24}
                          y={ty - 14}
                          width="46"
                          height="20"
                          rx="3"
                          fill="#C42B2B"
                        />
                        <text
                          x={tx + 47}
                          y={ty}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#FFFFFF"
                          fontFamily="var(--font-head)"
                          fontSize="12"
                          fontWeight="700"
                        >
                          {order.kind === 'doubleUp'
                            ? '×2'
                            : order.kind === 'tightMark'
                              ? 'TIGHT'
                              : order.kind === 'pressOnBall'
                                ? 'PRESS'
                                : order.kind === 'showInside'
                                  ? 'IN'
                                  : 'OUT'}
                        </text>
                      </g>
                    );
                  })}
                </>
              )}
              {/* Set Pieces SVG Markings (§13.20.7) */}
              {activeDivider === 'setpieces' && (
                <>
                  <defs>
                    <marker
                      id="chalk-arrow-delivery"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 9 5 L 0 9 z" fill="#1F4FBF" />
                    </marker>
                    <marker
                      id="chalk-arrow-run"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 9 5 L 0 9 z" fill="#4B5563" />
                    </marker>
                    <marker
                      id="chalk-arrow-shot"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 9 5 L 0 9 z" fill="#D97706" />
                    </marker>
                  </defs>

                  {setPieceSubTab === 'ourCorners' && (
                    <>
                      {/* Delivery Arc */}
                      {(() => {
                        const flagX = 1016;
                        const flagY = cornerSide === 'left' ? 26 : 642;
                        let targetX = 945;
                        let targetY = 334;
                        if (currentRoutine.target === 'Near') {
                          targetX = 975;
                          targetY = nearY;
                        } else if (currentRoutine.target === 'Far') {
                          targetX = 975;
                          targetY = farY;
                        } else if (currentRoutine.target === 'Spot') {
                          targetX = 910;
                          targetY = 334;
                        } else if (currentRoutine.target === 'Short') {
                          targetX = 995;
                          targetY = shortY;
                        }

                        const midX = (flagX + targetX) / 2;
                        const midY = (flagY + targetY) / 2;
                        const isIn =
                          currentRoutine.swing === 'In' ||
                          (currentRoutine.swing === 'Auto' && cornerSide === 'left');
                        const ctrlOffset = isIn
                          ? cornerSide === 'left'
                            ? 40
                            : -40
                          : cornerSide === 'left'
                            ? -60
                            : 60;
                        const ctrlX = midX - 25;
                        const ctrlY = midY + ctrlOffset;

                        return (
                          <g>
                            <path
                              d={`M ${flagX} ${flagY} Q ${ctrlX} ${ctrlY} ${targetX} ${targetY}`}
                              fill="none"
                              stroke="#1F4FBF"
                              strokeWidth="3.5"
                              strokeDasharray="6 4"
                              markerEnd="url(#chalk-arrow-delivery)"
                            />
                            <circle cx={flagX} cy={flagY} r="5" fill="#1F4FBF" />
                            <text
                              x={midX - 10}
                              y={midY + (cornerSide === 'left' ? -15 : 25)}
                              fill="#1F4FBF"
                              fontSize="11"
                              fontWeight="700"
                              fontFamily="var(--font-head)"
                            >
                              {currentRoutine.target.toUpperCase()} DELIVERY (
                              {currentRoutine.swing.toUpperCase()})
                            </text>
                          </g>
                        );
                      })()}

                      {/* Run Arrows */}
                      <g>
                        <line
                          x1="860"
                          y1={nearY}
                          x2="945"
                          y2={nearY}
                          stroke="#4B5563"
                          strokeWidth="2.5"
                          strokeDasharray="5 4"
                          markerEnd="url(#chalk-arrow-run)"
                        />
                        <line
                          x1="860"
                          y1={farY}
                          x2="945"
                          y2={farY}
                          stroke="#4B5563"
                          strokeWidth="2.5"
                          strokeDasharray="5 4"
                          markerEnd="url(#chalk-arrow-run)"
                        />
                        <line
                          x1="790"
                          y1="334"
                          x2="880"
                          y2="334"
                          stroke="#4B5563"
                          strokeWidth="2.5"
                          strokeDasharray="5 4"
                          markerEnd="url(#chalk-arrow-run)"
                        />
                      </g>

                      {/* Second Ball Shot Line from Edge of Box */}
                      <g>
                        <line
                          x1="810"
                          y1="334"
                          x2="1010"
                          y2="334"
                          stroke="#D97706"
                          strokeWidth="2.5"
                          strokeDasharray="6 4"
                          markerEnd="url(#chalk-arrow-shot)"
                        />
                        <text
                          x="880"
                          y="324"
                          fill="#D97706"
                          fontSize="11"
                          fontWeight="700"
                          fontFamily="var(--font-head)"
                          letterSpacing="0.06em"
                        >
                          EDGE SHOT / RECYCLE
                        </text>
                      </g>

                      {/* Interactive Job Circles (§13.20.7) */}
                      {(Object.keys(JOB_COORDS) as CornerJob[]).map((job) => {
                        const coord = JOB_COORDS[job];
                        const info = JOB_INFO[job];
                        const count = Object.values(currentRoutine?.jobs ?? {}).filter(
                          (j) => j === job,
                        ).length;
                        const isFull = count >= info.max;
                        const isHovered = hoveredJob === job;
                        return (
                          <g
                            key={job}
                            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                            onClick={() => {
                              if (selectedSlot !== null) {
                                assignJobToSlot(selectedSlot, job);
                              }
                            }}
                            onMouseEnter={() => setHoveredJob(job)}
                            onMouseLeave={() => setHoveredJob(null)}
                          >
                            <circle
                              cx={coord.x}
                              cy={coord.y}
                              r="28"
                              fill={
                                isHovered ? 'rgba(31, 79, 191, 0.22)' : 'rgba(31, 79, 191, 0.08)'
                              }
                              stroke={isHovered ? '#1F4FBF' : isFull ? '#059669' : '#1F4FBF'}
                              strokeWidth={isHovered ? '2.5' : '1.5'}
                              strokeDasharray={isFull ? 'none' : '4 3'}
                            />
                            <text
                              x={coord.x}
                              y={coord.y - 32}
                              textAnchor="middle"
                              fill="#1F4FBF"
                              fontSize="11"
                              fontWeight="700"
                              fontFamily="var(--font-head)"
                              letterSpacing="0.04em"
                            >
                              {info.label}
                            </text>
                            <text
                              x={coord.x}
                              y={coord.y + 38}
                              textAnchor="middle"
                              fill={isFull ? '#059669' : '#6B7280'}
                              fontSize="10"
                              fontWeight="600"
                            >
                              {count}/{info.max}
                            </text>
                          </g>
                        );
                      })}
                    </>
                  )}

                  {setPieceSubTab === 'theirCorners' && (
                    <g>
                      {/* Defending Corner Markings */}
                      <circle
                        cx={P.x + 20}
                        cy={298}
                        r="16"
                        fill="none"
                        stroke="#1F4FBF"
                        strokeWidth="2"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={P.x + 42}
                        y={294}
                        fill="#1F4FBF"
                        fontSize="10"
                        fontWeight="700"
                        fontFamily="var(--font-head)"
                      >
                        NEAR POST
                      </text>
                      <circle
                        cx={P.x + 20}
                        cy={370}
                        r="16"
                        fill="none"
                        stroke="#1F4FBF"
                        strokeWidth="2"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={P.x + 42}
                        y={374}
                        fill="#1F4FBF"
                        fontSize="10"
                        fontWeight="700"
                        fontFamily="var(--font-head)"
                      >
                        FAR POST
                      </text>
                      {setPieces.defending.edgeGuard && (
                        <g>
                          <circle
                            cx={P.x + 190}
                            cy={334}
                            r="22"
                            fill="rgba(31, 79, 191, 0.1)"
                            stroke="#1F4FBF"
                            strokeWidth="2"
                          />
                          <text
                            x={P.x + 190}
                            y={305}
                            textAnchor="middle"
                            fill="#1F4FBF"
                            fontSize="10"
                            fontWeight="700"
                            fontFamily="var(--font-head)"
                          >
                            EDGE GUARD
                          </text>
                        </g>
                      )}
                      <text
                        x={P.x + 480}
                        y={310}
                        textAnchor="middle"
                        fill="#1F4FBF"
                        fontSize="12"
                        fontWeight="700"
                        fontFamily="var(--font-head)"
                      >
                        FORWARDS UP: {setPieces.defending.forwardsUp}
                      </text>
                    </g>
                  )}

                  {setPieceSubTab === 'ourFK' && (
                    <g>
                      {/* Central Free Kick Zone */}
                      <rect
                        x={P.x + P.w * 0.72}
                        y={P.y + P.h * 0.28}
                        width={P.w * 0.28}
                        height={P.h * 0.44}
                        fill="rgba(31, 79, 191, 0.08)"
                        stroke="#1F4FBF"
                        strokeWidth="2"
                        strokeDasharray="6 4"
                      />
                      <text
                        x={P.x + P.w * 0.86}
                        y={P.y + P.h * 0.25}
                        textAnchor="middle"
                        fill="#1F4FBF"
                        fontSize="12"
                        fontWeight="700"
                        fontFamily="var(--font-head)"
                      >
                        CENTRAL (&lt;30m): {setPieces.freeKicks.central.toUpperCase()}
                      </text>
                      {/* Wide Channels */}
                      <rect
                        x={P.x + P.w * 0.65}
                        y={P.y}
                        width={P.w * 0.35}
                        height={P.h * 0.26}
                        fill="rgba(217, 119, 6, 0.08)"
                        stroke="#D97706"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <rect
                        x={P.x + P.w * 0.65}
                        y={P.y + P.h * 0.74}
                        width={P.w * 0.35}
                        height={P.h * 0.26}
                        fill="rgba(217, 119, 6, 0.08)"
                        stroke="#D97706"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={P.x + P.w * 0.82}
                        y={P.y + 20}
                        textAnchor="middle"
                        fill="#D97706"
                        fontSize="11"
                        fontWeight="700"
                        fontFamily="var(--font-head)"
                      >
                        WIDE: {setPieces.freeKicks.wide.toUpperCase()}
                      </text>
                    </g>
                  )}

                  {setPieceSubTab === 'theirFK' && (
                    <g>
                      {/* Wall visualization */}
                      <rect
                        x={P.x + 95}
                        y={P.y + P.h * 0.4}
                        width="16"
                        height={P.h * 0.2}
                        fill="rgba(31, 79, 191, 0.2)"
                        stroke="#1F4FBF"
                        strokeWidth="2"
                      />
                      <text
                        x={P.x + 103}
                        y={P.y + P.h * 0.38}
                        textAnchor="middle"
                        fill="#1F4FBF"
                        fontSize="11"
                        fontWeight="700"
                        fontFamily="var(--font-head)"
                      >
                        WALL: {setPieces.defending.wall.toUpperCase()}
                      </text>
                      {/* Defensive Line */}
                      <line
                        x1={
                          P.x +
                          (setPieces.defending.lineHeight === 'High'
                            ? 230
                            : setPieces.defending.lineHeight === 'Deep'
                              ? 120
                              : 175)
                        }
                        y1={P.y + 20}
                        x2={
                          P.x +
                          (setPieces.defending.lineHeight === 'High'
                            ? 230
                            : setPieces.defending.lineHeight === 'Deep'
                              ? 120
                              : 175)
                        }
                        y2={P.y + P.h - 20}
                        stroke="#D97706"
                        strokeWidth="2.5"
                        strokeDasharray="8 6"
                      />
                      <text
                        x={
                          P.x +
                          (setPieces.defending.lineHeight === 'High'
                            ? 235
                            : setPieces.defending.lineHeight === 'Deep'
                              ? 125
                              : 180)
                        }
                        y={P.y + 40}
                        fill="#D97706"
                        fontSize="11"
                        fontWeight="700"
                        fontFamily="var(--font-head)"
                      >
                        LINE: {setPieces.defending.lineHeight.toUpperCase()}
                      </text>
                    </g>
                  )}
                </>
              )}
            </svg>

            {/* Interactive Starter Magnets (11 starters on sideways pitch) */}
            {boardTab === 'us' &&
              starters.map(({ slotDef, player, slotOvr, isNatural }) => {
                const isSelected = selectedSlot === slotDef.slot;
                const isHovered = hoveredSlot === slotDef.slot;

                // Normalized coordinates along pitch (0 = own goal left, 1 = opp goal right)
                const nx = slotDef.anchor.x / 105;
                const ny = slotDef.anchor.y / 68;

                // Defensive shape derivation
                const defNormX = Math.max(
                  0.05,
                  Math.min(
                    0.94,
                    0.07 +
                      (nx - 0.05) * 0.62 +
                      (tactics.instructions.line === 'High'
                        ? 0.04
                        : tactics.instructions.line === 'Deep'
                          ? -0.03
                          : 0),
                  ),
                );

                let curX = phase === 'withBall' ? nx : defNormX;
                let curY = ny;

                // Position in SVG / Board coordinates
                let px = P.x + curX * P.w;
                let py = P.y + curY * P.h;

                if (activeDivider === 'setpieces') {
                  if (setPieceSubTab === 'ourCorners') {
                    if (slotDef.slot === 0) {
                      px = P.x + 30;
                      py = P.y + P.h / 2;
                    } else {
                      const job = currentRoutine?.jobs?.[slotDef.slot] as CornerJob | undefined;
                      if (job && job in JOB_COORDS) {
                        const coord = JOB_COORDS[job];
                        const peers = Object.entries(currentRoutine?.jobs ?? {})
                          .filter(([s, j]) => j === job)
                          .map(([s]) => Number(s));
                        const idxInPeers = peers.indexOf(slotDef.slot);
                        const offsetX = peers.length > 1 ? (idxInPeers === 0 ? -18 : 18) : 0;
                        px = coord.x + offsetX;
                        py = coord.y;
                      } else {
                        px = P.x + 0.65 * P.w;
                        py = P.y + (slotDef.anchor.y / 68) * P.h;
                      }
                    }
                  } else if (setPieceSubTab === 'theirCorners') {
                    if (slotDef.slot === 0) {
                      px = P.x + 25;
                      py = P.y + P.h / 2;
                    } else if (slotDef.slot === 10 && setPieces.defending.forwardsUp >= 1) {
                      px = P.x + 480;
                      py = setPieces.defending.forwardsUp === 2 ? P.y + P.h * 0.4 : P.y + P.h / 2;
                    } else if (slotDef.slot === 9 && setPieces.defending.forwardsUp === 2) {
                      px = P.x + 480;
                      py = P.y + P.h * 0.6;
                    } else if (setPieces.defending.edgeGuard && slotDef.slot === 8) {
                      px = P.x + 190;
                      py = P.y + P.h / 2;
                    } else if (setPieces.defending.markMainMan === player?.id) {
                      px = P.x + 105;
                      py = P.y + P.h / 2;
                    } else {
                      px = P.x + 40 + (slotDef.slot % 4) * 35;
                      py = P.y + P.h * 0.25 + ((slotDef.slot * 47) % Math.round(P.h * 0.5));
                    }
                  }
                }

                // % coordinates for CSS positioning
                const leftPct = (px / 1050) * 100;
                const topPct = (py / 790) * 100;

                const fitColor = isNatural ? '#1E7B3C' : slotOvr >= 65 ? '#B7791F' : '#C42B2B';

                return (
                  <div
                    key={slotDef.slot}
                    onClick={() => handleSlotClick(slotDef.slot)}
                    onMouseEnter={() => {
                      setHoveredSlot(slotDef.slot);
                      if (selectedSlot !== null && selectedSlot !== slotDef.slot) {
                        setDragOverSlot(slotDef.slot);
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredSlot(null);
                      setDragOverSlot(null);
                    }}
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      transform: 'translate(-50%, -50%)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      transition:
                        'left 480ms cubic-bezier(.2,.8,.2,1), top 480ms cubic-bezier(.2,.8,.2,1)',
                      zIndex: isSelected ? 25 : 10,
                    }}
                  >
                    {/* Magnet Disc (44px) */}
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        backgroundColor: userClub.colors.primary,
                        border: `2.5px solid ${isSelected ? '#FFFFFF' : userClub.colors.secondary}`,
                        boxShadow: isSelected
                          ? '0 0 0 3px #1F4FBF, 0 8px 18px rgba(0,0,0,0.45)'
                          : isHovered
                            ? '0 6px 14px rgba(0,0,0,0.3)'
                            : '0 2px 5px rgba(0,0,0,0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: userClub.colors.secondary,
                        fontFamily: 'var(--font-head)',
                        fontWeight: 700,
                        fontSize: '16px',
                        position: 'relative',
                        transform: isSelected || isHovered ? 'scale(1.08)' : 'scale(1)',
                        transition: 'transform 140ms ease',
                      }}
                    >
                      <span>{player?.squadNumber ?? slotDef.slot + 1}</span>

                      {/* OVR fit badge */}
                      {player && (
                        <span
                          style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '-10px',
                            backgroundColor: fitColor,
                            color: '#FFFFFF',
                            fontSize: '11px',
                            fontWeight: 700,
                            fontFamily: 'var(--font-head)',
                            borderRadius: '2px',
                            padding: '1px 4px',
                            lineHeight: 1,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                          }}
                        >
                          {slotOvr}
                        </span>
                      )}
                    </div>

                    {/* Player Surname Label */}
                    <div
                      style={{
                        fontSize: '12px',
                        fontFamily: 'var(--font-head)',
                        fontWeight: 600,
                        letterSpacing: '0.02em',
                        color: 'var(--board-ink, #1E2A38)',
                        whiteSpace: 'nowrap',
                        maxWidth: '84px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textAlign: 'center',
                        backgroundColor: 'rgba(255, 255, 255, 0.85)',
                        padding: '1px 4px',
                        borderRadius: '2px',
                      }}
                    >
                      {player ? player.lastName : slotDef.role}
                    </div>
                  </div>
                );
              })}

            {/* Opposition XI Magnets (when boardTab === 'opp') */}
            {boardTab === 'opp' &&
              oppFormationDef.slots.map((slotDef, oppIdx) => {
                const nx = 1 - slotDef.anchor.x / 105;
                const ny = 1 - slotDef.anchor.y / 68;
                const px = P.x + nx * P.w;
                const py = P.y + ny * P.h;
                const leftPct = (px / 1050) * 100;
                const topPct = (py / 790) * 100;

                const isOppSelected = selectedOppSlot === oppIdx;

                return (
                  <div
                    key={oppIdx}
                    onClick={() => setSelectedOppSlot(oppIdx)}
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      transform: 'translate(-50%, -50%)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      zIndex: 15,
                    }}
                  >
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        backgroundColor: '#FFFFFF',
                        border: `2.5px solid ${isOppSelected ? '#1E2A38' : '#C42B2B'}`,
                        boxShadow: isOppSelected
                          ? '0 0 0 3px #C42B2B, 0 6px 14px rgba(0,0,0,0.3)'
                          : '0 2px 5px rgba(0,0,0,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#C42B2B',
                        fontFamily: 'var(--font-head)',
                        fontWeight: 700,
                        fontSize: '15px',
                      }}
                    >
                      <span>{oppIdx + 1}</span>
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-head)',
                        fontWeight: 600,
                        color: '#C42B2B',
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        padding: '1px 4px',
                        borderRadius: '2px',
                      }}
                    >
                      {slotDef.role}
                    </div>
                  </div>
                );
              })}

            {/* Bench Strip along bottom (Horizontal row at BENCH_Y) */}
            {benchPlayers.slice(0, 8).map(({ idx, player, primaryOvr }) => {
              const bx = BENCH_X0 + idx * BENCH_DX;
              const by = BENCH_Y;
              const leftPct = (bx / 1050) * 100;
              const topPct = (by / 790) * 100;
              const isBenchSelected = selectedBenchIndex === idx;

              return (
                <div
                  key={idx}
                  onClick={() => handleBenchClick(idx)}
                  style={{
                    position: 'absolute',
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    transform: 'translate(-50%, -50%)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    zIndex: isBenchSelected ? 20 : 10,
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: userClub.colors.primary,
                      border: `2px solid ${isBenchSelected ? '#1F4FBF' : userClub.colors.secondary}`,
                      boxShadow: isBenchSelected
                        ? '0 0 0 3px #1F4FBF, 0 6px 12px rgba(0,0,0,0.3)'
                        : '0 2px 4px rgba(0,0,0,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: userClub.colors.secondary,
                      fontFamily: 'var(--font-head)',
                      fontWeight: 700,
                      fontSize: '13px',
                      transform: isBenchSelected ? 'scale(1.1)' : 'scale(1)',
                      transition: 'transform 140ms ease',
                    }}
                  >
                    {player?.squadNumber ?? `B${idx + 1}`}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-head)',
                      fontWeight: 600,
                      color: 'var(--board-ink, #1E2A38)',
                      whiteSpace: 'nowrap',
                      maxWidth: '64px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {player ? player.lastName : `B${idx + 1}`}
                  </div>
                </div>
              );
            })}

            {/* Injured Corner (at TREAT_X) */}
            {injuredPlayers.slice(0, 1).map((p) => {
              const leftPct = (TREAT_X / 1050) * 100;
              const topPct = (BENCH_Y / 790) * 100;

              return (
                <div
                  key={p.id}
                  onClick={() =>
                    showToast(
                      `${p.firstName} ${p.lastName} is injured: ${p.injury?.kind ?? 'Injured'} (${p.injury?.matchdaysOut ?? 1} matchdays out)`,
                      'warning',
                    )
                  }
                  style={{
                    position: 'absolute',
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    transform: 'translate(-50%, -50%)',
                    cursor: 'not-allowed',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    opacity: 0.65,
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: '#C42B2B',
                      border: '2px solid #FFFFFF',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-head)',
                      fontWeight: 700,
                      fontSize: '13px',
                    }}
                  >
                    +
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-head)',
                      fontWeight: 600,
                      color: '#C42B2B',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.lastName}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Marker Tray Under the Frame */}
        <div
          style={{
            height: '28px',
            margin: '0 40px',
            borderRadius: '0 0 6px 6px',
            background: 'linear-gradient(#9AA1A8, #80878E)',
            boxShadow: '0 6px 12px rgba(0,0,0,0.45)',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            gap: '16px',
          }}
        >
          {/* Blue Pen */}
          <div
            style={{
              width: '56px',
              height: '10px',
              borderRadius: '2px',
              backgroundColor: '#1F4FBF',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }}
          />
          {/* Red Pen */}
          <div
            style={{
              width: '56px',
              height: '10px',
              borderRadius: '2px',
              backgroundColor: '#C42B2B',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }}
          />
          {/* Eraser */}
          <div
            style={{
              width: '60px',
              height: '14px',
              borderRadius: '2px',
              backgroundColor: '#3A3F45',
              borderBottom: '4px solid #6B5B4A',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }}
          />
        </div>
      </div>

      {/* ============================================================== */}
      {/* COLUMN 2 (RIGHT): TALL PANEL (Clipboard or Player File)        */}
      {/* ============================================================== */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        {selectedPlayer && selectedSlotDef ? (
          /* ============================================================ */
          /* 2A: THE PLAYER FILE (Slides over the clipboard)             */
          /* ============================================================ */
          <div
            style={{
              backgroundColor: 'var(--paper, #EFEBE3)',
              color: 'var(--paper-ink, #1B1A17)',
              borderRadius: '4px',
              padding: '24px 20px 20px',
              boxShadow: '0 1px 0 rgba(0,0,0,0.25), 0 10px 24px rgba(0,0,0,0.5)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              minHeight: '100%',
            }}
          >
            {/* Manila Tab at Top */}
            <div
              style={{
                position: 'absolute',
                top: '-24px',
                left: '16px',
                height: '24px',
                padding: '0 14px',
                borderRadius: '4px 4px 0 0',
                backgroundColor: 'var(--manila, #D9C9A3)',
                color: 'var(--paper-ink, #1B1A17)',
                fontFamily: 'var(--font-head)',
                fontWeight: 700,
                fontSize: '13px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {selectedPlayer.lastName}
            </div>

            {/* Close Button (X) */}
            <button
              onClick={() => setSelectedSlot(null)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--paper-dim, #5E574E)',
                padding: '4px',
              }}
              title="Close File (Esc)"
            >
              <X size={18} />
            </button>

            {/* Header: Portrait/disc, name, number, age, position chips, foot, OVR */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                gap: '12px',
                alignItems: 'center',
                borderBottom: '2px solid var(--paper-ink, #1B1A17)',
                paddingBottom: '12px',
              }}
            >
              {/* Squad Disc */}
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  backgroundColor: userClub.colors.primary,
                  border: `2px solid ${userClub.colors.secondary}`,
                  color: userClub.colors.secondary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-head)',
                  fontWeight: 700,
                  fontSize: '22px',
                }}
              >
                {selectedPlayer.squadNumber ?? selectedSlotDef.slot + 1}
              </div>

              <div>
                <h2
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-head)',
                    fontSize: '24px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    lineHeight: 1.1,
                  }}
                >
                  {selectedPlayer.firstName} {selectedPlayer.lastName}
                </h2>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    color: 'var(--paper-dim, #5E574E)',
                    marginTop: '3px',
                  }}
                >
                  {selectedPlayer.positions.map((p) => (
                    <span
                      key={p.pos}
                      style={{
                        padding: '1px 5px',
                        borderRadius: '2px',
                        border: '1px solid var(--paper-rule, #CFC6B6)',
                        fontFamily: 'var(--font-head)',
                        fontWeight: 600,
                        backgroundColor:
                          p.pos === selectedSlotDef.position
                            ? 'var(--paper-ink, #1B1A17)'
                            : 'transparent',
                        color: p.pos === selectedSlotDef.position ? '#FFFFFF' : 'inherit',
                      }}
                    >
                      {p.pos}
                    </span>
                  ))}
                  <span>· Age {selectedPlayer.age}</span>
                  <span>· {selectedPlayer.foot} footed</span>
                </div>
              </div>

              {/* OVR display (or comparison if dragOverPlayer) */}
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-head)',
                    fontSize: '32px',
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {dragOverPlayer ? (
                    <span>
                      {ovrAt(selectedPlayer, selectedSlotDef.position)}{' '}
                      <span style={{ fontSize: '18px', color: 'var(--paper-dim)' }}>
                        vs {ovrAt(dragOverPlayer, selectedSlotDef.position)}
                      </span>
                    </span>
                  ) : (
                    ovrAt(selectedPlayer, selectedSlotDef.position)
                  )}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--paper-dim)' }}>
                  at {selectedSlotDef.position}
                </div>
              </div>
            </div>

            {/* Condition and Morale Meters in One Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '14px',
                fontSize: '12px',
                borderBottom: '1px solid var(--paper-rule, #CFC6B6)',
                paddingBottom: '10px',
              }}
            >
              <div>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}
                >
                  <span style={{ fontWeight: 600 }}>Condition</span>
                  <span style={{ fontWeight: 700 }}>{selectedPlayer.condition}%</span>
                </div>
                <div
                  style={{
                    height: '5px',
                    background: 'var(--paper-rule)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${selectedPlayer.condition}%`,
                      backgroundColor: selectedPlayer.condition < 75 ? '#B7791F' : '#1E7B3C',
                    }}
                  />
                </div>
              </div>

              <div>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}
                >
                  <span style={{ fontWeight: 600 }}>Morale</span>
                  <span style={{ fontWeight: 700 }}>{selectedPlayer.morale}%</span>
                </div>
                <div
                  style={{
                    height: '5px',
                    background: 'var(--paper-rule)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${selectedPlayer.morale}%`,
                      backgroundColor: '#1F4FBF',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* RadarChart: Always in view */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                backgroundColor: 'rgba(0,0,0,0.02)',
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid var(--paper-rule, #CFC6B6)',
              }}
            >
              <div style={{ flexShrink: 0 }}>
                <RadarChart
                  player={selectedPlayer}
                  roleShape={currentRoleShape}
                  comparePlayer={dragOverPlayer}
                  size={170}
                />
              </div>

              {/* Key Role Attributes beside radar */}
              <div style={{ flex: 1, minWidth: 0, fontSize: '11.5px' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-head)',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--paper-dim, #5E574E)',
                    marginBottom: '4px',
                  }}
                >
                  Key Role Attributes
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {(phase === 'withBall'
                    ? Object.keys(
                        ROLES[currentAttRoleId]?.keyAttributes ?? {
                          passing: 1,
                          decisions: 1,
                          firstTouch: 1,
                        },
                      )
                    : ['positioning', 'tackling', 'workRate']
                  )
                    .slice(0, 4)
                    .map((attrKey) => {
                      const val = selectedPlayer.attributes[attrKey as keyof Attributes] ?? 50;
                      return (
                        <div
                          key={attrKey}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span style={{ color: 'var(--paper-dim)' }}>
                            {ATTR_DISPLAY_NAMES[attrKey] ?? attrKey}
                          </span>
                          <span style={{ fontWeight: 700, color: getAttrColor(val) }}>{val}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Two Tabs: Orders vs Profile */}
            <div
              style={{
                display: 'flex',
                gap: '2px',
                borderBottom: '2px solid var(--paper-ink, #1B1A17)',
                marginTop: '4px',
              }}
            >
              <button
                onClick={() => setFileTab('orders')}
                style={{
                  flex: 1,
                  height: '32px',
                  borderRadius: '3px 3px 0 0',
                  fontFamily: 'var(--font-head)',
                  fontWeight: 700,
                  fontSize: '13px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  border: 'none',
                  backgroundColor:
                    fileTab === 'orders' ? 'var(--paper-ink, #1B1A17)' : 'var(--paper-2, #E4DED2)',
                  color: fileTab === 'orders' ? '#FFFFFF' : 'var(--paper-dim, #5E574E)',
                  cursor: 'pointer',
                }}
              >
                ORDERS
              </button>
              <button
                onClick={() => setFileTab('profile')}
                style={{
                  flex: 1,
                  height: '32px',
                  borderRadius: '3px 3px 0 0',
                  fontFamily: 'var(--font-head)',
                  fontWeight: 700,
                  fontSize: '13px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  border: 'none',
                  backgroundColor:
                    fileTab === 'profile' ? 'var(--paper-ink, #1B1A17)' : 'var(--paper-2, #E4DED2)',
                  color: fileTab === 'profile' ? '#FFFFFF' : 'var(--paper-dim, #5E574E)',
                  cursor: 'pointer',
                }}
              >
                PROFILE
              </button>
            </div>

            {/* TAB CONTENT: Orders */}
            {fileTab === 'orders' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Phase Switch inside File */}
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button
                    onClick={() => setPhase('withBall')}
                    style={{
                      flex: 1,
                      padding: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-head)',
                      borderRadius: '2px',
                      border: 'none',
                      backgroundColor: phase === 'withBall' ? '#1F4FBF' : 'var(--paper-2)',
                      color: phase === 'withBall' ? '#FFFFFF' : 'var(--paper-dim)',
                      cursor: 'pointer',
                    }}
                  >
                    WITH THE BALL
                  </button>
                  <button
                    onClick={() => setPhase('withoutBall')}
                    style={{
                      flex: 1,
                      padding: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-head)',
                      borderRadius: '2px',
                      border: 'none',
                      backgroundColor: phase === 'withoutBall' ? '#1F4FBF' : 'var(--paper-2)',
                      color: phase === 'withoutBall' ? '#FFFFFF' : 'var(--paper-dim)',
                      cursor: 'pointer',
                    }}
                  >
                    WITHOUT THE BALL
                  </button>
                </div>

                {/* Roles for slot */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      fontFamily: 'var(--font-head)',
                      fontWeight: 700,
                      color: 'var(--paper-dim)',
                      textTransform: 'uppercase',
                      marginBottom: '6px',
                    }}
                  >
                    <span>
                      {phase === 'withBall' ? 'Attacking Role' : 'Defensive Role'} at{' '}
                      {selectedSlotDef.position}
                    </span>
                    <span>Fit</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {phase === 'withBall'
                      ? availableAttRoles.map((role) => {
                          const isCurrent = currentAttRoleId === role.id;
                          const fit = computeRoleFit(role.id, selectedPlayer.attributes);
                          return (
                            <div
                              key={role.id}
                              onClick={() => handleSetAttRole(role.id)}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '2px',
                                border: isCurrent
                                  ? '2px solid #1F4FBF'
                                  : '1px solid var(--paper-rule)',
                                backgroundColor: isCurrent ? '#FFFFFF' : 'var(--paper-2)',
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
                                <span style={{ fontWeight: 700, fontSize: '13px' }}>
                                  {role.name}
                                </span>
                                <span
                                  style={{
                                    fontSize: '12px',
                                    color:
                                      fit.stars >= 4
                                        ? '#1E7B3C'
                                        : fit.stars === 3
                                          ? '#B7791F'
                                          : '#C42B2B',
                                  }}
                                >
                                  {'★'.repeat(fit.stars)}
                                  <span style={{ color: 'var(--paper-rule)' }}>
                                    {'★'.repeat(5 - fit.stars)}
                                  </span>
                                </span>
                              </div>
                              <div
                                style={{
                                  fontSize: '12px',
                                  color: 'var(--paper-dim)',
                                  marginTop: '2px',
                                }}
                              >
                                {role.description}
                              </div>

                              {isCurrent && (
                                <div
                                  style={{ marginTop: '6px', fontSize: '11.5px', lineHeight: 1.4 }}
                                >
                                  <div style={{ color: '#1E7B3C' }}>Gives you: {role.gives}</div>
                                  <div style={{ color: '#C42B2B' }}>Costs you: {role.costs}</div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      : (DEF_SLOT[selectedSlotDef.position] ?? []).map((defId) => {
                          const defDef = DEF_ROLES[defId];
                          if (!defDef) return null;
                          const isCurrent = currentDefRoleId === defId;
                          const fit = computeDefRoleFit(selectedPlayer.attributes, defId);
                          return (
                            <div
                              key={defId}
                              onClick={() => handleSetDefRole(defId)}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '2px',
                                border: isCurrent
                                  ? '2px solid #1F4FBF'
                                  : '1px solid var(--paper-rule)',
                                backgroundColor: isCurrent ? '#FFFFFF' : 'var(--paper-2)',
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
                                <span style={{ fontWeight: 700, fontSize: '13px' }}>
                                  {defDef.name}
                                </span>
                                <span
                                  style={{
                                    fontSize: '12px',
                                    color:
                                      fit.stars >= 4
                                        ? '#1E7B3C'
                                        : fit.stars === 3
                                          ? '#B7791F'
                                          : '#C42B2B',
                                  }}
                                >
                                  {'★'.repeat(fit.stars)}
                                  <span style={{ color: 'var(--paper-rule)' }}>
                                    {'★'.repeat(5 - fit.stars)}
                                  </span>
                                </span>
                              </div>
                              <div
                                style={{
                                  fontSize: '12px',
                                  color: 'var(--paper-dim)',
                                  marginTop: '2px',
                                }}
                              >
                                {defDef.description}
                              </div>

                              {isCurrent && (
                                <div
                                  style={{ marginTop: '6px', fontSize: '11.5px', lineHeight: 1.4 }}
                                >
                                  <div style={{ color: '#1E7B3C' }}>Gives you: {defDef.gives}</div>
                                  <div style={{ color: '#C42B2B' }}>Costs you: {defDef.costs}</div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                  </div>
                </div>

                {/* Instructions offered by role */}
                {(() => {
                  const activeAttList =
                    selectedSlot !== null ? (tacticsAttPIs[selectedSlot] ?? []) : [];
                  const activeDefList =
                    selectedSlot !== null ? (tacticsDefPIs[selectedSlot] ?? []) : [];

                  return (
                    <div style={{ borderTop: '1px solid var(--paper-rule)', paddingTop: '10px' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '11px',
                          fontFamily: 'var(--font-head)',
                          fontWeight: 700,
                          color: 'var(--paper-dim)',
                          textTransform: 'uppercase',
                          marginBottom: '6px',
                        }}
                      >
                        <span>
                          {phase === 'withBall'
                            ? 'Attacking Instructions'
                            : 'Defensive Instructions'}
                        </span>
                        <span>
                          {phase === 'withBall'
                            ? `${activeAttList.length} of 2`
                            : `${activeDefList.length} of 1`}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {phase === 'withBall'
                          ? (ATT_ALLOW[currentAttRoleId] ?? []).map((inst) => {
                              const isActive = activeAttList.includes(inst);
                              const info = ATT_PIS[inst];
                              const fit = computeInstructionFit(
                                selectedPlayer.attributes,
                                inst,
                                false,
                              );
                              const clashes = info?.clashesWith ?? [];
                              const clashFound = clashes.find((c) =>
                                activeAttList.includes(c as PlayerInstruction),
                              );
                              const isFull = !isActive && activeAttList.length >= 2;
                              const disabled = !isActive && (!!clashFound || isFull);

                              return (
                                <button
                                  key={inst}
                                  onClick={() => !disabled && toggleAttInstruction(inst)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '8px',
                                    padding: '6px 8px',
                                    borderRadius: '2px',
                                    border: isActive
                                      ? '1px solid #1F4FBF'
                                      : '1px solid var(--paper-rule)',
                                    backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                                    opacity: disabled ? 0.45 : 1,
                                    cursor: disabled ? 'not-allowed' : 'pointer',
                                    textAlign: 'left',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: '16px',
                                      height: '16px',
                                      borderRadius: '2px',
                                      border: '1.5px solid var(--paper-ink)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      backgroundColor: isActive ? '#1F4FBF' : 'transparent',
                                      borderColor: isActive ? '#1F4FBF' : 'var(--paper-ink)',
                                      marginTop: '2px',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {isActive && (
                                      <Check size={12} color="#FFFFFF" strokeWidth={3} />
                                    )}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                      style={{ display: 'flex', justifyContent: 'space-between' }}
                                    >
                                      <span style={{ fontSize: '12.5px', fontWeight: 600 }}>
                                        {info?.wording}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: '11px',
                                          color: fit.stars >= 4 ? '#1E7B3C' : '#B7791F',
                                        }}
                                      >
                                        {'★'.repeat(fit.stars)}
                                      </span>
                                    </div>
                                    {clashFound && (
                                      <div
                                        style={{
                                          fontSize: '11px',
                                          color: '#C42B2B',
                                          marginTop: '2px',
                                        }}
                                      >
                                        Clashes with &ldquo;
                                        {ATT_PIS[clashFound as PlayerInstruction]?.wording}&rdquo;
                                      </div>
                                    )}
                                  </div>
                                </button>
                              );
                            })
                          : (DEF_ALLOW[currentDefRoleId] ?? []).map((inst) => {
                              const isActive = activeDefList.includes(inst);
                              const info = DEF_PIS[inst];
                              const fit = computeInstructionFit(
                                selectedPlayer.attributes,
                                inst,
                                true,
                              );
                              const isFull = !isActive && activeDefList.length >= 1;

                              return (
                                <button
                                  key={inst}
                                  onClick={() => !isFull && toggleDefInstruction(inst)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '8px',
                                    padding: '6px 8px',
                                    borderRadius: '2px',
                                    border: isActive
                                      ? '1px solid #1F4FBF'
                                      : '1px solid var(--paper-rule)',
                                    backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                                    opacity: isFull ? 0.45 : 1,
                                    cursor: isFull ? 'not-allowed' : 'pointer',
                                    textAlign: 'left',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: '16px',
                                      height: '16px',
                                      borderRadius: '2px',
                                      border: '1.5px solid var(--paper-ink)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      backgroundColor: isActive ? '#1F4FBF' : 'transparent',
                                      borderColor: isActive ? '#1F4FBF' : 'var(--paper-ink)',
                                      marginTop: '2px',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {isActive && (
                                      <Check size={12} color="#FFFFFF" strokeWidth={3} />
                                    )}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                      style={{ display: 'flex', justifyContent: 'space-between' }}
                                    >
                                      <span style={{ fontSize: '12.5px', fontWeight: 600 }}>
                                        {info?.wording}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: '11px',
                                          color: fit.stars >= 4 ? '#1E7B3C' : '#B7791F',
                                        }}
                                      >
                                        {'★'.repeat(fit.stars)}
                                      </span>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB CONTENT: Profile */}
            {fileTab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Season Stats Row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr) auto',
                    gap: '12px',
                    alignItems: 'flex-end',
                    paddingBottom: '10px',
                    borderBottom: '2px solid var(--paper-ink)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--paper-dim)' }}>Apps</div>
                    <div
                      style={{ fontFamily: 'var(--font-head)', fontSize: '20px', fontWeight: 700 }}
                    >
                      {selectedPlayer.stats?.apps ?? 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--paper-dim)' }}>Goals</div>
                    <div
                      style={{ fontFamily: 'var(--font-head)', fontSize: '20px', fontWeight: 700 }}
                    >
                      {selectedPlayer.stats?.goals ?? 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--paper-dim)' }}>Assists</div>
                    <div
                      style={{ fontFamily: 'var(--font-head)', fontSize: '20px', fontWeight: 700 }}
                    >
                      {selectedPlayer.stats?.assists ?? 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--paper-dim)' }}>Avg</div>
                    <div
                      style={{ fontFamily: 'var(--font-head)', fontSize: '20px', fontWeight: 700 }}
                    >
                      {selectedPlayer.stats && selectedPlayer.stats.ratedApps > 0
                        ? (selectedPlayer.stats.ratingSum / selectedPlayer.stats.ratedApps).toFixed(
                            2,
                          )
                        : '—'}
                    </div>
                  </div>

                  {/* Last 5 match sparkline */}
                  <div>
                    <div
                      style={{ fontSize: '10px', color: 'var(--paper-dim)', textAlign: 'right' }}
                    >
                      Last 5
                    </div>
                    <svg width="84" height="24" viewBox="0 0 84 24" style={{ display: 'block' }}>
                      {selectedPlayer.form && selectedPlayer.form.length > 0 ? (
                        <>
                          <polyline
                            points={selectedPlayer.form
                              .map(
                                (val, idx) =>
                                  `${8 + idx * 17},${Math.max(4, Math.min(20, 24 - (val - 5) * 4))}`,
                              )
                              .join(' ')}
                            fill="none"
                            stroke="var(--paper-ink)"
                            strokeWidth="1.6"
                          />
                          {selectedPlayer.form.map((val, idx) => (
                            <circle
                              key={idx}
                              cx={8 + idx * 17}
                              cy={Math.max(4, Math.min(20, 24 - (val - 5) * 4))}
                              r="2.8"
                              fill={
                                val >= 7.5 ? '#1E7B3C' : val >= 6.5 ? 'var(--paper-ink)' : '#C42B2B'
                              }
                            />
                          ))}
                        </>
                      ) : (
                        <line
                          x1="4"
                          y1="12"
                          x2="80"
                          y2="12"
                          stroke="var(--paper-rule)"
                          strokeDasharray="2 4"
                        />
                      )}
                    </svg>
                  </div>
                </div>

                {/* Attributes in 2 columns */}
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-head)',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: 'var(--paper-dim)',
                      fontSize: '11px',
                      marginBottom: '6px',
                    }}
                  >
                    All Attributes
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                    {Object.entries(selectedPlayer.attributes)
                      .filter(([key]) => key in ATTR_DISPLAY_NAMES)
                      .map(([attrKey, val]) => (
                        <div
                          key={attrKey}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '11.5px',
                          }}
                        >
                          <span
                            style={{
                              color: 'var(--paper-dim)',
                              width: '82px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {ATTR_DISPLAY_NAMES[attrKey] ?? attrKey}
                          </span>
                          <div
                            style={{
                              flex: 1,
                              height: '4px',
                              backgroundColor: 'var(--paper-rule)',
                              position: 'relative',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${val}%`,
                                backgroundColor: getAttrColor(val),
                              }}
                            />
                          </div>
                          <span
                            style={{
                              width: '22px',
                              textAlign: 'right',
                              fontWeight: 700,
                              color: getAttrColor(val),
                            }}
                          >
                            {val}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : boardTab === 'opp' ? (
          /* ============================================================ */
          /* 2B: OPPOSITION ORDERS SHEET                                 */
          /* ============================================================ */
          <div
            style={{
              backgroundColor: 'var(--paper, #EFEBE3)',
              color: 'var(--paper-ink, #1B1A17)',
              borderRadius: '4px',
              padding: '24px 20px 20px',
              boxShadow: '0 1px 0 rgba(0,0,0,0.25), 0 10px 24px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              minHeight: '100%',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderBottom: '2px solid var(--paper-ink)',
                paddingBottom: '8px',
                fontFamily: 'var(--font-head)',
                fontWeight: 700,
                fontSize: '13px',
                textTransform: 'uppercase',
              }}
            >
              <span>Opposition · {oppClub.name}</span>
              <span style={{ color: '#C42B2B' }}>
                {tactics.opposition?.length ?? 0} of 3 orders used
              </span>
            </div>

            <div>
              <h2 style={{ fontFamily: 'var(--font-head)', fontSize: '24px', margin: '4px 0 2px' }}>
                {oppClub.style.formation} · {oppClub.style.passing}
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--paper-dim)' }}>
                {oppClub.style.pressing} Pressing · {oppClub.style.line} Line ·{' '}
                {oppClub.style.tempo} Tempo
              </div>
            </div>

            {selectedOppSlot === null ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.03)',
                    padding: '12px',
                    borderRadius: '3px',
                    fontSize: '13px',
                    color: 'var(--paper-dim)',
                    lineHeight: 1.4,
                  }}
                >
                  Click one of their players on the board to give an opposition order about him. Up
                  to 3 orders a match.
                </div>

                {/* Active orders list */}
                {(tactics.opposition ?? []).length > 0 && (
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--font-head)',
                        fontWeight: 700,
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        color: 'var(--paper-dim)',
                        marginBottom: '6px',
                      }}
                    >
                      Active Orders
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(tactics.opposition ?? []).map((order, oIdx) => (
                        <div
                          key={oIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderRadius: '3px',
                            backgroundColor: 'var(--paper-2)',
                            fontSize: '12.5px',
                          }}
                        >
                          <div>
                            <strong>
                              {order.kind === 'doubleUp'
                                ? 'Double up'
                                : order.kind === 'tightMark'
                                  ? 'Tight mark'
                                  : order.kind === 'pressOnBall'
                                    ? 'Press on ball'
                                    : order.kind === 'showInside'
                                      ? 'Show inside'
                                      : 'Show outside'}
                            </strong>
                            <div style={{ fontSize: '11px', color: 'var(--paper-dim)' }}>
                              Target: #{order.target}
                            </div>
                          </div>
                          <button
                            onClick={() => toggleOppOrder(order.target, order.kind)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '2px',
                              border: '1px solid var(--paper-rule)',
                              backgroundColor: 'transparent',
                              cursor: 'pointer',
                              fontSize: '11px',
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Selected Opponent Player Orders */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(() => {
                  const targetSlot =
                    oppFormationDef.slots[selectedOppSlot] ?? oppFormationDef.slots[0]!;
                  const targetId = `opp_${selectedOppSlot}`;
                  const isGk = targetSlot.position === 'GK';

                  const orderOptions: {
                    kind: 'tightMark' | 'doubleUp' | 'pressOnBall' | 'showInside' | 'showOutside';
                    title: string;
                    desc: string;
                    costs: string;
                  }[] = [
                    {
                      kind: 'tightMark',
                      title: 'Tight mark',
                      desc: 'Stay touch-tight on him so he sees less of the ball.',
                      costs: 'His marker gets dragged about; space behind.',
                    },
                    {
                      kind: 'doubleUp',
                      title: 'Double up',
                      desc: 'Two on him whenever he has it.',
                      costs: 'Leaves space on the other flank. Max 1 double-up.',
                    },
                    {
                      kind: 'pressOnBall',
                      title: 'Press on the ball',
                      desc: 'Close him down the moment he gets it.',
                      costs: 'If he beats the press, we are open; nearest man tires.',
                    },
                    {
                      kind: 'showInside',
                      title: 'Show inside',
                      desc: 'Force him inside away from the byline.',
                      costs: 'He shoots more often.',
                    },
                    {
                      kind: 'showOutside',
                      title: 'Show outside',
                      desc: 'Force him down the line away from goal.',
                      costs: 'He crosses and dribbles more.',
                    },
                  ];

                  return (
                    <>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          borderBottom: '1px solid var(--paper-rule)',
                          paddingBottom: '8px',
                        }}
                      >
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            backgroundColor: '#C42B2B',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: 'var(--font-head)',
                            fontWeight: 700,
                            fontSize: '16px',
                          }}
                        >
                          {selectedOppSlot + 1}
                        </div>
                        <div>
                          <div
                            style={{
                              fontFamily: 'var(--font-head)',
                              fontWeight: 700,
                              fontSize: '18px',
                            }}
                          >
                            {targetSlot.role} #{selectedOppSlot + 1}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--paper-dim)' }}>
                            {oppClub.name}
                          </div>
                        </div>
                      </div>

                      {isGk ? (
                        <div style={{ fontSize: '13px', color: 'var(--paper-dim)' }}>
                          No special instructions for the opposing goalkeeper.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {orderOptions.map((opt) => {
                            const isSet = (tactics.opposition ?? []).some(
                              (o) => o.target === targetId && o.kind === opt.kind,
                            );
                            return (
                              <button
                                key={opt.kind}
                                onClick={() => toggleOppOrder(targetId, opt.kind)}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: '3px',
                                  border: isSet
                                    ? '2px solid #C42B2B'
                                    : '1px solid var(--paper-rule)',
                                  backgroundColor: isSet ? '#FFFFFF' : 'var(--paper-2)',
                                  textAlign: 'left',
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
                                  <span
                                    style={{
                                      fontWeight: 700,
                                      fontSize: '13px',
                                      color: isSet ? '#C42B2B' : 'inherit',
                                    }}
                                  >
                                    {opt.title}
                                  </span>
                                  {isSet && <Check size={14} color="#C42B2B" strokeWidth={3} />}
                                </div>
                                <div
                                  style={{
                                    fontSize: '12px',
                                    color: 'var(--paper-ink)',
                                    marginTop: '2px',
                                  }}
                                >
                                  {opt.desc}
                                </div>
                                <div
                                  style={{ fontSize: '11px', color: '#C42B2B', marginTop: '2px' }}
                                >
                                  Costs: {opt.costs}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        ) : (
          /* ============================================================ */
          /* 2C: THE CLIPBOARD (When nothing is selected)                */
          /* ============================================================ */
          <div
            style={{
              backgroundColor: 'var(--paper, #EFEBE3)',
              color: 'var(--paper-ink, #1B1A17)',
              borderRadius: '4px',
              padding: '24px 20px 20px',
              boxShadow: '0 1px 0 rgba(0,0,0,0.25), 0 10px 24px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              minHeight: '100%',
            }}
          >
            {/* Manila Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderBottom: '2px solid var(--paper-ink)',
                paddingBottom: '8px',
                fontFamily: 'var(--font-head)',
                fontWeight: 700,
                fontSize: '12px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--paper-dim)',
              }}
            >
              <span>{userClub.name}</span>
              <span>
                v {oppClub.city} · MD {gameState.matchday}
              </span>
            </div>

            {/* Plans A/B/C Tabs */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {plans.map((p, pIdx) => (
                <button
                  key={pIdx}
                  onClick={() => handleSelectPlan(pIdx)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '2px',
                    padding: '6px 8px',
                    borderRadius: '3px',
                    border: '1px solid var(--paper-rule)',
                    backgroundColor: activePlanIdx === pIdx ? 'var(--paper-ink)' : 'transparent',
                    color: activePlanIdx === pIdx ? '#FFFFFF' : 'var(--paper-ink)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '13px' }}
                  >
                    Plan {['A', 'B', 'C'][pIdx]}
                  </span>
                  <span
                    style={{
                      fontSize: '10.5px',
                      color: activePlanIdx === pIdx ? '#E4DED2' : 'var(--paper-dim)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                    }}
                  >
                    {p.name}
                  </span>
                </button>
              ))}
            </div>

            {/* Formation Selector + 4 Familiarity Bars */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 140px',
                gap: '12px',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid var(--paper-rule)',
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontFamily: 'var(--font-head)',
                    fontWeight: 700,
                    fontSize: '12px',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--paper-dim)',
                    marginBottom: '4px',
                  }}
                >
                  Formation
                </label>
                <select
                  value={tactics.formation}
                  onChange={(e) => {
                    const nextFormation = e.target.value as Formation;
                    updateUserTactics({ formation: nextFormation });
                    showToast(`Formation set to ${nextFormation}`, 'info');
                  }}
                  style={{
                    width: '100%',
                    height: '36px',
                    padding: '0 8px',
                    borderRadius: '3px',
                    border: '1px solid var(--paper-rule)',
                    backgroundColor: 'var(--paper-2)',
                    color: 'var(--paper-ink)',
                    fontFamily: 'var(--font-head)',
                    fontWeight: 700,
                    fontSize: '18px',
                    cursor: 'pointer',
                  }}
                >
                  {Object.keys(FORMATIONS).map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* Familiarity Bars */}
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10.5px' }}
              >
                {[
                  { label: 'Form', score: famScores.formation },
                  { label: 'Ment', score: famScores.mentality },
                  { label: 'Pass', score: famScores.passing },
                  { label: 'Press', score: famScores.pressing },
                ].map(({ label, score }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span
                      style={{ width: '28px', color: score < 70 ? '#C42B2B' : 'var(--paper-dim)' }}
                    >
                      {label}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: '4px',
                        backgroundColor: 'var(--paper-rule)',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${score}%`,
                          backgroundColor: score < 70 ? '#C42B2B' : 'var(--paper-ink)',
                        }}
                      />
                    </div>
                    <span
                      style={{
                        width: '20px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: score < 70 ? '#C42B2B' : 'inherit',
                      }}
                    >
                      {score}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Presets Chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {PRESETS.map(([name, preset]) => (
                <button
                  key={name}
                  onClick={() => {
                    updateUserTactics({
                      instructions: {
                        ...tactics.instructions,
                        ...preset,
                      },
                    });
                    showToast(`Applied preset: ${name}`, 'info');
                  }}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '12px',
                    border: '1px solid var(--paper-rule)',
                    backgroundColor: 'transparent',
                    fontSize: '11.5px',
                    fontWeight: 500,
                    color: 'var(--paper-ink)',
                    cursor: 'pointer',
                  }}
                >
                  {name}
                </button>
              ))}
            </div>

            {/* 5 Divider Tabs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: '2px',
                borderBottom: '2px solid var(--paper-ink)',
                marginTop: '4px',
              }}
            >
              {[
                { id: 'buildup', label: 'Build-up' },
                { id: 'attack', label: 'Attack' },
                { id: 'defend', label: 'Defend' },
                { id: 'transition', label: 'Transition' },
                { id: 'setpieces', label: 'Set Pieces' },
                { id: 'matchplan', label: 'Match plan' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveDivider(id as any)}
                  style={{
                    padding: '6px 2px',
                    borderRadius: '3px 3px 0 0',
                    fontSize: '11px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-head)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    border: 'none',
                    backgroundColor: activeDivider === id ? 'var(--paper-ink)' : 'var(--paper-2)',
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
            <div style={{ minHeight: '190px' }}>
              {activeDivider === 'buildup' && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    fontSize: '12px',
                  }}
                >
                  {/* Mentality */}
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: '3px' }}>Mentality</div>
                    <div
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px' }}
                    >
                      {(
                        [
                          'VeryDefensive',
                          'Defensive',
                          'Balanced',
                          'Attacking',
                          'VeryAttacking',
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
                            padding: '5px 2px',
                            fontSize: '9.5px',
                            fontWeight: 700,
                            borderRadius: '2px',
                            border:
                              tactics.instructions.mentality === m
                                ? '1.5px solid #1F4FBF'
                                : '1px solid var(--paper-rule)',
                            backgroundColor:
                              tactics.instructions.mentality === m ? '#FFFFFF' : 'var(--paper-2)',
                            color: tactics.instructions.mentality === m ? '#1F4FBF' : 'inherit',
                            cursor: 'pointer',
                          }}
                        >
                          {m === 'VeryDefensive' ? 'V.Def' : m === 'VeryAttacking' ? 'V.Att' : m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Passing */}
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: '3px' }}>Passing Style</div>
                    <div
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}
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
                            padding: '5px 4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            borderRadius: '2px',
                            border:
                              tactics.instructions.passing === p
                                ? '1.5px solid #1F4FBF'
                                : '1px solid var(--paper-rule)',
                            backgroundColor:
                              tactics.instructions.passing === p ? '#FFFFFF' : 'var(--paper-2)',
                            color: tactics.instructions.passing === p ? '#1F4FBF' : 'inherit',
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
                    <div style={{ fontWeight: 700, marginBottom: '3px' }}>Tempo</div>
                    <div
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}
                    >
                      {(['Slow', 'Normal', 'Fast'] as Tempo[]).map((t) => (
                        <button
                          key={t}
                          onClick={() =>
                            updateUserTactics({
                              instructions: { ...tactics.instructions, tempo: t },
                            })
                          }
                          style={{
                            padding: '5px 4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            borderRadius: '2px',
                            border:
                              tactics.instructions.tempo === t
                                ? '1.5px solid #1F4FBF'
                                : '1px solid var(--paper-rule)',
                            backgroundColor:
                              tactics.instructions.tempo === t ? '#FFFFFF' : 'var(--paper-2)',
                            color: tactics.instructions.tempo === t ? '#1F4FBF' : 'inherit',
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
                    <div style={{ fontWeight: 700, marginBottom: '3px' }}>Width</div>
                    <div
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}
                    >
                      {(['Narrow', 'Normal', 'Wide'] as Width[]).map((w) => (
                        <button
                          key={w}
                          onClick={() =>
                            updateUserTactics({
                              instructions: { ...tactics.instructions, width: w },
                            })
                          }
                          style={{
                            padding: '5px 4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            borderRadius: '2px',
                            border:
                              tactics.instructions.width === w
                                ? '1.5px solid #1F4FBF'
                                : '1px solid var(--paper-rule)',
                            backgroundColor:
                              tactics.instructions.width === w ? '#FFFFFF' : 'var(--paper-2)',
                            color: tactics.instructions.width === w ? '#1F4FBF' : 'inherit',
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
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    fontSize: '12px',
                  }}
                >
                  {/* Focus */}
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: '3px' }}>Attacking Focus</div>
                    <div
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}
                    >
                      {(['Left', 'Centre', 'Right', 'Mixed'] as Focus[]).map((f) => (
                        <button
                          key={f}
                          onClick={() =>
                            updateUserTactics({
                              instructions: { ...tactics.instructions, focus: f },
                            })
                          }
                          style={{
                            padding: '5px 2px',
                            fontSize: '10.5px',
                            fontWeight: 600,
                            borderRadius: '2px',
                            border:
                              tactics.instructions.focus === f
                                ? '1.5px solid #1F4FBF'
                                : '1px solid var(--paper-rule)',
                            backgroundColor:
                              tactics.instructions.focus === f ? '#FFFFFF' : 'var(--paper-2)',
                            color: tactics.instructions.focus === f ? '#1F4FBF' : 'inherit',
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
                    <div style={{ fontWeight: 700, marginBottom: '3px' }}>Final Third</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
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
                            padding: '5px 4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            borderRadius: '2px',
                            border:
                              tactics.instructions.finalThird === id
                                ? '1.5px solid #1F4FBF'
                                : '1px solid var(--paper-rule)',
                            backgroundColor:
                              tactics.instructions.finalThird === id ? '#FFFFFF' : 'var(--paper-2)',
                            color: tactics.instructions.finalThird === id ? '#1F4FBF' : 'inherit',
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
                    <div style={{ fontWeight: 700, marginBottom: '3px' }}>Crosses</div>
                    <div
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}
                    >
                      {(['Low', 'Whipped', 'Floated', 'Mixed'] as CrossStyle[]).map((cs) => (
                        <button
                          key={cs}
                          onClick={() =>
                            updateUserTactics({
                              instructions: { ...tactics.instructions, crossStyle: cs },
                            })
                          }
                          style={{
                            padding: '5px 2px',
                            fontSize: '10.5px',
                            fontWeight: 600,
                            borderRadius: '2px',
                            border:
                              tactics.instructions.crossStyle === cs
                                ? '1.5px solid #1F4FBF'
                                : '1px solid var(--paper-rule)',
                            backgroundColor:
                              tactics.instructions.crossStyle === cs ? '#FFFFFF' : 'var(--paper-2)',
                            color: tactics.instructions.crossStyle === cs ? '#1F4FBF' : 'inherit',
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
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    fontSize: '12px',
                  }}
                >
                  {/* Pressing */}
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: '3px' }}>Pressing Line</div>
                    <div
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}
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
                            padding: '5px 4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            borderRadius: '2px',
                            border:
                              tactics.instructions.pressing === pr
                                ? '1.5px solid #1F4FBF'
                                : '1px solid var(--paper-rule)',
                            backgroundColor:
                              tactics.instructions.pressing === pr ? '#FFFFFF' : 'var(--paper-2)',
                            color: tactics.instructions.pressing === pr ? '#1F4FBF' : 'inherit',
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
                    <div style={{ fontWeight: 700, marginBottom: '3px' }}>Defensive Line</div>
                    <div
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}
                    >
                      {(['Deep', 'Normal', 'High'] as DefLine[]).map((dl) => (
                        <button
                          key={dl}
                          onClick={() =>
                            updateUserTactics({
                              instructions: { ...tactics.instructions, line: dl },
                            })
                          }
                          style={{
                            padding: '5px 4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            borderRadius: '2px',
                            border:
                              tactics.instructions.line === dl
                                ? '1.5px solid #1F4FBF'
                                : '1px solid var(--paper-rule)',
                            backgroundColor:
                              tactics.instructions.line === dl ? '#FFFFFF' : 'var(--paper-2)',
                            color: tactics.instructions.line === dl ? '#1F4FBF' : 'inherit',
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
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>Offside Trap</div>
                      <div style={{ fontSize: '11px', color: 'var(--paper-dim)' }}>
                        Step up together
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
                    <div style={{ fontWeight: 700, marginBottom: '3px' }}>Tackling</div>
                    <div
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}
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
                            padding: '5px 2px',
                            fontSize: '10.5px',
                            fontWeight: 600,
                            borderRadius: '2px',
                            border:
                              tactics.instructions.tackling === tk
                                ? '1.5px solid #1F4FBF'
                                : '1px solid var(--paper-rule)',
                            backgroundColor:
                              tactics.instructions.tackling === tk ? '#FFFFFF' : 'var(--paper-2)',
                            color: tactics.instructions.tackling === tk ? '#1F4FBF' : 'inherit',
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
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    fontSize: '12px',
                  }}
                >
                  {/* On Loss */}
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: '3px' }}>When We Lose It</div>
                    <div
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}
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
                            padding: '5px 2px',
                            fontSize: '10.5px',
                            fontWeight: 600,
                            borderRadius: '2px',
                            border:
                              tactics.instructions.onLoss === ol
                                ? '1.5px solid #1F4FBF'
                                : '1px solid var(--paper-rule)',
                            backgroundColor:
                              tactics.instructions.onLoss === ol ? '#FFFFFF' : 'var(--paper-2)',
                            color: tactics.instructions.onLoss === ol ? '#1F4FBF' : 'inherit',
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
                    <div style={{ fontWeight: 700, marginBottom: '3px' }}>When We Win It</div>
                    <div
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}
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
                            padding: '5px 2px',
                            fontSize: '10.5px',
                            fontWeight: 600,
                            borderRadius: '2px',
                            border:
                              tactics.instructions.onWin === ow
                                ? '1.5px solid #1F4FBF'
                                : '1px solid var(--paper-rule)',
                            backgroundColor:
                              tactics.instructions.onWin === ow ? '#FFFFFF' : 'var(--paper-2)',
                            color: tactics.instructions.onWin === ow ? '#1F4FBF' : 'inherit',
                            cursor: 'pointer',
                          }}
                        >
                          {ow === 'KeepIt' ? 'Hold shape' : ow}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Distribution */}
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: '3px' }}>
                      Goalkeeper Distribution
                    </div>
                    <div
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}
                    >
                      {(['RollOut', 'LongKick', 'QuickThrow', 'Mixed'] as Distribution[]).map(
                        (d) => (
                          <button
                            key={d}
                            onClick={() =>
                              updateUserTactics({
                                instructions: { ...tactics.instructions, distribution: d },
                              })
                            }
                            style={{
                              padding: '5px 2px',
                              fontSize: '10px',
                              fontWeight: 600,
                              borderRadius: '2px',
                              border:
                                tactics.instructions.distribution === d
                                  ? '1.5px solid #1F4FBF'
                                  : '1px solid var(--paper-rule)',
                              backgroundColor:
                                tactics.instructions.distribution === d
                                  ? '#FFFFFF'
                                  : 'var(--paper-2)',
                              color:
                                tactics.instructions.distribution === d ? '#1F4FBF' : 'inherit',
                              cursor: 'pointer',
                            }}
                          >
                            {d}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeDivider === 'matchplan' && (
                <MatchPlanSheet tactics={tactics} onChange={updateUserTactics} />
              )}

              {activeDivider === 'setpieces' && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    fontSize: '12px',
                  }}
                >
                  {/* Sub-tab pills within the sheet */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gap: '4px',
                      backgroundColor: 'var(--paper-2)',
                      padding: '3px',
                      borderRadius: '4px',
                      border: '1px solid var(--paper-rule)',
                    }}
                  >
                    {[
                      { id: 'ourCorners', label: 'Our Cnr' },
                      { id: 'theirCorners', label: 'Opp Cnr' },
                      { id: 'ourFK', label: 'Our FK' },
                      { id: 'theirFK', label: 'Opp FK' },
                      { id: 'takers', label: 'Takers' },
                    ].map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => setSetPieceSubTab(id as any)}
                        style={{
                          padding: '5px 2px',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          borderRadius: '3px',
                          border: 'none',
                          backgroundColor: setPieceSubTab === id ? '#1F4FBF' : 'transparent',
                          color: setPieceSubTab === id ? '#FFFFFF' : 'var(--paper-dim)',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* TAB 1: OUR CORNERS */}
                  {setPieceSubTab === 'ourCorners' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* Left/Right Side Switch */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}
                        >
                          Delivery Flank
                        </span>
                        <div style={{ display: 'flex', gap: '3px' }}>
                          {(['left', 'right'] as const).map((side) => (
                            <button
                              key={side}
                              onClick={() => setCornerSide(side)}
                              style={{
                                padding: '3px 8px',
                                fontSize: '11px',
                                fontWeight: 600,
                                borderRadius: '2px',
                                border:
                                  cornerSide === side
                                    ? '1px solid #1F4FBF'
                                    : '1px solid var(--paper-rule)',
                                backgroundColor: cornerSide === side ? '#FFFFFF' : 'var(--paper-2)',
                                color: cornerSide === side ? '#1F4FBF' : 'inherit',
                                cursor: 'pointer',
                              }}
                            >
                              {side === 'left' ? 'Left Corner' : 'Right Corner'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Routines 1, 2, 3 Selector */}
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '4px',
                          }}
                        >
                          <span style={{ fontWeight: 700, fontSize: '11px' }}>
                            Routines (Up to 3 per side)
                          </span>
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={
                                (cornerSide === 'left'
                                  ? setPieces.leftCorners
                                  : setPieces.rightCorners
                                )?.rotate ?? false
                              }
                              onChange={(e) =>
                                updateSetPieces((sp) => {
                                  const side =
                                    cornerSide === 'left' ? sp.leftCorners : sp.rightCorners;
                                  side.rotate = e.target.checked;
                                  return sp;
                                })
                              }
                            />
                            <span>Rotate in turn</span>
                          </label>
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '4px',
                          }}
                        >
                          {[0, 1, 2].map((idx) => {
                            const r = (
                              cornerSide === 'left' ? setPieces.leftCorners : setPieces.rightCorners
                            )?.routines[idx];
                            const isCur = routineIdx === idx;
                            return (
                              <button
                                key={idx}
                                onClick={() => setRoutineIdx(idx)}
                                style={{
                                  padding: '6px 4px',
                                  fontSize: '11px',
                                  borderRadius: '3px',
                                  border: isCur
                                    ? '1.5px solid #1F4FBF'
                                    : '1px solid var(--paper-rule)',
                                  backgroundColor: isCur ? '#FFFFFF' : 'var(--paper-2)',
                                  color: isCur ? '#1F4FBF' : 'inherit',
                                  cursor: 'pointer',
                                  textAlign: 'center',
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {r?.name ?? `Routine ${idx + 1}`}
                                </div>
                                <div style={{ fontSize: '9.5px', color: 'var(--paper-dim)' }}>
                                  Fam: {r?.familiarity ?? 70}%
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Routine Rename & Familiarity Bar */}
                      <div
                        style={{
                          backgroundColor: 'var(--paper-2)',
                          padding: '8px',
                          borderRadius: '3px',
                          border: '1px solid var(--paper-rule)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '6px',
                          }}
                        >
                          {editingRoutineName !== null ? (
                            <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                              <input
                                value={renamingText}
                                onChange={(e) => setRenamingText(e.target.value)}
                                style={{
                                  flex: 1,
                                  padding: '3px 6px',
                                  fontSize: '11px',
                                  borderRadius: '2px',
                                  border: '1px solid var(--paper-rule)',
                                }}
                              />
                              <button
                                onClick={() => {
                                  if (renamingText.trim()) {
                                    updateSetPieces((sp) => {
                                      const side =
                                        cornerSide === 'left' ? sp.leftCorners : sp.rightCorners;
                                      const r = side?.routines[routineIdx];
                                      if (r) r.name = renamingText.trim();
                                      return sp;
                                    });
                                  }
                                  setEditingRoutineName(null);
                                }}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '10px',
                                  backgroundColor: '#1F4FBF',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '2px',
                                  cursor: 'pointer',
                                }}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingRoutineName(null)}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '10px',
                                  backgroundColor: 'var(--paper-rule)',
                                  border: 'none',
                                  borderRadius: '2px',
                                  cursor: 'pointer',
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <span style={{ fontWeight: 700, fontSize: '12px' }}>
                                {currentRoutine.name}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingRoutineName(currentRoutine.name);
                                  setRenamingText(currentRoutine.name);
                                }}
                                style={{
                                  fontSize: '10.5px',
                                  color: '#1F4FBF',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                }}
                              >
                                Rename
                              </button>
                            </>
                          )}
                        </div>

                        {/* Familiarity Bar */}
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '10px',
                              color: 'var(--paper-dim)',
                              marginBottom: '2px',
                            }}
                          >
                            <span>Familiarity (Sharpness)</span>
                            <span
                              style={{
                                fontWeight: 700,
                                color: currentRoutine.familiarity >= 70 ? '#1E7B3C' : '#C42B2B',
                              }}
                            >
                              {currentRoutine.familiarity}/100
                            </span>
                          </div>
                          <div
                            style={{
                              height: '6px',
                              backgroundColor: 'var(--paper-rule)',
                              borderRadius: '3px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${currentRoutine.familiarity}%`,
                                height: '100%',
                                backgroundColor:
                                  currentRoutine.familiarity >= 70 ? '#1E7B3C' : '#D97706',
                              }}
                            />
                          </div>
                          {currentRoutine.familiarity < 70 && (
                            <div style={{ color: '#D97706', fontSize: '10px', marginTop: '3px' }}>
                              Practise it in training (Set-piece practice)
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Routine Target Selector */}
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: '3px' }}>Target Zone</div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(5, 1fr)',
                            gap: '3px',
                          }}
                        >
                          {(['Near', 'Far', 'Spot', 'Short', 'Mixed'] as CornerTarget[]).map(
                            (tgt) => (
                              <button
                                key={tgt}
                                onClick={() =>
                                  updateSetPieces((sp) => {
                                    const side =
                                      cornerSide === 'left' ? sp.leftCorners : sp.rightCorners;
                                    const r = side?.routines[routineIdx];
                                    if (r) r.target = tgt;
                                    return sp;
                                  })
                                }
                                style={{
                                  padding: '5px 2px',
                                  fontSize: '10.5px',
                                  fontWeight: 600,
                                  borderRadius: '2px',
                                  border:
                                    currentRoutine.target === tgt
                                      ? '1.5px solid #1F4FBF'
                                      : '1px solid var(--paper-rule)',
                                  backgroundColor:
                                    currentRoutine.target === tgt ? '#FFFFFF' : 'var(--paper-2)',
                                  color: currentRoutine.target === tgt ? '#1F4FBF' : 'inherit',
                                  cursor: 'pointer',
                                }}
                              >
                                {tgt}
                              </button>
                            ),
                          )}
                        </div>
                        {/* Target Gain & Cost line */}
                        <div
                          style={{
                            marginTop: '4px',
                            fontSize: '10.5px',
                            padding: '4px 6px',
                            backgroundColor: 'var(--paper-2)',
                            borderRadius: '2px',
                          }}
                        >
                          {currentRoutine.target === 'Near' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Near post flick-on/header (weight ×2)
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Narrower angle; keeper cuts out misjudged crosses
                              </div>
                            </>
                          )}
                          {currentRoutine.target === 'Far' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Target man mismatch at back post (weight ×2)
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Longer flight time; lower conversion on direct headers
                              </div>
                            </>
                          )}
                          {currentRoutine.target === 'Spot' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Won headers use BOX_CENTRAL 30% of time, +3% on target
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Congested spot; header duel −0.05
                              </div>
                            </>
                          )}
                          {currentRoutine.target === 'Short' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Better crossing angle (+0.3 progress)
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Takes an extra attacker outside the box
                              </div>
                            </>
                          )}
                          {currentRoutine.target === 'Mixed' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Varied delivery keeps defenders guessing
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Less tailored to specific aerial strengths
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Routine Swing Selector */}
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: '3px' }}>Delivery Swing</div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '3px',
                          }}
                        >
                          {(['Auto', 'In', 'Out'] as CornerSwingChoice[]).map((sw) => (
                            <button
                              key={sw}
                              onClick={() =>
                                updateSetPieces((sp) => {
                                  const side =
                                    cornerSide === 'left' ? sp.leftCorners : sp.rightCorners;
                                  const r = side?.routines[routineIdx];
                                  if (r) r.swing = sw;
                                  return sp;
                                })
                              }
                              style={{
                                padding: '5px 4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                borderRadius: '2px',
                                border:
                                  currentRoutine.swing === sw
                                    ? '1.5px solid #1F4FBF'
                                    : '1px solid var(--paper-rule)',
                                backgroundColor:
                                  currentRoutine.swing === sw ? '#FFFFFF' : 'var(--paper-2)',
                                color: currentRoutine.swing === sw ? '#1F4FBF' : 'inherit',
                                cursor: 'pointer',
                              }}
                            >
                              {sw === 'Auto'
                                ? 'Auto (Foot)'
                                : sw === 'In'
                                  ? 'Inswinger'
                                  : 'Outswinger'}
                            </button>
                          ))}
                        </div>
                        <div
                          style={{
                            marginTop: '4px',
                            fontSize: '10.5px',
                            padding: '4px 6px',
                            backgroundColor: 'var(--paper-2)',
                            borderRadius: '2px',
                          }}
                        >
                          {currentRoutine.swing === 'Auto' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Natural curl based on taker footedness
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Predictable curl for the defending keeper
                              </div>
                            </>
                          )}
                          {currentRoutine.swing === 'In' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Dangerous curve towards goal into six-yard box
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Delivery penalty (−0.08) if taker foot is mismatched
                              </div>
                            </>
                          )}
                          {currentRoutine.swing === 'Out' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Curves away from keeper to arriving runners
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Delivery penalty (−0.08) if taker foot is mismatched
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Auto Jobs Reset */}
                      <button
                        onClick={resetToAutoJobs}
                        style={{
                          padding: '6px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: '#1F4FBF',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        Reset to Auto Jobs (§13.20.1)
                      </button>
                    </div>
                  )}

                  {/* TAB 2: OPPOSITION CORNERS */}
                  {setPieceSubTab === 'theirCorners' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* Marking Style */}
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: '3px' }}>Marking Style</div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '3px',
                          }}
                        >
                          {(['Zonal', 'Man-mark', 'Mixed'] as CornersAgainst[]).map((m) => (
                            <button
                              key={m}
                              onClick={() =>
                                updateSetPieces((sp) => {
                                  sp.defending.cornersAgainst = m;
                                  return sp;
                                })
                              }
                              style={{
                                padding: '5px 4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                borderRadius: '2px',
                                border:
                                  setPieces.defending.cornersAgainst === m
                                    ? '1.5px solid #1F4FBF'
                                    : '1px solid var(--paper-rule)',
                                backgroundColor:
                                  setPieces.defending.cornersAgainst === m
                                    ? '#FFFFFF'
                                    : 'var(--paper-2)',
                                color:
                                  setPieces.defending.cornersAgainst === m ? '#1F4FBF' : 'inherit',
                                cursor: 'pointer',
                              }}
                            >
                              {m === 'ManMark' ? 'Man-mark' : m}
                            </button>
                          ))}
                        </div>
                        <div
                          style={{
                            marginTop: '4px',
                            fontSize: '10.5px',
                            padding: '4px 6px',
                            backgroundColor: 'var(--paper-2)',
                            borderRadius: '2px',
                          }}
                        >
                          {setPieces.defending.cornersAgainst === 'Zonal' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Guards danger zones; strong against static crosses
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Vulnerable to aggressive runners attacking space
                              </div>
                            </>
                          )}
                          {setPieces.defending.cornersAgainst === 'ManMark' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Tight coverage on individual threats (−0.15 duel)
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Defenders get dragged out of position by decoy runs
                              </div>
                            </>
                          )}
                          {setPieces.defending.cornersAgainst === 'Mixed' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Balance of zonal coverage and marking key men
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Moderate strengths in both systems
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Mark Main Man */}
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: '3px' }}>
                          Mark Their Main Man
                        </div>
                        <select
                          value={setPieces.defending.markMainMan ?? ''}
                          onChange={(e) =>
                            updateSetPieces((sp) => {
                              sp.defending.markMainMan = e.target.value || null;
                              return sp;
                            })
                          }
                          style={{
                            width: '100%',
                            padding: '4px',
                            borderRadius: '2px',
                            border: '1px solid var(--paper-rule)',
                            backgroundColor: 'var(--paper-2)',
                            fontSize: '11px',
                          }}
                        >
                          <option value="">Auto (Our Best Aerial Defender)</option>
                          {starters
                            .filter((s) => s.player && s.slotDef.slot > 0)
                            .map(({ player }) => (
                              <option key={player!.id} value={player!.id}>
                                {player!.firstName} {player!.lastName} (H:{' '}
                                {player!.attributes.heading}, S: {player!.attributes.strength})
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Men on Posts */}
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: '3px' }}>Men on Posts</div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '3px',
                          }}
                        >
                          {(['None', 'Near', 'Both'] as PostMen[]).map((pm) => (
                            <button
                              key={pm}
                              onClick={() => {
                                updateUserTactics({
                                  instructions: { ...tactics.instructions, postMen: pm },
                                });
                              }}
                              style={{
                                padding: '5px 2px',
                                fontSize: '11px',
                                fontWeight: 600,
                                borderRadius: '2px',
                                border:
                                  tactics.instructions.postMen === pm
                                    ? '1.5px solid #1F4FBF'
                                    : '1px solid var(--paper-rule)',
                                backgroundColor:
                                  tactics.instructions.postMen === pm
                                    ? '#FFFFFF'
                                    : 'var(--paper-2)',
                                color: tactics.instructions.postMen === pm ? '#1F4FBF' : 'inherit',
                                cursor: 'pointer',
                              }}
                            >
                              {pm === 'None' ? 'None' : pm === 'Near' ? 'Near Post' : 'Both Posts'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Edge Guard */}
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>Edge Guard (D)</span>
                          <button
                            onClick={() =>
                              updateSetPieces((sp) => {
                                sp.defending.edgeGuard = !sp.defending.edgeGuard;
                                return sp;
                              })
                            }
                            style={{
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              borderRadius: '2px',
                              border: setPieces.defending.edgeGuard
                                ? '1.5px solid #1F4FBF'
                                : '1px solid var(--paper-rule)',
                              backgroundColor: setPieces.defending.edgeGuard
                                ? '#FFFFFF'
                                : 'var(--paper-2)',
                              color: setPieces.defending.edgeGuard ? '#1F4FBF' : 'inherit',
                              cursor: 'pointer',
                            }}
                          >
                            {setPieces.defending.edgeGuard ? 'Guard D (1 man)' : 'None (0)'}
                          </button>
                        </div>
                        <div
                          style={{
                            marginTop: '4px',
                            fontSize: '10.5px',
                            padding: '4px 6px',
                            backgroundColor: 'var(--paper-2)',
                            borderRadius: '2px',
                          }}
                        >
                          {setPieces.defending.edgeGuard ? (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Opponent second balls −10%, long shot xG −0.02
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: One fewer defender in box; opp header duel +0.04
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Extra body packed inside the penalty box
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Opponent wins second balls outside the D
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Forwards Up */}
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: '3px' }}>Forwards Up</div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '3px',
                          }}
                        >
                          {([0, 1, 2] as ForwardsUp[]).map((f) => (
                            <button
                              key={f}
                              onClick={() =>
                                updateSetPieces((sp) => {
                                  sp.defending.forwardsUp = f;
                                  return sp;
                                })
                              }
                              style={{
                                padding: '5px 4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                borderRadius: '2px',
                                border:
                                  setPieces.defending.forwardsUp === f
                                    ? '1.5px solid #1F4FBF'
                                    : '1px solid var(--paper-rule)',
                                backgroundColor:
                                  setPieces.defending.forwardsUp === f
                                    ? '#FFFFFF'
                                    : 'var(--paper-2)',
                                color: setPieces.defending.forwardsUp === f ? '#1F4FBF' : 'inherit',
                                cursor: 'pointer',
                              }}
                            >
                              {f === 0
                                ? '0 (Drop all)'
                                : f === 1
                                  ? '1 Up (Default)'
                                  : '2 Up (Counter)'}
                            </button>
                          ))}
                        </div>
                        <div
                          style={{
                            marginTop: '4px',
                            fontSize: '10.5px',
                            padding: '4px 6px',
                            backgroundColor: 'var(--paper-2)',
                            borderRadius: '2px',
                          }}
                        >
                          {setPieces.defending.forwardsUp === 0 && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Maximum box packing; opp header duel −0.05
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Clearances never trigger a Counter phase
                              </div>
                            </>
                          )}
                          {setPieces.defending.forwardsUp === 1 && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Balanced defensive shape with outlet forward
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Standard counter-attack odds
                              </div>
                            </>
                          )}
                          {setPieces.defending.forwardsUp === 2 && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: 35% of won clearances trigger instant Counter phase
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Opponent header duel +0.06 in our box
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: OUR FREE KICKS */}
                  {setPieceSubTab === 'ourFK' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* Central (<30m) */}
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: '3px' }}>
                          Central (&lt;30m)
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '3px',
                          }}
                        >
                          {(
                            [
                              'Shoot',
                              'CrossNear',
                              'CrossFar',
                              'Short',
                              'Dummy',
                              'Mixed',
                            ] as CentralFreeKickOption[]
                          ).map((opt) => (
                            <button
                              key={opt}
                              onClick={() =>
                                updateSetPieces((sp) => {
                                  sp.freeKicks.central = opt;
                                  return sp;
                                })
                              }
                              style={{
                                padding: '4px 2px',
                                fontSize: '10px',
                                fontWeight: 600,
                                borderRadius: '2px',
                                border:
                                  setPieces.freeKicks.central === opt
                                    ? '1.5px solid #1F4FBF'
                                    : '1px solid var(--paper-rule)',
                                backgroundColor:
                                  setPieces.freeKicks.central === opt
                                    ? '#FFFFFF'
                                    : 'var(--paper-2)',
                                color: setPieces.freeKicks.central === opt ? '#1F4FBF' : 'inherit',
                                cursor: 'pointer',
                              }}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                        <div
                          style={{
                            marginTop: '4px',
                            fontSize: '10.5px',
                            padding: '4px 6px',
                            backgroundColor: 'var(--paper-2)',
                            borderRadius: '2px',
                          }}
                        >
                          {setPieces.freeKicks.central === 'Dummy' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: DIRECT_FK xG +0.02, wall block −0.05 (2nd taker strikes)
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: 20% mistimed dummy results in recycle with no shot
                              </div>
                            </>
                          )}
                          {setPieces.freeKicks.central === 'Shoot' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Direct shot at goal by best set-piece specialist
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Tough to beat a well-positioned wall
                              </div>
                            </>
                          )}
                          {setPieces.freeKicks.central === 'Short' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Safe retention +0.3 progress towards box
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Passes up direct shooting opportunity
                              </div>
                            </>
                          )}
                          {setPieces.freeKicks.central === 'CrossNear' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Cross delivery to near post aerial runners
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Keeper positioned to cut it out
                              </div>
                            </>
                          )}
                          {setPieces.freeKicks.central === 'CrossFar' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Cross delivery to back post mismatch
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Lower conversion angle on header
                              </div>
                            </>
                          )}
                          {setPieces.freeKicks.central === 'Mixed' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Taker decides based on wall and runners
                              </div>
                              <div style={{ color: '#C42B2B' }}>Costs: Unpredictable execution</div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Wide */}
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: '3px' }}>Wide Free Kicks</div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '3px',
                          }}
                        >
                          {(
                            [
                              'CrossNear',
                              'CrossFar',
                              'ToTheSpot',
                              'Short',
                              'Mixed',
                            ] as WideFreeKickOption[]
                          ).map((opt) => (
                            <button
                              key={opt}
                              onClick={() =>
                                updateSetPieces((sp) => {
                                  sp.freeKicks.wide = opt;
                                  return sp;
                                })
                              }
                              style={{
                                padding: '4px 2px',
                                fontSize: '10px',
                                fontWeight: 600,
                                borderRadius: '2px',
                                border:
                                  setPieces.freeKicks.wide === opt
                                    ? '1.5px solid #1F4FBF'
                                    : '1px solid var(--paper-rule)',
                                backgroundColor:
                                  setPieces.freeKicks.wide === opt ? '#FFFFFF' : 'var(--paper-2)',
                                color: setPieces.freeKicks.wide === opt ? '#1F4FBF' : 'inherit',
                                cursor: 'pointer',
                              }}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Deep */}
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: '3px' }}>Deep Free Kicks</div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '3px',
                          }}
                        >
                          {(['Quick', 'Long', 'Keep'] as DeepFreeKickOption[]).map((opt) => (
                            <button
                              key={opt}
                              onClick={() =>
                                updateSetPieces((sp) => {
                                  sp.freeKicks.deep = opt;
                                  return sp;
                                })
                              }
                              style={{
                                padding: '4px 2px',
                                fontSize: '10px',
                                fontWeight: 600,
                                borderRadius: '2px',
                                border:
                                  setPieces.freeKicks.deep === opt
                                    ? '1.5px solid #1F4FBF'
                                    : '1px solid var(--paper-rule)',
                                backgroundColor:
                                  setPieces.freeKicks.deep === opt ? '#FFFFFF' : 'var(--paper-2)',
                                color: setPieces.freeKicks.deep === opt ? '#1F4FBF' : 'inherit',
                                cursor: 'pointer',
                              }}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                        <div
                          style={{
                            marginTop: '4px',
                            fontSize: '10.5px',
                            padding: '4px 6px',
                            backgroundColor: 'var(--paper-2)',
                            borderRadius: '2px',
                          }}
                        >
                          {setPieces.freeKicks.deep === 'Quick' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>Gives: Next step progress +0.3</div>
                              <div style={{ color: '#C42B2B' }}>Costs: 15% are rushed and lost</div>
                            </>
                          )}
                          {setPieces.freeKicks.deep === 'Long' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Cross delivery from deep to best aerial target
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Deep delivery context penalty (−0.2)
                              </div>
                            </>
                          )}
                          {setPieces.freeKicks.deep === 'Keep' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Safely retains possession and recycles play
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: No immediate territorial gain
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: OPPOSITION FREE KICKS */}
                  {setPieceSubTab === 'theirFK' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* Wall Size */}
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: '3px' }}>Defending Wall</div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '3px',
                          }}
                        >
                          {(['Auto', 'Small', 'Big'] as WallOption[]).map((w) => (
                            <button
                              key={w}
                              onClick={() =>
                                updateSetPieces((sp) => {
                                  sp.defending.wall = w;
                                  return sp;
                                })
                              }
                              style={{
                                padding: '5px 4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                borderRadius: '2px',
                                border:
                                  setPieces.defending.wall === w
                                    ? '1.5px solid #1F4FBF'
                                    : '1px solid var(--paper-rule)',
                                backgroundColor:
                                  setPieces.defending.wall === w ? '#FFFFFF' : 'var(--paper-2)',
                                color: setPieces.defending.wall === w ? '#1F4FBF' : 'inherit',
                                cursor: 'pointer',
                              }}
                            >
                              {w === 'Auto'
                                ? 'Auto (3-5)'
                                : w === 'Small'
                                  ? 'Small (2)'
                                  : 'Big (+1)'}
                            </button>
                          ))}
                        </div>
                        <div
                          style={{
                            marginTop: '4px',
                            fontSize: '10.5px',
                            padding: '4px 6px',
                            backgroundColor: 'var(--paper-2)',
                            borderRadius: '2px',
                          }}
                        >
                          {setPieces.defending.wall === 'Auto' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Standard wall based on distance (20% block)
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Normal cross duel dynamics
                              </div>
                            </>
                          )}
                          {setPieces.defending.wall === 'Small' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: More markers in box; opp cross header duel −0.05
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Block chance drops to 12%, xG +0.01
                              </div>
                            </>
                          )}
                          {setPieces.defending.wall === 'Big' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Higher direct wall block chance (26%)
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Fewer markers in box; opp header duel +0.05
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Wide FK Line Height */}
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: '3px' }}>
                          Wide Free Kick Line Height
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '3px',
                          }}
                        >
                          {(['High', 'Normal', 'Deep'] as LineHeightOption[]).map((lh) => (
                            <button
                              key={lh}
                              onClick={() =>
                                updateSetPieces((sp) => {
                                  sp.defending.lineHeight = lh;
                                  return sp;
                                })
                              }
                              style={{
                                padding: '5px 4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                borderRadius: '2px',
                                border:
                                  setPieces.defending.lineHeight === lh
                                    ? '1.5px solid #1F4FBF'
                                    : '1px solid var(--paper-rule)',
                                backgroundColor:
                                  setPieces.defending.lineHeight === lh
                                    ? '#FFFFFF'
                                    : 'var(--paper-2)',
                                color:
                                  setPieces.defending.lineHeight === lh ? '#1F4FBF' : 'inherit',
                                cursor: 'pointer',
                              }}
                            >
                              {lh}
                            </button>
                          ))}
                        </div>
                        <div
                          style={{
                            marginTop: '4px',
                            fontSize: '10.5px',
                            padding: '4px 6px',
                            backgroundColor: 'var(--paper-2)',
                            borderRadius: '2px',
                          }}
                        >
                          {setPieces.defending.lineHeight === 'High' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: 20% of deliveries caught offside
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: When beaten, opponent header xG +0.03
                              </div>
                            </>
                          )}
                          {setPieces.defending.lineHeight === 'Normal' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Balanced positioning and line depth
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Standard aerial duel odds
                              </div>
                            </>
                          )}
                          {setPieces.defending.lineHeight === 'Deep' && (
                            <>
                              <div style={{ color: '#1E7B3C' }}>
                                Gives: Goalkeeper claim chance +0.04
                              </div>
                              <div style={{ color: '#C42B2B' }}>
                                Costs: Opponent second balls to attackers +10%
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: TAKERS */}
                  {setPieceSubTab === 'takers' && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        fontSize: '11.5px',
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: '2px' }}>
                        Specialist Takers (§13.20.3)
                      </div>

                      {/* Left Corner */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '90px 1fr',
                          gap: '6px',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ color: 'var(--paper-dim)' }}>Left Corner</span>
                        <select
                          value={tactics.takers?.leftCorner ?? ''}
                          onChange={(e) =>
                            updateUserTactics({
                              takers: { ...tactics.takers, leftCorner: e.target.value || null },
                            })
                          }
                          style={{
                            padding: '3px',
                            borderRadius: '2px',
                            border: '1px solid var(--paper-rule)',
                            backgroundColor: 'var(--paper-2)',
                          }}
                        >
                          <option value="">Auto (Right-footed inswinger)</option>
                          {starters
                            .filter((s) => s.player)
                            .map(({ player }) => (
                              <option key={player!.id} value={player!.id}>
                                {player!.firstName} {player!.lastName} ({player!.foot ?? 'Right'},
                                SP: {player!.attributes.setPieces})
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Right Corner */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '90px 1fr',
                          gap: '6px',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ color: 'var(--paper-dim)' }}>Right Corner</span>
                        <select
                          value={tactics.takers?.rightCorner ?? ''}
                          onChange={(e) =>
                            updateUserTactics({
                              takers: { ...tactics.takers, rightCorner: e.target.value || null },
                            })
                          }
                          style={{
                            padding: '3px',
                            borderRadius: '2px',
                            border: '1px solid var(--paper-rule)',
                            backgroundColor: 'var(--paper-2)',
                          }}
                        >
                          <option value="">Auto (Left-footed inswinger)</option>
                          {starters
                            .filter((s) => s.player)
                            .map(({ player }) => (
                              <option key={player!.id} value={player!.id}>
                                {player!.firstName} {player!.lastName} ({player!.foot ?? 'Right'},
                                SP: {player!.attributes.setPieces})
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Direct Free Kick */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '90px 1fr',
                          gap: '6px',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ color: 'var(--paper-dim)' }}>Direct FK</span>
                        <select
                          value={tactics.takers?.directFreeKick ?? tactics.takers?.freeKick ?? ''}
                          onChange={(e) =>
                            updateUserTactics({
                              takers: {
                                ...tactics.takers,
                                directFreeKick: e.target.value || null,
                                freeKick: e.target.value || null,
                              },
                            })
                          }
                          style={{
                            padding: '3px',
                            borderRadius: '2px',
                            border: '1px solid var(--paper-rule)',
                            backgroundColor: 'var(--paper-2)',
                          }}
                        >
                          <option value="">Auto (Best Set Pieces)</option>
                          {starters
                            .filter((s) => s.player)
                            .map(({ player }) => (
                              <option key={player!.id} value={player!.id}>
                                {player!.firstName} {player!.lastName} (SP:{' '}
                                {player!.attributes.setPieces})
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Wide Free Kick */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '90px 1fr',
                          gap: '6px',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ color: 'var(--paper-dim)' }}>Wide FK</span>
                        <select
                          value={tactics.takers?.wideFreeKick ?? ''}
                          onChange={(e) =>
                            updateUserTactics({
                              takers: { ...tactics.takers, wideFreeKick: e.target.value || null },
                            })
                          }
                          style={{
                            padding: '3px',
                            borderRadius: '2px',
                            border: '1px solid var(--paper-rule)',
                            backgroundColor: 'var(--paper-2)',
                          }}
                        >
                          <option value="">Auto (Best Crossing/SP)</option>
                          {starters
                            .filter((s) => s.player)
                            .map(({ player }) => (
                              <option key={player!.id} value={player!.id}>
                                {player!.firstName} {player!.lastName} (SP:{' '}
                                {player!.attributes.setPieces})
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Penalty 1 */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '90px 1fr',
                          gap: '6px',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ color: 'var(--paper-dim)' }}>Penalty 1st</span>
                        <select
                          value={tactics.takers?.penalties?.[0] ?? tactics.takers?.penalty ?? ''}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            const ord = [...(tactics.takers?.penalties ?? [null, null, null])];
                            ord[0] = val;
                            updateUserTactics({
                              takers: { ...tactics.takers, penalty: val, penalties: ord },
                            });
                          }}
                          style={{
                            padding: '3px',
                            borderRadius: '2px',
                            border: '1px solid var(--paper-rule)',
                            backgroundColor: 'var(--paper-2)',
                          }}
                        >
                          <option value="">Auto (Best Penalty/Finishing)</option>
                          {starters
                            .filter((s) => s.player)
                            .map(({ player }) => (
                              <option key={player!.id} value={player!.id}>
                                {player!.firstName} {player!.lastName} (Fin:{' '}
                                {player!.attributes.finishing})
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Penalty 2 */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '90px 1fr',
                          gap: '6px',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ color: 'var(--paper-dim)' }}>Penalty 2nd</span>
                        <select
                          value={tactics.takers?.penalties?.[1] ?? ''}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            const ord = [...(tactics.takers?.penalties ?? [null, null, null])];
                            ord[1] = val;
                            updateUserTactics({
                              takers: { ...tactics.takers, penalties: ord },
                            });
                          }}
                          style={{
                            padding: '3px',
                            borderRadius: '2px',
                            border: '1px solid var(--paper-rule)',
                            backgroundColor: 'var(--paper-2)',
                          }}
                        >
                          <option value="">Auto (2nd Best)</option>
                          {starters
                            .filter((s) => s.player)
                            .map(({ player }) => (
                              <option key={player!.id} value={player!.id}>
                                {player!.firstName} {player!.lastName} (Fin:{' '}
                                {player!.attributes.finishing})
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Penalty 3 */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '90px 1fr',
                          gap: '6px',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ color: 'var(--paper-dim)' }}>Penalty 3rd</span>
                        <select
                          value={tactics.takers?.penalties?.[2] ?? ''}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            const ord = [...(tactics.takers?.penalties ?? [null, null, null])];
                            ord[2] = val;
                            updateUserTactics({
                              takers: { ...tactics.takers, penalties: ord },
                            });
                          }}
                          style={{
                            padding: '3px',
                            borderRadius: '2px',
                            border: '1px solid var(--paper-rule)',
                            backgroundColor: 'var(--paper-2)',
                          }}
                        >
                          <option value="">Auto (3rd Best)</option>
                          {starters
                            .filter((s) => s.player)
                            .map(({ player }) => (
                              <option key={player!.id} value={player!.id}>
                                {player!.firstName} {player!.lastName} (Fin:{' '}
                                {player!.attributes.finishing})
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Long Throw */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '90px 1fr',
                          gap: '6px',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ color: 'var(--paper-dim)' }}>Long Throw</span>
                        <select
                          value={tactics.takers?.longThrow ?? ''}
                          onChange={(e) =>
                            updateUserTactics({
                              takers: { ...tactics.takers, longThrow: e.target.value || null },
                            })
                          }
                          style={{
                            padding: '3px',
                            borderRadius: '2px',
                            border: '1px solid var(--paper-rule)',
                            backgroundColor: 'var(--paper-2)',
                          }}
                        >
                          <option value="">Auto (Best Strength/FBs)</option>
                          {starters
                            .filter((s) => s.player)
                            .map(({ player }) => (
                              <option key={player!.id} value={player!.id}>
                                {player!.firstName} {player!.lastName} (Str:{' '}
                                {player!.attributes.strength})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Readiness Line */}
            <div
              style={{
                borderTop: '2px solid var(--paper-ink)',
                paddingTop: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontFamily: 'var(--font-head)',
                fontWeight: 700,
                fontSize: '13px',
                textTransform: 'uppercase',
                color: validation.valid ? '#1E7B3C' : '#C42B2B',
              }}
            >
              {validation.valid ? (
                <>
                  <CheckCircle2 size={16} /> Ready for Saturday
                </>
              ) : (
                <>
                  <AlertTriangle size={16} /> {validation.reason ?? 'Lineup needs attention'}
                </>
              )}
            </div>

            {/* Action Buttons: Best XI & Reset Style */}
            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '8px' }}>
              <button
                onClick={autoPickBestLineup}
                style={{
                  flex: 1,
                  height: '34px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  borderRadius: '3px',
                  backgroundColor: 'var(--paper-ink, #1B1A17)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                <Wand2 size={14} /> Assistant picks best XI
              </button>
              <button
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
                style={{
                  height: '34px',
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  borderRadius: '3px',
                  border: '1px solid var(--paper-ink)',
                  backgroundColor: 'transparent',
                  color: 'var(--paper-ink)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
