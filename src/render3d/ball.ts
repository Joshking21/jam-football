// Implements SPEC §14.2, ART-DIRECTION §4.3 3D Match Ball & Shadow Decal
import * as THREE from 'three';
import { createSafeCanvas } from './canvasHelper';

export interface BallBundle {
  mesh: THREE.Mesh;
  shadow: THREE.Mesh;
  setPosition: (x: number, y: number, z: number) => void;
  getPosition: () => THREE.Vector3;
  updateRotation: (velocity: THREE.Vector3, delta: number) => void;
  dispose: () => void;
}

export function createBall(): BallBundle {
  const radius = 0.11; // 0.22m diameter per FIFA / SPEC §14.2
  const ballGeom = new THREE.SphereGeometry(radius, 24, 24);

  // Procedural canvas pattern (white ball with navy and pitch-green swirl panels)
  const canvas = createBallCanvas();
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const ballMat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.35,
    metalness: 0.05,
  });

  const mesh = new THREE.Mesh(ballGeom, ballMat);
  mesh.castShadow = true;
  mesh.position.set(0, radius, 0);

  // Soft Blob Shadow Decal under the ball
  const shadowCanvas = createSafeCanvas(64, 64);
  const sCtx = shadowCanvas.getContext('2d');
  if (sCtx) {
    const grad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 64, 64);
  }

  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadowGeom = new THREE.PlaneGeometry(0.5, 0.5);
  shadowGeom.rotateX(-Math.PI / 2);

  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const shadow = new THREE.Mesh(shadowGeom, shadowMat);
  shadow.position.set(0, 0.015, 0);

  return {
    mesh,
    shadow,
    setPosition: (x: number, y: number, z: number) => {
      mesh.position.set(x, Math.max(radius, y), z);

      // Ground shadow tracks ball X & Z, fading & scaling with altitude
      shadow.position.set(x, 0.015, z);
      const height = Math.max(0, y - radius);
      const scale = Math.max(0.3, 1.0 - height * 0.08);
      shadow.scale.set(scale, 1, scale);
      shadowMat.opacity = Math.max(0.1, 0.65 * (1.0 - height * 0.12));
    },
    getPosition: () => mesh.position,
    updateRotation: (velocity: THREE.Vector3, delta: number) => {
      const speed = velocity.length();
      if (speed > 0.05) {
        // Roll around an axis perpendicular to velocity and up
        const axis = new THREE.Vector3(-velocity.z, 0, velocity.x).normalize();
        const angle = (speed / radius) * delta;
        mesh.rotateOnWorldAxis(axis, angle);
      }
    },
    dispose: () => {
      ballGeom.dispose();
      ballMat.dispose();
      texture.dispose();
      shadowGeom.dispose();
      shadowMat.dispose();
      shadowTex.dispose();
    },
  };
}

function createBallCanvas(): HTMLCanvasElement {
  const canvas = createSafeCanvas(512, 256);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // White base
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Modern swirl panels (navy #0B1F3A and pitch green #2E8B57 per ART-DIRECTION §4.3)
  const drawPanel = (cx: number, cy: number, r: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.4, r * 0.7, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
  };

  const panels = [
    { x: 120, y: 80, r: 42, col: '#0B1F3A' },
    { x: 150, y: 110, r: 28, col: '#2E8B57' },
    { x: 380, y: 90, r: 45, col: '#0B1F3A' },
    { x: 350, y: 120, r: 30, col: '#2E8B57' },
    { x: 250, y: 190, r: 40, col: '#0B1F3A' },
    { x: 270, y: 210, r: 25, col: '#2E8B57' },
  ];

  panels.forEach((p) => drawPanel(p.x, p.y, p.r, p.col));

  // Subtle seam lines
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 2;
  for (let x = 0; x < canvas.width; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 64, canvas.height);
    ctx.stroke();
  }

  return canvas;
}
