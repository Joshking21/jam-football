// Implements SPEC §8.5 and §18.4 Procedural Kit Generator

export type KitPattern = 'solid' | 'stripes' | 'hoops' | 'halves' | 'sash' | 'chevron';

export interface KitData {
  shirt: string;
  shirt2: string;
  pattern: KitPattern;
  shorts: string;
  socks: string;
  text: string;
}

export function generateKitSvg(kit: KitData, size = 128, squadNumber?: number): string {
  const { shirt, shirt2, pattern, shorts, socks, text } = kit;

  let patternMarkup = '';
  switch (pattern) {
    case 'stripes':
      patternMarkup = `
        <defs>
          <pattern id="pat-stripes" width="12" height="10" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="6" height="10" fill="${shirt}" />
            <rect x="6" y="0" width="6" height="10" fill="${shirt2}" />
          </pattern>
        </defs>
        <path d="M25 24 L36 10 L64 10 L75 24 L68 32 L60 26 L60 58 L40 58 L40 26 L32 32 Z" fill="url(#pat-stripes)" />
      `;
      break;
    case 'hoops':
      patternMarkup = `
        <defs>
          <pattern id="pat-hoops" width="10" height="12" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="10" height="6" fill="${shirt}" />
            <rect x="0" y="6" width="10" height="6" fill="${shirt2}" />
          </pattern>
        </defs>
        <path d="M25 24 L36 10 L64 10 L75 24 L68 32 L60 26 L60 58 L40 58 L40 26 L32 32 Z" fill="url(#pat-hoops)" />
      `;
      break;
    case 'halves':
      patternMarkup = `
        <clipPath id="shirt-clip">
          <path d="M25 24 L36 10 L64 10 L75 24 L68 32 L60 26 L60 58 L40 58 L40 26 L32 32 Z" />
        </clipPath>
        <g clip-path="url(#shirt-clip)">
          <rect x="0" y="0" width="50" height="70" fill="${shirt}" />
          <rect x="50" y="0" width="50" height="70" fill="${shirt2}" />
        </g>
      `;
      break;
    case 'sash':
      patternMarkup = `
        <clipPath id="shirt-clip">
          <path d="M25 24 L36 10 L64 10 L75 24 L68 32 L60 26 L60 58 L40 58 L40 26 L32 32 Z" />
        </clipPath>
        <path d="M25 24 L36 10 L64 10 L75 24 L68 32 L60 26 L60 58 L40 58 L40 26 L32 32 Z" fill="${shirt}" />
        <g clip-path="url(#shirt-clip)">
          <polygon points="35,10 47,10 65,58 53,58" fill="${shirt2}" />
        </g>
      `;
      break;
    case 'chevron':
      patternMarkup = `
        <clipPath id="shirt-clip">
          <path d="M25 24 L36 10 L64 10 L75 24 L68 32 L60 26 L60 58 L40 58 L40 26 L32 32 Z" />
        </clipPath>
        <path d="M25 24 L36 10 L64 10 L75 24 L68 32 L60 26 L60 58 L40 58 L40 26 L32 32 Z" fill="${shirt}" />
        <g clip-path="url(#shirt-clip)">
          <polygon points="32,24 50,38 68,24 68,32 50,46 32,32" fill="${shirt2}" />
        </g>
      `;
      break;
    case 'solid':
    default:
      patternMarkup = `
        <path d="M25 24 L36 10 L64 10 L75 24 L68 32 L60 26 L60 58 L40 58 L40 26 L32 32 Z" fill="${shirt}" />
        <!-- Collar/trim -->
        <path d="M44 10 L50 18 L56 10 Z" fill="${shirt2}" />
      `;
      break;
  }

  const numberDisplay =
    squadNumber != null
      ? `
    <text x="50" y="42" text-anchor="middle" font-family="'Barlow Condensed', sans-serif" font-weight="700" font-size="16" fill="${text}">${squadNumber}</text>
  `
      : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 110" width="${size}" height="${size * 1.1}">
  <!-- Shirt -->
  ${patternMarkup}
  <!-- Number -->
  ${numberDisplay}
  <!-- Shorts -->
  <path d="M40 59 L60 59 L62 76 L52 76 L50 67 L48 76 L38 76 Z" fill="${shorts}" stroke="#16213A" stroke-width="0.5" />
  <!-- Socks -->
  <rect x="40" y="80" width="8" height="24" rx="2" fill="${socks}" />
  <rect x="52" y="80" width="8" height="24" rx="2" fill="${socks}" />
</svg>`;
}
