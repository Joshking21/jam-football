// Implements SPEC §11.16 & §23 M3.4 Temporary Text Match View
// Connects to match.worker.ts with start, need, command, finishInstant protocol.
// Displays live scoreboard, event feed, speed controls, subs & tactics overlays.
import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import {
  MatchEvent,
  MatchResult,
  MatchCommand,
  MatchInput,
  Side,
  PlayerId,
  Player,
  Duty,
  Formation,
} from '../../core/types';
import { buildTeamSheet } from '../../core/game/advance';
import { deriveSeed } from '../../core/rng';
import { Crest } from '../components/Crest';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { Play, Pause, FastForward, Check, Users, Sliders, ArrowRight } from 'lucide-react';
import type { ClientToWorkerMessage, WorkerToClientMessage } from '../../workers/match.worker';

export const TextMatchScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const advanceGame = useStore((state) => state.advanceGame);
  const showToast = useStore((state) => state.showToast);

  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [clockT, setClockT] = useState<number>(0);
  const [half, setHalf] = useState<1 | 2>(1);
  const [homeScore, setHomeScore] = useState<number>(0);
  const [awayScore, setAwayScore] = useState<number>(0);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(4); // 1x, 4x, 16x
  const [isHalfTime, setIsHalfTime] = useState<boolean>(false);
  const [isFullTime, setIsFullTime] = useState<boolean>(false);

  // Overlays
  const [showSubs, setShowSubs] = useState<boolean>(false);
  const [showTactics, setShowTactics] = useState<boolean>(false);
  const [selectedSubOut, setSelectedSubOut] = useState<PlayerId | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const eventQueueRef = useRef<MatchEvent[]>([]);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  if (!gameState || !gameState.pendingMatch) return null;

  const pending = gameState.pendingMatch;
  const fixture = gameState.fixtures.find((f) => f.id === pending.fixtureId);
  if (!fixture) return null;

  const homeClub = gameState.clubs[fixture.homeId];
  const awayClub = gameState.clubs[fixture.awayId];
  const userClub = gameState.clubs[gameState.userClubId];
  if (!homeClub || !awayClub || !userClub) return null;

  const userSide: Side = fixture.homeId === gameState.userClubId ? 'home' : 'away';

  // Initialize Worker
  useEffect(() => {
    const worker = new Worker(new URL('../../workers/match.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerToClientMessage>) => {
      const msg = e.data;
      if (msg.type === 'events') {
        eventQueueRef.current = [...eventQueueRef.current, ...msg.events];
      } else if (msg.type === 'result') {
        setMatchResult(msg.result);
      } else if (msg.type === 'rewind') {
        // Rewind queue to fromSeq
        eventQueueRef.current = eventQueueRef.current.filter((ev) => ev.seq < msg.fromSeq);
      } else if (msg.type === 'error') {
        console.error('Match Worker Error:', msg.message);
      }
    };

    const homeSheet = buildTeamSheet(homeClub, gameState.players, 'home');
    const awaySheet = buildTeamSheet(awayClub, gameState.players, 'away');

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

    // Send start message
    worker.postMessage({
      type: 'start',
      input,
      seed: matchSeed,
      lookaheadSec: 300,
    } satisfies ClientToWorkerMessage);

    return () => {
      worker.terminate();
    };
  }, []);

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying || isHalfTime || isFullTime) return;

    const interval = window.setInterval(() => {
      setClockT((prevT) => {
        const nextT = prevT + speedMultiplier;

        // Check for newly reached events
        const newEvents: MatchEvent[] = [];
        while (
          eventQueueRef.current.length > 0 &&
          eventQueueRef.current[0] &&
          eventQueueRef.current[0].t <= nextT
        ) {
          const ev = eventQueueRef.current.shift()!;
          newEvents.push(ev);

          if (ev.type === 'GOAL') {
            if (ev.side === 'home') setHomeScore((s) => s + 1);
            else setAwayScore((s) => s + 1);
          } else if (ev.type === 'HALF_TIME') {
            setIsHalfTime(true);
            setIsPlaying(false);
          } else if (ev.type === 'FULL_TIME') {
            setIsFullTime(true);
            setIsPlaying(false);
          }
        }

        if (newEvents.length > 0) {
          setEvents((prev) => [...prev, ...newEvents]);
        }

        // Request more events if queue getting low
        if (eventQueueRef.current.length < 20 && workerRef.current) {
          workerRef.current.postMessage({
            type: 'need',
            untilT: nextT + 300,
          } satisfies ClientToWorkerMessage);
        }

        return nextT;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, speedMultiplier, isHalfTime, isFullTime]);

  // Auto-scroll event feed
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const handleFinishInstant = () => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({
      type: 'finishInstant',
    } satisfies ClientToWorkerMessage);

    // Consume all remaining events
    setTimeout(() => {
      const allQueued = eventQueueRef.current;
      eventQueueRef.current = [];
      allQueued.forEach((ev) => {
        if (ev.type === 'GOAL') {
          if (ev.side === 'home') setHomeScore((s) => s + 1);
          else setAwayScore((s) => s + 1);
        }
      });
      setEvents((prev) => [...prev, ...allQueued]);
      setClockT(5400); // 90 min
      setIsFullTime(true);
      setIsPlaying(false);
    }, 150);
  };

  const handleResumeSecondHalf = () => {
    setIsHalfTime(false);
    setHalf(2);
    setIsPlaying(true);
  };

  const handleProceedToPostMatch = async () => {
    await advanceGame({ matchResult });
  };

  const handleMakeSubstitution = (benchPlayerId: PlayerId) => {
    if (!selectedSubOut || !workerRef.current) return;
    const slot = userClub.tactics.lineup.findIndex((id) => id === selectedSubOut);
    if (slot < 0) return;

    const command: MatchCommand = {
      kind: 'sub',
      side: userSide,
      outId: selectedSubOut,
      inId: benchPlayerId,
      slot,
      issuedAtT: clockT,
    };

    workerRef.current.postMessage({
      type: 'command',
      command,
    } satisfies ClientToWorkerMessage);

    setSelectedSubOut(null);
    setShowSubs(false);
    showToast('Tactical substitution submitted', 'info');
  };

  // Format clock
  const minutes = Math.floor(clockT / 60);
  const seconds = Math.floor(clockT % 60);
  const clockString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const starters = userClub.tactics.lineup
    .map((id) => (id ? gameState.players[id] : null))
    .filter((p): p is Player => p != null);
  const bench = userClub.tactics.bench
    .map((id) => (id ? gameState.players[id] : null))
    .filter((p): p is Player => p != null);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      {/* 1. Scoreboard Bug Header (SPEC §11.16) */}
      <div
        style={{
          height: '80px',
          backgroundColor: 'var(--surface)',
          borderBottom: '2px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          zIndex: 30,
        }}
      >
        {/* Home Team */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flex: 1,
            justifyContent: 'flex-end',
          }}
        >
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily: 'var(--font-head)',
                fontSize: '22px',
                fontWeight: 700,
              }}
            >
              {homeClub.name.toUpperCase()}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{homeClub.code}</div>
          </div>
          <Crest
            clubId={homeClub.id}
            code={homeClub.code}
            primaryColor={homeClub.colors.primary}
            secondaryColor={homeClub.colors.secondary}
            size={48}
          />
        </div>

        {/* Score & Match Clock Center */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '0 40px',
          }}
        >
          <div
            className="stat-number tabular-nums"
            style={{
              fontSize: '38px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: 'var(--text)',
              lineHeight: 1,
            }}
          >
            {homeScore} - {awayScore}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '4px',
            }}
          >
            <span
              className="broadcast-label tabular-nums"
              style={{
                backgroundColor: 'var(--surface-2)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-s)',
                fontSize: '13px',
                color: 'var(--accent-text)',
              }}
            >
              {clockString}
            </span>
            <span
              className="broadcast-label"
              style={{ fontSize: '11px', color: 'var(--text-dim)' }}
            >
              {isFullTime
                ? 'FULL TIME'
                : isHalfTime
                  ? 'HALF TIME'
                  : half === 1
                    ? '1ST HALF'
                    : '2ND HALF'}
            </span>
          </div>
        </div>

        {/* Away Team */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flex: 1,
            justifyContent: 'flex-start',
          }}
        >
          <Crest
            clubId={awayClub.id}
            code={awayClub.code}
            primaryColor={awayClub.colors.primary}
            secondaryColor={awayClub.colors.secondary}
            size={48}
          />
          <div>
            <div
              style={{
                fontFamily: 'var(--font-head)',
                fontSize: '22px',
                fontWeight: 700,
              }}
            >
              {awayClub.name.toUpperCase()}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{awayClub.code}</div>
          </div>
        </div>
      </div>

      {/* 2. Controls & Actions Toolbar */}
      <div
        style={{
          height: '48px',
          backgroundColor: 'var(--surface-2)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}
      >
        {/* Speed Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button
            variant="secondary"
            size="s"
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={isFullTime || isHalfTime}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? 'Pause' : 'Play'}
          </Button>

          <span
            className="broadcast-label"
            style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: '8px' }}
          >
            SPEED:
          </span>
          {[1, 4, 16].map((spd) => (
            <button
              key={spd}
              onClick={() => setSpeedMultiplier(spd)}
              className="broadcast-label"
              style={{
                padding: '4px 8px',
                borderRadius: '2px',
                backgroundColor: speedMultiplier === spd ? 'var(--accent)' : 'transparent',
                color: speedMultiplier === spd ? 'var(--accent-ink)' : 'var(--text-dim)',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              {spd === 1 ? '1x Full' : spd === 4 ? '4x Ext' : '16x Key'}
            </button>
          ))}

          <Button
            variant="ghost"
            size="s"
            onClick={handleFinishInstant}
            disabled={isFullTime}
            style={{ marginLeft: '12px' }}
          >
            Instant Result
          </Button>
        </div>

        {/* Tactical Drawer Toggles */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            variant={showSubs ? 'primary' : 'secondary'}
            size="s"
            icon={<Users size={14} />}
            onClick={() => {
              setShowSubs(!showSubs);
              setShowTactics(false);
            }}
          >
            Substitutions (S)
          </Button>
          <Button
            variant={showTactics ? 'primary' : 'secondary'}
            size="s"
            icon={<Sliders size={14} />}
            onClick={() => {
              setShowTactics(!showTactics);
              setShowSubs(false);
            }}
          >
            Tactics (T)
          </Button>
        </div>
      </div>

      {/* 3. Main Center: Live Event Feed */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxWidth: '900px',
          width: '100%',
          margin: '0 auto',
        }}
      >
        {events.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-dim)',
              marginTop: '40px',
            }}
          >
            Kickoff! Match underway at {homeClub.stadium.name}...
          </div>
        ) : (
          events.map((ev, idx) => {
            const isGoal = ev.type === 'GOAL';
            const isCard = ev.type === 'YELLOW' || ev.type === 'RED';
            const sideClub = ev.side === 'home' ? homeClub : awayClub;

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: isGoal ? '12px 16px' : '8px 12px',
                  backgroundColor: isGoal
                    ? 'rgba(255, 200, 61, 0.15)'
                    : isCard
                      ? 'rgba(255, 77, 94, 0.1)'
                      : 'var(--surface)',
                  border: isGoal ? '1px solid var(--gold)' : '1px solid var(--border)',
                  borderRadius: 'var(--radius-s)',
                  animation: 'event-enter 160ms ease-out',
                }}
              >
                {/* Minute Label */}
                <span
                  className="stat-number tabular-nums"
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: isGoal ? 'var(--gold)' : 'var(--accent-text)',
                    minWidth: '40px',
                  }}
                >
                  {ev.minuteLabel}'
                </span>

                {/* Event Type Badge */}
                <span
                  className="broadcast-label"
                  style={{
                    backgroundColor: isGoal
                      ? 'var(--gold)'
                      : isCard
                        ? 'var(--warning)'
                        : 'var(--surface-2)',
                    color: isGoal || isCard ? '#000000' : 'var(--text)',
                    padding: '2px 8px',
                    borderRadius: '2px',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  {ev.type}
                </span>

                {/* Event Description */}
                <div style={{ flex: 1, fontSize: '14px', color: 'var(--text)' }}>
                  <strong style={{ color: 'var(--text-dim)', marginRight: '6px' }}>
                    {sideClub.code}:
                  </strong>
                  {isGoal
                    ? `GOAL! Shot successfully converted into the net!`
                    : ev.type === 'SHOT'
                      ? `Shot on goal tested the goalkeeper.`
                      : ev.type === 'SAVE'
                        ? `Fine save parried away to safety.`
                        : ev.type === 'YELLOW'
                          ? `Yellow card shown for a reckless challenge.`
                          : ev.type === 'FOUL'
                            ? `Foul committed in contest.`
                            : `${ev.type.replace(/_/g, ' ')}`}
                </div>
              </div>
            );
          })
        )}
        <div ref={eventsEndRef} />
      </div>

      {/* Half-Time Break Banner */}
      {isHalfTime && (
        <div
          style={{
            backgroundColor: 'var(--surface-3)',
            borderTop: '2px solid var(--accent)',
            padding: '16px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              className="broadcast-label"
              style={{ color: 'var(--accent-text)', fontSize: '13px' }}
            >
              HALF-TIME INTERVAL
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600 }}>
              Teams in the dressing rooms. Review tactics before resuming.
            </div>
          </div>
          <Button variant="primary" size="l" onClick={handleResumeSecondHalf}>
            Start Second Half <ArrowRight size={16} />
          </Button>
        </div>
      )}

      {/* Full-Time Whistle Banner */}
      {isFullTime && (
        <div
          style={{
            backgroundColor: 'var(--surface-3)',
            borderTop: '2px solid var(--win)',
            padding: '16px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div className="broadcast-label" style={{ color: 'var(--win)', fontSize: '13px' }}>
              FULL-TIME WHISTLE
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>
              Final: {homeClub.name} {homeScore} - {awayScore} {awayClub.name}
            </div>
          </div>
          <Button variant="primary" size="l" onClick={handleProceedToPostMatch}>
            Proceed to Post-Match Review <ArrowRight size={16} />
          </Button>
        </div>
      )}

      {/* Subs Overlay Drawer */}
      {showSubs && (
        <div
          style={{
            position: 'absolute',
            bottom: '48px',
            right: '24px',
            width: '400px',
            backgroundColor: 'var(--surface)',
            border: '2px solid var(--border)',
            borderRadius: 'var(--radius-s)',
            padding: '16px',
            boxShadow: 'var(--shadow-2)',
            zIndex: 40,
            maxHeight: '480px',
            overflowY: 'auto',
          }}
        >
          <div
            className="broadcast-label"
            style={{
              color: 'var(--accent-text)',
              borderBottom: '1px solid var(--border)',
              paddingBottom: '8px',
              marginBottom: '12px',
            }}
          >
            TACTICAL SUBSTITUTIONS
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '8px' }}>
            {selectedSubOut ? 'Select replacement from bench:' : 'Select starter to replace:'}
          </div>

          {!selectedSubOut ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {starters.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedSubOut(p.id)}
                  style={{
                    padding: '8px 10px',
                    backgroundColor: 'var(--surface-2)',
                    borderRadius: 'var(--radius-s)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                  }}
                >
                  <span>
                    #{p.squadNumber} {p.knownAs ?? p.lastName} ({p.positions[0]?.pos})
                  </span>
                  <span
                    className="tabular-nums"
                    style={{
                      fontSize: '11px',
                      color: p.condition < 70 ? 'var(--warning)' : 'var(--text-dim)',
                    }}
                  >
                    Cond: {p.condition}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {bench.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleMakeSubstitution(p.id)}
                  style={{
                    padding: '8px 10px',
                    backgroundColor: 'var(--surface-3)',
                    borderRadius: 'var(--radius-s)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                  }}
                >
                  <span>
                    #{p.squadNumber} {p.knownAs ?? p.lastName} ({p.positions[0]?.pos})
                  </span>
                  <span
                    className="broadcast-label"
                    style={{ fontSize: '11px', color: 'var(--accent-text)' }}
                  >
                    BRING ON
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes event-enter {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};
