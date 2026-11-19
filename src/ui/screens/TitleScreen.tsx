// Implements SPEC §11.2 Title screen
import React, { useEffect, useState } from 'react';
import { useStore } from '@/state/store';
import { Button } from '@/ui/components/Button';
import { GAME_TITLE, GAME_SUBTITLE } from '@/config/constants';
import { assetUrl } from '@/assets/registry';
import { Play, RotateCcw, Settings, Award, FolderOpen } from 'lucide-react';

export const TitleScreen: React.FC = () => {
  const setScreen = useStore((state) => state.setScreen);
  const openSettings = useStore((state) => state.openSettings);
  const openCredits = useStore((state) => state.openCredits);
  const hasAutosave = useStore((state) => state.hasAutosave);
  const autosaveMeta = useStore((state) => state.autosaveMeta);
  const checkAutosave = useStore((state) => state.checkAutosave);
  const continueAutosave = useStore((state) => state.continueAutosave);
  const showToast = useStore((state) => state.showToast);

  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    checkAutosave();
  }, [checkAutosave]);

  const titleBgUrl = assetUrl('images/ui/title_bg.webp');

  const handleContinue = async () => {
    const success = await continueAutosave();
    if (!success) {
      showToast('Could not resume autosave.', 'error');
    }
  };

  const handleUserFirstGesture = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
      // Audio engine will hook here when audio assets are loaded
    }
  };

  return (
    <div
      onClick={handleUserFirstGesture}
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: titleBgUrl
          ? `radial-gradient(circle at 50% 50%, rgba(7, 12, 24, 0.4) 0%, #070C18 90%), url(${titleBgUrl}) center/cover no-repeat`
          : 'radial-gradient(circle at 50% 45%, #16213A 0%, #070C18 80%)',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Procedural Animated Pitch Lines Background (SPEC §11.2 fallback) */}
      {!titleBgUrl && (
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0.12,
            pointerEvents: 'none',
          }}
          viewBox="0 0 1000 600"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Halfway line & Center Circle */}
          <line x1="500" y1="0" x2="500" y2="600" stroke="#FFFFFF" strokeWidth="2" />
          <circle cx="500" cy="300" r="100" fill="none" stroke="#FFFFFF" strokeWidth="2" />
          <circle cx="500" cy="300" r="4" fill="#FFFFFF" />
          {/* Penalty boxes */}
          <rect
            x="0"
            y="160"
            width="160"
            height="280"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2"
          />
          <rect
            x="840"
            y="160"
            width="160"
            height="280"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2"
          />
          <rect
            x="0"
            y="220"
            width="60"
            height="160"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2"
          />
          <rect
            x="940"
            y="220"
            width="60"
            height="160"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2"
          />
        </svg>
      )}

      {/* Main Title Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 10,
          maxWidth: '600px',
          width: '100%',
          padding: '0 24px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1
            style={{
              fontFamily: 'var(--font-head)',
              fontWeight: 700,
              fontSize: '96px',
              letterSpacing: '0.06em',
              lineHeight: 1,
              color: '#F3F6FB',
              textShadow: '0 4px 20px rgba(0, 0, 0, 0.7)',
              margin: 0,
            }}
          >
            {GAME_TITLE}
          </h1>
          <div
            style={{
              fontFamily: 'var(--font-head)',
              fontSize: '18px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              marginTop: '8px',
              fontWeight: 600,
            }}
          >
            {GAME_SUBTITLE}
          </div>
        </div>

        {/* Action Menu */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            width: '100%',
            maxWidth: '340px',
          }}
        >
          {hasAutosave && autosaveMeta && (
            <Button
              variant="primary"
              size="l"
              onClick={handleContinue}
              icon={<RotateCcw size={20} />}
              style={{ width: '100%' }}
            >
              Continue ({autosaveMeta.clubName} · MD {autosaveMeta.matchday})
            </Button>
          )}

          <Button
            variant={hasAutosave ? 'secondary' : 'primary'}
            size="l"
            onClick={() => setScreen('newGame')}
            icon={<Play size={20} />}
            style={{ width: '100%' }}
          >
            New Game
          </Button>

          <Button
            variant="secondary"
            size="m"
            onClick={openSettings}
            icon={<Settings size={18} />}
            style={{ width: '100%' }}
          >
            Settings
          </Button>

          <Button
            variant="secondary"
            size="m"
            onClick={openCredits}
            icon={<Award size={18} />}
            style={{ width: '100%' }}
          >
            Credits
          </Button>

          {/* Dev-only quick jump button */}
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <button
              onClick={() => setScreen('devGallery')}
              style={{
                fontSize: '12px',
                color: 'var(--text-faint)',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              Dev Asset Gallery (?dev=gallery)
            </button>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <footer
        style={{
          position: 'absolute',
          bottom: '24px',
          color: 'var(--text-faint)',
          fontSize: '12px',
          textAlign: 'center',
          letterSpacing: '0.04em',
        }}
      >
        Desktop · Mouse & Keyboard · OpenGame Jam #1
      </footer>
    </div>
  );
};
