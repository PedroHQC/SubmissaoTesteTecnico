// src/bridge/events.ts
import { GameSettings } from '../services/gameSettings';

export interface UIToEngineEvents {
  START_GAME: { settings: GameSettings };
  RESTART_GAME: void;
  PAUSE_GAME: void;
  RESUME_GAME: void;
  ABANDON_GAME: void;
  TOUCH_STICK: { x: number; y: number };
  TOUCH_KEY: { code: string; pressed: boolean };
}

export interface EngineToUIEvents {
  LIFE_UPDATED: { remainingLifePoints: number };
  SCORE_UPDATED: { currentScore: number };
  TIME_UPDATED: { remainingSeconds: number };
  WAVE_UPDATED: { wave: number };
  GAME_OVER: { finalScore: number; reason: 'dead' | 'timeout'; durationSeconds?: number };
  GAME_PAUSED: { isPaused: boolean };
}
