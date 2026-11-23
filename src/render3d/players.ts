// Implements SPEC §14.2, ART-DIRECTION §3.6 3D Procedural Player Figures & Kit Rendering
import * as THREE from 'three';
import { Club, Player, Side } from '../core/types';
import { RENDER_CONFIG } from '../config/balance';
import { Player3DVisual, QualityPreset } from './types';
import { createSafeCanvas } from './canvasHelper';
import { resolveMatchKits, ResolvedKit } from '../core/match/kits';

export interface PlayersBundle {
  group: THREE.Group;
  homePlayers: Player3DVisual[];
  awayPlayers: Player3DVisual[];
  referee: Player3DVisual;
  linesmen: Player3DVisual[];
  allPlayers: Map<string, Player3DVisual>;
  update: (delta: number) => void;
  updateNameTags: (carrierId: string | null, commentaryId: string | null, showAll: boolean) => void;
  dispose: () => void;
}

export function createPlayers(
  homeClub: Club,
  awayClub: Club,
  homeSquad: Player[],
  awaySquad: Player[],
  quality: QualityPreset = 'Medium',
): PlayersBundle {
  const group = new THREE.Group();
  group.name = 'Players';

  const homeVisuals: Player3DVisual[] = [];
  const awayVisuals: Player3DVisual[] = [];
  const allPlayers = new Map<string, Player3DVisual>();

  // Shared Shadow Material & Geometry
  const shadowCanvas = createShadowCanvas();
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadowGeom = new THREE.PlaneGeometry(0.8, 0.8);
  shadowGeom.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const resolvedKits = resolveMatchKits(homeClub, awayClub);

  const createSinglePlayerFigure = (
    player: Player | null,
    side: Side | 'referee',
    resolvedKit: ResolvedKit,
    num: number,
    isGK: boolean,
  ): Player3DVisual => {
    const pGroup = new THREE.Group();
    pGroup.name = player ? `Player_${player.id}` : `Ref_${num}`;

    // Skin & Hair Tone (Seeded per player or fixed for ref)
    const skinToneIdx = player
      ? Math.abs(hashString(player.id + 'skin')) % RENDER_CONFIG.skinTones.length
      : 1;
    const hairColorIdx = player
      ? Math.abs(hashString(player.id + 'hair')) % RENDER_CONFIG.hairColors.length
      : 0;

    const skinColor = new THREE.Color(RENDER_CONFIG.skinTones[skinToneIdx]);
    const hairColor = new THREE.Color(RENDER_CONFIG.hairColors[hairColorIdx]);

    const skinMaterial = new THREE.MeshStandardMaterial({
      color: skinColor,
      roughness: 0.55,
      metalness: 0.0,
    });

    const hairMaterial = new THREE.MeshStandardMaterial({
      color: hairColor,
      roughness: 0.85,
      metalness: 0.05,
    });

    // Kit Texture (Shirt + Collar/Trim + Pattern + Number on Back)
    const shirtCanvas = createShirtCanvas(resolvedKit, side, num, isGK);
    const shirtTexture = new THREE.CanvasTexture(shirtCanvas);
    shirtTexture.colorSpace = THREE.SRGBColorSpace;
    shirtTexture.needsUpdate = true;
    const shirtMaterial = new THREE.MeshStandardMaterial({
      map: shirtTexture,
      roughness: 0.7,
      metalness: 0.0,
    });

    const shortsMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(resolvedKit.shorts),
      roughness: 0.7,
      metalness: 0.0,
    });

    const socksMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(resolvedKit.socks),
      roughness: 0.65,
      metalness: 0.0,
    });

    const sockTrimMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(resolvedKit.shirt2),
      roughness: 0.65,
      metalness: 0.0,
    });

    const bootsMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x1a1a1a),
      roughness: 0.35,
      metalness: 0.1,
    });

    // 1. Torso (Capsule/Cylinder from y = 0.85 to 1.45m)
    const torsoHeight = 0.55;
    const torsoRadius = 0.19;
    const torsoGeom = new THREE.CylinderGeometry(torsoRadius, torsoRadius * 0.9, torsoHeight, 12);
    torsoGeom.translate(0, 0.85 + torsoHeight / 2, 0);
    const torso = new THREE.Mesh(torsoGeom, shirtMaterial);
    torso.castShadow = quality !== 'Low';
    pGroup.add(torso);

    // 2. Head & Hair (Sphere at y = 1.62m, r = 0.11m)
    const headGeom = new THREE.SphereGeometry(0.11, 12, 12);
    headGeom.translate(0, 1.62, 0);
    const head = new THREE.Mesh(headGeom, skinMaterial);
    head.castShadow = quality !== 'Low';
    pGroup.add(head);

    const hairGeom = new THREE.SphereGeometry(0.115, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    hairGeom.translate(0, 1.63, 0);
    const hair = new THREE.Mesh(hairGeom, hairMaterial);
    pGroup.add(hair);

    // 3. Shorts (Waist/Hips at y = 0.72m, height 0.24m)
    const shortsGeom = new THREE.CylinderGeometry(0.2, 0.18, 0.22, 12);
    shortsGeom.translate(0, 0.75, 0);
    const shorts = new THREE.Mesh(shortsGeom, shortsMaterial);
    shorts.castShadow = quality !== 'Low';
    pGroup.add(shorts);

    // 4. Limbs (Left Leg & Right Leg pivot at y = 0.68m)
    const createLeg = (isLeft: boolean): THREE.Group => {
      const legGroup = new THREE.Group();
      legGroup.position.set(isLeft ? -0.1 : 0.1, 0.68, 0);

      // Thigh skin (upper leg)
      const thighGeom = new THREE.CylinderGeometry(0.068, 0.062, 0.2, 8);
      thighGeom.translate(0, -0.1, 0);
      const thighMesh = new THREE.Mesh(thighGeom, skinMaterial);
      thighMesh.castShadow = quality !== 'Low';
      legGroup.add(thighMesh);

      // Sock cuff band (club secondary trim)
      const cuffGeom = new THREE.CylinderGeometry(0.064, 0.062, 0.05, 8);
      cuffGeom.translate(0, -0.225, 0);
      const cuffMesh = new THREE.Mesh(cuffGeom, sockTrimMaterial);
      legGroup.add(cuffMesh);

      // Main Sock
      const sockGeom = new THREE.CylinderGeometry(0.062, 0.052, 0.42, 8);
      sockGeom.translate(0, -0.45, 0);
      const sockMesh = new THREE.Mesh(sockGeom, socksMaterial);
      sockMesh.castShadow = quality !== 'Low';
      legGroup.add(sockMesh);

      // Boot
      const bootGeom = new THREE.BoxGeometry(0.09, 0.07, 0.18);
      bootGeom.translate(0, -0.65, 0.04);
      const bootMesh = new THREE.Mesh(bootGeom, bootsMaterial);
      legGroup.add(bootMesh);

      return legGroup;
    };

    const leftLeg = createLeg(true);
    const rightLeg = createLeg(false);
    pGroup.add(leftLeg);
    pGroup.add(rightLeg);

    // 5. Arms (Left Arm & Right Arm pivot at y = 1.35m)
    // Shirt sleeves + skin forearms
    const createArm = (isLeft: boolean): THREE.Group => {
      const armGroup = new THREE.Group();
      armGroup.position.set(isLeft ? -0.25 : 0.25, 1.35, 0);

      // Shirt sleeve (upper arm in kit shirt material)
      const sleeveGeom = new THREE.CylinderGeometry(0.056, 0.051, 0.18, 8);
      sleeveGeom.translate(0, -0.09, 0);
      const sleeveMesh = new THREE.Mesh(sleeveGeom, shirtMaterial);
      sleeveMesh.castShadow = quality !== 'Low';
      armGroup.add(sleeveMesh);

      // Forearm (skin material)
      const forearmGeom = new THREE.CylinderGeometry(0.048, 0.042, 0.32, 8);
      forearmGeom.translate(0, -0.34, 0);
      const forearmMesh = new THREE.Mesh(forearmGeom, skinMaterial);
      forearmMesh.castShadow = quality !== 'Low';
      armGroup.add(forearmMesh);

      return armGroup;
    };

    const leftArm = createArm(true);
    const rightArm = createArm(false);
    pGroup.add(leftArm);
    pGroup.add(rightArm);

    // 6. Ground Shadow Decal
    const shadow = new THREE.Mesh(shadowGeom, shadowMat);
    shadow.position.set(0, 0.015, 0);
    pGroup.add(shadow);

    // 7. Overhead Name Tag Sprite (Barlow Condensed 600, Kit Chip)
    let nameTag: THREE.Sprite | undefined;
    if (player) {
      nameTag = createNameTagSprite(num, player.lastName, resolvedKit);
      nameTag.position.set(0, 2.05, 0);
      nameTag.visible = false;
      pGroup.add(nameTag);
    }

    group.add(pGroup);

    return {
      id: player ? player.id : `ref_${num}`,
      side: side === 'referee' ? 'home' : side,
      number: num,
      name: player ? `${player.firstName} ${player.lastName}` : 'Official',
      group: pGroup,
      torso,
      head,
      hair,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      shadow,
      nameTag,
      currentSpeed: 0,
      limbPhase: Math.random() * Math.PI * 2,
      isKicking: false,
      isTackling: false,
      isDiving: false,
    };
  };

  // Build 11 Home Starters
  const homeStarters = homeSquad.slice(0, 11);
  homeStarters.forEach((p, idx) => {
    const isGK = idx === 0;
    const kit = isGK ? resolvedKits.homeGk : resolvedKits.homeOutfield;
    const visual = createSinglePlayerFigure(p, 'home', kit, idx + 1, isGK);
    homeVisuals.push(visual);
    allPlayers.set(p.id, visual);
  });

  // Build 11 Away Starters
  const awayStarters = awaySquad.slice(0, 11);
  awayStarters.forEach((p, idx) => {
    const isGK = idx === 0;
    const kit = isGK ? resolvedKits.awayGk : resolvedKits.awayOutfield;
    const visual = createSinglePlayerFigure(p, 'away', kit, idx + 1, isGK);
    awayVisuals.push(visual);
    allPlayers.set(p.id, visual);
  });

  // Build Referee (in black, center pitch)
  const refKit: ResolvedKit = {
    shirt: '#16181C',
    shirt2: '#282C34',
    shorts: '#16181C',
    socks: '#16181C',
    text: '#ffffff',
    pattern: 'solid',
  };
  const referee = createSinglePlayerFigure(null, 'referee', refKit, 0, false);
  referee.group.position.set(0, 0, 0);

  // Build 2 Linesmen (touchlines)
  const linesman1 = createSinglePlayerFigure(null, 'referee', refKit, 1, false);
  const linesman2 = createSinglePlayerFigure(null, 'referee', refKit, 2, false);
  linesman1.group.position.set(0, 0, -34.5);
  linesman2.group.position.set(0, 0, 34.5);
  const linesmen: Player3DVisual[] = [linesman1, linesman2];

  return {
    group,
    homePlayers: homeVisuals,
    awayPlayers: awayVisuals,
    referee,
    linesmen,
    allPlayers,
    update: (delta: number) => {
      const updateLimbAnimation = (p: Player3DVisual) => {
        // Procedural leg & arm swing
        if (p.isDiving) {
          // Horizontal goalkeeper dive
          p.group.rotation.z = Math.PI / 2.3;
          p.group.position.y = 0.4;
          return;
        }

        p.group.rotation.z = 0;

        if (p.isTackling) {
          // Slide tackle pose
          p.leftLeg.rotation.x = -Math.PI / 2.2;
          p.rightLeg.rotation.x = Math.PI / 4;
          p.group.position.y = -0.3;
          return;
        }

        p.group.position.y = 0;

        if (p.isKicking) {
          // Aggressive forward kick on right leg
          p.rightLeg.rotation.x = -Math.PI / 2.4;
          p.leftLeg.rotation.x = Math.PI / 5;
          p.leftArm.rotation.x = -Math.PI / 3;
          p.rightArm.rotation.x = Math.PI / 3;
          return;
        }

        if (p.currentSpeed > 0.4) {
          // Running / Sprinting: swing frequency scales with speed
          const freq = Math.min(16, p.currentSpeed * 2.8);
          p.limbPhase += delta * freq;
          const swing = Math.sin(p.limbPhase) * Math.min(1.0, p.currentSpeed * 0.18);

          p.leftLeg.rotation.x = swing;
          p.rightLeg.rotation.x = -swing;
          p.leftArm.rotation.x = -swing * 0.8;
          p.rightArm.rotation.x = swing * 0.8;
        } else {
          // Idle breathing
          p.limbPhase += delta * 2.0;
          const idle = Math.sin(p.limbPhase) * 0.05;
          p.leftLeg.rotation.x = 0;
          p.rightLeg.rotation.x = 0;
          p.leftArm.rotation.x = idle;
          p.rightArm.rotation.x = -idle;
        }
      };

      homeVisuals.forEach(updateLimbAnimation);
      awayVisuals.forEach(updateLimbAnimation);
      updateLimbAnimation(referee);
      linesmen.forEach(updateLimbAnimation);
    },
    updateNameTags: (carrierId: string | null, commentaryId: string | null, showAll: boolean) => {
      allPlayers.forEach((visual, id) => {
        if (!visual.nameTag) return;
        if (showAll) {
          visual.nameTag.visible = true;
        } else {
          visual.nameTag.visible = id === carrierId || id === commentaryId;
        }
      });
    },
    dispose: () => {
      shadowMat.dispose();
      shadowGeom.dispose();
      shadowTexture.dispose();
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        } else if (obj instanceof THREE.Sprite) {
          obj.material.dispose();
        }
      });
    },
  };
}

function createShirtCanvas(
  kit: ResolvedKit,
  side: Side | 'referee',
  num: number,
  isGK: boolean,
): HTMLCanvasElement {
  const canvas = createSafeCanvas(256, 256);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  if (side === 'referee') {
    ctx.fillStyle = '#16181C';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }

  const primary = kit.shirt;
  const secondary = kit.shirt2;
  const textColor = kit.text;
  const pattern = kit.pattern;

  // Front & Back base
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Pattern overlays (stripes, hoops, halves, sash)
  ctx.fillStyle = secondary;
  if (pattern === 'stripes') {
    const stripeW = canvas.width / 8;
    for (let x = 0; x < canvas.width; x += stripeW * 2) {
      ctx.fillRect(x, 0, stripeW, canvas.height);
    }
  } else if (pattern === 'hoops') {
    const hoopH = canvas.height / 8;
    for (let y = 0; y < canvas.height; y += hoopH * 2) {
      ctx.fillRect(0, y, canvas.width, hoopH);
    }
  } else if (pattern === 'halves') {
    ctx.fillRect(canvas.width / 2, 0, canvas.width / 2, canvas.height);
  } else if (pattern === 'sash') {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(80, 0);
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(canvas.width - 80, canvas.height);
    ctx.closePath();
    ctx.fill();
  }

  // Collar & Side trim in secondary accent color
  ctx.fillStyle = secondary;
  ctx.fillRect(0, 0, canvas.width, 16); // Collar line
  ctx.fillRect(0, 0, 14, canvas.height); // Left side panel
  ctx.fillRect(canvas.width - 14, 0, 14, canvas.height); // Right side panel

  // Draw Player Squad Number on the Back (centered around x = 128, y = 130)
  ctx.fillStyle = textColor;
  ctx.font = 'bold 72px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(num.toString(), 128, 130);

  return canvas;
}

function createNameTagSprite(num: number, surname: string, kit: ResolvedKit): THREE.Sprite {
  const canvas = createSafeCanvas(512, 128);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const primary = kit.shirt;
    const secondary = kit.shirt2;
    const textCol = kit.text;

    // Outer chip backing
    ctx.fillStyle = 'rgba(10, 14, 20, 0.9)';
    ctx.beginPath();
    ctx.roundRect(16, 16, 480, 96, 20);
    ctx.fill();

    // Kit accent left stripe / chip
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.roundRect(16, 16, 110, 96, [20, 0, 0, 20]);
    ctx.fill();

    // Border around chip
    ctx.strokeStyle = secondary;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(16, 16, 480, 96, 20);
    ctx.stroke();

    // Number inside kit stripe
    ctx.fillStyle = textCol;
    ctx.font = '600 56px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${num}`, 71, 66);

    // Surname in Barlow Condensed 600
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '600 48px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(surname.toUpperCase(), 146, 66);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(spriteMat);
  // S9: Minimum 12px readability on tactical and broadcast camera
  sprite.scale.set(5.5, 1.4, 1);
  sprite.visible = false;
  return sprite;
}

function createShadowCanvas(): HTMLCanvasElement {
  const canvas = createSafeCanvas(64, 64);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
    grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  return canvas;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
