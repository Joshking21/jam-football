// Implements SPEC §11.9 Training Screen & §12.18 Training in Detail
// Design reference: docs/design/training/ (training.png & index.html)
import React, { useState, useMemo } from 'react';
import { useStore } from '../../state/store';
import {
  TrainingSessionId,
  TrainingSlotKey,
  TrainingTemplateId,
  OneToOneType,
  Player,
  PlayerId,
  MatchPrep,
  AttributeKey,
} from '../../core/types';
import {
  SESSION_DEFINITIONS,
  TRAINING_TEMPLATES,
  BALANCED_WEEK_SCHEDULE,
  calculateWeekLoad,
  calculateSharpnessFractions,
  generateTheosWeek,
  suggestOneToOne,
  getCoachNote,
  getAttributeProgress,
} from '../../core/people/training';
import { getInjuryRisk } from '../../core/club/clubDepth';
import { rawOvr } from '../../core/player/ratings';
import rawTrainingData from '../../content/training.json';

type ClipboardTab = 'players' | 'oneToOne' | 'progress';

const CATEGORY_COLORS: Record<string, string> = {
  Attacking: '#C42B2B',
  Defending: '#1F4FBF',
  Fitness: '#1E7B3C',
  Tactical: '#1E2A38',
  SetPieces: '#C98A12',
  Balanced: '#7A7062',
  Recovery: '#5F9FBF',
  None: '#5E574E',
};

const CATEGORY_LABELS: Record<string, string> = {
  Attacking: 'Attacking',
  Defending: 'Defending',
  Fitness: 'Fitness',
  Tactical: 'Tactical',
  SetPieces: 'Set pieces',
  Balanced: 'Balanced',
  Recovery: 'Recovery',
  None: 'Rest / Light',
};

export const TrainingScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const updateUserTraining = useStore((state) => state.updateUserTraining);
  const setWeeklyTrainingSlot = useStore((state) => state.setWeeklyTrainingSlot);
  const applyTrainingTemplate = useStore((state) => state.applyTrainingTemplate);
  const applyTheosWeekPlan = useStore((state) => state.applyTheosWeekPlan);
  const setLetTheoPlan = useStore((state) => state.setLetTheoPlan);
  const setPlayerWorkload = useStore((state) => state.setPlayerWorkload);
  const setPlayerExtraSessions = useStore((state) => state.setPlayerExtraSessions);
  const setMentoringPair = useStore((state) => state.setMentoringPair);
  const conductOneToOneSession = useStore((state) => state.conductOneToOneSession);
  const setPlayerRest = useStore((state) => state.setPlayerRest);
  const setPlayerIndividualFocus = useStore((state) => state.setPlayerIndividualFocus);
  const showToast = useStore((state) => state.showToast);

  const [activeTab, setActiveTab] = useState<ClipboardTab>('players');
  const [selectedPlayerId, setSelectedPlayerId] = useState<PlayerId | null>(null);
  const [selectedLibrarySession, setSelectedLibrarySession] = useState<TrainingSessionId | null>(
    null,
  );
  const [editingSlot, setEditingSlot] = useState<TrainingSlotKey | null>(null);

  // One-to-one state
  const [otoPlayerId, setOtoPlayerId] = useState<PlayerId | null>(null);
  const [otoType, setOtoType] = useState<OneToOneType>('Confidence');

  if (!gameState) return null;
  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  const currentSchedule = userClub.trainingPlan?.schedule ?? BALANCED_WEEK_SCHEDULE;
  const intensity = userClub.trainingPlan?.intensity ?? 'Normal';
  const activeTemplate = userClub.trainingPlan?.activeTemplate ?? 'balanced';
  const letTheoPlan = userClub.trainingPlan?.letTheoPlan ?? false;
  const theoSuggestedSlots = userClub.trainingPlan?.theoSuggestedSlots ?? {};

  const squadPlayers = useMemo(
    () => userClub.squad.map((id) => gameState.players[id]).filter((p): p is Player => p != null),
    [userClub.squad, gameState.players],
  );

  // Upcoming opponent
  const targetMD = gameState.matchday === 0 ? 1 : gameState.matchday;
  const nextFixture = gameState.fixtures.find(
    (f) => f.matchday === targetMD && (f.homeId === userClub.id || f.awayId === userClub.id),
  );
  const isHome = nextFixture?.homeId === userClub.id;
  const oppId = nextFixture
    ? isHome
      ? nextFixture.awayId
      : nextFixture.homeId
    : (userClub.rivals[0] ?? 'c02');
  const oppClub = gameState.clubs[oppId];
  const oppPlayers = useMemo(
    () =>
      oppClub?.squad.map((id) => gameState.players[id]).filter((p): p is Player => p != null) ?? [],
    [oppClub, gameState.players],
  );

  // Theo's week recommendations
  const theosWeek = useMemo(
    () => generateTheosWeek(userClub, gameState.players, oppClub, oppPlayers),
    [userClub, gameState.players, oppClub, oppPlayers],
  );

  // Theo's one-to-one suggestion
  const theosOto = useMemo(
    () => suggestOneToOne(userClub, gameState.players),
    [userClub, gameState.players],
  );

  // Week load calculations
  const weekLoad = calculateWeekLoad(currentSchedule);
  const sharpness = calculateSharpnessFractions(currentSchedule);

  // Average training rating
  const squadRatings = squadPlayers.map((p) => p.lastTrainingRating ?? 7.0).filter((r) => r > 0);
  const avgSquadRating =
    squadRatings.length > 0
      ? (squadRatings.reduce((a, b) => a + b, 0) / squadRatings.length).toFixed(1)
      : '7.1';

  // Condition estimate
  const avgCondition =
    squadPlayers.length > 0
      ? Math.round(squadPlayers.reduce((a, b) => a + b.condition, 0) / squadPlayers.length)
      : 92;
  const condDelta = Math.round((12 - weekLoad) * 0.6);

  // Selected player
  const activePlayer = selectedPlayerId
    ? (gameState.players[selectedPlayerId] ?? squadPlayers[0])
    : squadPlayers[0];

  if (!activePlayer) return null;

  // Sharpness summary string
  const sharpnessEntries = Object.entries(sharpness).filter(
    ([cat, val]) => val > 0 && cat !== 'None' && cat !== 'Recovery',
  );
  const sharpnessStr =
    sharpnessEntries.length > 0
      ? sharpnessEntries
          .map(
            ([cat, val]) =>
              `${CATEGORY_LABELS[cat] ?? cat} ${val === 1 ? '3/3' : val === 2 / 3 ? '⅔' : '⅓'}`,
          )
          .join(' · ')
      : 'Light walkthrough';

  // Handler for slot click
  const handleSlotClick = (slotKey: TrainingSlotKey) => {
    if (selectedLibrarySession) {
      if (slotKey === 'd6') {
        const def = SESSION_DEFINITIONS[selectedLibrarySession];
        if (
          def.id !== 'opponent_prep' &&
          def.id !== 'shape_work' &&
          def.id !== 'set_pieces' &&
          def.id !== 'video_analysis' &&
          def.id !== 'light'
        ) {
          showToast(
            'Day 6 match prep only accepts Opponent prep, Shape work, Set-piece practice, Video analysis or Light session.',
            'warning',
          );
          return;
        }
      }
      setWeeklyTrainingSlot(slotKey, selectedLibrarySession);
      setSelectedLibrarySession(null);
    } else {
      setEditingSlot(editingSlot === slotKey ? null : slotKey);
    }
  };

  const handleLibrarySelect = (sessionId: TrainingSessionId) => {
    if (editingSlot) {
      setWeeklyTrainingSlot(editingSlot, sessionId);
      setEditingSlot(null);
    } else {
      setSelectedLibrarySession(selectedLibrarySession === sessionId ? null : sessionId);
    }
  };

  const renderMagnet = (
    sessionId: TrainingSessionId,
    slotKey: TrainingSlotKey | 'd1',
    isFixed = false,
  ) => {
    const def = SESSION_DEFINITIONS[sessionId] ?? SESSION_DEFINITIONS.rest;
    const catColor = CATEGORY_COLORS[def.category] ?? '#5E574E';
    const isTheo = slotKey !== 'd1' && (theoSuggestedSlots[slotKey as TrainingSlotKey] ?? false);
    const pipsCount = Math.abs(def.load);
    const isNeg = def.load < 0;

    return (
      <div
        className="training-magnet"
        style={{
          borderTop: `8px solid ${catColor}`,
          position: 'relative',
          padding: '10px 10px 8px',
          background: isFixed ? 'rgba(251, 251, 249, 0.95)' : '#fbfbf9',
          borderRadius: '4px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
          cursor: isFixed ? 'default' : 'pointer',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
        onClick={() => !isFixed && handleSlotClick(slotKey as TrainingSlotKey)}
      >
        <div>
          <div
            style={{
              fontSize: '10.5px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: catColor,
              fontFamily: 'Barlow Condensed, sans-serif',
            }}
          >
            {CATEGORY_LABELS[def.category] ?? def.category}
          </div>
          <div
            style={{
              fontSize: '17px',
              lineHeight: 1.1,
              fontWeight: 700,
              textTransform: 'uppercase',
              marginTop: '4px',
              color: '#1E2A38',
              fontFamily: 'Barlow Condensed, sans-serif',
            }}
          >
            {def.name}
          </div>
          <div
            style={{
              fontSize: '11px',
              color: '#5c6672',
              marginTop: '4px',
              lineHeight: 1.25,
            }}
          >
            {def.effectNote}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '8px',
          }}
        >
          {/* Load pips */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  border: `2px solid ${isNeg ? '#5F9FBF' : '#1E2A38'}`,
                  background: i < pipsCount ? (isNeg ? '#5F9FBF' : '#1E2A38') : 'transparent',
                }}
              />
            ))}
          </div>

          {/* Tag */}
          {isFixed && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#8b95a1',
                fontFamily: 'Barlow Condensed, sans-serif',
                letterSpacing: '0.1em',
              }}
            >
              FIXED
            </span>
          )}
          {isTheo && !isFixed && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#C42B2B',
                fontFamily: 'Barlow Condensed, sans-serif',
                letterSpacing: '0.1em',
                background: '#fee2e2',
                padding: '1px 5px',
                borderRadius: '2px',
              }}
            >
              THEO
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderSparkline = (history: number[] = []) => {
    const data = history.length > 0 ? history : [7.0, 7.1, 7.0, 7.2, 7.1, 7.2];
    const w = 54;
    const h = 16;
    const mn = 4.5;
    const mx = 9.0;
    const points = data
      .map((v, i) => `${(i * w) / (data.length - 1 || 1)},${h - ((v - mn) / (mx - mn)) * h}`)
      .join(' ');

    return (
      <svg width={w} height={h} style={{ verticalAlign: 'middle', marginLeft: '6px' }}>
        <polyline points={points} fill="none" stroke="#1B1A17" strokeWidth="1.6" />
      </svg>
    );
  };

  return (
    <div
      className="app-content-area"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(680px, 1fr) 580px',
        gap: '20px',
        padding: '16px 22px 14px',
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at 30% 40%, #1d1915 0%, #100E0C 60%, #0a0908 100%)',
      }}
    >
      {/* LEFT: THE WHITEBOARD & WEEK LOAD */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 0,
        }}
      >
        {/* ALUMINUM FRAME */}
        <div
          style={{
            background: 'linear-gradient(#c9ced3, #9aa1a8)',
            borderRadius: '6px',
            padding: '10px',
            boxShadow: '0 18px 40px rgba(0,0,0,0.6)',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          {/* WHITEBOARD SURFACE */}
          <div
            style={{
              background: '#E9ECEA',
              borderRadius: '2px',
              color: '#1E2A38',
              flex: 1,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              padding: '14px 18px 12px',
              overflow: 'hidden',
              backgroundImage:
                'radial-gradient(ellipse at 20% 30%, rgba(30,42,56,.05), transparent 40%), radial-gradient(ellipse at 75% 70%, rgba(30,42,56,.045), transparent 35%)',
            }}
          >
            {/* BOARD HEADER */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '10px',
                borderBottom: '1px solid rgba(30,42,56,0.18)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
                <h2
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '28px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    color: '#1E2A38',
                    margin: 0,
                  }}
                >
                  The week
                </h2>
                <span
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '14px',
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#4b5866',
                  }}
                >
                  Matchday {gameState.matchday} · v {oppClub?.shortName ?? 'Corvallen'} (
                  {isHome ? 'H' : 'A'}) · Night
                </span>
              </div>

              {/* CONTROLS: TEMPLATE & INTENSITY */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <select
                  value={activeTemplate}
                  onChange={(e) => applyTrainingTemplate(e.target.value as TrainingTemplateId)}
                  style={{
                    border: '2px solid #1E2A38',
                    padding: '5px 10px',
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontWeight: 700,
                    fontSize: '13px',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    background: '#f6f7f6',
                    color: '#1E2A38',
                    cursor: 'pointer',
                  }}
                >
                  {Object.entries(TRAINING_TEMPLATES).map(([id, tmpl]) => (
                    <option key={id} value={id}>
                      {tmpl.name}
                    </option>
                  ))}
                </select>

                <div style={{ display: 'flex', border: '2px solid #1E2A38' }}>
                  {(['Light', 'Normal', 'Hard'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => updateUserTraining({ intensity: lvl })}
                      style={{
                        padding: '5px 9px',
                        fontFamily: 'Barlow Condensed, sans-serif',
                        fontWeight: 700,
                        fontSize: '12px',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        border: 'none',
                        cursor: 'pointer',
                        background: intensity === lvl ? '#1E2A38' : '#f6f7f6',
                        color: intensity === lvl ? '#FFFFFF' : '#1E2A38',
                      }}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 7-DAY SCHEDULE GRID */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '115px repeat(4, minmax(0, 1fr)) 135px 115px',
                gridTemplateRows: '32px 142px 142px',
                columnGap: '8px',
                rowGap: '8px',
                marginTop: '10px',
                position: 'relative',
              }}
            >
              {/* Day headers */}
              {[
                ['Day 1', 'Recovery'],
                ['Day 2', 'Mon'],
                ['Day 3', 'Tue'],
                ['Day 4', 'Wed'],
                ['Day 5', 'Thu'],
                ['Day 6', 'Fri · Match prep'],
                ['Day 7', 'Sat · Matchday'],
              ].map(([d, s], i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '14px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#3a4654',
                    borderBottom: '2px solid rgba(30,42,56,0.3)',
                    paddingBottom: '3px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                  }}
                >
                  {d}
                  <small
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 600,
                      letterSpacing: '0.12em',
                      color: '#7b8794',
                    }}
                  >
                    {s}
                  </small>
                </div>
              ))}

              {/* Day 1: Recovery (fixed, spans rows 2-4) */}
              <div
                style={{
                  gridRow: '2 / 4',
                  background:
                    'repeating-linear-gradient(135deg, rgba(30,42,56,0.06) 0 8px, transparent 8px 16px)',
                  borderRadius: '3px',
                }}
              >
                {renderMagnet('recovery', 'd1', true)}
              </div>

              {/* Days 2–5 AM Row */}
              <div style={{ position: 'relative' }}>
                {renderMagnet(currentSchedule.d2_am, 'd2_am')}
              </div>
              <div style={{ position: 'relative' }}>
                {renderMagnet(currentSchedule.d3_am, 'd3_am')}
              </div>
              <div style={{ position: 'relative' }}>
                {renderMagnet(currentSchedule.d4_am, 'd4_am')}
              </div>
              <div style={{ position: 'relative' }}>
                {renderMagnet(currentSchedule.d5_am, 'd5_am')}
              </div>

              {/* Day 6: Match prep (spans rows 2-4) */}
              <div style={{ gridRow: '2 / 4', position: 'relative' }}>
                {renderMagnet(currentSchedule.d6, 'd6')}
              </div>

              {/* Day 7: Matchday card (spans rows 2-4) */}
              <div
                style={{
                  gridColumn: 7,
                  gridRow: '2 / 4',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  border: '2px solid #1E2A38',
                  borderRadius: '3px',
                  background: 'rgba(19, 33, 58, 0.08)',
                  padding: '12px 6px',
                }}
              >
                <div
                  style={{
                    width: '38px',
                    height: '42px',
                    background: oppClub?.colors.primary ?? '#1E2A38',
                    border: '2px solid #1E2A38',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFF',
                    fontWeight: 800,
                    fontSize: '12px',
                    borderRadius: '2px',
                  }}
                >
                  {oppClub?.code ?? 'OPP'}
                </div>
                <b
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '24px',
                    fontWeight: 800,
                    color: '#1E2A38',
                  }}
                >
                  v {oppClub?.code ?? 'OPP'}
                </b>
                <span
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    color: '#3a4654',
                    lineHeight: 1.2,
                  }}
                >
                  {isHome ? 'Home' : 'Away'}
                  <br />
                  Night
                </span>
              </div>

              {/* Days 2–5 PM Row */}
              <div style={{ position: 'relative' }}>
                {renderMagnet(currentSchedule.d2_pm, 'd2_pm')}
              </div>
              <div style={{ position: 'relative' }}>
                {renderMagnet(currentSchedule.d3_pm, 'd3_pm')}
              </div>
              <div style={{ position: 'relative' }}>
                {renderMagnet(currentSchedule.d4_pm, 'd4_pm')}
              </div>
              <div style={{ position: 'relative' }}>
                {renderMagnet(currentSchedule.d5_pm, 'd5_pm')}
              </div>
            </div>

            {/* "SHARP FOR SATURDAY" DRAWN BRACKET */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '6px',
                paddingLeft: '48%',
              }}
            >
              <svg width="240" height="20" viewBox="0 0 240 20">
                <path
                  d="M 5 6 Q 5 14 15 14 H 115 Q 120 14 120 19 Q 120 14 125 14 H 225 Q 235 14 235 6"
                  fill="none"
                  stroke="#C42B2B"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
              <span
                style={{
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontSize: '15px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  color: '#C42B2B',
                  whiteSpace: 'nowrap',
                }}
              >
                sharp for Saturday
              </span>
            </div>

            {/* THEO'S WEEK STICKY NOTE */}
            <div
              style={{
                background: '#FFF3A8',
                color: '#2A2410',
                padding: '10px 14px 10px',
                transform: 'rotate(-0.5deg)',
                boxShadow: '0 8px 18px rgba(0,0,0,0.18)',
                marginTop: '6px',
                display: 'grid',
                gridTemplateColumns: '1fr 140px',
                gap: '12px',
                position: 'relative',
              }}
            >
              {/* Pushpin circle */}
              <div
                style={{
                  position: 'absolute',
                  top: '-7px',
                  left: '50%',
                  width: '14px',
                  height: '14px',
                  marginLeft: '-7px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 35%, #e05a4a, #8a1f17)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                }}
              />
              <div>
                <b
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '13px',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  Theo's week
                </b>
                <ul
                  style={{
                    listStyle: 'none',
                    margin: '6px 0 0',
                    padding: 0,
                    fontSize: '12px',
                    lineHeight: 1.35,
                  }}
                >
                  {theosWeek.reasons.map((r, idx) => (
                    <li
                      key={idx}
                      style={{
                        paddingLeft: '12px',
                        position: 'relative',
                        marginBottom: '3px',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: '6px',
                          width: '6px',
                          height: '2px',
                          background: '#2A2410',
                        }}
                      />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                }}
              >
                <button
                  type="button"
                  onClick={applyTheosWeekPlan}
                  style={{
                    background: '#2A2410',
                    color: '#FFF3A8',
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontWeight: 700,
                    fontSize: '13px',
                    letterSpacing: '0.12em',
                    padding: '6px 14px',
                    border: 'none',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                  }}
                >
                  APPLY
                </button>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={letTheoPlan}
                    onChange={(e) => setLetTheoPlan(e.target.checked)}
                  />
                  Let Theo plan every week
                </label>
              </div>
            </div>

            {/* SESSION LIBRARY TRAY */}
            <div
              style={{
                marginTop: '10px',
                borderTop: '2px dashed rgba(30,42,56,0.25)',
                paddingTop: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: '#4b5866',
                }}
              >
                <span>Session library</span>
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '11px',
                    fontWeight: 500,
                    letterSpacing: 0,
                    textTransform: 'none',
                    color: '#7b8794',
                  }}
                >
                  {selectedLibrarySession
                    ? `Selected: ${SESSION_DEFINITIONS[selectedLibrarySession]?.name} (click a slot to place)`
                    : 'Click a session chip to place onto any slot'}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  marginTop: '8px',
                  maxHeight: '74px',
                  overflowY: 'auto',
                }}
              >
                {(Object.keys(SESSION_DEFINITIONS) as TrainingSessionId[]).map((sId) => {
                  const def = SESSION_DEFINITIONS[sId];
                  const catColor = CATEGORY_COLORS[def.category] ?? '#5E574E';
                  const isSelected = selectedLibrarySession === sId;
                  const pips = Math.abs(def.load);

                  return (
                    <div
                      key={sId}
                      onClick={() => handleLibrarySelect(sId)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: isSelected ? '#fff' : '#fbfbf9',
                        borderLeft: `5px solid ${catColor}`,
                        outline: isSelected ? '2px solid #1E2A38' : 'none',
                        padding: '4px 8px',
                        fontFamily: 'Barlow Condensed, sans-serif',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        color: '#1E2A38',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        cursor: 'pointer',
                      }}
                    >
                      <span>{def.name}</span>
                      <span style={{ display: 'flex', gap: '2px' }}>
                        {Array.from({ length: pips }, (_, k) => (
                          <b
                            key={k}
                            style={{
                              width: '4px',
                              height: '4px',
                              borderRadius: '50%',
                              background: def.load < 0 ? '#5F9FBF' : '#1E2A38',
                            }}
                          />
                        ))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* UNDER THE BOARD: THE WEEK IN NUMBERS */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.3fr 1fr 1fr 1fr',
            gap: '14px',
            marginTop: '10px',
            background: 'rgba(14, 18, 24, 0.9)',
            border: '1px solid #2A313D',
            padding: '10px 16px',
            borderRadius: '4px',
          }}
        >
          {/* Week load */}
          <div>
            <div
              style={{
                fontSize: '11px',
                fontFamily: 'Barlow Condensed, sans-serif',
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#A3ACBA',
              }}
            >
              Week load
            </div>
            <div
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                fontSize: '24px',
                fontWeight: 700,
                color: '#F2F4F7',
                marginTop: '4px',
              }}
            >
              {weekLoad} <small style={{ fontSize: '13px', color: '#A3ACBA' }}>/ 12 balanced</small>
            </div>
            {/* Meter */}
            <div
              style={{
                position: 'relative',
                height: '8px',
                background: '#1f2630',
                marginTop: '6px',
                borderRadius: '2px',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${Math.min(100, (weekLoad / 24) * 100)}%`,
                  background: 'linear-gradient(90deg, #1E7B3C, #F2C230 60%, #C42B2B)',
                  borderRadius: '2px',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '-3px',
                  bottom: '-3px',
                  width: '2px',
                  background: '#FFFFFF',
                }}
              />
            </div>
          </div>

          {/* Condition on matchday */}
          <div>
            <div
              style={{
                fontSize: '11px',
                fontFamily: 'Barlow Condensed, sans-serif',
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#A3ACBA',
              }}
            >
              Condition on matchday
            </div>
            <div
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                fontSize: '24px',
                fontWeight: 700,
                color: '#F2F4F7',
                marginTop: '4px',
              }}
            >
              {avgCondition}%{' '}
              <small
                style={{
                  fontSize: '14px',
                  color: condDelta >= 0 ? '#3fd38b' : '#F2C230',
                }}
              >
                {condDelta >= 0 ? `+${condDelta}` : `${condDelta}`}
              </small>
            </div>
          </div>

          {/* Sharp for Saturday */}
          <div>
            <div
              style={{
                fontSize: '11px',
                fontFamily: 'Barlow Condensed, sans-serif',
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#A3ACBA',
              }}
            >
              Sharp for Saturday
            </div>
            <div
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                fontSize: '16px',
                fontWeight: 600,
                color: '#F2F4F7',
                marginTop: '8px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {sharpnessStr}
            </div>
          </div>

          {/* Training rating squad */}
          <div>
            <div
              style={{
                fontSize: '11px',
                fontFamily: 'Barlow Condensed, sans-serif',
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#A3ACBA',
              }}
            >
              Training rating, squad
            </div>
            <div
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                fontSize: '24px',
                fontWeight: 700,
                color: '#F2F4F7',
                marginTop: '4px',
              }}
            >
              {avgSquadRating} <small style={{ fontSize: '13px', color: '#3fd38b' }}>▲ 0.2</small>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: THE CLIPBOARD */}
      <div
        style={{
          position: 'relative',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Metal clip backing */}
        <div
          style={{
            position: 'absolute',
            inset: '16px 0 0 10px',
            background: '#E4DED2',
            borderRadius: '4px',
            transform: 'rotate(0.8deg)',
            boxShadow: '0 14px 30px rgba(0,0,0,0.55)',
          }}
        />

        {/* Metal clipper top */}
        <div
          style={{
            position: 'absolute',
            top: '4px',
            left: '50%',
            width: '130px',
            height: '24px',
            marginLeft: '-65px',
            background: 'linear-gradient(#5d636b, #2c3036)',
            borderRadius: '5px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
            zIndex: 4,
          }}
        />

        {/* Paper sheet */}
        <div
          style={{
            position: 'absolute',
            inset: '28px 4px 4px 0',
            background: '#EFEBE3',
            color: '#1B1A17',
            borderRadius: '3px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            transform: 'rotate(-0.3deg)',
            padding: '20px 20px 16px',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Clipboard tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginBottom: '10px',
            }}
          >
            {(['players', 'oneToOne', 'progress'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '7px 14px',
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === tab ? '#1B1A17' : '#ddd6c8',
                  color: activeTab === tab ? '#EFEBE3' : '#5E574E',
                }}
              >
                {tab === 'players' ? 'Players' : tab === 'oneToOne' ? 'One-to-one' : 'Progress'}
              </button>
            ))}
            <span
              style={{
                marginLeft: 'auto',
                fontFamily: 'Barlow Condensed, sans-serif',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.1em',
                color: '#5E574E',
                textTransform: 'uppercase',
              }}
            >
              {squadPlayers.length} in squad
            </span>
          </div>

          {/* TAB 1: PLAYERS TABLE */}
          {activeTab === 'players' && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                justifyContent: 'space-between',
              }}
            >
              <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    textAlign: 'left',
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: '2px solid #1B1A17' }}>
                      <th
                        style={{
                          fontFamily: 'Barlow Condensed, sans-serif',
                          fontSize: '11px',
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          color: '#5E574E',
                          padding: '6px 4px',
                        }}
                      >
                        Player
                      </th>
                      <th
                        style={{
                          fontFamily: 'Barlow Condensed, sans-serif',
                          fontSize: '11px',
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          color: '#5E574E',
                          padding: '6px 4px',
                        }}
                      >
                        Focus
                      </th>
                      <th
                        style={{
                          fontFamily: 'Barlow Condensed, sans-serif',
                          fontSize: '11px',
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          color: '#5E574E',
                          padding: '6px 4px',
                        }}
                      >
                        Workload
                      </th>
                      <th
                        style={{
                          fontFamily: 'Barlow Condensed, sans-serif',
                          fontSize: '11px',
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          color: '#5E574E',
                          padding: '6px 4px',
                          textAlign: 'center',
                        }}
                      >
                        Extra
                      </th>
                      <th
                        style={{
                          fontFamily: 'Barlow Condensed, sans-serif',
                          fontSize: '11px',
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          color: '#5E574E',
                          padding: '6px 4px',
                        }}
                      >
                        Rating
                      </th>
                      <th
                        style={{
                          fontFamily: 'Barlow Condensed, sans-serif',
                          fontSize: '11px',
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          color: '#5E574E',
                          padding: '6px 4px',
                        }}
                      >
                        Risk
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {squadPlayers.map((player) => {
                      const isSelected = selectedPlayerId === player.id;
                      const plan = userClub.trainingPlan?.playerPlans?.[player.id];
                      const workload = player.workload ?? plan?.workload ?? 'Normal';
                      const extra = player.extraSessions ?? plan?.extraSessions ?? false;
                      const rating = player.lastTrainingRating ?? 7.0;
                      const ratingCol =
                        rating >= 7.5 ? '#1E7B3C' : rating <= 5.5 ? '#C42B2B' : '#1B1A17';

                      // Individual focus display
                      const indFocus = userClub.trainingPlan?.individualFocus?.[player.id];
                      let focusType = '—';
                      let focusVal = 'None';
                      if (indFocus?.type === 'attribute') {
                        focusType = 'Attr';
                        focusVal = indFocus.attribute;
                      } else if (indFocus?.type === 'role') {
                        focusType = 'Role';
                        focusVal = indFocus.roleId;
                      } else if (indFocus?.type === 'position') {
                        focusType = 'Pos';
                        const fam =
                          player.positions.find((pos) => pos.pos === indFocus.position)
                            ?.familiarity ?? 50;
                        focusVal = `${indFocus.position} ${fam}%`;
                      } else if (indFocus?.type === 'trait') {
                        focusType = 'Trait';
                        focusVal = indFocus.trait;
                      } else if (indFocus?.type === 'mentor') {
                        focusType = 'Mentor';
                        const m = gameState.players[indFocus.mentorId];
                        focusVal = `→ ${m?.lastName ?? 'Senior'}`;
                      } else if (player.mentorId) {
                        focusType = 'Mentor';
                        const m = gameState.players[player.mentorId];
                        focusVal = `→ ${m?.lastName ?? 'Senior'}`;
                      }

                      // Injury risk calculation
                      const risk = getInjuryRisk(player);
                      const isOverloaded =
                        (player.fatigue > 60 && workload !== 'Light') ||
                        (extra && player.fatigue > 50);

                      return (
                        <tr
                          key={player.id}
                          onClick={() => setSelectedPlayerId(player.id)}
                          style={{
                            borderBottom: '1px solid #ddd5c6',
                            background: isSelected ? 'rgba(31, 79, 191, 0.08)' : 'transparent',
                            cursor: 'pointer',
                          }}
                        >
                          <td style={{ padding: '6px 4px' }}>
                            <div style={{ fontWeight: 600, fontSize: '13px' }}>
                              {player.lastName}
                            </div>
                            <small
                              style={{
                                fontFamily: 'Barlow Condensed, sans-serif',
                                fontSize: '11px',
                                color: '#5E574E',
                              }}
                            >
                              {player.positions[0]?.pos ?? 'CM'} · {player.age}
                            </small>
                          </td>

                          <td style={{ padding: '6px 4px', fontSize: '12px' }}>
                            {focusType !== '—' && (
                              <span
                                style={{
                                  background: '#1B1A17',
                                  color: '#EFEBE3',
                                  fontFamily: 'Barlow Condensed, sans-serif',
                                  fontWeight: 700,
                                  fontSize: '9px',
                                  padding: '1px 4px',
                                  marginRight: '4px',
                                }}
                              >
                                {focusType}
                              </span>
                            )}
                            {focusVal}
                          </td>

                          <td style={{ padding: '6px 4px' }}>
                            <div
                              style={{
                                display: 'inline-flex',
                                border: '1.5px solid #1B1A17',
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {(['L', 'N', 'H'] as const).map((wKey) => {
                                const targetW =
                                  wKey === 'L' ? 'Light' : wKey === 'N' ? 'Normal' : 'Heavy';
                                const isOn = workload === targetW;
                                return (
                                  <span
                                    key={wKey}
                                    onClick={() => setPlayerWorkload(player.id, targetW)}
                                    style={{
                                      fontFamily: 'Barlow Condensed, sans-serif',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      padding: '2px 5px',
                                      cursor: 'pointer',
                                      background: isOn ? '#1B1A17' : 'transparent',
                                      color: isOn ? '#EFEBE3' : '#1B1A17',
                                    }}
                                  >
                                    {wKey}
                                  </span>
                                );
                              })}
                            </div>
                          </td>

                          <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={extra}
                              onChange={(e) => {
                                e.stopPropagation();
                                setPlayerExtraSessions(player.id, e.target.checked);
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>

                          <td style={{ padding: '6px 4px', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                fontFamily: 'Barlow Condensed, sans-serif',
                                fontSize: '16px',
                                fontWeight: 700,
                                color: ratingCol,
                              }}
                            >
                              {rating.toFixed(1)}
                            </span>
                            {renderSparkline(player.ratingHistory)}
                          </td>

                          <td style={{ padding: '6px 4px' }}>
                            <span
                              style={{
                                fontFamily: 'Barlow Condensed, sans-serif',
                                fontSize: '10px',
                                fontWeight: 700,
                                border: '1.5px solid',
                                padding: '2px 5px',
                                borderColor:
                                  risk.level === 'High' || isOverloaded
                                    ? '#C42B2B'
                                    : risk.level === 'Medium'
                                      ? '#a8740c'
                                      : '#1E7B3C',
                                color:
                                  risk.level === 'High' || isOverloaded
                                    ? '#C42B2B'
                                    : risk.level === 'Medium'
                                      ? '#a8740c'
                                      : '#1E7B3C',
                              }}
                            >
                              {isOverloaded ? 'OVERLOAD' : risk.level.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* BOTTOM CARD: THIS WEEK'S ONE-TO-ONE */}
              <div
                style={{
                  border: '2px solid #1B1A17',
                  padding: '10px 14px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '12px',
                  alignItems: 'center',
                  background: '#f6f2e9',
                  marginTop: '10px',
                }}
              >
                <div>
                  <b
                    style={{
                      fontFamily: 'Barlow Condensed, sans-serif',
                      fontSize: '12px',
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: '#5E574E',
                    }}
                  >
                    This week's one-to-one
                  </b>
                  <p style={{ margin: '4px 0 0', fontSize: '12.5px', lineHeight: 1.35 }}>
                    {theosOto.reason}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (theosOto.player) {
                      setOtoPlayerId(theosOto.player.id);
                      setOtoType(theosOto.type);
                      setActiveTab('oneToOne');
                    }
                  }}
                  style={{
                    background: '#1B1A17',
                    color: '#EFEBE3',
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '13px',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    padding: '8px 12px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Take him aside
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ONE-TO-ONE SCENE */}
          {activeTab === 'oneToOne' && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label
                    style={{
                      fontFamily: 'Barlow Condensed, sans-serif',
                      fontSize: '12px',
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: '#5E574E',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    Select Player
                  </label>
                  <select
                    value={otoPlayerId ?? activePlayer?.id}
                    onChange={(e) => setOtoPlayerId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1.5px solid #1B1A17',
                      background: '#FFF',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '13px',
                    }}
                  >
                    {squadPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.lastName} ({p.positions[0]?.pos ?? 'CM'}, Morale {Math.round(p.morale)},
                        Fatigue {Math.round(p.fatigue)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      fontFamily: 'Barlow Condensed, sans-serif',
                      fontSize: '12px',
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: '#5E574E',
                      display: 'block',
                      marginBottom: '6px',
                    }}
                  >
                    Session Type
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[
                      {
                        type: 'Technique' as OneToOneType,
                        label: 'Technique work',
                        desc: 'Development ×1.25 this week on individual focus.',
                      },
                      {
                        type: 'Confidence' as OneToOneType,
                        label: 'Confidence talk',
                        desc: 'Morale +6 (if < 50) or +2.',
                      },
                      {
                        type: 'Fitness' as OneToOneType,
                        label: 'Fitness work',
                        desc: 'Condition +6, fatigue −4.',
                      },
                      {
                        type: 'Video' as OneToOneType,
                        label: 'Video of last match',
                        desc: 'Decision-weighted contests ctx +0.05 next match.',
                      },
                    ].map((item) => (
                      <div
                        key={item.type}
                        onClick={() => setOtoType(item.type)}
                        style={{
                          border: '1.5px solid #1B1A17',
                          padding: '8px 10px',
                          cursor: 'pointer',
                          background: otoType === item.type ? '#1B1A17' : '#FFF',
                          color: otoType === item.type ? '#EFEBE3' : '#1B1A17',
                        }}
                      >
                        <div
                          style={{
                            fontFamily: 'Barlow Condensed, sans-serif',
                            fontWeight: 700,
                            fontSize: '14px',
                            textTransform: 'uppercase',
                          }}
                        >
                          {item.label}
                        </div>
                        <div style={{ fontSize: '11px', marginTop: '3px', opacity: 0.85 }}>
                          {item.desc}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* DIALOGUE PREVIEW */}
                <div
                  style={{
                    background: '#f6f2e9',
                    border: '1.5px solid #1B1A17',
                    padding: '12px 14px',
                    borderRadius: '2px',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'Barlow Condensed, sans-serif',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: '#5E574E',
                    }}
                  >
                    Coach's Line (Voice & Dialogue)
                  </div>
                  <p
                    style={{
                      fontSize: '13.5px',
                      fontStyle: 'italic',
                      margin: '6px 0',
                      color: '#1B1A17',
                    }}
                  >
                    "
                    {otoType === 'Technique'
                      ? 'Stay out with me. Body shape when they run at you.'
                      : otoType === 'Confidence'
                        ? 'Head up. You belong at this level, and you have my backing.'
                        : otoType === 'Fitness'
                          ? 'Light activation drills and pool work today. Get those legs fresh.'
                          : 'Look at this clip from the second half. See the space opening up on your blind side?'}
                    "
                  </p>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  disabled={userClub.trainingPlan?.oneToOneUsedThisWeek}
                  onClick={() => {
                    const targetId = otoPlayerId ?? activePlayer?.id;
                    if (targetId) conductOneToOneSession(targetId, otoType);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: userClub.trainingPlan?.oneToOneUsedThisWeek ? '#8c857b' : '#1B1A17',
                    color: '#EFEBE3',
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '15px',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    border: 'none',
                    cursor: userClub.trainingPlan?.oneToOneUsedThisWeek ? 'not-allowed' : 'pointer',
                  }}
                >
                  {userClub.trainingPlan?.oneToOneUsedThisWeek
                    ? 'One-to-one completed for this week'
                    : 'Conduct one-to-one session'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: PROGRESS TRACKING */}
          {activeTab === 'progress' && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                overflowY: 'auto',
              }}
            >
              {/* Selected player header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #1B1A17',
                  paddingBottom: '6px',
                }}
              >
                <div>
                  <h3
                    style={{
                      fontFamily: 'Barlow Condensed, sans-serif',
                      fontSize: '20px',
                      fontWeight: 700,
                      margin: 0,
                    }}
                  >
                    {activePlayer?.firstName} {activePlayer?.lastName}
                  </h3>
                  <small style={{ color: '#5E574E', fontSize: '11px' }}>
                    {activePlayer?.positions[0]?.pos ?? 'CM'} · Age {activePlayer?.age} · OVR{' '}
                    {Math.round(
                      rawOvr(
                        activePlayer?.attributes ?? ({} as any),
                        activePlayer?.positions[0]?.pos ?? 'CM',
                      ),
                    )}
                  </small>
                </div>
                <select
                  value={activePlayer?.id}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                  style={{
                    padding: '3px 6px',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '12px',
                  }}
                >
                  {squadPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.lastName}
                    </option>
                  ))}
                </select>
              </div>

              {/* COACH'S NOTE */}
              <div
                style={{
                  background: '#f6f2e9',
                  border: '1.5px solid #1B1A17',
                  padding: '10px 12px',
                  borderRadius: '2px',
                }}
              >
                <div
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#5E574E',
                  }}
                >
                  Coach's Note
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '13px', fontWeight: 600 }}>
                  "{getCoachNote(activePlayer)}"
                </p>
              </div>

              {/* 4-WEEK ATTRIBUTE ARROWS */}
              <div>
                <div
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#5E574E',
                    marginBottom: '6px',
                  }}
                >
                  4-Week Attribute Progress
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '6px',
                  }}
                >
                  {[
                    'finishing',
                    'passing',
                    'dribbling',
                    'tackling',
                    'heading',
                    'positioning',
                    'decisions',
                    'composure',
                    'stamina',
                    'pace',
                    'strength',
                    'workRate',
                  ].map((attr) => {
                    const arrow = getAttributeProgress(activePlayer, attr as AttributeKey);
                    const val = activePlayer?.attributes[attr as AttributeKey] ?? 50;
                    return (
                      <div
                        key={attr}
                        style={{
                          background: '#FFF',
                          border: '1px solid #ddd5c6',
                          padding: '4px 6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '12px',
                        }}
                      >
                        <span style={{ textTransform: 'capitalize' }}>{attr}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <b>{val}</b>
                          {arrow === 'up' && (
                            <span style={{ color: '#1E7B3C', fontWeight: 800 }}>▲</span>
                          )}
                          {arrow === 'down' && (
                            <span style={{ color: '#C42B2B', fontWeight: 800 }}>▼</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* MENTORING PAIR SETUP */}
              <div
                style={{
                  borderTop: '1px solid #ddd5c6',
                  paddingTop: '8px',
                }}
              >
                <div
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#5E574E',
                    marginBottom: '4px',
                  }}
                >
                  Mentoring Pair (§12.18.5)
                </div>
                {activePlayer.age <= 21 ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                      value={activePlayer.mentorId ?? ''}
                      onChange={(e) => setMentoringPair(e.target.value || null, activePlayer.id)}
                      style={{
                        padding: '4px 6px',
                        fontSize: '12px',
                        flex: 1,
                        border: '1px solid #1B1A17',
                      }}
                    >
                      <option value="">No mentor assigned</option>
                      {squadPlayers
                        .filter(
                          (p) =>
                            p.id !== activePlayer.id &&
                            (p.personality === 'Leader' ||
                              (p.age >= 28 && p.personality === 'Professional')),
                        )
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.lastName} ({m.personality}, Age {m.age})
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div style={{ fontSize: '11.5px', color: '#5E574E' }}>
                    {activePlayer.personality === 'Leader' ||
                    (activePlayer.age >= 28 && activePlayer.personality === 'Professional')
                      ? 'Senior mentor available to guide younger squad members.'
                      : 'Mentoring only applies to players aged 21 and under.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
