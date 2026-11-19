// Implements SPEC §11.7 and §18.4 Procedural National Flags

export type NationCode =
  | 'ENG'
  | 'NGA'
  | 'FRA'
  | 'ESP'
  | 'BRA'
  | 'NED'
  | 'GHA'
  | 'POR'
  | 'GER'
  | 'IRL'
  | 'SEN'
  | 'SCO'
  | 'ARG'
  | 'DEN';

export function generateFlagSvg(code: NationCode, width = 24, height = 16): string {
  let content = '';

  switch (code) {
    case 'ENG': // England: White with Red St George's Cross
      content = `
        <rect width="60" height="40" fill="#FFFFFF" />
        <rect x="25" y="0" width="10" height="40" fill="#CF081F" />
        <rect x="0" y="15" width="60" height="10" fill="#CF081F" />
      `;
      break;
    case 'NGA': // Nigeria: Green / White / Green vertical
      content = `
        <rect width="20" height="40" fill="#008751" />
        <rect x="20" width="20" height="40" fill="#FFFFFF" />
        <rect x="40" width="20" height="40" fill="#008751" />
      `;
      break;
    case 'FRA': // France: Blue / White / Red vertical
      content = `
        <rect width="20" height="40" fill="#002395" />
        <rect x="20" width="20" height="40" fill="#FFFFFF" />
        <rect x="40" width="20" height="40" fill="#ED2939" />
      `;
      break;
    case 'ESP': // Spain: Red / Yellow / Red horizontal
      content = `
        <rect width="60" height="10" fill="#AA151B" />
        <rect y="10" width="60" height="20" fill="#F1BF00" />
        <rect y="30" width="60" height="10" fill="#AA151B" />
      `;
      break;
    case 'BRA': // Brazil: Green field, Yellow rhombus, Blue circle
      content = `
        <rect width="60" height="40" fill="#009C3B" />
        <polygon points="30,4 56,20 30,36 4,20" fill="#FFDF00" />
        <circle cx="30" cy="20" r="7" fill="#002776" />
      `;
      break;
    case 'NED': // Netherlands: Red / White / Blue horizontal
      content = `
        <rect width="60" height="13.3" fill="#AE1C28" />
        <rect y="13.3" width="60" height="13.4" fill="#FFFFFF" />
        <rect y="26.7" width="60" height="13.3" fill="#21468B" />
      `;
      break;
    case 'GHA': // Ghana: Red / Yellow / Green with black star
      content = `
        <rect width="60" height="13.3" fill="#CF081F" />
        <rect y="13.3" width="60" height="13.4" fill="#FFDA44" />
        <rect y="26.7" width="60" height="13.3" fill="#006B3F" />
        <polygon points="30,15 32,21 38,21 33,25 35,31 30,27 25,31 27,25 22,21 28,21" fill="#000000" />
      `;
      break;
    case 'POR': // Portugal: Green / Red with gold sphere
      content = `
        <rect width="24" height="40" fill="#006600" />
        <rect x="24" width="36" height="40" fill="#FF0000" />
        <circle cx="24" cy="20" r="6" fill="#FFCC00" />
      `;
      break;
    case 'GER': // Germany: Black / Red / Gold horizontal
      content = `
        <rect width="60" height="13.3" fill="#000000" />
        <rect y="13.3" width="60" height="13.4" fill="#DD0000" />
        <rect y="26.7" width="60" height="13.3" fill="#FFCC00" />
      `;
      break;
    case 'IRL': // Ireland: Green / White / Orange vertical
      content = `
        <rect width="20" height="40" fill="#169B62" />
        <rect x="20" width="20" height="40" fill="#FFFFFF" />
        <rect x="40" width="20" height="40" fill="#FF883E" />
      `;
      break;
    case 'SEN': // Senegal: Green / Yellow / Red with green star
      content = `
        <rect width="20" height="40" fill="#00853F" />
        <rect x="20" width="20" height="40" fill="#FDEF42" />
        <rect x="40" width="20" height="40" fill="#E31B23" />
        <polygon points="30,15 32,21 38,21 33,25 35,31 30,27 25,31 27,25 22,21 28,21" fill="#00853F" />
      `;
      break;
    case 'SCO': // Scotland: Blue with white Saltire
      content = `
        <rect width="60" height="40" fill="#005EB8" />
        <line x1="0" y1="0" x2="60" y2="40" stroke="#FFFFFF" stroke-width="7" />
        <line x1="60" y1="0" x2="0" y2="40" stroke="#FFFFFF" stroke-width="7" />
      `;
      break;
    case 'ARG': // Argentina: Sky Blue / White / Sky Blue with sun
      content = `
        <rect width="60" height="13.3" fill="#75AADB" />
        <rect y="13.3" width="60" height="13.4" fill="#FFFFFF" />
        <rect y="26.7" width="60" height="13.3" fill="#75AADB" />
        <circle cx="30" cy="20" r="4" fill="#F6B40E" />
      `;
      break;
    case 'DEN': // Denmark: Red with white Nordic cross
      content = `
        <rect width="60" height="40" fill="#C8102E" />
        <rect x="18" y="0" width="7" height="40" fill="#FFFFFF" />
        <rect x="0" y="16.5" width="60" height="7" fill="#FFFFFF" />
      `;
      break;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40" width="${width}" height="${height}" style="border-radius: 2px; overflow: hidden; display: inline-block; vertical-align: middle; box-shadow: 0 0 1px rgba(0,0,0,0.5);">
    ${content}
  </svg>`;
}
