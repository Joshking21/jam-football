// Implements SPEC §19.7 Spring physics solver:
// stiffness 420, damping 34, mass 1; stops when velocity < 0.01 and distance < 0.5 px.
import { useEffect, useRef, useState } from 'react';

export interface SpringConfig {
  stiffness?: number;
  damping?: number;
  mass?: number;
  velocityThreshold?: number;
  distanceThreshold?: number;
}

export const DEFAULT_SPRING_CONFIG: Required<SpringConfig> = {
  stiffness: 420,
  damping: 34,
  mass: 1,
  velocityThreshold: 0.01,
  distanceThreshold: 0.5,
};

export interface SpringState {
  current: number;
  target: number;
  velocity: number;
}

export function stepSpring(
  state: SpringState,
  dt: number,
  config: Required<SpringConfig> = DEFAULT_SPRING_CONFIG,
): { state: SpringState; done: boolean } {
  // Spring equation: F = -k * (x - target) - c * v
  // a = F / m
  const displacement = state.current - state.target;
  const springForce = -config.stiffness * displacement;
  const dampingForce = -config.damping * state.velocity;
  const acceleration = (springForce + dampingForce) / config.mass;

  const nextVelocity = state.velocity + acceleration * dt;
  const nextCurrent = state.current + nextVelocity * dt;

  const dist = Math.abs(nextCurrent - state.target);
  const vel = Math.abs(nextVelocity);

  if (vel < config.velocityThreshold && dist < config.distanceThreshold) {
    return {
      state: {
        current: state.target,
        target: state.target,
        velocity: 0,
      },
      done: true,
    };
  }

  return {
    state: {
      current: nextCurrent,
      target: state.target,
      velocity: nextVelocity,
    },
    done: false,
  };
}

/**
 * React hook to animate a value with the specification spring
 */
export function useSpring(
  targetValue: number,
  config: SpringConfig = {},
  immediate = false,
): number {
  const fullConfig: Required<SpringConfig> = {
    ...DEFAULT_SPRING_CONFIG,
    ...config,
  };

  const [current, setCurrent] = useState(targetValue);
  const stateRef = useRef<SpringState>({
    current: targetValue,
    target: targetValue,
    velocity: 0,
  });

  stateRef.current.target = targetValue;

  useEffect(() => {
    if (immediate) {
      stateRef.current.current = targetValue;
      stateRef.current.velocity = 0;
      setCurrent(targetValue);
      return;
    }

    let lastTime = performance.now();
    let animId: number;

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.064); // clamp to avoid huge jumps
      lastTime = now;

      const { state, done } = stepSpring(stateRef.current, dt, fullConfig);
      stateRef.current = state;
      setCurrent(state.current);

      if (!done) {
        animId = requestAnimationFrame(tick);
      }
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [targetValue, immediate]);

  return current;
}
