// Implements SPEC §11.3 New Game screen
// Step 1: Carousel of 10 clubs, crest, name, nickname, stadium, stars, expectation, budget, difficulty. Squad preview on mini pitch.
// Step 2: Manager name (default "The Gaffer"), Tutorial toggle (default on).
// Step 3: Start -> startNewGame -> BoardMeeting.
import React, { useState, useEffect } from 'react';
import { useStore } from '../../state/store';
import WORLD_SNAPSHOT from '../../core/world/world.snapshot.json';
import { Club, Player } from '../../core/types';
import { Crest } from '../components/Crest';
import { Button } from '../components/Button';
import { KeyHint } from '../components/KeyHint';
import { formatMoney } from '../../core/math';
import { pickBestLineup } from '../../core/match/aiManager';
import { ChevronLeft, ChevronRight, Check, Star } from 'lucide-react';

const REPUTATION_DIFFICULTY: Record<number, string> = {
  5: 'Easy',
  4: 'Normal',
  3: 'Hard',
  2: 'Very Hard',
};

export const NewGameScreen: React.FC = () => {
  const startNewGame = useStore((state) => state.startNewGame);
  const setScreen = useStore((state) => state.setScreen);

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedClubIndex, setSelectedClubIndex] = useState(0);
  const [managerName, setManagerName] = useState('The Gaffer');
  const [tutorialEnabled, setTutorialEnabled] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  const clubs: Club[] = Object.values(WORLD_SNAPSHOT.clubs) as Club[];
  const currentClub = clubs[selectedClubIndex] ?? clubs[0]!;

  // Get current club players from snapshot
  const allPlayers = Object.values(WORLD_SNAPSHOT.players) as Player[];
  const clubPlayers: Player[] = allPlayers.filter((p) => p.clubId === currentClub.id);

  // Compute best XI for squad preview on mini pitch
  const bestLineup = pickBestLineup(
    clubPlayers.map((p) => ({ ...p, isInjured: false, isSuspended: false })),
    currentClub.style.formation,
    currentClub.formationFamiliarity,
  );

  const bestXIPlayers = bestLineup.lineup
    .map((id) => clubPlayers.find((p) => p.id === id))
    .filter((p): p is Player => p !== undefined);

  // Keyboard navigation: ArrowLeft/ArrowRight change club, Enter confirms
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        setSelectedClubIndex((prev) => (prev === 0 ? clubs.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight') {
        setSelectedClubIndex((prev) => (prev === clubs.length - 1 ? 0 : prev + 1));
      } else if (e.key === 'Enter') {
        if (step === 1) {
          setStep(2);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, clubs.length]);

  const handleStartGame = async () => {
    setIsStarting(true);
    await startNewGame({
      userClubId: currentClub.id,
      managerName: managerName.trim() || 'The Gaffer',
      tutorialEnabled: tutorialEnabled,
      seed: 4242,
    });
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: 'var(--bg)',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 24px',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          width: '100%',
          maxWidth: '1200px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}
      >
        <button
          onClick={() => {
            if (step === 2) setStep(1);
            else setScreen('title');
          }}
          style={{
            color: 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
          }}
        >
          <ChevronLeft size={18} /> Back
        </button>
        <div style={{ textAlign: 'center' }}>
          <h1
            style={{
              fontSize: '36px',
              letterSpacing: '0.04em',
              lineHeight: 1,
            }}
          >
            {step === 1 ? 'CHOOSE YOUR CLUB' : 'MANAGER PROFILE'}
          </h1>
          <div className="broadcast-label" style={{ color: 'var(--text-dim)', marginTop: '4px' }}>
            Step {step} of 2
          </div>
        </div>
        <div style={{ width: '80px' }} />
      </div>

      {step === 1 ? (
        /* Step 1: Choose Your Club Carousel */
        <div
          style={{
            width: '100%',
            maxWidth: '1200px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {/* Club Crest Carousel Selector Row (REVIEW M7) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              padding: '12px 0',
              backgroundColor: 'var(--surface-2)',
              borderRadius: 'var(--radius-m)',
              border: '1px solid var(--border)',
            }}
          >
            <button
              onClick={() =>
                setSelectedClubIndex((prev) => (prev === 0 ? clubs.length - 1 : prev - 1))
              }
              aria-label="Previous club (Left Arrow)"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: 'var(--radius-m)',
                backgroundColor: 'var(--surface-3)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text)',
                cursor: 'pointer',
                transition: 'background var(--dur-fast)',
              }}
            >
              <ChevronLeft size={22} />
            </button>

            {/* Crests Row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                overflowX: 'auto',
                padding: '6px 8px',
              }}
            >
              {clubs.map((c, idx) => {
                const isSelected = idx === selectedClubIndex;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedClubIndex(idx)}
                    title={c.name}
                    style={{
                      padding: isSelected ? '6px' : '4px',
                      borderRadius: 'var(--radius-s)',
                      backgroundColor: isSelected ? 'var(--surface-3)' : 'transparent',
                      border: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                      transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                      opacity: isSelected ? 1 : 0.55,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all var(--dur-fast)',
                      cursor: 'pointer',
                    }}
                  >
                    <Crest
                      clubId={c.id}
                      code={c.code}
                      primaryColor={c.colors.primary}
                      secondaryColor={c.colors.secondary}
                      size={isSelected ? 44 : 32}
                    />
                    <span
                      style={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-head)',
                        fontWeight: 700,
                        color: isSelected ? 'var(--accent-text)' : 'var(--text-faint)',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {c.code}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() =>
                setSelectedClubIndex((prev) => (prev === clubs.length - 1 ? 0 : prev + 1))
              }
              aria-label="Next club (Right Arrow)"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: 'var(--radius-m)',
                backgroundColor: 'var(--surface-3)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text)',
                cursor: 'pointer',
                transition: 'background var(--dur-fast)',
              }}
            >
              <ChevronRight size={22} />
            </button>
          </div>

          {/* Big Broadcast Card for Selected Club (REVIEW M7) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: '24px',
            }}
          >
            {/* Left Card: Dominant Broadcast Card */}
            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-m)',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                boxShadow: 'var(--shadow-1)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Skewed Accent stripe on top */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: `linear-gradient(90deg, ${currentClub.colors.primary} 0 65%, ${currentClub.colors.secondary} 65% 100%)`,
                }}
              />

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: '20px',
                }}
              >
                <Crest
                  clubId={currentClub.id}
                  code={currentClub.code}
                  primaryColor={currentClub.colors.primary}
                  secondaryColor={currentClub.colors.secondary}
                  size={84}
                />
                <div>
                  <h2
                    style={{
                      fontSize: '38px',
                      fontFamily: 'var(--font-head)',
                      margin: 0,
                      letterSpacing: '0.02em',
                      lineHeight: 1,
                    }}
                  >
                    {currentClub.name}
                  </h2>
                  <div
                    style={{
                      color: 'var(--text-dim)',
                      fontSize: '14px',
                      marginTop: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        padding: '2px 8px',
                        backgroundColor: 'var(--surface-3)',
                        borderRadius: '2px',
                        color: 'var(--accent-text)',
                        fontWeight: 600,
                        fontSize: '12px',
                      }}
                    >
                      {currentClub.nickname}
                    </span>
                    <span>Founded {currentClub.founded}</span>
                    <span>·</span>
                    <span>{currentClub.city}</span>
                  </div>
                </div>
              </div>

              {/* Attributes & Metrics */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                }}
              >
                <div>
                  <div
                    className="broadcast-label"
                    style={{ color: 'var(--text-dim)', fontSize: '11px' }}
                  >
                    Reputation & Difficulty
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '4px',
                      alignItems: 'center',
                      marginTop: '4px',
                    }}
                  >
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={18}
                        fill={s <= currentClub.reputation ? 'var(--gold)' : 'transparent'}
                        color={s <= currentClub.reputation ? 'var(--gold)' : 'var(--text-faint)'}
                      />
                    ))}
                    <span style={{ fontSize: '13px', marginLeft: '6px', color: 'var(--text-dim)' }}>
                      ({REPUTATION_DIFFICULTY[currentClub.reputation]} Difficulty)
                    </span>
                  </div>
                </div>

                <div>
                  <div
                    className="broadcast-label"
                    style={{ color: 'var(--text-dim)', fontSize: '11px' }}
                  >
                    Stadium & Capacity
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 600, marginTop: '4px' }}>
                    {currentClub.stadium.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
                    {currentClub.stadium.capacity.toLocaleString()} seats
                  </div>
                </div>

                <div>
                  <div
                    className="broadcast-label"
                    style={{ color: 'var(--text-dim)', fontSize: '11px' }}
                  >
                    Board Expectation
                  </div>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      marginTop: '4px',
                      color: 'var(--accent-text)',
                    }}
                  >
                    {currentClub.expectation.label}
                  </div>
                </div>

                <div>
                  <div
                    className="broadcast-label"
                    style={{ color: 'var(--text-dim)', fontSize: '11px' }}
                  >
                    Initial Transfer Budget
                  </div>
                  <div
                    className="stat-number tabular-nums"
                    style={{ fontSize: '20px', fontWeight: 700, marginTop: '2px' }}
                  >
                    {formatMoney(currentClub.transferBudget)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
                    Wage cap: {formatMoney(currentClub.wageBudget)}/wk
                  </div>
                </div>
              </div>

              {/* Mentality & Formation */}
              <div
                style={{
                  backgroundColor: 'var(--surface-2)',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-s)',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  className="broadcast-label"
                  style={{ color: 'var(--text-dim)', marginBottom: '4px' }}
                >
                  Tactical Identity
                </div>
                <div style={{ fontSize: '14px' }}>
                  Plays {currentClub.style.formation} with{' '}
                  {currentClub.style.mentality.toLowerCase()} mentality,{' '}
                  {currentClub.style.passing.toLowerCase()} passing, and{' '}
                  {currentClub.style.pressing.toLowerCase()} pressing.
                </div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                <Button
                  variant="primary"
                  size="l"
                  onClick={() => setStep(2)}
                  style={{ width: '100%' }}
                >
                  Select Club <KeyHint hint="Enter" />
                </Button>
              </div>
            </div>

            {/* Right Card: Squad Preview on Mini Pitch */}
            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-m)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: 'var(--shadow-1)',
              }}
            >
              <div
                className="broadcast-label"
                style={{
                  color: 'var(--text-dim)',
                  marginBottom: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>Projected Best XI ({currentClub.style.formation})</span>
                <span>{clubPlayers.length} in Squad</span>
              </div>

              {/* Mini Pitch Area */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: '#1E4522',
                  border: '2px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 'var(--radius-s)',
                  position: 'relative',
                  overflow: 'hidden',
                  minHeight: '340px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '16px',
                }}
              >
                {/* SVG Pitch Markings */}
                <svg
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0.25,
                    pointerEvents: 'none',
                  }}
                  viewBox="0 0 100 140"
                  preserveAspectRatio="none"
                >
                  <line x1="0" y1="70" x2="100" y2="70" stroke="#FFF" strokeWidth="1" />
                  <circle cx="50" cy="70" r="15" fill="none" stroke="#FFF" strokeWidth="1" />
                  <rect
                    x="20"
                    y="115"
                    width="60"
                    height="25"
                    fill="none"
                    stroke="#FFF"
                    strokeWidth="1"
                  />
                  <rect
                    x="20"
                    y="0"
                    width="60"
                    height="25"
                    fill="none"
                    stroke="#FFF"
                    strokeWidth="1"
                  />
                </svg>

                {/* Starters list representation */}
                <div
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                  }}
                >
                  {bestXIPlayers.map((player) => (
                    <div
                      key={player.id}
                      style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.65)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: 'var(--radius-s)',
                        padding: '4px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          color: currentClub.colors.primary,
                        }}
                      >
                        {player.positions[0]?.pos}
                      </span>
                      <span style={{ color: '#FFFFFF', fontWeight: 500 }}>
                        {player.knownAs ?? player.lastName}
                      </span>
                      <span
                        className="tabular-nums"
                        style={{
                          backgroundColor: 'var(--accent)',
                          color: 'var(--accent-ink)',
                          padding: '1px 4px',
                          borderRadius: '2px',
                          fontWeight: 700,
                          fontSize: '11px',
                        }}
                      >
                        {player.attributes.passing > 70
                          ? 75
                          : player.attributes.finishing > 70
                            ? 74
                            : 70}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Step 2: Manager Profile & Options */
        <div
          style={{
            width: '100%',
            maxWidth: '600px',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-m)',
            padding: '32px',
            boxShadow: 'var(--shadow-1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {/* Club badge recap */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              borderBottom: '1px solid var(--border)',
              paddingBottom: '20px',
            }}
          >
            <Crest
              clubId={currentClub.id}
              code={currentClub.code}
              primaryColor={currentClub.colors.primary}
              secondaryColor={currentClub.colors.secondary}
              size={48}
            />
            <div>
              <div className="broadcast-label" style={{ color: 'var(--accent-text)' }}>
                Appointed Manager
              </div>
              <h2
                style={{
                  fontSize: '24px',
                  fontFamily: 'var(--font-head)',
                  margin: 0,
                }}
              >
                {currentClub.name}
              </h2>
            </div>
          </div>

          {/* Name input */}
          <div>
            <label
              htmlFor="manager-name"
              className="broadcast-label"
              style={{
                display: 'block',
                color: 'var(--text-dim)',
                marginBottom: '8px',
              }}
            >
              Manager Name
            </label>
            <input
              id="manager-name"
              type="text"
              maxLength={24}
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              placeholder="The Gaffer"
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-s)',
                color: 'var(--text)',
                fontSize: '16px',
                fontFamily: 'var(--font-body)',
              }}
            />
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-faint)',
                marginTop: '4px',
              }}
            >
              Default: The Gaffer. Shown in press conferences and news reports.
            </div>
          </div>

          {/* Tutorial Toggle */}
          <div
            onClick={() => setTutorialEnabled(!tutorialEnabled)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px',
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-s)',
              cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px' }}>Show In-Game Guidance</div>
              <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                Assistant manager coach-marks highlighting key controls and systems.
              </div>
            </div>
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                backgroundColor: tutorialEnabled ? 'var(--accent)' : 'transparent',
                border: `2px solid ${tutorialEnabled ? 'var(--accent)' : 'var(--text-dim)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-ink)',
              }}
            >
              {tutorialEnabled && <Check size={16} strokeWidth={3} />}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
            <Button variant="secondary" size="l" onClick={() => setStep(1)} style={{ flex: 1 }}>
              Back
            </Button>
            <Button
              variant="primary"
              size="l"
              loading={isStarting}
              onClick={handleStartGame}
              style={{ flex: 2 }}
            >
              Take Charge <KeyHint hint="Enter" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
