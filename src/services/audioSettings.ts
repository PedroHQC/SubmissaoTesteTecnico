export const DEFAULT_AUDIO_SETTINGS = {
  masterVolume: 0.8,
  sfxVolume: 0.8,
  cannonsVolume: 0.8,
  impactsVolume: 0.75,
  explosionsVolume: 0.8,
  uiVolume: 0.65,
  alertsVolume: 0.75,
  ambienceVolume: 0.45,
  sailingVolume: 0.4,
  muted: false,
};

export type AudioSettings = typeof DEFAULT_AUDIO_SETTINGS;
export type AudioVolumeKey = Exclude<keyof AudioSettings, 'muted'>;
const STORAGE_KEY = 'JUNGLE_AUDIO_SETTINGS_V1';

export function normalizeAudioSettings(value: unknown): AudioSettings {
  const settings = { ...DEFAULT_AUDIO_SETTINGS };
  if (!value || typeof value !== 'object') return settings;
  const raw = value as Record<string, unknown>;
  for (const key of Object.keys(settings) as Array<keyof AudioSettings>) {
    if (key === 'muted') {
      if (typeof raw[key] === 'boolean') settings.muted = raw[key];
    } else {
      const volume = raw[key];
      if (typeof volume === 'number' && Number.isFinite(volume)) {
        settings[key] = Math.max(0, Math.min(1, volume));
      }
    }
  }
  return settings;
}

export function loadAudioSettings(): AudioSettings {
  try {
    return normalizeAudioSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function saveAudioSettings(settings: AudioSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Volume controls still work when browser storage is unavailable.
  }
}
