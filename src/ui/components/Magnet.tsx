// Implements SPEC §19.5 Magnet (Tactics):
// 44px circle in player shirt colour with his number, surname under it in Barlow Condensed 600 --board-ink.
// Follows pointer / spring physics, lifts on drag / hover.
import React from 'react';

interface MagnetProps {
  number: number;
  surname: string;
  roleLabel?: string;
  fitColor?: string; // green/amber/red indicator
  kitColor?: string; // primary club color
  textColor?: string;
  isDragging?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const Magnet: React.FC<MagnetProps> = ({
  number,
  surname,
  roleLabel,
  fitColor = '#18C77A',
  kitColor = '#FF5B35',
  textColor = '#FFFFFF',
  isDragging = false,
  isSelected = false,
  onClick,
  className = '',
  style,
}) => {
  return (
    <div
      className={`tactics-magnet ${isDragging ? 'dragging' : ''} ${isSelected ? 'selected' : ''} ${className}`}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'grab',
        userSelect: 'none',
        transform: isDragging ? 'scale(1.08)' : isSelected ? 'scale(1.05)' : 'scale(1)',
        transition: 'transform var(--dur-fast) var(--ease-snap), box-shadow var(--dur-fast)',
        ...style,
      }}
    >
      {/* 44px Circular Counter */}
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          backgroundColor: kitColor,
          color: textColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-head)',
          fontWeight: 700,
          fontSize: '18px',
          border: `2px solid ${isSelected ? 'var(--board-ink)' : 'rgba(0,0,0,0.3)'}`,
          boxShadow: isDragging ? '0 8px 16px rgba(0,0,0,0.4)' : '0 2px 5px rgba(0,0,0,0.25)',
          position: 'relative',
        }}
      >
        {number}

        {/* Fit colour dot (green >= natural, amber 0.8-0.95, red < 0.8) */}
        {fitColor && (
          <span
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: fitColor,
              border: '1.5px solid #FFFFFF',
            }}
          />
        )}
      </div>

      {/* Surname below counter */}
      <span
        style={{
          fontFamily: 'var(--font-head)',
          fontWeight: 600,
          fontSize: '13px',
          color: 'var(--board-ink)',
          letterSpacing: '0.02em',
          marginTop: '2px',
          textTransform: 'uppercase',
          maxWidth: '70px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'center',
        }}
      >
        {surname}
      </span>

      {/* Duty / Role label */}
      {roleLabel && (
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: '10px',
            color: 'rgba(30, 42, 56, 0.7)',
            textTransform: 'uppercase',
          }}
        >
          {roleLabel}
        </span>
      )}
    </div>
  );
};
