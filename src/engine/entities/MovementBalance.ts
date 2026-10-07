import type { EnemyVariation } from '../types/entityConfig';

/** Pixels per tick at 60 Hz. The player can outrun small boats once up to speed. */
export const MOVEMENT_SPEEDS = {
  player: 2.8,
  playerReverse: 0.95,
  playerProjectile: 8.5,
  enemyProjectile: 4.5,
};

export const ENEMY_SPEEDS: Record<EnemyVariation, number> = {
  chaser_1: 2.05,
  chaser_2: 1.85,
  shooter_1: 1.35,
  shooter_2: 1.25,
  shooter_3: 1.15,
  shooter_4: 1.05,
  shooter_5: 0.95,
};
