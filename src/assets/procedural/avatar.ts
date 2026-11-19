// Implements SPEC §18.4 Procedural Avatar Generator

export interface AvatarOptions {
  initials: string;
  primaryColor: string;
  secondaryColor: string;
  skinColor?: string;
  size?: number;
}

export function generateAvatarSvg(options: AvatarOptions): string {
  const { initials, primaryColor, secondaryColor, skinColor = '#C68642', size = 128 } = options;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
  <defs>
    <clipPath id="avatar-circle">
      <circle cx="50" cy="50" r="48" />
    </clipPath>
  </defs>
  <circle cx="50" cy="50" r="48" fill="#0F1729" stroke="#263557" stroke-width="2" />
  <g clip-path="url(#avatar-circle)">
    <!-- Kit Torso & Shoulders -->
    <path d="M15 100 C15 75 30 65 50 65 C70 65 85 75 85 100 Z" fill="${primaryColor}" />
    <!-- Collar & Accent -->
    <path d="M40 65 L50 78 L60 65 Z" fill="${secondaryColor}" />
    <!-- Neck -->
    <rect x="44" y="52" width="12" height="16" fill="${skinColor}" />
    <!-- Head -->
    <circle cx="50" cy="40" r="18" fill="${skinColor}" />
    <!-- Hair outline / silhouette -->
    <path d="M32 38 C32 26 40 20 50 20 C60 20 68 26 68 38 C62 30 38 30 32 38 Z" fill="#1A1A1A" />
    <!-- Initials Badge -->
    <rect x="32" y="78" width="36" height="16" rx="4" fill="#0F1729" opacity="0.85" />
    <text x="50" y="90"
          text-anchor="middle"
          font-family="'Barlow Condensed', sans-serif"
          font-weight="700"
          font-size="11"
          letter-spacing="0.05em"
          fill="#F3F6FB">${initials.toUpperCase()}</text>
  </g>
</svg>`;
}
