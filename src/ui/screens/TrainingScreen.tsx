// Implements SPEC §11.9 Training screen (office world)
// Clipboard layout: focus list of rows with chosen one circled in blue marker (REVIEW M6)
// Intensity segmented control + Match prep, rest schedule, role training & injury risk room (§12.17)
import React from 'react';
import { useStore } from '../../state/store';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
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
} from 'lucide-react';
import { TrainingPlan } from '../../core/types';

export const TrainingScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const updateUserTraining = useStore((state) => state.updateUserTraining);
  const showToast = useStore((state) => state.showToast);

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  const plan = userClub.trainingPlan || {
    focus: 'Balanced',
    intensity: 'Normal',
    individual: {},
  };

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

  const handleFocusSelect = (focus: TrainingPlan['focus']) => {
    updateUserTraining({ focus });
    showToast(`Team training focus set to ${focus}`, 'info');
  };

  const handleIntensitySelect = (intensity: TrainingPlan['intensity']) => {
    updateUserTraining({ intensity });
    showToast(`Training intensity set to ${intensity}`, 'info');
  };

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

            {/* 2-Column Split: Focus List on Left (M6), M5 additions on Right */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr',
                gap: '24px',
                alignItems: 'start',
              }}
            >
              {/* Left Column: Team Focus as a List of Rows with Blue Marker Circle (REVIEW M6) */}
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
                              fontSize: '17px',
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

              {/* Right Column: Room for M5 additions (§12.17 Match prep, Rest days, Role training, Injury risk) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Match Preparation */}
                <div
                  style={{
                    backgroundColor: 'var(--paper-2)',
                    padding: '14px 16px',
                    borderRadius: '4px',
                    border: '1px solid var(--paper-rule)',
                  }}
                >
                  <div
                    className="broadcast-label"
                    style={{
                      color: 'var(--paper-ink)',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '6px',
                    }}
                  >
                    <Sparkles size={14} color="var(--marker-blue)" /> MATCH PREPARATION
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--paper-ink)', fontWeight: 600 }}>
                    Opponent Specific Drills
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--paper-dim)',
                      marginTop: '2px',
                      lineHeight: '1.4',
                    }}
                  >
                    Defending second balls and transitions tailored to upcoming matchday fixture.
                  </div>
                </div>

                {/* Rest Days & Recovery */}
                <div
                  style={{
                    backgroundColor: 'var(--paper-2)',
                    padding: '14px 16px',
                    borderRadius: '4px',
                    border: '1px solid var(--paper-rule)',
                  }}
                >
                  <div
                    className="broadcast-label"
                    style={{
                      color: 'var(--paper-ink)',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '6px',
                    }}
                  >
                    <Clock size={14} color="var(--marker-green)" /> REST & RECOVERY
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--paper-ink)', fontWeight: 600 }}>
                    Post-Matchday Rest Day Scheduled
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--paper-dim)',
                      marginTop: '2px',
                      lineHeight: '1.4',
                    }}
                  >
                    Full squad rest following matchday, followed by light recovery before tactical
                    sessions.
                  </div>
                </div>

                {/* Injury Risk Assessment */}
                <div
                  style={{
                    backgroundColor: 'var(--paper-2)',
                    padding: '14px 16px',
                    borderRadius: '4px',
                    border: '1px solid var(--paper-rule)',
                  }}
                >
                  <div
                    className="broadcast-label"
                    style={{
                      color: 'var(--paper-ink)',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '6px',
                    }}
                  >
                    <HeartPulse size={14} color="var(--marker-red)" /> INJURY RISK MONITOR
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--paper-ink)', fontWeight: 600 }}>
                    Normal Training Load
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--paper-dim)',
                      marginTop: '2px',
                      lineHeight: '1.4',
                    }}
                  >
                    Low overall fatigue accumulation under current {plan.intensity.toLowerCase()}{' '}
                    intensity schedule.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Sheet>
      </div>
    </div>
  );
};
