// Unit tests for SPEC §14.3 Choreographer, Steering & Ball Flight
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Choreographer, toSceneCoords } from '../../src/render3d/choreographer';
import { MatchEvent } from '../../src/core/types';
import worldSnapshot from '../../src/core/world/world.snapshot.json';

const homeClub = worldSnapshot.clubs['c01'];
const awayClub = worldSnapshot.clubs['c02'];
const homeLineup = homeClub.squad.slice(0, 11) as string[];
const awayLineup = awayClub.squad.slice(0, 11) as string[];

const paces: Record<string, number> = {};
[...homeLineup, ...awayLineup].forEach((pid, i) => {
  paces[pid] = 60 + (i % 35); // 60..94
});

describe('Choreographer & Steering (SPEC §14.3, M4.2)', () => {
  it('initializes 22 players at formation anchors', () => {
    const ch = new Choreographer(
      {
        formation: '4-4-2',
        mentality: 'Balanced',
        passing: 'Mixed',
        pressing: 'Mid',
        width: 'Normal',
        line: 'Normal',
        lineup: homeLineup,
      },
      {
        formation: '4-3-3',
        mentality: 'Balanced',
        passing: 'Mixed',
        pressing: 'Mid',
        width: 'Normal',
        line: 'Normal',
        lineup: awayLineup,
      },
      paces,
    );

    const homeGK = ch.getPlayerState(homeLineup[0]!);
    expect(homeGK).toBeDefined();
    // In half 1, home GK starts near home goal (x around -47.5 scene coords)
    expect(homeGK!.currentPos.x).toBeLessThan(-40);

    const awayGK = ch.getPlayerState(awayLineup[0]!);
    expect(awayGK).toBeDefined();
    // Away GK starts near away goal (x around +47.5 scene coords)
    expect(awayGK!.currentPos.x).toBeGreaterThan(40);
  });

  it('transforms team shape forward in possession and compacts out of possession', () => {
    const ch = new Choreographer(
      {
        formation: '4-4-2',
        mentality: 'Attacking',
        passing: 'Mixed',
        pressing: 'Mid',
        width: 'Wide',
        line: 'Normal',
        lineup: homeLineup,
      },
      {
        formation: '4-4-2',
        mentality: 'Defensive',
        passing: 'Mixed',
        pressing: 'Mid',
        width: 'Narrow',
        line: 'Deep',
        lineup: awayLineup,
      },
      paces,
    );

    const mockEvent: MatchEvent = {
      seq: 1,
      t: 10,
      minuteLabel: '1',
      half: 1,
      type: 'PASS',
      side: 'home',
      playerId: homeLineup[5]!, // LM
      targetId: homeLineup[9]!, // ST
      from: { x: 50, y: 20 },
      to: { x: 75, y: 30 },
      duration: 2.0,
      importance: 0,
      scoreAfter: { home: 0, away: 0 },
    };

    // Update at pt = 10.5s
    ch.update(0.016, 10.5, mockEvent, 1);

    // Home striker target should push forward into attacking territory
    const homeST = ch.getPlayerState(homeLineup[9]!);
    expect(homeST!.targetPos.x).toBeGreaterThan(0);

    // Away defense should sit deep (compacted towards their goal)
    const awayCB = ch.getPlayerState(awayLineup[2]!);
    expect(awayCB!.targetPos.x).toBeGreaterThan(15);
  });

  it('calculates parabolic arc for lofted passes and crosses', () => {
    const ch = new Choreographer(
      {
        formation: '4-4-2',
        mentality: 'Balanced',
        passing: 'Mixed',
        pressing: 'Mid',
        width: 'Normal',
        line: 'Normal',
        lineup: homeLineup,
      },
      {
        formation: '4-4-2',
        mentality: 'Balanced',
        passing: 'Mixed',
        pressing: 'Mid',
        width: 'Normal',
        line: 'Normal',
        lineup: awayLineup,
      },
      paces,
    );

    const crossEvent: MatchEvent = {
      seq: 2,
      t: 20,
      minuteLabel: '2',
      half: 1,
      type: 'CROSS',
      side: 'home',
      height: 'lofted',
      playerId: homeLineup[5]!,
      targetId: homeLineup[9]!,
      from: { x: 85, y: 10 },
      to: { x: 98, y: 34 },
      duration: 2.5,
      importance: 1,
      scoreAfter: { home: 0, away: 0 },
    };

    // At start (t = 20): ball is near ground
    ch.update(0.016, 20.0, crossEvent, 1);
    expect(ch.ballPos.y).toBeCloseTo(0.11, 1);

    // At midpoint (t = 21.25): ball reaches apex in air
    ch.update(0.016, 21.25, crossEvent, 1);
    expect(ch.ballPos.y).toBeGreaterThan(3.0); // lofted arc peak

    // Near end of pass: ball descends toward receiver
    ch.update(0.016, 22.45, crossEvent, 1);
    expect(ch.ballPos.y).toBeLessThan(2.0);
  });

  it('steers actor to ball and triggers kick animation', () => {
    const ch = new Choreographer(
      {
        formation: '4-4-2',
        mentality: 'Balanced',
        passing: 'Mixed',
        pressing: 'Mid',
        width: 'Normal',
        line: 'Normal',
        lineup: homeLineup,
      },
      {
        formation: '4-4-2',
        mentality: 'Balanced',
        passing: 'Mixed',
        pressing: 'Mid',
        width: 'Normal',
        line: 'Normal',
        lineup: awayLineup,
      },
      paces,
    );

    const shotEvent: MatchEvent = {
      seq: 3,
      t: 30,
      minuteLabel: '3',
      half: 1,
      type: 'SHOT',
      side: 'home',
      playerId: homeLineup[9]!, // ST
      from: { x: 92, y: 34 },
      to: { x: 105, y: 34 },
      shot: {
        context: 'BOX_CENTRAL',
        xg: 0.35,
        onTarget: true,
        bodyPart: 'Foot',
        target: { y: 34, z: 1.5 },
      },
      duration: 1.0,
      importance: 2,
      scoreAfter: { home: 0, away: 0 },
    };

    // At kickoff/shot moment (progress < 0.25): actor isKicking = true
    ch.update(0.016, 30.1, shotEvent, 1);
    const shooter = ch.getPlayerState(homeLineup[9]!);
    expect(shooter!.isKicking).toBe(true);

    // Goalkeeper of defending side should trigger dive
    const awayGK = ch.getPlayerState(awayLineup[0]!);
    ch.update(0.016, 30.5, shotEvent, 1);
    expect(awayGK!.isDiving).toBe(true);
  });

  it('applies separation force between close players', () => {
    const ch = new Choreographer(
      {
        formation: '4-4-2',
        mentality: 'Balanced',
        passing: 'Mixed',
        pressing: 'Mid',
        width: 'Normal',
        line: 'Normal',
        lineup: homeLineup,
      },
      {
        formation: '4-4-2',
        mentality: 'Balanced',
        passing: 'Mixed',
        pressing: 'Mid',
        width: 'Normal',
        line: 'Normal',
        lineup: awayLineup,
      },
      paces,
    );

    const p1 = ch.getPlayerState(homeLineup[1]!)!;
    const p2 = ch.getPlayerState(homeLineup[2]!)!;

    // Place them unnaturally close (0.2m apart)
    p1.currentPos.set(0, 0, 0);
    p2.currentPos.set(0.2, 0, 0);
    p1.targetPos.set(0, 0, 0);
    p2.targetPos.set(0, 0, 0);

    // Update steering
    ch.update(0.1, 0, null, 1);

    // They should be pushed further apart by separation force
    const newDist = p1.currentPos.distanceTo(p2.currentPos);
    expect(newDist).toBeGreaterThan(0.2);
  });
});
