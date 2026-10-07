import { JuicyButton } from './JuicyButton';
import { useState } from 'react';
import { audio } from '../../engine/services/audioManager';
import {
  AudioSettings,
  AudioVolumeKey,
  DEFAULT_AUDIO_SETTINGS,
} from '../../services/audioSettings';

const CHANNELS: Array<{ key: AudioVolumeKey; label: string }> = [
  { key: 'masterVolume', label: 'Master volume' },
  { key: 'sfxVolume', label: 'Combat effects' },
  { key: 'cannonsVolume', label: 'Cannons and shots' },
  { key: 'impactsVolume', label: 'Impacts and collisions' },
  { key: 'explosionsVolume', label: 'Explosions and sinking' },
  { key: 'uiVolume', label: 'Buttons and menus' },
  { key: 'alertsVolume', label: 'Match alerts' },
  { key: 'ambienceVolume', label: 'Ocean ambience' },
  { key: 'sailingVolume', label: 'Sailing' },
];

export function AudioOptions() {
  const [settings, setSettings] = useState(() => audio.getSettings());
  const update = (patch: Partial<AudioSettings>) => {
    audio.updateVolumes(patch);
    setSettings(audio.getSettings());
  };

  return (
    <div className="audio-options">
      <label className="audio-mute">
        <input
          type="checkbox"
          checked={settings.muted}
          onChange={(event) => update({ muted: event.target.checked })}
        />
        Mute all sounds
      </label>
      <p className="audio-description">
        Changes are applied and saved automatically. Combat volume controls cannons, impacts and
        explosions.
      </p>
      {CHANNELS.map(({ key, label }) => (
        <div key={key} className="audio-channel">
          <div className="audio-channel-label">
            <label htmlFor={`audio-${key}`}>{label}</label>
            <output htmlFor={`audio-${key}`}>{Math.round(settings[key] * 100)}%</output>
          </div>
          <div className="audio-channel-controls">
            <input
              id={`audio-${key}`}
              type="range"
              min="0"
              max="100"
              step="1"
              value={Math.round(settings[key] * 100)}
              onChange={(event) => update({ [key]: Number(event.target.value) / 100 })}
              aria-valuetext={`${Math.round(settings[key] * 100)} percent`}
            />
            <JuicyButton
              type="button"
              aria-label={`Preview ${label.toLowerCase()}`}
              disabled={settings.muted}
              onClick={() => void audio.preview(key)}
              className="audio-preview"
            >
              Preview
            </JuicyButton>
          </div>
        </div>
      ))}
      <JuicyButton
        type="button"
        onClick={() => update(DEFAULT_AUDIO_SETTINGS)}
        className="audio-reset"
      >
        Restore audio defaults
      </JuicyButton>
    </div>
  );
}
