// Helper for creating safe 2D canvas elements in browser and Node/Vitest environments

export function createSafeCanvas(width: number, height: number): HTMLCanvasElement {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  // Safe mock for Node / Vitest environments: every drawing call is a no-op, gradients and
  // patterns return stubs, and property writes (fillStyle, font…) are accepted.
  const gradient = { addColorStop: () => {} };
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (
          prop === 'createRadialGradient' ||
          prop === 'createLinearGradient' ||
          prop === 'createPattern'
        )
          return () => gradient;
        if (prop === 'measureText') return () => ({ width: 0 });
        return () => {};
      },
      set: () => true,
    },
  );
  return {
    width,
    height,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
}
