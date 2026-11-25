// Implements SPEC §11.20, §12.15–12.16 Season End 5-Step Broadcast Sequence
// Design Reference: docs/design/season-end/ (approved 23 Nov)
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@/state/store';
import { Crest } from '../components/Crest';
import { computeSeasonEnd } from '@/core/game/advance';
import { Trophy, Award, Star, ArrowRight, RotateCcw, Download, Home, Sparkles } from 'lucide-react';
import { formatMoney } from '@/core/math';

export const SeasonEndScreen: React.FC = () => {
  const gameState = useStore((state) => state.gameState);
  const setScreen = useStore((state) => state.setScreen);

  type StepKey = 'table' | 'awards' | 'numbers' | 'verdict' | 'share';
  const [step, setStep] = useState<StepKey>('table');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  if (!gameState) return null;

  const effectiveState = !gameState.awards ? computeSeasonEnd(gameState) : gameState;
  const userClub = effectiveState.clubs[effectiveState.userClubId];
  if (!userClub) return null;
  const awards = effectiveState.awards ?? computeSeasonEnd(effectiveState).awards!;

  // Table calculations
  const table = effectiveState.table;
  const userRankIndex = table.findIndex((r) => r.clubId === userClub.id);
  const userPosition = userRankIndex >= 0 ? userRankIndex + 1 : 10;
  const userRow = table[userRankIndex] ?? table[0]!;
  const championRow = table[0]!;
  const championClub = effectiveState.clubs[championRow.clubId]!;

  const posDiff = userClub.expectation.target - userPosition;
  const grade =
    posDiff >= 2
      ? 'A+'
      : posDiff === 1
        ? 'A'
        : posDiff === 0
          ? 'B'
          : posDiff === -1
            ? 'C'
            : posDiff === -2
              ? 'D'
              : 'F';

  const isCelebration = userPosition <= 3 || grade.startsWith('A');

  // Helper to get player by id
  const getPlayer = (id: string | null) => (id ? effectiveState.players[id] : null);

  const goldenBootPlayer = getPlayer(awards.goldenBoot);
  const playmakerPlayer = getPlayer(awards.playmaker);
  const goldenGlovePlayer = getPlayer(awards.goldenGlove);
  const youngPlayer = getPlayer(awards.youngPlayer);
  const playerOfTheSeason = getPlayer(awards.playerOfTheSeason);
  const managerClub = effectiveState.clubs[awards.managerOfTheSeason] ?? userClub;

  // Top scorer for user club
  const userPlayers = userClub.squad
    .map((id) => effectiveState.players[id])
    .filter((p) => p != null);
  const userTopScorer = [...userPlayers].sort((a, b) => b.stats.goals - a.stats.goals)[0];

  // Best win of user club
  let bestWinMargin = -999;
  let bestWinStr = 'None';
  for (const f of effectiveState.fixtures) {
    if (f.result) {
      if (f.homeId === userClub.id) {
        const margin = f.result.homeGoals - f.result.awayGoals;
        if (margin > bestWinMargin && margin > 0) {
          bestWinMargin = margin;
          const opp = effectiveState.clubs[f.awayId]?.name ?? 'Opponent';
          bestWinStr = `${f.result.homeGoals}–${f.result.awayGoals} v ${opp}, MD${f.matchday}`;
        }
      } else if (f.awayId === userClub.id) {
        const margin = f.result.awayGoals - f.result.homeGoals;
        if (margin > bestWinMargin && margin > 0) {
          bestWinMargin = margin;
          const opp = effectiveState.clubs[f.homeId]?.name ?? 'Opponent';
          bestWinStr = `${f.result.awayGoals}–${f.result.homeGoals} v ${opp}, MD${f.matchday}`;
        }
      }
    }
  }

  // Biggest crowd
  let biggestCrowd = 0;
  for (const f of effectiveState.fixtures) {
    if (f.homeId === userClub.id && f.result?.attendance) {
      if (f.result.attendance > biggestCrowd) biggestCrowd = f.result.attendance;
    }
  }
  if (biggestCrowd === 0) biggestCrowd = Math.round(userClub.stadium.capacity * 0.92);

  // Signings count
  const signingsCount = userClub.squad.length - 18 > 0 ? userClub.squad.length - 18 : 2;

  // Ordinal helper
  const getOrdinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] ?? s[v] ?? s[0] ?? 'th');
  };

  // Headline & standfirst generator
  let paperHeadline = 'Solid Season Concluded';
  let paperStandfirst = `${userClub.name} conclude campaign ${getOrdinal(userPosition)} in Meridian League.`;
  if (userPosition === 1) {
    paperHeadline = 'CHAMPIONS OF MERIDIAN!';
    paperStandfirst = `${userClub.name} seal historic title triumph under ${effectiveState.managerName}.`;
  } else if (userPosition === 2) {
    paperHeadline = 'SECOND BEST,\nFIRST CLASS';
    paperStandfirst = `${userClub.name} finish runners-up after intense title duel with ${championClub.name}.`;
  } else if (userPosition === 3) {
    paperHeadline = 'PODIUM FINISH\nSEALS GLORY';
    paperStandfirst = `A stellar campaign sees ${userClub.name} take third place.`;
  } else if (userPosition <= 5) {
    paperHeadline = 'TOP-HALF PROMISE\nDELIVERED';
    paperStandfirst = `${userClub.name} complete a respectable campaign with pride.`;
  } else if (userPosition >= 9) {
    paperHeadline = 'SURVIVAL SECURED\nIN TOUGH FIGHT';
    paperStandfirst = `${userClub.name} endure difficult waters to complete the 18 matchdays.`;
  }

  // Board verdict quote
  let boardQuote = `You brought steady hands and tactical organization to ${userClub.name}. We look forward to building further.`;
  if (userPosition === 1) {
    boardQuote = `An unforgettable season! You took us to the very summit of the Meridian League. This town will sing your name for generations.`;
  } else if (userPosition <= 3) {
    boardQuote = `You were brought in to compete with the best. You gave our supporters pride and a true title pursuit. We want you here for years to come.`;
  } else if (posDiff < 0) {
    boardQuote = `A challenging season. While we fell short of our pre-season ambition of ${getOrdinal(userClub.expectation.target)}, we recognize your dedication.`;
  }

  // 1200x630 Canvas generator for Share Card (§11.20)
  const generateShareCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background gradient in club colours
    const grad = ctx.createLinearGradient(0, 0, 1200, 630);
    grad.addColorStop(0, '#070C18');
    grad.addColorStop(0.5, '#0E172B');
    grad.addColorStop(1, '#080A10');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1200, 630);

    // Accent header strip
    ctx.fillStyle = userClub.colors.primary;
    ctx.fillRect(0, 0, 1200, 16);

    // Decorative corner brand lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 36, 1140, 560);

    // Header Title
    ctx.fillStyle = '#F3F6FB';
    ctx.font = '700 36px "Barlow Condensed", sans-serif';
    ctx.fillText('TOUCHLINE · MERIDIAN LEAGUE 2026/27', 60, 90);

    // Club Name & Manager
    ctx.fillStyle = '#00E58F';
    ctx.font = '800 64px "Barlow Condensed", sans-serif';
    ctx.fillText(userClub.name.toUpperCase(), 60, 160);

    ctx.fillStyle = '#8E9AA8';
    ctx.font = '500 24px Inter, sans-serif';
    ctx.fillText(
      `Manager: ${effectiveState.managerName}  ·  Board Target: ${getOrdinal(userClub.expectation.target)}`,
      60,
      205,
    );

    // Big Position Numeral
    ctx.fillStyle = '#F2B705';
    ctx.font = '900 130px "Barlow Condensed", sans-serif';
    ctx.fillText(getOrdinal(userPosition), 60, 340);

    ctx.fillStyle = '#F3F6FB';
    ctx.font = '700 32px "Barlow Condensed", sans-serif';
    ctx.fillText(`FINAL LEAGUE STANDING`, 60, 385);

    // Stats Grid
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fillRect(60, 420, 720, 140);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.strokeRect(60, 420, 720, 140);

    ctx.fillStyle = '#8E9AA8';
    ctx.font = '700 16px "Barlow Condensed", sans-serif';
    ctx.fillText('RECORD', 90, 455);
    ctx.fillText('GOALS', 270, 455);
    ctx.fillText('POINTS', 450, 455);
    ctx.fillText('TOP SCORER', 600, 455);

    ctx.fillStyle = '#F3F6FB';
    ctx.font = '800 32px "Barlow Condensed", sans-serif';
    ctx.fillText(`W${userRow.w} D${userRow.d} L${userRow.l}`, 90, 500);
    ctx.fillText(
      `${userRow.gf}–${userRow.ga} (${userRow.gd >= 0 ? '+' : ''}${userRow.gd})`,
      270,
      500,
    );
    ctx.fillText(`${userRow.pts} PTS`, 450, 500);
    ctx.fillText(
      `${userTopScorer?.lastName ?? '—'} (${userTopScorer?.stats.goals ?? 0})`,
      600,
      500,
    );

    // Circular Grade Stamp on Right
    ctx.save();
    ctx.translate(970, 310);
    ctx.rotate((-8 * Math.PI) / 180);

    const gradeColor = grade.startsWith('A')
      ? '#00E58F'
      : grade.startsWith('B')
        ? '#F2B705'
        : grade.startsWith('C')
          ? '#C98A12'
          : '#E53E3E';
    ctx.strokeStyle = gradeColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 90, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 80, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = gradeColor;
    ctx.font = '900 84px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(grade, 0, -10);

    ctx.font = '800 16px "Barlow Condensed", sans-serif';
    ctx.letterSpacing = '0.2em';
    ctx.fillText('BOARD GRADE', 0, 46);
    ctx.restore();

    // Footer
    ctx.fillStyle = '#56667A';
    ctx.font = '500 16px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('OpenGame Game Jam #1  ·  Touchline Football Management Game', 60, 595);
  };

  useEffect(() => {
    if (step === 'share') {
      setTimeout(generateShareCard, 100);
    }
  }, [step]);

  // Keyboard shortcut D for share download
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'd' && step === 'share') {
        handleDownloadShareCard();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [step]);

  const handleDownloadShareCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `touchline-share-${userClub.id}-season.png`;
    a.click();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        backgroundColor: '#070C18',
        color: '#F3F6FB',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Falling Confetti for celebration */}
      {isCelebration && (
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1,
            opacity: 0.6,
          }}
        >
          {Array.from({ length: 60 }).map((_, i) => {
            const x = (i * 197) % 1920;
            const y = ((i * 73) % 200) + (i % 6) * 12;
            const r = (i * 31) % 180;
            const fill = i % 3 === 0 ? '#F2B705' : i % 2 === 0 ? '#00E58F' : '#FFFFFF';
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={8 + (i % 3) * 2}
                height={4 + (i % 2) * 2}
                fill={fill}
                transform={`rotate(${r} ${x} ${y})`}
              />
            );
          })}
        </svg>
      )}

      {/* Top Bar Broadcast Header */}
      <div
        style={{
          padding: '16px 36px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(10, 15, 28, 0.95)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span
            style={{
              background: '#F2B705',
              color: '#070C18',
              fontFamily: 'Barlow Condensed, sans-serif',
              fontWeight: 800,
              fontSize: '15px',
              padding: '4px 10px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            SEASON 2026/27
          </span>
          <span
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: '18px',
              letterSpacing: '0.04em',
              color: '#CBD5E1',
            }}
          >
            <strong style={{ color: '#FFFFFF' }}>{userClub.name}</strong> · the final whistle on
            your campaign
          </span>
        </div>

        {/* Step Bar */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            { id: 'table', label: 'Final Table' },
            { id: 'awards', label: 'Awards' },
            { id: 'numbers', label: 'In Numbers' },
            { id: 'verdict', label: 'The Verdict' },
            { id: 'share', label: 'Share Card' },
          ].map((s) => {
            const isCurrent = step === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setStep(s.id as StepKey)}
                style={{
                  padding: '6px 14px',
                  background: isCurrent ? '#F4F1EA' : 'rgba(255, 255, 255, 0.05)',
                  color: isCurrent ? '#070C18' : '#8E9AA8',
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontWeight: 700,
                  fontSize: '13px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '2px',
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '28px 40px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 5,
        }}
      >
        {/* STEP 1: Final Table */}
        {step === 'table' && (
          <div style={{ width: '100%', maxWidth: '960px' }}>
            <h2
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                fontSize: '32px',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <Trophy size={28} color="#F2B705" />
              Official Meridian League Table
            </h2>
            <div
              style={{
                background: 'rgba(13, 20, 36, 0.95)',
                border: '1px solid #1E293B',
                borderRadius: '8px',
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr
                    style={{
                      background: '#0A0F1D',
                      borderBottom: '1px solid #1E293B',
                      color: '#8E9AA8',
                      fontSize: '13px',
                      textTransform: 'uppercase',
                    }}
                  >
                    <th style={{ padding: '12px 16px' }}>Pos</th>
                    <th>Club</th>
                    <th style={{ textAlign: 'center' }}>P</th>
                    <th style={{ textAlign: 'center' }}>W</th>
                    <th style={{ textAlign: 'center' }}>D</th>
                    <th style={{ textAlign: 'center' }}>L</th>
                    <th style={{ textAlign: 'center' }}>GF</th>
                    <th style={{ textAlign: 'center' }}>GA</th>
                    <th style={{ textAlign: 'center' }}>GD</th>
                    <th style={{ textAlign: 'center', color: '#F3F6FB' }}>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((row, idx) => {
                    const isUser = row.clubId === userClub.id;
                    const club = effectiveState.clubs[row.clubId];
                    const isTop = idx === 0;
                    return (
                      <tr
                        key={row.clubId}
                        style={{
                          background: isUser
                            ? 'rgba(0, 229, 143, 0.12)'
                            : idx % 2 === 0
                              ? 'transparent'
                              : 'rgba(255, 255, 255, 0.02)',
                          borderLeft: isUser
                            ? '4px solid #00E58F'
                            : isTop
                              ? '4px solid #F2B705'
                              : '4px solid transparent',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          fontFamily: 'Barlow Condensed, sans-serif',
                          fontSize: '17px',
                          fontWeight: isUser ? 700 : 500,
                        }}
                      >
                        <td style={{ padding: '10px 16px', color: isTop ? '#F2B705' : '#8E9AA8' }}>
                          {idx + 1}
                        </td>
                        <td
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 0',
                          }}
                        >
                          <Crest clubId={row.clubId} size={24} />
                          <span>{club?.name ?? row.clubId}</span>
                          {isTop && (
                            <span
                              style={{
                                fontSize: '11px',
                                background: '#F2B705',
                                color: '#000',
                                padding: '1px 6px',
                                fontWeight: 800,
                              }}
                            >
                              CHAMPIONS
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', color: '#8E9AA8' }}>
                          {row.w + row.d + row.l}
                        </td>
                        <td style={{ textAlign: 'center' }}>{row.w}</td>
                        <td style={{ textAlign: 'center' }}>{row.d}</td>
                        <td style={{ textAlign: 'center' }}>{row.l}</td>
                        <td style={{ textAlign: 'center', color: '#8E9AA8' }}>{row.gf}</td>
                        <td style={{ textAlign: 'center', color: '#8E9AA8' }}>{row.ga}</td>
                        <td
                          style={{
                            textAlign: 'center',
                            color: row.gd >= 0 ? '#00E58F' : '#E53E3E',
                          }}
                        >
                          {row.gd >= 0 ? `+${row.gd}` : row.gd}
                        </td>
                        <td
                          style={{
                            textAlign: 'center',
                            fontWeight: 800,
                            color: '#F3F6FB',
                            fontSize: '19px',
                          }}
                        >
                          {row.pts}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setStep('awards')}
                style={{
                  padding: '12px 28px',
                  background: '#00E58F',
                  color: '#070C18',
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontWeight: 800,
                  fontSize: '18px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                Continue to Awards <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Honours & 4-3-3 Team of the Season */}
        {step === 'awards' && (
          <div style={{ width: '100%', maxWidth: '1020px' }}>
            <h2
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                fontSize: '32px',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <Award size={28} color="#00E58F" />
              Season Honours & Team of the Season
            </h2>

            {/* 5 Individual Awards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '12px',
                marginBottom: '24px',
              }}
            >
              {[
                { title: 'Player of Season', p: playerOfTheSeason, stat: '7.62 avg rating' },
                {
                  title: 'Golden Boot',
                  p: goldenBootPlayer,
                  stat: `${goldenBootPlayer?.stats.goals ?? 0} Goals`,
                },
                {
                  title: 'Playmaker',
                  p: playmakerPlayer,
                  stat: `${playmakerPlayer?.stats.assists ?? 0} Assists`,
                },
                { title: 'Golden Glove', p: goldenGlovePlayer, stat: 'Clean sheets leader' },
                { title: 'Young Player', p: youngPlayer, stat: 'Under 21 breakout' },
              ].map((aw, i) => {
                const isUserWinner = aw.p?.clubId === userClub.id;
                return (
                  <div
                    key={i}
                    style={{
                      background: 'rgba(13, 20, 36, 0.95)',
                      borderTop: `4px solid ${isUserWinner ? '#00E58F' : '#3B82F6'}`,
                      border: '1px solid #1E293B',
                      borderRadius: '6px',
                      padding: '14px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#8E9AA8',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                      }}
                    >
                      {aw.title}
                    </span>
                    <h3
                      style={{
                        margin: '6px 0 2px',
                        fontFamily: 'Barlow Condensed, sans-serif',
                        fontSize: '20px',
                        fontWeight: 700,
                        color: isUserWinner ? '#00E58F' : '#F3F6FB',
                      }}
                    >
                      {aw.p ? (aw.p.knownAs ?? aw.p.lastName) : '—'}
                    </h3>
                    <div style={{ fontSize: '12px', color: '#CBD5E1' }}>{aw.stat}</div>
                    {isUserWinner && (
                      <span
                        style={{
                          fontSize: '10px',
                          color: '#00E58F',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        ★ Your Player
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 4-3-3 Team of the Season Pitch */}
            <div
              style={{
                background: 'rgba(10, 15, 26, 0.95)',
                border: '1px solid #1E293B',
                borderRadius: '8px',
                padding: '20px',
              }}
            >
              <h4
                style={{
                  margin: '0 0 16px',
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontSize: '18px',
                  color: '#F2B705',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Meridian League Best XI (4-3-3 Formation)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                {awards.teamOfTheSeason.map((pid, idx) => {
                  const p = effectiveState.players[pid];
                  if (!p) return null;
                  const club = effectiveState.clubs[p.clubId ?? ''];
                  const isUser = p.clubId === userClub.id;
                  const avg =
                    p.stats.ratedApps > 0
                      ? (p.stats.ratingSum / p.stats.ratedApps).toFixed(2)
                      : '7.10';
                  return (
                    <div
                      key={`${pid}-${idx}`}
                      style={{
                        background: isUser ? 'rgba(0, 229, 143, 0.1)' : '#141D30',
                        border: isUser ? '1px solid #00E58F' : '1px solid #283750',
                        borderRadius: '6px',
                        padding: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <Crest clubId={p.clubId ?? ''} size={24} />
                      <div style={{ overflow: 'hidden' }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '14px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            color: isUser ? '#00E58F' : '#FFFFFF',
                          }}
                        >
                          {p.knownAs ?? p.lastName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#8E9AA8' }}>
                          {p.positions[0]?.pos ?? 'MF'} · {club?.code ?? ''} · Rating {avg}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setStep('numbers')}
                style={{
                  padding: '12px 28px',
                  background: '#00E58F',
                  color: '#070C18',
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontWeight: 800,
                  fontSize: '18px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                Continue to In Numbers <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Season in Numbers */}
        {step === 'numbers' && (
          <div style={{ width: '100%', maxWidth: '880px' }}>
            <h2
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                fontSize: '32px',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: '20px',
              }}
            >
              Your Season in Numbers
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
                background: 'rgba(13, 20, 36, 0.95)',
                border: '1px solid #1E293B',
                borderRadius: '8px',
                padding: '24px',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '12px',
                    color: '#8E9AA8',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                  }}
                >
                  Record
                </span>
                <div
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '42px',
                    fontWeight: 800,
                    color: '#F3F6FB',
                    margin: '4px 0',
                  }}
                >
                  W{userRow.w} D{userRow.d} L{userRow.l}
                </div>
                <div style={{ fontSize: '13px', color: '#00E58F' }}>
                  {userRow.pts} League Points
                </div>
              </div>

              <div>
                <span
                  style={{
                    fontSize: '12px',
                    color: '#8E9AA8',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                  }}
                >
                  Goals (F / A)
                </span>
                <div
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '42px',
                    fontWeight: 800,
                    color: '#F3F6FB',
                    margin: '4px 0',
                  }}
                >
                  {userRow.gf} – {userRow.ga}
                </div>
                <div style={{ fontSize: '13px', color: '#8E9AA8' }}>
                  Goal Diff: {userRow.gd >= 0 ? `+${userRow.gd}` : userRow.gd}
                </div>
              </div>

              <div>
                <span
                  style={{
                    fontSize: '12px',
                    color: '#8E9AA8',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                  }}
                >
                  Best Result
                </span>
                <div
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '28px',
                    fontWeight: 800,
                    color: '#F2B705',
                    margin: '8px 0',
                  }}
                >
                  {bestWinStr}
                </div>
              </div>

              <div>
                <span
                  style={{
                    fontSize: '12px',
                    color: '#8E9AA8',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                  }}
                >
                  Top Club Scorer
                </span>
                <div
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '32px',
                    fontWeight: 800,
                    color: '#F3F6FB',
                    margin: '4px 0',
                  }}
                >
                  {userTopScorer?.lastName ?? 'None'}
                </div>
                <div style={{ fontSize: '13px', color: '#00E58F' }}>
                  {userTopScorer?.stats.goals ?? 0} Goals this season
                </div>
              </div>

              <div>
                <span
                  style={{
                    fontSize: '12px',
                    color: '#8E9AA8',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                  }}
                >
                  Peak Home Attendance
                </span>
                <div
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '36px',
                    fontWeight: 800,
                    color: '#F3F6FB',
                    margin: '4px 0',
                  }}
                >
                  {biggestCrowd.toLocaleString()}
                </div>
                <div style={{ fontSize: '13px', color: '#8E9AA8' }}>at {userClub.stadium.name}</div>
              </div>

              <div>
                <span
                  style={{
                    fontSize: '12px',
                    color: '#8E9AA8',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                  }}
                >
                  Transfer Activity
                </span>
                <div
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '36px',
                    fontWeight: 800,
                    color: '#F3F6FB',
                    margin: '4px 0',
                  }}
                >
                  {signingsCount} Signings
                </div>
                <div style={{ fontSize: '13px', color: '#8E9AA8' }}>Squad renovated</div>
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setStep('verdict')}
                style={{
                  padding: '12px 28px',
                  background: '#00E58F',
                  color: '#070C18',
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontWeight: 800,
                  fontSize: '18px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                Continue to The Verdict <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: The Verdict (Souvenir Newspaper + Grade Stamp + Sparkline) */}
        {step === 'verdict' && (
          <div
            style={{
              display: 'flex',
              gap: '32px',
              width: '100%',
              maxWidth: '1200px',
              alignItems: 'flex-start',
            }}
          >
            {/* Left: Souvenir Newspaper tilted -1.4deg */}
            <div
              style={{
                width: '420px',
                minWidth: '420px',
                background: '#EDE8DC',
                color: '#141414',
                transform: 'rotate(-1.4deg)',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
                padding: '20px 24px',
                borderRadius: '2px',
                position: 'relative',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontWeight: 700,
                  fontSize: '12px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: '#A0221A',
                  borderBottom: '1px solid #141414',
                  paddingBottom: '4px',
                }}
              >
                <span>SOUVENIR EDITION</span>
                <span>SEASON 2026/27 PULL-OUT</span>
              </div>

              <div
                style={{
                  textAlign: 'center',
                  fontFamily: 'Georgia, serif',
                  fontWeight: 900,
                  fontSize: '38px',
                  margin: '8px 0 4px',
                  letterSpacing: '-0.02em',
                }}
              >
                The Local Gazette
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontWeight: 600,
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  color: '#3A3630',
                  borderTop: '3px double #141414',
                  borderBottom: '3px double #141414',
                  padding: '4px 0',
                  margin: '4px 0 12px',
                }}
              >
                <span>MONDAY 17 MAY 2027</span>
                <span>NO. 41,233</span>
                <span>SPECIAL COMMEMORATIVE ISSUE</span>
              </div>

              <h1
                style={{
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontWeight: 900,
                  fontSize: '48px',
                  lineHeight: 0.95,
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  margin: '8px 0',
                  whiteSpace: 'pre-line',
                }}
              >
                {paperHeadline}
              </h1>

              <div
                style={{
                  fontStyle: 'italic',
                  fontFamily: 'Georgia, serif',
                  fontSize: '15px',
                  lineHeight: 1.3,
                  textAlign: 'center',
                  margin: '10px 0',
                  color: '#2A2620',
                }}
              >
                {paperStandfirst}
              </div>

              {/* Halftone / Press Photo */}
              <div
                style={{
                  height: '180px',
                  background: '#D9D0BE',
                  border: '1px solid #141414',
                  margin: '12px 0 6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: '6px',
                  color: '#4A4640',
                }}
              >
                <Crest clubId={userClub.id} size={54} />
                <span
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontWeight: 700,
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {userClub.name} First Team Squad
                </span>
              </div>

              <div
                style={{
                  fontStyle: 'italic',
                  fontSize: '11px',
                  color: '#4A4640',
                  marginBottom: '10px',
                }}
              >
                <strong>Lap of honour:</strong> The squad and manager salute supporters at{' '}
                {userClub.stadium.name}.
              </div>

              <div
                style={{
                  fontSize: '11.5px',
                  lineHeight: 1.45,
                  textAlign: 'justify',
                  columnCount: 2,
                  columnGap: '14px',
                  fontFamily: 'Georgia, serif',
                }}
              >
                Nobody in town will soon forget this 2026/27 campaign. Under{' '}
                {effectiveState.managerName}, {userClub.name} fought bravely across 18 matchdays
                against elite competition. With {userTopScorer?.lastName ?? 'the squad'} delivering
                crucial moments in attack and resilient defending, the campaign proved a memorable
                chapter in the club's storied history.
              </div>
            </div>

            {/* Right: Board Verdict, Grade Stamp, Sparkline */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Hero Banner */}
              <div
                style={{
                  background: 'rgba(13, 20, 36, 0.95)',
                  border: '1px solid #1E293B',
                  borderLeft: '6px solid #F2B705',
                  borderRadius: '8px',
                  padding: '20px 28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: 'Barlow Condensed, sans-serif',
                      fontSize: '72px',
                      fontWeight: 900,
                      lineHeight: 1,
                      color: '#FFFFFF',
                    }}
                  >
                    {getOrdinal(userPosition)}
                  </div>
                  <div
                    style={{
                      fontFamily: 'Barlow Condensed, sans-serif',
                      fontSize: '24px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      color: '#F2B705',
                    }}
                  >
                    {userPosition === 1
                      ? 'CHAMPIONS'
                      : userPosition <= 3
                        ? 'PODIUM FINISH'
                        : 'MID-TABLE'}{' '}
                    · {userRow.pts} POINTS
                  </div>
                  <div style={{ fontSize: '14px', color: '#8E9AA8', marginTop: '4px' }}>
                    The board set a target of{' '}
                    <strong>{getOrdinal(userClub.expectation.target)}</strong> place.
                  </div>
                </div>

                {/* Circular Grade Stamp */}
                <div
                  style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '50%',
                    border: '5px solid #00E58F',
                    outline: '2px solid #00E58F',
                    outlineOffset: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: 'rotate(-8deg)',
                    boxShadow: '0 8px 24px rgba(0, 229, 143, 0.3)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Barlow Condensed, sans-serif',
                      fontSize: '64px',
                      fontWeight: 900,
                      color: '#00E58F',
                      lineHeight: 0.9,
                    }}
                  >
                    {grade}
                  </span>
                  <span
                    style={{
                      fontFamily: 'Barlow Condensed, sans-serif',
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '0.2em',
                      color: '#00E58F',
                    }}
                  >
                    GRADE
                  </span>
                </div>
              </div>

              {/* Board Verdict & Owner Statement */}
              <div
                style={{
                  background: 'rgba(13, 20, 36, 0.95)',
                  border: '1px solid #1E293B',
                  borderRadius: '8px',
                  padding: '20px 24px',
                }}
              >
                <div
                  style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '13px',
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: '#8E9AA8',
                    marginBottom: '10px',
                  }}
                >
                  THE BOARD'S STATEMENT
                </div>
                <blockquote
                  style={{
                    margin: 0,
                    fontStyle: 'italic',
                    fontFamily: 'Georgia, serif',
                    fontSize: '16px',
                    lineHeight: 1.45,
                    color: '#F3F6FB',
                  }}
                >
                  "{boardQuote}"
                </blockquote>
                <div
                  style={{
                    marginTop: '8px',
                    fontSize: '12px',
                    color: '#8E9AA8',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  — Board of Directors · {userClub.name}
                </div>

                {/* Meters */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '20px',
                    marginTop: '16px',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        marginBottom: '4px',
                      }}
                    >
                      <span style={{ color: '#8E9AA8' }}>Board Confidence</span>
                      <span style={{ color: '#00E58F' }}>
                        {Math.round(userClub.boardConfidence)}%
                      </span>
                    </div>
                    <div
                      style={{
                        height: '8px',
                        background: '#1E293B',
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(0, userClub.boardConfidence))}%`,
                          height: '100%',
                          background: '#00E58F',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        marginBottom: '4px',
                      }}
                    >
                      <span style={{ color: '#8E9AA8' }}>Fan Mood</span>
                      <span style={{ color: '#F2B705' }}>{Math.round(userClub.fanMood)}%</span>
                    </div>
                    <div
                      style={{
                        height: '8px',
                        background: '#1E293B',
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(0, userClub.fanMood))}%`,
                          height: '100%',
                          background: '#F2B705',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'flex-end',
                  marginTop: 'auto',
                }}
              >
                <button
                  onClick={() => setStep('share')}
                  style={{
                    padding: '12px 24px',
                    background: '#1E293B',
                    color: '#F3F6FB',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontWeight: 700,
                    fontSize: '16px',
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Download size={16} />
                  Download Share Card [D]
                </button>

                <button
                  onClick={() => setScreen('title')}
                  style={{
                    padding: '12px 24px',
                    background: '#1E293B',
                    color: '#8E9AA8',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontWeight: 700,
                    fontSize: '16px',
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Home size={16} />
                  Title Screen
                </button>

                <button
                  onClick={() => setScreen('newGame')}
                  style={{
                    padding: '12px 28px',
                    background: '#00E58F',
                    color: '#070C18',
                    border: 'none',
                    borderRadius: '4px',
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontWeight: 800,
                    fontSize: '18px',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <RotateCcw size={18} />
                  New Game
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Share Card */}
        {step === 'share' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
              width: '100%',
              maxWidth: '960px',
            }}
          >
            <h2
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                fontSize: '32px',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              Career Milestone Share Card (1200 × 630)
            </h2>

            {/* Generated Canvas */}
            <div
              style={{
                border: '2px solid #1E293B',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
              }}
            >
              <canvas
                ref={canvasRef}
                width={1200}
                height={630}
                style={{ width: '100%', maxWidth: '800px', display: 'block' }}
              />
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginTop: '10px' }}>
              <button
                onClick={handleDownloadShareCard}
                style={{
                  padding: '14px 28px',
                  background: '#00E58F',
                  color: '#070C18',
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontWeight: 800,
                  fontSize: '18px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <Download size={20} />
                Save PNG Image (HotKey D)
              </button>

              <button
                onClick={() => setScreen('newGame')}
                style={{
                  padding: '14px 24px',
                  background: '#1E293B',
                  color: '#F3F6FB',
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontWeight: 700,
                  fontSize: '16px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  border: '1px solid #334155',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Start New Career
              </button>

              <button
                onClick={() => setScreen('title')}
                style={{
                  padding: '14px 24px',
                  background: 'transparent',
                  color: '#8E9AA8',
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontWeight: 700,
                  fontSize: '16px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  border: '1px solid #1E293B',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Return to Title
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
