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
          {/* Carousel Selector Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '8px 0',
            }}
          >
            <button
              onClick={() =>
                setSelectedClubIndex((prev) => (prev === 0 ? clubs.length - 1 : prev - 1))
              }
              aria-label="Previous club"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-m)',
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text)',
              }}
            >
              <ChevronLeft size={20} />
            </button>

            <div
              style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                padding: '4px',
              }}
            >
              {clubs.map((c, idx) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedClubIndex(idx)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-s)',
                    backgroundColor: idx === selectedClubIndex ? 'var(--accent)' : 'var(--surface)',
                    color: idx === selectedClubIndex ? 'var(--accent-ink)' : 'var(--text-dim)',
                    border: `1px solid ${idx === selectedClubIndex ? 'var(--accent)' : 'var(--border)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-head)',
                    fontSize: '14px',
                    transition: 'all var(--dur-fast)',
                  }}
                >
                  <Crest
                    clubId={c.id}
                    code={c.code}
                    primaryColor={c.colors.primary}
                    secondaryColor={c.colors.secondary}
                    size={20}
                  />
                  {c.shortName}
                </button>
              ))}
            </div>

            <button
              onClick={() =>
                setSelectedClubIndex((prev) => (prev === clubs.length - 1 ? 0 : prev + 1))
              }
              aria-label="Next club"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-m)',
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text)',
              }}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Club Details Grid: Left Card & Right Squad Preview */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '24px',
            }}
          >
            {/* Left Card: Club Information */}
            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-m)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: 'var(--shadow-1)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: '20px',
                }}
              >
                <Crest
                  clubId={currentClub.id}
                  code={currentClub.code}
                  primaryColor={currentClub.colors.primary}
                  secondaryColor={currentClub.colors.secondary}
                  size={64}
                />
                <div>
                  <h2
                    style={{
                      fontSize: '32px',
                      fontFamily: 'var(--font-head)',
                      margin: 0,
                    }}
                  >
                    {currentClub.name}
                  </h2>
                  <div style={{ color: 'var(--text-dim)', fontSize: '14px' }}>
                    {currentClub.nickname} · Founded {currentClub.founded} · {currentClub.city}
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
                  <div className="broadcast-label" style={{ color: 'var(--text-dim)' }}>
                    Reputation
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
                        size={16}
                        fill={s <= currentClub.reputation ? 'var(--gold)' : 'transparent'}
                        color={s <= currentClub.reputation ? 'var(--gold)' : 'var(--text-faint)'}
                      />
                    ))}
                    <span
                      style={{
                        marginLeft: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-dim)',
                      }}
                    >
                      ({REPUTATION_DIFFICULTY[currentClub.reputation]} difficulty)
                    </span>
                  </div>
                </div>

                <div>
                  <div className="broadcast-label" style={{ color: 'var(--text-dim)' }}>
                    Stadium
                  </div>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      marginTop: '4px',
                    }}
                  >
                    {currentClub.stadium.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
                    {currentClub.stadium.capacity.toLocaleString()} capacity
                  </div>
                </div>

                <div>
                  <div className="broadcast-label" style={{ color: 'var(--text-dim)' }}>
                    Board Expectation
                  </div>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      marginTop: '4px',
                      color: 'var(--accent-text)',
                    }}
                  >
                    {currentClub.expectation.label}
                  </div>
                </div>

                <div>
                  <div className="broadcast-label" style={{ color: 'var(--text-dim)' }}>
                    Transfer Budget
                  </div>
                  <div
                    className="stat-number"
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      marginTop: '4px',
                    }}
                  >
                    {formatMoney(currentClub.transferBudget)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
                    Wage bill: {formatMoney(currentClub.wageBudget)}/wk
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
