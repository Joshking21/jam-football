// §14.12.8: the launch solver must hit its target within 0.4 m for passes, lofted balls and shots.
import { describe, it, expect } from 'vitest';
import { solveLaunch, simulateFlight, airAccel, BALL } from '../../src/physics/ballFlight';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('Ball flight (§14.12.2)', () => {
  it('drag slows a struck ball and the drag crisis applies above 12 m/s', () => {
    const a = { x: 0, y: 0, z: 0 };
    airAccel({ x: 25, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, a);
    expect(a.x).toBeLessThan(-5);
    const slow = { x: 0, y: 0, z: 0 };
    airAccel({ x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, slow);
    // Slow balls have a higher drag coefficient (per unit speed squared).
    expect(-slow.x / 100).toBeGreaterThan(-a.x / 625);
  });

  it('sidespin curls the ball', () => {
    const straight = simulateFlight(
      { x: 0, y: 0.11, z: 0 },
      { x: 25, y: 3, z: 0 },
      { x: 0, y: 0, z: 0 },
      1,
    );
    const curled = simulateFlight(
      { x: 0, y: 0.11, z: 0 },
      { x: 25, y: 3, z: 0 },
      { x: 0, y: 35, z: 0 },
      1,
    );
    expect(Math.abs(curled.z - straight.z)).toBeGreaterThan(0.8);
  });

  it('hits 300 random targets within 0.4 m', () => {
    const r = rng(42);
    let worst = 0;
    for (let i = 0; i < 300; i++) {
      const kind = i % 3; // 0 ground pass, 1 lofted, 2 shot
      const p0 = { x: (r() - 0.5) * 90, y: BALL.radius, z: (r() - 0.5) * 60 };
      const dist = kind === 1 ? 20 + r() * 40 : kind === 2 ? 8 + r() * 25 : 5 + r() * 25;
      const ang = r() * Math.PI * 2;
      const target = {
        x: p0.x + Math.cos(ang) * dist,
        y: kind === 2 ? 0.2 + r() * 2.2 : BALL.radius,
        z: p0.z + Math.sin(ang) * dist,
      };
      // Flight times as the director plans them (§14.3 v1.8).
      const T =
        kind === 1 ? dist / (18 + dist * 0.06) : dist / (kind === 2 ? 24 : 11 + dist * 0.12);
      const spin = { x: 0, y: kind === 2 ? (r() - 0.5) * 60 : 0, z: 0 };
      const { miss } = solveLaunch(p0, target, spin, T);
      worst = Math.max(worst, miss);
    }
    expect(worst).toBeLessThan(0.4);
  });
});
