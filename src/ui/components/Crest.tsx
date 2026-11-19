// Implements SPEC §18.1, §18.4 Crest component with asset registry + procedural fallback
import React from 'react';
import { assetUrl } from '@/assets/registry';
import { generateCrestSvg, CLUB_EMBLEMS } from '@/assets/procedural/crest';

export interface CrestProps {
  clubId: string;
  code?: string;
  primaryColor?: string;
  secondaryColor?: string;
  size?: number;
  className?: string;
}

export const Crest: React.FC<CrestProps> = ({
  clubId,
  code = 'FC',
  primaryColor = '#0B1F3A',
  secondaryColor = '#F2B705',
  size = 48,
  className = '',
}) => {
  const realUrl = assetUrl(`images/crests/${clubId}.webp`);

  if (realUrl) {
    return (
      <img
        src={realUrl}
        alt={`${code} crest`}
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain' }}
      />
    );
  }

  const emblem = CLUB_EMBLEMS[clubId] || 'anchor';
  const svgMarkup = generateCrestSvg(code, primaryColor, secondaryColor, emblem);

  return (
    <div
      className={className}
      style={{
        width: size,
        height: Math.round(size * 1.15),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
};
