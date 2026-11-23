// Implements SPEC §11.8 Tactics Screen (v5 Two-Column Sideways Layout, SPEC 1.7)
// Reference: docs/design/tactics/README.md "v5 layout (build this)" & docs/design/tactics/index.html
// Column 1 (Left): Dominant Whiteboard lying sideways (own goal left, attacking right), bench strip & injured corner under pitch, marker tray
// Column 2 (Right): Tall Panel: Clipboard when nothing selected, Player File (with RadarChart, Orders & Profile tabs) when player selected
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

  // Right column active divider: 'buildup' | 'attack' | 'defend' | 'transition' | 'setpieces'
  const [activeDivider, setActiveDivider] = useState<
    'buildup' | 'attack' | 'defend' | 'transition' | 'setpieces'
  >('buildup');

  // Player file sub-tab: 'orders' | 'profile'
  const [fileTab, setFileTab] = useState<'orders' | 'profile'>('orders');

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
        height: 'calc(100vh - 56px)',
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
        {/* Frame Top Edge: Folder Tabs & Ball Switch */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px 4px 8px',
          }}
        >
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
            <circle cx={P.x + P.w / 2} cy={P.y + P.h / 2} r="3" fill="#1E2A38" fillOpacity="0.4" />

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
                      <rect x={tx + 24} y={ty - 14} width="46" height="20" rx="3" fill="#C42B2B" />
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

              const curX = phase === 'withBall' ? nx : defNormX;
              const curY = ny;

              // Position in SVG / Board coordinates
              const px = P.x + curX * P.w;
              const py = P.y + curY * P.h;

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
                gridTemplateColumns: 'repeat(5, 1fr)',
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

              {activeDivider === 'setpieces' && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    fontSize: '12px',
                  }}
                >
                  {/* Men Back */}
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: '3px' }}>Men Back at Corners</div>
                    <div
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}
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
                            padding: '5px 4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            borderRadius: '2px',
                            border:
                              tactics.instructions.menBack === mb
                                ? '1.5px solid #1F4FBF'
                                : '1px solid var(--paper-rule)',
                            backgroundColor:
                              tactics.instructions.menBack === mb ? '#FFFFFF' : 'var(--paper-2)',
                            color: tactics.instructions.menBack === mb ? '#1F4FBF' : 'inherit',
                            cursor: 'pointer',
                          }}
                        >
                          {mb} Back
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Posts */}
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: '3px' }}>Men on Posts</div>
                    <div
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}
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
                            padding: '5px 2px',
                            fontSize: '10px',
                            fontWeight: 600,
                            borderRadius: '2px',
                            border:
                              tactics.instructions.postMen === pm
                                ? '1.5px solid #1F4FBF'
                                : '1px solid var(--paper-rule)',
                            backgroundColor:
                              tactics.instructions.postMen === pm ? '#FFFFFF' : 'var(--paper-2)',
                            color: tactics.instructions.postMen === pm ? '#1F4FBF' : 'inherit',
                            cursor: 'pointer',
                          }}
                        >
                          {pm}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Set-Piece Takers */}
                  <div style={{ borderTop: '1px solid var(--paper-rule)', paddingTop: '8px' }}>
                    <div style={{ fontWeight: 700, marginBottom: '6px' }}>Takers</div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '80px 1fr',
                        gap: '6px',
                        alignItems: 'center',
                        fontSize: '11.5px',
                      }}
                    >
                      <span style={{ color: 'var(--paper-dim)' }}>Captain</span>
                      <select
                        value={tactics.captain ?? ''}
                        onChange={(e) => updateUserTactics({ captain: e.target.value || null })}
                        style={{
                          padding: '3px',
                          borderRadius: '2px',
                          border: '1px solid var(--paper-rule)',
                          backgroundColor: 'var(--paper-2)',
                        }}
                      >
                        <option value="">Select Captain</option>
                        {starters
                          .filter((s) => s.player)
                          .map(({ player }) => (
                            <option key={player!.id} value={player!.id}>
                              {player!.firstName} {player!.lastName}
                            </option>
                          ))}
                      </select>

                      <span style={{ color: 'var(--paper-dim)' }}>Penalties</span>
                      <select
                        value={tactics.takers?.penalty ?? ''}
                        onChange={(e) =>
                          updateUserTactics({
                            takers: { ...tactics.takers, penalty: e.target.value || null },
                          })
                        }
                        style={{
                          padding: '3px',
                          borderRadius: '2px',
                          border: '1px solid var(--paper-rule)',
                          backgroundColor: 'var(--paper-2)',
                        }}
                      >
                        <option value="">Select Penalty Taker</option>
                        {starters
                          .filter((s) => s.player)
                          .map(({ player }) => (
                            <option key={player!.id} value={player!.id}>
                              {player!.firstName} {player!.lastName}
                            </option>
                          ))}
                      </select>

                      <span style={{ color: 'var(--paper-dim)' }}>Free kicks</span>
                      <select
                        value={tactics.takers?.freeKick ?? ''}
                        onChange={(e) =>
                          updateUserTactics({
                            takers: { ...tactics.takers, freeKick: e.target.value || null },
                          })
                        }
                        style={{
                          padding: '3px',
                          borderRadius: '2px',
                          border: '1px solid var(--paper-rule)',
                          backgroundColor: 'var(--paper-2)',
                        }}
                      >
                        <option value="">Select Free Kick Taker</option>
                        {starters
                          .filter((s) => s.player)
                          .map(({ player }) => (
                            <option key={player!.id} value={player!.id}>
                              {player!.firstName} {player!.lastName}
                            </option>
                          ))}
                      </select>

                      <span style={{ color: 'var(--paper-dim)' }}>Corners</span>
                      <select
                        value={tactics.takers?.corner ?? ''}
                        onChange={(e) =>
                          updateUserTactics({
                            takers: { ...tactics.takers, corner: e.target.value || null },
                          })
                        }
                        style={{
                          padding: '3px',
                          borderRadius: '2px',
                          border: '1px solid var(--paper-rule)',
                          backgroundColor: 'var(--paper-2)',
                        }}
                      >
                        <option value="">Select Corner Taker</option>
                        {starters
                          .filter((s) => s.player)
                          .map(({ player }) => (
                            <option key={player!.id} value={player!.id}>
                              {player!.firstName} {player!.lastName}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
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
