import { describe, expect, it } from 'vitest';
import { stepSpring, DEFAULT_SPRING_CONFIG } from '../../../src/ui/motion/spring';

describe('Spring physics solver', () => {
  it('converges to target value without exploding', () => {
    let state = { current: 0, target: 100, velocity: 0 };
    let done = false;
    let steps = 0;
    const dt = 1 / 60;

    while (!done && steps < 300) {
      const res = stepSpring(state, dt, DEFAULT_SPRING_CONFIG);
      state = res.state;
      done = res.done;
      steps++;
    }

    expect(done).toBe(true);
    expect(state.current).toBe(100);
    expect(state.velocity).toBe(0);
    expect(steps).toBeLessThan(120); // settles within 2 seconds
  });

  it('stops immediately when already at target and velocity is 0', () => {
    const state = { current: 50, target: 50, velocity: 0 };
    const res = stepSpring(state, 1 / 60, DEFAULT_SPRING_CONFIG);
    expect(res.done).toBe(true);
    expect(res.state.current).toBe(50);
  });
});
