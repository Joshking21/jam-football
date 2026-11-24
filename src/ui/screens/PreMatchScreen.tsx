// Implements SPEC §11.15 Pre-Match screen (on-air broadcast world)
// Stepper: 1. Opponent Report, 2. Team Selection, 3. Team Talk.
// Advances to Match on Kick Off.
import { TRAIT_DEFINITIONS } from '../../core/player/traits';
import type { TraitId } from '../../core/types';
import React, { useState } from 'react';
import { useStore } from '../../state/store';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { Crest } from '../components/Crest';
import { Portrait } from '../components/Portrait';
import { TacticsScreen } from './TacticsScreen';
import { Ticker } from '../components/Ticker';
import { TelestratorPitch } from '../components/TelestratorPitch';
import { WarmupScareModal } from '../components/WarmupScareModal';
import { getPreMatchTickerItems } from '../components/tickerHelper';
import {
  Check,
  Shield,
  AlertTriangle,
  ChevronRight,
  Zap,
  Cloud,
  CloudRain,
  Sun,
  Award,
  MessageSquare,
} from 'lucide-react';
import {
  TalkTone,
  predictTalkReaction,
  getPreMatchTalkContext,
  TALKS_DATA,
} from '@/core/player/talks';
import { rawOvr } from '@/core/player/ratings';
import { Player, TeamInstructions } from '@/core/types';
import { createDefaultSetPieceTactics } from '@/core/match/setPieces';
import { advisePreMatch } from '@/core/people/assistant';
import { createRng, deriveSeed } from '@/core/rng';

type PreMatchStep = 0 | 1 | 2 | 3;

export const PreMatchScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const advanceGame = useStore((state) => state.advanceGame);
  const updateUserTactics = useStore((state) => state.updateUserTactics);
  const performTeamTalk = useStore((state) => state.performTeamTalk);
  const answerPressQuestion = useStore((state) => state.answerPressQuestion);
  const skipPressConference = useStore((state) => state.skipPressConference);
  const resolveWarmupScare = useStore((state) => state.resolveWarmupScare);
  const applyAdviceAction = useStore((state) => state.applyAdviceAction);
  const showToast = useStore((state) => state.showToast);

  const [currentStep, setCurrentStep] = useState<PreMatchStep>(gameState?.pendingPress ? 0 : 1);
  const [selectedTone, setSelectedTone] = useState<TalkTone>('Calm');

  if (!gameState) return null;

  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  const targetMD = gameState.matchday === 0 ? 1 : gameState.matchday;
  const nextFix = gameState.fixtures.find(
    (f) => f.matchday === targetMD && (f.homeId === userClub.id || f.awayId === userClub.id),
  );

  const isHome = nextFix ? nextFix.homeId === userClub.id : true;
  const oppId = nextFix
    ? isHome
      ? nextFix.awayId
      : nextFix.homeId
    : (userClub.rivals[0] ?? 'c02');
  const oppClub = gameState.clubs[oppId] ?? Object.values(gameState.clubs)[0]!;

  const userStarters = userClub.tactics.lineup
    .filter((id): id is string => Boolean(id))
    .map((id) => gameState.players[id])
    .filter((p): p is Player => Boolean(p));
  const oppStarters = oppClub.tactics.lineup
    .filter((id): id is string => Boolean(id))
    .map((id) => gameState.players[id])
    .filter((p): p is Player => Boolean(p));

  const userAvgOvr =
    userStarters.length > 0
      ? userStarters.reduce(
          (sum, p) => sum + rawOvr(p.attributes, p.positions[0]?.pos ?? 'CM'),
          0,
        ) / userStarters.length
      : 70;
  const oppAvgOvr =
    oppStarters.length > 0
      ? oppStarters.reduce((sum, p) => sum + rawOvr(p.attributes, p.positions[0]?.pos ?? 'CM'), 0) /
        oppStarters.length
      : 70;

  const preMatchContext = getPreMatchTalkContext(userAvgOvr, oppAvgOvr);
  const activeMatchday = nextFix?.matchday ?? (gameState.matchday === 0 ? 1 : gameState.matchday);

  // Key battles duels (§13.17.7)
  const userFB =
    userStarters.find((p) => p.positions.some((pos) => pos.pos === 'LB' || pos.pos === 'RB')) ??
    userStarters[1] ??
    userStarters[0];
  const oppWinger =
    oppStarters.find((p) =>
      p.positions.some(
        (pos) => pos.pos === 'LW' || pos.pos === 'RW' || pos.pos === 'LM' || pos.pos === 'RM',
      ),
    ) ??
    oppStarters[7] ??
    oppStarters[0];

  const userCB =
    userStarters.find((p) => p.positions.some((pos) => pos.pos === 'CB')) ??
    userStarters[2] ??
    userStarters[0];
  const oppST =
    oppStarters.find((p) => p.positions.some((pos) => pos.pos === 'ST')) ??
    oppStarters[9] ??
    oppStarters[0];

  const userDM =
    userStarters.find((p) => p.positions.some((pos) => pos.pos === 'DM' || pos.pos === 'CM')) ??
    userStarters[4] ??
    userStarters[0];
  const oppAM =
    oppStarters.find((p) => p.positions.some((pos) => pos.pos === 'AM' || pos.pos === 'CM')) ??
    oppStarters[5] ??
    oppStarters[0];

  // Duel 1: FB vs Winger (pace + tackling vs pace + dribbling)
  const fbDefScore = (userFB?.attributes.pace ?? 70) + (userFB?.attributes.tackling ?? 70);
  const wingAttScore = (oppWinger?.attributes.pace ?? 70) + (oppWinger?.attributes.dribbling ?? 70);
  const diff1 = (fbDefScore - wingAttScore) / 10;
  const edge1 = diff1 >= 0.25 ? 'us' : diff1 <= -0.25 ? 'them' : 'even';
  const bigEdge1 = Math.abs(diff1) >= 1.0;

  // Duel 2: CB vs ST (heading + strength vs heading + strength)
  const cbAirScore = (userCB?.attributes.heading ?? 70) + (userCB?.attributes.strength ?? 70);
  const stAirScore = (oppST?.attributes.heading ?? 70) + (oppST?.attributes.strength ?? 70);
  const diff2 = (cbAirScore - stAirScore) / 10;
  const edge2 = diff2 >= 0.25 ? 'us' : diff2 <= -0.25 ? 'them' : 'even';
  const bigEdge2 = Math.abs(diff2) >= 1.0;

  // Duel 3: DM vs AM (positioning + tackling vs decisions + passing)
  const dmScore = (userDM?.attributes.positioning ?? 70) + (userDM?.attributes.tackling ?? 70);
  const amScore = (oppAM?.attributes.decisions ?? 70) + (oppAM?.attributes.passing ?? 70);
  const diff3 = (dmScore - amScore) / 10;
  const edge3 = diff3 >= 0.25 ? 'us' : diff3 <= -0.25 ? 'them' : 'even';
  const bigEdge3 = Math.abs(diff3) >= 1.0;

  // Assistant Theo Vance advice per §15.2 (max 3 advices, priority sorted)
  const preAdvices = advisePreMatch(
    {
      kind: 'preMatch',
      userClub,
      oppClub,
      players: gameState.players,
    },
    createRng(deriveSeed(gameState.seed, 'pre-advice', activeMatchday)),
  );

  const handleApplySuggestedApproach = () => {
    let count = 0;
    for (const adv of preAdvices) {
      if (adv.apply) {
        applyAdviceAction(adv.apply);
        count++;
      }
    }
    if (count > 0) {
      showToast(`Applied ${count} assistant tactical adjustment${count > 1 ? 's' : ''}`, 'success');
    } else {
      showToast('No tactical changes required for this match', 'info');
    }
  };

  const handleKickOff = async () => {
    if (selectedTone) {
      performTeamTalk(preMatchContext, selectedTone);
    }
    await advanceGame();
  };

  const oppSetPieceThreat = (() => {
    if (!oppStarters || oppStarters.length === 0) return null;
    const sorted = [...oppStarters].sort((a, b) => {
      const airA = (a.attributes.heading ?? 50) + (a.attributes.strength ?? 50);
      const airB = (b.attributes.heading ?? 50) + (b.attributes.strength ?? 50);
      return airB - airA;
    });
    const bestThreat = sorted[0];
    if (!bestThreat) return null;
    const userBestHeader = [...userStarters].sort((a, b) => {
      const airA = (a.attributes.heading ?? 50) + (a.attributes.strength ?? 50);
      const airB = (b.attributes.heading ?? 50) + (b.attributes.strength ?? 50);
      return airB - airA;
    })[0];
    return {
      threat: bestThreat,
      targetZone: bestThreat.positions.some((pos) => pos.pos === 'ST') ? 'Far post' : 'Near post',
      marker: userBestHeader,
      posts: 'Both' as const,
    };
  })();

  const tones: {
    tone: TalkTone;
    name: string;
    desc: string;
    reaction: string;
    quote: string;
  }[] = [
    {
      tone: 'Calm',
      name: 'Calm',
      desc: 'Keep composure and trust the tactical pattern.',
      reaction: predictTalkReaction(preMatchContext, 'Calm'),
      quote: TALKS_DATA[preMatchContext].Calm.managerLines[0]!.text,
    },
    {
      tone: 'Motivate',
      name: 'Motivate',
      desc: 'Rally the squad to win individual duels and take the initiative.',
      reaction: predictTalkReaction(preMatchContext, 'Motivate'),
      quote: TALKS_DATA[preMatchContext].Motivate.managerLines[0]!.text,
    },
    {
      tone: 'Demand',
      name: 'Demand More',
      desc: 'Uncompromising standards. Demand total ruthlessness.',
      reaction: predictTalkReaction(preMatchContext, 'Demand'),
      quote: TALKS_DATA[preMatchContext].Demand.managerLines[0]!.text,
    },
    {
      tone: 'Praise',
      name: 'Praise',
      desc: 'Reinforce confidence and express total faith in their quality.',
      reaction: predictTalkReaction(preMatchContext, 'Praise'),
      quote: TALKS_DATA[preMatchContext].Praise.managerLines[0]!.text,
    },
    {
      tone: 'Disappoint',
      name: 'Disappointment',
      desc: 'Challenge complacency and warn against letting standards slip.',
      reaction: predictTalkReaction(preMatchContext, 'Disappoint'),
      quote: TALKS_DATA[preMatchContext].Disappoint.managerLines[0]!.text,
    },
    {
      tone: 'Focus',
      name: 'Focus',
      desc: 'Laser concentration on transitions, set pieces and game plan.',
      reaction: predictTalkReaction(preMatchContext, 'Focus'),
      quote: TALKS_DATA[preMatchContext].Focus.managerLines[0]!.text,
    },
  ];

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header & Stepper */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border)',
              paddingBottom: '16px',
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: '32px',
                  fontFamily: 'var(--font-head)',
                  margin: 0,
                }}
              >
                PRE-MATCH PREPARATION · MATCHDAY {activeMatchday}
              </h1>
              <div
                className="broadcast-label"
                style={{ color: 'var(--text-dim)', marginTop: '2px' }}
              >
                {userClub.name.toUpperCase()} vs {oppClub.name.toUpperCase()}
              </div>
            </div>

            {/* Step Indicators */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {(
                (gameState.pendingPress || currentStep === 0
                  ? [
                      { s: 0, label: '0. MEDIA BRIEFING' },
                      { s: 1, label: '1. OPPONENT REPORT' },
                      { s: 2, label: '2. TEAM SELECTION' },
                      { s: 3, label: '3. TEAM TALK' },
                    ]
                  : [
                      { s: 1, label: '1. OPPONENT REPORT' },
                      { s: 2, label: '2. TEAM SELECTION' },
                      { s: 3, label: '3. TEAM TALK' },
                    ]) as { s: PreMatchStep; label: string }[]
              ).map(({ s, label }) => (
                <button
                  key={s}
                  onClick={() => setCurrentStep(s)}
                  className="broadcast-label"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-s)',
                    backgroundColor: currentStep === s ? 'var(--accent)' : 'var(--surface-2)',
                    color: currentStep === s ? 'var(--accent-ink)' : 'var(--text-dim)',
                    border: `1px solid ${currentStep === s ? 'var(--accent)' : 'var(--border)'}`,
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 0: Pre-Match Derby Press Conference (§12.6, §16.2) */}
          {currentStep === 0 && gameState.pendingPress && (
            <Panel dominant title="MEDIA SUITE · PRE-MATCH DERBY PRESS CONFERENCE">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <Portrait
                    assetPath={gameState.pendingPress.journalist.portrait}
                    initials={gameState.pendingPress.journalist.initials}
                    size={56}
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
                    fontSize: '16px',
                    fontWeight: 600,
                    lineHeight: 1.4,
                  }}
                >
                  "{gameState.pendingPress.question.text}"
                </div>

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
                          showToast(`Press (${ans.tone}): Response delivered to media`, 'success');
                        }
                        setCurrentStep(1);
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
                          {ans.effects.conditionalRisk ? ` · ${ans.effects.conditionalRisk}` : ''}
                        </span>
                      </div>
                      <div style={{ fontSize: '14px', color: 'var(--text)' }}>"{ans.text}"</div>
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '6px' }}>
                  <button
                    onClick={() => {
                      skipPressConference();
                      showToast('Skipped pre-match briefing to enter dressing room', 'info');
                      setCurrentStep(1);
                    }}
                    className="broadcast-label"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Skip briefing / Enter dressing room
                  </button>
                </div>
              </div>
            </Panel>
          )}

          {/* Step 1: Opponent Report (Dominant Broadcast Panel, Telestrator Pitch, Key Battles) */}
          {currentStep === 1 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr',
                gap: '24px',
                alignItems: 'start',
              }}
            >
              {/* Left Column: Dominant Telestrator Pitch Diagram & Identified Pattern */}
              <Panel dominant title={`BROADCAST SCOUTING REPORT · ${oppClub.name.toUpperCase()}`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid var(--border)',
                      paddingBottom: '14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <Crest
                        clubId={oppClub.id}
                        code={oppClub.code}
                        primaryColor={oppClub.colors.primary}
                        secondaryColor={oppClub.colors.secondary}
                        size={56}
                      />
                      <div>
                        <h2
                          style={{
                            fontSize: '28px',
                            fontFamily: 'var(--font-head)',
                            margin: 0,
                            letterSpacing: '0.02em',
                          }}
                        >
                          {oppClub.name}
                        </h2>
                        <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>
                          Manager: {oppClub.managerName} · Shape: {oppClub.style.formation} ·{' '}
                          {oppClub.style.passing} Passing
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '6px 12px',
                        backgroundColor: 'var(--surface-3)',
                        borderRadius: 'var(--radius-s)',
                        fontFamily: 'var(--font-head)',
                        fontWeight: 700,
                        fontSize: '13px',
                        color: 'var(--accent-text)',
                      }}
                    >
                      {isHome ? 'OPPONENT AT OUR GROUND' : 'AWAY FIXTURE'}
                    </div>
                  </div>

                  {/* Telestrator Pitch Graphic with Red-Marker Os, Numbers and Surnames */}
                  <TelestratorPitch oppClub={oppClub} oppPlayers={oppStarters} />

                  <div
                    style={{
                      backgroundColor: 'var(--surface-2)',
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-s)',
                      border: '1px solid var(--border)',
                      fontSize: '13px',
                      lineHeight: '1.5',
                      color: 'var(--text-dim)',
                    }}
                  >
                    <strong style={{ color: 'var(--text)' }}>Tactical Pattern:</strong>{' '}
                    {oppClub.name} operate in a {oppClub.style.formation} shape. Under manager{' '}
                    {oppClub.managerName}, they focus on {oppClub.style.width.toLowerCase()} width
                    with {oppClub.style.passing.toLowerCase()} distribution. Key striker{' '}
                    {oppST
                      ? `${oppST.lastName} (finishing ${oppST.attributes.finishing})`
                      : 'their 9'}{' '}
                    is their primary focal point in the box.
                  </div>

                  {/* Their habits (§13.23): the opponent report names traits worth planning for */}
                  {(() => {
                    const COUNTER: Partial<Record<TraitId, string>> = {
                      cutsInside: 'show him outside',
                      shootsFromDistance: 'close him down outside the box',
                      killerBalls: 'press him, cut the passing lanes',
                      runsWithBall: 'double up on him in midfield',
                      attacksAir: 'put our best header on him at set pieces',
                      divesIn: "run at him, he'll give away fouls",
                      getsForward: 'leave a runner on his side for the counter',
                      holdsUp: "stay tight, don't let him turn",
                      playsOneTwos: 'track the runner after he passes',
                      arrivesLate: 'track his late runs into the box',
                      comesDeep: "don't follow him into midfield",
                    };
                    const lines = oppStarters
                      .flatMap((p) =>
                        (p.traits ?? []).filter((t) => COUNTER[t]).map((t) => ({ p, t })),
                      )
                      .slice(0, 3);
                    if (lines.length === 0) return null;
                    return (
                      <div
                        style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--text-dim)' }}
                      >
                        <strong style={{ color: 'var(--text)' }}>Their habits:</strong>{' '}
                        {lines.map(({ p, t }, i) => (
                          <span key={`${p.id}-${t}`}>
                            {i > 0 ? ' ' : ''}
                            {p.lastName} {TRAIT_DEFINITIONS[t].wording.toLowerCase()}: {COUNTER[t]}.
                          </span>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Preparation Rundown filling vertical height */}
                  <div
                    style={{
                      backgroundColor: 'var(--surface-2)',
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-s)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div
                      className="broadcast-label"
                      style={{ fontSize: '11px', color: 'var(--accent-text)' }}
                    >
                      SQUAD READINESS & MATCH PREPARATION
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
                          STARTING XI AVG OVR
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
                          {Math.round(userAvgOvr)}{' '}
                          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                            vs {Math.round(oppAvgOvr)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
                          MATCH CONDITION
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#38A169' }}>
                          {Math.round(
                            userStarters.reduce((acc, p) => acc + p.condition, 0) /
                              Math.max(1, userStarters.length),
                          )}
                          %
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
                          SQUAD MORALE
                        </div>
                        <div
                          style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-text)' }}
                        >
                          {Math.round(
                            userStarters.reduce((acc, p) => acc + p.morale, 0) /
                              Math.max(1, userStarters.length),
                          )}
                          /100
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>

              {/* Right Column: Key Battles (3 duels), Assistant Advice & Match Factors */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <Panel title="KEY BATTLES & TACTICAL ADVICE">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Key Battles Card: 3 Named Duels per §13.17.7 */}
                    <div
                      style={{
                        backgroundColor: 'var(--surface-2)',
                        padding: '14px',
                        borderRadius: 'var(--radius-s)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div
                        className="broadcast-label"
                        style={{
                          color: 'var(--accent-text)',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Award size={14} /> DECISIVE MATCHUPS
                      </div>

                      {/* Duel 1: FB vs Winger */}
                      <div
                        style={{
                          padding: '8px 10px',
                          backgroundColor: 'var(--surface-3)',
                          borderRadius: 'var(--radius-xs)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '12px',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>Flank Duel:</span>
                          <span
                            style={{
                              fontWeight: 700,
                              color:
                                edge1 === 'us'
                                  ? '#38A169'
                                  : edge1 === 'them'
                                    ? '#E53E3E'
                                    : 'var(--text-dim)',
                            }}
                          >
                            {edge1 === 'us'
                              ? `→ ${userClub.shortName}${bigEdge1 ? ' (big edge)' : ''}`
                              : edge1 === 'them'
                                ? `→ ${oppClub.shortName}${bigEdge1 ? ' (big edge)' : ''}`
                                : 'Level'}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                          {userFB?.lastName} (pace {userFB?.attributes.pace}) vs{' '}
                          {oppWinger?.lastName} (pace {oppWinger?.attributes.pace}, dribble{' '}
                          {oppWinger?.attributes.dribbling})
                        </div>
                      </div>

                      {/* Duel 2: CB vs ST */}
                      <div
                        style={{
                          padding: '8px 10px',
                          backgroundColor: 'var(--surface-3)',
                          borderRadius: 'var(--radius-xs)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '12px',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>Aerial Duel:</span>
                          <span
                            style={{
                              fontWeight: 700,
                              color:
                                edge2 === 'us'
                                  ? '#38A169'
                                  : edge2 === 'them'
                                    ? '#E53E3E'
                                    : 'var(--text-dim)',
                            }}
                          >
                            {edge2 === 'us'
                              ? `→ ${userClub.shortName}${bigEdge2 ? ' (big edge)' : ''}`
                              : edge2 === 'them'
                                ? `→ ${oppClub.shortName}${bigEdge2 ? ' (big edge)' : ''}`
                                : 'Level'}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                          {userCB?.lastName} (heading {userCB?.attributes.heading}, strength{' '}
                          {userCB?.attributes.strength}) vs {oppST?.lastName} (heading{' '}
                          {oppST?.attributes.heading}, strength {oppST?.attributes.strength})
                        </div>
                      </div>

                      {/* Duel 3: DM vs AM */}
                      <div
                        style={{
                          padding: '8px 10px',
                          backgroundColor: 'var(--surface-3)',
                          borderRadius: 'var(--radius-xs)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '12px',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>Midfield Engine:</span>
                          <span
                            style={{
                              fontWeight: 700,
                              color:
                                edge3 === 'us'
                                  ? '#38A169'
                                  : edge3 === 'them'
                                    ? '#E53E3E'
                                    : 'var(--text-dim)',
                            }}
                          >
                            {edge3 === 'us'
                              ? `→ ${userClub.shortName}${bigEdge3 ? ' (big edge)' : ''}`
                              : edge3 === 'them'
                                ? `→ ${oppClub.shortName}${bigEdge3 ? ' (big edge)' : ''}`
                                : 'Level'}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                          {userDM?.lastName} (positioning {userDM?.attributes.positioning}) vs{' '}
                          {oppAM?.lastName} (passing {oppAM?.attributes.passing}, decisions{' '}
                          {oppAM?.attributes.decisions})
                        </div>
                      </div>
                    </div>

                    {/* Data-Driven Assistant Advice Card (SPEC §15.2) */}
                    <div
                      style={{
                        backgroundColor: 'rgba(255, 91, 53, 0.08)',
                        border: '1px solid rgba(255, 91, 53, 0.25)',
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-s)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div
                        className="broadcast-label"
                        style={{ color: 'var(--accent-text)', fontSize: '11px' }}
                      >
                        THEO VANCE · ASSISTANT MANAGER ADVICE ({preAdvices.length})
                      </div>
                      {preAdvices.length === 0 ? (
                        <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                          No specific tactical adjustments flagged. Stick to your game plan.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {preAdvices.map((adv) => (
                            <div
                              key={adv.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: '10px',
                                paddingBottom: '6px',
                                borderBottom: '1px solid var(--border)',
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: 'var(--text)',
                                  }}
                                >
                                  "{adv.text}"
                                </div>
                                <div
                                  style={{
                                    fontSize: '11px',
                                    color: 'var(--text-dim)',
                                    lineHeight: '1.35',
                                  }}
                                >
                                  {adv.reason}
                                </div>
                              </div>
                              {adv.apply && (
                                <Button
                                  variant="secondary"
                                  size="s"
                                  onClick={() => {
                                    applyAdviceAction(adv.apply!);
                                    showToast('Applied assistant recommendation', 'success');
                                  }}
                                >
                                  Apply
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Opponent Set-Piece Threat Card (SPEC §13.20.9, §15.2) */}
                    {oppSetPieceThreat && (
                      <div
                        style={{
                          backgroundColor: 'var(--surface-2)',
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-s)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <div
                          className="broadcast-label"
                          style={{
                            color: 'var(--accent-text)',
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Award size={14} /> SET-PIECE THREAT (§13.20.9)
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text)' }}>
                          <strong>{oppSetPieceThreat.threat.lastName}</strong> is their primary
                          target at corners (heading {oppSetPieceThreat.threat.attributes.heading},
                          strength {oppSetPieceThreat.threat.attributes.strength}), aiming for the{' '}
                          <strong>{oppSetPieceThreat.targetZone}</strong>.
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>
                          Recommendation: Assign{' '}
                          <strong>{oppSetPieceThreat.marker?.lastName}</strong> to mark him and put
                          men on <strong>Both</strong> posts.
                        </div>
                        <button
                          onClick={() => {
                            const curSp =
                              userClub.tactics.setPieces ?? createDefaultSetPieceTactics();
                            updateUserTactics({
                              setPieces: {
                                ...curSp,
                                defending: {
                                  ...curSp.defending,
                                  markMainMan: oppSetPieceThreat.marker?.id ?? null,
                                  postMen: 'Both',
                                },
                              },
                              instructions: {
                                ...userClub.tactics.instructions,
                                postMen: 'Both',
                              },
                            });
                            showToast(
                              `Set-Piece Defense: ${oppSetPieceThreat.marker?.lastName} assigned to ${oppSetPieceThreat.threat.lastName}`,
                              'success',
                            );
                          }}
                          style={{
                            alignSelf: 'flex-start',
                            marginTop: '4px',
                            padding: '4px 10px',
                            backgroundColor: 'var(--accent)',
                            color: '#FFFFFF',
                            borderRadius: 'var(--radius-xs)',
                            border: 'none',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Apply Set-Piece Defense
                        </button>
                      </div>
                    )}

                    {/* Match Factors */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '10px',
                        backgroundColor: 'var(--surface-2)',
                        padding: '10px',
                        borderRadius: 'var(--radius-s)',
                        border: '1px solid var(--border)',
                        textAlign: 'center',
                      }}
                    >
                      <div>
                        <div
                          className="broadcast-label"
                          style={{ fontSize: '10px', color: 'var(--text-faint)' }}
                        >
                          VENUE
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            marginTop: '2px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {isHome ? userClub.stadium.name : oppClub.stadium.name}
                        </div>
                      </div>
                      <div>
                        <div
                          className="broadcast-label"
                          style={{ fontSize: '10px', color: 'var(--text-faint)' }}
                        >
                          WEATHER
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>
                          {nextFix?.weather ?? 'Clear'}
                        </div>
                      </div>
                      <div>
                        <div
                          className="broadcast-label"
                          style={{ fontSize: '10px', color: 'var(--text-faint)' }}
                        >
                          KICKOFF
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>
                          {nextFix?.kickoff ?? 'Night'}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        marginTop: '4px',
                      }}
                    >
                      <Button
                        variant="secondary"
                        size="m"
                        icon={<Zap size={16} />}
                        onClick={handleApplySuggestedApproach}
                      >
                        Apply All Assistant Advice
                      </Button>
                      <Button variant="primary" size="l" onClick={() => setCurrentStep(2)}>
                        Proceed to Team Selection (Step 2) <ChevronRight size={18} />
                      </Button>
                    </div>
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {/* Step 2: Team Selection */}
          {currentStep === 2 && (
            <div>
              <TacticsScreen />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: '16px',
                }}
              >
                <Button variant="primary" size="l" onClick={() => setCurrentStep(3)}>
                  Proceed to Team Talk <ChevronRight size={18} />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Team Talk */}
          {currentStep === 3 && (
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              <Panel dominant title="DRESSING ROOM PRE-MATCH ADDRESS">
                <div style={{ fontSize: '15px', marginBottom: '20px' }}>
                  Select the tone to deliver to the squad before emerging from the tunnel:
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                  }}
                >
                  {tones.map((t) => {
                    const isSelected = selectedTone === t.tone;
                    const reactionColor =
                      t.reaction === 'Most will respond well'
                        ? 'var(--win)'
                        : t.reaction === 'Mixed'
                          ? 'var(--text-dim)'
                          : 'var(--loss)';
                    return (
                      <div
                        key={t.tone}
                        onClick={() => setSelectedTone(t.tone)}
                        style={{
                          padding: '16px',
                          borderRadius: 'var(--radius-s)',
                          backgroundColor: isSelected ? 'var(--surface-3)' : 'var(--surface-2)',
                          border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            fontFamily: 'var(--font-head)',
                            fontSize: '18px',
                            color: isSelected ? 'var(--accent-text)' : 'var(--text)',
                          }}
                        >
                          {t.name}
                        </div>
                        <div
                          style={{
                            fontSize: '13px',
                            color: 'var(--text-dim)',
                            marginTop: '4px',
                          }}
                        >
                          {t.desc}
                        </div>
                        <div
                          className="broadcast-label"
                          style={{
                            fontSize: '11px',
                            color: reactionColor,
                            marginTop: '8px',
                          }}
                        >
                          {t.reaction}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Manager Speech Preview Bubble */}
                {selectedTone && (
                  <div
                    style={{
                      marginTop: '18px',
                      padding: '14px 18px',
                      borderRadius: 'var(--radius-s)',
                      backgroundColor: 'var(--surface-2)',
                      borderLeft: '4px solid var(--accent)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                    }}
                  >
                    <MessageSquare
                      size={18}
                      color="var(--accent)"
                      style={{ flexShrink: 0, marginTop: '2px' }}
                    />
                    <div>
                      <div
                        className="broadcast-label"
                        style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '2px' }}
                      >
                        WHAT YOU WILL SAY:
                      </div>
                      <div style={{ fontSize: '14px', fontStyle: 'italic', color: 'var(--text)' }}>
                        "{tones.find((t) => t.tone === selectedTone)?.quote}"
                      </div>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    marginTop: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border)',
                    paddingTop: '20px',
                  }}
                >
                  <Button variant="secondary" size="l" onClick={() => setCurrentStep(2)}>
                    Back to XI
                  </Button>
                  <Button
                    variant="primary"
                    size="l"
                    onClick={handleKickOff}
                    style={{ minWidth: '200px' }}
                  >
                    Kick Off
                  </Button>
                </div>
              </Panel>
            </div>
          )}
        </div>
      </div>

      <Ticker items={getPreMatchTickerItems(gameState, nextFix)} />

      {/* Pre-Match Warm-up Scare Modal (§12.19.3) */}
      {gameState.pendingWarmupScare &&
        !gameState.pendingWarmupScare.resolved &&
        gameState.players[gameState.pendingWarmupScare.playerId] && (
          <WarmupScareModal
            player={gameState.players[gameState.pendingWarmupScare.playerId]!}
            onChoice={resolveWarmupScare}
          />
        )}
    </div>
  );
};
