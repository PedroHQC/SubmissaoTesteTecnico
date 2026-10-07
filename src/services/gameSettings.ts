// src/services/gameSettings.ts

export interface GameSettings {
  mode?: 'arena' | 'open-sea';
  sessionTime: number; // Tempo da partida em segundos (ex: 60)
  enemySpawnInterval: number; // Intervalo de spawn em segundos (ex: 1.5)
}

export const SETTINGS_LIMITS = {
  sessionTime: { min: 60, max: 180, default: 60 },
  enemySpawnInterval: { min: 0.5, max: 5.0, default: 1.5 },
} as const;

const SETTINGS_KEY = 'PIXI_GAME_SETTINGS_V1';

export function getSavedSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return getDefaultSettings();

    const parsed = JSON.parse(raw);
    const validSession = validateSessionTime(parsed.sessionTime);
    const validSpawn = validateSpawnInterval(parsed.enemySpawnInterval);

    return {
      mode: parsed.mode === 'open-sea' ? 'open-sea' : 'arena',
      sessionTime: validSession.isValid ? parsed.sessionTime : SETTINGS_LIMITS.sessionTime.default,
      enemySpawnInterval: validSpawn.isValid
        ? parsed.enemySpawnInterval
        : SETTINGS_LIMITS.enemySpawnInterval.default,
    };
  } catch {
    return getDefaultSettings();
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* Keep session settings usable. */
  }
}

export function getDefaultSettings(): GameSettings {
  return {
    mode: 'arena',
    sessionTime: SETTINGS_LIMITS.sessionTime.default,
    enemySpawnInterval: SETTINGS_LIMITS.enemySpawnInterval.default,
  };
}

export function validateSessionTime(val: number): { isValid: boolean; message?: string } {
  if (!Number.isFinite(val)) return { isValid: false, message: 'Enter a valid number.' };
  if (val < SETTINGS_LIMITS.sessionTime.min || val > SETTINGS_LIMITS.sessionTime.max) {
    return {
      isValid: false,
      message: `Game session time must be between ${SETTINGS_LIMITS.sessionTime.min}s and ${SETTINGS_LIMITS.sessionTime.max}s.`,
    };
  }
  return { isValid: true };
}

export function validateSpawnInterval(val: number): { isValid: boolean; message?: string } {
  if (!Number.isFinite(val)) return { isValid: false, message: 'Enter a valid number.' };
  if (
    val < SETTINGS_LIMITS.enemySpawnInterval.min ||
    val > SETTINGS_LIMITS.enemySpawnInterval.max
  ) {
    return {
      isValid: false,
      message: `Enemy spawn time must be between ${SETTINGS_LIMITS.enemySpawnInterval.min}s and ${SETTINGS_LIMITS.enemySpawnInterval.max}s.`,
    };
  }
  return { isValid: true };
}
