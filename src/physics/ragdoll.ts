// §14.12.4 Ragdoll falls. When a player is knocked over, his rig's current pose becomes 11 Rapier
// bodies (pelvis, torso, head, upper arms, forearms, thighs, shins) joined by ball joints, with
// knees and elbows as limited hinges so they never bend the wrong way. The bodies start with the
// player's running velocity plus the foul's push, fall for real, and the rig copies them back.
// Ragdoll parts collide with the ground and the boards only (not each other, not players).
import * as THREE from 'three';
import type RAPIERNS from '@dimforge/rapier3d-compat';

type R = typeof RAPIERNS;

export interface RagdollSegment {
  /** Bone this body drives (the rig maps it back). */
  bone: string;
  from: THREE.Vector3; // world, the joint at the segment's root
  to: THREE.Vector3; // world, the segment's far end
  radius: number;
  mass: number;
  /** Parent segment's bone, and how it joins. */
  parent?: string;
  joint?: 'ball' | 'hinge';
  /** World hinge axis; positive rotation of the child about it bends the joint further. */
  hingeAxis?: THREE.Vector3;
  /** Current bend at the hinge (radians), so limits are relative to the start pose. */
  bend?: number;
  maxBend?: number;
}

export interface RagdollPart {
  pos: THREE.Vector3;
  q: THREE.Quaternion;
}

const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const Yup = new THREE.Vector3(0, 1, 0);

export class Ragdoll {
  private bodies = new Map<string, RAPIERNS.RigidBody>();
  private joints: RAPIERNS.ImpulseJoint[] = [];
  private out = new Map<string, RagdollPart>();

  constructor(
    private R: R,
    private world: RAPIERNS.World,
    segs: RagdollSegment[],
    /** All bodies start with this rotation so joint frames line up (the player's facing). */
    frameQ: THREE.Quaternion,
    velocity: THREE.Vector3,
    /** Horizontal push direction of the foul (unit) and its strength. */
    push: THREE.Vector3,
    strength: number,
    collisionGroups: number,
  ) {
    const inv = frameQ.clone().invert();
    const rot = { x: frameQ.x, y: frameQ.y, z: frameQ.z, w: frameQ.w };
    const byBone = new Map<string, RagdollSegment>();
    for (const s of segs) {
      byBone.set(s.bone, s);
      const body = world.createRigidBody(
        R.RigidBodyDesc.dynamic()
          .setTranslation(s.from.x, s.from.y, s.from.z)
          .setRotation(rot)
          .setLinearDamping(0.15)
          .setAngularDamping(2.2)
          .setCcdEnabled(s.bone === 'Hips' || s.bone === 'Spine'),
      );
      // Capsule along the segment, in the body's (facing) frame.
      const d = _v.subVectors(s.to, s.from).applyQuaternion(inv);
      const len = d.length();
      const half = Math.max(0.01, len / 2 - s.radius);
      const vol = Math.PI * s.radius * s.radius * (2 * half + (4 / 3) * s.radius);
      _q.setFromUnitVectors(Yup, d.clone().normalize());
      world.createCollider(
        R.ColliderDesc.capsule(half, s.radius)
          .setTranslation(d.x / 2, d.y / 2, d.z / 2)
          .setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w })
          .setDensity(s.mass / vol)
          .setFriction(0.9)
          .setRestitution(0.05)
          .setCollisionGroups(collisionGroups),
        body,
      );
      // Momentum: the whole body carries the run; the legs are taken by the foul, the top tips.
      const legs = /Leg$/.test(s.bone) || /UpLeg$/.test(s.bone);
      const k = legs ? 1.8 * strength : s.bone === 'Hips' ? 0.9 * strength : 0.4 * strength;
      body.setLinvel(
        {
          x: velocity.x + push.x * k,
          y: (legs ? 1.2 : 0.3) * strength,
          z: velocity.z + push.z * k,
        },
        true,
      );
      this.bodies.set(s.bone, body);
      this.out.set(s.bone, { pos: new THREE.Vector3(), q: new THREE.Quaternion() });
    }

    for (const s of segs) {
      if (!s.parent) continue;
      const p = byBone.get(s.parent);
      const b1 = this.bodies.get(s.parent);
      const b2 = this.bodies.get(s.bone);
      if (!p || !b1 || !b2) continue;
      const a1 = _v.subVectors(s.from, p.from).applyQuaternion(inv);
      const anchor1 = { x: a1.x, y: a1.y, z: a1.z };
      const anchor2 = { x: 0, y: 0, z: 0 };
      let data: RAPIERNS.JointData;
      if (s.joint === 'hinge' && s.hingeAxis) {
        const ax = s.hingeAxis.clone().applyQuaternion(inv).normalize();
        data = R.JointData.revolute(anchor1, anchor2, { x: ax.x, y: ax.y, z: ax.z });
        const bend = s.bend ?? 0;
        data.limitsEnabled = true;
        data.limits = [-bend + 0.02, (s.maxBend ?? 2.4) - bend];
      } else {
        data = R.JointData.spherical(anchor1, anchor2);
      }
      this.joints.push(world.createImpulseJoint(data, b1, b2, true));
    }
  }

  /** World transform of a part's body (origin = its root joint). */
  public part(bone: string): RagdollPart | null {
    const b = this.bodies.get(bone);
    const o = this.out.get(bone);
    if (!b || !o) return null;
    const t = b.translation();
    const r = b.rotation();
    o.pos.set(t.x, t.y, t.z);
    o.q.set(r.x, r.y, r.z, r.w);
    return o;
  }

  /** Where the pelvis is now (for getting up where he fell). */
  public pelvis(out: THREE.Vector3): THREE.Vector3 {
    const b = this.bodies.get('Hips');
    if (!b) return out;
    const t = b.translation();
    return out.set(t.x, t.y, t.z);
  }

  /** Debug: per-part height and speed. */
  public debug(): Record<string, [number, number]> {
    const o: Record<string, [number, number]> = {};
    this.bodies.forEach((b, n) => {
      const v = b.linvel();
      o[n] = [+b.translation().y.toFixed(2), +Math.hypot(v.x, v.y, v.z).toFixed(2)];
    });
    return o;
  }

  public dispose() {
    for (const j of this.joints) this.world.removeImpulseJoint(j, true);
    for (const b of this.bodies.values()) this.world.removeRigidBody(b);
    this.joints = [];
    this.bodies.clear();
  }
}
