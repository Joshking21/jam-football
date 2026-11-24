// Unit tests for SPEC §14.3 (v1.8) — the match director: ball timeline, roles, steering.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Choreographer, TeamTacticsInput } from '../../src/render3d/choreographer';
import { MatchEvent } from '../../src/core/types';
import worldSnapshot from '../../src/core/world/world.snapshot.json';
import { createNewGame } from '../../src/core/game/newGame';
import { buildTeamSheet } from '../../src/core/game/advance';
import { createMatch } from '../../src/core/match/engine';

const homeClub = worldSnapshot.clubs['c01'];
const awayClub = worldSnapshot.clubs['c02'];
const homeLineup = homeClub.squad.slice(0, 11) as string[];
const awayLineup = awayClub.squad.slice(0, 11) as string[];

const paces: Record<string, number> = {};
[...homeLineup, ...awayLineup].forEach((pid, i) => {
  paces[pid] = 60 + (i % 35); // 60..94
});

const tactics = (lineup: string[], over: Partial<TeamTacticsInput> = {}): TeamTacticsInput => ({
  formation: '4-4-2',
  mentality: 'Balanced',
  passing: 'Mixed',
  pressing: 'Mid',
  width: 'Normal',
  line: 'Normal',
  lineup,
  ...over,
});

const ev = (
  e: Partial<MatchEvent> & Pick<MatchEvent, 'seq' | 't' | 'type' | 'side'>,
): MatchEvent => ({
  minuteLabel: '1',
  half: 1,
  duration: 2,
  importance: 0,
  scoreAfter: { home: 0, away: 0 },
  ...e,
});

describe('Match director (SPEC §14.3 v1.8)', () => {
  it('starts 22 players in their own halves with keepers in goal', () => {
    const ch = new Choreographer(
      tactics(homeLineup),
      tactics(awayLineup, { formation: '4-3-3' }),
      paces,
    );
    expect(ch.getPlayerState(homeLineup[0]!)!.currentPos.x).toBeLessThan(-40);
    expect(ch.getPlayerState(awayLineup[0]!)!.currentPos.x).toBeGreaterThan(40);
    homeLineup.forEach((pid) =>
      expect(ch.getPlayerState(pid)!.currentPos.x).toBeLessThanOrEqual(0.1),
    );
    awayLineup.forEach((pid) =>
      expect(ch.getPlayerState(pid)!.currentPos.x).toBeGreaterThanOrEqual(-0.1),
    );
  });

  it('pushes the team in possession forward and keeps the other compact', () => {
    const ch = new Choreographer(
      tactics(homeLineup, { mentality: 'Attacking', width: 'Wide' }),
      tactics(awayLineup, { mentality: 'Defensive', width: 'Narrow', line: 'Deep' }),
      paces,
    );
    ch.setEvents([
      ev({
        seq: 1,
        t: 10,
        type: 'PASS',
        side: 'home',
        playerId: homeLineup[5],
        targetId: homeLineup[9],
        from: { x: 50, y: 20 },
        to: { x: 75, y: 30 },
      }),
    ]);
    ch.update(0.016, 10.5, null, 1);
    expect(ch.getPlayerState(homeLineup[9]!)!.targetPos.x).toBeGreaterThan(0);
    expect(ch.getPlayerState(awayLineup[2]!)!.targetPos.x).toBeGreaterThan(15);
  });

  it('flies a cross on a real arc and lands it at the target', () => {
    const ch = new Choreographer(tactics(homeLineup), tactics(awayLineup), paces);
    const from = { x: 85, y: 10 };
    const to = { x: 98, y: 34 };
    ch.setEvents([
      // The ball is already at the crosser's feet.
      ev({
        seq: 1,
        t: 15,
        type: 'DRIBBLE',
        side: 'home',
        playerId: homeLineup[5],
        from: { x: 80, y: 8 },
        to: from,
        duration: 5,
      }),
      ev({
        seq: 2,
        t: 20,
        type: 'CROSS',
        side: 'home',
        height: 'lofted',
        playerId: homeLineup[5],
        targetId: homeLineup[9],
        from,
        to,
        duration: 2.5,
      }),
    ]);
    let peak = 0;
    for (let t = 15; t < 24; t += 1 / 60) {
      ch.update(1 / 60, t, null, 1);
      if (t >= 20) peak = Math.max(peak, ch.ballPos.y);
    }
    expect(peak).toBeGreaterThan(2);
    expect(peak).toBeLessThan(9);
    const land = new THREE.Vector3(to.x - 52.5, 0, to.y - 34);
    expect(Math.hypot(ch.ballPos.x - land.x, ch.ballPos.z - land.z)).toBeLessThan(3);
  });

  it('flags the shooter at the strike and dives the keeper towards the corner', () => {
    const ch = new Choreographer(tactics(homeLineup), tactics(awayLineup), paces);
    const shooter = homeLineup[9]!;
    ch.setEvents([
      ev({
        seq: 1,
        t: 26,
        type: 'DRIBBLE',
        side: 'home',
        playerId: shooter,
        from: { x: 88, y: 34 },
        to: { x: 92, y: 34 },
        duration: 4,
      }),
      ev({
        seq: 2,
        t: 30,
        type: 'SHOT',
        side: 'home',
        playerId: shooter,
        from: { x: 92, y: 34 },
        to: { x: 105, y: 37 },
        shot: {
          context: 'BOX_CENTRAL',
          xg: 0.35,
          onTarget: true,
          bodyPart: 'Foot',
          target: { y: 3, z: 1.5 },
        },
        importance: 2,
      }),
    ]);
    let kicked = false;
    let dived = false;
    for (let t = 26; t < 33; t += 1 / 60) {
      ch.update(1 / 60, t, null, 1);
      if (ch.getPlayerState(shooter)!.isKicking) kicked = true;
      if (ch.getPlayerState(awayLineup[0]!)!.isDiving) dived = true;
    }
    expect(kicked).toBe(true);
    expect(dived).toBe(true);
  });

  it('keeps players apart', () => {
    const ch = new Choreographer(tactics(homeLineup), tactics(awayLineup), paces);
    ch.update(0.016, 0, null, 1); // first frame snaps everyone into place
    const p1 = ch.getPlayerState(homeLineup[1]!)!;
    const p2 = ch.getPlayerState(homeLineup[2]!)!;
    p1.currentPos.set(0, 0, 0);
    p2.currentPos.set(0.2, 0, 0);
    ch.update(0.1, 0.1, null, 1);
    expect(p1.currentPos.distanceTo(p2.currentPos)).toBeGreaterThan(0.2);
  });

  it('plays a real match continuously: no ball jumps in open play, carrier close to the ball', () => {
    const gs = createNewGame({ seed: 12345, userClubId: 'c01' });
    const fx = gs.fixtures[0]!;
    const home = gs.clubs[fx.homeId]!;
    const away = gs.clubs[fx.awayId]!;
    const events = createMatch(
      {
        fixtureId: fx.id,
        home: buildTeamSheet(home, gs.players, 'home'),
        away: buildTeamSheet(away, gs.players, 'away'),
        isDerby: false,
        weather: fx.weather,
        userSide: 'home',
        aiControls: ['home', 'away'],
      },
      777,
    ).runToEnd();
    const lineup = (c: typeof home) =>
      (c.tactics.lineup.filter(Boolean).length === 11
        ? c.tactics.lineup
        : c.squad.slice(0, 11)) as string[];
    const tac = (c: typeof home): TeamTacticsInput => ({
      formation: c.tactics.formation,
      ...c.tactics.instructions,
      lineup: lineup(c),
    });
    const pace: Record<string, number> = {};
    Object.values(gs.players).forEach((p) => (pace[p.id] = p.attributes.pace));
    const ch = new Choreographer(tac(home), tac(away), pace);
    ch.setEvents(events);

    const dt = 1 / 60;
    const last = ch.ballPos.clone();
    let jumps = 0;
    const gaps: number[] = [];
    for (let t = 0; t < 600; t += dt) {
      ch.update(dt, t, null, 1);
      const plan = ch.activePlan;
      const restart =
        plan && ['CORNER', 'THROW_IN', 'GOAL_KICK', 'FREE_KICK', 'KICKOFF'].includes(plan.type);
      if (!restart && ch.ballPos.distanceTo(last) > 1.5) jumps++; // 90 m/s
      last.copy(ch.ballPos);
      if (ch.carrierId) {
        const c = ch.getPlayerState(ch.carrierId)!;
        gaps.push(Math.hypot(c.currentPos.x - ch.ballPos.x, c.currentPos.z - ch.ballPos.z));
      }
    }
    gaps.sort((a, b) => a - b);
    expect(jumps).toBeLessThanOrEqual(3);
    expect(gaps[gaps.length >> 1]!).toBeLessThan(3);
  }, 60000);
});
