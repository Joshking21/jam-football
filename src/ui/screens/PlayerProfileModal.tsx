// Implements SPEC §11.7 Player Profile modal (960px, Sheet "file" variant on desk)
// Manila tab with player name, portrait, Stamps (INJURED, SUSPENDED, etc.),
// Tabs: Attributes (Technical / Physical / Mental / GK), Stats (Season stats + Form), Status (Condition, Fatigue, Morale), History.
// Actions: Captain toggle, Taker toggles, Transfer List toggle, Training focus.
import { TRAIT_DEFINITIONS, ALL_TRAIT_IDS } from '../../core/player/traits';
import type { TraitId } from '../../core/types';
import { TraitChips } from '../components/TraitChips';
import React, { useState } from 'react';
import { useStore } from '../../state/store';
import { Player, Position, AttributeKey } from '../../core/types';
import { Sheet } from '../components/Sheet';
import { Portrait } from '../components/Portrait';
import { Stamp } from '../components/Stamp';
import { Button } from '../components/Button';
import { formatMoney } from '../../core/math';
import { X, Star, Shield, Award, Activity, Heart, Clock } from 'lucide-react';

interface PlayerProfileModalProps {
  playerId: string | null;
  onClose: () => void;
}

type ProfileTab = 'ATTRIBUTES' | 'STATS' | 'STATUS' | 'HISTORY';

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({ playerId, onClose }) => {
  const gameState = useStore((state) => state.gameState);
  const updateUserTactics = useStore((state) => state.updateUserTactics);
  const updateUserTraining = useStore((state) => state.updateUserTraining);
  const showToast = useStore((state) => state.showToast);
  const setPlayerIndividualFocus = useStore((state) => state.setPlayerIndividualFocus);

  const [activeTab, setActiveTab] = useState<ProfileTab>('ATTRIBUTES');

  if (!playerId || !gameState) return null;

  const player = gameState.players[playerId];
  if (!player) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;
  const isOwnPlayer = player.clubId === userClub.id;

  const isCaptain = userClub.tactics.captain === player.id;
  const isPenaltyTaker = userClub.tactics.takers.penalty === player.id;
  const isFreeKickTaker = userClub.tactics.takers.freeKick === player.id;
  const isCornerTaker = userClub.tactics.takers.corner === player.id;

  const currentTrainingFocus = userClub.trainingPlan?.individual?.[player.id] ?? null;

  // Potential stars
  const getPotentialStars = (pot: number): number => {
    if (pot >= 85) return 5;
    if (pot >= 78) return 4;
    if (pot >= 71) return 3;
    if (pot >= 64) return 2;
    return 1;
  };

  // Color for attributes (SPEC §19.4)
  const getAttrColor = (val: number): string => {
    if (val >= 85) return 'var(--attr-elite)';
    if (val >= 75) return 'var(--attr-great)';
    if (val >= 65) return 'var(--attr-good)';
    if (val >= 55) return 'var(--attr-avg)';
    if (val >= 40) return 'var(--attr-subpar)';
    return 'var(--attr-poor)';
  };

  const renderAttributeRow = (label: string, value: number) => (
    <div
      key={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 0',
        borderBottom: '1px solid var(--paper-rule)',
        fontSize: '13px',
      }}
    >
      <span style={{ color: 'var(--paper-dim)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            width: '40px',
            height: '4px',
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${value}%`,
              height: '100%',
              backgroundColor: getAttrColor(value),
            }}
          />
        </div>
        <span
          className="tabular-nums"
          style={{
            fontWeight: 700,
            width: '24px',
            textAlign: 'right',
            color: 'var(--paper-ink)',
          }}
        >
          {value}
        </span>
      </div>
    </div>
  );

  const toggleCaptain = () => {
    updateUserTactics({ captain: isCaptain ? null : player.id });
    showToast(
      isCaptain
        ? `Relieved ${player.lastName} of captaincy`
        : `Appointed ${player.lastName} as captain`,
      'info',
    );
  };

  const togglePenalty = () => {
    updateUserTactics({
      takers: {
        ...userClub.tactics.takers,
        penalty: isPenaltyTaker ? null : player.id,
      },
    });
  };

  const handleFocusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = (e.target.value as AttributeKey) || null;
    const plan = userClub.trainingPlan || {
      focus: 'Balanced',
      intensity: 'Normal',
      individual: {},
    };
    updateUserTraining({
      individual: {
        ...plan.individual,
        [player.id]: val,
      },
    });
    showToast(val ? `Training focus set to ${val}` : 'Training focus cleared', 'info');
  };

  const isGK = player.positions[0]?.pos === 'GK';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        padding: '24px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{ width: '100%', maxWidth: '960px', position: 'relative' }}>
        {/* Close Button top-right */}
        <button
          onClick={onClose}
          aria-label="Close file"
          style={{
            position: 'absolute',
            top: '-32px',
            right: '0px',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '13px',
            zIndex: 10,
          }}
        >
          <X size={18} /> Close File [Esc]
        </button>

        {/* Sheet "file" variant on desk */}
        <Sheet
          id={`player-profile-${player.id}`}
          variant="file"
          tabLabel={`DOSSIER · ${player.lastName.toUpperCase()}, ${player.firstName.toUpperCase()}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header: Portrait, Core Info, Stamps */}
            <div
              style={{
                display: 'flex',
                gap: '24px',
                borderBottom: '2px solid var(--paper-rule)',
                paddingBottom: '20px',
                alignItems: 'flex-start',
              }}
            >
              {/* Portrait */}
              <div style={{ flexShrink: 0 }}>
                <Portrait
                  playerId={player.id}
                  initials={`${player.firstName[0] ?? ''}${player.lastName[0] ?? ''}`}
                  primaryColor={userClub.colors.primary}
                  secondaryColor={userClub.colors.secondary}
                  size={120}
                />
              </div>

              {/* Player details */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h1
                    style={{
                      fontFamily: 'var(--font-head)',
                      fontSize: '32px',
                      color: 'var(--paper-ink)',
                      margin: 0,
                    }}
                  >
                    {player.firstName} {player.lastName}
                  </h1>
                  {player.squadNumber && (
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: '22px',
                        fontWeight: 700,
                        color: 'var(--paper-dim)',
                        fontFamily: 'var(--font-head)',
                      }}
                    >
                      #{player.squadNumber}
                    </span>
                  )}
                  {isCaptain && (
                    <span
                      style={{
                        backgroundColor: 'var(--gold)',
                        color: '#000000',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '2px',
                        fontFamily: 'var(--font-head)',
                      }}
                    >
                      CAPTAIN
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    color: 'var(--paper-dim)',
                    fontSize: '14px',
                    marginTop: '4px',
                  }}
                >
                  <span>
                    <strong>{player.nationality}</strong>
                  </span>
                  <span>·</span>
                  <span>{player.age} yrs</span>
                  <span>·</span>
                  <span>{player.heightCm} cm</span>
                  <span>·</span>
                  <span>{player.foot} footed</span>
                  <span>·</span>
                  <span>{player.personality}</span>
                </div>

                {/* Habits: player traits (§13.23), with clashes against his instructions */}
                <div style={{ marginTop: '10px' }}>
                  <span
                    className="broadcast-label"
                    style={{ fontSize: '11px', color: 'var(--paper-dim)' }}
                  >
                    HABITS
                  </span>
                  <div style={{ marginTop: '4px', color: 'var(--paper-ink)' }}>
                    <TraitChips
                      traits={player.traits}
                      variant="list"
                      instructions={(() => {
                        const slot = userClub?.tactics.lineup.indexOf(player.id) ?? -1;
                        if (!userClub || slot < 0) return undefined;
                        const t = userClub.tactics;
                        return [
                          ...(t.attInstructions?.[slot] ?? t.playerInstructions?.[slot] ?? []),
                          ...(t.defInstructions?.[slot] ?? []),
                        ];
                      })()}
                    />
                  </div>
                </div>

                {/* Learn or unlearn a habit in training (§13.23, individual focus "Trait") */}
                {player.clubId === gameState.userClubId && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--paper-ink)' }}>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ color: 'var(--paper-dim)' }}>Work on a habit:</span>
                      <select
                        value={(() => {
                          const f = userClub?.trainingPlan?.individualFocus?.[player.id];
                          return f && f.type === 'trait'
                            ? `${f.unlearn ? 'u' : 'l'}:${f.trait}`
                            : '';
                        })()}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) {
                            setPlayerIndividualFocus(player.id, null);
                            return;
                          }
                          const [mode, trait] = v.split(':') as ['l' | 'u', TraitId];
                          setPlayerIndividualFocus(player.id, {
                            type: 'trait',
                            trait,
                            unlearn: mode === 'u',
                          });
                          showToast(
                            `${player.lastName} will ${mode === 'u' ? 'unlearn' : 'learn'}: ${TRAIT_DEFINITIONS[trait].wording.toLowerCase()}`,
                            'info',
                          );
                        }}
                        style={{
                          font: 'inherit',
                          background: 'transparent',
                          color: 'inherit',
                          border: '1px solid var(--paper-rule)',
                          padding: '2px 4px',
                        }}
                      >
                        <option value="">None</option>
                        {ALL_TRAIT_IDS.filter(
                          (t) =>
                            !(player.traits ?? []).includes(t) &&
                            TRAIT_DEFINITIONS[t].isEligible(player),
                        ).map((t) => (
                          <option key={`l-${t}`} value={`l:${t}`}>
                            Learn: {TRAIT_DEFINITIONS[t].wording}
                          </option>
                        ))}
                        {(player.traits ?? []).map((t) => (
                          <option key={`u-${t}`} value={`u:${t}`}>
                            Unlearn: {TRAIT_DEFINITIONS[t].wording}
                          </option>
                        ))}
                      </select>
                    </label>
                    {player.traitTraining && (
                      <div style={{ color: 'var(--paper-dim)', marginTop: 4 }}>
                        {player.traitTraining.unlearn ? 'Unlearning' : 'Learning'}{' '}
                        {TRAIT_DEFINITIONS[player.traitTraining.trait].wording.toLowerCase()}:{' '}
                        {Math.round(player.traitTraining.progress)}%
                      </div>
                    )}
                  </div>
                )}

                {/* Positions Chips */}
                <div
                  style={{
                    display: 'flex',
                    gap: '6px',
                    marginTop: '10px',
                    alignItems: 'center',
                  }}
                >
                  <span
                    className="broadcast-label"
                    style={{ fontSize: '11px', color: 'var(--paper-dim)' }}
                  >
                    POSITIONS:
                  </span>
                  {player.positions.map((pos) => (
                    <span
                      key={pos.pos}
                      className="broadcast-label"
                      style={{
                        backgroundColor: 'var(--paper-2)',
                        border: '1px solid var(--paper-rule)',
                        padding: '2px 8px',
                        borderRadius: '3px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--paper-ink)',
                      }}
                    >
                      {pos.pos} ({pos.familiarity}%)
                    </span>
                  ))}
                </div>

                {/* Financials & Contract */}
                <div
                  style={{
                    display: 'flex',
                    gap: '24px',
                    marginTop: '12px',
                    fontSize: '13px',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--paper-dim)' }}>Value: </span>
                    <strong className="tabular-nums">
                      {formatMoney(player.contract ? player.contract.wagePerWeek * 50 : 250000)}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--paper-dim)' }}>Wage: </span>
                    <strong className="tabular-nums">
                      {player.contract ? `${formatMoney(player.contract.wagePerWeek)}/wk` : '-'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--paper-dim)' }}>Contract: </span>
                    <strong>
                      {player.contract ? `${player.contract.yearsLeft} yrs left` : 'Free agent'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Status Rubber Stamps (SPEC §19.3) */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  alignItems: 'flex-end',
                }}
              >
                {player.injury && (
                  <Stamp label={`INJURED (${player.injury.matchdaysOut} MD)`} variant="red" />
                )}
                {player.suspendedMatches > 0 && (
                  <Stamp label={`SUSPENDED (${player.suspendedMatches} MD)`} variant="red" />
                )}
                {player.transferListed && <Stamp label="TRANSFER LISTED" variant="ink" />}
                {player.notForSale && <Stamp label="NOT FOR SALE" variant="ink" />}
              </div>
            </div>

            {/* Navigation Tabs */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                borderBottom: '1px solid var(--paper-rule)',
                paddingBottom: '8px',
              }}
            >
              {(['ATTRIBUTES', 'STATS', 'STATUS', 'HISTORY'] as ProfileTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="broadcast-label"
                  style={{
                    padding: '6px 14px',
                    borderRadius: '3px',
                    backgroundColor: activeTab === tab ? 'var(--paper-ink)' : 'transparent',
                    color: activeTab === tab ? 'var(--paper)' : 'var(--paper-dim)',
                    fontWeight: 700,
                    fontSize: '12px',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab 1: Attributes */}
            {activeTab === 'ATTRIBUTES' && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '24px',
                }}
              >
                {/* Technical / Goalkeeping */}
                <div>
                  <div
                    className="broadcast-label"
                    style={{
                      color: 'var(--paper-ink)',
                      borderBottom: '2px solid var(--paper-ink)',
                      paddingBottom: '4px',
                      marginBottom: '8px',
                    }}
                  >
                    {isGK ? 'GOALKEEPING' : 'TECHNICAL'}
                  </div>
                  {renderAttributeRow('Finishing', player.attributes.finishing)}
                  {renderAttributeRow('Long Shots', player.attributes.longShots)}
                  {renderAttributeRow('Passing', player.attributes.passing)}
                  {renderAttributeRow('Crossing', player.attributes.crossing)}
                  {renderAttributeRow('First Touch', player.attributes.firstTouch)}
                  {renderAttributeRow('Dribbling', player.attributes.dribbling)}
                  {renderAttributeRow('Tackling', player.attributes.tackling)}
                  {renderAttributeRow('Heading', player.attributes.heading)}
                  {renderAttributeRow('Set Pieces', player.attributes.setPieces)}
                </div>

                {/* Physical */}
                <div>
                  <div
                    className="broadcast-label"
                    style={{
                      color: 'var(--paper-ink)',
                      borderBottom: '2px solid var(--paper-ink)',
                      paddingBottom: '4px',
                      marginBottom: '8px',
                    }}
                  >
                    PHYSICAL
                  </div>
                  {renderAttributeRow('Pace', player.attributes.pace)}
                  {renderAttributeRow('Stamina', player.attributes.stamina)}
                  {renderAttributeRow('Strength', player.attributes.strength)}
                </div>

                {/* Mental */}
                <div>
                  <div
                    className="broadcast-label"
                    style={{
                      color: 'var(--paper-ink)',
                      borderBottom: '2px solid var(--paper-ink)',
                      paddingBottom: '4px',
                      marginBottom: '8px',
                    }}
                  >
                    MENTAL
                  </div>
                  {renderAttributeRow('Off The Ball', player.attributes.offTheBall)}
                  {renderAttributeRow('Positioning', player.attributes.positioning)}
                  {renderAttributeRow('Decisions', player.attributes.decisions)}
                  {renderAttributeRow('Composure', player.attributes.composure)}
                  {renderAttributeRow('Work Rate', player.attributes.workRate)}
                </div>
              </div>
            )}

            {/* Tab 2: Stats */}
            {activeTab === 'STATS' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: '12px',
                    backgroundColor: 'var(--paper-2)',
                    padding: '16px',
                    borderRadius: '4px',
                    border: '1px solid var(--paper-rule)',
                  }}
                >
                  <div>
                    <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                      APPS
                    </div>
                    <div className="stat-number" style={{ fontSize: '24px' }}>
                      {player.stats.apps}
                    </div>
                  </div>
                  <div>
                    <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                      GOALS
                    </div>
                    <div className="stat-number" style={{ fontSize: '24px' }}>
                      {player.stats.goals}
                    </div>
                  </div>
                  <div>
                    <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                      ASSISTS
                    </div>
                    <div className="stat-number" style={{ fontSize: '24px' }}>
                      {player.stats.assists}
                    </div>
                  </div>
                  <div>
                    <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                      CLEAN SHEETS
                    </div>
                    <div className="stat-number" style={{ fontSize: '24px' }}>
                      {player.stats.cleanSheets}
                    </div>
                  </div>
                  <div>
                    <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                      AVG RATING
                    </div>
                    <div className="stat-number" style={{ fontSize: '24px' }}>
                      {player.stats.ratedApps > 0
                        ? (player.stats.ratingSum / player.stats.ratedApps).toFixed(2)
                        : '-'}
                    </div>
                  </div>
                </div>

                {/* Form ratings sparkline / history */}
                <div>
                  <div
                    className="broadcast-label"
                    style={{ color: 'var(--paper-dim)', marginBottom: '8px' }}
                  >
                    RECENT MATCH RATINGS
                  </div>
                  {player.form.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--paper-dim)' }}>
                      No official match ratings recorded this campaign.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '12px' }}>
                      {player.form.map((r, i) => (
                        <div
                          key={i}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: 'var(--paper-2)',
                            border: '1px solid var(--paper-rule)',
                            borderRadius: '3px',
                            fontWeight: 700,
                            fontFamily: 'var(--font-head)',
                            fontSize: '16px',
                          }}
                        >
                          {r.toFixed(1)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Status */}
            {activeTab === 'STATUS' && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '24px',
                }}
              >
                <div
                  style={{
                    backgroundColor: 'var(--paper-2)',
                    padding: '16px',
                    borderRadius: '4px',
                    border: '1px solid var(--paper-rule)',
                  }}
                >
                  <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                    FITNESS & READINESS
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '14px' }}>
                    <div>
                      Condition: <strong>{player.condition}%</strong>
                    </div>
                    <div style={{ marginTop: '6px' }}>
                      Fatigue load: <strong>{player.fatigue}%</strong>
                    </div>
                    <div style={{ marginTop: '6px' }}>
                      Morale: <strong>{player.morale}%</strong>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--paper-2)',
                    padding: '16px',
                    borderRadius: '4px',
                    border: '1px solid var(--paper-rule)',
                  }}
                >
                  <div className="broadcast-label" style={{ color: 'var(--paper-dim)' }}>
                    DISCIPLINARY & MEDICAL
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '14px' }}>
                    <div>
                      Suspension:{' '}
                      <strong>
                        {player.suspendedMatches > 0
                          ? `${player.suspendedMatches} matches`
                          : 'None'}
                      </strong>
                    </div>
                    <div style={{ marginTop: '6px' }}>
                      Injury status:{' '}
                      <strong>
                        {player.injury
                          ? `${player.injury.kind} (${player.injury.matchdaysOut} matchdays remaining)`
                          : 'Fit for selection'}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: History */}
            {activeTab === 'HISTORY' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {player.history.length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--paper-dim)' }}>
                    Joined club at start of season.
                  </div>
                ) : (
                  player.history.map((h, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--paper-rule)',
                        fontSize: '13px',
                      }}
                    >
                      <span className="broadcast-label" style={{ marginRight: '8px' }}>
                        MD {h.matchday}:
                      </span>
                      <span>{h.event}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Actions Bar (own players) */}
            {isOwnPlayer && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '2px solid var(--paper-rule)',
                  paddingTop: '16px',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Button
                    variant={isCaptain ? 'primary' : 'secondary'}
                    size="s"
                    onClick={toggleCaptain}
                  >
                    {isCaptain ? 'Captain ✓' : 'Make Captain'}
                  </Button>
                  <Button
                    variant={isPenaltyTaker ? 'primary' : 'secondary'}
                    size="s"
                    onClick={togglePenalty}
                  >
                    {isPenaltyTaker ? 'Penalty Taker ✓' : 'Set Penalties'}
                  </Button>
                </div>

                {/* Individual training focus dropdown */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    className="broadcast-label"
                    style={{ fontSize: '11px', color: 'var(--paper-dim)' }}
                  >
                    FOCUS:
                  </span>
                  <select
                    value={currentTrainingFocus ?? ''}
                    onChange={handleFocusChange}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      backgroundColor: 'var(--paper-2)',
                      color: 'var(--paper-ink)',
                      border: '1px solid var(--paper-rule)',
                      borderRadius: '3px',
                    }}
                  >
                    <option value="">None (General)</option>
                    <option value="finishing">Finishing</option>
                    <option value="passing">Passing</option>
                    <option value="tackling">Tackling</option>
                    <option value="pace">Pace</option>
                    <option value="stamina">Stamina</option>
                    <option value="decisions">Decisions</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </Sheet>
      </div>
    </div>
  );
};
