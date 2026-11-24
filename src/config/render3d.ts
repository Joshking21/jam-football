// Tunables for the 3D match director (§14.3 v1.8) and physics (§14.12).
// Kept out of balance.ts so presentation numbers never touch the sim's tuning.

export const DIRECTOR = {
  /** Ball speeds in m/s (horizontal). */
  speed: {
    groundBase: 11,
    groundPerMetre: 0.12,
    through: 16,
    loftedBase: 18,
    loftedPerMetre: 0.06,
    shotFoot: 25,
    shotHead: 13,
    throwIn: 9,
    carryMax: 6.5,
  },
  /** Lofted apex limits in metres. */
  apex: { min: 2.2, max: 15, crossMax: 8, throwBase: 1.2, throwPerMetre: 0.05 },
  /** Delay before a restart is struck, as a share of the event (capped in seconds). */
  setPieceDelay: { share: 0.4, maxSec: 1.6 },
  /** Players. */
  steer: {
    baseSpeed: 5.5,
    paceSpeed: 3.5, // + pace/99 * this
    accel: 7,
    walkSpeed: 1.8,
    arrival: 1.6, // speed = dist * arrival near the target
    separation: 1.1,
    catchUpMax: 12,
  },
  press: { distance: 1.4, coverDistance: 6 },
  drift: { amp: 1.2, speed: 0.35 },
  /** A jump in presentation time larger than this snaps everyone into place. */
  snapJumpSec: 0.5, // per frame: anything faster than ~30x (time-lapse, replay jumps)
  celebrateSec: 9,
} as const;

export const CAMERA = {
  broadcast: {
    height: 21,
    distance: 58, // from the touchline side, metres from the pitch centre line (z)
    followX: 0.8,
    maxX: 34,
    fov: 26,
    fovBox: 22,
  },
  replay: { behindGoal: 3.6, height: 3.4, side: 7.5, fov: 38 }, // between the net (2 m deep) and the boards (4 m)
} as const;

/** Floodlit lighting (v1.8, REVIEW-M4 T6): four soft directional lights from the pylon corners
 *  give the even TV look; spotlight cones drew visible pools on the grass. */
export const FLOODLIT = {
  /** Illuminance per corner light (directional, so no falloff), before the time-slot multiplier. */
  perLight: 1.35,
  /** Hemisphere fill added on top of the time slot's own hemisphere. */
  fill: 0.25,
  shadowLight: 0, // index of the one light that casts shadows
} as const;
