// Â§14.12.5 Skinned match players: procedural locomotion with planted feet, two-bone leg and arm IK,
// kicks timed to the contact frame, headers, tackles, keeper dives and head look-at.
// The rig is public/assets/models/player.glb (Mixamo bone names, T-pose rest, front +Z).
// Everything is computed in the model's own space (the player's facing frame): +X left, +Y up,
// +Z forward. Planted feet are held in world space so they never skate while the body moves.
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { cloneModelScene } from './modelLoader';
import type { PlayerSteeringState } from './choreographer';
import type { RagdollSegment } from '../physics/ragdoll';

export interface RigKit {
  shirt: string;
  shirt2: string;
  shorts: string;
  socks: string;
  text: string;
  pattern: string;
  skin: string;
  hair: string;
  boots?: string;
  number?: number;
}

export interface RigInput {
  state: PlayerSteeringState;
  /** Ball centre, world space. */
  ball: THREE.Vector3;
  /** On the floor after a foul: physics owns the body, the rig goes limp. */
  fallen: boolean;
  /** While knocked down with a ragdoll, its bodies drive the bones (Â§14.12.4). */
  ragdoll?: RagdollReader | null;
}

export interface RagdollReader {
  part(bone: string): { pos: THREE.Vector3; q: THREE.Quaternion } | null;
}

/** Bones the ragdoll simulates; everything else keeps its last local rotation. */
const RAGDOLL_BONES: BoneNameLoose[] = [
  'Hips',
  'Spine',
  'Head',
  'LeftArm',
  'LeftForeArm',
  'RightArm',
  'RightForeArm',
  'LeftUpLeg',
  'LeftLeg',
  'RightUpLeg',
  'RightLeg',
];
type BoneNameLoose = string;
const GETUP_SECONDS = 1.3;

const BONES = [
  'Hips',
  'Spine',
  'Spine1',
  'Spine2',
  'Neck',
  'Head',
  'LeftShoulder',
  'LeftArm',
  'LeftForeArm',
  'LeftHand',
  'RightShoulder',
  'RightArm',
  'RightForeArm',
  'RightHand',
  'LeftUpLeg',
  'LeftLeg',
  'LeftFoot',
  'LeftToeBase',
  'RightUpLeg',
  'RightLeg',
  'RightFoot',
  'RightToeBase',
] as const;
type BoneName = (typeof BONES)[number];

const PATTERNS: Record<string, number> = { solid: 0, stripes: 1, hoops: 2, halves: 3, sash: 4 };

// Scratch objects (the rig update is single-threaded and non-reentrant).
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _qInv = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _m1 = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _e = new THREE.Euler();
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const smooth = (x: number) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
const approach = (cur: number, target: number, rate: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-rate * dt));

interface FootState {
  planted: boolean;
  /** World-space ankle position while planted / lift-off point while swinging. */
  plant: THREE.Vector3;
  /** Idle-step progress (0..1) when not in gait. */
  u: number;
  /** Model-space ankle target this frame. */
  target: THREE.Vector3;
}

/** Shared, loaded once: rest data that every clone reuses. */
interface RigTemplate {
  gltf: GLTF;
}

export class PlayerRig {
  public readonly root: THREE.Group;
  private bones = {} as Record<BoneName, THREE.Bone>;
  private parentOf = {} as Record<BoneName, BoneName | null>;
  private restLocalQ = {} as Record<BoneName, THREE.Quaternion>;
  private restLocalPos = {} as Record<BoneName, THREE.Vector3>;
  private restModelQ = {} as Record<BoneName, THREE.Quaternion>;
  private restModelPos = {} as Record<BoneName, THREE.Vector3>;
  private modelQ = {} as Record<BoneName, THREE.Quaternion>;
  private modelPos = {} as Record<BoneName, THREE.Vector3>;
  private armQ = new THREE.Quaternion(); // armature root, model space
  private armPos = new THREE.Vector3();
  private armQInv = new THREE.Quaternion();

  private thighLen = 0.42;
  private shinLen = 0.42;
  private ankleH = 0.085;
  private hipsY = 0.98;

  private phase = Math.random();
  private feet: [FootState, FootState];
  private kickFoot: 0 | 1; // 0 left, 1 right
  private yawPrev: number | null = null;
  private yawRate = 0;
  private speedPrev = 0;
  private accel = 0;
  private wKick = 0;
  private wHead = 0;
  private wSlide = 0;
  private wStab = 0;
  private wDive = 0;
  private wCeleb = 0;
  private wFall = 0;
  private diveSide = 1;
  private lookYaw = 0;
  private lookPitch = 0;
  private invGroup = new THREE.Matrix4();
  private vel = new THREE.Vector3();
  private supportSpot = new THREE.Vector3();
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];

  constructor(
    tpl: RigTemplate,
    kit: RigKit,
    private group: THREE.Object3D,
    footed: 'Left' | 'Right' | 'Both',
    castShadow: boolean,
  ) {
    this.root = cloneModelScene(tpl.gltf);
    this.root.name = 'Rig';
    this.kickFoot = footed === 'Left' ? 0 : 1;

    this.root.traverse((o) => {
      if ((o as THREE.Bone).isBone && (BONES as readonly string[]).includes(o.name)) {
        this.bones[o.name as BoneName] = o as THREE.Bone;
      }
    });
    for (const n of BONES) {
      if (!this.bones[n]) throw new Error(`player.glb is missing bone ${n}`);
    }

    // Rest data. The clone sits at identity, so world == model space here.
    this.root.updateMatrixWorld(true);
    const hipsParent = this.bones.Hips.parent!;
    hipsParent.getWorldPosition(this.armPos);
    hipsParent.getWorldQuaternion(this.armQ);
    this.armQInv.copy(this.armQ).invert();
    for (const n of BONES) {
      const b = this.bones[n];
      const p = b.parent;
      this.parentOf[n] =
        p && (BONES as readonly string[]).includes(p.name) ? (p.name as BoneName) : null;
      this.restLocalQ[n] = b.quaternion.clone();
      this.restLocalPos[n] = b.position.clone();
      this.restModelQ[n] = b.getWorldQuaternion(new THREE.Quaternion());
      this.restModelPos[n] = b.getWorldPosition(new THREE.Vector3());
      this.modelQ[n] = this.restModelQ[n].clone();
      this.modelPos[n] = this.restModelPos[n].clone();
    }
    this.thighLen = this.restModelPos.LeftUpLeg.distanceTo(this.restModelPos.LeftLeg);
    this.shinLen = this.restModelPos.LeftLeg.distanceTo(this.restModelPos.LeftFoot);
    this.ankleH = this.restModelPos.LeftFoot.y;
    this.hipsY = this.restModelPos.Hips.y;

    this.feet = [0, 1].map(() => ({
      planted: true,
      plant: new THREE.Vector3(),
      u: 1,
      target: new THREE.Vector3(),
    })) as [FootState, FootState];

    this.applyKit(kit, castShadow);
    this.addNumber(kit);
    group.add(this.root);
    this.resetFeet();
  }

  // --- Kit -----------------------------------------------------------------------------------------

  private applyKit(kit: RigKit, castShadow: boolean) {
    const made = new Map<string, THREE.Material>();
    const make = (name: string): THREE.Material => {
      const hit = made.get(name);
      if (hit) return hit;
      let m: THREE.MeshStandardMaterial;
      switch (name) {
        case 'Skin':
          m = new THREE.MeshStandardMaterial({ color: kit.skin, roughness: 0.6 });
          break;
        case 'Hair':
          m = new THREE.MeshStandardMaterial({ color: kit.hair, roughness: 0.95 });
          break;
        case 'Shorts':
          m = new THREE.MeshStandardMaterial({ color: kit.shorts, roughness: 0.75 });
          break;
        case 'Socks':
          m = new THREE.MeshStandardMaterial({ color: kit.socks, roughness: 0.8 });
          break;
        case 'Boots':
          m = new THREE.MeshStandardMaterial({ color: kit.boots ?? '#141414', roughness: 0.35 });
          break;
        default:
          m = shirtMaterial(kit);
      }
      made.set(name, m);
      this.materials.push(m);
      return m;
    };
    this.root.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as THREE.Material;
      const base = (src.name || 'Shirt').split('.')[0] ?? 'Shirt';
      mesh.material = make(base);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = false;
    });
  }

  private addNumber(kit: RigKit) {
    if (kit.number === undefined) return;
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = kit.text;
      ctx.font = '700 96px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(kit.number), 64, 70);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.textures.push(tex);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      roughness: 0.7,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      depthWrite: false,
    });
    this.materials.push(mat);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), mat);
    // On the back (-Z) of the chest, attached to Spine1 so it moves with the torso.
    plane.position.set(0, 1.25, -0.122);
    plane.rotation.y = Math.PI;
    this.root.add(plane);
    this.root.updateMatrixWorld(true);
    this.bones.Spine1.attach(plane);
  }

  // --- Pose helpers ------------------------------------------------------------------------------

  private parentModelQ(n: BoneName): THREE.Quaternion {
    const p = this.parentOf[n];
    return p ? this.modelQ[p] : this.armQ;
  }

  /** Sets a bone's model-space rotation as `delta * rest` and its local quaternion. */
  private setDelta(n: BoneName, delta: THREE.Quaternion) {
    this.modelQ[n].multiplyQuaternions(delta, this.restModelQ[n]);
    this.commit(n);
  }

  /** Leaves the bone at its rest local rotation relative to its (posed) parent. */
  private follow(n: BoneName) {
    this.modelQ[n].multiplyQuaternions(this.parentModelQ(n), this.restLocalQ[n]);
    this.commit(n);
  }

  private commit(n: BoneName) {
    _qInv.copy(this.parentModelQ(n)).invert();
    this.bones[n].quaternion.multiplyQuaternions(_qInv, this.modelQ[n]);
  }

  /** Model-space joint position from the posed parent. */
  private fkPos(n: BoneName, out: THREE.Vector3): THREE.Vector3 {
    const p = this.parentOf[n];
    if (!p) return out.copy(this.modelPos[n]);
    out.copy(this.restLocalPos[n]).applyQuaternion(this.modelQ[p]).add(this.modelPos[p]);
    this.modelPos[n].copy(out);
    return out;
  }

  /**
   * Rotates bone n so that its rest direction (to `child`) points along `dir`, keeping the rest
   * reference axis `restRef` turned toward `ref` (both perpendicular-ised against the direction).
   */
  private aim(
    n: BoneName,
    child: BoneName,
    restRef: THREE.Vector3,
    dir: THREE.Vector3,
    ref: THREE.Vector3,
  ) {
    const a = _v.subVectors(this.restModelPos[child], this.restModelPos[n]).normalize();
    const r = _v2.copy(restRef).addScaledVector(a, -restRef.dot(a)).normalize();
    const c = _v3.crossVectors(a, r);
    _m1.makeBasis(a, r, c);
    const d = dir.clone().normalize();
    const rr = ref.clone().addScaledVector(d, -ref.dot(d));
    if (rr.lengthSq() < 1e-8) rr.copy(r);
    rr.normalize();
    const cc = new THREE.Vector3().crossVectors(d, rr);
    _m2.makeBasis(d, rr, cc);
    _m1.transpose();
    _m2.multiply(_m1);
    _q.setFromRotationMatrix(_m2);
    this.setDelta(n, _q);
  }

  // --- Feet --------------------------------------------------------------------------------------

  private neutralModel(i: 0 | 1, speed: number, out: THREE.Vector3) {
    const w = 0.11 - 0.035 * clamp(speed / 8, 0, 1);
    return out.set(i === 0 ? w : -w, this.ankleH, 0);
  }

  private toWorld(v: THREE.Vector3) {
    return v.applyMatrix4(this.group.matrixWorld);
  }

  private toModel(v: THREE.Vector3) {
    return v.applyMatrix4(this.invGroup);
  }

  public resetFeet() {
    this.group.updateMatrixWorld(true);
    for (const i of [0, 1] as const) {
      const f = this.feet[i];
      this.toWorld(this.neutralModel(i, 0, f.plant));
      f.plant.y = 0;
      f.planted = true;
      f.u = 1;
    }
  }

  // --- Update ------------------------------------------------------------------------------------

  // --- Ragdoll ------------------------------------------------------------------------------------

  private rdOffset = new Map<string, THREE.Quaternion>();
  private rdWorldQ = {} as Record<BoneName, THREE.Quaternion>;
  private rdHipsW = new THREE.Vector3();
  private inRagdoll = false;
  private getup = 1;

  /** The rig's current pose as ragdoll segments (world space), and the frame all bodies share. */
  public ragdollSegments(): { segs: RagdollSegment[]; frameQ: THREE.Quaternion } {
    this.group.updateMatrixWorld(true);
    const frameQ = this.group.getWorldQuaternion(new THREE.Quaternion());
    const P = (n: BoneName) => this.bones[n].getWorldPosition(new THREE.Vector3());
    const left = new THREE.Vector3(1, 0, 0).applyQuaternion(frameQ);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(frameQ);
    const hinge = (a: THREE.Vector3, b: THREE.Vector3, fallback: THREE.Vector3) => {
      const c = new THREE.Vector3().crossVectors(a, b);
      return c.length() > 0.05 ? c.normalize() : fallback.clone();
    };
    const segs: RagdollSegment[] = [];
    const spine = P('Spine');
    const neck = P('Neck');
    const head = P('Head');
    segs.push({ bone: 'Hips', from: P('Hips'), to: spine, radius: 0.13, mass: 11 });
    segs.push({
      bone: 'Spine',
      from: spine,
      to: neck,
      radius: 0.14,
      mass: 28,
      parent: 'Hips',
      joint: 'ball',
    });
    const headTop = head.clone().addScaledVector(head.clone().sub(neck).normalize(), 0.2);
    segs.push({
      bone: 'Head',
      from: head,
      to: headTop,
      radius: 0.1,
      mass: 5,
      parent: 'Spine',
      joint: 'ball',
    });
    for (const side of ['Left', 'Right'] as const) {
      const sh = P(`${side}Arm`);
      const el = P(`${side}ForeArm`);
      const wr = P(`${side}Hand`);
      const tip = wr.clone().addScaledVector(wr.clone().sub(el).normalize(), 0.14);
      const ua = el.clone().sub(sh).normalize();
      const fa = tip.clone().sub(el).normalize();
      segs.push({
        bone: `${side}Arm`,
        from: sh,
        to: el,
        radius: 0.048,
        mass: 2.4,
        parent: 'Spine',
        joint: 'ball',
      });
      segs.push({
        bone: `${side}ForeArm`,
        from: el,
        to: tip,
        radius: 0.042,
        mass: 1.8,
        parent: `${side}Arm`,
        joint: 'hinge',
        hingeAxis: hinge(ua, fa, new THREE.Vector3().crossVectors(ua, fwd).normalize()),
        bend: ua.angleTo(fa),
        maxBend: 2.5,
      });
      const hip = P(`${side}UpLeg`);
      const kn = P(`${side}Leg`);
      const an = P(`${side}Foot`);
      const th = kn.clone().sub(hip).normalize();
      const sn = an.clone().sub(kn).normalize();
      segs.push({
        bone: `${side}UpLeg`,
        from: hip,
        to: kn,
        radius: 0.075,
        mass: 9,
        parent: 'Hips',
        joint: 'ball',
      });
      segs.push({
        bone: `${side}Leg`,
        from: kn,
        to: an.clone().add(new THREE.Vector3(0, -0.06, 0)),
        radius: 0.055,
        mass: 5,
        parent: `${side}UpLeg`,
        joint: 'hinge',
        hingeAxis: hinge(th, sn, left),
        bend: th.angleTo(sn),
        maxBend: 2.4,
      });
    }
    // Bone-to-body offsets: every body starts in frameQ.
    const inv = frameQ.clone().invert();
    for (const n of RAGDOLL_BONES) {
      const bq = this.bones[n as BoneName].getWorldQuaternion(new THREE.Quaternion());
      this.rdOffset.set(n, inv.clone().multiply(bq));
    }
    return { segs, frameQ };
  }

  /** Copies the ragdoll's bodies onto the bones; remembers the pose for getting up. */
  private applyRagdoll(rd: RagdollReader) {
    this.group.updateMatrixWorld(true);
    const gq = this.group.getWorldQuaternion(new THREE.Quaternion());
    const armW = gq.clone().multiply(this.armQ);
    for (const n of BONES) {
      const p = this.parentOf[n];
      const parentW = p ? this.rdWorldQ[p] : armW;
      const w = (this.rdWorldQ[n] ??= new THREE.Quaternion());
      const part = this.rdOffset.has(n) ? rd.part(n) : null;
      if (part) w.copy(part.q).multiply(this.rdOffset.get(n)!);
      else w.copy(parentW).multiply(this.bones[n].quaternion);
      this.bones[n].quaternion.copy(_qInv.copy(parentW).invert()).multiply(w);
      if (n === 'Hips' && part) {
        this.rdHipsW.copy(part.pos);
        this.bones.Hips.position.copy(this.hipsLocalFromWorld(part.pos, _v));
      }
    }
  }

  /** World point -> the Hips bone's local position (armature space). */
  private hipsLocalFromWorld(w: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    out.copy(w).applyMatrix4(this.invGroup.copy(this.group.matrixWorld).invert());
    return out.sub(this.armPos).applyQuaternion(this.armQInv);
  }

  /** Blend from the last ragdoll pose (on the floor) into the procedural pose: getting up. */
  private blendGetup(w: number) {
    const gqInv = this.group.getWorldQuaternion(new THREE.Quaternion()).invert();
    const model = {} as Record<BoneName, THREE.Quaternion>;
    const lq = new THREE.Quaternion();
    for (const n of BONES) {
      model[n] = gqInv.clone().multiply(this.rdWorldQ[n]);
      const p = this.parentOf[n];
      const parentM = p ? model[p] : this.armQ;
      lq.copy(parentM).invert().multiply(model[n]);
      // (slerpQuaternions copies its first argument into the target first, so copy the live pose.)
      const live = _q2.copy(this.bones[n].quaternion);
      this.bones[n].quaternion.copy(lq).slerp(live, w);
    }
    const from = this.hipsLocalFromWorld(this.rdHipsW, new THREE.Vector3());
    this.bones.Hips.position.lerpVectors(from, this.bones.Hips.position, w);
  }

  /** Where the pelvis ended up (world), so the body can stand up there. */
  public get lastRagdollHips(): THREE.Vector3 {
    return this.rdHipsW;
  }

  public update(dt: number, inp: RigInput) {
    if (dt <= 0) return;
    if (inp.ragdoll) {
      this.applyRagdoll(inp.ragdoll);
      this.inRagdoll = true;
      return;
    }
    if (this.inRagdoll) {
      this.inRagdoll = false;
      this.getup = 0;
      this.resetFeet();
    }
    const s = inp.state;
    this.group.updateMatrixWorld(true);
    this.invGroup.copy(this.group.matrixWorld).invert();

    // Velocity in model space; turning and acceleration for leans.
    const vel = this.vel.copy(s.velocity).setY(0);
    const speed = vel.length();
    const velModel = vel.clone().transformDirection(this.invGroup).multiplyScalar(speed);
    if (this.yawPrev !== null) {
      let d = s.facingAngle - this.yawPrev;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yawRate = approach(this.yawRate, d / dt, 8, dt);
    }
    this.yawPrev = s.facingAngle;
    this.accel = approach(this.accel, (speed - this.speedPrev) / dt, 6, dt);
    this.speedPrev = speed;

    // Teleports (restarts, replays): put the feet back under the body.
    for (const f of this.feet) {
      if (_v2.copy(f.plant).sub(this.group.position).setY(0).lengthSq() > 4) {
        this.resetFeet();
        break;
      }
    }

    // Overlay weights.
    const kicking = s.kickDt !== undefined && !s.isTackling;
    const kdt = s.kickDt ?? 99;
    this.wKick =
      kicking && !s.kickHigh && kdt > -0.45 && kdt < 0.4 ? 1 : approach(this.wKick, 0, 10, dt);
    this.wHead = kicking && s.kickHigh ? 1 : approach(this.wHead, 0, 8, dt);
    this.wSlide = approach(this.wSlide, s.isTackling && s.slide ? 1 : 0, s.isTackling ? 14 : 4, dt);
    this.wStab = approach(this.wStab, s.isTackling && !s.slide ? 1 : 0, 12, dt);
    this.wDive = approach(this.wDive, s.isDiving ? 1 : 0, s.isDiving ? 12 : 3, dt);
    this.wCeleb = approach(this.wCeleb, s.isCelebrating ? 1 : 0, 5, dt);
    this.wFall = approach(this.wFall, inp.fallen ? 1 : 0, inp.fallen ? 12 : 5, dt);
    if (s.isDiving && this.wDive < 0.2) {
      const lat = Math.abs(velModel.x) > 0.3 ? velModel.x : this.toModel(_v2.copy(inp.ball)).x;
      this.diveSide = lat >= 0 ? 1 : -1;
    }

    // ---- Gait ----
    const moving = speed > 0.35 && this.wFall < 0.5;
    const L = 1.0 + 0.45 * speed; // metres per full cycle (two steps)
    const T = L / Math.max(speed, 0.1);
    // Ground contact shortens with speed: ~0.6 of the cycle walking, ~0.22 sprinting.
    const duty = 0.6 - 0.38 * clamp((speed - 1.5) / 6.5, 0, 1);
    const kickHold = this.wKick > 0.5 || this.wSlide > 0.3 || this.wDive > 0.3;
    if (moving && !kickHold) this.phase = (this.phase + dt / T) % 1;

    for (const i of [0, 1] as const) {
      const f = this.feet[i];
      const neutralW = this.toWorld(this.neutralModel(i, speed, _v2));
      neutralW.y = 0;
      if (moving && !kickHold) {
        const phi = (this.phase + i * 0.5) % 1;
        const stance = phi < duty;
        if (stance && !f.planted) {
          // Land ahead of the hip so the body rolls over the foot.
          f.plant.copy(neutralW).addScaledVector(vel, duty * T * 0.5 - phi * T);
          f.plant.y = 0;
          f.planted = true;
        } else if (!stance && f.planted) {
          f.planted = false; // lift-off from f.plant
          f.u = 0;
        }
        if (f.planted) {
          f.target.copy(f.plant);
          // Heel rises toward toe-off.
          const toe = smooth((phi / duty - 0.65) / 0.35);
          f.target.y = this.ankleH + toe * 0.05;
        } else {
          const u = (phi - duty) / (1 - duty);
          f.u = u;
          const land = _v3
            .copy(neutralW)
            .addScaledVector(vel, (1 - u) * (1 - duty) * T + duty * T * 0.5);
          // Heel recovery: the foot stays behind and rises early (peak at u ~ 0.4), then the
          // shin reaches forward low to land. Faster runs kick the heel higher.
          f.target.copy(f.plant).lerp(land, smooth(Math.pow(u, 1.12 + 0.035 * speed)));
          const clear = Math.min(0.45, 0.07 + 0.048 * speed);
          f.target.y = this.ankleH + Math.sin(Math.PI * Math.pow(u, 0.78)) * clear + (1 - u) * 0.05;
        }
      } else {
        // Standing: feet stay planted; a foot that is far from its spot takes a quick step.
        const other = this.feet[i === 0 ? 1 : 0];
        if (
          f.planted &&
          other.planted &&
          f.plant.distanceTo(neutralW) > 0.26 &&
          i === (this.phase < 0.5 ? 0 : 1)
        ) {
          f.planted = false;
          f.u = 0;
        }
        if (f.planted) {
          f.target.copy(f.plant);
          f.target.y = this.ankleH;
        } else {
          f.u = Math.min(1, f.u + dt / 0.22);
          f.target.copy(f.plant).lerp(neutralW, smooth(f.u));
          f.target.y = this.ankleH + Math.sin(Math.PI * f.u) * 0.08;
          if (f.u >= 1) {
            f.plant.copy(neutralW);
            f.planted = true;
            this.phase = (this.phase + 0.5) % 1;
          }
        }
      }
      this.toModel(f.target);
    }

    // ---- Pelvis and spine ----
    const run = clamp(speed / 8, 0, 1);
    const mw = moving ? clamp(speed / 1.5, 0, 1) : 0;
    const bobPhase = (this.phase - duty / 2) * 4 * Math.PI;
    let hipDy =
      -(0.02 + 0.03 * run) * (0.4 + 0.6 * mw) - Math.cos(bobPhase) * (0.006 + 0.004 * speed) * mw;
    let hipYaw = Math.sin(this.phase * 2 * Math.PI) * (0.07 + 0.012 * speed) * mw;
    let lean = (0.03 + 0.019 * speed) * mw + clamp(this.accel * 0.02, -0.12, 0.18);
    // Lean into turns (centripetal): roll toward the inside of the curve.
    let roll = clamp(-this.yawRate * speed * 0.035, -0.35, 0.35);
    let hipPitch = lean * 0.35;

    // Header: a jump timed to contact, then the head snaps through the ball.
    const hJump =
      this.wHead *
      Math.max(0, Math.cos(clamp(kdt / 0.35, -1, 1) * Math.PI * 0.5)) *
      clamp((inp.ball.y - 1.5) * 0.6, 0, 0.35);
    hipDy += hJump;
    // Slide tackle: down onto the hip, leaning back.
    hipDy += this.wSlide * -0.6 + this.wStab * -0.12;
    hipPitch += this.wSlide * -0.55 + this.wStab * 0.12;
    lean += this.wSlide * -0.2;
    // Keeper dive: the whole body rolls onto its side.
    hipDy += this.wDive * -0.5;
    roll = roll * (1 - this.wDive) + -this.diveSide * 1.35 * this.wDive;
    // Kick: lean back slightly through contact and open the hips toward the kicking side.
    const kSide = this.kickFoot === 0 ? 1 : -1;
    lean += this.wKick * -0.12 * Math.max(0, Math.cos(clamp(kdt / 0.3, -1, 1) * Math.PI * 0.5));
    hipYaw += this.wKick * kSide * 0.25 * clamp(-kdt / 0.3, -1, 1);
    // Fallen: physics owns the capsule; keep the body slack.
    hipDy *= 1 - this.wFall;
    // Getting up: the procedural pose we blend toward starts as a deep crouch and rises.
    if (this.getup < 1) {
      const c = 1 - smooth((this.getup - 0.25) / 0.75);
      hipDy -= 0.5 * c;
      lean += 0.55 * c;
      hipPitch += 0.35 * c;
    }

    this.modelPos.Hips.copy(this.restModelPos.Hips);
    this.modelPos.Hips.y += hipDy;
    _e.set(hipPitch, hipYaw, roll, 'YZX');
    _q.setFromEuler(_e);
    this.setDelta('Hips', _q);
    _v2.copy(this.modelPos.Hips).sub(this.armPos).applyQuaternion(this.armQInv);
    this.bones.Hips.position.copy(_v2);

    const twist = -hipYaw * 1.25;
    for (const [n, k] of [
      ['Spine', 0.35],
      ['Spine1', 0.35],
      ['Spine2', 0.3],
    ] as const) {
      _e.set((lean - hipPitch) * k + hipPitch * 0, twist * k, 0, 'YXZ');
      _q2.setFromEuler(_e);
      _q.multiplyQuaternions(this.deltaOf(this.parentOf[n]!), _q2);
      this.setDelta(n, _q);
      this.fkPos(n, _v2);
    }

    // ---- Legs ----
    const legs: [BoneName, BoneName, BoneName, BoneName, 0 | 1][] = [
      ['LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 0],
      ['RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase', 1],
    ];
    const fkLegs = this.wDive > 0.3 || this.wFall > 0.3;
    for (const [up, lo, ft, toe, i] of legs) {
      const hip = this.fkPos(up, new THREE.Vector3());
      const target = this.feet[i].target.clone();
      const pole = new THREE.Vector3(0, 0, 1);
      let footPitch = 0;
      const f = this.feet[i];
      if (!f.planted) footPitch = 0.35 * Math.sin(Math.PI * f.u);

      if (i === this.kickFoot && this.wKick > 0.01) {
        const k = this.kickTarget(kdt, hip, this.toModel(_v2.copy(inp.ball)));
        target.lerp(k, this.wKick);
        footPitch = footPitch * (1 - this.wKick) + 0.55 * this.wKick;
      }
      if (i !== this.kickFoot && this.wKick > 0.01 && kdt < 0.45) {
        // The standing foot: a last step that plants it beside the ball before the strike.
        if (kdt <= 0) {
          const bm = this.toModel(_v2.copy(inp.ball));
          this.supportSpot.set(bm.x - kSide * 0.22, this.ankleH, bm.z - 0.06);
          this.toWorld(this.supportSpot);
        }
        const spot = this.toModel(_v3.copy(this.supportSpot));
        spot.y = this.ankleH;
        const g = smooth((kdt + 0.4) / 0.22);
        const stepT = target.clone().lerp(spot, g);
        stepT.y += Math.sin(Math.PI * g) * 0.12;
        target.lerp(stepT, this.wKick);
        if (g >= 1) {
          f.plant.copy(this.supportSpot).setY(0);
          f.planted = true;
        }
      }
      if (this.wSlide > 0.01) {
        const lead = i === this.kickFoot;
        _v2.set(lead ? -kSide * 0.05 : kSide * 0.14, this.ankleH, lead ? 0.85 : -0.05);
        target.lerp(_v2, this.wSlide);
        if (!lead) pole.set(kSide * 0.8, 0.4, 0.4).normalize();
        footPitch = footPitch * (1 - this.wSlide) + (lead ? 0.5 : 0) * this.wSlide;
      }
      if (this.wStab > 0.01 && i === this.kickFoot) {
        _v2.set(-kSide * 0.06, this.ankleH + 0.04, 0.62);
        target.lerp(_v2, this.wStab);
      }
      if (hJump > 0.01) target.y += hJump * 0.8;

      if (fkLegs) {
        // Legs trail the body (dive) or go slack (fall).
        const hd = this.deltaOf('Hips');
        _q.copy(hd);
        this.setDelta(up, _q);
        _q2.setFromAxisAngle(X, -0.35);
        this.setDelta(lo, _q.multiply(_q2));
        this.fkPos(lo, _v2);
        this.fkPos(ft, _v2);
        this.setDelta(ft, _q);
        this.follow(toe);
        continue;
      }

      this.solveLeg(up, lo, hip, target, pole);
      this.fkPos(lo, _v2);
      this.fkPos(ft, _v2);
      _q.setFromAxisAngle(X, footPitch);
      this.setDelta(ft, _q);
      this.follow(toe);
    }

    // ---- Arms ----
    const zL = this.feet[0].target.z;
    const zR = this.feet[1].target.z;
    const strideHalf = Math.max(0.2, L * 0.25);
    const swingAmp = (0.25 + 0.085 * speed) * mw;
    for (const [sh, up, lo, hand, side] of [
      ['LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 1],
      ['RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', -1],
    ] as const) {
      this.follow(sh);
      this.fkPos(up, _v2);
      // Opposite arm to leg: the left arm comes forward as the right foot does.
      const legFwd = clamp((side === 1 ? zR - zL : zL - zR) / strideHalf, -1, 1);
      let swing = legFwd * clamp(swingAmp, 0, 1.0);
      let abd = 0.13 + 0.07 * run;
      let elbow = 0.3 + 0.16 * speed * mw;
      let raise = 0; // 0 = down, 1 = straight up
      // Balance arm on the far side of a kick, both arms on a header.
      const balance = side === (this.kickFoot === 0 ? -1 : 1) ? this.wKick : 0;
      abd += balance * 0.9 + this.wHead * 0.6 + this.wStab * 0.3;
      swing += balance * 0.2;
      // Slide: the trailing hand goes down to the grass.
      if (this.wSlide > 0.01) {
        abd += this.wSlide * 0.5;
        swing -= this.wSlide * 0.4;
        elbow *= 1 - this.wSlide * 0.7;
      }
      raise = Math.max(
        raise,
        this.wCeleb * (0.85 + 0.1 * Math.sin(this.phase * 12 + side)),
        this.wDive,
      );
      elbow *= 1 - Math.max(this.wCeleb, this.wDive) * 0.8;

      // Upper arm direction in model space.
      const down = new THREE.Vector3(side * Math.sin(abd), -Math.cos(abd), 0);
      down.applyAxisAngle(X, -swing); // positive swing brings the arm forward (+Z)
      const upDir = new THREE.Vector3(side * 0.25, 1, 0.12).normalize();
      if (this.wDive > 0.01) upDir.applyAxisAngle(Z, -this.diveSide * 1.35 * this.wDive);
      const dir = down.lerp(upDir, raise).normalize();
      if (this.wFall > 0.01)
        dir.lerp(new THREE.Vector3(side, -0.3, 0.2).normalize(), this.wFall).normalize();
      const fwd = Z.clone().addScaledVector(dir, -Z.dot(dir));
      if (fwd.lengthSq() < 1e-6) fwd.set(0, -side, 0);
      fwd.normalize();
      const restRef = Z;
      this.aim(up, lo, restRef, dir, fwd);
      this.fkPos(lo, _v2);
      const fore = dir
        .clone()
        .multiplyScalar(Math.cos(elbow))
        .addScaledVector(fwd, Math.sin(elbow));
      const fore2 = fwd
        .clone()
        .multiplyScalar(Math.cos(elbow))
        .addScaledVector(dir, -Math.sin(elbow));
      this.aim(lo, hand, restRef, fore, fore2);
      this.fkPos(hand, _v2);
      this.follow(hand);
    }

    // ---- Head looks at the ball ----
    this.fkPos('Neck', _v2);
    const bm = this.toModel(_v3.copy(inp.ball));
    const eye = _v2.copy(this.modelPos.Neck).add(new THREE.Vector3(0, 0.15, 0));
    const to = bm.sub(eye);
    let yaw = Math.atan2(to.x, to.z);
    let pitch = Math.atan2(-to.y, Math.hypot(to.x, to.z));
    yaw = clamp(yaw, -1.2, 1.2);
    pitch = clamp(pitch, -0.5, 0.6);
    // Header: the head goes back, then snaps through the ball.
    if (this.wHead > 0.01)
      pitch += this.wHead * (kdt < 0 ? -0.35 : 0.45) * Math.max(0, 1 - Math.abs(kdt) / 0.35);
    this.lookYaw = approach(this.lookYaw, yaw, 7, dt);
    this.lookPitch = approach(this.lookPitch, pitch, 7, dt);
    const body = this.deltaOf('Spine2');
    _e.set(this.lookPitch, this.lookYaw, 0, 'YXZ');
    _q2.setFromEuler(_e);
    // Mostly a level head (players keep their eyes level); a little of the torso comes through.
    const look = _q.copy(body).slerp(_q2, 0.75);
    if (this.wDive > 0.3 || this.wFall > 0.3) look.copy(body);
    const neck = new THREE.Quaternion().copy(body).slerp(look, 0.5);
    this.setDelta('Neck', neck);
    this.fkPos('Head', _v2);
    this.setDelta('Head', look);

    if (this.getup < 1) {
      // Rise through a crouch: the blend is eased, and the hips come up last.
      this.getup = Math.min(1, this.getup + dt / GETUP_SECONDS);
      const w = smooth(this.getup);
      this.blendGetup(w * w * (2 - w));
    }
  }

  /** The model-space delta (pose * restâ»Â¹) of a bone. */
  private deltaOf(n: BoneName | null): THREE.Quaternion {
    if (!n) return new THREE.Quaternion();
    return new THREE.Quaternion().multiplyQuaternions(
      this.modelQ[n],
      new THREE.Quaternion().copy(this.restModelQ[n]).invert(),
    );
  }

  /** Kicking ankle path: wind-up behind, strike through the ball at dt = 0, follow-through. */
  private kickTarget(dt: number, hip: THREE.Vector3, ball: THREE.Vector3): THREE.Vector3 {
    const side = this.kickFoot === 0 ? 1 : -1;
    const contact = new THREE.Vector3(
      clamp(ball.x, -0.35, 0.35) + side * 0.03,
      Math.max(this.ankleH + 0.02, Math.min(ball.y, 0.6)),
      clamp(ball.z - 0.13, 0.05, 0.7),
    );
    const back = new THREE.Vector3(hip.x, 0.52, -0.42);
    const through = new THREE.Vector3(hip.x * 0.4 - side * 0.05, 0.62, 0.6);
    const out = new THREE.Vector3();
    if (dt < -0.1) {
      const u = smooth((dt + 0.45) / 0.35);
      out.copy(this.feet[this.kickFoot].target).lerp(back, u);
    } else if (dt < 0) {
      const u = (dt + 0.1) / 0.1;
      out.copy(back).lerp(contact, u * u);
    } else if (dt < 0.22) {
      out.copy(contact).lerp(through, smooth(dt / 0.22));
    } else {
      out.copy(through).lerp(this.feet[this.kickFoot].target, smooth((dt - 0.22) / 0.18));
    }
    return out;
  }

  /** Two-bone IK in model space with the knee toward `pole`. */
  private solveLeg(
    up: BoneName,
    lo: BoneName,
    hip: THREE.Vector3,
    target: THREE.Vector3,
    pole: THREE.Vector3,
  ) {
    const l1 = this.thighLen;
    const l2 = this.shinLen;
    const toT = new THREE.Vector3().subVectors(target, hip);
    const d = clamp(toT.length(), Math.abs(l1 - l2) + 0.02, l1 + l2 - 0.002);
    const u = toT.normalize();
    const v = pole.clone().addScaledVector(u, -pole.dot(u));
    if (v.lengthSq() < 1e-6) v.set(0, 0, 1);
    v.normalize();
    const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
    const a = Math.acos(cosA);
    const knee = hip
      .clone()
      .addScaledVector(u, l1 * Math.cos(a))
      .addScaledVector(v, l1 * Math.sin(a));
    const ankle = hip.clone().addScaledVector(u, d);
    const thighDir = knee.clone().sub(hip);
    const shinDir = ankle.clone().sub(knee);
    this.aim(up, lo, Z, thighDir, pole);
    this.aim(lo, up === 'LeftUpLeg' ? 'LeftFoot' : 'RightFoot', Z, shinDir, pole);
  }

  public dispose() {
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.root.removeFromParent();
  }
}

/** A standard material with the kit pattern drawn from bind-pose position (the body has no UVs). */
function shirtMaterial(kit: RigKit): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: kit.shirt, roughness: 0.72 });
  const uColor2 = { value: new THREE.Color(kit.shirt2) };
  const uPattern = { value: PATTERNS[kit.pattern] ?? 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uColor2 = uColor2;
    sh.uniforms.uPattern = uPattern;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vRest;\nuniform vec3 uColor2;\nuniform int uPattern;',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float k = 0.0;
        if (uPattern == 1) k = step(0.5, fract(vRest.x / 0.1 + 0.25));
        else if (uPattern == 2) k = step(0.5, fract((vRest.y - 1.02) / 0.12));
        else if (uPattern == 3) k = step(0.0, vRest.x);
        else if (uPattern == 4) k = 1.0 - step(0.055, abs(vRest.x * 0.8 + (vRest.y - 1.26)));
        // Collar and sleeve cuffs in the trim colour.
        float trim = max(step(1.455, vRest.y), step(0.305, abs(vRest.x)) * step(1.3, vRest.y));
        k = max(k, trim);
        diffuseColor.rgb = mix(diffuseColor.rgb, uColor2, k);`,
      );
  };
  m.customProgramCacheKey = () => 'kit-shirt';
  return m;
}
