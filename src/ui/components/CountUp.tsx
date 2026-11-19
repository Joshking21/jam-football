// Implements SPEC §19.7 CountUp:
// counts from old to new value in --dur-count (650ms) with --ease-out, tabular numerals.
// Runs on first view after change; reduce motion jumps straight to value.
import React, { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../state/store';

interface CountUpProps {
  value: number;
  format?: (n: number) => string;
  className?: string;
  style?: React.CSSProperties;
}

export const CountUp: React.FC<CountUpProps> = ({
  value,
  format = (n) => Math.round(n).toLocaleString(),
  className = '',
  style,
}) => {
  const { reduceMotion } = useSettings();
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const prev = prevValueRef.current;
    if (prev === value || reduceMotion) {
      setDisplayValue(value);
      prevValueRef.current = value;
      return;
    }

    const duration = 650; // --dur-count = 650ms
    const startTime = performance.now();
    let animId: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = prev + (value - prev) * ease;

      setDisplayValue(current);

      if (progress < 1) {
        animId = requestAnimationFrame(tick);
      } else {
        setDisplayValue(value);
        prevValueRef.current = value;
      }
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [value, reduceMotion]);

  return (
    <span
      className={`tabular-nums count-up ${className}`}
      style={{
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
    >
      {format(displayValue)}
    </span>
  );
};
