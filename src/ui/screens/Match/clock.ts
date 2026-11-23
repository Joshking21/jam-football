// Implements SPEC §14.5, §11.16 Match Clock Formatter
// Derives clock only from sim time (t in seconds), clamped at 0.
// Stoppage time rendered as 45+2, 90+3, etc.

export function formatMatchClock(t: number, half: 1 | 2 = 1): string {
  const safeT = Math.max(0, t);

  if (half === 1) {
    if (safeT <= 2700) {
      const min = Math.floor(safeT / 60);
      const sec = Math.floor(safeT % 60);
      return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
    const extraSec = safeT - 2700;
    const extraMin = Math.max(1, Math.floor(extraSec / 60));
    return `45+${extraMin}`;
  } else {
    if (safeT <= 5400) {
      const min = Math.floor(safeT / 60);
      const sec = Math.floor(safeT % 60);
      return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
    const extraSec = safeT - 5400;
    const extraMin = Math.max(1, Math.floor(extraSec / 60));
    return `90+${extraMin}`;
  }
}
