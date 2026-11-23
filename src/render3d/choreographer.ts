// Implements SPEC §14.3 Choreographer, Steering & Ball Flight
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
import { FORMATIONS, FormationDef } from '../config/formations';
import { attacksToward105, toAbsolute, Point2D } from '../core/match/frames';

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

export class Choreographer {
  private homeTactics: TeamTacticsInput;
  private awayTactics: TeamTacticsInput;
  private paces: PlayerPaceMap;

  // Internal steering states per player
  private states = new Map<string, PlayerSteeringState>();

  // Ball flight state
  public ballPos = new THREE.Vector3(0, 0.11, 0);
  public ballVelocity = new THREE.Vector3();

  constructor(homeTactics: TeamTacticsInput, awayTactics: TeamTacticsInput, paces: PlayerPaceMap) {
    this.homeTactics = homeTactics;
    this.awayTactics = awayTactics;
    this.paces = paces;

    // Initialize states at anchor positions
    this.initPlayerStates('home', homeTactics, 1);
    this.initPlayerStates('away', awayTactics, 1);
  }

  private initPlayerStates(side: Side, tactics: TeamTacticsInput, half: 1 | 2) {
    const formDef = FORMATIONS[tactics.formation] ?? FORMATIONS['4-4-2'];
    tactics.lineup.forEach((pid, slotIdx) => {
      const slot = formDef.slots[slotIdx];
      const anchor = slot ? slot.anchor : { x: 50, y: 34 };
      let ownX = anchor.x;
      let ownY = anchor.y;

      // At kickoff, all players MUST stand strictly in their own half (SPEC §14.3, REVIEW-M4 S2)
      // Own half is x <= 52.5. Clamped so forwards stay behind the halfway line.
      if (slotIdx === 9 || slotIdx === 10) {
        if (slotIdx === 9 && side === 'home') {
          // Home striker on kickoff spot
          ownX = 52.0;
          ownY = 34.0;
        } else {
          // Other striker / forwards compressed behind halfway line
          ownX = Math.min(48.5, anchor.x * 0.68);
        }
      } else {
        // Compress other slots into own half
        ownX = Math.min(50.0, anchor.x * 0.72);
      }

      const abs = toAbsolute(ownX, ownY, side, half);
      const scenePos = toSceneCoords(abs.x, abs.y);

      this.states.set(pid, {
        currentPos: new THREE.Vector3(scenePos.x, 0, scenePos.z),
        targetPos: new THREE.Vector3(scenePos.x, 0, scenePos.z),
        velocity: new THREE.Vector3(),
        facingAngle: side === 'home' ? 0 : Math.PI,
        speed: 0,
        isKicking: false,
        isTackling: false,
        isDiving: false,
      });
    });
  }

  public getPlayerState(pid: string): PlayerSteeringState | undefined {
    return this.states.get(pid);
  }

  /**
   * Updates ball flight and all 22 player positions for the current frame.
   */
  public update(
    delta: number,
    pt: number, // presentation time (seconds into match)
    event: MatchEvent | null,
    half: 1 | 2,
  ) {
    // 1. Calculate Ball Position & Flight
    this.updateBall(delta, pt, event, half);

    // 2. Compute Base Tactical Target Positions for all players
    this.computeTacticalTargets(pt, event, half);

    // 3. Apply Event-Specific Roles (actor, receiver, defender, box runs, walls)
    this.applyEventOverrides(pt, event, half);

    // 4. Steering, Arrival, Separation & Facing for each player
    this.updateSteering(delta);
  }

  /**
   * Computes the 3D ball trajectory based on event type and progress.
   */
  private updateBall(delta: number, pt: number, event: MatchEvent | null, half: 1 | 2) {
    if (!event || !event.from || !event.to) {
      this.ballVelocity.set(0, 0, 0);
      return;
    }

    const elapsed = Math.max(0, pt - event.t);
    const progress = Math.min(1.0, elapsed / Math.max(0.1, event.duration));

    const fromScene = toSceneCoords(event.from.x, event.from.y);
    const toScene = toSceneCoords(event.to.x, event.to.y);

    const prevPos = this.ballPos.clone();

    if (event.type === 'SHOT' || event.type === 'GOAL') {
      // Fast path to goal target over 0.4 - 0.8s (SPEC §14.3)
      const shotT = Math.min(1.0, elapsed / Math.max(0.4, event.duration * 0.7));
      const targetHeight = event.shot?.target?.z ?? 1.2; // vertical target height
      this.ballPos.x = fromScene.x + (toScene.x - fromScene.x) * shotT;
      this.ballPos.z = fromScene.z + (toScene.z - fromScene.z) * shotT;

      // Slight curve / arc towards target height
      const curve = Math.sin(shotT * Math.PI) * 0.4;
      this.ballPos.y = 0.11 + targetHeight * shotT + curve;

      if (event.type === 'GOAL' && shotT >= 1.0) {
        // Ball settles into net
        this.ballPos.y = 0.11;
      }
    } else if (
      event.height === 'lofted' ||
      event.height === 'high' ||
      event.type === 'CROSS' ||
      event.type === 'CORNER' ||
      event.type === 'LONG_BALL'
    ) {
      // Parabolic flight arc with apex 4..12m scaled by pass distance
      const dist = Math.hypot(toScene.x - fromScene.x, toScene.z - fromScene.z);
      const apex = Math.min(11, Math.max(3.5, dist * 0.18));

      this.ballPos.x = fromScene.x + (toScene.x - fromScene.x) * progress;
      this.ballPos.z = fromScene.z + (toScene.z - fromScene.z) * progress;
      // Parabola: 4 * apex * p * (1 - p)
      this.ballPos.y = 0.11 + 4 * apex * progress * (1 - progress);
    } else if (event.type === 'DRIBBLE') {
      // Ball at carrier feet offset with small bounces
      const bounce = Math.abs(Math.sin(elapsed * 14)) * 0.18;
      this.ballPos.x = fromScene.x + (toScene.x - fromScene.x) * progress;
      this.ballPos.z = fromScene.z + (toScene.z - fromScene.z) * progress;
      this.ballPos.y = 0.11 + bounce;
    } else {
      // Ground pass linear with ease-out over duration * 0.5 (SPEC §14.3)
      const p = Math.min(1.0, progress * 1.5);
      const eased = 1 - Math.pow(1 - p, 2); // ease-out quad
      this.ballPos.x = fromScene.x + (toScene.x - fromScene.x) * eased;
      this.ballPos.z = fromScene.z + (toScene.z - fromScene.z) * eased;
      this.ballPos.y = 0.11;
    }

    // Compute instantaneous velocity for ball rotation
    if (delta > 0) {
      this.ballVelocity.subVectors(this.ballPos, prevPos).divideScalar(delta);
    }
  }

  /**
   * Computes team shape targets in and out of possession per SPEC §14.3 formulas.
   */
  private computeTacticalTargets(pt: number, event: MatchEvent | null, half: 1 | 2) {
    const possessingSide: Side = event ? event.side : 'home';

    // Ball in absolute pitch coordinates
    const ballAbsX = this.ballPos.x + 52.5;
    const ballAbsY = this.ballPos.z + 34;

    const isCorner = event?.type === 'CORNER';

    this.computeTeamShape(
      'home',
      this.homeTactics,
      possessingSide === 'home',
      ballAbsX,
      ballAbsY,
      half,
      isCorner,
    );
    this.computeTeamShape(
      'away',
      this.awayTactics,
      possessingSide === 'away',
      ballAbsX,
      ballAbsY,
      half,
      isCorner,
    );
  }

  private computeTeamShape(
    side: Side,
    tactics: TeamTacticsInput,
    inPossession: boolean,
    ballAbsX: number,
    ballAbsY: number,
    half: 1 | 2,
    isCorner: boolean = false,
  ) {
    const formDef = FORMATIONS[tactics.formation] ?? FORMATIONS['4-4-2'];

    // Convert ball to team's own attacking frame (ax, ay)
    const isAttackingRight = attacksToward105(side, half);
    const bx = isAttackingRight ? ballAbsX : 105 - ballAbsX;
    const by = isAttackingRight ? ballAbsY : 68 - ballAbsY;

    // Tactical width multipliers
    const widthMult = inPossession
      ? tactics.width === 'Wide'
        ? 1.2
        : tactics.width === 'Narrow'
          ? 0.95
          : 1.1
      : tactics.width === 'Narrow'
        ? 0.7
        : 0.8;

    // Line base offset
    const lineBase = tactics.line === 'Deep' ? 12 : tactics.line === 'High' ? 28 : 18;
    const mentalityBonus =
      tactics.mentality === 'Attacking' ? 6 : tactics.mentality === 'Defensive' ? -3 : 0;

    tactics.lineup.forEach((pid, slotIdx) => {
      const state = this.states.get(pid);
      if (!state) return;

      const slot = formDef.slots[slotIdx];
      const anchor = slot ? slot.anchor : { x: 50, y: 34 };
      const isGK = slotIdx === 0;

      let targetOwnX = anchor.x;
      let targetOwnY = anchor.y;

      if (isGK) {
        // GK logic per SPEC §14.3: clamp(bx * 0.12, 2, 16) in possession, y follows ball at 30%
        if (inPossession) {
          targetOwnX = Math.min(16, Math.max(2, bx * 0.12));
        } else {
          targetOwnX = 2.5; // On goal line for defense
        }
        targetOwnY = 34 + (by - 34) * 0.3;
      } else {
        if (isCorner && inPossession) {
          // Attacking corner jobs placement (SPEC §13.20.8)
          const cornerAy = by < 34 ? 0 : 68;
          if (slotIdx === 9) {
            // Penalty spot
            targetOwnX = 94;
            targetOwnY = 34;
          } else if (slotIdx === 10) {
            // Near post (5m out)
            targetOwnX = 100;
            targetOwnY = cornerAy < 34 ? 30 : 38;
          } else if (slotIdx === 8) {
            // Far post
            targetOwnX = 98;
            targetOwnY = cornerAy < 34 ? 38 : 30;
          } else if (slotIdx === 7) {
            // Edge of the box / D
            targetOwnX = 84;
            targetOwnY = 34;
          } else if (slotIdx === 6) {
            // Short option (5m from taker)
            targetOwnX = 101;
            targetOwnY = cornerAy < 34 ? 5 : 63;
          } else if (slotIdx === 2 || slotIdx === 3) {
            // Back (halfway line / stay back)
            targetOwnX = 52.5;
            targetOwnY = anchor.y;
          } else {
            targetOwnX = anchor.x * 0.85 + bx * 0.35 + mentalityBonus;
            targetOwnY = 34 + (anchor.y - 34) * widthMult;
          }
        } else if (isCorner && !inPossession) {
          // Defending corner placement
          if (slotIdx === 9) {
            // 1 forward up near halfway line
            targetOwnX = 55;
            targetOwnY = 34;
          } else {
            // Defenders packed in box
            const rawX = anchor.x * 0.7 + bx * 0.3;
            targetOwnX = Math.min(18, Math.max(5, rawX));
            targetOwnY = 34 + (anchor.y - 34) * 0.6;
          }
        } else if (inPossession) {
          // In possession formula (SPEC §14.3):
          // x = anchor.x * 0.85 + bx * 0.35 + 6 * mentality
          targetOwnX = anchor.x * 0.85 + bx * 0.35 + mentalityBonus;
          targetOwnY = 34 + (anchor.y - 34) * widthMult;
        } else {
          // Out of possession formula (SPEC §14.3):
          // x = anchor.x * 0.7 + bx * 0.3, clamped to lineBase
          const rawX = anchor.x * 0.7 + bx * 0.3;
          targetOwnX = Math.min(lineBase + 18, Math.max(lineBase - 6, rawX));

          // Width scale 0.8, shift y toward by by 25%
          const baseWideY = 34 + (anchor.y - 34) * widthMult;
          targetOwnY = baseWideY * 0.75 + by * 0.25;
        }
      }

      // Keep within legal pitch boundary (0..105, 0..68)
      targetOwnX = Math.min(104, Math.max(1, targetOwnX));
      targetOwnY = Math.min(67, Math.max(1, targetOwnY));

      // Convert from own frame to absolute pitch coordinates
      const absX = isAttackingRight ? targetOwnX : 105 - targetOwnX;
      const absY = isAttackingRight ? targetOwnY : 68 - targetOwnY;

      // Convert to 3D scene coordinates
      const scenePos = toSceneCoords(absX, absY);
      state.targetPos.set(scenePos.x, 0, scenePos.z);
    });
  }

  /**
   * Overrides targets for actor, receiver, defender, set-piece walls & box runners.
   */
  private applyEventOverrides(pt: number, event: MatchEvent | null, half: 1 | 2) {
    if (!event) return;

    // Reset action flags
    this.states.forEach((s) => {
      s.isKicking = false;
      s.isTackling = false;
      s.isDiving = false;
    });

    const elapsed = Math.max(0, pt - event.t);
    const progress = Math.min(1.0, elapsed / Math.max(0.1, event.duration));

    // 1. Actor (event.playerId) placed at ball
    if (event.playerId) {
      const actorState = this.states.get(event.playerId);
      if (actorState) {
        actorState.targetPos.set(this.ballPos.x, 0, this.ballPos.z);

        if (event.type === 'PASS' || event.type === 'SHOT' || event.type === 'GOAL') {
          if (progress < 0.25) {
            actorState.isKicking = true;
          }
        }
      }
    }

    // 2. Receiver (event.targetId) runs to event.to arriving at duration * 0.85
    if (event.targetId && event.to) {
      const recvState = this.states.get(event.targetId);
      if (recvState) {
        const toScene = toSceneCoords(event.to.x, event.to.y);
        recvState.targetPos.set(toScene.x, 0, toScene.z);
      }
    }

    // 3. Primary Defender (event.opponentId) challenges
    if (event.opponentId && event.from && event.to) {
      const defState = this.states.get(event.opponentId);
      if (defState) {
        const fromScene = toSceneCoords(event.from.x, event.from.y);
        const toScene = toSceneCoords(event.to.x, event.to.y);
        // Intercept 40% along pass line
        defState.targetPos.set(
          fromScene.x + (toScene.x - fromScene.x) * 0.4,
          0,
          fromScene.z + (toScene.z - fromScene.z) * 0.4,
        );

        if (event.type === 'TACKLE' && progress > 0.4 && progress < 0.8) {
          defState.isTackling = true;
        }
      }
    }

    // 4. Goalkeeper Dive on Shots
    if ((event.type === 'SHOT' || event.type === 'GOAL') && event.to) {
      const defendingSide: Side = event.side === 'home' ? 'away' : 'home';
      const defLineup =
        defendingSide === 'home' ? this.homeTactics.lineup : this.awayTactics.lineup;
      const gkId = defLineup[0];
      if (gkId) {
        const gkState = this.states.get(gkId);
        if (gkState && progress > 0.3 && progress < 0.9) {
          gkState.isDiving = true;
        }
      }
    }
  }

  /**
   * Applies realistic steering physics: max speed based on pace, acceleration,
   * separation force, arrival easing, and facing angle.
   */
  private updateSteering(delta: number) {
    const pids = Array.from(this.states.keys());

    // 1. Update velocities and positions
    pids.forEach((pid) => {
      const state = this.states.get(pid);
      if (!state) return;

      const pace = this.paces[pid] ?? 60;
      // Max speed formula (SPEC §14.3): 5.5 + 3.5 * pace / 99 m/s
      const maxSpeed = 5.5 + (3.5 * pace) / 99;
      const accel = 6.0; // 6 m/s² acceleration per SPEC §14.3
      const arrivalRadius = 0.6; // arrival radius 0.6 m

      const toTarget = new THREE.Vector3().subVectors(state.targetPos, state.currentPos);
      toTarget.y = 0;
      const dist = toTarget.length();

      if (dist > arrivalRadius) {
        toTarget.normalize();
        // Arrival deceleration inside 3m
        const targetSpeed = dist < 3.0 ? maxSpeed * (dist / 3.0) : maxSpeed;
        const desiredVel = toTarget.multiplyScalar(targetSpeed);

        // Smooth steering acceleration
        state.velocity.lerp(desiredVel, Math.min(1.0, (accel * delta) / maxSpeed));
      } else {
        // Slow down within arrival radius
        state.velocity.multiplyScalar(Math.max(0, 1 - delta * 5));
      }

      // Update position
      state.currentPos.addScaledVector(state.velocity, delta);
      state.speed = state.velocity.length();

      // Update Facing orientation (face velocity when fast, face ball when slow)
      if (state.speed > 0.5) {
        state.facingAngle = Math.atan2(state.velocity.x, state.velocity.z);
      } else {
        const toBall = new THREE.Vector3().subVectors(this.ballPos, state.currentPos);
        if (toBall.lengthSq() > 0.1) {
          state.facingAngle = Math.atan2(toBall.x, toBall.z);
        }
      }
    });

    // 2. Separation force between players within 1.2m (SPEC §14.3)
    const sepRadius = 1.2;
    for (let i = 0; i < pids.length; i++) {
      for (let j = i + 1; j < pids.length; j++) {
        const idA = pids[i]!;
        const idB = pids[j]!;
        const sA = this.states.get(idA);
        const sB = this.states.get(idB);
        if (!sA || !sB) continue;

        const diff = new THREE.Vector3().subVectors(sA.currentPos, sB.currentPos);
        diff.y = 0;
        const d = diff.length();

        if (d > 0.05 && d < sepRadius) {
          const push = ((sepRadius - d) / sepRadius) * 1.5 * delta;
          diff.normalize().multiplyScalar(push);
          sA.currentPos.add(diff);
          sB.currentPos.sub(diff);
        }
      }
    }
  }
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
