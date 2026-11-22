// Implements SPEC §11.18 Full-Time and Post-Match screen (on-air broadcast world)
// Final score, scorers with minutes, player ratings, stats comparison, team talk, Continue to Week Summary.
import React, { useState } from 'react';
import { useStore } from '../../state/store';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { Crest } from '../components/Crest';
import { Portrait } from '../components/Portrait';
import { Ticker } from '../components/Ticker';
import { Award, ArrowRight, TrendingUp, MessageSquare, Radio } from 'lucide-react';
import {
  TalkTone,
  getFullTimeTalkContext,
  predictTalkReaction,
  TALKS_DATA,
} from '../../core/player/talks';
import { PressAnswerResult } from '../../core/game/press';

export const PostMatchScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const advanceGame = useStore((state) => state.advanceGame);
  const performTeamTalk = useStore((state) => state.performTeamTalk);
  const answerPressQuestion = useStore((state) => state.answerPressQuestion);
  const skipPressConference = useStore((state) => state.skipPressConference);
  const showToast = useStore((state) => state.showToast);

  const [postMatchTalk, setPostMatchTalk] = useState<TalkTone>('Praise');
  const [pressResult, setPressResult] = useState<PressAnswerResult | null>(null);

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  // Retrieve latest fixture result for user's club
  const latestFixture = gameState.fixtures
    .filter((f) => (f.homeId === userClub.id || f.awayId === userClub.id) && f.result !== null)
    .sort((a, b) => b.matchday - a.matchday)[0];

  const result = latestFixture?.result;
  const isHome = latestFixture ? latestFixture.homeId === userClub.id : true;
  const homeClub = latestFixture ? (gameState.clubs[latestFixture.homeId] ?? userClub) : userClub;
  const awayClub = latestFixture ? (gameState.clubs[latestFixture.awayId] ?? userClub) : userClub;

  const isUserWinner =
    result &&
    ((isHome && result.homeGoals > result.awayGoals) ||
      (!isHome && result.awayGoals > result.homeGoals));
  const isDraw = result && result.homeGoals === result.awayGoals;

  const userGoals = result ? (isHome ? result.homeGoals : result.awayGoals) : 0;
  const oppGoals = result ? (isHome ? result.awayGoals : result.homeGoals) : 0;
  const ftContext = getFullTimeTalkContext(userGoals, oppGoals);

  const handleContinueToWeekSummary = async () => {
    performTeamTalk(ftContext, postMatchTalk);
    await advanceGame();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
      }}
    >
      <div className="app-content-area" style={{ flex: 1 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            maxWidth: '1000px',
            margin: '0 auto',
          }}
        >
          {/* Header Final Score Banner */}
          <Panel dominant title="MATCH RESULT & POST-MATCH REPORT">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-around',
                padding: '28px 0',
              }}
            >
              {/* Home Club */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  width: '200px',
                }}
              >
                <Crest
                  clubId={homeClub.id}
                  code={homeClub.code}
                  primaryColor={homeClub.colors.primary}
                  secondaryColor={homeClub.colors.secondary}
                  size={68}
                />
                <div
                  style={{
                    fontFamily: 'var(--font-head)',
                    fontSize: '22px',
                    fontWeight: 700,
                  }}
                >
                  {homeClub.name.toUpperCase()}
                </div>
              </div>

              {/* Score Display */}
              <div style={{ textAlign: 'center' }}>
                <div
                  className="stat-number tabular-nums"
                  style={{
                    fontSize: '48px',
                    fontWeight: 700,
                    color: 'var(--text)',
                    lineHeight: 1,
                  }}
                >
                  {result ? `${result.homeGoals} - ${result.awayGoals}` : '0 - 0'}
                </div>
                <div
                  className="broadcast-label"
                  style={{
                    fontSize: '13px',
                    color: isUserWinner ? 'var(--win)' : isDraw ? 'var(--draw)' : 'var(--loss)',
                    marginTop: '8px',
                  }}
                >
                  {isUserWinner ? 'VICTORY' : isDraw ? 'HONOURS EVEN' : 'DEFEAT'}
                </div>
              </div>

              {/* Away Club */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  width: '200px',
                }}
              >
                <Crest
                  clubId={awayClub.id}
                  code={awayClub.code}
                  primaryColor={awayClub.colors.primary}
                  secondaryColor={awayClub.colors.secondary}
                  size={68}
                />
                <div
                  style={{
                    fontFamily: 'var(--font-head)',
                    fontSize: '22px',
                    fontWeight: 700,
                  }}
                >
                  {awayClub.name.toUpperCase()}
                </div>
              </div>
            </div>

            {/* Scorers list */}
            {result && result.scorers.length > 0 && (
              <div
                style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div
                  className="broadcast-label"
                  style={{ color: 'var(--text-dim)', fontSize: '11px' }}
                >
                  GOALSCORERS
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                  {result.scorers.map((s, idx) => {
                    const scorer = gameState.players[s.playerId];
                    return (
                      <div
                        key={idx}
                        style={{
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>
                          {scorer ? (scorer.knownAs ?? scorer.lastName) : 'Goal'}
                        </span>
                        <span className="tabular-nums" style={{ color: 'var(--accent-text)' }}>
                          ({s.minuteLabel}')
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Panel>

          {/* Post-Match Team Talk */}
          <Panel title="DRESSING ROOM DEBRIEF">
            <div style={{ fontSize: '14px', marginBottom: '14px' }}>
              Address the squad following the full-time whistle:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
              {(['Praise', 'Demand', 'Calm', 'Motivate', 'Disappoint', 'Focus'] as TalkTone[]).map(
                (tone) => (
                  <button
                    key={tone}
                    onClick={() => setPostMatchTalk(tone)}
                    className="broadcast-label"
                    style={{
                      padding: '10px 4px',
                      borderRadius: 'var(--radius-s)',
                      backgroundColor:
                        postMatchTalk === tone ? 'var(--accent)' : 'var(--surface-2)',
                      color: postMatchTalk === tone ? 'var(--accent-ink)' : 'var(--text)',
                      border: `1px solid ${postMatchTalk === tone ? 'var(--accent)' : 'var(--border)'}`,
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {tone}
                  </button>
                ),
              )}
            </div>

            {/* Expected reaction badge & manager speech preview */}
            <div
              style={{
                marginTop: '14px',
                padding: '12px 16px',
                backgroundColor: 'var(--surface-2)',
                borderRadius: 'var(--radius-m)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Predicted Squad Reaction:
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color:
                      predictTalkReaction(ftContext, postMatchTalk) === 'Most will respond well'
                        ? 'var(--win)'
                        : predictTalkReaction(ftContext, postMatchTalk) === 'Mixed'
                          ? 'var(--warning, #eab308)'
                          : 'var(--loss)',
                  }}
                >
                  {predictTalkReaction(ftContext, postMatchTalk)}
                </span>
              </div>
              <div
                style={{
                  fontSize: '13px',
                  fontStyle: 'italic',
                  color: 'var(--text-dim)',
                  borderLeft: '2px solid var(--accent)',
                  paddingLeft: '10px',
                }}
              >
                "
                {TALKS_DATA[ftContext]?.[postMatchTalk]?.managerLines[0]?.text ??
                  'Well played everyone.'}
                "
              </div>
            </div>
          </Panel>

          {/* Post-Match Press Conference (§12.6, §16.2) */}
          {(gameState.pendingPress || pressResult) && (
            <Panel dominant title="MEDIA SUITE · POST-MATCH PRESS CONFERENCE">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {gameState.pendingPress && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <Portrait
                        assetPath={gameState.pendingPress.journalist.portrait}
                        initials={gameState.pendingPress.journalist.initials}
                        size={52}
                      />
                      <div>
                        <div
                          style={{
                            fontSize: '18px',
                            fontWeight: 700,
                            fontFamily: 'var(--font-head)',
                          }}
                        >
                          {gameState.pendingPress.journalist.name}
                        </div>
                        <div
                          className="broadcast-label"
                          style={{ color: 'var(--accent-text)', fontSize: '12px' }}
                        >
                          {gameState.pendingPress.journalist.outlet}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '16px 20px',
                        backgroundColor: 'var(--surface-2)',
                        borderLeft: '4px solid var(--accent)',
                        borderRadius: 'var(--radius-s)',
                        fontSize: '15px',
                        fontWeight: 600,
                        lineHeight: 1.4,
                      }}
                    >
                      "{gameState.pendingPress.question.text}"
                    </div>

                    {!pressResult ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div
                          className="broadcast-label"
                          style={{ fontSize: '11px', color: 'var(--text-dim)' }}
                        >
                          SELECT MANAGER RESPONSE:
                        </div>
                        {gameState.pendingPress.question.answers.map((ans) => (
                          <button
                            key={ans.id}
                            onClick={() => {
                              const res = answerPressQuestion(ans.id);
                              if (res) {
                                setPressResult(res);
                                showToast(
                                  `Press (${ans.tone}): Statement delivered to media`,
                                  'success',
                                );
                              }
                            }}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              padding: '14px 18px',
                              backgroundColor: 'var(--surface-2)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-m)',
                              textAlign: 'left',
                              cursor: 'pointer',
                              transition: 'background-color 0.15s, border-color 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--surface-3)';
                              e.currentTarget.style.borderColor = 'var(--accent)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--surface-2)';
                              e.currentTarget.style.borderColor = 'var(--border)';
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  padding: '2px 8px',
                                  backgroundColor: 'var(--accent-dim, rgba(242,183,5,0.15))',
                                  color: 'var(--accent-text)',
                                  borderRadius: 'var(--radius-xs)',
                                }}
                              >
                                {ans.tone}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                {ans.effects.fans
                                  ? `Fans ${ans.effects.fans > 0 ? '+' : ''}${ans.effects.fans} `
                                  : ''}
                                {ans.effects.board
                                  ? `Board ${ans.effects.board > 0 ? '+' : ''}${ans.effects.board} `
                                  : ''}
                                {ans.effects.squadMorale
                                  ? `Squad ${ans.effects.squadMorale > 0 ? '+' : ''}${ans.effects.squadMorale}`
                                  : ''}
                                {ans.effects.conditionalRisk
                                  ? ` · ${ans.effects.conditionalRisk}`
                                  : ''}
                              </span>
                            </div>
                            <div style={{ fontSize: '14px', color: 'var(--text)' }}>
                              "{ans.text}"
                            </div>
                          </button>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                          <button
                            onClick={() => {
                              skipPressConference();
                              showToast('Concluded press briefing with no comment', 'info');
                            }}
                            className="broadcast-label"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-dim)',
                              cursor: 'pointer',
                              fontSize: '12px',
                              padding: '4px 0',
                            }}
                          >
                            Walk out / No comment
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}

                {pressResult && (
                  <div
                    style={{
                      padding: '14px 18px',
                      backgroundColor: 'var(--surface-2)',
                      border: '1px solid var(--accent)',
                      borderRadius: 'var(--radius-m)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          backgroundColor: 'var(--accent)',
                          color: 'var(--accent-ink)',
                          borderRadius: 'var(--radius-xs)',
                        }}
                      >
                        {pressResult.tone}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--win)', fontWeight: 600 }}>
                        Statement Delivered
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontStyle: 'italic',
                        color: 'var(--text)',
                      }}
                    >
                      "{pressResult.managerSpeech}"
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                      Impact:{' '}
                      {pressResult.fansDelta !== 0 &&
                        `Fans ${pressResult.fansDelta > 0 ? '+' : ''}${pressResult.fansDelta} · `}
                      {pressResult.boardDelta !== 0 &&
                        `Board ${pressResult.boardDelta > 0 ? '+' : ''}${pressResult.boardDelta} · `}
                      {pressResult.squadMoraleDelta !== 0 &&
                        `Squad ${pressResult.squadMoraleDelta > 0 ? '+' : ''}${pressResult.squadMoraleDelta}`}
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* Continue button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="primary"
              size="l"
              onClick={handleContinueToWeekSummary}
              style={{ minWidth: '220px' }}
            >
              To Week Summary <ArrowRight size={18} />
            </Button>
          </div>
        </div>
      </div>

      <Ticker
        items={[
          'Full-Time reaction coming in from across the league',
          'Press conferences underway in media suites',
          'Updated league standings processing',
        ]}
      />
    </div>
  );
};
