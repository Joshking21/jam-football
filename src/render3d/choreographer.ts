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
      if (e.from) return e;
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
    for (let i = this.segs.length - 1; i >= 0; i--) {
      const s = this.segs[i]!;
      if (s.kind === 'flight' && s.t0 <= t && segEnd(s) > t) return segEnd(s);
      if (segEnd(s) <= t) break;
    }
    return t;
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
          const ft = 2.2;
          this.pushSeg({
            kind: 'flight',
            t0: base + 0.1,
            t1: base + 0.1 + ft,
            from: origin.clone(),
            to,
            apex: clamp((G * ft * ft) / 8, 3, 9),
            curve: 0,
          });
          plan.kicker = ev.playerId ?? this.nearest(ev.side, origin, 1)[0] ?? null;
          plan.kickT = base + 0.1;
          plan.flightEnd = base + 0.1 + ft;
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

    this.states.forEach((s) => {
      s.isKicking = false;
      s.isTackling = false;
      s.isDiving = false;
      s.isCelebrating = false;
      s.speedCap = undefined;
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

    // 5. Pressing by the side without the ball.
    this.press(poss === 'home' ? 'away' : 'home', pt);

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
          if (bplan.type === 'TACKLE' || bplan.type === 'INTERCEPTION')
            k.isTackling = pt < bplan.kickT + 0.4;
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
    return this.sceneToOwn(side, ball).ax > 74;
  }

  private teamShape(side: Side, inPossession: boolean, pt: number) {
    const tac = this.teamTactics(side);
    const formDef = FORMATIONS[tac.formation] ?? FORMATIONS['4-4-2'];
    const b = this.sceneToOwn(side, this.ballPos);
    const widthMult = inPossession
      ? tac.width === 'Wide'
        ? 1.2
        : tac.width === 'Narrow'
          ? 0.95
          : 1.1
      : tac.width === 'Narrow'
        ? 0.7
        : 0.8;
    const lineBase = tac.line === 'Deep' ? 12 : tac.line === 'High' ? 28 : 18;
    const mentality = tac.mentality === 'Attacking' ? 6 : tac.mentality === 'Defensive' ? -3 : 0;

    tac.lineup.forEach((pid, slot) => {
      const s = this.states.get(pid);
      if (!s) return;
      const anchor = formDef.slots[slot]?.anchor ?? { x: 50, y: 34 };
      let ax: number;
      let ay: number;
      if (slot === 0) {
        ax = inPossession ? clamp(b.ax * 0.12, 2, 16) : clamp(1.5 + b.ax * 0.09, 1.5, 10);
        ay = 34 + (b.ay - 34) * 0.3;
      } else if (inPossession) {
        ax = anchor.x * 0.85 + b.ax * 0.35 + mentality;
        ay = 34 + (anchor.y - 34) * widthMult;
        ay += (b.ay - 34) * 0.15;
      } else {
        const raw = anchor.x * 0.7 + b.ax * 0.3;
        const isDef = anchor.x < 30;
        ax = isDef ? clamp(raw, lineBase - 6, lineBase + 18) : raw;
        ay = (34 + (anchor.y - 34) * widthMult) * 0.75 + b.ay * 0.25;
      }
      // Off-ball movement: nobody stands still.
      const ph = this.phase.get(pid) ?? 0;
      if (slot !== 0) {
        ax += Math.sin(pt * DIRECTOR.drift.speed + ph) * DIRECTOR.drift.amp;
        ay += Math.cos(pt * DIRECTOR.drift.speed * 0.8 + ph * 1.7) * DIRECTOR.drift.amp;
      }
      this.ownToScene(side, clamp(ax, 1, 104), clamp(ay, 1, 67), s.targetPos);
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
      this.ownToScene(plan.side, 104.4, 34 + nearSide * 3.3, this.states.get(postMan)!.targetPos);
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
    // The beaten keeper fetches the ball.
    const gk = this.teamTactics(conceding).lineup[0];
    if (gk)
      this.states
        .get(gk)!
        .targetPos.set(this.ballPos.x - Math.sign(this.ballPos.x) * 0.6, 0, this.ballPos.z);
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

  // ---------------------------------------------------------------------------
  // Steering
  // ---------------------------------------------------------------------------

  private steer(delta: number, jump: boolean) {
    if (delta <= 0) return;
    const S = DIRECTOR.steer;
    const desired = tmpA;
    this.states.forEach((s, pid) => {
      const pace = this.paces[pid] ?? 60;
      let maxSpeed = S.baseSpeed + (S.paceSpeed * pace) / 99;
      if (s.speedCap !== undefined) maxSpeed = Math.min(maxSpeed, s.speedCap);
      desired.subVectors(s.targetPos, s.currentPos).setY(0);
      const dist = desired.length();
      // The sim's named players must reach the ball: a catch-up burst when far away.
      let accel = S.accel;
      if (s.urgent && dist > 3) {
        maxSpeed = Math.max(maxSpeed, Math.min(S.catchUpMax, 7 + dist * 0.25));
        accel = S.accel * 2;
      }
      const want = Math.min(maxSpeed, dist * S.arrival);
      if (dist > 0.05) desired.multiplyScalar(want / dist);
      else desired.set(0, 0, 0);
      // Acceleration limit.
      tmpB.subVectors(desired, s.velocity);
      const dv = tmpB.length();
      const maxDv = accel * delta;
      if (dv > maxDv) tmpB.multiplyScalar(maxDv / dv);
      s.velocity.add(tmpB);
      s.currentPos.addScaledVector(s.velocity, delta);
      s.speed = s.velocity.length();

      if (s.speed > 0.6) {
        s.facingAngle = Math.atan2(s.velocity.x, s.velocity.z);
      } else {
        tmpC.subVectors(this.ballPos, s.currentPos);
        if (tmpC.lengthSq() > 0.1) s.facingAngle = Math.atan2(tmpC.x, tmpC.z);
      }
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
