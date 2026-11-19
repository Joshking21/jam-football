// Implements SPEC §18.4 Procedural Crest Generator

export type CrestEmblem =
  | 'anchor'
  | 'hammer'
  | 'bird'
  | 'wave'
  | 'gate'
  | 'flame'
  | 'tree'
  | 'crow';

export const CLUB_EMBLEMS: Record<string, CrestEmblem> = {
  c01: 'anchor',
  c02: 'hammer',
  c03: 'bird',
  c04: 'wave',
  c05: 'flame',
  c06: 'gate',
  c07: 'flame',
  c08: 'tree',
  c09: 'tree',
  c10: 'crow',
};

function getEmblemPath(emblem: CrestEmblem): string {
  switch (emblem) {
    case 'anchor':
      return `
        <circle cx="50" cy="38" r="6" fill="none" stroke="currentColor" stroke-width="4" />
        <path d="M50 44 L50 68 M40 50 L60 50" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
        <path d="M34 58 C34 72 66 72 66 58" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
        <path d="M30 58 L38 58 M62 58 L70 58" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
      `;
    case 'hammer':
      return `
        <rect x="36" y="36" width="28" height="14" rx="2" fill="currentColor" />
        <rect x="47" y="50" width="6" height="24" rx="1" fill="currentColor" />
      `;
    case 'bird':
      return `
        <path d="M50 36 C42 42 34 46 28 44 C34 52 44 54 50 66 C56 54 66 52 72 44 C66 46 58 42 50 36 Z" fill="currentColor" />
      `;
    case 'wave':
      return `
        <path d="M28 44 C35 38 42 50 50 44 C58 38 65 50 72 44" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
        <path d="M28 54 C35 48 42 60 50 54 C58 48 65 60 72 54" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
        <path d="M28 64 C35 58 42 70 50 64 C58 58 65 70 72 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
      `;
    case 'gate':
      return `
        <path d="M34 68 L34 42 C34 36 66 36 66 42 L66 68 M34 50 L66 50 M44 40 L44 68 M56 40 L56 68" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
      `;
    case 'flame':
      return `
        <path d="M50 34 C50 34 58 44 58 54 C58 62 54 68 50 68 C46 68 42 62 42 54 C42 48 45 44 50 34 Z" fill="currentColor" />
        <path d="M50 46 C52 50 54 54 54 58 C54 62 52 64 50 64 C48 64 46 62 46 58 C46 55 48 52 50 46 Z" fill="var(--crest-bg)" />
      `;
    case 'tree':
      return `
        <polygon points="50,34 66,52 56,52 68,64 32,64 44,52 34,52" fill="currentColor" />
        <rect x="47" y="64" width="6" height="8" fill="currentColor" />
      `;
    case 'crow':
      return `
        <path d="M34 56 C38 46 48 42 56 42 C64 42 68 46 72 48 L64 52 C60 52 56 50 50 52 C44 54 40 60 34 56 Z" fill="currentColor" />
        <circle cx="58" cy="45" r="1.5" fill="var(--crest-bg)" />
        <path d="M46 54 L36 68 L44 68 L52 58 Z" fill="currentColor" />
      `;
  }
}

export function generateCrestSvg(
  code: string,
  primaryColor: string,
  secondaryColor: string,
  emblem: CrestEmblem = 'anchor',
): string {
  const emblemPath = getEmblemPath(emblem);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 115" width="100%" height="100%">
  <defs>
    <filter id="crest-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3" />
    </filter>
  </defs>
  <!-- Shield shape -->
  <path d="M50 5 L88 15 C88 55 76 90 50 110 C24 90 12 55 12 15 Z"
        fill="${primaryColor}"
        stroke="${secondaryColor}"
        stroke-width="5"
        stroke-linejoin="round"
        filter="url(#crest-shadow)" />
  <!-- Inner border -->
  <path d="M50 11 L82 20 C82 52 71 83 50 102 C29 83 18 52 18 20 Z"
        fill="none"
        stroke="${secondaryColor}"
        stroke-width="1.5"
        opacity="0.4" />
  <!-- Emblem container with custom style -->
  <g style="color: ${secondaryColor}; --crest-bg: ${primaryColor};">
    ${emblemPath}
  </g>
  <!-- Club code banner -->
  <rect x="25" y="74" width="50" height="18" rx="4" fill="${secondaryColor}" />
  <text x="50" y="87"
        text-anchor="middle"
        font-family="'Barlow Condensed', sans-serif"
        font-weight="700"
        font-size="13"
        letter-spacing="0.1em"
        fill="${primaryColor}">${code.toUpperCase()}</text>
</svg>`;
}
