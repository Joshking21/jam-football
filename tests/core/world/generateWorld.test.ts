// Implements SPEC §22.1 World generation and snapshot tests
import { describe, it, expect } from 'vitest';
import snapshot from '@/core/world/world.snapshot.json';
import { FAMOUS_PLAYERS_AND_MANAGERS, FAMOUS_SURNAMES } from '@/core/world/blocklist.data';

describe('World Snapshot (Meridian League)', () => {
  it('loads valid snapshot with 10 clubs, 280 players, and 90 fixtures', () => {
    expect(Object.keys(snapshot.clubs)).toHaveLength(10);
    expect(Object.keys(snapshot.players)).toHaveLength(280);
    expect(snapshot.freeAgents).toHaveLength(40);
    expect(snapshot.fixtures).toHaveLength(90);
  });

  it('each club has exactly 24 players with composition per SPEC §9.3', () => {
    for (const [clubId, club] of Object.entries(snapshot.clubs)) {
      expect(club.squad).toHaveLength(24);

      const positions = club.squad.map((pid) => (snapshot.players as any)[pid].positions[0].pos);
      const counts: Record<string, number> = {};
      for (const pos of positions) {
        counts[pos] = (counts[pos] || 0) + 1;
      }

      expect(counts.GK).toBe(3);
      expect(counts.CB).toBe(5);
      expect(counts.LB).toBe(2); // 1 LB + 1 FB (primary LB)
      expect(counts.RB).toBe(1);
      expect(counts.DM).toBe(2);
      expect(counts.CM).toBe(3);
      expect(counts.AM).toBe(1);
      expect(counts.LM).toBe(1);
      expect(counts.RM).toBe(1);
      expect(counts.LW).toBe(1);
      expect(counts.RW).toBe(1);
      expect(counts.ST).toBe(3);
    }
  });

  it('all 280 player names are completely unique', () => {
    const fullNames = new Set<string>();
    for (const player of Object.values(snapshot.players) as any[]) {
      const full = `${player.firstName} ${player.lastName}`.toLowerCase();
      expect(fullNames.has(full)).toBe(false);
      fullNames.add(full);
    }
    expect(fullNames.size).toBe(280);
  });

  it('no player name or surname violates the blocklist', () => {
    const famousSet = new Set(FAMOUS_PLAYERS_AND_MANAGERS.map((s) => s.toLowerCase()));
    const surnameSet = new Set(FAMOUS_SURNAMES.map((s) => s.toLowerCase()));

    for (const player of Object.values(snapshot.players) as any[]) {
      const full = `${player.firstName} ${player.lastName}`.toLowerCase();
      const last = player.lastName.toLowerCase();
      expect(famousSet.has(full)).toBe(false);
      expect(surnameSet.has(last)).toBe(false);
    }
  });

  it('each club has assigned squad numbers without duplicates in 1..35', () => {
    for (const club of Object.values(snapshot.clubs) as any[]) {
      const numbers = new Set<number>();
      for (const pid of club.squad) {
        const num = (snapshot.players as any)[pid].squadNumber;
        expect(num).toBeGreaterThanOrEqual(1);
        expect(num).toBeLessThanOrEqual(35);
        expect(numbers.has(num)).toBe(false);
        numbers.add(num);
      }
    }
  });
});
