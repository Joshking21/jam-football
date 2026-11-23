// Implements SPEC §9.2, §14.2, REVIEW-M4 S1 Match Kit Selection and Clash Detection (ΔE >= 25)
import { Club, Kit } from '../types';
import { colorDeltaE } from '../math';

export type ResolvedKit = Kit;

export interface ResolvedMatchKits {
  homeOutfield: Kit;
  awayOutfield: Kit;
  homeGk: Kit;
  awayGk: Kit;
  isAwayKitUsed: boolean;
  shirtDeltaE: number;
}

const DEFAULT_HOME_KIT: Kit = {
  shirt: '#0B1F3A',
  shirt2: '#F2B705',
  pattern: 'solid',
  shorts: '#0B1F3A',
  socks: '#0B1F3A',
  text: '#FFFFFF',
};

const DEFAULT_AWAY_KIT: Kit = {
  shirt: '#FFFFFF',
  shirt2: '#0B1F3A',
  pattern: 'solid',
  shorts: '#0B1F3A',
  socks: '#FFFFFF',
  text: '#0B1F3A',
};

const DEFAULT_GK_KIT_GREEN: Kit = {
  shirt: '#2EE59D',
  shirt2: '#2EE59D',
  pattern: 'solid',
  shorts: '#2EE59D',
  socks: '#2EE59D',
  text: '#0B1F3A',
};

const DEFAULT_GK_KIT_ORANGE: Kit = {
  shirt: '#FF8A00',
  shirt2: '#FF8A00',
  pattern: 'solid',
  shorts: '#FF8A00',
  socks: '#FF8A00',
  text: '#FFFFFF',
};

const GK_COLOR_PALETTE: Array<{ shirt: string; text: string }> = [
  { shirt: '#2EE59D', text: '#0B1F3A' }, // Mint Green (c01-c05 default)
  { shirt: '#FF8A00', text: '#FFFFFF' }, // Electric Orange (c06-c10 default)
  { shirt: '#FFD100', text: '#111111' }, // Bright Yellow
  { shirt: '#00B4D8', text: '#FFFFFF' }, // Electric Cyan
  { shirt: '#16181C', text: '#FFFFFF' }, // Pitch Black
];

function makeGkKit(shirt: string, text: string): Kit {
  return {
    shirt,
    shirt2: shirt,
    pattern: 'solid',
    shorts: shirt,
    socks: shirt,
    text,
  };
}

/**
 * Resolves match kit assignments for home and away teams.
 * Away team wears their home kit unless primary shirt colors clash (ΔE < 25),
 * in which case they switch to their away kit (SPEC §9.2).
 */
export function resolveMatchKits(homeClub: Club, awayClub: Club): ResolvedMatchKits {
  const homeOutfield = homeClub.kits?.home ?? DEFAULT_HOME_KIT;
  const awayHomeKit = awayClub.kits?.home ?? DEFAULT_HOME_KIT;
  const awayAwayKit = awayClub.kits?.away ?? DEFAULT_AWAY_KIT;

  const homeShirt = homeOutfield.shirt;
  const awayHomeShirt = awayHomeKit.shirt;
  const awayAwayShirt = awayAwayKit.shirt;

  const deltaEHomeVsHome = colorDeltaE(homeShirt, awayHomeShirt);
  const deltaEHomeVsAway = colorDeltaE(homeShirt, awayAwayShirt);

  let awayOutfield: Kit;
  let isAwayKitUsed = false;
  let shirtDeltaE = deltaEHomeVsHome;

  // If home shirts clash (ΔE < 25), switch away team to away kit
  if (deltaEHomeVsHome < 25) {
    awayOutfield = awayAwayKit;
    isAwayKitUsed = true;
    shirtDeltaE = deltaEHomeVsAway;
  } else {
    awayOutfield = awayHomeKit;
    isAwayKitUsed = false;
  }

  // Double-check: if both clash (rare edge case), choose whichever has greater ΔE
  if (shirtDeltaE < 25 && deltaEHomeVsAway > deltaEHomeVsHome) {
    awayOutfield = awayAwayKit;
    isAwayKitUsed = true;
    shirtDeltaE = deltaEHomeVsAway;
  }

  // Goalkeeper kit selection: ensure GK contrasts with both outfield teams and other GK (ΔE >= 25)
  const homePreferred = homeClub.kits?.gk?.shirt ?? '#2EE59D';
  const awayPreferred = awayClub.kits?.gk?.shirt ?? '#FF8A00';

  // Sort palette putting preferred at the front
  const homePalette = [
    ...GK_COLOR_PALETTE.filter((c) => c.shirt === homePreferred),
    ...GK_COLOR_PALETTE.filter((c) => c.shirt !== homePreferred),
  ];

  const validHomeGk =
    homePalette.find(
      (gk) =>
        colorDeltaE(gk.shirt, homeOutfield.shirt) >= 25 &&
        colorDeltaE(gk.shirt, awayOutfield.shirt) >= 25,
    ) ?? homePalette[0]!;

  const homeGk = makeGkKit(validHomeGk.shirt, validHomeGk.text);

  const awayPalette = [
    ...GK_COLOR_PALETTE.filter((c) => c.shirt === awayPreferred),
    ...GK_COLOR_PALETTE.filter((c) => c.shirt !== awayPreferred),
  ];

  const validAwayGk =
    awayPalette.find(
      (gk) =>
        colorDeltaE(gk.shirt, homeOutfield.shirt) >= 25 &&
        colorDeltaE(gk.shirt, awayOutfield.shirt) >= 25 &&
        colorDeltaE(gk.shirt, homeGk.shirt) >= 25,
    ) ??
    awayPalette.find((gk) => colorDeltaE(gk.shirt, awayOutfield.shirt) >= 25) ??
    awayPalette[0]!;

  const awayGk = makeGkKit(validAwayGk.shirt, validAwayGk.text);

  return {
    homeOutfield,
    awayOutfield,
    homeGk,
    awayGk,
    isAwayKitUsed,
    shirtDeltaE,
  };
}
