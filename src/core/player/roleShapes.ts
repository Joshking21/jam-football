// Implements SPEC §19.5 RadarChart role shape calculation
// Pure module: no DOM, no React, no three.js, no audio, no Date.now(), no Math.random().
import { Player, RoleId, DefRoleId } from '../types';
import { ROLES, DEF_ROLES, computeRoleFit, computeDefRoleFit } from '@/config/roles';

export interface RadarAxisInfo {
  name: string;
  description: string;
}

export const RADAR_AXES_OUTFIELD: readonly RadarAxisInfo[] = [
  { name: 'Pace', description: 'Pace (100%)' },
  { name: 'Shooting', description: 'Finishing (70%) + Long Shots (30%)' },
  { name: 'Passing', description: 'Passing (60%) + Crossing (20%) + First Touch (20%)' },
  { name: 'Dribbling', description: 'Dribbling (60%) + First Touch (20%) + Composure (20%)' },
  { name: 'Defending', description: 'Tackling (50%) + Positioning (35%) + Heading (15%)' },
  { name: 'Physical', description: 'Strength (40%) + Stamina (40%) + Work Rate (20%)' },
] as const;

export const RADAR_AXES_GK: readonly RadarAxisInfo[] = [
  { name: 'Reflexes', description: 'Reflexes (100%)' },
  { name: 'Handling', description: 'Handling (100%)' },
  { name: 'One-on-ones', description: 'One-on-ones (100%)' },
  { name: 'Aerial', description: 'Aerial Command (100%)' },
  { name: 'Distribution', description: 'Passing (100%)' },
  { name: 'Positioning', description: 'Positioning (100%)' },
] as const;

export function isGoalkeeper(player: Player): boolean {
  return player.positions[0]?.pos === 'GK';
}

/**
 * Calculates 6 radar axis values for a player (0–100 scale).
 * Strictly follows SPEC §19.5 weighted attribute formulas.
 */
export function getPlayerRadarValues(player: Player): number[] {
  const attrs = player.attributes;
  if (isGoalkeeper(player)) {
    return [
      attrs.reflexes,
      attrs.handling,
      attrs.oneOnOnes,
      attrs.aerialCommand,
      attrs.passing, // Distribution
      attrs.positioning,
    ].map((v) => Math.round(v));
  }

  const pace = attrs.pace;
  const shooting = 0.7 * attrs.finishing + 0.3 * attrs.longShots;
  const passing = 0.6 * attrs.passing + 0.2 * attrs.crossing + 0.2 * attrs.firstTouch;
  const dribbling = 0.6 * attrs.dribbling + 0.2 * attrs.firstTouch + 0.2 * attrs.composure;
  const defending = 0.5 * attrs.tackling + 0.35 * attrs.positioning + 0.15 * attrs.heading;
  const physical = 0.4 * attrs.strength + 0.4 * attrs.stamina + 0.2 * attrs.workRate;

  return [pace, shooting, passing, dribbling, defending, physical].map((v) => Math.round(v));
}

/**
 * Role shape per SPEC §19.5:
 * The mean axis values of the 20 players in the world with the highest fit for that role.
 */
export function computeRoleShape(roleId: RoleId, allPlayers: Player[]): number[] {
  const isGkRole = roleId === 'gk' || roleId === 'bp_keeper';
  const pool = allPlayers.filter((p) => (isGkRole ? isGoalkeeper(p) : !isGoalkeeper(p)));

  const ranked = pool
    .map((p) => ({
      fit: computeRoleFit(roleId, p.attributes).score,
      values: getPlayerRadarValues(p),
    }))
    .sort((a, b) => b.fit - a.fit)
    .slice(0, 20);

  if (ranked.length === 0) {
    return [60, 60, 60, 60, 60, 60];
  }

  const result: number[] = [0, 0, 0, 0, 0, 0];
  for (const r of ranked) {
    for (let i = 0; i < 6; i++) {
      result[i] = (result[i] ?? 0) + (r.values[i] ?? 0);
    }
  }

  return result.map((sum) => Math.round((sum / ranked.length) * 10) / 10);
}

/**
 * Defensive role shape per SPEC §19.5.
 */
export function computeDefRoleShape(defRoleId: DefRoleId, allPlayers: Player[]): number[] {
  const isGkRole = defRoleId === 'gk_line' || defRoleId === 'gk_sweep';
  const pool = allPlayers.filter((p) => (isGkRole ? isGoalkeeper(p) : !isGoalkeeper(p)));

  const ranked = pool
    .map((p) => ({
      fit: computeDefRoleFit(p.attributes, defRoleId).score,
      values: getPlayerRadarValues(p),
    }))
    .sort((a, b) => b.fit - a.fit)
    .slice(0, 20);

  if (ranked.length === 0) {
    return [60, 60, 60, 60, 60, 60];
  }

  const result: number[] = [0, 0, 0, 0, 0, 0];
  for (const r of ranked) {
    for (let i = 0; i < 6; i++) {
      result[i] = (result[i] ?? 0) + (r.values[i] ?? 0);
    }
  }

  return result.map((sum) => Math.round((sum / ranked.length) * 10) / 10);
}

export interface CachedRoleShapes {
  att: Record<RoleId, number[]>;
  def: Record<DefRoleId, number[]>;
}

let cachedRoleShapes: CachedRoleShapes | null = null;

/**
 * Computes and caches all role shapes for the world players.
 * Can be called at game initialization or season start.
 */
export function getAllRoleShapes(allPlayers: Player[], forceRecompute = false): CachedRoleShapes {
  if (cachedRoleShapes && !forceRecompute) {
    return cachedRoleShapes;
  }

  const att: Record<RoleId, number[]> = {};
  for (const roleId of Object.keys(ROLES)) {
    att[roleId] = computeRoleShape(roleId, allPlayers);
  }

  const def: Record<DefRoleId, number[]> = {} as any;
  for (const defRoleId of Object.keys(DEF_ROLES) as DefRoleId[]) {
    def[defRoleId] = computeDefRoleShape(defRoleId, allPlayers);
  }

  cachedRoleShapes = { att, def };
  return cachedRoleShapes;
}

export function clearRoleShapesCache(): void {
  cachedRoleShapes = null;
}
