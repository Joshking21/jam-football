// SPEC §14.3 (v1.8 rewrite): the match director.
// The sim's events are coarse: each spans several seconds and includes the time a player spends on
// the ball. The director turns them into continuous football:
//  - one ball timeline built from every event in order (so seeks and replays are exact),
//  - real flight times (a 10 m pass takes under a second), then the receiver carries the ball on to
//    where the next event starts,
//  - pressing, runs into the box, set-piece layouts, kick-offs and goal celebrations,
//  - steering with acceleration limits; a big jump in time snaps everyone into place.
// Physics (§14.12) drives bodies toward the targets computed here.
import * as THREE from 'three';
import {
  MatchEvent,
  Side,
  PlayerId,
  Formation,
  Mentality,
  PassingStyle,
  Pressing,
  Width,
  DefLine,
} from '../core/types';
import { FORMATIONS } from '../config/formations';
import { attacksToward105 } from '../core/match/frames';
import { DIRECTOR } from '../config/render3d';

export interface PlayerPaceMap {
  [playerId: string]: number; // pace 1..99
}

export interface PlayerSteeringState {
  currentPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  velocity: THREE.Vector3;
  facingAngle: number; // radians around Y
  speed: number;
  isKicking: boolean;
  isTackling: boolean;
  isDiving: boolean;
  /** Seconds since this player last kicked; drives follow-through. */
  isCelebrating?: boolean;
  /** Max speed cap this frame (walking back after a goal, etc.). */
  speedCap?: number;
  /** Involved in the ball this frame: may sprint harder to get there. */
  urgent?: boolean;
  /** Seconds from this player's ball contact (negative before it); set around a kick only. */
  kickDt?: number;
  /** The contact is at head height (a header, not a kick). */
  kickHigh?: boolean;
  /** A real tackle on the ball (slide), as opposed to a pressing stab. */
  slide?: boolean;
}

export interface TeamTacticsInput {
  formation: Formation;
  mentality: Mentality;
  passing: PassingStyle;
  pressing: Pressing;
  width: Width;
  line: DefLine;
  lineup: PlayerId[];
}

export type SegKind = 'flight' | 'roll' | 'carry' | 'hold';

export interface BallSeg {
  kind: SegKind;
  t0: number;
  t1: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  apex: number;
  curve: number; // lateral bulge in metres (curl)
  holderId?: PlayerId; // carry / hold
  cut?: number; // clipped end time (evaluation keeps the original curve)
  endPos?: THREE.Vector3; // position at the cut
}

function segEnd(s: BallSeg): number {
  return s.cut ?? s.t1;
}
function segRest(s: BallSeg): THREE.Vector3 {
  return s.endPos ?? s.to;
}

type SetPiece = 'corner' | 'freekick' | 'throw' | 'goalkick' | 'kickoff' | null;

export interface Plan {
  seq: number;
  t: number;
  end: number;
  type: MatchEvent['type'];
  side: Side;
  half: 1 | 2;
  kicker: PlayerId | null;
  kickT: number;
  receiver: PlayerId | null;
  flightEnd: number;
  landing: THREE.Vector3 | null;
  possAfter: Side;
  setPiece: SetPiece;
  cross: boolean;
  shot: { gkPoint: THREE.Vector3; diveStart: number; diveEnd: number } | null;
  scorer: PlayerId | null;
  ballTouching: boolean;
  /** For GOAL: when the ball actually crosses the line (the shot plan's arrival). */
  celebrateFrom: number;
}

const BALL_R = 0.11;
const G = 9.81;
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();

export class Choreographer {
  private homeTactics: TeamTacticsInput;
  private awayTactics: TeamTacticsInput;
  private paces: PlayerPaceMap;
  private states = new Map<string, PlayerSteeringState>();
  private sideOf = new Map<string, Side>();
  private slotOf = new Map<string, number>();
  private phase = new Map<string, number>();

  // Timeline built from the event stream.
  private events: MatchEvent[] = [];
  private plannedSeqs = new Set<number>();
  private plans: Plan[] = [];
  private segs: BallSeg[] = [];

  private lastPt = -1;
  private half: 1 | 2 = 1;

  public ballPos = new THREE.Vector3(0, BALL_R, 0);
  /** The ball as the teams see it for their shape: clamped to the pitch when it's out of play. */
  private refBall = new THREE.Vector3();
  private ballOut = false;
  public ballVelocity = new THREE.Vector3();
  /** The player whose feet the ball is at, if any (for name tags, cameras, physics). */
  public carrierId: PlayerId | null = null;
  /** The plan active at the current time (read by the scene for cameras and physics). */
  public activePlan: Plan | null = null;
  /** True on a frame where time jumped and everyone was snapped into place. */
  public jumped = false;
  /** The ball segment active at the current time (physics launches the real ball from it). */
  public activeSeg: BallSeg | null = null;

  constructor(homeTactics: TeamTacticsInput, awayTactics: TeamTacticsInput, paces: PlayerPaceMap) {
    this.homeTactics = homeTactics;
    this.awayTactics = awayTactics;
    this.paces = paces;
    let seed = 1;
    (['home', 'away'] as const).forEach((side) => {
      const tac = side === 'home' ? homeTactics : awayTactics;
      tac.lineup.forEach((pid, slot) => {
        this.sideOf.set(pid, side);
        this.slotOf.set(pid, slot);
        this.phase.set(pid, (seed++ * 2.39996) % (Math.PI * 2));
        const p = this.kickoffSpot(side, slot, 1, side === 'home');
        this.states.set(pid, {
          currentPos: p.clone(),
          targetPos: p.clone(),
          velocity: new THREE.Vector3(),
          facingAngle: attacksToward105(side, 1) ? Math.PI / 2 : -Math.PI / 2,
          speed: 0,
          isKicking: false,
          isTackling: false,
          isDiving: false,
        });
      });
    });
  }

  public getPlayerState(pid: string): PlayerSteeringState | undefined {
    return this.states.get(pid);
  }

  /** Feed the full (growing) event list. Events must be sorted by t then seq. */
  public setEvents(events: MatchEvent[]) {
    this.events = events;
  }

  /**
   * Advances the director to presentation time `pt`.
   * `event` (the playback's current event) is used when no event list was supplied, so older
   * callers and tests keep working.
   */
  public update(delta: number, pt: number, event: MatchEvent | null, half: 1 | 2) {
    if (event && !this.events.includes(event) && !this.plannedSeqs.has(event.seq)) {
      // Caller drives us event by event: append it to our own list.
      this.events = [...this.events.filter((e) => e.seq !== event.seq), event].sort(
        (a, b) => a.t - b.t || a.seq - b.seq,
      );
    }
    this.half = half;
    this.planUpTo(pt + 0.001);

    const jump = this.lastPt < 0 || Math.abs(pt - this.lastPt) > DIRECTOR.snapJumpSec;
    this.lastPt = pt;
    this.jumped = jump;

    this.activePlan = this.planAt(pt);
    this.updateBall(pt, delta);
    this.computeTargets(pt);
    this.separateTargets();
    if (jump) {
      this.states.forEach((s) => {
        s.currentPos.copy(s.targetPos);
        s.velocity.set(0, 0, 0);
        s.speed = 0;
      });
    }
    this.steer(delta, jump);
  }

  // ---------------------------------------------------------------------------
  // Planning: events → ball segments and plans
  // ---------------------------------------------------------------------------

  private planUpTo(pt: number) {
    for (const ev of this.events) {
      if (ev.t > pt) break;
      if (this.plannedSeqs.has(ev.seq)) continue;
      this.plannedSeqs.add(ev.seq);
      this.planEvent(ev);
    }
  }

  private nextBallEvent(after: MatchEvent): MatchEvent | null {
    const i = this.events.indexOf(after);
    for (let j = i + 1; j < this.events.length; j++) {
      const e = this.events[j]!;
      // Clearances and claims touch the ball even when the sim gives them no position.
      if (e.from || e.type === 'CLEARANCE' || e.type === 'CLAIM') return e;
      if (e.type === 'GOAL' || e.type === 'HALF_TIME' || e.type === 'FULL_TIME') return null;
    }
    return null;
  }

  private nextEvent(after: MatchEvent): MatchEvent | null {
    const i = this.events.indexOf(after);
    return this.events[i + 1] ?? null;
  }

  /** Ball position on the timeline at time t (what has been planned so far). */
  private timelineBallAt(t: number, out: THREE.Vector3): THREE.Vector3 {
    let last: BallSeg | null = null;
    for (const s of this.segs) {
      if (s.t0 <= t && t < segEnd(s)) return this.evalSeg(s, t, out);
      if (segEnd(s) <= t) last = s;
    }
    if (last) return out.copy(segRest(last));
    return out.set(0, BALL_R, 0);
  }

  private clipSegsAt(t: number) {
    this.segs = this.segs.filter((s) => s.t0 < t);
    const last = this.segs[this.segs.length - 1];
    if (last && segEnd(last) > t) {
      last.endPos = this.evalSeg(last, t, new THREE.Vector3());
      last.cut = t;
    }
  }

  /** End of a flight in progress at time t (the next touch waits for the ball to arrive). */
  private flightInProgressEnd(t: number): number {
    // Any flight still in the air at t, or already queued to start after it (a corner being
    // delivered after its setup), must land before the next touch.
    let end = t;
    for (let i = this.segs.length - 1; i >= 0; i--) {
      const s = this.segs[i]!;
      if (s.kind === 'flight' && segEnd(s) > t) end = Math.max(end, segEnd(s));
      if (segEnd(s) <= t) break;
    }
    return end;
  }

  private pushSeg(seg: BallSeg) {
    if (seg.t1 - seg.t0 < 1e-3) return;
    this.segs.push(seg);
  }

  private planEvent(ev: MatchEvent) {
    let end = ev.t + Math.max(0.2, ev.duration);
    const next = this.nextEvent(ev);
    const nextBall = this.nextBallEvent(ev);
    const plan: Plan = {
      seq: ev.seq,
      t: ev.t,
      end,
      type: ev.type,
      side: ev.side,
      half: ev.half,
      kicker: ev.playerId ?? null,
      kickT: ev.t,
      receiver: ev.targetId ?? null,
      flightEnd: ev.t,
      landing: null,
      possAfter: ev.side,
      setPiece: null,
      cross: false,
      shot: null,
      scorer: null,
      ballTouching: false,
      celebrateFrom: ev.t,
    };

    const other: Side = ev.side === 'home' ? 'away' : 'home';
    const type = ev.type;

    if (type === 'GOAL') {
      plan.scorer = ev.playerId ?? null;
      const shot = [...this.plans].reverse().find((p) => p.shot && p.side === ev.side);
      plan.celebrateFrom = shot ? Math.max(ev.t, shot.flightEnd) : ev.t;
      plan.end = ev.t + Math.min(ev.duration, DIRECTOR.celebrateSec + 30);
      this.plans.push(plan);
      return; // the ball stays in the net
    }

    // Shot outcomes (save, block, miss, post) are drawn by the shot itself.
    const prevPlan = this.plans[this.plans.length - 1];
    if (
      prevPlan?.shot &&
      ['SAVE', 'BLOCK', 'MISS', 'POST', 'CLAIM'].includes(type) &&
      ev.t <= prevPlan.flightEnd + 1
    ) {
      this.plans.push(plan);
      return;
    }

    // A touch can't happen before the ball in flight arrives.
    const base = Math.max(ev.t, this.flightInProgressEnd(ev.t));
    end = Math.max(end, base + 0.6);
    plan.end = end;

    if (!ev.from) {
      if (type === 'CLEARANCE' || type === 'CLAIM') {
        plan.ballTouching = true;
        const origin = this.timelineBallAt(base, new THREE.Vector3());
        this.clipSegsAt(base);
        if (type === 'CLAIM') {
          const hands = origin.clone();
          hands.y = 1.1;
          this.pushSeg({
            kind: 'hold',
            t0: base,
            t1: end + 4,
            from: hands,
            to: hands.clone(),
            apex: 0,
            curve: 0,
            holderId: ev.playerId,
          });
          plan.possAfter = ev.side;
        } else {
          const fwd = attacksToward105(ev.side, ev.half) ? 1 : -1;
          const to = origin.clone();
          to.x = clamp(origin.x + fwd * 32, -50, 50);
          to.z = clamp(origin.z * 0.4 + (ev.seq % 2 ? 9 : -9), -30, 30);
          to.y = BALL_R;
          let ft = 2.2;
          const nb = this.nextBallEvent(ev);
          if (nb?.type === 'SHOT' && nb.from && nb.t - ev.t < 12) {
            // A poor clearance: it drops to the man who shoots (a second ball).
            const sf = toScene3(nb.from.x, nb.from.y);
            to.set(sf.x, BALL_R, sf.z);
            ft = clamp(origin.distanceTo(to) / 18, 0.8, 2.6);
          }
          this.pushSeg({
            kind: 'flight',
            t0: base,
            t1: base + ft,
            from: origin.clone(),
            to,
            apex: clamp((G * ft * ft) / 8, 3, 9),
            curve: 0,
          });
          plan.kicker = ev.playerId ?? this.nearest(ev.side, origin, 1)[0] ?? null;
          plan.kickT = base;
          plan.flightEnd = base + ft;
          plan.landing = to.clone();
          plan.possAfter = other;
        }
      }
      // Fouls, cards, duels without positions, whistles: the ball keeps its course.
      this.plans.push(plan);
      return;
    }

    plan.ballTouching = true;
    const from = toScene3(ev.from.x, ev.from.y);
    const to = ev.to ? toScene3(ev.to.x, ev.to.y) : from.clone();
    const origin = this.timelineBallAt(base, new THREE.Vector3());
    this.clipSegsAt(base);
    if (type === 'CORNER' && to.distanceTo(from) < 2) {
      // Corners come with no destination: deliver into the box.
      const right = attacksToward105(ev.side, ev.half);
      const nearZ = from.z > 0 ? 1 : -1;
      to.set((right ? 1 : -1) * 44, BALL_R, nearZ * 2.5);
    }
    if (nextBall?.type === 'SHOT' && nextBall.from && nextBall.t - ev.t < 12 && ev.to) {
      // The pass or cross is meant for the shooter: send it to where the shot is struck.
      const sf = toScene3(nextBall.from.x, nextBall.from.y);
      to.set(sf.x, BALL_R, sf.z);
      if (nextBall.playerId) plan.receiver = nextBall.playerId;
    }

    // Restarts: the ball is placed, then struck after a short setup.
    const restart: Record<string, SetPiece> = {
      CORNER: 'corner',
      FREE_KICK: 'freekick',
      THROW_IN: 'throw',
      GOAL_KICK: 'goalkick',
      KICKOFF: 'kickoff',
    };
    plan.setPiece = restart[type] ?? null;
    if (type === 'KICKOFF') from.set(0, BALL_R, 0);

    let kickT = base;
    if (plan.setPiece) {
      kickT =
        base + Math.min(DIRECTOR.setPieceDelay.maxSec, ev.duration * DIRECTOR.setPieceDelay.share);
      this.pushSeg({
        kind: 'hold',
        t0: base,
        t1: kickT,
        from: from.clone(),
        to: from.clone(),
        apex: 0,
        curve: 0,
      });
    } else if (type === 'SHOT') {
      const d = origin.distanceTo(from);
      if (d < 6) {
        // Struck first time from where the ball is (a volley or a header off a cross).
        from.copy(origin);
        kickT = base + (origin.y > 0.5 ? 0 : 0.12);
      } else {
        // Ball elsewhere: a quick carry into the shooting spot.
        kickT = base + Math.min(1.2, d / 7);
        this.pushSeg({
          kind: 'carry',
          t0: base,
          t1: kickT,
          from: origin.clone(),
          to: from.clone(),
          apex: 0,
          curve: 0,
          holderId: ev.playerId,
        });
      }
    } else if (origin.distanceTo(from) <= 1.5) {
      // Close enough: strike it from where it actually is (no hop).
      from.copy(origin);
    } else if (origin.distanceTo(from) > 1.5) {
      // The ball isn't where this event starts: the actor carries it there first.
      const d = origin.distanceTo(from);
      kickT = base + Math.min(ev.duration * 0.45, d / DIRECTOR.speed.carryMax);
      this.pushSeg({
        kind: 'carry',
        t0: base,
        t1: kickT,
        from: origin.clone(),
        to: from.clone(),
        apex: 0,
        curve: 0,
        holderId: ev.playerId,
      });
    }
    plan.kickT = kickT;

    const S = DIRECTOR.speed;
    const flightTypes = new Set([
      'PASS',
      'THROUGH_BALL',
      'LONG_BALL',
      'CROSS',
      'CLEARANCE',
      'CORNER',
      'GOAL_KICK',
      'THROW_IN',
      'PASS_FAIL',
      'FREE_KICK',
      'KICKOFF',
    ]);

    if (type === 'SHOT') {
      this.planShot(ev, plan, from, to, kickT, end, next);
    } else if (flightTypes.has(type) && ev.to) {
      const dist = Math.hypot(to.x - from.x, to.z - from.z);
      const lofted =
        ev.height === 'lofted' ||
        ev.height === 'high' ||
        ['LONG_BALL', 'CROSS', 'CLEARANCE', 'CORNER', 'GOAL_KICK'].includes(type);
      let speed = lofted
        ? S.loftedBase + dist * S.loftedPerMetre
        : S.groundBase + dist * S.groundPerMetre;
      if (type === 'THROUGH_BALL') speed = S.through;
      if (type === 'THROW_IN') speed = S.throwIn;
      // Real flight time; if it runs past the event, the next touch waits for it.
      const ft = clamp(dist / speed, 0.3, 4.5);
      let apex = 0;
      if (type === 'THROW_IN') apex = DIRECTOR.apex.throwBase + dist * DIRECTOR.apex.throwPerMetre;
      else if (lofted) {
        apex = clamp(
          (G * ft * ft) / 8,
          DIRECTOR.apex.min,
          type === 'CROSS' || type === 'CORNER' ? DIRECTOR.apex.crossMax : DIRECTOR.apex.max,
        );
      }
      plan.cross =
        type === 'CROSS' ||
        type === 'CORNER' ||
        (type === 'FREE_KICK' && !!ev.to && Math.abs(to.x) > 36);
      const landing = to.clone();
      if (
        plan.cross &&
        nextBall &&
        (nextBall.type === 'SHOT' || nextBall.type === 'CLEARANCE' || nextBall.type === 'CLAIM')
      ) {
        landing.y = nextBall.type === 'CLAIM' ? 2.1 : 1.7; // met in the air
      }
      const curve = plan.cross ? (from.z > 0 ? -1 : 1) * Math.min(3, dist * 0.08) : 0;
      this.pushSeg({
        kind: 'flight',
        t0: kickT,
        t1: kickT + ft,
        from: from.clone(),
        to: landing,
        apex,
        curve,
      });
      plan.flightEnd = kickT + ft;
      plan.landing = landing.clone();
      if (type === 'PASS_FAIL') {
        plan.receiver = ev.opponentId ?? null;
        plan.possAfter = other;
      }
      // After landing: the receiver brings it down and carries it on to the next event's start.
      this.planCarryOn(plan, landing, plan.flightEnd, end, nextBall);
    } else {
      // Carries: dribbles, tackles, interceptions, blocks, saves, claims, duels with positions.
      const holder = ev.playerId ?? null;
      const keeper = type === 'SAVE' || type === 'CLAIM';
      const target = to.clone();
      if (keeper) target.y = 1.0;
      const d = from.distanceTo(target);
      const t1 = Math.min(end, kickT + Math.max(0.3, d / S.carryMax));
      this.pushSeg({
        kind: keeper ? 'hold' : 'carry',
        t0: kickT,
        t1,
        from: from.clone(),
        to: target,
        apex: 0,
        curve: 0,
        holderId: holder ?? undefined,
      });
      plan.receiver = holder;
      plan.flightEnd = kickT;
      if (keeper) {
        this.pushSeg({
          kind: 'hold',
          t0: t1,
          t1: end,
          from: target.clone(),
          to: target.clone(),
          apex: 0,
          curve: 0,
          holderId: holder ?? undefined,
        });
      } else {
        this.planCarryOn(plan, target, t1, end, nextBall);
      }
    }
    this.plans.push(plan);
  }

  private planCarryOn(
    plan: Plan,
    at: THREE.Vector3,
    t0: number,
    end: number,
    nextBall: MatchEvent | null,
  ) {
    if (end - t0 < 0.05) return;
    const start = at.clone();
    start.y = BALL_R;
    let dest = start.clone();
    if (nextBall?.from && nextBall.type !== 'KICKOFF' && nextBall.t <= end + 3) {
      dest = toScene3(nextBall.from.x, nextBall.from.y);
      const maxD = DIRECTOR.speed.carryMax * (end - t0);
      const d = start.distanceTo(dest);
      if (d > maxD) dest = start.clone().lerp(dest, maxD / d);
    }
    if (at.y > 0.5) {
      // Met in the air: a short drop to the feet first.
      this.pushSeg({
        kind: 'flight',
        t0,
        t1: t0 + 0.35,
        from: at.clone(),
        to: start.clone(),
        apex: 0,
        curve: 0,
      });
      t0 += 0.35;
    }
    const dur = end - t0;
    if (dur > 2.2) {
      // A long spell on the ball: he dribbles out and back rather than standing on it.
      const fwd = attacksToward105(plan.possAfter, plan.half) ? 1 : -1;
      const side = (plan.seq % 3) - 1;
      const reach = Math.min(7, dur * 1.1);
      const mid = start.clone().lerp(dest, 0.5);
      mid.x = clamp(mid.x + fwd * reach * 0.7, -51, 51);
      mid.z = clamp(mid.z + side * reach * 0.6, -32, 32);
      const tm = t0 + dur * 0.55;
      this.pushSeg({
        kind: 'carry',
        t0,
        t1: tm,
        from: start,
        to: mid,
        apex: 0,
        curve: 0,
        holderId: plan.receiver ?? undefined,
      });
      this.pushSeg({
        kind: 'carry',
        t0: tm,
        t1: end,
        from: mid.clone(),
        to: dest,
        apex: 0,
        curve: 0,
        holderId: plan.receiver ?? undefined,
      });
      return;
    }
    this.pushSeg({
      kind: 'carry',
      t0,
      t1: end,
      from: start,
      to: dest,
      apex: 0,
      curve: 0,
      holderId: plan.receiver ?? undefined,
    });
  }

  private planShot(
    ev: MatchEvent,
    plan: Plan,
    from: THREE.Vector3,
    to: THREE.Vector3,
    kickT: number,
    end: number,
    next: MatchEvent | null,
  ) {
    const head = ev.shot?.bodyPart === 'Head';
    const goalX = to.x > 0 ? 52.5 : -52.5;
    const dir = Math.sign(goalX);
    const height = clamp(ev.shot?.target?.z ?? 1, 0.15, 2.6);
    const target = new THREE.Vector3(goalX, height, to.z);
    const outcome = next?.type ?? 'MISS';
    const dist = from.distanceTo(target);
    const ft = clamp(dist / (head ? DIRECTOR.speed.shotHead : DIRECTOR.speed.shotFoot), 0.25, 1.2);
    const curve = !head && Math.abs(from.x - goalX) > 18 ? (from.z > 0 ? -1 : 1) * 1.2 : 0;
    const arrive = kickT + ft;
    plan.flightEnd = arrive;

    // The keeper's spot on the line, between the ball and the target.
    const gk = new THREE.Vector3(goalX - dir * 1.2, 0, clamp(to.z * 0.55, -3.2, 3.2));
    plan.shot = { gkPoint: gk, diveStart: kickT + ft * 0.2, diveEnd: arrive + 0.4 };

    if (outcome === 'GOAL') {
      this.pushSeg({
        kind: 'flight',
        t0: kickT,
        t1: arrive,
        from: from.clone(),
        to: target.clone(),
        apex: head ? 0.4 : 0.3,
        curve,
      });
      const inNet = new THREE.Vector3(
        goalX + dir * 1.7,
        Math.max(BALL_R, height * 0.6),
        clamp(target.z * 1.05, -3.4, 3.4),
      );
      this.pushSeg({
        kind: 'flight',
        t0: arrive,
        t1: arrive + 0.12,
        from: target.clone(),
        to: inNet,
        apex: 0,
        curve: 0,
      });
      const rest = inNet.clone();
      rest.y = BALL_R;
      this.pushSeg({
        kind: 'roll',
        t0: arrive + 0.12,
        t1: arrive + 0.7,
        from: inNet,
        to: rest,
        apex: 0,
        curve: 0,
      });
      this.pushSeg({
        kind: 'hold',
        t0: arrive + 0.7,
        t1: end + 60,
        from: rest.clone(),
        to: rest.clone(),
        apex: 0,
        curve: 0,
      });
    } else if (outcome === 'SAVE' || outcome === 'CLAIM') {
      const hands = new THREE.Vector3(gk.x, clamp(height, 0.4, 2.2), clamp(target.z, -3.4, 3.4));
      this.pushSeg({
        kind: 'flight',
        t0: kickT,
        t1: arrive,
        from: from.clone(),
        to: hands,
        apex: 0.3,
        curve,
      });
      plan.shot.gkPoint.z = hands.z;
      const defending: Side = ev.side === 'home' ? 'away' : 'home';
      const keeper = this.teamTactics(defending).lineup[0];
      const held = new THREE.Vector3(gk.x, 1.0, hands.z);
      this.pushSeg({
        kind: 'hold',
        t0: arrive,
        t1: end + 8,
        from: hands.clone(),
        to: held,
        apex: 0,
        curve: 0,
        holderId: keeper,
      });
      plan.possAfter = defending;
    } else if (outcome === 'POST') {
      const post = new THREE.Vector3(goalX, height, Math.sign(to.z || 1) * 3.66);
      this.pushSeg({
        kind: 'flight',
        t0: kickT,
        t1: arrive,
        from: from.clone(),
        to: post,
        apex: 0.3,
        curve,
      });
      const back = post.clone().add(new THREE.Vector3(-dir * 7, 0, -Math.sign(post.z) * 3));
      back.y = BALL_R;
      this.pushSeg({
        kind: 'flight',
        t0: arrive,
        t1: arrive + 0.7,
        from: post.clone(),
        to: back,
        apex: 0.8,
        curve: 0,
      });
    } else if (outcome === 'BLOCK') {
      const block = from.clone().lerp(target, 0.25);
      block.y = 0.6;
      const t1 = kickT + ft * 0.25;
      this.pushSeg({
        kind: 'flight',
        t0: kickT,
        t1,
        from: from.clone(),
        to: block,
        apex: 0,
        curve: 0,
      });
      const loose = block.clone().add(new THREE.Vector3(-dir * 3, 0, (from.z > 0 ? 1 : -1) * 2));
      loose.y = BALL_R;
      this.pushSeg({
        kind: 'flight',
        t0: t1,
        t1: t1 + 0.5,
        from: block,
        to: loose,
        apex: 0.5,
        curve: 0,
      });
    } else {
      // Wide or over: past the frame into the boards.
      const wide = new THREE.Vector3(goalX, height, to.z);
      const past = new THREE.Vector3(goalX + dir * 6, Math.max(BALL_R, height + 0.6), to.z * 1.3);
      this.pushSeg({
        kind: 'flight',
        t0: kickT,
        t1: arrive,
        from: from.clone(),
        to: wide,
        apex: 0.3,
        curve,
      });
      this.pushSeg({
        kind: 'flight',
        t0: arrive,
        t1: arrive + 0.35,
        from: wide,
        to: past,
        apex: 0,
        curve: 0,
      });
    }
  }

  private planAt(pt: number): Plan | null {
    let lo = 0;
    let hi = this.plans.length - 1;
    let found: Plan | null = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.plans[mid]!.t <= pt) {
        found = this.plans[mid]!;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found;
  }

  /** The latest plan at or before pt that moved the ball (for kicker/receiver roles). */
  private ballPlanAt(pt: number): Plan | null {
    for (let i = this.plans.length - 1; i >= 0; i--) {
      const p = this.plans[i]!;
      if (p.t <= pt && p.ballTouching) return p;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Ball
  // ---------------------------------------------------------------------------

  private evalSeg(s: BallSeg, t: number, out: THREE.Vector3): THREE.Vector3 {
    const p = clamp((t - s.t0) / Math.max(1e-3, s.t1 - s.t0), 0, 1);
    if (s.kind === 'flight') {
      // Horizontal: a lofted ball keeps its speed; a ground ball slows on the grass.
      const f = s.apex > 0.5 ? p : 1 - Math.pow(1 - p, 1.5);
      out.lerpVectors(s.from, s.to, f);
      out.y = s.from.y + (s.to.y - s.from.y) * p + 4 * s.apex * p * (1 - p);
      if (s.curve !== 0) {
        const dx = s.to.x - s.from.x;
        const dz = s.to.z - s.from.z;
        const len = Math.hypot(dx, dz) || 1;
        const bulge = s.curve * 4 * p * (1 - p);
        out.x += (-dz / len) * bulge;
        out.z += (dx / len) * bulge;
      }
      return out;
    }
    if (s.kind === 'roll') {
      const f = 1 - Math.pow(1 - p, 2);
      return out.lerpVectors(s.from, s.to, f);
    }
    if (s.kind === 'carry') {
      // Touches: the ball runs ahead of the carrier, slowing between touches.
      const touches = Math.max(1, Math.round((s.t1 - s.t0) / 0.7));
      const local = p * touches;
      const k = Math.floor(local);
      const frac = local - k;
      const f = (k + (1 - Math.pow(1 - frac, 2))) / touches;
      out.lerpVectors(s.from, s.to, clamp(f, 0, 1));
      out.y = BALL_R + Math.abs(Math.sin(frac * Math.PI)) * 0.05;
      return out;
    }
    return out.copy(s.from);
  }

  private updateBall(pt: number, delta: number) {
    const prev = tmpA.copy(this.ballPos);
    let seg: BallSeg | null = null;
    let last: BallSeg | null = null;
    for (let i = this.segs.length - 1; i >= 0; i--) {
      const s = this.segs[i]!;
      if (s.t0 <= pt && pt < segEnd(s)) {
        seg = s;
        break;
      }
      if (!last && segEnd(s) <= pt) last = s;
    }
    this.carrierId = null;
    this.activeSeg = seg;
    if (seg) {
      this.evalSeg(seg, pt, this.ballPos);
      if (seg.kind === 'carry' || seg.kind === 'hold') this.carrierId = seg.holderId ?? null;
    } else if (last) {
      this.ballPos.copy(segRest(last));
      if (this.ballPos.y > BALL_R + 0.02) this.ballPos.y = BALL_R; // never hang in the air
    }
    if (delta > 0) this.ballVelocity.subVectors(this.ballPos, prev).divideScalar(delta);
    if (this.ballVelocity.length() > 60) this.ballVelocity.set(0, 0, 0); // a jump, not a kick
  }

  // ---------------------------------------------------------------------------
  // Targets
  // ---------------------------------------------------------------------------

  private possessionAt(pt: number): Side {
    const g = this.activePlan;
    if (g && g.type === 'GOAL' && pt >= g.celebrateFrom) return g.side === 'home' ? 'away' : 'home';
    const p = this.ballPlanAt(pt);
    if (!p) return 'home';
    return pt >= p.flightEnd ? p.possAfter : p.side;
  }

  private computeTargets(pt: number) {
    const plan = this.activePlan;
    const bplan = this.ballPlanAt(pt);
    const poss = this.possessionAt(pt);
    const ball = this.ballPos;
    // A dead ball (wide of the post, over the bar, out for a throw) is nobody's to chase.
    this.ballOut = Math.abs(ball.x) > 52.5 || Math.abs(ball.z) > 34;
    this.refBall.set(clamp(ball.x, -50, 50), 0, clamp(ball.z, -32, 32));

    this.states.forEach((s) => {
      s.isKicking = false;
      s.isTackling = false;
      s.isDiving = false;
      s.isCelebrating = false;
      s.speedCap = undefined;
      s.kickDt = undefined;
      s.kickHigh = false;
      s.slide = false;
      s.urgent = false;
    });

    const goalOn = !!plan && plan.type === 'GOAL' && pt >= plan.celebrateFrom;
    // 1. Celebration after a goal.
    if (goalOn && pt < plan!.celebrateFrom + DIRECTOR.celebrateSec) {
      this.celebrate(plan!, pt);
      return;
    }
    // 2. Kick-off layout (also while walking back after the celebration).
    if (goalOn || (bplan && bplan.setPiece === 'kickoff' && pt < bplan.kickT)) {
      const kickSide = goalOn ? (plan!.side === 'home' ? 'away' : 'home') : bplan!.side;
      this.kickoffLayout(kickSide);
      if (goalOn) this.states.forEach((s) => (s.speedCap = DIRECTOR.steer.walkSpeed * 1.4));
      return;
    }

    // 3. Team shapes.
    this.teamShape('home', poss === 'home', pt);
    this.teamShape('away', poss === 'away', pt);

    // 4. Set-piece layouts.
    if (bplan && bplan.setPiece === 'corner' && pt < bplan.flightEnd + 1.0)
      this.cornerLayout(bplan);
    else if (bplan && bplan.cross && pt < bplan.flightEnd + 0.6)
      this.boxRuns(bplan.side, bplan.landing ?? ball);
    else if (this.inFinalThird(poss, ball)) this.boxRuns(poss, null);
    if (bplan && bplan.setPiece === 'freekick' && pt < bplan.kickT + 0.4) this.freeKickWall(bplan);

    // 5. Pressing by the side without the ball; support angles for the side with it.
    this.press(poss === 'home' ? 'away' : 'home', pt);
    this.supportCarrier(poss);

    // 6. Anticipation: whoever the sim names for the next touch heads there early.
    this.anticipate(pt);

    // 7. Ball roles: kicker, receiver, carrier.
    if (bplan) {
      if (bplan.kicker && pt < bplan.kickT + 0.25) {
        const k = this.states.get(bplan.kicker);
        if (k) {
          k.urgent = true;
          const land = bplan.landing ?? tmpB.set(0, 0, 0);
          tmpC.subVectors(land, ball).setY(0);
          if (tmpC.lengthSq() < 0.01)
            tmpC.set(this.sideOf.get(bplan.kicker) === 'home' ? 1 : -1, 0, 0);
          tmpC.normalize();
          k.targetPos.set(ball.x - tmpC.x * 0.55, 0, ball.z - tmpC.z * 0.55);
          if (Math.abs(pt - bplan.kickT) < 0.25 && bplan.type !== 'DRIBBLE') k.isKicking = true;
          if (bplan.type !== 'DRIBBLE' && pt > bplan.kickT - 0.45) {
            k.kickDt = pt - bplan.kickT;
            k.kickHigh = ball.y > 1.2;
          }
          if (bplan.type === 'TACKLE' || bplan.type === 'INTERCEPTION') {
            k.isTackling = pt < bplan.kickT + 0.4;
            k.slide = bplan.type === 'TACKLE';
          }
        }
      }
      if (bplan.receiver && bplan.landing && pt < bplan.flightEnd) {
        const r = this.states.get(bplan.receiver);
        if (r) {
          r.targetPos.set(bplan.landing.x, 0, bplan.landing.z);
          r.urgent = true;
        }
      }
      if (bplan.shot) this.keeperForShot(bplan, pt);
    }
    if (this.carrierId) {
      const c = this.states.get(this.carrierId);
      if (c) {
        tmpC.copy(this.ballVelocity).setY(0);
        if (tmpC.lengthSq() < 0.04)
          tmpC.set(
            attacksToward105(this.sideOf.get(this.carrierId) ?? 'home', this.half) ? 1 : -1,
            0,
            0,
          );
        tmpC.normalize();
        c.targetPos.set(ball.x - tmpC.x * 0.6, 0, ball.z - tmpC.z * 0.6);
        c.urgent = true;
      }
    }
  }

  private anticipate(pt: number) {
    for (const e of this.events) {
      if (e.t <= pt) continue;
      if (e.t - pt > 4) break;
      if (!e.from || !e.playerId || e.playerId === this.carrierId) continue;
      const s = this.states.get(e.playerId);
      if (!s) continue;
      const spot = toScene3(e.from.x, e.from.y);
      // Only players already in the area react (no 40 m sprints out of nowhere).
      if (Math.hypot(s.currentPos.x - spot.x, s.currentPos.z - spot.z) > 25) continue;
      // Arrive just as the touch happens: blend from the shape spot toward the touch spot.
      const k = clamp(1 - (e.t - pt) / 4, 0.35, 1);
      s.targetPos.lerp(tmpB.set(spot.x, 0, spot.z), k);
      s.urgent = true;
      break;
    }
  }

  private teamTactics(side: Side): TeamTacticsInput {
    return side === 'home' ? this.homeTactics : this.awayTactics;
  }

  /** Own attacking frame (ax 0 = own goal line, 105 = opponent's) → scene. */
  private ownToScene(side: Side, ax: number, ay: number, out: THREE.Vector3): THREE.Vector3 {
    const right = attacksToward105(side, this.half);
    const x = right ? ax : 105 - ax;
    const y = right ? ay : 68 - ay;
    return out.set(x - 52.5, 0, y - 34);
  }

  private sceneToOwn(side: Side, p: THREE.Vector3): { ax: number; ay: number } {
    const right = attacksToward105(side, this.half);
    const x = p.x + 52.5;
    const y = p.z + 34;
    return right ? { ax: x, ay: y } : { ax: 105 - x, ay: 68 - y };
  }

  private inFinalThird(side: Side, ball: THREE.Vector3): boolean {
    return !this.ballOut && this.sceneToOwn(side, ball).ax > 74;
  }

  /** Role group of a formation slot: one back line, one midfield line, forwards. */
  private lineOf(side: Side, slot: number): 'GK' | 'DEF' | 'MID' | 'FWD' {
    const pos = (FORMATIONS[this.teamTactics(side).formation] ?? FORMATIONS['4-4-2']).slots[slot]
      ?.position;
    if (!pos || pos === 'GK') return 'GK';
    if (pos === 'CB' || pos === 'LB' || pos === 'RB' || pos === 'LWB' || pos === 'RWB')
      return 'DEF';
    if (pos === 'ST' || pos === 'LW' || pos === 'RW') return 'FWD';
    return 'MID';
  }

  /** Where a team's back line stands when defending (own frame ax), given the ball's ax in that frame. */
  private defensiveLine(side: Side, ballAx: number): number {
    const tac = this.teamTactics(side);
    const base = tac.line === 'Deep' ? 14 : tac.line === 'High' ? 28 : 20;
    // The line keeps ~22 m off the ball, never higher than its setting allows, never inside the six-yard box.
    return clamp(ballAx - 22, 6, base + 10);
  }

  /**
   * Team shape as blocks (v1.8 B): out of possession one straight back line, a midfield line 10-12 m
   * ahead, forwards ahead of that; compact and shifted to the ball's side. In possession the back
   * line holds behind the ball, midfield around it, full-backs and wingers give width, and the
   * forwards sit on the opponents' last line (onside).
   */
  private teamShape(side: Side, inPossession: boolean, _pt: number) {
    const tac = this.teamTactics(side);
    const formDef = FORMATIONS[tac.formation] ?? FORMATIONS['4-4-2'];
    const b = this.sceneToOwn(side, this.refBall);
    const ballSide = b.ay < 34 ? -1 : 1;
    const mentality =
      tac.mentality === 'VeryAttacking'
        ? 8
        : tac.mentality === 'Attacking'
          ? 5
          : tac.mentality === 'Defensive'
            ? -4
            : tac.mentality === 'VeryDefensive'
              ? -8
              : 0;
    const comp = tac.width === 'Narrow' ? 0.62 : tac.width === 'Wide' ? 0.8 : 0.72;
    const other: Side = side === 'home' ? 'away' : 'home';

    let back: number;
    let mid: number;
    let fwd: number;
    if (!inPossession) {
      back = this.defensiveLine(side, b.ax);
      mid = clamp(back + 11, back + 7, Math.max(back + 7, b.ax - 2));
      fwd = clamp(mid + 12, mid + 8, 70);
    } else {
      back = clamp(b.ax - 30 + mentality, 16, 58);
      back = Math.min(back, b.ax - 8);
      back = Math.max(back, 8);
      mid = clamp(b.ax - 6, back + 10, back + 30);
      // Their back line, seen from our frame: our forwards stay just onside.
      const theirLine = 105 - this.defensiveLine(other, 105 - b.ax);
      fwd = Math.min(theirLine - 1, Math.max(mid + 12, b.ax + 6));
      fwd = Math.max(fwd, mid + 6);
    }

    tac.lineup.forEach((pid, slot) => {
      const s = this.states.get(pid);
      if (!s) return;
      const anchor = formDef.slots[slot]?.anchor ?? { x: 50, y: 34 };
      const pos = formDef.slots[slot]?.position ?? 'CM';
      const line = this.lineOf(side, slot);
      const wide = Math.abs(anchor.y - 34) > 18;
      let ax: number;
      let ay: number;
      if (line === 'GK') {
        ax = inPossession ? clamp(b.ax * 0.12, 2, 16) : clamp(1.5 + b.ax * 0.09, 1.5, 10);
        ay = 34 + (b.ay - 34) * 0.3;
      } else if (!inPossession) {
        ax = line === 'DEF' ? back : line === 'MID' ? mid : fwd;
        ay = 34 + (anchor.y - 34) * comp + (b.ay - 34) * (line === 'FWD' ? 0.25 : 0.35);
        // The far-side full-back tucks in and sits a yard deeper to cover.
        if (line === 'DEF' && wide && Math.sign(anchor.y - 34) !== ballSide) {
          ax -= 1;
          ay = 34 + (anchor.y - 34) * comp * 0.85 + (b.ay - 34) * 0.35;
        }
        // Wide midfielders track back level with the line on their side when the ball is there.
        if (line === 'MID' && wide && Math.sign(anchor.y - 34) === ballSide)
          ax = Math.max(back + 4, mid - 3);
      } else {
        if (line === 'DEF') {
          const overlap =
            wide &&
            (tac.width === 'Wide' || mentality > 0) &&
            Math.sign(anchor.y - 34) === ballSide;
          ax = wide ? back + (overlap ? 16 : 6) : back;
          ay = wide
            ? 34 + Math.sign(anchor.y - 34) * (overlap ? 29 : 24)
            : 34 + (anchor.y - 34) * 0.9 + (b.ay - 34) * 0.15;
        } else if (line === 'MID') {
          ax = wide ? Math.min(fwd - 4, mid + 6) : mid + (pos === 'DM' ? -6 : pos === 'AM' ? 6 : 0);
          ay = wide
            ? 34 + Math.sign(anchor.y - 34) * 29
            : 34 + (anchor.y - 34) * 0.95 + (b.ay - 34) * 0.25;
        } else {
          ax = pos === 'ST' ? fwd : fwd - 3;
          ay =
            pos === 'ST'
              ? 34 + (anchor.y - 34) * 1.2 + (b.ay - 34) * 0.3
              : 34 + Math.sign(anchor.y - 34 || 1) * 28;
        }
      }
      // Real lines aren't ruled: each player sits a little off it, the same way every time.
      if (line !== 'GK') ax += Math.sin((this.phase.get(pid) ?? 0) * 3.1) * 0.9;
      this.ownToScene(side, clamp(ax, 1, 103), clamp(ay, 2, 66), s.targetPos);
    });
  }

  /** In possession, the two nearest teammates offer angles to the man on the ball (diagonal, 9-12 m). */
  private supportCarrier(side: Side) {
    if (!this.carrierId || this.sideOf.get(this.carrierId) !== side) return;
    const c = this.states.get(this.carrierId);
    if (!c) return;
    const fwd = attacksToward105(side, this.half) ? 1 : -1;
    const helpers = this.nearest(side, c.currentPos, 3)
      .filter((p) => p !== this.carrierId)
      .slice(0, 2);
    helpers.forEach((pid, i) => {
      const h = this.states.get(pid)!;
      const lateral = i === 0 ? 1 : -1;
      // One angle ahead, one square/behind: a passing triangle.
      const along = i === 0 ? 8 : -3;
      h.targetPos.set(
        clamp(c.currentPos.x + fwd * along, -50, 50),
        0,
        clamp(c.currentPos.z + lateral * 10 * (c.currentPos.z > 0 ? -1 : 1), -31, 31),
      );
    });
  }

  /** Side of a player in this match. */
  public sideOfPlayer(pid: PlayerId): Side | undefined {
    return this.sideOf.get(pid);
  }

  public nearest(side: Side, p: THREE.Vector3, count: number, skipGK = true): PlayerId[] {
    const tac = this.teamTactics(side);
    return tac.lineup
      .filter((pid, slot) => !(skipGK && slot === 0) && this.states.has(pid))
      .map((pid) => ({ pid, d: this.states.get(pid)!.currentPos.distanceToSquared(p) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, count)
      .map((x) => x.pid);
  }

  private press(side: Side, pt: number) {
    if (this.ballOut) return;
    const tac = this.teamTactics(side);
    const ball = this.ballPos;
    const own = this.sceneToOwn(side, ball);
    const engage = tac.pressing === 'High' ? 105 : tac.pressing === 'Low' ? 45 : 70;
    if (own.ax > engage) return; // ball still in their half of the pitch: hold the shape
    const n = tac.pressing === 'High' ? 2 : 1;
    const goal = this.ownToScene(side, 0, 34, tmpB.set(0, 0, 0)).clone();
    const presser = this.nearest(side, ball, n);
    presser.forEach((pid, i) => {
      const s = this.states.get(pid)!;
      tmpC.subVectors(goal, ball).setY(0).normalize();
      const d = i === 0 ? DIRECTOR.press.distance : DIRECTOR.press.coverDistance;
      s.targetPos.set(ball.x + tmpC.x * d, 0, ball.z + tmpC.z * d);
      if (i === 0 && this.carrierId && s.currentPos.distanceTo(ball) < 2.2) {
        s.isTackling = Math.sin(pt * 3 + (this.phase.get(pid) ?? 0)) > 0.92;
      }
    });
  }

  private boxRuns(side: Side, landing: THREE.Vector3 | null) {
    const tac = this.teamTactics(side);
    const formDef = FORMATIONS[tac.formation] ?? FORMATIONS['4-4-2'];
    const ballOwn = this.sceneToOwn(side, landing ?? this.ballPos);
    const nearSide = ballOwn.ay < 34 ? -1 : 1;
    // Most advanced outfielders by formation anchor make the runs.
    const runners = tac.lineup
      .map((pid, slot) => ({ pid, slot, x: formDef.slots[slot]?.anchor.x ?? 0 }))
      .filter((r) => r.slot !== 0 && r.pid !== this.carrierId)
      .sort((a, b) => b.x - a.x)
      .slice(0, 3);
    const spots = [
      { ax: 99, ay: 34 + nearSide * 4 }, // near post
      { ax: 97.5, ay: 34 - nearSide * 5 }, // far post
      { ax: 93, ay: 34 }, // penalty spot
    ];
    const other: Side = side === 'home' ? 'away' : 'home';
    const markers = this.nearest(
      other,
      this.ownToScene(side, 96, 34, tmpA.set(0, 0, 0)).clone(),
      4,
    );
    runners.forEach((r, i) => {
      const s = this.states.get(r.pid);
      const spot = spots[i]!;
      if (s) this.ownToScene(side, spot.ax, spot.ay, s.targetPos);
      const m = markers[i];
      if (m) {
        const ms = this.states.get(m)!;
        this.ownToScene(
          side,
          spot.ax + 1.2,
          spot.ay + (i === 2 ? 0.8 : -nearSide * 0.6),
          ms.targetPos,
        );
      }
    });
    // The fourth defender guards the six-yard line.
    const fourth = markers[3];
    if (fourth) this.ownToScene(side, 100, 34 - nearSide * 1.5, this.states.get(fourth)!.targetPos);
  }

  private cornerLayout(plan: Plan) {
    this.boxRuns(plan.side, plan.landing);
    const other: Side = plan.side === 'home' ? 'away' : 'home';
    // Defending: one man on the near post, keeper on his line.
    const ball = this.ballPos;
    const nearSide = this.sceneToOwn(plan.side, ball).ay < 34 ? -1 : 1;
    const postMan = this.nearest(
      other,
      this.ownToScene(plan.side, 104.5, 34 + nearSide * 3.4, tmpA.set(0, 0, 0)).clone(),
      1,
    )[0];
    if (postMan)
      this.ownToScene(plan.side, 104.0, 34 + nearSide * 2.8, this.states.get(postMan)!.targetPos); // inside the post
    const gk = this.teamTactics(other).lineup[0];
    if (gk) this.ownToScene(plan.side, 104, 34 + nearSide * 0.8, this.states.get(gk)!.targetPos);
  }

  private freeKickWall(plan: Plan) {
    const other: Side = plan.side === 'home' ? 'away' : 'home';
    const ball = this.ballPos;
    const goal = this.ownToScene(plan.side, 105, 34, tmpB.set(0, 0, 0)).clone();
    const toGoal = tmpC.subVectors(goal, ball).setY(0);
    const dist = toGoal.length();
    if (dist > 35) return;
    toGoal.normalize();
    const perp = new THREE.Vector3(-toGoal.z, 0, toGoal.x);
    const wall = this.nearest(other, ball, 4);
    wall.forEach((pid, i) => {
      const off = (i - (wall.length - 1) / 2) * 0.7;
      this.states
        .get(pid)!
        .targetPos.set(
          ball.x + toGoal.x * 9.15 + perp.x * off,
          0,
          ball.z + toGoal.z * 9.15 + perp.z * off,
        );
    });
  }

  private keeperForShot(plan: Plan, pt: number) {
    if (!plan.shot) return;
    const defending: Side = plan.side === 'home' ? 'away' : 'home';
    const gk = this.teamTactics(defending).lineup[0];
    const s = gk ? this.states.get(gk) : undefined;
    if (!s) return;
    if (pt < plan.shot.diveEnd + 0.8) s.targetPos.copy(plan.shot.gkPoint).setY(0);
    s.isDiving =
      pt >= plan.shot.diveStart && pt <= plan.shot.diveEnd && Math.abs(plan.shot.gkPoint.z) > 1.2;
  }

  private celebrate(plan: Plan, pt: number) {
    const scorer = plan.scorer;
    const side = plan.side;
    const goalX = this.ownToScene(side, 105, 34, tmpA.set(0, 0, 0)).x;
    const ss = scorer ? this.states.get(scorer) : undefined;
    const flagZ = ss && ss.currentPos.z > 0 ? 33 : -33;
    const flag = new THREE.Vector3(goalX - Math.sign(goalX) * 4, 0, flagZ);
    if (ss) {
      ss.targetPos.copy(flag);
      ss.isCelebrating = true;
    }
    const mates = this.nearest(side, ss?.currentPos ?? flag, 4)
      .filter((p) => p !== scorer)
      .slice(0, 3);
    mates.forEach((pid, i) => {
      const s = this.states.get(pid)!;
      const a = (i / 3) * Math.PI * 2 + pt * 0.3;
      s.targetPos.set(flag.x + Math.cos(a) * 1.2, 0, flag.z + Math.sin(a) * 1.2);
      s.isCelebrating = true;
    });
    // Everyone else walks back towards the kick-off.
    const conceding: Side = side === 'home' ? 'away' : 'home';
    (['home', 'away'] as const).forEach((sd) => {
      this.teamTactics(sd).lineup.forEach((pid, slot) => {
        if (pid === scorer || mates.includes(pid)) return;
        const s = this.states.get(pid)!;
        s.targetPos.copy(this.kickoffSpot(sd, slot, this.half, sd === conceding));
        s.speedCap = DIRECTOR.steer.walkSpeed;
      });
    });
    // The beaten keeper stays on his line, looking at the ball in the net (he doesn't walk into it).
    const gk = this.teamTactics(conceding).lineup[0];
    if (gk)
      this.states
        .get(gk)!
        .targetPos.set(Math.sign(this.ballPos.x) * 51.3, 0, clamp(this.ballPos.z, -3, 3));
  }

  private kickoffSpot(side: Side, slot: number, half: 1 | 2, kicking: boolean): THREE.Vector3 {
    const tac = this.teamTactics(side);
    const formDef = FORMATIONS[tac.formation] ?? FORMATIONS['4-4-2'];
    const anchor = formDef.slots[slot]?.anchor ?? { x: 40, y: 34 };
    let ax = Math.min(50, anchor.x * 0.72);
    let ay = anchor.y;
    if (slot === 0) ax = 4;
    if (kicking && (slot === 9 || slot === 10)) {
      // Two players over the ball.
      ax = slot === 9 ? 52 : 51;
      ay = slot === 9 ? 34 : 37;
    } else if (slot === 9 || slot === 10) {
      ax = Math.min(42, anchor.x * 0.6); // outside the centre circle
    }
    const right = attacksToward105(side, half);
    const x = right ? ax : 105 - ax;
    const y = right ? ay : 68 - ay;
    return new THREE.Vector3(x - 52.5, 0, y - 34);
  }

  private kickoffLayout(kickSide: Side) {
    (['home', 'away'] as const).forEach((sd) => {
      this.teamTactics(sd).lineup.forEach((pid, slot) => {
        const s = this.states.get(pid);
        if (s) s.targetPos.copy(this.kickoffSpot(sd, slot, this.half, sd === kickSide));
      });
    });
  }

  /** Two players are never sent to the same spot: targets closer than 1.1 m are eased apart. */
  private separateTargets() {
    const list = Array.from(this.states.values());
    const R = 1.1;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!.targetPos;
        const b = list[j]!.targetPos;
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        const d = Math.hypot(dx, dz);
        if (d < R) {
          const nx = d > 1e-3 ? dx / d : 1;
          const nz = d > 1e-3 ? dz / d : 0;
          const push = (R - d) / 2;
          a.x += nx * push;
          a.z += nz * push;
          b.x -= nx * push;
          b.z -= nz * push;
        }
      }
    }
  }

  /** Body facing turns at a human rate: along the run, or toward the ball when slow or backpedalling. */
  private face(s: PlayerSteeringState, delta: number, towardBall: boolean) {
    let target: number | null = null;
    if (s.speed > 1.2 && !towardBall) {
      target = Math.atan2(s.velocity.x, s.velocity.z);
    } else {
      tmpC.subVectors(this.ballPos, s.currentPos);
      if (tmpC.lengthSq() > 0.1) target = Math.atan2(tmpC.x, tmpC.z);
    }
    if (target === null) return;
    let d = target - s.facingAngle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const max = DIRECTOR.steer.faceRate * delta;
    s.facingAngle += clamp(d, -max, max);
  }

  // ---------------------------------------------------------------------------
  // Steering
  // ---------------------------------------------------------------------------

  private steer(delta: number, jump: boolean) {
    if (delta <= 0) return;
    const S = DIRECTOR.steer;
    const desired = tmpA;
    this.states.forEach((s, pid) => {
      const pace = this.paces[pid] ?? 60;
      const top = S.baseSpeed + (S.paceSpeed * pace) / 99;
      desired.subVectors(s.targetPos, s.currentPos).setY(0);
      const dist = desired.length();

      // How hard he goes: jog to small adjustments, run to get back into shape, sprint only for
      // the ball (urgent) or a long way out of position.
      let maxSpeed = dist < 6 ? Math.min(top, S.jog) : dist < 16 ? Math.min(top, S.run) : top;
      let accel = S.accel;
      if (s.urgent) {
        maxSpeed = dist > 3 ? Math.max(top, Math.min(S.catchUpMax, 7 + dist * 0.25)) : top;
        accel = S.accel * 1.6;
      }
      if (s.speedCap !== undefined) maxSpeed = Math.min(maxSpeed, s.speedCap);

      // Backpedal: a short way back while the ball is in front of him, facing it.
      tmpC.subVectors(this.ballPos, s.currentPos).setY(0);
      const toBallLen = tmpC.length();
      const backwards = dist < 6 && toBallLen > 0.5 && desired.dot(tmpC) < -0.3 * dist * toBallLen;
      if (backwards && !s.urgent) maxSpeed = Math.min(maxSpeed, S.backpedal);

      const want = Math.min(maxSpeed, dist * S.arrival);
      const speed = s.velocity.length();

      // Turning: the faster he goes, the wider he turns; a sharp change at speed means plant and slow.
      let newSpeed: number;
      let dirX: number;
      let dirZ: number;
      if (dist < 0.05) {
        dirX = speed > 0.01 ? s.velocity.x / speed : 0;
        dirZ = speed > 0.01 ? s.velocity.z / speed : 0;
        newSpeed = Math.max(0, speed - S.decel * delta);
      } else {
        const tx = desired.x / dist;
        const tz = desired.z / dist;
        if (speed < 0.8) {
          dirX = tx;
          dirZ = tz;
        } else {
          const cur = Math.atan2(s.velocity.x, s.velocity.z);
          const tgt = Math.atan2(tx, tz);
          let d = tgt - cur;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          let omega = S.turnSlow + (S.turnFast - S.turnSlow) * Math.min(1, speed / 9);
          if (s.urgent) omega *= 1.6; // going for the ball: sharper, riskier turns
          const step = clamp(d, -omega * delta, omega * delta);
          const a = cur + step;
          dirX = Math.sin(a);
          dirZ = Math.cos(a);
          if (Math.abs(d) > 2.0 && speed > 3) {
            // Plant and turn: brake before changing direction.
            newSpeed = Math.max(0, speed - S.decel * delta);
            s.velocity.set(dirX * newSpeed, 0, dirZ * newSpeed);
            s.currentPos.addScaledVector(s.velocity, delta);
            s.speed = newSpeed;
            this.face(s, delta, false);
            return;
          }
        }
        newSpeed =
          want > speed
            ? Math.min(want, speed + accel * delta)
            : Math.max(want, speed - S.decel * delta);
      }
      s.velocity.set(dirX * newSpeed, 0, dirZ * newSpeed);
      s.currentPos.addScaledVector(s.velocity, delta);
      s.speed = newSpeed;
      this.face(s, delta, backwards);
    });
    if (jump) return;

    // Separation between players (light: bodies in §14.12 do real contact).
    const list = Array.from(this.states.values());
    const R = S.separation;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        const dx = a.currentPos.x - b.currentPos.x;
        const dz = a.currentPos.z - b.currentPos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.01 && d < R) {
          const push = ((R - d) / R) * 1.5 * Math.max(delta, 0.016);
          a.currentPos.x += (dx / d) * push;
          a.currentPos.z += (dz / d) * push;
          b.currentPos.x -= (dx / d) * push;
          b.currentPos.z -= (dz / d) * push;
        }
      }
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function toScene3(absX: number, absY: number): THREE.Vector3 {
  return new THREE.Vector3(absX - 52.5, BALL_R, absY - 34);
}

/**
 * Converts 0..105, 0..68 absolute pitch coordinates to 3D scene coordinates:
 * x -> x - 52.5
 * y -> y - 34 (on the z axis)
 */
export function toSceneCoords(absX: number, absY: number): { x: number; z: number } {
  return {
    x: absX - 52.5,
    z: absY - 34,
  };
}
