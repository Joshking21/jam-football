// Implements SPEC §14.2, §14.10, ART-DIRECTION §4.4: stadium, stands, floodlights, boards.
// v1.8 rebuild (REVIEW-M4 T6, T14): stepped raked stands with front and back walls, roofs with
// lit fascias, corner blocks that close the gaps, and seat colours painted with the crowd so a
// stand reads as full from the TV camera. Animated supporters sit on top (crowd.ts).
import * as THREE from 'three';
import { Club } from '../core/types';
import { QualityPreset } from './types';
import { createSafeCanvas } from './canvasHelper';
import {
  STANDS,
  StandDef,
  treadY,
  standDepth,
  standTop,
  standToWorld,
  isAwayBlock,
  hash01,
} from './standLayout';

export interface StadiumBundle {
  group: THREE.Group;
  floodlightPositions: THREE.Vector3[];
  dispose: () => void;
}

const SPONSORS = [
  'Halcyon Air',
  'Brightline Telecom',
  'Vanguard Steel',
  'Nordic Energy',
  'Kestrel Logistics',
  'Cobalt Dynamics',
  'Solas Solar',
  'Apex Rail',
  'Aura Water',
  'Onyx Motors',
  'Helios Bio',
  'Zephyr Freight',
];

/** Share of seats taken (painted crowd). The animated crowd sits on top of these. */
const OCCUPANCY = 0.86;

export function createStadium(
  homeClub: Club,
  quality: QualityPreset = 'Medium',
  awayClub?: Club,
): StadiumBundle {
  const group = new THREE.Group();
  group.name = 'Stadium';

  const home1 = new THREE.Color(homeClub.colors.primary);
  const home2 = new THREE.Color(homeClub.colors.secondary);
  const away1 = new THREE.Color(awayClub?.colors.primary ?? '#d9d9d9');
  const seatColor = home1.clone().lerp(new THREE.Color(0x1a1d22), 0.35);
  const concrete = new THREE.Color(0x4a4d54);
  const riserColor = new THREE.Color(0x2c2f35);

  const standMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.0,
  });
  const concreteMat = new THREE.MeshStandardMaterial({ color: concrete, roughness: 0.92 });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x2a2d33,
    roughness: 0.7,
    metalness: 0.25,
    side: THREE.DoubleSide,
  });
  const fasciaMat = new THREE.MeshStandardMaterial({
    color: home1,
    roughness: 0.55,
    metalness: 0.1,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: home2, roughness: 0.5 });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x8a8f98,
    roughness: 0.45,
    metalness: 0.6,
  });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff0da,
    emissive: new THREE.Color(0xfff0da),
    emissiveIntensity: 5.0,
    roughness: 0.2,
  });
  const stripMat = new THREE.MeshStandardMaterial({
    color: 0xfff4e2,
    emissive: new THREE.Color(0xfff4e2),
    emissiveIntensity: 1.6,
  });
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x1a1d22,
    emissive: new THREE.Color(0xffd9a0),
    emissiveIntensity: 0.9,
  });

  // Crowd palette for painted seats: mostly home colours, dark coats, some away in their block.
  const crowdHome = [
    home1,
    home1,
    home2,
    new THREE.Color(0x23262c),
    new THREE.Color(0x3a3530),
    new THREE.Color(0x1c2230),
    new THREE.Color(0x5a4a40),
  ];
  const crowdAway = [
    away1,
    away1,
    away1.clone().lerp(new THREE.Color(0xffffff), 0.3),
    new THREE.Color(0x23262c),
  ];

  const tmp = new THREE.Vector3();
  const geoms: THREE.BufferGeometry[] = [];

  const buildStand = (s: StandDef, sIdx: number) => {
    const positions: number[] = [];
    const colors: number[] = [];
    const quad = (
      a: THREE.Vector3,
      b: THREE.Vector3,
      c: THREE.Vector3,
      d: THREE.Vector3,
      col: THREE.Color,
    ) => {
      // Wound so faces point up (treads) and toward the pitch (risers), i.e. toward the camera.
      for (const v of [a, c, b, a, d, c]) {
        positions.push(v.x, v.y, v.z);
        colors.push(col.r, col.g, col.b);
      }
    };
    const P = (x: number, y: number, z: number) => standToWorld(s, x, y, z, new THREE.Vector3());
    const half = s.length / 2;
    const cell = 1.15;
    const cells = Math.floor(s.length / cell);
    for (let r = 0; r < s.rows; r++) {
      const y0 = s.frontWall + r * s.rowRise;
      const y1 = y0 + s.rowRise;
      const z0 = r * s.rowDepth;
      const z1 = z0 + s.rowDepth;
      // Riser (vertical), then tread (horizontal) split into seat cells with the crowd painted on.
      quad(P(-half, y0, z0), P(half, y0, z0), P(half, y1, z0), P(-half, y1, z0), riserColor);
      for (let c = 0; c < cells; c++) {
        const xa = -half + c * cell;
        const xb = xa + cell;
        const taken = hash01(sIdx, r, c) < OCCUPANCY;
        const away = isAwayBlock(s, (xa + xb) / 2);
        const pal = away ? crowdAway : crowdHome;
        const col = taken ? pal[Math.floor(hash01(c, r, sIdx + 7) * pal.length)]! : seatColor;
        quad(P(xa, y1, z0), P(xb, y1, z0), P(xb, y1, z1), P(xa, y1, z1), col);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    geoms.push(g);
    const mesh = new THREE.Mesh(g, standMat);
    mesh.receiveShadow = quality !== 'Low';
    group.add(mesh);

    const depth = standDepth(s);
    const top = standTop(s);
    const place = (mesh: THREE.Mesh, x: number, y: number, z: number) => {
      standToWorld(s, x, y, z, mesh.position);
      mesh.rotation.y = s.yaw;
      group.add(mesh);
    };

    // Front wall with a club-colour fascia and a thin trim line.
    const front = new THREE.BoxGeometry(s.length, s.frontWall, 0.3);
    geoms.push(front);
    place(new THREE.Mesh(front, fasciaMat), 0, s.frontWall / 2, -0.15);
    const trim = new THREE.BoxGeometry(s.length, 0.12, 0.32);
    geoms.push(trim);
    place(new THREE.Mesh(trim, trimMat), 0, s.frontWall - 0.1, -0.16);

    // Back wall up to the roof (or a parapet without one).
    const roofY = top + 5.5;
    const backH = s.roof ? roofY : top + 1.4;
    const back = new THREE.BoxGeometry(s.length + 0.6, backH, 0.5);
    geoms.push(back);
    place(new THREE.Mesh(back, concreteMat), 0, backH / 2, depth + 0.25);

    // Gable ends: close the rake's sides.
    [-1, 1].forEach((side) => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(depth, 0);
      shape.lineTo(depth, backH);
      shape.lineTo(0, s.frontWall);
      shape.closePath();
      const gg = new THREE.ExtrudeGeometry(shape, { depth: 0.4, bevelEnabled: false });
      geoms.push(gg);
      const m = new THREE.Mesh(gg, concreteMat);
      // Shape lies in its XY plane: map shape x → stand z, shape y → height, extrude → stand x.
      standToWorld(s, side * (s.length / 2) + (side > 0 ? 0 : 0.4), 0, 0, m.position);
      m.rotation.set(0, s.yaw - Math.PI / 2, 0);
      group.add(m);
    });

    if (s.roof) {
      // Cantilevered roof from the back wall over the rows, with a club-colour fascia and a light strip.
      const overhang = depth + 3;
      const roof = new THREE.BoxGeometry(s.length + 1, 0.35, overhang);
      geoms.push(roof);
      const roofMesh = new THREE.Mesh(roof, roofMat);
      place(roofMesh, 0, roofY, depth - overhang / 2);
      roofMesh.rotation.x = 0; // flat; the fascia gives it a face
      roofMesh.castShadow = quality !== 'Low';
      const fascia = new THREE.BoxGeometry(s.length + 1, 1.3, 0.25);
      geoms.push(fascia);
      place(new THREE.Mesh(fascia, fasciaMat), 0, roofY - 0.3, depth - overhang);
      const strip = new THREE.BoxGeometry(s.length - 2, 0.12, 0.12);
      geoms.push(strip);
      place(new THREE.Mesh(strip, stripMat), 0, roofY - 0.25, depth - overhang + 0.4);
      // Roof trusses along the back.
      const trussCount = Math.round(s.length / 14);
      const truss = new THREE.CylinderGeometry(0.18, 0.18, roofY, 8);
      geoms.push(truss);
      for (let i = 0; i <= trussCount; i++) {
        const x = -s.length / 2 + (i / trussCount) * s.length;
        place(new THREE.Mesh(truss, steelMat), x, roofY / 2, depth + 0.6);
      }
    }
  };

  STANDS.forEach(buildStand);

  // Corner blocks close the gaps between the stands (offices, lit windows).
  const cornerH = 13.5;
  const corner = new THREE.BoxGeometry(17, cornerH, 20);
  const windows = new THREE.BoxGeometry(17.05, 1.1, 20.05);
  geoms.push(corner, windows);
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) => {
      const m = new THREE.Mesh(corner, concreteMat);
      m.position.set(sx * 65.5, cornerH / 2, sz * 48);
      m.receiveShadow = quality !== 'Low';
      group.add(m);
      const w = new THREE.Mesh(windows, windowMat);
      w.position.set(sx * 65.5, cornerH - 3.5, sz * 48);
      group.add(w);
    }),
  );

  // Floodlight pylons on the corner blocks (SPEC §14.2).
  const floodlightPositions: THREE.Vector3[] = [
    new THREE.Vector3(-62, 42, -42),
    new THREE.Vector3(62, 42, -42),
    new THREE.Vector3(-62, 42, 42),
    new THREE.Vector3(62, 42, 42),
  ];
  const poleGeom = new THREE.CylinderGeometry(0.5, 1.0, 42, 8);
  const headGeom = new THREE.BoxGeometry(7, 4.2, 1.0);
  const faceGeom = new THREE.PlaneGeometry(6.4, 3.6);
  geoms.push(poleGeom, headGeom, faceGeom);
  floodlightPositions.forEach((pos) => {
    const pole = new THREE.Mesh(poleGeom, steelMat);
    pole.position.set(pos.x, 21, pos.z);
    pole.castShadow = quality === 'High';
    group.add(pole);
    const head = new THREE.Mesh(headGeom, steelMat);
    head.position.copy(pos);
    head.lookAt(tmp.set(0, 0, 0));
    const face = new THREE.Mesh(faceGeom, lampMat);
    face.position.set(0, 0, 0.51);
    head.add(face);
    group.add(head);
  });

  // Perimeter advertising boards (1 m high, 4 m outside the lines).
  const adCanvas = createAdBoardCanvas();
  const adTexture = new THREE.CanvasTexture(adCanvas);
  adTexture.colorSpace = THREE.SRGBColorSpace;
  adTexture.wrapS = THREE.RepeatWrapping;
  adTexture.wrapT = THREE.ClampToEdgeWrapping;
  const adMats: THREE.MeshStandardMaterial[] = [];
  const createAdStrip = (len: number, pos: THREE.Vector3, rotY: number) => {
    const tex = adTexture.clone();
    tex.needsUpdate = true;
    tex.repeat.set(len / 72, 1); // each sponsor gets 6 m of board
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.35, // LED boards glow a little
      roughness: 0.4,
    });
    adMats.push(mat);
    const geom = new THREE.BoxGeometry(len, 1.0, 0.15);
    geoms.push(geom);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(pos);
    mesh.position.y = 0.5;
    mesh.rotation.y = rotY;
    mesh.castShadow = quality !== 'Low';
    group.add(mesh);
  };
  createAdStrip(113, new THREE.Vector3(0, 0, 38), Math.PI);
  createAdStrip(113, new THREE.Vector3(0, 0, -38), 0);
  createAdStrip(76, new THREE.Vector3(56.5, 0, 0), -Math.PI / 2);
  createAdStrip(76, new THREE.Vector3(-56.5, 0, 0), Math.PI / 2);

  // Surround: a dark apron between the boards and the stands so nothing floats.
  const apron = new THREE.PlaneGeometry(150, 110);
  apron.rotateX(-Math.PI / 2);
  geoms.push(apron);
  const apronMat = new THREE.MeshStandardMaterial({ color: 0x24302a, roughness: 0.95 });
  const apronMesh = new THREE.Mesh(apron, apronMat);
  apronMesh.position.y = -0.02;
  apronMesh.receiveShadow = quality !== 'Low';
  group.add(apronMesh);

  return {
    group,
    floodlightPositions,
    dispose: () => {
      [
        standMat,
        concreteMat,
        roofMat,
        fasciaMat,
        trimMat,
        steelMat,
        lampMat,
        stripMat,
        windowMat,
        apronMat,
      ].forEach((m) => m.dispose());
      adMats.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
      adTexture.dispose();
      geoms.forEach((g) => g.dispose());
    },
  };
}

function createAdBoardCanvas(): HTMLCanvasElement {
  const canvas = createSafeCanvas(2048, 128);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const blockWidth = canvas.width / SPONSORS.length;
  ctx.font = 'bold 40px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  SPONSORS.forEach((sponsor, i) => {
    const x = i * blockWidth;
    const hue = (i * 35) % 360;
    ctx.fillStyle = `hsl(${hue}, 45%, 18%)`;
    ctx.fillRect(x + 2, 4, blockWidth - 4, canvas.height - 8);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(sponsor.toUpperCase(), x + blockWidth / 2, canvas.height / 2 + 2);
  });
  return canvas;
}

export { treadY };
