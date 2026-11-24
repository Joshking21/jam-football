// §14.12 Match physics (Rapier). Presentation only: the sim decides, the director (§14.3) plans,
// physics acts it out.
//  - Players are capsules driven toward the director's steering velocity; the contact solver makes
//    them barge, jostle and bounce off each other, the posts and the boards. Mass comes from strength.
//  - The ball is a CCD sphere with gravity, drag, Magnus and rolling resistance. At the start of each
//    planned flight it is struck with the velocity the solver finds to land on the sim's target on
//    time; it bounces off the ground, rebounds off the frame and drops into the net for real. While a
//    player has it at his feet it follows the director kinematically.
//  - Fouls knock the victim over: the capsule's rotation unlocks, an impulse tips it, and after a
//    moment he gets up.
// If Rapier fails to load, MatchScene keeps the director's kinematic motion (§14.12.1 fallback).
import * as THREE from 'three';
import type RAPIERNS from '@dimforge/rapier3d-compat';
import type { Choreographer, BallSeg } from '../render3d/choreographer';
import { BALL, airAccel, solveLaunch, Vec3 } from './ballFlight';

type R = typeof RAPIERNS;

const GROUP_WORLD = 0x0001;
const GROUP_BALL = 0x0002;
const GROUP_PLAYER = 0x0004;
const groups = (member: number, filter: number) => (member << 16) | filter;

const STEP = 1 / 60;
const MAX_SUBSTEPS = 4;
const CAPSULE_R = 0.3;
const CAPSULE_HALF = 0.6;
const STAND_Y = CAPSULE_HALF + CAPSULE_R;
const DRIVE_ACCEL = 14; // m/s², how hard a player can push toward where he wants to go
const FALL_SECONDS = 1.5;
const MAX_FALLEN = 3;

let rapierPromise: Promise<R | null> | null = null;

/** Loads Rapier once, lazily, in its own chunk. Resolves null if it can't load. */
export function loadRapier(): Promise<R | null> {
  if (!rapierPromise) {
    rapierPromise = import('@dimforge/rapier3d-compat')
      .then(async (m) => {
        const RAPIER = (m.default ?? m) as R;
        await RAPIER.init();
        return RAPIER;
      })
      .catch((e) => {
        console.warn('Physics unavailable, using kinematic motion:', e);
        return null;
      });
  }
  return rapierPromise;
}

interface Fallen {
  pid: string;
  t: number;
}

export class MatchPhysics {
  private R: R;
  private world: RAPIERNS.World;
  private ball: RAPIERNS.RigidBody;
  private bodies = new Map<string, RAPIERNS.RigidBody>();
  private masses = new Map<string, number>();
  private acc = 0;
  private time = 0;
  private lastSeg: BallSeg | null = null;
  private lastPlanSeq = -1;
  private fallen: Fallen[] = [];
  private wet: boolean;
  private spin = { x: 0, y: 0, z: 0 };
  private tmpA: Vec3 = { x: 0, y: 0, z: 0 };

  /** Rendered ball position (physics). */
  public ballPos = new THREE.Vector3(0, BALL.radius, 0);
  public ballVel = new THREE.Vector3();

  static async create(
    director: Choreographer,
    playerIds: string[],
    strength: Record<string, number>,
    wet: boolean,
  ): Promise<MatchPhysics | null> {
    const RAPIER = await loadRapier();
    if (!RAPIER) return null;
    try {
      return new MatchPhysics(RAPIER, director, playerIds, strength, wet);
    } catch (e) {
      console.warn('Physics world failed to build, using kinematic motion:', e);
      return null;
    }
  }

  private constructor(
    RAPIER: R,
    private director: Choreographer,
    playerIds: string[],
    strength: Record<string, number>,
    wet: boolean,
  ) {
    this.R = RAPIER;
    this.wet = wet;
    const world = new RAPIER.World({ x: 0, y: -BALL.gravity, z: 0 });
    world.timestep = STEP;
    this.world = world;

    const fixed = (
      desc: RAPIERNS.ColliderDesc,
      x: number,
      y: number,
      z: number,
      rot?: THREE.Quaternion,
    ) => {
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(x, y, z)
          .setRotation(
            rot ? { x: rot.x, y: rot.y, z: rot.z, w: rot.w } : { x: 0, y: 0, z: 0, w: 1 },
          ),
      );
      world.createCollider(
        desc.setCollisionGroups(groups(GROUP_WORLD, GROUP_BALL | GROUP_PLAYER)),
        body,
      );
    };

    // Ground: restitution for the ball, no friction drag on players (they are velocity-driven).
    fixed(
      RAPIER.ColliderDesc.cuboid(80, 0.5, 60)
        .setRestitution(wet ? 0.45 : 0.55)
        .setFriction(0.6),
      0,
      -0.5,
      0,
    );

    // Goal frames and nets (§14.2 dimensions).
    const qBar = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    [-1, 1].forEach((dir) => {
      const gx = dir * (52.5 + 0.06);
      [-1, 1].forEach((s) =>
        fixed(RAPIER.ColliderDesc.cylinder(1.25, 0.06).setRestitution(0.75), gx, 1.25, s * 3.72),
      );
      fixed(RAPIER.ColliderDesc.cylinder(3.78, 0.06).setRestitution(0.75), gx, 2.5, 0, qBar);
      // Net: back, roof and sides as thin soft boxes that swallow the ball.
      const net = (hx: number, hy: number, hz: number, x: number, y: number, z: number) =>
        fixed(
          RAPIER.ColliderDesc.cuboid(hx, hy, hz).setRestitution(0.08).setFriction(1.0),
          x,
          y,
          z,
        );
      net(0.05, 1.22, 3.66, dir * (52.5 + 2.0), 1.22, 0);
      net(0.6, 0.05, 3.66, dir * (52.5 + 0.6), 2.44, 0);
      [-1, 1].forEach((s) => net(1.0, 1.22, 0.05, dir * (52.5 + 1.0), 1.22, s * 3.78));
    });

    // Advertising boards (players bump them; the ball rebounds).
    fixed(RAPIER.ColliderDesc.cuboid(56.5, 0.5, 0.08).setRestitution(0.5), 0, 0.5, 38);
    fixed(RAPIER.ColliderDesc.cuboid(56.5, 0.5, 0.08).setRestitution(0.5), 0, 0.5, -38);
    fixed(RAPIER.ColliderDesc.cuboid(0.08, 0.5, 38).setRestitution(0.5), 56.5, 0.5, 0);
    fixed(RAPIER.ColliderDesc.cuboid(0.08, 0.5, 38).setRestitution(0.5), -56.5, 0.5, 0);

    // Players.
    const capsuleVolume =
      Math.PI * CAPSULE_R * CAPSULE_R * (2 * CAPSULE_HALF + (4 / 3) * CAPSULE_R);
    playerIds.forEach((pid) => {
      const s = director.getPlayerState(pid);
      if (!s) return;
      const mass = 65 + (25 * (strength[pid] ?? 60)) / 99;
      this.masses.set(pid, mass);
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(s.currentPos.x, STAND_Y, s.currentPos.z)
          .lockRotations()
          .setLinearDamping(0.2)
          .setAngularDamping(1.5),
      );
      world.createCollider(
        RAPIER.ColliderDesc.capsule(CAPSULE_HALF, CAPSULE_R)
          .setDensity(mass / capsuleVolume)
          .setFriction(0)
          .setRestitution(0.15)
          .setCollisionGroups(groups(GROUP_PLAYER, GROUP_WORLD | GROUP_PLAYER)),
        body,
      );
      this.bodies.set(pid, body);
    });

    // Ball.
    const ballVolume = (4 / 3) * Math.PI * BALL.radius ** 3;
    this.ball = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(0, BALL.radius, 0)
        .setCcdEnabled(true)
        .setAngularDamping(0.4),
    );
    world.createCollider(
      RAPIER.ColliderDesc.ball(BALL.radius)
        .setDensity(BALL.mass / ballVolume)
        .setRestitution(wet ? 0.45 : 0.55)
        .setFriction(0.5)
        .setCollisionGroups(groups(GROUP_BALL, GROUP_WORLD)),
      this.ball,
    );
  }

  /** Is this player on the floor (for animation overrides)? */
  public isFallen(pid: string): boolean {
    return this.fallen.some((f) => f.pid === pid);
  }

  /** The body rotation of a player (for falls). */
  public rotationOf(pid: string, out: THREE.Quaternion): THREE.Quaternion {
    const b = this.bodies.get(pid);
    if (!b) return out.identity();
    const r = b.rotation();
    return out.set(r.x, r.y, r.z, r.w);
  }

  public heightOf(pid: string): number {
    const b = this.bodies.get(pid);
    return b ? b.translation().y - STAND_Y : 0;
  }

  /** Advance physics after the director has updated for presentation time `pt`. */
  public step(delta: number, pt: number) {
    const d = this.director;

    if (d.jumped) {
      this.teleportAll();
      this.lastSeg = d.activeSeg;
      this.syncBallKinematic(true);
      this.acc = 0;
      return;
    }

    this.handleFouls(pt);
    this.updateBallMode(pt);

    this.acc += Math.min(delta, STEP * MAX_SUBSTEPS);
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.time += STEP;
      this.drivePlayers();
      this.applyBallForces();
      this.world.step();
    }
    this.readBack();
  }

  // --- players ---------------------------------------------------------------

  private teleportAll() {
    this.bodies.forEach((b, pid) => {
      const s = this.director.getPlayerState(pid);
      if (!s) return;
      b.setTranslation({ x: s.currentPos.x, y: STAND_Y, z: s.currentPos.z }, true);
      b.setLinvel({ x: 0, y: 0, z: 0 }, true);
      b.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      b.setAngvel({ x: 0, y: 0, z: 0 }, true);
      b.lockRotations(true, true);
    });
    this.fallen = [];
  }

  private drivePlayers() {
    this.bodies.forEach((b, pid) => {
      if (this.isFallen(pid)) return;
      const s = this.director.getPlayerState(pid);
      if (!s) return;
      const m = this.masses.get(pid) ?? 75;
      const v = b.linvel();
      // Impulse toward the director's desired velocity, capped: contact forces still win.
      let jx = m * (s.velocity.x - v.x);
      let jz = m * (s.velocity.z - v.z);
      const cap = m * DRIVE_ACCEL * STEP;
      const mag = Math.hypot(jx, jz);
      if (mag > cap) {
        jx *= cap / mag;
        jz *= cap / mag;
      }
      // Gentle pull back toward the director's position so contacts never drift play off-script.
      const p = b.translation();
      const ex = s.currentPos.x - p.x;
      const ez = s.currentPos.z - p.z;
      const drift = Math.hypot(ex, ez);
      if (drift > 0.8) {
        jx += m * ex * 0.6 * STEP * 10;
        jz += m * ez * 0.6 * STEP * 10;
      }
      b.applyImpulse({ x: jx, y: 0, z: jz }, true);
    });
  }

  private handleFouls(pt: number) {
    const plan = this.director.activePlan;
    if (plan && plan.seq !== this.lastPlanSeq) {
      this.lastPlanSeq = plan.seq;
      if ((plan.type === 'FOUL' || plan.type === 'INJURY') && plan.kicker) {
        const foulerSide = this.director.sideOfPlayer(plan.kicker);
        const fouler = this.director.getPlayerState(plan.kicker);
        if (foulerSide && fouler) {
          const victimSide = foulerSide === 'home' ? 'away' : 'home';
          const victim = this.director.nearest(victimSide, fouler.currentPos, 1)[0];
          if (victim) this.knockDown(victim, fouler.currentPos, plan.type === 'INJURY' ? 1.3 : 1);
        }
      }
    }
    // Get up.
    this.fallen = this.fallen.filter((f) => {
      if (this.time - f.t < FALL_SECONDS) return true;
      const b = this.bodies.get(f.pid);
      if (b) {
        const p = b.translation();
        b.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
        b.setAngvel({ x: 0, y: 0, z: 0 }, true);
        b.setTranslation({ x: p.x, y: STAND_Y, z: p.z }, true);
        b.lockRotations(true, true);
      }
      return false;
    });
    void pt;
  }

  private knockDown(pid: string, from: THREE.Vector3, strength: number) {
    if (this.isFallen(pid) || this.fallen.length >= MAX_FALLEN) return;
    const b = this.bodies.get(pid);
    if (!b) return;
    const p = b.translation();
    let dx = p.x - from.x;
    let dz = p.z - from.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    const m = this.masses.get(pid) ?? 75;
    b.lockRotations(false, true);
    // Hit low and from behind: the legs go, the body tips over.
    b.applyImpulseAtPoint(
      { x: dx * m * 2.6 * strength, y: m * 0.6, z: dz * m * 2.6 * strength },
      { x: p.x - dx * 0.1, y: p.y - 0.5, z: p.z - dz * 0.1 },
      true,
    );
    this.fallen.push({ pid, t: this.time });
  }

  // --- ball ------------------------------------------------------------------

  private updateBallMode(pt: number) {
    const seg = this.director.activeSeg;
    const fresh = seg !== this.lastSeg;
    this.lastSeg = seg;
    if (!seg) {
      // Between segments the ball rests where physics left it (dynamic).
      return;
    }
    if (seg.kind === 'flight' || seg.kind === 'roll') {
      if (fresh) this.launch(seg, pt);
    } else {
      this.syncBallKinematic(false);
    }
  }

  private launch(seg: BallSeg, pt: number) {
    const R = this.R;
    const b = this.ball;
    const from = b.translation();
    // If the real ball is far from where the plan starts (a restart, a jump), place it.
    const start = { x: from.x, y: from.y, z: from.z };
    const planStart = this.director.ballPos;
    if (Math.hypot(start.x - planStart.x, start.z - planStart.z) > 1.5) {
      start.x = planStart.x;
      start.y = Math.max(BALL.radius, planStart.y);
      start.z = planStart.z;
    }
    const T = Math.max(0.12, (seg.cut ?? seg.t1) - pt);
    const target = seg.endPos ?? seg.to;
    const loftedOrShot = seg.apex > 0.2 || target.y > 0.4;
    // Sidespin from the plan's curl (crosses, curled shots).
    this.spin = { x: 0, y: seg.curve !== 0 ? -Math.sign(seg.curve) * 28 : 0, z: 0 };

    let v: Vec3;
    if (loftedOrShot || seg.kind === 'roll') {
      v = solveLaunch(
        start,
        { x: target.x, y: Math.max(BALL.radius, target.y), z: target.z },
        this.spin,
        T,
      ).v;
    } else {
      // Ground pass: it rolls, slowing on the grass; solve the start speed for the distance.
      const dist = Math.hypot(target.x - start.x, target.z - start.z);
      const decel = this.wet ? BALL.rollDecelWet : BALL.rollDecelDry;
      const speed = dist / T + 0.5 * (decel + 0.6) * T; // + an allowance for drag
      const k = speed / Math.max(1e-3, dist);
      v = { x: (target.x - start.x) * k, y: 0, z: (target.z - start.z) * k };
      start.y = BALL.radius;
    }
    b.setBodyType(R.RigidBodyType.Dynamic, true);
    b.setTranslation(start, true);
    b.setLinvel(v, true);
    b.setAngvel(this.spin, true);
  }

  private syncBallKinematic(snap: boolean) {
    const R = this.R;
    const b = this.ball;
    const target = this.director.ballPos;
    if (b.bodyType() !== R.RigidBodyType.KinematicPositionBased) {
      b.setBodyType(R.RigidBodyType.KinematicPositionBased, true);
    }
    if (snap) {
      b.setTranslation({ x: target.x, y: target.y, z: target.z }, true);
      return;
    }
    // Blend toward the carrier's ball so a bounce that ran away comes back smoothly.
    const p = b.translation();
    const k = 0.35;
    b.setNextKinematicTranslation({
      x: p.x + (target.x - p.x) * k,
      y: p.y + (target.y - p.y) * k,
      z: p.z + (target.z - p.z) * k,
    });
  }

  private applyBallForces() {
    const b = this.ball;
    if (b.bodyType() !== this.R.RigidBodyType.Dynamic) return;
    b.resetForces(true);
    const v = b.linvel();
    const w = b.angvel();
    const a = airAccel(v, this.spin, this.tmpA);
    const m = BALL.mass;
    let fx = a.x * m;
    let fy = a.y * m;
    let fz = a.z * m;
    const p = b.translation();
    if (p.y < BALL.radius + 0.02 && Math.abs(v.y) < 0.5) {
      // Rolling on the grass: resistance, and the spin dies away.
      const hs = Math.hypot(v.x, v.z);
      if (hs > 0.05) {
        const decel = this.wet ? BALL.rollDecelWet : BALL.rollDecelDry;
        fx -= (v.x / hs) * decel * m;
        fz -= (v.z / hs) * decel * m;
      }
      this.spin.y *= 1 - BALL.spinDecay * STEP;
      fy = 0;
    }
    void w;
    b.addForce({ x: fx, y: fy, z: fz }, true);
  }

  private readBack() {
    const t = this.ball.translation();
    const v = this.ball.linvel();
    this.ballPos.set(t.x, Math.max(BALL.radius * 0.95, t.y), t.z);
    this.ballVel.set(v.x, v.y, v.z);
    // Feed true positions back so the director steers from where players really are.
    this.bodies.forEach((b, pid) => {
      const s = this.director.getPlayerState(pid);
      if (!s) return;
      const p = b.translation();
      s.currentPos.x = p.x;
      s.currentPos.z = p.z;
    });
  }

  public dispose() {
    this.world.free();
  }
}
