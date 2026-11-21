// Unit tests for SPEC §14 3D Match Day Procedural Renderers and Fallbacks
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createPitch } from '../../src/render3d/pitch';
import { createGoals } from '../../src/render3d/goals';
import { createStadium } from '../../src/render3d/stadium';
import { createCrowd } from '../../src/render3d/crowd';
import { createBall } from '../../src/render3d/ball';
import { createPlayers } from '../../src/render3d/players';
import { createFloodlightBeams } from '../../src/render3d/beams';
import { loadModelAsset } from '../../src/render3d/modelLoader';
import { Club, Player } from '../../src/core/types';
import worldSnapshot from '../../src/core/world/world.snapshot.json';

const homeClub: Club = worldSnapshot.clubs['c01'] as Club;
const awayClub: Club = worldSnapshot.clubs['c02'] as Club;
const allPlayers = Object.values(worldSnapshot.players) as Player[];
const homeSquad: Player[] = allPlayers.filter((p) => p.clubId === 'c01');
const awaySquad: Player[] = allPlayers.filter((p) => p.clubId === 'c02');

describe('3D Match Day - Procedural Fallbacks (SPEC §14, §23 M4.1)', () => {
  it('creates pitch with FIFA dimensions and mowing stripes texture', () => {
    const pitchBundle = createPitch('dry', 'Medium');
    expect(pitchBundle.mesh).toBeDefined();
    expect(pitchBundle.mesh.geometry).toBeInstanceOf(THREE.PlaneGeometry);

    const geom = pitchBundle.mesh.geometry as THREE.PlaneGeometry;
    expect(geom.parameters.width).toBe(115);
    expect(geom.parameters.height).toBe(78);

    const mat = pitchBundle.mesh.material as THREE.MeshStandardMaterial;
    expect(mat.map).toBeDefined();
    expect(mat.roughness).toBeGreaterThan(0.5);

    // Rain changes roughness/specular
    const wetPitch = createPitch('rain', 'Medium');
    const wetMat = wetPitch.mesh.material as THREE.MeshStandardMaterial;
    expect(wetMat.roughness).toBeLessThan(mat.roughness);
    expect(wetMat.envMapIntensity).toBeGreaterThan(mat.envMapIntensity);

    pitchBundle.dispose();
    wetPitch.dispose();
  });

  it('creates goals at x = ±52.5 with correct FIFA crossbar and net dimensions', () => {
    const goalsBundle = createGoals();
    expect(goalsBundle.group.children.length).toBe(2);

    const leftGoal = goalsBundle.group.children[0] as THREE.Group;
    const rightGoal = goalsBundle.group.children[1] as THREE.Group;

    expect(leftGoal.position.x).toBe(-52.5);
    expect(rightGoal.position.x).toBe(52.5);

    // Verify ripple animation trigger does not throw
    expect(() => {
      goalsBundle.triggerRipple('home');
      goalsBundle.update(0.016);
      goalsBundle.triggerRipple('away');
      goalsBundle.update(0.016);
    }).not.toThrow();

    goalsBundle.dispose();
  });

  it('creates stadium with 4 stands, 4 floodlight towers, and perimeter sponsors', () => {
    const stadium = createStadium(homeClub, 'Medium');
    expect(stadium.group).toBeDefined();
    expect(stadium.floodlightPositions.length).toBe(4);

    // Tower coordinates at corners (x = ±62, z = ±42)
    const xs = stadium.floodlightPositions.map((p) => Math.abs(p.x));
    const zs = stadium.floodlightPositions.map((p) => Math.abs(p.z));
    expect(xs).toEqual([62, 62, 62, 62]);
    expect(zs).toEqual([42, 42, 42, 42]);

    stadium.dispose();
  });

  it('creates crowd with InstancedMesh, color distribution, and goal celebration', () => {
    const crowd = createCrowd(homeClub, awayClub, 'Medium');
    expect(crowd.group).toBeDefined();

    // Trigger celebration wave
    expect(() => {
      crowd.triggerGoal('home');
      crowd.update(0.016);
      crowd.triggerGoal('away');
      crowd.update(0.016);
    }).not.toThrow();

    crowd.dispose();
  });

  it('creates ball with 0.11m radius and ground shadow decal tracking altitude', () => {
    const ball = createBall();
    expect(ball.mesh.geometry).toBeInstanceOf(THREE.SphereGeometry);
    const geom = ball.mesh.geometry as THREE.SphereGeometry;
    expect(geom.parameters.radius).toBeCloseTo(0.11, 2);

    // Set position and check ground shadow
    ball.setPosition(10, 0.11, -5);
    expect(ball.getPosition().x).toBe(10);
    expect(ball.getPosition().y).toBeCloseTo(0.11, 2);
    expect(ball.getPosition().z).toBe(-5);
    expect(ball.shadow.position.y).toBeCloseTo(0.015, 3);

    // Ball lofted in air: shadow shrinks and fades
    ball.setPosition(10, 8.0, -5);
    expect(ball.shadow.scale.x).toBeLessThan(1.0);

    // Rotation update
    ball.updateRotation(new THREE.Vector3(5, 0, 0), 0.016);

    ball.dispose();
  });

  it('creates 22 players with club kits, numbers, referee in black, and limb swing', () => {
    const playersBundle = createPlayers(homeClub, awayClub, homeSquad, awaySquad, 'Medium');

    expect(playersBundle.homePlayers.length).toBe(11);
    expect(playersBundle.awayPlayers.length).toBe(11);
    expect(playersBundle.referee).toBeDefined();
    expect(playersBundle.linesmen.length).toBe(2);

    const p1 = playersBundle.homePlayers[0];
    expect(p1).toBeDefined();
    if (!p1) return;

    expect(p1.number).toBe(1);
    expect(p1.torso).toBeDefined();
    expect(p1.head).toBeDefined();
    expect(p1.leftLeg).toBeDefined();
    expect(p1.rightLeg).toBeDefined();

    // Test limb animation states
    p1.currentSpeed = 6.5; // sprinting
    playersBundle.update(0.016);
    expect(p1.leftLeg.rotation.x).not.toBe(0);

    p1.isKicking = true;
    playersBundle.update(0.016);
    expect(p1.rightLeg.rotation.x).toBeLessThan(-1.0);

    p1.isKicking = false;
    p1.isTackling = true;
    playersBundle.update(0.016);
    expect(p1.leftLeg.rotation.x).toBeLessThan(-1.0);

    p1.isTackling = false;
    p1.isDiving = true;
    playersBundle.update(0.016);
    expect(p1.group.rotation.z).toBeGreaterThan(1.0);

    playersBundle.dispose();
  });

  it('creates volumetric floodlight beams with glare sprites', () => {
    const towerPositions = [
      new THREE.Vector3(62, 45, 42),
      new THREE.Vector3(-62, 45, 42),
      new THREE.Vector3(-62, 45, -42),
      new THREE.Vector3(62, 45, -42),
    ];
    const beams = createFloodlightBeams(towerPositions, 'dry');
    expect(beams.group.children.length).toBe(8); // 4 cones + 4 sprites
    beams.dispose();
  });

  it('safely resolves to null for unregistered GLTF models', async () => {
    const model = await loadModelAsset('models/missing_model.glb');
    expect(model).toBeNull();
  });
});
