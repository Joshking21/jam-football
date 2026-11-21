// Implements SPEC §14.2, §14.10, ART-DIRECTION §4.4 3D Stadium, Stands, Floodlights & Sponsors
import * as THREE from 'three';
import { Club } from '../core/types';
import { QualityPreset } from './types';
import { createSafeCanvas } from './canvasHelper';

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

export function createStadium(homeClub: Club, quality: QualityPreset = 'Medium'): StadiumBundle {
  const group = new THREE.Group();
  group.name = 'Stadium';

  const clubColor = new THREE.Color(homeClub.colors.primary);
  const concreteColor = new THREE.Color(0x3a3d45);
  const roofColor = new THREE.Color(0x23262c);
  const steelColor = new THREE.Color(0x777c85);

  const seatMaterial = new THREE.MeshStandardMaterial({
    color: clubColor,
    roughness: 0.6,
    metalness: 0.1,
  });

  const concreteMaterial = new THREE.MeshStandardMaterial({
    color: concreteColor,
    roughness: 0.9,
    metalness: 0.05,
  });

  const roofMaterial = new THREE.MeshStandardMaterial({
    color: roofColor,
    roughness: 0.8,
    metalness: 0.2,
  });

  const steelMaterial = new THREE.MeshStandardMaterial({
    color: steelColor,
    roughness: 0.4,
    metalness: 0.7,
  });

  const lampMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff0da,
    emissive: new THREE.Color(0xfff0da),
    emissiveIntensity: 5.0,
    roughness: 0.2,
  });

  // 1. Build Stepped Stands
  // Side Stand: length 112m, width 14m, height 12m, 8 stepped tiers
  const createStand = (
    length: number,
    depth: number,
    height: number,
    tiers: number,
    pos: THREE.Vector3,
    rotY: number,
  ) => {
    const standGroup = new THREE.Group();
    standGroup.position.copy(pos);
    standGroup.rotation.y = rotY;

    // Concrete base wedge
    const tierDepth = depth / tiers;
    const tierHeight = height / tiers;

    for (let t = 0; t < tiers; t++) {
      const stepGeom = new THREE.BoxGeometry(length, tierHeight * (t + 1), tierDepth);
      const stepMesh = new THREE.Mesh(stepGeom, concreteMaterial);
      stepMesh.position.set(0, (tierHeight * (t + 1)) / 2, t * tierDepth + tierDepth / 2);
      stepMesh.receiveShadow = quality !== 'Low';
      standGroup.add(stepMesh);

      // Seat row on top of step
      const seatGeom = new THREE.BoxGeometry(length - 2, 0.35, tierDepth * 0.7);
      const seatMesh = new THREE.Mesh(seatGeom, seatMaterial);
      seatMesh.position.set(0, tierHeight * (t + 1) + 0.18, t * tierDepth + tierDepth / 2);
      standGroup.add(seatMesh);
    }

    // Roof Canopy
    const roofGeom = new THREE.BoxGeometry(length + 4, 0.4, depth + 4);
    const roof = new THREE.Mesh(roofGeom, roofMaterial);
    roof.position.set(0, height + 4, depth / 2 - 2);
    roof.rotation.x = 0.08; // Slight pitch
    roof.castShadow = quality !== 'Low';
    standGroup.add(roof);

    // Roof Support Pillars
    const pillarCount = 6;
    for (let p = 0; p < pillarCount; p++) {
      const px = -length / 2 + (p / (pillarCount - 1)) * length;
      const pillarGeom = new THREE.CylinderGeometry(0.2, 0.2, height + 4, 8);
      const pillar = new THREE.Mesh(pillarGeom, steelMaterial);
      pillar.position.set(px, (height + 4) / 2, depth);
      standGroup.add(pillar);
    }

    group.add(standGroup);
  };

  // Two Side Stands (length 114m, outside touchlines at z = ±40m)
  createStand(114, 15, 13, 8, new THREE.Vector3(0, 0, 40), 0);
  createStand(114, 15, 13, 8, new THREE.Vector3(0, 0, -40), Math.PI);

  // Two End Stands (length 76m, behind goals at x = ±59m)
  createStand(76, 13, 11, 7, new THREE.Vector3(59, 0, 0), -Math.PI / 2);
  createStand(76, 13, 11, 7, new THREE.Vector3(-59, 0, 0), Math.PI / 2);

  // 2. Corner Floodlight Towers (SPEC §14.2: 45m lattice towers at x = ±62, z = ±42)
  const floodlightPositions: THREE.Vector3[] = [
    new THREE.Vector3(-62, 42, -42),
    new THREE.Vector3(62, 42, -42),
    new THREE.Vector3(-62, 42, 42),
    new THREE.Vector3(62, 42, 42),
  ];

  floodlightPositions.forEach((pos) => {
    const towerGroup = new THREE.Group();
    towerGroup.position.set(pos.x, 0, pos.z);

    // Steel pole
    const poleGeom = new THREE.CylinderGeometry(0.6, 1.2, pos.y, 8);
    const pole = new THREE.Mesh(poleGeom, steelMaterial);
    pole.position.set(0, pos.y / 2, 0);
    pole.castShadow = quality === 'High';
    towerGroup.add(pole);

    // Lamp Bank Head (4x6 emissive bank angled 25 deg down to pitch)
    const headGeom = new THREE.BoxGeometry(6, 4, 1.2);
    const head = new THREE.Mesh(headGeom, steelMaterial);
    head.position.set(0, pos.y, 0);

    // Look at pitch center
    const target = new THREE.Vector3(0, 0, 0);
    head.lookAt(target);

    // Lamp Face (Emissive panel)
    const lampFaceGeom = new THREE.PlaneGeometry(5.4, 3.4);
    const lampFace = new THREE.Mesh(lampFaceGeom, lampMaterial);
    lampFace.position.set(0, 0, 0.61);
    head.add(lampFace);

    towerGroup.add(head);
    group.add(towerGroup);
  });

  // 3. Perimeter Advertising Boards (1m high at 4m outside touchline: x = ±56.5, z = ±38)
  const adCanvas = createAdBoardCanvas();
  const adTexture = new THREE.CanvasTexture(adCanvas);
  adTexture.wrapS = THREE.RepeatWrapping;
  adTexture.wrapT = THREE.ClampToEdgeWrapping;

  const adMaterial = new THREE.MeshStandardMaterial({
    map: adTexture,
    roughness: 0.4,
    metalness: 0.1,
  });

  // Side boards (along z = ±38, length 113m)
  const createAdStrip = (len: number, pos: THREE.Vector3, rotY: number) => {
    const tex = adTexture.clone();
    tex.repeat.set(len / 12, 1);
    const mat = adMaterial.clone();
    mat.map = tex;

    const geom = new THREE.BoxGeometry(len, 1.0, 0.15);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(pos);
    mesh.position.y = 0.5;
    mesh.rotation.y = rotY;
    mesh.castShadow = quality !== 'Low';
    group.add(mesh);
  };

  createAdStrip(113, new THREE.Vector3(0, 0, 38), 0);
  createAdStrip(113, new THREE.Vector3(0, 0, -38), Math.PI);
  createAdStrip(76, new THREE.Vector3(56.5, 0, 0), -Math.PI / 2);
  createAdStrip(76, new THREE.Vector3(-56.5, 0, 0), Math.PI / 2);

  return {
    group,
    floodlightPositions,
    dispose: () => {
      seatMaterial.dispose();
      concreteMaterial.dispose();
      roofMaterial.dispose();
      steelMaterial.dispose();
      lampMaterial.dispose();
      adMaterial.dispose();
      adTexture.dispose();
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
        }
      });
    },
  };
}

function createAdBoardCanvas(): HTMLCanvasElement {
  const canvas = createSafeCanvas(2048, 128);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const blockWidth = canvas.width / SPONSORS.length;
  ctx.font = 'bold 36px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  SPONSORS.forEach((sponsor, i) => {
    const x = i * blockWidth;
    // Sponsor panel background with subtle accent borders
    const hue = (i * 35) % 360;
    ctx.fillStyle = `hsl(${hue}, 40%, 15%)`;
    ctx.fillRect(x + 4, 6, blockWidth - 8, canvas.height - 12);

    ctx.strokeStyle = `hsl(${hue}, 70%, 45%)`;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 4, 6, blockWidth - 8, canvas.height - 12);

    // Text
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(sponsor.toUpperCase(), x + blockWidth / 2, canvas.height / 2);
  });

  return canvas;
}
