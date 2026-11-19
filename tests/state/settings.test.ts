// Unit tests for settings (SPEC §20.5)
import { describe, it, expect } from 'vitest';
import { getDefaultSettings } from '@/state/settings';

describe('Settings defaults', () => {
  it('loads exact default settings per SPEC §20.5', () => {
    const defaults = getDefaultSettings();
    expect(defaults.master).toBe(80);
    expect(defaults.music).toBe(50);
    expect(defaults.crowd).toBe(70);
    expect(defaults.commentary).toBe(85);
    expect(defaults.effects).toBe(70);
    expect(defaults.voice).toBe(true);
    expect(defaults.speed).toBe('Key highlights');
    expect(defaults.autoContinue).toBe(false);
    expect(defaults.confirmInstant).toBe(true);
    expect(defaults.quality).toBe('Auto');
    expect(defaults.fps).toBe(false);
    expect(defaults.largerText).toBe(false);
    expect(defaults.colorblind).toBe(false);
  });
});
