// Unit tests for procedural generators (SPEC §18.4)
import { describe, it, expect } from 'vitest';
import { generateCrestSvg } from '@/assets/procedural/crest';
import { generateAvatarSvg } from '@/assets/procedural/avatar';
import { generateKitSvg } from '@/assets/procedural/kit';
import { generateFlagSvg, NationCode } from '@/assets/procedural/flags';

describe('Procedural generators', () => {
  it('generates valid SVG crest with club code', () => {
    const svg = generateCrestSvg('PCF', '#0B1F3A', '#F2B705', 'anchor');
    expect(svg).toContain('<svg');
    expect(svg).toContain('PCF');
    expect(svg).toContain('#0B1F3A');
  });

  it('generates valid SVG avatar with player initials', () => {
    const svg = generateAvatarSvg({
      initials: 'JD',
      primaryColor: '#0B1F3A',
      secondaryColor: '#F2B705',
    });
    expect(svg).toContain('<svg');
    expect(svg).toContain('JD');
  });

  it('generates kits with various patterns', () => {
    const patterns = ['solid', 'stripes', 'hoops', 'halves', 'sash', 'chevron'] as const;
    for (const pattern of patterns) {
      const svg = generateKitSvg(
        {
          shirt: '#2B2B2B',
          shirt2: '#FF6A13',
          pattern,
          shorts: '#000000',
          socks: '#FF6A13',
          text: '#FFFFFF',
        },
        64,
        10,
      );
      expect(svg).toContain('<svg');
      expect(svg).toContain('10');
    }
  });

  it('generates flags for all 14 specified nations', () => {
    const nations: NationCode[] = [
      'ENG',
      'NGA',
      'FRA',
      'ESP',
      'BRA',
      'NED',
      'GHA',
      'POR',
      'GER',
      'IRL',
      'SEN',
      'SCO',
      'ARG',
      'DEN',
    ];
    for (const nation of nations) {
      const svg = generateFlagSvg(nation);
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    }
  });
});
