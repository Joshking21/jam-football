// Implements SPEC §20.1 and §20.5 Settings state & localStorage persistence

export interface GameSettings {
  // Audio
  master: number;
  music: number;
  crowd: number;
  commentary: number;
  effects: number;
  voice: boolean;
  // Gameplay
  speed: 'Key highlights' | 'Extended' | 'Full';
  autoContinue: boolean;
  confirmInstant: boolean;
  // Graphics
  quality: 'Auto' | 'Low' | 'Medium' | 'High';
  fps: boolean;
  // Accessibility
  reduceMotion: boolean;
  largerText: boolean;
  colorblind: boolean;
}

const STORAGE_KEY = 'touchline.settings';

export function getDefaultSettings(): GameSettings {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return {
    master: 80,
    music: 50,
    crowd: 70,
    commentary: 85,
    effects: 70,
    voice: true,
    speed: 'Key highlights',
    autoContinue: false,
    confirmInstant: true,
    quality: 'Auto',
    fps: false,
    reduceMotion: !!prefersReducedMotion,
    largerText: false,
    colorblind: false,
  };
}

export function loadSettings(): GameSettings {
  const defaults = getDefaultSettings();
  if (typeof window === 'undefined' || !window.localStorage) {
    return defaults;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: GameSettings): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    applySettingsToDom(settings);
  } catch (err) {
    console.warn('Failed to save settings to localStorage', err);
  }
}

export function applySettingsToDom(settings: GameSettings): void {
  if (typeof document === 'undefined') return;

  if (settings.reduceMotion) {
    document.body.classList.add('reduce-motion');
  } else {
    document.body.classList.remove('reduce-motion');
  }

  if (settings.largerText) {
    document.body.classList.add('large-text');
  } else {
    document.body.classList.remove('large-text');
  }

  if (settings.colorblind) {
    document.body.classList.add('colorblind');
  } else {
    document.body.classList.remove('colorblind');
  }
}
