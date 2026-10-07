/** Central entry point for all balance settings. Speeds use pixels / fixed 60 Hz tick. */
export { DEFAULT_COMBAT_CONFIG } from '../engine/combat/CombatConfig';
export { ENEMY_AI } from '../engine/entities/EnemyAI';
export { MOVEMENT_SPEEDS, ENEMY_SPEEDS } from '../engine/entities/MovementBalance';
export { DEFAULT_SHIP_HANDLING } from '../engine/entities/ShipController';
export { DEFAULT_WORLD_CONFIG } from '../engine/world/WorldConfig';
export { SETTINGS_LIMITS } from '../services/gameSettings';

export const DAMAGE_RULES = {
  playerHealth: 4,
  enemyHealth: 3,
  playerProjectileDamage: 1,
  enemyProjectileDamage: 1,
  chaserImpactDamage: 1,
  projectileRadius: 6,
} as const;
