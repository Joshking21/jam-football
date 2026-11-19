// Implements SPEC §19.2 Club Themes and runtime CSS variable injection
import { CLUBS_DATA, RawClubData } from '../core/world/clubs.data';

export interface ClubTheme {
  accent: string;
  accentInk: string;
  accentText: string;
  band1: string;
  band2: string;
  clubPrimary?: string;
  clubSecondary?: string;
}

export const LEAGUE_THEME: ClubTheme = {
  accent: '#FF5B35',
  accentInk: '#1A0600',
  accentText: '#FF6E4D',
  band1: '#FF5B35',
  band2: '#F2F4F7',
  clubPrimary: '#FF5B35',
  clubSecondary: '#F2F4F7',
};

export const CLUB_THEMES: Record<string, ClubTheme> = {
  c01: {
    accent: '#F2B705',
    accentInk: '#0B1F3A',
    accentText: '#F2B705',
    band1: '#F2B705',
    band2: '#0B1F3A',
  },
  c02: {
    accent: '#FF6A13',
    accentInk: '#1A0A00',
    accentText: '#FF7A2E',
    band1: '#FF6A13',
    band2: '#2B2B2B',
  },
  c03: {
    accent: '#17A9A9',
    accentInk: '#03201F',
    accentText: '#2BC2C2',
    band1: '#0E8C8C',
    band2: '#FFFFFF',
  },
  c04: {
    accent: '#8FC5E8',
    accentInk: '#0D2233',
    accentText: '#8FC5E8',
    band1: '#6D1A36',
    band2: '#8FC5E8',
  },
  c05: {
    accent: '#4FA3E0',
    accentInk: '#04182A',
    accentText: '#5DB0EA',
    band1: '#4FA3E0',
    band2: '#FFFFFF',
  },
  c06: {
    accent: '#2FA457',
    accentInk: '#03200D',
    accentText: '#3DBA67',
    band1: '#1E7B3C',
    band2: '#FFFFFF',
  },
  c07: {
    accent: '#C8102E',
    accentInk: '#FFFFFF',
    accentText: '#F0455D',
    band1: '#C8102E',
    band2: '#111111',
  },
  c08: {
    accent: '#6A44A8',
    accentInk: '#FFFFFF',
    accentText: '#B396E8',
    band1: '#4B2A7B',
    band2: '#FFFFFF',
  },
  c09: {
    accent: '#FFD100',
    accentInk: '#111111',
    accentText: '#FFD100',
    band1: '#FFD100',
    band2: '#111111',
  },
  c10: {
    accent: '#F3F6FB',
    accentInk: '#07090D',
    accentText: '#F3F6FB',
    band1: '#F3F6FB',
    band2: '#111111',
  },
};

export function getClubTheme(clubId?: string | null): ClubTheme {
  if (!clubId || !CLUB_THEMES[clubId]) {
    return LEAGUE_THEME;
  }
  const theme = CLUB_THEMES[clubId];
  const clubData = CLUBS_DATA.find((c: RawClubData) => c.id === clubId);
  return {
    ...theme,
    clubPrimary: clubData?.colors.primary ?? theme.accent,
    clubSecondary: clubData?.colors.secondary ?? theme.band2,
  };
}

export function applyClubTheme(clubId?: string | null): void {
  if (typeof document === 'undefined') return;
  const theme = getClubTheme(clubId);
  const root = document.documentElement;

  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent-ink', theme.accentInk);
  root.style.setProperty('--accent-text', theme.accentText);
  root.style.setProperty('--band-1', theme.band1);
  root.style.setProperty('--band-2', theme.band2);
  if (theme.clubPrimary) {
    root.style.setProperty('--club-primary', theme.clubPrimary);
  }
  if (theme.clubSecondary) {
    root.style.setProperty('--club-secondary', theme.clubSecondary);
  }
}
