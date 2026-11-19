// Implements SPEC §11.9 Training screen (office world)
// Team focus (6 options), intensity (Light/Normal/Hard), individual focus overview.
import React from 'react';
import { useStore } from '../../state/store';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
import { Dumbbell, Shield, Zap, Target, Activity, Flame } from 'lucide-react';
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
    desc: string;
    icon: React.ReactNode;
  }[] = [
    {
      name: 'Balanced',
      desc: 'All-round training across technical, physical and mental attributes.',
      icon: <Activity size={20} />,
    },
    {
      name: 'Attacking',
      desc: 'Focus on finishing, crossing, off-the-ball movement and shot volume.',
      icon: <Target size={20} />,
    },
    {
      name: 'Defending',
      desc: 'Focus on tackling, positioning, defensive line cohesion and clearances.',
      icon: <Shield size={20} />,
    },
    {
      name: 'Fitness',
      desc: 'Stamina and physical conditioning. Speeds up condition recovery.',
      icon: <Zap size={20} />,
    },
    {
      name: 'SetPieces',
      desc: 'Corner routines, free kicks, penalties and aerial deliveries.',
      icon: <Flame size={20} />,
    },
    {
      name: 'Tactical',
      desc: 'Accelerates formation familiarity and pressing synchronization.',
      icon: <Dumbbell size={20} />,
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
          gap: '20px',
        }}
      >
        <Sheet id="training-clipboard" variant="clipboard">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '2px solid var(--paper-rule)',
                paddingBottom: '12px',
              }}
            >
              <div>
                <h1
                  style={{
                    fontSize: '28px',
                    fontFamily: 'var(--font-head)',
                    color: 'var(--paper-ink)',
                    margin: 0,
                  }}
                >
                  TRAINING GROUND SCHEDULE
                </h1>
                <div
                  className="broadcast-label"
                  style={{ color: 'var(--paper-dim)', marginTop: '2px' }}
                >
                  Weekly regime preparation for Matchday {gameState.matchday}
                </div>
              </div>
            </div>

            {/* Intensity segmented control */}
            <div>
              <div
                className="broadcast-label"
                style={{ color: 'var(--paper-dim)', marginBottom: '8px' }}
              >
                TRAINING INTENSITY
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['Light', 'Normal', 'Hard'] as TrainingPlan['intensity'][]).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => handleIntensitySelect(lvl)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor:
                        plan.intensity === lvl ? 'var(--paper-ink)' : 'var(--paper-2)',
                      color: plan.intensity === lvl ? 'var(--paper)' : 'var(--paper-ink)',
                      border: '1px solid var(--paper-rule)',
                      borderRadius: '3px',
                      fontFamily: 'var(--font-head)',
                      fontWeight: 700,
                      fontSize: '16px',
                      cursor: 'pointer',
                    }}
                  >
                    {lvl.toUpperCase()} INTENSITY
                  </button>
                ))}
              </div>
            </div>

            {/* Team Focus Cards */}
            <div>
              <div
                className="broadcast-label"
                style={{ color: 'var(--paper-dim)', marginBottom: '8px' }}
              >
                WEEKLY TEAM FOCUS
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                }}
              >
                {foci.map((f) => {
                  const isSelected = plan.focus === f.name;
                  return (
                    <div
                      key={f.name}
                      onClick={() => handleFocusSelect(f.name)}
                      style={{
                        padding: '16px',
                        borderRadius: '4px',
                        backgroundColor: isSelected ? 'var(--paper-ink)' : 'var(--paper-2)',
                        color: isSelected ? 'var(--paper)' : 'var(--paper-ink)',
                        border: '1px solid var(--paper-rule)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontWeight: 700,
                          fontSize: '16px',
                          fontFamily: 'var(--font-head)',
                        }}
                      >
                        {f.icon}
                        <span>{f.name.toUpperCase()}</span>
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          opacity: isSelected ? 0.85 : 0.7,
                          lineHeight: '1.4',
                        }}
                      >
                        {f.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Sheet>
      </div>
    </div>
  );
};
