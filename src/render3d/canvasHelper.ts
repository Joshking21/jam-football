// Helper for creating safe 2D canvas elements in browser and Node/Vitest environments

export function createSafeCanvas(width: number, height: number): HTMLCanvasElement {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  // Safe mock for Node / Vitest environments
  return {
    width,
    height,
    getContext: () => ({
      fillRect: () => {},
      strokeRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      arc: () => {},
      ellipse: () => {},
      rect: () => {},
      clip: () => {},
      save: () => {},
      restore: () => {},
      fillText: () => {},
      roundRect: () => {},
      createRadialGradient: () => ({ addColorStop: () => {} }),
    }),
  } as unknown as HTMLCanvasElement;
}
