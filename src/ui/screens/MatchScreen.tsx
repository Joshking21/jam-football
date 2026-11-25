// Implements SPEC §11.16–11.18 & §14 Complete 3D Match Day Screen
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useStore } from '../../state/store';
import {
  MatchEvent,
  MatchResult,
  MatchCommand,
  MatchInput,
  Side,
  PlayerId,
  Player,
} from '../../core/types';
import { buildTeamSheet } from '../../core/game/advance';
import { deriveSeed } from '../../core/rng';
import { MatchScene } from '../../render3d/MatchScene';
import { CameraMode, QualityPreset, TimeSlot } from '../../render3d/types';
import { MatchPlayback, PlaybackMode, PlaybackState } from './Match/playback';
import { ScoreboardBug } from './Match/ScoreboardBug';
import { MatchControls } from './Match/MatchControls';
import { CommentaryStrip } from './Match/CommentaryStrip';
import { resolveCommentary } from '../../core/match/commentary';
import { LiveStatsDrawer } from './Match/LiveStatsDrawer';
import { AssistantDrawer, AssistantAdviceItem, OutOfTownScore } from './Match/AssistantDrawer';
import { QuickSubsModal } from './Match/QuickSubsModal';
import { GoalBanner, ReplayOverlay } from './Match/GoalBanner';
import { RadarOverlay } from './Match/RadarOverlay';
import { HalfTimeModal } from './Match/HalfTimeModal';
import { FullTimeModal } from './Match/FullTimeModal';
import { ShoutWheel, ShoutChip, PlanAskCard, ActiveShout, SHOUTS } from './Match/ShoutWheel';
import { KnockChoiceCard } from './Match/KnockChoiceCard';
import type { ShoutId } from '../../core/types';
import { TalkTone, getHalfTimeTalkContext } from '../../core/player/talks';
import { createMatch, simulateInstant } from '../../core/match/engine';
import { createDefaultSetPieceTactics } from '../../core/match/setPieces';
import { adviseInMatch, AdviceAction } from '../../core/people/assistant';
import { createRng } from '../../core/rng';
import { audioEngine, matchAudio, voiceQueue } from '../../audio';
import type { ClientToWorkerMessage, WorkerToClientMessage } from '../../workers/match.worker';

export const MatchScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const advanceGame = useStore((state) => state.advanceGame);
  const performTeamTalk = useStore((state) => state.performTeamTalk);
  const updateUserTactics = useStore((state) => state.updateUserTactics);
  const showToast = useStore((state) => state.showToast);
  const settings = useStore((state) => state.settings);

  // Scene & Playback Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MatchScene | null>(null);
  const playbackRef = useRef<MatchPlayback | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const isAltHeldRef = useRef<boolean>(false);

  // UI Reactive States
  const [hudVisible, setHudVisible] = useState(true);
  const [cameraMode, setCameraMode] = useState<CameraMode>('broadcast');
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    pt: 0,
    half: 1,
    paused: false,
    mode: 'key',
    fullSpeed: 4,
    speedMultiplier: 1.0,
    isTimeLapse: false,
    timeLapseProgress: 0,
    isInsideHighlight: true,
    isReplay: false,
    currentEvent: null,
    score: { home: 0, away: 0 },
    lastGoalEvent: null,
  });

  // Touchline shouts (§13.21) and match-plan prompts (§13.22)
  const [shoutOpen, setShoutOpen] = useState(false);
  const [activeShout, setActiveShout] = useState<ActiveShout | null>(null);
  const [shoutLastEnd, setShoutLastEnd] = useState<Partial<Record<ShoutId, number>>>({});
  const [concentrateHalf, setConcentrateHalf] = useState<number | null>(null);
  const [planAsk, setPlanAsk] = useState<{
    text: string;
    then: string;
    prevPlan: 0 | 1 | 2;
    deadline: number;
  } | null>(null);
  const [planAskLeft, setPlanAskLeft] = useState(0);
  const planAskRef = useRef<typeof planAsk>(null);

  // In-Match Knock state (§12.19.1)
  const handledKnockTRef = useRef<number | null>(null);
  const [handledKnockT, setHandledKnockT] = useState<number | null>(null);

  // Overlays & Drawers
  const [statsOpen, setStatsOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [subsOpen, setSubsOpen] = useState(false);
  const [isHalfTime, setIsHalfTime] = useState(false);
  const [isFullTime, setIsFullTime] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);

  // Goal banner
  const [currentGoalBanner, setCurrentGoalBanner] = useState<{
    scorerName: string;
    minuteLabel: string;
    side: Side;
  } | null>(null);

  // Out of town scores & Assistant advices
  const [outOfTownScores, setOutOfTownScores] = useState<OutOfTownScore[]>([]);
  const [adviceList, setAdviceList] = useState<AssistantAdviceItem[]>([]);

  // Set-piece & tactical assistant tracking refs (§13.20.9, §15.4)
  const oppCornerHeadersRef = useRef<number[]>([]);
  const hasAdvisedDropForwardRef = useRef<boolean>(false);
  const ourCornerCountRef = useRef<number>(0);
  const hasAdvisedRotateRef = useRef<boolean>(false);
  const lastAdviceEvalMinRef = useRef<number>(0);
  const firedAdviceHistoryRef = useRef<Record<string, number>>({});
  const totalAdviceFiredRef = useRef<number>(0);

  // Substitution tracking
  const [subsUsed, setSubsUsed] = useState(0);
  const [windowsUsed, setWindowsUsed] = useState(0);

  if (!gameState || !gameState.pendingMatch) return null;

  const pending = gameState.pendingMatch;
  const fixture = gameState.fixtures.find((f) => f.id === pending.fixtureId);
  if (!fixture) return null;

  const homeClub = gameState.clubs[fixture.homeId];
  const awayClub = gameState.clubs[fixture.awayId];
  const userClub = gameState.clubs[gameState.userClubId];
  if (!homeClub || !awayClub || !userClub) return null;

  const userSide: Side = fixture.homeId === gameState.userClubId ? 'home' : 'away';

  const captureState =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('state') : null;

  // 1. Initialize Worker & Scene & Playback
  useEffect(() => {
    if (!containerRef.current) return;

    // A. Create Playback controller
    const playback = new MatchPlayback({
      onGoal: (ev) => {
        const scorer = ev.playerId ? gameState.players[ev.playerId] : null;
        const scorerName = scorer
          ? (scorer.knownAs ?? `${scorer.firstName} ${scorer.lastName}`)
          : 'Unknown Scorer';
        setCurrentGoalBanner({
          scorerName,
          minuteLabel: ev.minuteLabel,
          side: ev.side,
        });
      },
      onHalfTime: () => {
        setIsHalfTime(true);
      },
      onFullTime: () => {
        setIsFullTime(true);
      },
      onEventStarted: (ev) => {
        // Trigger spatial match audio and crowd reactions (§17.3)
        const cameraX = sceneRef.current?.cameras?.camera?.position?.x ?? 52.5;
        matchAudio.onEvent(ev, userSide, cameraX);

        // Trigger commentary voice queue and caption synchronization (§17.4)
        voiceQueue.updateSimTime(ev.t);
        voiceQueue.speakCommentary(ev, gameState.players, {
          weather: fixture.weather,
          isDerby: false,
          homeScore: playbackRef.current?.score.home ?? 0,
          awayScore: playbackRef.current?.score.away ?? 0,
        });

        if (ev.type === 'MATCH_PLAN_TRIGGERED' && ev.side === userSide && ev.data) {
          const whenText: Record<string, string> = {
            Losing: 'Losing',
            Drawing: 'Level',
            Winning1: 'Winning by one',
            Winning2Plus: 'Two or more up',
            DownTo10: 'Down to ten',
            OppDownTo10: "They're down to ten",
          };
          const then = String(ev.data.then);
          const planIdx = then === 'PlanA' ? 0 : then === 'PlanB' ? 1 : then === 'PlanC' ? 2 : -1;
          const planName =
            planIdx >= 0
              ? (userClub.tactics.plans?.[planIdx as 0 | 1 | 2]?.name ?? `Plan ${'ABC'[planIdx]}`)
              : null;
          const shoutWords = SHOUTS.find((x) => x.id === then)?.words;
          const action = planName ? `Switch to ${planName}?` : `Shout "${shoutWords}"?`;
          const text = `${whenText[String(ev.data.when)] ?? 'As planned'} after ${ev.data.after}'. ${action}`;
          if (ev.data.askMeFirst) {
            playbackRef.current?.pause();
            const ask = {
              text,
              then,
              prevPlan: (userClub.tactics.activePlan ?? 0) as 0 | 1 | 2,
              deadline: performance.now() + 6000,
            };
            planAskRef.current = ask;
            setPlanAsk(ask);
          } else {
            showToast(
              planName ? `${planName} on, as planned` : `"${shoutWords}", as planned`,
              'info',
            );
          }
        }
        if (ev.type === 'SHOUT' && ev.side === userSide && ev.data?.shout) {
          const id = String(ev.data.shout) as ShoutId;
          setActiveShout((prev) =>
            prev && prev.id === id && Math.abs(prev.startPt - ev.t) < 15
              ? prev
              : { id, startPt: ev.t, endPt: ev.t + 600 },
          );
        }
        // Evaluate assistant in-match rules (§15.4)
        if (ev.type === 'YELLOW' && ev.side === userSide) {
          const p = ev.playerId ? gameState.players[ev.playerId] : null;
          if (p) {
            const pName = p.knownAs ?? `${p.firstName} ${p.lastName}`;
            setAdviceList((prev) => [
              {
                id: `card-${ev.seq}`,
                text: `${pName} is on a booking. Keep him on his feet.`,
                reason: 'Prevent reckless tackles and avoid a second yellow.',
              },
              ...prev.slice(0, 4),
            ]);
          }
        }

        // Assistant in-match set-piece advice (§13.20.9)
        if (ev.type === 'CORNER') {
          const evMinute = Math.floor(ev.t / 60);
          if (ev.side !== userSide) {
            oppCornerHeadersRef.current.push(evMinute);
            const recent = oppCornerHeadersRef.current.filter((m) => m >= evMinute - 20);
            if (recent.length >= 3 && !hasAdvisedDropForwardRef.current) {
              hasAdvisedDropForwardRef.current = true;
              setAdviceList((prev) => [
                {
                  id: `sp-drop-forward-${ev.seq}`,
                  text: "Drop a forward back, they're winning everything at corners",
                  reason: 'Opponent has won 3+ corner aerial duels in our box.',
                  onApply: () => {
                    const sp = userClub.tactics.setPieces ?? createDefaultSetPieceTactics();
                    updateUserTactics({
                      setPieces: {
                        ...sp,
                        defending: { ...sp.defending, forwardsUp: 0 },
                      },
                    });
                  },
                },
                ...prev.slice(0, 4),
              ]);
            }
          } else {
            ourCornerCountRef.current++;
            if (ourCornerCountRef.current >= 3 && !hasAdvisedRotateRef.current) {
              hasAdvisedRotateRef.current = true;
              setAdviceList((prev) => [
                {
                  id: `sp-rotate-${ev.seq}`,
                  text: "They've read our routine. Rotate?",
                  reason: 'Predictability penalty builds up after 3+ uses of the same routine.',
                  onApply: () => {
                    const sp = userClub.tactics.setPieces ?? createDefaultSetPieceTactics();
                    updateUserTactics({
                      setPieces: {
                        ...sp,
                        leftCorners: { ...sp.leftCorners, rotate: true },
                        rightCorners: { ...sp.rightCorners, rotate: true },
                      },
                    });
                  },
                },
                ...prev.slice(0, 4),
              ]);
            }
          }
        }
      },
    });
    playbackRef.current = playback;
    audioEngine.startMatchAudio();

    // B. Build Match3DContext
    const homeSheet = buildTeamSheet(homeClub, gameState.players, 'home');
    const awaySheet = buildTeamSheet(awayClub, gameState.players, 'away');

    const homePlayers = homeClub.tactics.lineup
      .map((id) => (id ? gameState.players[id] : null))
      .filter((p): p is Player => Boolean(p));
    const awayPlayers = awayClub.tactics.lineup
      .map((id) => (id ? gameState.players[id] : null))
      .filter((p): p is Player => Boolean(p));

    const captureState =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('state')
        : null;

    const quality: QualityPreset = settings.quality === 'Auto' ? 'Medium' : settings.quality;
    const timeSlot: TimeSlot =
      captureState === 'afternoon'
        ? 'afternoon'
        : ((fixture.kickoff?.toLowerCase() ?? 'evening') as TimeSlot);
    const weather = captureState === 'rain' ? 'rain' : fixture.weather === 'Rain' ? 'rain' : 'dry';

    // C. Initialize 3D Scene
    const scene = new MatchScene({
      container: containerRef.current,
      homeClub,
      awayClub,
      homePlayers,
      awayPlayers,
      weather,
      timeSlot,
      quality,
    });
    sceneRef.current = scene;

    const input: MatchInput = {
      fixtureId: fixture.id,
      home: homeSheet,
      away: awaySheet,
      isDerby: homeClub.rivals.includes(awayClub.id),
      weather: fixture.weather,
      userSide,
      aiControls: userSide === 'home' ? ['away'] : ['home'],
    };

    const matchSeed = deriveSeed(gameState.seed, 'match-sim', fixture.id);

    // Apply capture states if specified in URL query (?state=...)
    // REVIEW-M4 S3: Execute real seeded engine simulation up-front so headless captures get
    // authentic match events, real goals, real replay windows, real HT/FT stats, and real positions.
    if (captureState) {
      const sim = createMatch(input, matchSeed);
      const allEvents = sim.runToEnd();
      const realResult = sim.result();
      setMatchResult(realResult);
      playback.addEvents(allEvents);

      const firstGoal = allEvents.find((e) => e.type === 'GOAL') ?? allEvents[0];

      if (captureState === 'kickoff') {
        playback.seek(0);
        setPlaybackState((prev) => ({ ...prev, pt: 0, half: 1, score: { home: 0, away: 0 } }));
      } else if (captureState === 'goal') {
        if (firstGoal) {
          const t = firstGoal.t;
          playback.seek(t);
          const scorer = firstGoal.playerId ? gameState.players[firstGoal.playerId] : null;
          const scorerName = scorer
            ? (scorer.knownAs ?? `${scorer.firstName} ${scorer.lastName}`)
            : 'Whitlock';
          setCurrentGoalBanner({
            scorerName,
            minuteLabel: firstGoal.minuteLabel,
            side: firstGoal.side,
          });
          const scoreAtGoal = playback.getScoreAt(t);
          setPlaybackState((prev) => ({
            ...prev,
            pt: t,
            score: scoreAtGoal,
            lastGoalEvent: firstGoal,
          }));
        }
      } else if (captureState === 'replay') {
        if (firstGoal) {
          const replayStart = Math.max(0, firstGoal.t - 3);
          playback.seek(replayStart);
          playback.isReplay = true;
          playback.replayEndT = firstGoal.t + 10;
          playback.replayResumePt = firstGoal.t;
          setPlaybackState((prev) => ({
            ...prev,
            pt: replayStart,
            isReplay: true,
          }));
        }
      } else if (captureState === 'halftime') {
        playback.seek(2700);
        const scoreHT = playback.getScoreAt(2700);
        setIsHalfTime(true);
        setPlaybackState((prev) => ({
          ...prev,
          pt: 2700,
          half: 1,
          score: scoreHT,
        }));
      } else if (captureState === 'fulltime') {
        playback.seek(5400);
        setIsFullTime(true);
        setPlaybackState((prev) => ({
          ...prev,
          pt: 5400,
          half: 2,
          score: { home: realResult.homeGoals, away: realResult.awayGoals },
        }));
      } else if (captureState === 'subs') {
        playback.seek(3600);
        setSubsOpen(true);
      } else if (captureState === 'drawers') {
        playback.seek(1800);
        setStatsOpen(true);
        setAssistantOpen(true);
      } else if (captureState === 'tactical') {
        playback.seek(1200);
        scene.setCameraMode('tactical');
        setCameraMode('tactical');
      } else if (captureState === 'freecam') {
        playback.seek(1200);
        scene.setCameraMode('player');
        setCameraMode('player');
      } else if (captureState === 'afternoon') {
        playback.seek(1500);
      } else if (captureState === 'rain') {
        playback.seek(1500);
      } else if (captureState === 'timelapse') {
        playback.seek(1620);
        playback.isTimeLapse = true;
        playback.timeLapseProgress = 0.55;
        setPlaybackState((prev) => ({
          ...prev,
          pt: 1620,
          isTimeLapse: true,
          timeLapseProgress: 0.55,
          speedMultiplier: 60,
        }));
      }
    }

    // D. Initialize Match Worker. Capture states already simulated the whole match above, so the
    // worker would only add every event a second time (doubled goals and stats).
    const worker = captureState
      ? null
      : new Worker(new URL('../../workers/match.worker.ts', import.meta.url), {
          type: 'module',
        });
    workerRef.current = worker;

    if (worker) {
      worker.onmessage = (e: MessageEvent<WorkerToClientMessage>) => {
        const msg = e.data;
        if (msg.type === 'events') {
          playback.addEvents(msg.events);
        } else if (msg.type === 'result') {
          setMatchResult(msg.result);
        } else if (msg.type === 'error') {
          console.error('Match worker error:', msg.message);
        }
      };

      worker.postMessage({
        type: 'start',
        input,
        seed: matchSeed,
        lookaheadSec: 300,
      } satisfies ClientToWorkerMessage);
    }

    // E. Initialize simulated out-of-town scores
    const otherFixtures = gameState.fixtures
      .filter((f) => f.matchday === fixture.matchday && f.id !== fixture.id)
      .slice(0, 4);

    const initialScores: OutOfTownScore[] = otherFixtures.map((f) => {
      const hClub = gameState.clubs[f.homeId]!;
      const aClub = gameState.clubs[f.awayId]!;
      const curMinute =
        captureState === 'fulltime'
          ? 90
          : captureState === 'halftime'
            ? 45
            : Math.min(90, Math.max(1, Math.floor((playbackRef.current?.pt ?? 0) / 60)));
      const fixtureSeed = deriveSeed(gameState.seed, 'f-seed', f.id);
      const finH = f.result?.homeGoals ?? (fixtureSeed % 3);
      const finA = f.result?.awayGoals ?? ((fixtureSeed * 7) % 3);
      const curH =
        curMinute >= 80
          ? finH
          : curMinute >= 45
            ? Math.min(finH, 1)
            : curMinute >= 20 && finH > 1
              ? 1
              : 0;
      const curA = curMinute >= 80 ? finA : curMinute >= 45 ? Math.min(finA, 1) : 0;
      return {
        fixtureId: f.id,
        homeClub: hClub,
        awayClub: aClub,
        homeScore: curH,
        awayScore: curA,
        minute: curMinute,
      };
    });
    setOutOfTownScores(initialScores);

    // F. Main Render & Playback Loop
    let lastT = performance.now();
    const frameLoop = (now: number) => {
      const realDelta = Math.min(0.1, (now - lastT) / 1000);
      lastT = now;

      // Update Playback Clock
      const state = playback.update(realDelta);
      setPlaybackState(state);

      // In-match knock pause (§12.19.1)
      if (
        state.currentEvent?.type === 'KNOCK' &&
        state.currentEvent.side === userSide &&
        (gameState?.knocksSetting ?? 'ask') === 'ask' &&
        handledKnockTRef.current !== state.currentEvent.t &&
        !state.paused
      ) {
        playback.togglePause();
      }

      // Evaluate §15.4 in-match assistant rules every 5 match minutes
      const curMatchMin = Math.floor(state.pt / 60);
      if (
        curMatchMin >= 5 &&
        curMatchMin % 5 === 0 &&
        curMatchMin > lastAdviceEvalMinRef.current &&
        totalAdviceFiredRef.current < 6
      ) {
        lastAdviceEvalMinRef.current = curMatchMin;
        const evsSoFar = playback.getEvents().filter((e) => e.t <= state.pt);
        const ourYellows: Record<string, number> = {};
        const liveCondition: Record<string, number> = {};
        for (const id of userClub.tactics.lineup) {
          if (id && gameState.players[id]) {
            // Estimate live condition decay from elapsed minutes if engine snapshot isn't directly read
            liveCondition[id] = Math.max(
              35,
              Math.round(gameState.players[id]!.condition - curMatchMin * 0.35),
            );
          }
        }
        for (const ev of evsSoFar) {
          if (ev.type === 'YELLOW' && ev.side === userSide && ev.playerId) {
            ourYellows[ev.playerId] = (ourYellows[ev.playerId] ?? 0) + 1;
          }
        }
        const oppSheet = userSide === 'home' ? awaySheet : homeSheet;
        const newAdvices = adviseInMatch(
          {
            kind: 'inMatch',
            currentT: state.pt,
            minute: curMatchMin,
            ourSide: userSide,
            ourScore: userSide === 'home' ? state.score.home : state.score.away,
            oppScore: userSide === 'home' ? state.score.away : state.score.home,
            ourInstructions: userClub.tactics.instructions,
            ourLineup: userClub.tactics.lineup,
            ourBench: userClub.tactics.bench,
            ourRoles: userClub.tactics.roles ?? [],
            subsUsed,
            windowsUsed,
            liveCondition,
            ourYellows,
            events: evsSoFar,
            players: gameState.players,
            oppSheet,
            firedHistory: firedAdviceHistoryRef.current,
            totalFiredInMatch: totalAdviceFiredRef.current,
          },
          createRng(deriveSeed(gameState.seed, 'im-advice', `${fixture.id}-${curMatchMin}`)),
        );
        if (newAdvices.length > 0) {
          const adv = newAdvices[0]!;
          firedAdviceHistoryRef.current[adv.ruleId] = curMatchMin;
          totalAdviceFiredRef.current += 1;
          const applyFn = adv.apply
            ? () => {
                const act: AdviceAction = adv.apply!;
                if (act.type === 'setInstructions') {
                  const command: MatchCommand = {
                    kind: 'instructions',
                    side: userSide,
                    instructions: { ...userClub.tactics.instructions, ...act.instructions },
                    issuedAtT: state.pt,
                  };
                  workerRef.current?.postMessage({
                    type: 'command',
                    command,
                  } satisfies ClientToWorkerMessage);
                  updateUserTactics({
                    instructions: { ...userClub.tactics.instructions, ...act.instructions },
                  });
                } else if (act.type === 'setPlayerRole') {
                  const nextRoles = [...(userClub.tactics.roles ?? [])];
                  nextRoles[act.slot] = act.role;
                  const command: MatchCommand = {
                    kind: 'formation',
                    side: userSide,
                    formation: userClub.tactics.formation,
                    lineup: userClub.tactics.lineup,
                    roles: nextRoles,
                    issuedAtT: state.pt,
                  };
                  workerRef.current?.postMessage({
                    type: 'command',
                    command,
                  } satisfies ClientToWorkerMessage);
                  updateUserTactics({ roles: nextRoles });
                } else if (act.type === 'substitute') {
                  const command: MatchCommand = {
                    kind: 'sub',
                    side: userSide,
                    outId: act.outId,
                    inId: act.inId,
                    slot: Math.max(0, userClub.tactics.lineup.indexOf(act.outId)),
                    issuedAtT: state.pt,
                  };
                  workerRef.current?.postMessage({
                    type: 'command',
                    command,
                  } satisfies ClientToWorkerMessage);
                } else if (act.type === 'issueShout') {
                  const command: MatchCommand = {
                    kind: 'shout',
                    side: userSide,
                    shout: act.shout,
                    issuedAtT: state.pt,
                  };
                  workerRef.current?.postMessage({
                    type: 'command',
                    command,
                  } satisfies ClientToWorkerMessage);
                }
                setAdviceList((prev) =>
                  prev.map((item) => (item.id === adv.id ? { ...item, applied: true } : item)),
                );
                showToast('Applied assistant recommendation', 'success');
              }
            : undefined;
          setAdviceList((prev) => [
            {
              id: adv.id,
              text: adv.text,
              reason: adv.reason,
              onApply: applyFn,
              onDismiss: () => setAdviceList((p) => p.filter((x) => x.id !== adv.id)),
            },
            ...prev.slice(0, 5),
          ]);
        }
      }

      // Update 3D Scene: the director reads the whole event list for a continuous ball timeline.
      scene.setEvents(playback.getEvents());
      const replayGoal = state.isReplay ? state.lastGoalEvent : null;
      scene.setReplay(
        Boolean(replayGoal),
        replayGoal?.side === 'home'
          ? state.half === 1
            ? 52.5
            : -52.5
          : state.half === 1
            ? -52.5
            : 52.5,
      );
      scene.updatePlayback(state.pt, state.currentEvent, state.half);

      // Update name tags visibility (SPEC §14, M1)
      const ballCarrierId = state.currentEvent?.playerId ?? null;
      const commentaryPlayerId =
        state.currentEvent?.targetId ??
        state.currentEvent?.opponentId ??
        state.currentEvent?.playerId ??
        null;
      const showAllTags = scene.getCameraMode() === 'tactical' || isAltHeldRef.current;
      scene.updateNameTags(ballCarrierId, commentaryPlayerId, showAllTags);

      // Update 3D ball position during time-lapse (M4)
      if (state.isTimeLapse) {
        const interpBall = playback.getBallPosition(state.pt);
        const sceneX = interpBall.x - 52.5;
        const sceneZ = interpBall.y - 34;
        scene.setBallPosition(sceneX, 0.11, sceneZ);
      }

      // Update crowd danger mix (§17.3)
      const ballPos = playback.getBallPosition(state.pt);
      const attackingSide = state.currentEvent?.side ?? userSide;
      matchAudio.updateBall(ballPos.x, ballPos.y, attackingSide, userSide);

      // Update Out of Town Scores progress
      if (state.pt > 0 && Math.random() < 0.005) {
        setOutOfTownScores((prev) =>
          prev.map((s) => {
            const min = Math.min(90, Math.floor(state.pt / 60));
            const addGoal = Math.random() < 0.05;
            return {
              ...s,
              minute: min,
              homeScore: addGoal && Math.random() > 0.5 ? s.homeScore + 1 : s.homeScore,
              awayScore: addGoal && Math.random() <= 0.5 ? s.awayScore + 1 : s.awayScore,
            };
          }),
        );
      }

      // Request next events chunk if worker queue is getting low
      if (workerRef.current && state.pt > 0 && Math.floor(state.pt) % 60 === 0) {
        workerRef.current.postMessage({
          type: 'need',
          untilT: state.pt + 300,
        } satisfies ClientToWorkerMessage);
      }

      animFrameRef.current = requestAnimationFrame(frameLoop);
    };

    animFrameRef.current = requestAnimationFrame(frameLoop);

    return () => {
      voiceQueue.cancel();
      audioEngine.stopMatchAudio();
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
      scene.dispose();
      worker?.terminate();
    };
  }, []);

  // Keyboard Shortcuts per SPEC §11.0
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        isAltHeldRef.current = true;
      }
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const playback = playbackRef.current;
      const scene = sceneRef.current;
      if (!playback) return;

      if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        playback.togglePause();
      } else if (e.key === '1') {
        playback.setMode('key');
      } else if (e.key === '2') {
        playback.setMode('extended');
      } else if (e.key === '3') {
        playback.setMode('full');
      } else if (e.key === '+' || e.key === '=') {
        const next = playback.fullSpeed === 2 ? 4 : playback.fullSpeed === 4 ? 8 : 2;
        playback.setFullSpeed(next);
      } else if (e.key === 'c' || e.key === 'C') {
        if (scene) {
          scene.cameras.cycleMode();
          setCameraMode(scene.getCameraMode());
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (playback.lastGoalEvent) {
          playback.triggerGoalReplay(playback.lastGoalEvent);
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        setShoutOpen((prev) => !prev);
      } else if (e.key === 's' || e.key === 'S') {
        setSubsOpen((prev) => !prev);
      } else if (e.key === 'h' || e.key === 'H') {
        setHudVisible((prev) => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      } else if (e.key === 'i' || e.key === 'I') {
        handleFinishInstant();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        isAltHeldRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // §13.21: send a shout; it takes effect 10 s later and lasts 10 minutes.
  const handleShout = (id: ShoutId) => {
    const playback = playbackRef.current;
    if (!playback) return;
    const pt = playback.pt;
    if (workerRef.current) {
      const command: MatchCommand = { kind: 'shout', side: userSide, shout: id, issuedAtT: pt };
      workerRef.current.postMessage({ type: 'command', command } satisfies ClientToWorkerMessage);
    }
    setShoutLastEnd((prev) =>
      activeShout && pt < activeShout.endPt ? { ...prev, [activeShout.id]: pt } : prev,
    );
    setActiveShout({ id, startPt: pt + 10, endPt: pt + 10 + 600 });
    if (id === 'concentrate') setConcentrateHalf(playback.half);
    setShoutOpen(false);
  };

  const concentrateAllowed = (() => {
    const pt = playbackState.pt;
    if (concentrateHalf === playbackState.half) return false;
    const g = playbackState.lastGoalEvent;
    const justConceded = !!g && g.side !== userSide && pt - g.t <= 300;
    return pt >= 4500 || justConceded;
  })();

  // §13.22 "Ask me first": Apply keeps what the plan did; Skip undoes a plan switch.
  const resolvePlanAsk = useCallback(
    (apply: boolean) => {
      const ask = planAskRef.current;
      if (!ask) return;
      planAskRef.current = null;
      setPlanAsk(null);
      if (!apply && ask.then.startsWith('Plan') && workerRef.current && playbackRef.current) {
        const command: MatchCommand = {
          kind: 'plan',
          side: userSide,
          plan: ask.prevPlan,
          issuedAtT: playbackRef.current.pt,
        };
        workerRef.current.postMessage({ type: 'command', command } satisfies ClientToWorkerMessage);
        showToast('Staying with the current plan', 'info');
      }
      playbackRef.current?.resume();
    },
    [userSide, showToast],
  );

  useEffect(() => {
    if (!planAsk) return;
    const id = window.setInterval(() => {
      const left = (planAsk.deadline - performance.now()) / 1000;
      setPlanAskLeft(left);
      if (left <= 0) resolvePlanAsk(true);
    }, 200);
    return () => window.clearInterval(id);
  }, [planAsk, resolvePlanAsk]);

  const handleFinishInstant = () => {
    if (!workerRef.current || !playbackRef.current) return;
    workerRef.current.postMessage({
      type: 'finishInstant',
    } satisfies ClientToWorkerMessage);

    playbackRef.current.pause();
    showToast('Simulating instantly to full-time...', 'info');

    setTimeout(() => {
      setIsFullTime(true);
    }, 200);
  };

  const handleConfirmSub = (outId: PlayerId, inId: PlayerId) => {
    if (!workerRef.current || !playbackRef.current) return;
    const slot = userClub.tactics.lineup.findIndex((id) => id === outId);
    if (slot < 0) return;

    const command: MatchCommand = {
      kind: 'sub',
      side: userSide,
      outId,
      inId,
      slot,
      issuedAtT: playbackRef.current.pt,
    };

    workerRef.current.postMessage({
      type: 'command',
      command,
    } satisfies ClientToWorkerMessage);

    setSubsUsed((prev) => prev + 1);
    setWindowsUsed((prev) => prev + 1);
    showToast('Tactical substitution submitted', 'info');
  };

  const handleResumeSecondHalf = (talkTone?: TalkTone) => {
    setIsHalfTime(false);
    if (talkTone && gameState) {
      const isHome = gameState.userClubId === homeClub.id;
      const userGoals = isHome ? playbackState.score.home : playbackState.score.away;
      const oppGoals = isHome ? playbackState.score.away : playbackState.score.home;
      const htContext = getHalfTimeTalkContext(userGoals, oppGoals);
      const res = performTeamTalk(htContext, talkTone);
      if (res) {
        showToast(`Team Talk (${talkTone}): ${res.squadReaction}`, 'success');
      }
    }
    if (playbackRef.current) {
      playbackRef.current.resumeSecondHalf();
    }
  };

  const handleProceedToPostMatch = async () => {
    await advanceGame({ matchResult });
  };

  const starters = userClub.tactics.lineup
    .map((id) => (id ? gameState.players[id] : null))
    .filter((p): p is Player => p !== null);
  const bench = userClub.tactics.bench
    .map((id) => (id ? gameState.players[id] : null))
    .filter((p): p is Player => p !== null);

  const ballPos = sceneRef.current?.ball.getPosition() ?? { x: 0, y: 0.11, z: 0 };
  const absBallX = ballPos.x + 52.5;
  const absBallY = ballPos.z + 34;

  const mockStats = {
    goals: 0,
    shots: 0,
    shotsOnTarget: 0,
    xg: 0,
    possessionSec: 0,
    passes: 0,
    passesCompleted: 0,
    corners: 0,
    fouls: 0,
    offsides: 0,
    yellow: 0,
    red: 0,
    tackles: 0,
    interceptions: 0,
    saves: 0,
    bigChances: 0,
  };

  const fullHomeStats = matchResult ? matchResult.stats.home : mockStats;
  const fullAwayStats = matchResult ? matchResult.stats.away : mockStats;

  // Filter stats up to current playback time (T4)
  const liveStats = useMemo(() => {
    if (!matchResult?.events) return { home: fullHomeStats, away: fullAwayStats };
    const filtered = matchResult.events.filter((e) => e.t <= playbackState.pt);
    const homeEvents = filtered.filter((e) => e.side === 'home');
    const awayEvents = filtered.filter((e) => e.side === 'away');
    const homeShots = homeEvents.filter((e) => e.shot != null);
    const awayShots = awayEvents.filter((e) => e.shot != null);
    const homeXg = homeShots.reduce((s, e) => s + (e.shot?.xg ?? 0), 0);
    const awayXg = awayShots.reduce((s, e) => s + (e.shot?.xg ?? 0), 0);
    const frac = Math.min(1, Math.max(0.02, playbackState.pt / 5400));

    return {
      home: {
        ...fullHomeStats,
        goals: homeEvents.filter((e) => e.type === 'GOAL').length,
        shots: homeShots.length,
        shotsOnTarget: homeShots.filter((e) => e.shot?.onTarget).length,
        xg: homeXg,
        possessionSec: Math.round(fullHomeStats.possessionSec * frac),
        corners: homeEvents.filter((e) => e.type === 'CORNER').length,
        fouls: homeEvents.filter((e) => e.type === 'FOUL').length,
        yellow: homeEvents.filter((e) => e.type === 'YELLOW').length,
        red: homeEvents.filter((e) => e.type === 'RED').length,
      },
      away: {
        ...fullAwayStats,
        goals: awayEvents.filter((e) => e.type === 'GOAL').length,
        shots: awayShots.length,
        shotsOnTarget: awayShots.filter((e) => e.shot?.onTarget).length,
        xg: awayXg,
        possessionSec: Math.round(fullAwayStats.possessionSec * frac),
        corners: awayEvents.filter((e) => e.type === 'CORNER').length,
        fouls: awayEvents.filter((e) => e.type === 'FOUL').length,
        yellow: awayEvents.filter((e) => e.type === 'YELLOW').length,
        red: awayEvents.filter((e) => e.type === 'RED').length,
      },
    };
  }, [matchResult, playbackState.pt, fullHomeStats, fullAwayStats]);

  // Half-time stats (events with t <= 2700) (T4)
  const htStats = useMemo(() => {
    if (!matchResult?.events) return { home: fullHomeStats, away: fullAwayStats };
    const filtered = matchResult.events.filter((e) => e.t <= 2700);
    const homeEvents = filtered.filter((e) => e.side === 'home');
    const awayEvents = filtered.filter((e) => e.side === 'away');
    const homeShots = homeEvents.filter((e) => e.shot != null);
    const awayShots = awayEvents.filter((e) => e.shot != null);
    const homeXg = homeShots.reduce((s, e) => s + (e.shot?.xg ?? 0), 0);
    const awayXg = awayShots.reduce((s, e) => s + (e.shot?.xg ?? 0), 0);

    return {
      home: {
        ...fullHomeStats,
        goals: homeEvents.filter((e) => e.type === 'GOAL').length,
        shots: homeShots.length,
        shotsOnTarget: homeShots.filter((e) => e.shot?.onTarget).length,
        xg: homeXg,
        possessionSec: Math.round(fullHomeStats.possessionSec * 0.5),
        corners: homeEvents.filter((e) => e.type === 'CORNER').length,
        fouls: homeEvents.filter((e) => e.type === 'FOUL').length,
        yellow: homeEvents.filter((e) => e.type === 'YELLOW').length,
        red: homeEvents.filter((e) => e.type === 'RED').length,
      },
      away: {
        ...fullAwayStats,
        goals: awayEvents.filter((e) => e.type === 'GOAL').length,
        shots: awayShots.length,
        shotsOnTarget: awayShots.filter((e) => e.shot?.onTarget).length,
        xg: awayXg,
        possessionSec: Math.round(fullAwayStats.possessionSec * 0.5),
        corners: awayEvents.filter((e) => e.type === 'CORNER').length,
        fouls: awayEvents.filter((e) => e.type === 'FOUL').length,
        yellow: awayEvents.filter((e) => e.type === 'YELLOW').length,
        red: awayEvents.filter((e) => e.type === 'RED').length,
      },
    };
  }, [matchResult, fullHomeStats, fullAwayStats]);

  // Rolling xG momentum history (T13)
  const momentumHistory = useMemo(() => {
    if (!matchResult?.events) return [];
    const currentT = playbackState.pt;
    const history: { minute: number; homeXg: number; awayXg: number }[] = [];
    const maxMinute = Math.min(90, Math.max(5, Math.ceil(currentT / 60)));
    for (let m = 5; m <= maxMinute; m += 5) {
      const tMin = (m - 5) * 60;
      const tMax = m * 60;
      const segEvents = matchResult.events.filter((e) => e.t >= tMin && e.t < tMax);
      const hXg = segEvents
        .filter((e) => e.side === 'home' && e.shot)
        .reduce((s, e) => s + (e.shot?.xg ?? 0), 0);
      const aXg = segEvents
        .filter((e) => e.side === 'away' && e.shot)
        .reduce((s, e) => s + (e.shot?.xg ?? 0), 0);
      history.push({ minute: m, homeXg: Number(hXg.toFixed(2)), awayXg: Number(aXg.toFixed(2)) });
    }
    return history;
  }, [matchResult?.events, playbackState.pt]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#0A0E14',
      }}
    >
      {/* 3D WebGL Canvas Container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0,
        }}
      />

      {/* Broadcast HUD Overlays */}
      {hudVisible && (
        <>
          {/* Touchline shouts (§13.21): button, active chip, wheel; match-plan prompt (§13.22) */}
          <div
            style={{
              position: 'absolute',
              left: 24,
              bottom: 96,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 8,
              zIndex: 20,
            }}
          >
            <ShoutChip active={activeShout} pt={playbackState.pt} />
            <button
              onClick={() => setShoutOpen((v) => !v)}
              style={{
                fontFamily: 'var(--font-head)',
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '8px 14px',
                background: 'rgba(12,16,22,0.9)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.16)',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Shout <span style={{ opacity: 0.55, marginLeft: 6 }}>Y</span>
            </button>
          </div>
          <ShoutWheel
            open={shoutOpen}
            pt={playbackState.pt}
            active={activeShout}
            lastEnd={shoutLastEnd}
            concentrateAllowed={concentrateAllowed}
            onPick={handleShout}
            onClose={() => setShoutOpen(false)}
          />
          {planAsk && (
            <PlanAskCard
              text={planAsk.text}
              secondsLeft={planAskLeft}
              onApply={() => resolvePlanAsk(true)}
              onSkip={() => resolvePlanAsk(false)}
            />
          )}

          {/* In-Match Knock Choice Card (§12.19.1) */}
          {(() => {
            const evt = playbackState.currentEvent;
            if (
              evt?.type === 'KNOCK' &&
              evt.side === userSide &&
              evt.playerId &&
              (gameState?.knocksSetting ?? 'ask') === 'ask' &&
              handledKnockT !== evt.t
            ) {
              const player = gameState?.players[evt.playerId];
              if (!player) return null;
              const pct = evt.knock?.pct ?? 80;
              return (
                <KnockChoiceCard
                  player={player}
                  pct={pct}
                  isFirstHalf={playbackState.half === 1}
                  onChoice={(decision) => {
                    const command: MatchCommand = {
                      kind: 'knock',
                      side: userSide,
                      playerId: evt.playerId!,
                      decision,
                      issuedAtT: playbackState.pt,
                    };
                    workerRef.current?.postMessage({
                      type: 'command',
                      command,
                    } satisfies ClientToWorkerMessage);
                    handledKnockTRef.current = evt.t;
                    setHandledKnockT(evt.t);
                    if (playbackRef.current?.paused) {
                      playbackRef.current?.togglePause();
                    }
                  }}
                />
              );
            }
            return null;
          })()}

          {/* Top Left Scoreboard Bug */}
          <ScoreboardBug
            homeClub={homeClub}
            awayClub={awayClub}
            homeScore={playbackState.score.home}
            awayScore={playbackState.score.away}
            pt={playbackState.pt}
            half={playbackState.half}
          />

          {/* Top Right Match Controls */}
          <MatchControls
            paused={playbackState.paused}
            mode={playbackState.mode}
            fullSpeed={playbackState.fullSpeed}
            cameraMode={cameraMode}
            statsOpen={statsOpen}
            assistantOpen={assistantOpen}
            onTogglePause={() => playbackRef.current?.togglePause()}
            onSelectMode={(m) => playbackRef.current?.setMode(m)}
            onCycleFullSpeed={() => {
              const cur = playbackRef.current?.fullSpeed ?? 4;
              const next = cur === 2 ? 4 : cur === 4 ? 8 : 2;
              playbackRef.current?.setFullSpeed(next);
            }}
            onCycleCamera={() => {
              if (sceneRef.current) {
                sceneRef.current.cameras.cycleMode();
                setCameraMode(sceneRef.current.getCameraMode());
              }
            }}
            onToggleStats={() => setStatsOpen((prev) => !prev)}
            onToggleAssistant={() => setAssistantOpen((prev) => !prev)}
            onInstantResult={handleFinishInstant}
            onToggleFullscreen={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen().catch(() => {});
              }
            }}
          />

          {/* Bottom Commentary Caption Strip */}
          {(() => {
            const commentary = playbackState.currentEvent
              ? resolveCommentary(playbackState.currentEvent, gameState.players, {
                  weather: fixture.weather,
                  isDerby: false,
                  homeScore: playbackState.score.home,
                  awayScore: playbackState.score.away,
                })
              : null;
            return (
              <CommentaryStrip
                text={commentary?.text ?? ''}
                importance={commentary?.importance ?? playbackState.currentEvent?.importance ?? 0}
              />
            );
          })()}

          {/* 2D Radar Time-Lapse Overlay during highlights gaps (M4) */}
          {playbackState.isTimeLapse && (
            <RadarOverlay
              ballX={playbackRef.current?.getBallPosition(playbackState.pt).x ?? absBallX}
              ballY={playbackRef.current?.getBallPosition(playbackState.pt).y ?? absBallY}
              speedMultiplier={playbackState.speedMultiplier}
              timeLapseProgress={playbackState.timeLapseProgress}
            />
          )}

          {/* Left Live Stats & Momentum Drawer */}
          <LiveStatsDrawer
            isOpen={statsOpen}
            onClose={() => setStatsOpen(false)}
            homeClub={homeClub}
            awayClub={awayClub}
            homeStats={liveStats.home}
            awayStats={liveStats.away}
            momentumHistory={momentumHistory}
          />

          {/* Right Assistant Advice & Around the League Drawer */}
          <AssistantDrawer
            isOpen={assistantOpen}
            onClose={() => setAssistantOpen(false)}
            adviceList={adviceList}
            outOfTownScores={outOfTownScores}
          />

          {/* Quick Substitutions Modal */}
          <QuickSubsModal
            isOpen={subsOpen}
            onClose={() => setSubsOpen(false)}
            starters={starters}
            bench={bench}
            subsUsed={subsUsed}
            subsAllowed={5}
            windowsUsed={windowsUsed}
            windowsAllowed={3}
            onConfirmSub={handleConfirmSub}
          />

          {/* Goal Banner */}
          {currentGoalBanner && (
            <GoalBanner
              scorerName={currentGoalBanner.scorerName}
              minuteLabel={currentGoalBanner.minuteLabel}
              scoringClub={currentGoalBanner.side === 'home' ? homeClub : awayClub}
              onDismiss={() => setCurrentGoalBanner(null)}
              persistent={Boolean(captureState)}
            />
          )}

          {/* Goal Replay Overlay */}
          {playbackState.isReplay && (
            <ReplayOverlay onSkip={() => playbackRef.current?.cancelReplay()} />
          )}
        </>
      )}

      {/* Half-Time Screen */}
      <HalfTimeModal
        isOpen={isHalfTime}
        homeClub={homeClub}
        awayClub={awayClub}
        homeScore={htStats.home.goals}
        awayScore={htStats.away.goals}
        homeStats={htStats.home}
        awayStats={htStats.away}
        events={matchResult?.events}
        userClubId={gameState.userClubId}
        fixture={fixture}
        players={gameState.players}
        outOfTownScores={outOfTownScores}
        onSecondHalf={handleResumeSecondHalf}
        onOpenSubs={() => setSubsOpen(true)}
        onOpenTactics={() => showToast('Adjust tactics in the drawer or pause', 'info')}
        onApplyAdvice={(act) => {
          const pt = playbackRef.current?.pt ?? 2700;
          if (act.type === 'setInstructions') {
            const command: MatchCommand = {
              kind: 'instructions',
              side: userSide,
              instructions: { ...userClub.tactics.instructions, ...act.instructions },
              issuedAtT: pt,
            };
            workerRef.current?.postMessage({
              type: 'command',
              command,
            } satisfies ClientToWorkerMessage);
            updateUserTactics({
              instructions: { ...userClub.tactics.instructions, ...act.instructions },
            });
          } else if (act.type === 'substitute') {
            const command: MatchCommand = {
              kind: 'sub',
              side: userSide,
              outId: act.outId,
              inId: act.inId,
              slot: Math.max(0, userClub.tactics.lineup.indexOf(act.outId)),
              issuedAtT: pt,
            };
            workerRef.current?.postMessage({
              type: 'command',
              command,
            } satisfies ClientToWorkerMessage);
          }
          showToast('Applied half-time recommendation', 'success');
        }}
      />

      {/* Full-Time Screen */}
      <FullTimeModal
        isOpen={isFullTime}
        homeClub={homeClub}
        awayClub={awayClub}
        matchResult={matchResult}
        userClubId={gameState.userClubId}
        fixture={fixture}
        leagueTable={gameState.table}
        players={gameState.players}
        outOfTownScores={outOfTownScores}
        onProceed={handleProceedToPostMatch}
      />
    </div>
  );
};
