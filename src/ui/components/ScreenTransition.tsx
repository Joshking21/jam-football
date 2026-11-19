// Implements SPEC §19.7 Screen transitions:
// On air → on air: stinger wipe
// On air ↔ office: camera cut
// Office → office: across the desk
// Reduce motion: 150ms crossfade
import React, { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../state/store';

export type ScreenWorld = 'on-air' | 'office';

export const ON_AIR_SCREENS = new Set([
  'title',
  'hub',
  'league',
  'fixtures',
  'preMatch',
  'match',
  'halfTime',
  'postMatch',
  'weekSummary',
  'pressConference',
  'seasonEnd',
  'sacked',
  'newGame',
  'devGallery',
]);

export function getScreenWorld(screen: string): ScreenWorld {
  return ON_AIR_SCREENS.has(screen) ? 'on-air' : 'office';
}

interface ScreenTransitionProps {
  currentScreen: string;
  children: React.ReactNode;
}

export const ScreenTransition: React.FC<ScreenTransitionProps> = ({ currentScreen, children }) => {
  const settings = useSettings();
  const reduceMotion = settings.reduceMotion;

  const [activeScreen, setActiveScreen] = useState(currentScreen);
  const [displayedChildren, setDisplayedChildren] = useState(children);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionType, setTransitionType] = useState<
    'stinger' | 'camera-cut' | 'desk-slide' | 'fade'
  >('stinger');
  const [cutSlateText, setCutSlateText] = useState<string>('');
  const [phase, setPhase] = useState<'enter' | 'swap' | 'exit'>('enter');

  const prevScreenRef = useRef(currentScreen);
  const timeoutIdsRef = useRef<number[]>([]);

  const clearAllTimeouts = () => {
    timeoutIdsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutIdsRef.current = [];
  };

  const finishImmediately = () => {
    clearAllTimeouts();
    setTransitioning(false);
    setActiveScreen(currentScreen);
    setDisplayedChildren(children);
    prevScreenRef.current = currentScreen;
  };

  useEffect(() => {
    if (currentScreen === prevScreenRef.current) {
      setDisplayedChildren(children);
      return;
    }

    const prevScreen = prevScreenRef.current;
    const prevWorld = getScreenWorld(prevScreen);
    const nextWorld = getScreenWorld(currentScreen);

    clearAllTimeouts();

    if (reduceMotion) {
      setTransitionType('fade');
      setTransitioning(true);
      setPhase('swap');
      const t1 = window.setTimeout(() => {
        setActiveScreen(currentScreen);
        setDisplayedChildren(children);
        const t2 = window.setTimeout(() => {
          setTransitioning(false);
          prevScreenRef.current = currentScreen;
        }, 150);
        timeoutIdsRef.current.push(t2);
      }, 75);
      timeoutIdsRef.current.push(t1);
      return;
    }

    if (prevWorld === 'on-air' && nextWorld === 'on-air') {
      // 1. Stinger wipe
      setTransitionType('stinger');
      setTransitioning(true);
      setPhase('enter');

      // Wipe bands take --dur-wipe (440ms). Screen swaps when bands reach middle (~200ms)
      const tSwap = window.setTimeout(() => {
        setActiveScreen(currentScreen);
        setDisplayedChildren(children);
        setPhase('swap');
      }, 200);

      const tEnd = window.setTimeout(() => {
        setTransitioning(false);
        prevScreenRef.current = currentScreen;
      }, 440);

      timeoutIdsRef.current.push(tSwap, tEnd);
    } else if (prevWorld !== nextWorld) {
      // 2. Camera cut
      setTransitionType('camera-cut');
      setCutSlateText(nextWorld === 'office' ? 'THE OFFICE' : 'ON AIR');
      setTransitioning(true);
      setPhase('enter'); // dip to black (90ms)

      const tSlate = window.setTimeout(() => {
        setPhase('swap'); // show slate label for ~300ms
        setActiveScreen(currentScreen);
        setDisplayedChildren(children);
      }, 90);

      const tEnd = window.setTimeout(() => {
        setTransitioning(false);
        prevScreenRef.current = currentScreen;
      }, 390);

      timeoutIdsRef.current.push(tSlate, tEnd);
    } else {
      // 3. Office -> office: across the desk
      setTransitionType('desk-slide');
      setTransitioning(true);
      setPhase('enter');

      const tSwap = window.setTimeout(() => {
        setActiveScreen(currentScreen);
        setDisplayedChildren(children);
        setPhase('swap');
      }, 100);

      const tEnd = window.setTimeout(() => {
        setTransitioning(false);
        prevScreenRef.current = currentScreen;
      }, 260);

      timeoutIdsRef.current.push(tSwap, tEnd);
    }

    return () => {
      clearAllTimeouts();
    };
  }, [currentScreen, children, reduceMotion]);

  // Space or click during a transition finishes it at once (SPEC §19.7)
  const handleContainerClick = () => {
    if (transitioning) {
      finishImmediately();
    }
  };

  return (
    <div
      className={`screen-transition-container world-${getScreenWorld(activeScreen)}`}
      onClick={handleContainerClick}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        className={`screen-content ${transitioning ? `trans-${transitionType}-${phase}` : ''}`}
        style={{
          width: '100%',
          height: '100%',
          opacity: transitioning && transitionType === 'fade' ? (phase === 'swap' ? 0 : 1) : 1,
          transition: transitionType === 'fade' ? 'opacity 150ms ease-out' : undefined,
        }}
      >
        {displayedChildren}
      </div>

      {/* Stinger Wipe Bands (SPEC §19.7: two parallel bands skewed -12°, band-2 leading by 40ms, then band-1) */}
      {transitioning && transitionType === 'stinger' && (
        <div
          className="stinger-wipe-overlay"
          style={{
            position: 'absolute',
            inset: '-20% -40%',
            pointerEvents: 'none',
            zIndex: 100,
            transform: 'skewX(-12deg)',
            display: 'flex',
            flexDirection: 'row',
          }}
        >
          <div
            className="stinger-band-2"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '120%',
              background: 'var(--band-2)',
              animation: 'wipe-sweep 440ms cubic-bezier(0.2, 0.9, 0.1, 1)',
            }}
          />
          <div
            className="stinger-band-1"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '120%',
              background: 'var(--band-1)',
              animation: 'wipe-sweep 440ms cubic-bezier(0.2, 0.9, 0.1, 1) 40ms both',
            }}
          />
        </div>
      )}

      {/* Camera Cut Slate (SPEC §19.7: black dip + slate label for 300ms) */}
      {transitioning && transitionType === 'camera-cut' && (
        <div
          className="camera-cut-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            background: '#000000',
            zIndex: 100,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            padding: '32px',
          }}
        >
          {phase === 'swap' && (
            <span
              className="broadcast-label"
              style={{
                color: 'var(--accent-text)',
                fontSize: '14px',
                letterSpacing: '0.08em',
              }}
            >
              {cutSlateText}
            </span>
          )}
        </div>
      )}

      <style>{`
        @keyframes wipe-sweep {
          0% {
            transform: translateX(-110%);
          }
          100% {
            transform: translateX(110%);
          }
        }
        .trans-desk-slide-enter {
          transform: translateX(-32px);
          opacity: 0.7;
          transition: transform var(--dur-fast) var(--ease-snap), opacity var(--dur-fast);
        }
        .trans-desk-slide-swap {
          transform: translateX(0);
          opacity: 1;
          transition: transform var(--dur-fast) var(--ease-snap), opacity var(--dur-fast);
        }
      `}</style>
    </div>
  );
};
