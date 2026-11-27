// Dev bench for the skinned player rig (§14.12.5). Not part of the build.
//   npx vite --port 5199, then open /dev/rig.html?t=1.2  (t = simulated seconds; omit to run live)
//   &only=kick shows one case.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PlayerRig } from '../src/render3d/playerRig';
import type { PlayerSteeringState } from '../src/render3d/choreographer';
import { loadRapier } from '../src/physics/matchPhysics';
import { Ragdoll } from '../src/physics/ragdoll';

const params = new URLSearchParams(location.search);
const fixedT = params.has('t') ? Number(params.get('t')) : null;
const only = params.get('only');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#40505c');
scene.add(new THREE.HemisphereLight('#cfe3ff', '#2b4020', 1.2));
const sun = new THREE.DirectionalLight('#fff3e0', 2.2);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const sc = sun.shadow.camera as THREE.OrthographicCamera;
sc.left = -150;
sc.right = 150;
sc.top = 60;
sc.bottom = -60;
scene.add(sun);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(600, 400),
  new THREE.MeshStandardMaterial({ color: '#3d6b2f', roughness: 0.95 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(600, 600, '#5f8a4f', '#4f7a40');
grid.position.y = 0.002;
scene.add(grid);

type Drive = (t: number, s: PlayerSteeringState, ball: THREE.Vector3, x0: number) => void;
interface Case {
  name: string;
  drive: Drive;
}

const straight =
  (speed: number): Drive =>
  (t, s, ball, x0) => {
    s.currentPos.set(x0, 0, ((speed * t) % 40) - 20);
    s.velocity.set(0, 0, speed);
    s.facingAngle = 0;
    ball.set(x0 + 3, 0.11, s.currentPos.z + 6);
  };

const CASES: Case[] = [
  {
    name: 'idle',
    drive: (t, s, ball, x0) => {
      s.currentPos.set(x0, 0, 0);
      s.velocity.set(0, 0, 0);
      ball.set(x0 + 2 * Math.sin(t), 0.11, 4);
    },
  },
  { name: 'jog 3.5', drive: straight(3.5) },
  { name: 'sprint 8', drive: straight(8) },
  {
    name: 'curve 6',
    drive: (t, s, ball, x0) => {
      const r = 6;
      const w = 6 / r;
      s.currentPos.set(x0 + r * Math.cos(w * t), 0, r * Math.sin(w * t));
      s.velocity.set(-r * w * Math.sin(w * t), 0, r * w * Math.cos(w * t));
      s.facingAngle = Math.atan2(s.velocity.x, s.velocity.z);
      ball.set(x0, 0.11, 0);
    },
  },
  {
    // Run-up at 2.5 m/s to a ball at z = 0; contact at k = 0, then the ball leaves.
    name: 'kick',
    drive: (t, s, ball, x0) => {
      const k = (t % 1.6) - 0.8;
      s.facingAngle = 0;
      s.kickDt = k;
      s.isKicking = Math.abs(k) < 0.25;
      if (k < 0) {
        s.velocity.set(0, 0, 2.5);
        s.currentPos.set(x0, 0, -0.55 + 2.5 * k);
        ball.set(x0 - 0.12, 0.11, 0);
      } else {
        s.velocity.set(0, 0, Math.max(0, 2.5 - k * 8));
        s.currentPos.set(x0, 0, -0.55 + Math.min(0.4, k * 2));
        ball.set(x0 - 0.12, 0.11 + k * 3, k * 20);
      }
    },
  },
  {
    name: 'header',
    drive: (t, s, ball, x0) => {
      const k = (t % 1.6) - 0.8;
      s.currentPos.set(x0, 0, 0);
      s.velocity.set(0, 0, 0);
      s.facingAngle = 0;
      s.kickDt = k;
      s.kickHigh = true;
      const inn = Math.max(0, -k);
      const out = Math.max(0, k);
      ball.set(x0, 2.1 + inn * 2 + out * 1.5, 0.22 + inn * 8 + out * 12);
    },
  },
  {
    name: 'slide',
    drive: (t, s, ball, x0) => {
      const k = t % 2.0;
      const v = k < 0.6 ? 6 : k < 1.2 ? 6 * (1 - (k - 0.6) / 0.6) : 0.2;
      // integrate position analytically enough for the bench
      const z = -6 + (k < 0.6 ? 6 * k : 3.6 + (k < 1.2 ? 6 * (k - 0.6) - 5 * (k - 0.6) ** 2 : 1.8));
      s.currentPos.set(x0, 0, z);
      s.velocity.set(0, 0, v);
      s.facingAngle = 0;
      s.isTackling = k > 0.6 && k < 1.2;
      s.slide = true;
      ball.set(x0 - 0.1, 0.11, k < 1.0 ? 0 : (k - 1.0) * 6);
    },
  },
  {
    name: 'gk dive',
    drive: (t, s, ball, x0) => {
      const k = t % 2.0;
      s.isDiving = k > 0.5 && k < 1.3;
      const d = k < 0.5 ? 0 : Math.min(0.8, k - 0.5);
      s.currentPos.set(x0 + 3 * d - 1.4 * d * d, 0, 0);
      s.velocity.set(s.isDiving ? 3 - 2.8 * d : 0, 0, 0);
      s.facingAngle = 0;
      ball.set(x0 + 2.2, 1.0, 5 - 5 * Math.min(1, k));
    },
  },
  {
    // Clipped from behind at full run (t = 1.0 in a 5 s cycle); the bench runs the ragdoll.
    name: 'foul',
    drive: (t, s, ball, x0) => {
      const k = t % 5;
      s.facingAngle = 0;
      if (k < 1.0) {
        s.velocity.set(0, 0, 6);
        s.currentPos.set(x0, 0, -6 + 6 * k);
      } else {
        s.velocity.set(0, 0, 0);
      }
      ball.set(x0 + 1, 0.11, 3);
    },
  },
  {
    name: 'celebrate',
    drive: (t, s, ball, x0) => {
      s.isCelebrating = true;
      s.velocity.set(0, 0, 4);
      s.currentPos.set(x0, 0, ((4 * t) % 30) - 15);
      s.facingAngle = 0;
      ball.set(x0, 0.11, 30);
    },
  },
];

const KITS = [
  {
    shirt: '#B3141B',
    shirt2: '#F2F2F2',
    shorts: '#F2F2F2',
    socks: '#B3141B',
    text: '#FFFFFF',
    pattern: 'solid',
  },
  {
    shirt: '#1C3F8C',
    shirt2: '#F5F5F5',
    shorts: '#14161A',
    socks: '#1C3F8C',
    text: '#FFFFFF',
    pattern: 'stripes',
  },
  {
    shirt: '#F2C200',
    shirt2: '#111111',
    shorts: '#111111',
    socks: '#F2C200',
    text: '#111111',
    pattern: 'hoops',
  },
];
const SKINS = ['#E0B18F', '#7A4B33', '#C68B63', '#4E3022', '#F1D3BC', '#A0694A'];

new GLTFLoader().load('/assets/models/player.glb', async (gltf) => {
  const RAPIER = await loadRapier();
  const world = RAPIER ? new RAPIER.World({ x: 0, y: -9.81, z: 0 }) : null;
  if (RAPIER && world) {
    world.timestep = 1 / 60;
    const gb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(400, 0.5, 400)
        .setFriction(0.8)
        .setCollisionGroups((1 << 16) | 0xffff),
      gb,
    );
  }
  let ragdoll: Ragdoll | null = null;
  const active = CASES.filter((c) => !only || c.name.startsWith(only));
  const rigs = active.map((c, i) => {
    const x0 = i * 30;
    const g = new THREE.Group();
    scene.add(g);
    const rig = new PlayerRig(
      { gltf },
      { ...KITS[i % KITS.length]!, skin: SKINS[i % SKINS.length]!, hair: '#1A1410', number: i + 4 },
      g,
      'Right',
      true,
    );
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 16, 12),
      new THREE.MeshStandardMaterial({ color: '#f4f4f4' }),
    );
    ballMesh.castShadow = true;
    scene.add(ballMesh);
    const state: PlayerSteeringState = {
      currentPos: new THREE.Vector3(x0, 0, 0),
      targetPos: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      facingAngle: 0,
      speed: 0,
      isKicking: false,
      isTackling: false,
      isDiving: false,
    };
    return { c, x0, g, rig, state, ball: new THREE.Vector3(), ballMesh };
  });

  const cams = rigs.map(() => new THREE.PerspectiveCamera(30, 1, 0.1, 200));
  const cols = rigs.length <= 1 ? 1 : rigs.length <= 4 ? 2 : rigs.length <= 6 ? 3 : 3;
  const rowsN = Math.ceil(rigs.length / cols);
  const labels = rigs.map((r) => {
    const d = document.createElement('div');
    d.className = 'lbl';
    d.textContent = r.c.name;
    document.body.appendChild(d);
    return d;
  });

  const step = (t: number, dt: number) => {
    world?.step();
    for (const r of rigs) {
      const s = r.state;
      s.isTackling = false;
      s.isDiving = false;
      s.isKicking = false;
      s.isCelebrating = false;
      s.kickDt = undefined;
      s.kickHigh = false;
      s.slide = false;
      r.c.drive(t, s, r.ball, r.x0);
      s.speed = s.velocity.length();
      let fallen = false;
      if (r.c.name === 'foul' && RAPIER && world) {
        const k = t % 5;
        if (k >= 1.0 && k < 3.1) {
          if (!ragdoll) {
            const { segs, frameQ } = r.rig.ragdollSegments();
            ragdoll = new Ragdoll(
              RAPIER,
              world,
              segs,
              frameQ,
              new THREE.Vector3(0, 0, 6),
              new THREE.Vector3(0, 0, 1),
              1,
              (8 << 16) | 1,
            );
          }
          fallen = true;
          const pel = ragdoll.pelvis(new THREE.Vector3());
          s.currentPos.set(pel.x, 0, pel.z);
        } else if (ragdoll) {
          const pel = ragdoll.pelvis(new THREE.Vector3());
          s.currentPos.set(pel.x, 0, pel.z);
          ragdoll.dispose();
          ragdoll = null;
        }
      }
      r.g.position.copy(s.currentPos);
      r.g.rotation.y = s.facingAngle;
      r.rig.update(dt, { state: s, ball: r.ball, fallen, ragdoll: fallen ? ragdoll : null });
      r.ballMesh.position.copy(r.ball);
    }
  };

  const render = () => {
    const W = innerWidth;
    const H = innerHeight;
    const w = Math.floor(W / cols);
    const h = Math.floor(H / rowsN);
    renderer.setScissorTest(true);
    rigs.forEach((r, i) => {
      const cx = (i % cols) * w;
      const cy = H - (Math.floor(i / cols) + 1) * h;
      const cam = cams[i]!;
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      const p = r.g.position;
      const side = params.get('view') === 'side';
      cam.position.set(p.x + (side ? 5 : 3.4), 1.3, p.z + (side ? 0 : 2.8));
      cam.lookAt(p.x, 0.85, p.z);
      renderer.setViewport(cx, cy, w, h);
      renderer.setScissor(cx, cy, w, h);
      renderer.render(scene, cam);
      const l = labels[i]!;
      l.style.left = cx + 'px';
      l.style.top = H - cy - h + 'px';
    });
  };

  const DT = 1 / 60;
  let t = 0;
  if (fixedT !== null) {
    while (t < fixedT) {
      step(t, DT);
      t += DT;
    }
    render();
    document.title = 'ready';
    if (params.has('debug')) {
      const pre = document.createElement('pre');
      pre.id = 'dbg';
      pre.style.cssText =
        'position:absolute;left:0;bottom:0;margin:0;padding:6px;background:#000c;color:#0f0;font:12px monospace;white-space:pre-wrap;width:100%';
      const r0 = rigs[0]!;
      const hp = r0.rig.root.getObjectByName('Hips')!.getWorldPosition(new THREE.Vector3());
      pre.textContent = JSON.stringify({
        t,
        group: r0.g.position.toArray().map((x) => +x.toFixed(2)),
        hipsWorld: hp.toArray().map((x) => +x.toFixed(2)),
        ragdoll: ragdoll ? ragdoll.debug() : null,
      }).replace(/,"/g, ', "');
      document.body.appendChild(pre);
    }
  } else {
    const loop = () => {
      step(t, DT);
      t += DT;
      render();
      requestAnimationFrame(loop);
    };
    loop();
  }
});
