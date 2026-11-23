import { describe, it, expect } from 'vitest';
import { getLocalPaper } from '../../../src/core/news/news';
import { ClubId } from '../../../src/core/types';

describe('Local Papers (SPEC §11.19 & week-summary design reference)', () => {
  const expectedPapers: Record<ClubId, { town: string; name: string; reporter: string }> = {
    c01: { town: 'Port Calloway', name: 'The Calloway Gazette', reporter: 'Ellis Marr' },
    c02: { town: 'Ironvale', name: 'Ironvale Evening Post', reporter: 'Dana Whitcombe' },
    c03: { town: 'Kestrel Bay', name: 'The Bay Herald', reporter: 'Hana Brodsky' },
    c04: { town: 'Saltmere', name: 'The Saltmere Echo', reporter: 'Joe Kettering' },
    c05: { town: 'Brightwater', name: 'The Brightwater Lamp', reporter: 'Callum Reid' },
    c06: { town: 'Northgate', name: 'Northgate Chronicle', reporter: 'Sofia Lindqvist' },
    c07: { town: 'Ashcombe', name: 'Ashcombe Advertiser', reporter: 'Tom Harrow' },
    c08: { town: 'Veldmoor', name: 'The Moorland Mercury', reporter: 'Agnes Penhale' },
    c09: { town: 'Lindenfield', name: 'Lindenfield Times', reporter: 'Marco Ferri' },
    c10: { town: 'Corvallen', name: 'The Corvallen Courier', reporter: 'Ruth Okonkwo' },
  };

  it('provides the correct town, paper name, and reporter for all 10 league clubs', () => {
    for (const [clubId, expected] of Object.entries(expectedPapers)) {
      const paper = getLocalPaper(clubId as ClubId);
      expect(paper).toBeDefined();
      expect(paper.town).toBe(expected.town);
      expect(paper.name).toBe(expected.name);
      expect(paper.reporter).toBe(expected.reporter);
    }
  });

  it('falls back safely for unknown club IDs', () => {
    const fallback = getLocalPaper('unknown' as ClubId);
    expect(fallback).toBeDefined();
    expect(fallback.name).toBe('The Calloway Gazette');
  });
});
