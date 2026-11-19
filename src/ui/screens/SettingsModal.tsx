// Implements SPEC §11.22 Settings Modal
import React, { useState } from 'react';
import { useStore } from '@/state/store';
import { Modal } from '@/ui/components/Modal';
import { Button } from '@/ui/components/Button';
import { Volume2, Gamepad2, Monitor, Eye, Database } from 'lucide-react';
import { saveGame, loadGame, deleteSaveSlot } from '@/state/saves';

type SettingsTab = 'audio' | 'gameplay' | 'graphics' | 'accessibility' | 'data';

export const SettingsModal: React.FC = () => {
  const isSettingsOpen = useStore((state) => state.isSettingsOpen);
  const closeSettings = useStore((state) => state.closeSettings);
  const settings = useStore((state) => state.settings);
  const updateSettings = useStore((state) => state.updateSettings);
  const gameState = useStore((state) => state.gameState);
  const setGameState = useStore((state) => state.setGameState);
  const showToast = useStore((state) => state.showToast);

  const [activeTab, setActiveTab] = useState<SettingsTab>('audio');

  const handleExportSave = () => {
    if (!gameState) {
      showToast('No active game to export.', 'warning');
      return;
    }
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(gameState, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `touchline-save-${gameState.userClubId}-md${gameState.matchday}.json`,
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Save exported successfully.', 'success');
  };

  const handleImportSave = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const raw = event.target?.result as string;
        const imported = JSON.parse(raw);
        if (!imported.version || !imported.clubs || !imported.userClubId) {
          throw new Error('Invalid save file structure');
        }
        await saveGame('autosave', imported);
        setGameState(imported);
        showToast('Save imported and loaded.', 'success');
        closeSettings();
      } catch (err) {
        showToast('Failed to import save: invalid file format.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteSaves = async () => {
    if (window.confirm('Are you sure you want to delete all local saves? This cannot be undone.')) {
      await deleteSaveSlot('autosave');
      await deleteSaveSlot('slot-1');
      await deleteSaveSlot('slot-2');
      await deleteSaveSlot('slot-3');
      showToast('All save slots deleted.', 'info');
    }
  };

  return (
    <Modal isOpen={isSettingsOpen} onClose={closeSettings} title="Settings" maxWidth={840}>
      <div style={{ display: 'flex', gap: '24px', minHeight: '420px' }}>
        {/* Navigation Tabs */}
        <div
          style={{
            width: '180px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            borderRight: '1px solid var(--border)',
            paddingRight: '16px',
          }}
        >
          {[
            { id: 'audio', label: 'Audio', icon: <Volume2 size={16} /> },
            { id: 'gameplay', label: 'Gameplay', icon: <Gamepad2 size={16} /> },
            { id: 'graphics', label: 'Graphics', icon: <Monitor size={16} /> },
            { id: 'accessibility', label: 'Accessibility', icon: <Eye size={16} /> },
            { id: 'data', label: 'Save Data', icon: <Database size={16} /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as SettingsTab)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-m)',
                background: activeTab === t.id ? 'var(--surface-3)' : 'transparent',
                color: activeTab === t.id ? 'var(--accent)' : 'var(--text-dim)',
                fontWeight: activeTab === t.id ? 600 : 500,
                fontSize: '14px',
                textAlign: 'left',
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Panels */}
        <div style={{ flex: 1, paddingLeft: '8px' }}>
          {activeTab === 'audio' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <SliderRow
                label="Master Volume"
                value={settings.master}
                onChange={(v) => updateSettings({ master: v })}
              />
              <SliderRow
                label="Music"
                value={settings.music}
                onChange={(v) => updateSettings({ music: v })}
              />
              <SliderRow
                label="Crowd Noise"
                value={settings.crowd}
                onChange={(v) => updateSettings({ crowd: v })}
              />
              <SliderRow
                label="Commentary Volume"
                value={settings.commentary}
                onChange={(v) => updateSettings({ commentary: v })}
              />
              <SliderRow
                label="Sound Effects"
                value={settings.effects}
                onChange={(v) => updateSettings({ effects: v })}
              />
              <ToggleRow
                label="Spoken Commentary Voice"
                sublabel="Subtitles & captions remain active when disabled"
                checked={settings.voice}
                onChange={(checked) => updateSettings({ voice: checked })}
              />
            </div>
          )}

          {activeTab === 'gameplay' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontWeight: 600,
                    marginBottom: '8px',
                    fontSize: '14px',
                  }}
                >
                  Default Match Playback Speed
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['Key highlights', 'Extended', 'Full'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => updateSettings({ speed: s })}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-s)',
                        background: settings.speed === s ? 'var(--accent)' : 'var(--surface-3)',
                        color: settings.speed === s ? 'var(--accent-ink)' : 'var(--text)',
                        fontWeight: 600,
                        fontSize: '13px',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <ToggleRow
                label="Auto-continue after highlights"
                sublabel="Do not pause the clock after viewing key events"
                checked={settings.autoContinue}
                onChange={(checked) => updateSettings({ autoContinue: checked })}
              />

              <ToggleRow
                label="Confirm before Instant Result"
                sublabel="Prompt for confirmation before skipping to final whistle"
                checked={settings.confirmInstant}
                onChange={(checked) => updateSettings({ confirmInstant: checked })}
              />
            </div>
          )}

          {activeTab === 'graphics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontWeight: 600,
                    marginBottom: '8px',
                    fontSize: '14px',
                  }}
                >
                  Visual Quality Preset
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['Auto', 'Low', 'Medium', 'High'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => updateSettings({ quality: q })}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-s)',
                        background: settings.quality === q ? 'var(--accent)' : 'var(--surface-3)',
                        color: settings.quality === q ? 'var(--accent-ink)' : 'var(--text)',
                        fontWeight: 600,
                        fontSize: '13px',
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <ToggleRow
                label="Show FPS Counter"
                sublabel="Display rendering frame rate during 3D match view"
                checked={settings.fps}
                onChange={(checked) => updateSettings({ fps: checked })}
              />
            </div>
          )}

          {activeTab === 'accessibility' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <ToggleRow
                label="Reduce Motion"
                sublabel="Disable camera sweeps, pulses and slide transitions"
                checked={settings.reduceMotion}
                onChange={(checked) => updateSettings({ reduceMotion: checked })}
              />

              <ToggleRow
                label="Larger UI Text (+12.5%)"
                sublabel="Increases base typography size across all management screens"
                checked={settings.largerText}
                onChange={(checked) => updateSettings({ largerText: checked })}
              />

              <ToggleRow
                label="Colour-blind Friendly Palette"
                sublabel="Use blue/orange high-contrast attribute and match rating scales"
                checked={settings.colorblind}
                onChange={(checked) => updateSettings({ colorblind: checked })}
              />
            </div>
          )}

          {activeTab === 'data' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  background: 'var(--surface-2)',
                  padding: '16px',
                  borderRadius: 'var(--radius-m)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Export Save File</div>
                <div style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '12px' }}>
                  Download your active season progress as a local JSON file.
                </div>
                <Button variant="secondary" size="s" onClick={handleExportSave}>
                  Export Active Save
                </Button>
              </div>

              <div
                style={{
                  background: 'var(--surface-2)',
                  padding: '16px',
                  borderRadius: 'var(--radius-m)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Import Save File</div>
                <div style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '12px' }}>
                  Upload a previously exported touchline save file to resume playing.
                </div>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportSave}
                  style={{ fontSize: '13px', color: 'var(--text-dim)' }}
                />
              </div>

              <div
                style={{
                  background: 'var(--surface-2)',
                  padding: '16px',
                  borderRadius: 'var(--radius-m)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--danger)', marginBottom: '4px' }}>
                  Clear Save Data
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '12px' }}>
                  Permanently remove all local saves from this browser profile.
                </div>
                <Button variant="danger" size="s" onClick={handleDeleteSaves}>
                  Delete All Saves
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

const SliderRow: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <div>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '6px',
        fontSize: '14px',
      }}
    >
      <span style={{ fontWeight: 500 }}>{label}</span>
      <span style={{ color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>{value}%</span>
    </div>
    <input
      type="range"
      min="0"
      max="100"
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10))}
      style={{
        width: '100%',
        accentColor: 'var(--accent)',
        cursor: 'pointer',
      }}
    />
  </div>
);

const ToggleRow: React.FC<{
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, sublabel, checked, onChange }) => (
  <div
    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}
  >
    <div>
      <div style={{ fontWeight: 500, fontSize: '14px' }}>{label}</div>
      {sublabel && <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{sublabel}</div>}
    </div>
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      style={{
        width: '44px',
        height: '24px',
        borderRadius: '12px',
        background: checked ? 'var(--accent)' : 'var(--surface-3)',
        border: '1px solid var(--border)',
        position: 'relative',
        transition: 'background var(--dur-fast) var(--ease)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          background: checked ? 'var(--accent-ink)' : 'var(--text-dim)',
          position: 'absolute',
          top: '2px',
          left: checked ? '22px' : '3px',
          transition: 'left var(--dur-fast) var(--ease)',
        }}
      />
    </button>
  </div>
);
