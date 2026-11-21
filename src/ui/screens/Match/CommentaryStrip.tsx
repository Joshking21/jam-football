// Implements SPEC §11.16 Bottom Commentary Caption Strip
import React, { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';

interface CommentaryStripProps {
  text: string;
  importance?: number; // 0..3
}

export const CommentaryStrip: React.FC<CommentaryStripProps> = ({ text, importance = 0 }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!text) return;
    setVisible(true);

    // Fade out after 4 seconds per SPEC §11.16
    const timer = setTimeout(() => {
      setVisible(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, [text]);

  if (!visible || !text) return null;

  const isBigMoment = importance >= 2;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 30,
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: 720,
        width: '90%',
        background: isBigMoment ? 'rgba(30, 20, 10, 0.95)' : 'rgba(10, 14, 20, 0.9)',
        backdropFilter: 'blur(12px)',
        border: isBigMoment
          ? '1px solid rgba(244, 180, 26, 0.5)'
          : '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: 8,
        padding: '10px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
        zIndex: 50,
        animation: 'fadeInUp 0.25s ease-out',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: isBigMoment ? 'rgba(244, 180, 26, 0.2)' : 'rgba(255, 255, 255, 0.1)',
          color: isBigMoment ? '#F4B41A' : '#94A3B8',
          flexShrink: 0,
        }}
      >
        <Volume2 size={16} />
      </div>

      <div
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: isBigMoment ? 16 : 14,
          fontWeight: isBigMoment ? 700 : 500,
          color: isBigMoment ? '#FFF' : '#E2E8F0',
          lineHeight: 1.3,
          letterSpacing: 0.3,
        }}
      >
        {text}
      </div>
    </div>
  );
};
