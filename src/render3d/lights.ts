// Implements SPEC §14.2, §14.10, ART-DIRECTION §3 3D Lighting, Sky, Fog & Rain
import * as THREE from 'three';
import { RENDER_CONFIG } from '../config/balance';
import { QualityPreset, TimeSlot, WeatherType } from './types';

export interface LightsBundle {
  group: THREE.Group;
  fog?: THREE.FogExp2;
  update: (delta: number) => void;
  dispose: () => void;
}

export function createLights(
  timeSlot: TimeSlot = 'night',
  weather: WeatherType = 'dry',
  floodlightCoords: THREE.Vector3[] = [],
  quality: QualityPreset = 'Medium',
): LightsBundle {
  const group = new THREE.Group();
  group.name = 'Lighting';

  const cfg = RENDER_CONFIG.timeSlots[timeSlot];

  // 1. Hemisphere Ambient Light (Sky / Ground gradient)
  const hemiLight = new THREE.HemisphereLight(
    cfg.hemisphere.sky,
    cfg.hemisphere.ground,
    cfg.hemisphere.intensity,
  );
  group.add(hemiLight);

  // 2. Main Lights (Floodlights or Sun)
  const lightsToDispose: THREE.Light[] = [hemiLight];

  if (timeSlot === 'afternoon') {
    // Afternoon Sun (Directional at 38 deg elevation)
    const sunLight = new THREE.DirectionalLight(cfg.keyLight.color, cfg.keyLight.intensity);
    sunLight.position.set(40, 55, -45);
    sunLight.target.position.set(0, 0, 0);

    if (quality !== 'Low') {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = quality === 'High' ? 2048 : 1024;
      sunLight.shadow.mapSize.height = quality === 'High' ? 2048 : 1024;
      sunLight.shadow.camera.near = 10;
      sunLight.shadow.camera.far = 180;
      sunLight.shadow.camera.left = -65;
      sunLight.shadow.camera.right = 65;
      sunLight.shadow.camera.top = 50;
      sunLight.shadow.camera.bottom = -50;
      sunLight.shadow.bias = -0.0005;
    }

    group.add(sunLight);
    group.add(sunLight.target);
    lightsToDispose.push(sunLight);
  } else {
    // Night / Evening Floodlights (4 corners pointing 20m inside corners per ART-DIRECTION §3.3)
    floodlightCoords.forEach((coord, idx) => {
      const spot = new THREE.SpotLight(
        cfg.keyLight.color,
        cfg.keyLight.intensity * 1.5,
        140,
        Math.PI / 3.2,
        0.35,
        1.2,
      );
      spot.position.copy(coord);

      // Aim 20m inside the corner of the pitch
      const targetX = coord.x > 0 ? 32.5 : -32.5;
      const targetZ = coord.z > 0 ? 14 : -14;
      spot.target.position.set(targetX, 0, targetZ);

      // Only the floodlight nearest the default broadcast camera casts shadows (SPEC §14.2)
      if (idx === 0 && quality !== 'Low') {
        spot.castShadow = true;
        spot.shadow.mapSize.width = quality === 'High' ? 2048 : 1024;
        spot.shadow.mapSize.height = quality === 'High' ? 2048 : 1024;
        spot.shadow.camera.near = 10;
        spot.shadow.camera.far = 160;
        spot.shadow.bias = -0.0004;
      }

      group.add(spot);
      group.add(spot.target);
      lightsToDispose.push(spot);
    });
  }

  // 3. Faint Starfield at Night (600 points per ART-DIRECTION §3.1)
  let starsGeom: THREE.BufferGeometry | undefined;
  let starsMat: THREE.PointsMaterial | undefined;
  if (cfg.hasStars && quality !== 'Low') {
    const starCount = cfg.starCount;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * (Math.PI / 2.2); // Upper dome only
      const r = 280;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi) + 10;
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starsGeom = new THREE.BufferGeometry();
    starsGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starsMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.2,
      transparent: true,
      opacity: 0.45,
    });
    const starField = new THREE.Points(starsGeom, starsMat);
    group.add(starField);
  }

  // 4. Atmospheric Haze Fog (FogExp2)
  let fog: THREE.FogExp2 | undefined;
  if (quality !== 'Low') {
    const density = cfg.hazeDensity + (weather === 'rain' ? 0.0008 : 0);
    fog = new THREE.FogExp2(cfg.skyHorizon, density);
  }

  // 5. Rain Particle System
  let rainGeom: THREE.BufferGeometry | undefined;
  let rainMat: THREE.LineBasicMaterial | undefined;
  let rainLines: THREE.LineSegments | undefined;
  const rainSpeed = 36; // m/s falling

  if (weather === 'rain' && quality !== 'Low') {
    const dropCount = quality === 'High' ? 4000 : 1800;
    const positions = new Float32Array(dropCount * 6); // 2 vertices per rain streak

    for (let i = 0; i < dropCount; i++) {
      const rx = (Math.random() - 0.5) * 130;
      const rz = (Math.random() - 0.5) * 90;
      const ry = Math.random() * 45;
      const streakLen = 0.8;

      positions[i * 6] = rx;
      positions[i * 6 + 1] = ry;
      positions[i * 6 + 2] = rz;

      positions[i * 6 + 3] = rx - 0.15; // slight wind slant
      positions[i * 6 + 4] = ry - streakLen;
      positions[i * 6 + 5] = rz;
    }

    rainGeom = new THREE.BufferGeometry();
    rainGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    rainMat = new THREE.LineBasicMaterial({
      color: 0xc8d8e8,
      transparent: true,
      opacity: 0.35,
    });
    rainLines = new THREE.LineSegments(rainGeom, rainMat);
    group.add(rainLines);
  }

  return {
    group,
    fog,
    update: (delta: number) => {
      // Update rain streak drops
      if (rainLines && rainGeom) {
        const pos = rainGeom.attributes.position;
        if (!pos) return;
        const arr = pos.array as Float32Array;
        for (let i = 0; i < pos.count; i += 2) {
          const idx1 = i * 3 + 1;
          const idx2 = (i + 1) * 3 + 1;
          if (idx1 >= arr.length || idx2 >= arr.length) continue;
          arr[idx1] = (arr[idx1] ?? 0) - rainSpeed * delta;
          arr[idx2] = (arr[idx2] ?? 0) - rainSpeed * delta;

          // Wrap to top when hitting the ground
          if (arr[idx1] < 0) {
            const newY = 40 + Math.random() * 5;
            arr[idx1] = newY;
            arr[idx2] = newY - 0.8;
          }
        }
        pos.needsUpdate = true;
      }
    },
    dispose: () => {
      lightsToDispose.forEach((l) => l.dispose());
      if (starsGeom) starsGeom.dispose();
      if (starsMat) starsMat.dispose();
      if (rainGeom) rainGeom.dispose();
      if (rainMat) rainMat.dispose();
    },
  };
}
