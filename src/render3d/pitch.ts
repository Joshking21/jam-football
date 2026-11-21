// Implements SPEC §14.2, §14.10, ART-DIRECTION §3.5 3D Pitch and Lines
import * as THREE from 'three';
import { RENDER_CONFIG } from '../config/balance';
import { WeatherType, QualityPreset } from './types';
import { createSafeCanvas } from './canvasHelper';

export interface PitchMeshBundle {
  mesh: THREE.Mesh;
  dispose: () => void;
}

export function createPitch(
  weather: WeatherType = 'dry',
  quality: QualityPreset = 'Medium',
): PitchMeshBundle {
  const cfg = RENDER_CONFIG.pitch;
  const resolution = quality === 'Low' ? 2048 : 4096;
  const canvas = createSafeCanvas(resolution, Math.round((resolution * cfg.width) / cfg.length));

  const ctx = canvas.getContext('2d');
  if (ctx) {
    drawPitchTexture(ctx, canvas.width, canvas.height, cfg);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = quality === 'Low' ? 1 : 8;

  const isRain = weather === 'rain';
  const roughness = isRain ? cfg.wetRoughness : cfg.dryRoughness;

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness,
    metalness: 0.05,
    envMapIntensity: isRain ? 1.1 : 0.5,
  });

  const geometry = new THREE.PlaneGeometry(cfg.length, cfg.width, 32, 32);
  geometry.rotateX(-Math.PI / 2); // Lay flat on X-Z plane (y = 0)

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = quality !== 'Low';
  mesh.position.set(0, 0, 0);

  return {
    mesh,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}

function drawPitchTexture(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cfg: typeof RENDER_CONFIG.pitch,
): void {
  // 1. Run-off grass (darker base outside the 105x68 playing line)
  ctx.fillStyle = '#2F5423';
  ctx.fillRect(0, 0, w, h);

  // Playing field bounds in pixels
  const marginX = ((cfg.length - cfg.playLength) / 2 / cfg.length) * w;
  const marginY = ((cfg.width - cfg.playWidth) / 2 / cfg.width) * h;
  const fieldW = w - marginX * 2;
  const fieldH = h - marginY * 2;

  // Scale: pixels per meter
  const ppmX = fieldW / cfg.playLength;
  const ppmY = fieldH / cfg.playWidth;

  // 2. Mowing stripes inside playing field (12 stripes along length)
  const stripeWidth = fieldW / cfg.stripeCount;
  for (let i = 0; i < cfg.stripeCount; i++) {
    // 6% brightness contrast per ART-DIRECTION §3.5
    ctx.fillStyle = i % 2 === 0 ? '#3E6B2F' : '#376029';
    ctx.fillRect(marginX + i * stripeWidth, marginY, stripeWidth, fieldH);
  }

  // 3. FIFA Line markings (drawn in #F2F2EC)
  ctx.strokeStyle = cfg.linePaint;
  ctx.fillStyle = cfg.linePaint;
  const lineWidth = Math.max(2, 0.12 * ppmX);
  ctx.lineWidth = lineWidth;

  // Outer Touchlines & Goal lines
  ctx.strokeRect(marginX, marginY, fieldW, fieldH);

  // Halfway line
  const midX = marginX + fieldW / 2;
  ctx.beginPath();
  ctx.moveTo(midX, marginY);
  ctx.lineTo(midX, marginY + fieldH);
  ctx.stroke();

  // Centre circle (r = 9.15m) and Centre spot (r = 0.25m)
  const midY = marginY + fieldH / 2;
  const rCentre = 9.15 * ppmX;
  ctx.beginPath();
  ctx.arc(midX, midY, rCentre, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(midX, midY, 0.25 * ppmX, 0, Math.PI * 2);
  ctx.fill();

  // Helper for End Boxes (Left & Right)
  const drawEndMarkings = (isLeft: boolean) => {
    const goalX = isLeft ? marginX : marginX + fieldW;
    const dir = isLeft ? 1 : -1;

    // Penalty Area: 16.5m deep, 40.32m wide
    const penW = 16.5 * ppmX;
    const penH = 40.32 * ppmY;
    const penTop = midY - penH / 2;
    ctx.strokeRect(isLeft ? goalX : goalX - penW, penTop, penW, penH);

    // Six-yard Box: 5.5m deep, 18.32m wide
    const sixW = 5.5 * ppmX;
    const sixH = 18.32 * ppmY;
    const sixTop = midY - sixH / 2;
    ctx.strokeRect(isLeft ? goalX : goalX - sixW, sixTop, sixW, sixH);

    // Penalty Spot: 11m from goal line
    const penSpotX = goalX + dir * (11 * ppmX);
    ctx.beginPath();
    ctx.arc(penSpotX, midY, 0.25 * ppmX, 0, Math.PI * 2);
    ctx.fill();

    // Penalty Arc (D): r = 9.15m from penalty spot, only outside the box
    ctx.save();
    ctx.beginPath();
    // Clip out the penalty area box so only the outer arc is drawn
    ctx.rect(0, 0, w, h);
    const boxX = isLeft ? goalX : goalX - penW;
    ctx.rect(boxX + (isLeft ? penW : 0), penTop, isLeft ? -penW : penW, penH);
    ctx.clip('evenodd');

    ctx.beginPath();
    ctx.arc(penSpotX, midY, 9.15 * ppmX, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  drawEndMarkings(true);
  drawEndMarkings(false);

  // 4. Corner Arcs: r = 1m at all 4 corners
  const rCorner = 1.0 * ppmX;
  const corners = [
    { x: marginX, y: marginY, start: 0, end: Math.PI / 2 },
    { x: marginX + fieldW, y: marginY, start: Math.PI / 2, end: Math.PI },
    { x: marginX, y: marginY + fieldH, start: -Math.PI / 2, end: 0 },
    { x: marginX + fieldW, y: marginY + fieldH, start: Math.PI, end: (3 * Math.PI) / 2 },
  ];

  corners.forEach((c) => {
    ctx.beginPath();
    ctx.arc(c.x, c.y, rCorner, c.start, c.end);
    ctx.stroke();
  });
}
