// Implements SPEC §11.9 Training screen (office world)
// Clipboard layout: focus list of rows with chosen one circled in blue marker (REVIEW M6)
// Intensity segmented control + Match prep, rest schedule, role training & injury risk room (§12.17)
import React from 'react';
import { useStore } from '../../state/store';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
import { Portrait } from '../components/Portrait';
import {
  Dumbbell,
  Shield,
  Zap,
  Target,
  Activity,
  Flame,
  HeartPulse,
  Clock,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import {
  TrainingPlan,
  MatchPrep,
  IndividualFocus,
  AttributeKey,
  Position,
  Player,
} from '../../core/types';
import { getInjuryRisk } from '../../core/club/clubDepth';
import { ROLES } from '../../config/roles';

export const TrainingScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const updateUserTraining = useStore((state) => state.updateUserTraining);
  const setMatchPrep = useStore((state) => state.setMatchPrep);
  const setPlayerRest = useStore((state) => state.setPlayerRest);
  const setPlayerIndividualFocus = useStore((state) => state.setPlayerIndividualFocus);
  const showToast = useStore((state) => state.showToast);

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  const plan = userClub.trainingPlan || {
    focus: 'Balanced',
    intensity: 'Normal',
    individual: {},
  };

  const currentPrep: MatchPrep = userClub.prep ?? 'None';
  const squadPlayers: Player[] = userClub.squad
    .map((id) => gameState.players[id])
    .filter((p): p is Player => p != null);

  const foci: {
    name: TrainingPlan['focus'];
    label: string;
    desc: string;
  }[] = [
    {
      name: 'Balanced',
      label: 'Balanced Regime',
      desc: 'All-round training across technical, physical and mental attributes.',
    },
    {
      name: 'Attacking',
      label: 'Attacking Phase',
      desc: 'Finishing, final third combinations, off-the-ball runs and shot volume.',
    },
    {
      name: 'Defending',
      label: 'Defensive Structure',
      desc: 'Tackling timing, positioning, defensive line cohesion and box clearances.',
    },
    {
      name: 'Fitness',
      label: 'Physical Conditioning',
      desc: 'Aerobic stamina and recovery work. Speeds up condition recovery between matches.',
    },
    {
      name: 'SetPieces',
      label: 'Set Piece Delivery',
      desc: 'In-swinging and out-swinging corner routines, direct free kicks, and aerial marking.',
    },
    {
      name: 'Tactical',
      label: 'Tactical Cohesion',
      desc: 'Accelerates formation familiarity, line discipline and pressing synchronization.',
    },
  ];

  const prepOptions: {
    id: MatchPrep;
    label: string;
    description: string;
    detail: string;
  }[] = [
    {
      id: 'None',
      label: 'None (Standard)',
      description: 'Standard regime without opposition-specific preparation.',
      detail: 'No focus penalty. Full weekly development intact.',
    },
    {
      id: 'SetPieces',
      label: 'Set Pieces Drill',
      description: 'Opponent aerial and corner duels −0.12 next match.',
      detail: 'Counters physical and set-piece heavy opposition.',
    },
    {
      id: 'Press',
      label: 'Press Resistance',
      description: 'Passes in DEF/MID against Mid/High press +0.15 next match.',
      detail: 'Helps bypass aggressive pressing systems and counter-press traps.',
    },
    {
      id: 'Wingers',
      label: 'Wide Containment',
      description: "Opponents' wide players dribble & cross delivery −0.12.",
      detail: 'Nullifies dangerous touchline wingers and overlapping fullbacks.',
    },
    {
      id: 'Shape',
      label: 'Tactical Shape',
      description: '+8 formation familiarity for active tactic next match.',
      detail: 'Accelerates tactical fluidity when introducing new systems.',
    },
  ];

  const handleFocusSelect = (focus: TrainingPlan['focus']) => {
    updateUserTraining({ focus });
    showToast(`Team training focus set to ${focus}`, 'info');
  };

  const handleIntensitySelect = (intensity: TrainingPlan['intensity']) => {
    updateUserTraining({ intensity });
    showToast(`Training intensity set to ${intensity}`, 'info');
  };

  const handlePrepSelect = (prep: MatchPrep) => {
    setMatchPrep(prep);
    showToast(
      prep === 'None'
        ? 'Cleared match preparation'
        : `Match preparation set: ${prepOptions.find((p) => p.id === prep)?.label}`,
      'info',
    );
  };

  const attributesList: { key: AttributeKey; label: string }[] = [
    { key: 'passing', label: 'Passing' },
    { key: 'finishing', label: 'Finishing' },
    { key: 'tackling', label: 'Tackling' },
    { key: 'pace', label: 'Pace' },
    { key: 'dribbling', label: 'Dribbling' },
    { key: 'positioning', label: 'Positioning' },
    { key: 'decisions', label: 'Decisions' },
    { key: 'stamina', label: 'Stamina' },
  ];

  const outfieldPositions: Position[] = [
    'CB',
    'LB',
    'RB',
    'LWB',
    'RWB',
    'DM',
    'CM',
    'AM',
    'LM',
    'RM',
    'LW',
    'RW',
    'ST',
  ];

  return (
    <div className="app-content-area office-surface" style={{ height: '100%' }}>
      <div
        style={{
          maxWidth: '1000px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        <Sheet id="training-clipboard" variant="clipboard">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Clipboard Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '2px solid var(--paper-ink)',
                paddingBottom: '14px',
              }}
            >
              <div>
                <h1
                  style={{
                    fontSize: '30px',
                    fontFamily: 'var(--font-head)',
                    color: 'var(--paper-ink)',
                    margin: 0,
                    letterSpacing: '0.02em',
                  }}
                >
                  TRAINING GROUND SCHEDULE
                </h1>
                <div
                  className="broadcast-label"
                  style={{ color: 'var(--paper-dim)', marginTop: '2px', fontSize: '12px' }}
                >
                  {userClub.name.toUpperCase()} · WEEKLY REGIME · MATCHDAY {gameState.matchday}
                </div>
              </div>
            </div>

            {/* Intensity segmented control */}
            <div>
              <div
                className="broadcast-label"
                style={{ color: 'var(--paper-dim)', marginBottom: '8px', fontSize: '12px' }}
              >
                SCHEDULE INTENSITY
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['Light', 'Normal', 'Hard'] as TrainingPlan['intensity'][]).map((lvl) => {
                  const isSelected = plan.intensity === lvl;
                  return (
                    <button
                      key={lvl}
                      onClick={() => handleIntensitySelect(lvl)}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        backgroundColor: isSelected ? 'var(--paper-ink)' : 'var(--paper-2)',
                        color: isSelected ? 'var(--paper)' : 'var(--paper-ink)',
                        border: '1px solid var(--paper-rule)',
                        borderRadius: '3px',
                        fontFamily: 'var(--font-head)',
                        fontWeight: 700,
                        fontSize: '15px',
                        letterSpacing: '0.04em',
                        cursor: 'pointer',
                        transition: 'all var(--dur-fast)',
                      }}
                    >
                      {lvl.toUpperCase()} INTENSITY
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2-Column Split: Team Focus on Left, Match Preparation on Right */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr',
                gap: '24px',
                alignItems: 'start',
              }}
            >
              {/* Left Column: Team Focus List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div
                  className="broadcast-label"
                  style={{ color: 'var(--paper-dim)', marginBottom: '4px', fontSize: '12px' }}
                >
                  WEEKLY TEAM FOCUS (CHOSEN OPTION CIRCLED)
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    border: '1px solid var(--paper-rule)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--paper)',
                    overflow: 'hidden',
                  }}
                >
                  {foci.map((f) => {
                    const isSelected = plan.focus === f.name;
                    return (
                      <div
                        key={f.name}
                        onClick={() => handleFocusSelect(f.name)}
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--paper-rule)',
                          backgroundColor: isSelected ? 'rgba(31, 79, 191, 0.08)' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '14px',
                          transition: 'background var(--dur-fast)',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-head)',
                              fontWeight: 700,
                              fontSize: '16px',
                              letterSpacing: '0.02em',
                              color: isSelected ? 'var(--marker-blue)' : 'var(--paper-ink)',
                              textTransform: 'uppercase',
                            }}
                          >
                            {f.label}
                          </span>
                          <span
                            style={{
                              fontSize: '12px',
                              color: 'var(--paper-dim)',
                              lineHeight: '1.35',
                            }}
                          >
                            {f.desc}
                          </span>
                        </div>

                        {/* Blue Marker Ring indicator for chosen option */}
                        <div
                          style={{
                            flexShrink: 0,
                            width: '28px',
                            height: '28px',
                            display: 'grid',
                            placeItems: 'center',
                          }}
                        >
                          {isSelected ? (
                            <svg width="26" height="26" viewBox="0 0 28 28">
                              <circle
                                cx="14"
                                cy="14"
                                r="11"
                                fill="none"
                                stroke="var(--marker-blue)"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                strokeDasharray="65"
                                strokeDashoffset="0"
                              />
                              <circle cx="14" cy="14" r="5" fill="var(--marker-blue)" />
                            </svg>
                          ) : (
                            <div
                              style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                border: '1.5px solid var(--paper-rule)',
                              }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Match Preparation (§12.17.2) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  className="broadcast-label"
                  style={{ color: 'var(--paper-dim)', marginBottom: '4px', fontSize: '12px' }}
                >
                  MATCH PREPARATION (§12.17.2)
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--paper-2)',
                    padding: '16px',
                    borderRadius: '4px',
                    border: '1px solid var(--paper-rule)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                    }}
                  >
                    {prepOptions.map((prep) => {
                      const isSelected = currentPrep === prep.id;
                      return (
                        <button
                          key={prep.id}
                          onClick={() => handlePrepSelect(prep.id)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '3px',
                            fontSize: '11px',
                            fontFamily: 'var(--font-head)',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? 'var(--marker-blue)' : 'var(--paper)',
                            color: isSelected ? '#ffffff' : 'var(--paper-ink)',
                            border: isSelected
                              ? '1px solid var(--marker-blue)'
                              : '1px solid var(--paper-rule)',
                            transition: 'all var(--dur-fast)',
                          }}
                        >
                          {prep.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Prep Explanation & Trade-off */}
                  {(() => {
                    const activeOpt =
                      prepOptions.find((p) => p.id === currentPrep) ?? prepOptions[0]!;
                    return (
                      <div
                        style={{
                          backgroundColor: 'var(--paper)',
                          padding: '12px',
                          borderRadius: '3px',
                          border: '1px solid var(--paper-rule)',
                          fontSize: '12px',
                          lineHeight: '1.45',
                        }}
                      >
                        <div style={{ fontWeight: 700, color: 'var(--paper-ink)' }}>
                          {activeOpt.label}
                        </div>
                        <div style={{ color: 'var(--paper-ink)', marginTop: '2px' }}>
                          {activeOpt.description}
                        </div>
                        <div style={{ color: 'var(--paper-dim)', marginTop: '4px' }}>
                          {activeOpt.detail}
                        </div>

                        {currentPrep !== 'None' && (
                          <div
                            style={{
                              marginTop: '8px',
                              paddingTop: '6px',
                              borderTop: '1px solid var(--paper-rule)',
                              color: 'var(--marker-red)',
                              fontWeight: 600,
                              fontSize: '11px',
                            }}
                          >
                            Cost: Team focus bonus halved, and player development reduced by 15%
                            this week.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Physio Staff Info */}
                <div
                  style={{
                    backgroundColor: 'var(--paper-2)',
                    padding: '12px 16px',
                    borderRadius: '4px',
                    border: '1px solid var(--paper-rule)',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                      CLUB PHYSIO
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--paper-ink)' }}>
                      {userClub.staff?.physio.name ?? 'Lead Physio'} (
                      {userClub.staff?.physio.stars ?? 3}★)
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', color: 'var(--paper-dim)' }}>
                    Injury Hazard: x{(1.1 - 0.04 * (userClub.staff?.physio.stars ?? 3)).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Individual Training, Rest & Injury Risk Table (§12.17.3, §12.17.4, §12.17.6) */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  borderBottom: '1px solid var(--paper-rule)',
                  paddingBottom: '8px',
                  marginBottom: '12px',
                }}
              >
                <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                  INDIVIDUAL PLAYER TRAINING & REST REGIME (§12.17)
                </div>
                <div style={{ fontSize: '11px', color: 'var(--paper-dim)' }}>
                  Rested players gain +8 Cond / −6 Fatigue (dev paused). Fit players rested 3+ weeks
                  get morale penalty.
                </div>
              </div>

              <div
                style={{
                  border: '1px solid var(--paper-rule)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--paper)',
                  overflowX: 'auto',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    textAlign: 'left',
                    fontSize: '12px',
                  }}
                >
                  <thead>
                    <tr
                      className="broadcast-label"
                      style={{
                        backgroundColor: 'var(--paper-2)',
                        borderBottom: '2px solid var(--paper-rule)',
                        color: 'var(--paper-dim)',
                      }}
                    >
                      <th style={{ padding: '8px 12px' }}>PLAYER</th>
                      <th style={{ padding: '8px 12px', width: '60px' }}>POS</th>
                      <th style={{ padding: '8px 12px', width: '80px' }}>COND / FAT</th>
                      <th style={{ padding: '8px 12px', width: '100px' }}>INJURY RISK</th>
                      <th style={{ padding: '8px 12px', width: '110px' }}>REST DAYS</th>
                      <th style={{ padding: '8px 12px', minWidth: '240px' }}>
                        INDIVIDUAL FOCUS (ROLE / POS / ATTR)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {squadPlayers.map((player) => {
                      const risk = getInjuryRisk(player, userClub.staff?.physio.stars ?? 3);
                      const isGk = player.positions[0]?.pos === 'GK';
                      const currentFocus =
                        userClub.trainingPlan?.individualFocus?.[player.id] ?? null;

                      // Derive select string value
                      let selectVal = '';
                      if (currentFocus) {
                        if (currentFocus.type === 'attribute') {
                          selectVal = `attr:${currentFocus.attribute}`;
                        } else if (currentFocus.type === 'role') {
                          selectVal = `role:${currentFocus.roleId}`;
                        } else if (currentFocus.type === 'position') {
                          selectVal = `pos:${currentFocus.position}`;
                        }
                      }

                      const handleFocusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
                        const val = e.target.value;
                        if (!val) {
                          setPlayerIndividualFocus(player.id, null);
                        } else if (val.startsWith('attr:')) {
                          setPlayerIndividualFocus(player.id, {
                            type: 'attribute',
                            attribute: val.slice(5) as AttributeKey,
                          });
                        } else if (val.startsWith('role:')) {
                          setPlayerIndividualFocus(player.id, {
                            type: 'role',
                            roleId: val.slice(5),
                          });
                        } else if (val.startsWith('pos:')) {
                          setPlayerIndividualFocus(player.id, {
                            type: 'position',
                            position: val.slice(4) as Position,
                          });
                        }
                      };

                      const fitRestWarning =
                        player.condition >= 90 && (player.consecutiveRestWeeks ?? 0) >= 2;

                      return (
                        <tr
                          key={player.id}
                          style={{
                            borderBottom: '1px solid var(--paper-rule)',
                            backgroundColor: player.rest
                              ? 'rgba(46, 125, 50, 0.05)'
                              : 'transparent',
                          }}
                        >
                          {/* Name */}
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Portrait
                                playerId={player.id}
                                initials={`${player.firstName[0] ?? ''}${player.lastName[0] ?? ''}`}
                                primaryColor={userClub.colors.primary}
                                secondaryColor={userClub.colors.secondary}
                                size={28}
                              />
                              <div>
                                <span style={{ fontWeight: 700, color: 'var(--paper-ink)' }}>
                                  {player.knownAs ?? `${player.firstName} ${player.lastName}`}
                                </span>
                                <div style={{ fontSize: '10px', color: 'var(--paper-dim)' }}>
                                  Age {player.age} · Morale {player.morale}%
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Pos */}
                          <td style={{ padding: '8px 12px' }}>
                            <span
                              className="broadcast-label"
                              style={{
                                backgroundColor: 'var(--paper-2)',
                                padding: '2px 5px',
                                borderRadius: '2px',
                                border: '1px solid var(--paper-rule)',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}
                            >
                              {player.positions[0]?.pos}
                            </span>
                          </td>

                          {/* Cond / Fatigue */}
                          <td style={{ padding: '8px 12px' }}>
                            <div className="tabular-nums" style={{ fontWeight: 600 }}>
                              <span
                                style={{
                                  color:
                                    player.condition >= 85
                                      ? 'var(--marker-green)'
                                      : player.condition >= 70
                                        ? 'var(--paper-ink)'
                                        : 'var(--marker-red)',
                                }}
                              >
                                {player.condition}%
                              </span>
                              <span style={{ color: 'var(--paper-dim)', fontSize: '11px' }}>
                                {' '}
                                / {player.fatigue}
                              </span>
                            </div>
                          </td>

                          {/* Injury Risk Chip */}
                          <td style={{ padding: '8px 12px' }}>
                            <span
                              title={risk.reasons.join(', ') || 'Normal physical load'}
                              style={{
                                display: 'inline-block',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                fontSize: '10px',
                                fontWeight: 700,
                                letterSpacing: '0.04em',
                                backgroundColor:
                                  risk.level === 'High'
                                    ? 'rgba(211, 47, 47, 0.15)'
                                    : risk.level === 'Medium'
                                      ? 'rgba(235, 175, 40, 0.2)'
                                      : 'rgba(46, 125, 50, 0.15)',
                                color:
                                  risk.level === 'High'
                                    ? 'var(--marker-red)'
                                    : risk.level === 'Medium'
                                      ? '#996000'
                                      : 'var(--marker-green)',
                              }}
                            >
                              {risk.level.toUpperCase()}
                            </span>
                          </td>

                          {/* Rest Toggle */}
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                onClick={() => setPlayerRest(player.id, !player.rest)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '3px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  backgroundColor: player.rest
                                    ? 'var(--marker-green)'
                                    : 'var(--paper-2)',
                                  color: player.rest ? '#ffffff' : 'var(--paper-ink)',
                                  border: player.rest
                                    ? '1px solid var(--marker-green)'
                                    : '1px solid var(--paper-rule)',
                                }}
                              >
                                {player.rest ? 'RESTED' : 'TRAIN'}
                              </button>
                              {fitRestWarning && (
                                <span
                                  title="Fit player rested 2+ weeks (approaching morale penalty)"
                                  style={{ color: 'var(--marker-red)' }}
                                >
                                  <AlertTriangle size={14} />
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Individual Focus Select */}
                          <td style={{ padding: '8px 12px' }}>
                            <select
                              value={selectVal}
                              onChange={handleFocusChange}
                              style={{
                                width: '100%',
                                padding: '4px 6px',
                                backgroundColor: 'var(--paper-2)',
                                color: 'var(--paper-ink)',
                                border: '1px solid var(--paper-rule)',
                                borderRadius: '3px',
                                fontSize: '11px',
                                cursor: 'pointer',
                              }}
                            >
                              <option value="">None (Standard Group Training)</option>

                              <optgroup label="Attributes (+focus growth)">
                                {attributesList.map((attr) => (
                                  <option key={attr.key} value={`attr:${attr.key}`}>
                                    Attribute: {attr.label}
                                  </option>
                                ))}
                              </optgroup>

                              <optgroup label="Tactical Roles (40% growth to role)">
                                {Object.values(ROLES)
                                  .filter((r) =>
                                    isGk ? r.slots.includes('GK') : !r.slots.includes('GK'),
                                  )
                                  .map((role) => (
                                    <option key={role.id} value={`role:${role.id}`}>
                                      Role: {role.name}
                                    </option>
                                  ))}
                              </optgroup>

                              {!isGk && (
                                <optgroup label="Position Retraining (Capped at 95)">
                                  {outfieldPositions
                                    .filter((p) => p !== player.positions[0]?.pos)
                                    .map((pos) => {
                                      const existing = player.positions.find((x) => x.pos === pos);
                                      const famText = existing ? ` (${existing.familiarity}%)` : '';
                                      return (
                                        <option key={pos} value={`pos:${pos}`}>
                                          Position: {pos}
                                          {famText}
                                        </option>
                                      );
                                    })}
                                </optgroup>
                              )}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Sheet>
      </div>
    </div>
  );
};
