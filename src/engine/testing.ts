export interface GameTestState {
  running: boolean;
  time: number;
  player: { x: number; y: number; rotation: number; vx: number; vy: number; hp: number };
  enemies: number;
  shots: number;
  stick: { x: number; y: number };
  touchKeys: Record<string, boolean>;
  score: number;
  mode: string;
  wave: { number: number; shooters: number; chasers: number };
  camera: { x: number; y: number; zoom: number };
  onLand: boolean;
  enemyStates: Array<{ x: number; y: number; archetype: string; hp: number }>;
  projectiles: Array<{ x: number; y: number; dx: number; dy: number }>;
}
export interface GameTestHooks {
  getState(): GameTestState;
  finishMatch(score: number): void;
  setPlayerHp(hp: number): void;
  setManualClock(enabled: boolean): void;
  advance(seconds: number): void;
  encounter(type: 'chaser' | 'shooter'): void;
  setInvulnerable(enabled: boolean): void;
}
declare global {
  interface Window {
    __PIXI_TEST_HOOKS__?: GameTestHooks;
  }
}
