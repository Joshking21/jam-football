// §14.12.2 Ball flight model and launch solver (pure maths, no Rapier, unit-tested).
// The live ball is a Rapier body; these same forces are applied to it every step, and the solver
// finds the kick (velocity) that makes the simulated flight land on the sim's target on time.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const BALL = {
  radius: 0.11,
  mass: 0.43,
  area: 0.038, // m², cross-section
  rho: 1.2, // air density
  cdFast: 0.25, // drag coefficient above the drag crisis (struck balls dip late)
  cdSlow: 0.45,
  crisis: 12, // m/s
  magnus: 0.0028, // F = k (ω × v)
  gravity: 9.81,
  rollDecelDry: 0.55,
  rollDecelWet: 0.4,
  spinDecay: 1.5, // 1/s on the grass
} as const;

/** Acceleration on the ball from air drag and Magnus at velocity v with spin w (m/s², rad/s). */
export function airAccel(v: Vec3, w: Vec3, out: Vec3): Vec3 {
  const speed = Math.hypot(v.x, v.y, v.z);
  // Smooth drag crisis around 12 m/s (a hard step makes flights jumpy and the solver unstable).
  const k = Math.min(1, Math.max(0, (speed - (BALL.crisis - 2)) / 4));
  const cd = BALL.cdSlow + (BALL.cdFast - BALL.cdSlow) * k * k * (3 - 2 * k);
  const kd = (0.5 * BALL.rho * cd * BALL.area) / BALL.mass;
  const km = BALL.magnus / BALL.mass;
  // ω × v
  const cx = w.y * v.z - w.z * v.y;
  const cy = w.z * v.x - w.x * v.z;
  const cz = w.x * v.y - w.y * v.x;
  out.x = -kd * speed * v.x + km * cx;
  out.y = -kd * speed * v.y + km * cy;
  out.z = -kd * speed * v.z + km * cz;
  return out;
}

/** Integrates a flight for time T (no ground contact) and returns where the ball is. */
export function simulateFlight(p0: Vec3, v0: Vec3, w: Vec3, T: number, dt = 1 / 120): Vec3 {
  const p = { ...p0 };
  const v = { ...v0 };
  const a = { x: 0, y: 0, z: 0 };
  let t = 0;
  while (t < T - 1e-9) {
    const h = Math.min(dt, T - t);
    airAccel(v, w, a);
    v.x += a.x * h;
    v.y += (a.y - BALL.gravity) * h;
    v.z += a.z * h;
    p.x += v.x * h;
    p.y += v.y * h;
    p.z += v.z * h;
    t += h;
  }
  return p;
}

/**
 * Finds the launch velocity so that a ball struck at p0 with spin w is at `target` after T seconds,
 * including drag and Magnus (shooting method). Returns the velocity and the miss distance.
 */
export function solveLaunch(p0: Vec3, target: Vec3, w: Vec3, T: number): { v: Vec3; miss: number } {
  const t = Math.max(0.05, T);
  // First guess: no air.
  const v: Vec3 = {
    x: (target.x - p0.x) / t,
    y: (target.y - p0.y) / t + 0.5 * BALL.gravity * t,
    z: (target.z - p0.z) / t,
  };
  let miss = Infinity;
  const d = 0.5;
  for (let i = 0; i < 16; i++) {
    const end = simulateFlight(p0, v, w, t);
    const ex = target.x - end.x;
    const ey = target.y - end.y;
    const ez = target.z - end.z;
    miss = Math.hypot(ex, ey, ez);
    if (miss < 0.03) break;
    // Newton step with a finite-difference Jacobian (3x3): drag and Magnus couple the axes.
    const ax = simulateFlight(p0, { x: v.x + d, y: v.y, z: v.z }, w, t);
    const ay = simulateFlight(p0, { x: v.x, y: v.y + d, z: v.z }, w, t);
    const az = simulateFlight(p0, { x: v.x, y: v.y, z: v.z + d }, w, t);
    const J = [
      [(ax.x - end.x) / d, (ay.x - end.x) / d, (az.x - end.x) / d],
      [(ax.y - end.y) / d, (ay.y - end.y) / d, (az.y - end.y) / d],
      [(ax.z - end.z) / d, (ay.z - end.z) / d, (az.z - end.z) / d],
    ];
    const step = solve3(J, [ex, ey, ez]);
    if (!step) {
      v.x += ex / t;
      v.y += ey / t;
      v.z += ez / t;
    } else {
      v.x += step[0];
      v.y += step[1];
      v.z += step[2];
    }
  }
  return { v, miss };
}

/** Solves the 3x3 system J x = b (Cramer's rule); null if singular. */
function solve3(J: number[][], b: number[]): [number, number, number] | null {
  const [a, bb, c] = J as [number[], number[], number[]];
  const det = (m: number[][]) =>
    m[0]![0]! * (m[1]![1]! * m[2]![2]! - m[1]![2]! * m[2]![1]!) -
    m[0]![1]! * (m[1]![0]! * m[2]![2]! - m[1]![2]! * m[2]![0]!) +
    m[0]![2]! * (m[1]![0]! * m[2]![1]! - m[1]![1]! * m[2]![0]!);
  const D = det([a, bb, c]);
  if (Math.abs(D) < 1e-9) return null;
  const col = (k: number) =>
    [0, 1, 2].map((r) => [0, 1, 2].map((cc) => (cc === k ? b[r]! : J[r]![cc]!)));
  return [det(col(0)) / D, det(col(1)) / D, det(col(2)) / D];
}
