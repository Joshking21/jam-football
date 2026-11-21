// Tests for SPEC §19.5 RadarChart role shape calculation
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPlayerRadarValues,
  isGoalkeeper,
  computeRoleShape,
  computeDefRoleShape,
  getAllRoleShapes,
  clearRoleShapesCache,
  RADAR_AXES_OUTFIELD,
  RADAR_AXES_GK,
} from '@/core/player/roleShapes';
import { Player } from '@/core/types';
import worldSnapshot from '@/core/world/world.snapshot.json';

describe('Role Shapes (SPEC §19.5)', () => {
  beforeEach(() => {
    clearRoleShapesCache();
  });

  const basePlayer = Object.values(worldSnapshot.players)[0] as unknown as Player;

  const dummyOutfield: Player = {
    ...basePlayer,
    positions: [{ pos: 'ST', familiarity: 100 }],
    attributes: {
      ...basePlayer.attributes,
      pace: 80,
      finishing: 85,
      longShots: 75,
      passing: 70,
      crossing: 60,
      firstTouch: 75,
      dribbling: 78,
      tackling: 40,
      heading: 72,
      setPieces: 65,
      stamina: 82,
      strength: 78,
      offTheBall: 84,
      positioning: 50,
      decisions: 72,
      composure: 80,
      workRate: 75,
      reflexes: 10,
      handling: 10,
      oneOnOnes: 10,
      aerialCommand: 10,
    },
  };

  const dummyGk: Player = {
    ...basePlayer,
    positions: [{ pos: 'GK', familiarity: 100 }],
    attributes: {
      ...basePlayer.attributes,
      reflexes: 85,
      handling: 82,
      oneOnOnes: 80,
      aerialCommand: 78,
      passing: 68,
      positioning: 84,
    },
  };

  it('correctly identifies goalkeeper status', () => {
    expect(isGoalkeeper(dummyOutfield)).toBe(false);
    expect(isGoalkeeper(dummyGk)).toBe(true);
  });

  it('calculates outfield radar values with exact §19.5 weights', () => {
    const values = getPlayerRadarValues(dummyOutfield);
    expect(values).toHaveLength(6);

    // Pace = pace = 80
    expect(values[0]).toBe(80);

    // Shooting = 0.7 * 85 + 0.3 * 75 = 59.5 + 22.5 = 82
    expect(values[1]).toBe(82);

    // Passing = 0.6 * 70 + 0.2 * 60 + 0.2 * 75 = 42 + 12 + 15 = 69
    expect(values[2]).toBe(69);

    // Dribbling = 0.6 * 78 + 0.2 * 75 + 0.2 * 80 = 46.8 + 15 + 16 = 77.8 -> 78
    expect(values[3]).toBe(78);

    // Defending = 0.5 * 40 + 0.35 * 50 + 0.15 * 72 = 20 + 17.5 + 10.8 = 48.3 -> 48
    expect(values[4]).toBe(48);

    // Physical = 0.4 * 78 + 0.4 * 82 + 0.2 * 75 = 31.2 + 32.8 + 15 = 79
    expect(values[5]).toBe(79);
  });

  it('calculates goalkeeper radar values per §19.5', () => {
    const values = getPlayerRadarValues(dummyGk);
    expect(values).toHaveLength(6);
    expect(values[0]).toBe(85); // Reflexes
    expect(values[1]).toBe(82); // Handling
    expect(values[2]).toBe(80); // OneOnOnes
    expect(values[3]).toBe(78); // Aerial
    expect(values[4]).toBe(68); // Distribution (Passing)
    expect(values[5]).toBe(84); // Positioning
  });

  it('computes role shape based on top 20 players in the world', () => {
    const worldPlayers = Object.values(worldSnapshot.players) as unknown as Player[];
    expect(worldPlayers.length).toBeGreaterThan(100);

    // Outfield role: Poacher (advanced forward)
    const poacherShape = computeRoleShape('poacher', worldPlayers);
    expect(poacherShape).toHaveLength(6);
    // Poachers must have high shooting (> 70)
    expect(poacherShape[1]).toBeGreaterThan(70);

    // GK role: Ball playing keeper
    const bpKeeperShape = computeRoleShape('bp_keeper', worldPlayers);
    expect(bpKeeperShape).toHaveLength(6);
    // GK distribution / reflexes should be high
    expect(bpKeeperShape[0]).toBeGreaterThan(65);
  });

  it('computes defensive role shapes', () => {
    const worldPlayers = Object.values(worldSnapshot.players) as unknown as Player[];
    const cbStepShape = computeDefRoleShape('cb_step', worldPlayers);
    expect(cbStepShape).toHaveLength(6);
    // Centre backs have high defending
    expect(cbStepShape[4]).toBeGreaterThan(65);
  });

  it('caches computed role shapes for all roles', () => {
    const worldPlayers = Object.values(worldSnapshot.players) as unknown as Player[];
    const shapes1 = getAllRoleShapes(worldPlayers);
    expect(shapes1.att).toBeDefined();
    expect(shapes1.def).toBeDefined();
    expect(shapes1.att['poacher']).toBeDefined();
    expect(shapes1.def['cb_step']).toBeDefined();

    const shapes2 = getAllRoleShapes(worldPlayers);
    expect(shapes2).toBe(shapes1); // Same reference (cached)
  });

  it('exposes correct metadata for axes', () => {
    expect(RADAR_AXES_OUTFIELD).toHaveLength(6);
    expect(RADAR_AXES_GK).toHaveLength(6);
    expect(RADAR_AXES_OUTFIELD[0]?.name).toBe('Pace');
    expect(RADAR_AXES_GK[0]?.name).toBe('Reflexes');
  });
});
