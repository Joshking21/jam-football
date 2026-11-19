// Implements SPEC §18.1, §18.4 Portrait component with asset registry + procedural fallback
import React from 'react';
import { assetUrl } from '@/assets/registry';
import { generateAvatarSvg } from '@/assets/procedural/avatar';

export interface PortraitProps {
  playerId: string;
  initials?: string;
  primaryColor?: string;
  secondaryColor?: string;
  size?: number;
  className?: string;
}

export const Portrait: React.FC<PortraitProps> = ({
  playerId,
  initials = 'PL',
  primaryColor = '#0B1F3A',
  secondaryColor = '#F2B705',
  size = 48,
  className = '',
}) => {
  const realUrl = assetUrl(`images/portraits/${playerId}.webp`);

  if (realUrl) {
    return (
      <img
        src={realUrl}
        alt="Player portrait"
        width={size}
        height={size}
        className={className}
        style={{ borderRadius: '50%', objectFit: 'cover' }}
      />
    );
  }

  const svgMarkup = generateAvatarSvg({
    initials,
    primaryColor,
    secondaryColor,
    size,
  });

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
      }}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
};
