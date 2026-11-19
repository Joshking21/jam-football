// Implements SPEC §19.7 FlipList:
// FLIP animation for reordered rows with --dur-reorder (700ms), 30ms stagger.
// Flashes --win at 12% opacity for 600ms on move up, --loss on move down.
import React, { useLayoutEffect, useRef } from 'react';
import { useSettings } from '../../state/store';

interface FlipListProps {
  children: React.ReactNode;
  orderKey: string | number; // change triggers FLIP
  className?: string;
  style?: React.CSSProperties;
}

export const FlipList: React.FC<FlipListProps> = ({
  children,
  orderKey,
  className = '',
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevPositionsRef = useRef<Map<string, number>>(new Map());
  const { reduceMotion } = useSettings();

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const childrenElements = Array.from(container.children) as HTMLElement[];

    const currentPositions = new Map<string, number>();
    childrenElements.forEach((el) => {
      const id = el.dataset.flipId;
      if (id) {
        currentPositions.set(id, el.getBoundingClientRect().top);
      }
    });

    const prevPositions = prevPositionsRef.current;
    if (prevPositions.size > 0) {
      let index = 0;
      childrenElements.forEach((el) => {
        const id = el.dataset.flipId;
        if (!id) return;
        const prevTop = prevPositions.get(id);
        const currentTop = currentPositions.get(id);

        if (prevTop !== undefined && currentTop !== undefined) {
          const deltaY = prevTop - currentTop;
          if (deltaY !== 0) {
            const isUp = deltaY > 0;
            const flashColor = isUp ? 'rgba(24, 199, 122, 0.12)' : 'rgba(255, 77, 94, 0.12)';

            if (!reduceMotion) {
              el.style.transform = `translateY(${deltaY}px)`;
              el.style.transition = 'none';

              const delay = index * 30; // 30ms stagger
              requestAnimationFrame(() => {
                el.style.transition = `transform 700ms cubic-bezier(0.2, 0.9, 0.1, 1) ${delay}ms, background-color 600ms ease`;
                el.style.transform = 'translateY(0)';
                el.style.backgroundColor = flashColor;

                setTimeout(() => {
                  el.style.backgroundColor = '';
                }, 600 + delay);
              });
            } else {
              el.style.backgroundColor = flashColor;
              setTimeout(() => {
                el.style.backgroundColor = '';
              }, 600);
            }
            index++;
          }
        }
      });
    }

    prevPositionsRef.current = currentPositions;
  }, [orderKey, reduceMotion]);

  return (
    <div ref={containerRef} className={`flip-list ${className}`} style={style}>
      {children}
    </div>
  );
};
