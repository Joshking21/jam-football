// Implements SPEC §8.5, §18.4 KitIcon component
import React from 'react';
import { generateKitSvg, KitData } from '@/assets/procedural/kit';

export interface KitIconProps {
  kit: KitData;
  size?: number;
  squadNumber?: number;
  className?: string;
}

export const KitIcon: React.FC<KitIconProps> = ({
  kit,
  size = 48,
  squadNumber,
  className = '',
}) => {
  const svgMarkup = generateKitSvg(kit, size, squadNumber);

  return (
    <div
      className={className}
      style={{
        width: size,
        height: Math.round(size * 1.1),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
};
