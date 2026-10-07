// src/engine/combat/CombatConfig.ts
import { MOVEMENT_SPEEDS } from '../entities/MovementBalance';

/**
 * Parâmetros do combate no mundo aberto. Mutável: a GUI edita em tempo real.
 * Tempos em frames (60 fps), distâncias em px de mundo.
 */
export interface CombatConfig {
  // --- Teste ---
  enemiesEnabled: boolean;
  /** Player recebe dano visual mas não perde vida. */
  godMode: boolean;

  // --- Director (spawn) ---
  maxShooters: number;
  maxChasers: number;
  /** Active simulation ticks per wave (60 ticks = one second). */
  waveDuration: number;
  initialShooters: number;
  initialChasers: number;
  /** Intervalo entre spawns + variação aleatória. */
  spawnInterval: number;
  spawnJitter: number;
  /** Atraso do primeiro spawn ao entrar na cena. */
  initialSpawnDelay: number;
  /** Distância além da borda da tela onde inimigos nascem (nunca aparecem do nada na tela). */
  spawnMargin: number;
  /** Profundidade extra aleatória do anel de spawn. */
  spawnDepth: number;
  /** Distância mínima entre um inimigo novo e os existentes. */
  minSpawnSpacing: number;
  /** Inimigos além de (meia-diagonal da tela × fator) são reciclados. */
  despawnDistanceScale: number;
  /** Shooters lançam chasers periodicamente (respeitando maxChasers). */
  shootersSpawnChasers: boolean;

  // --- Contato ---
  /** Impulso aplicado ao player no abalroamento de um chaser (px/frame). */
  ramKnockback: number;

  // --- Canhões do player ---
  playerProjectileSpeed: number;
  playerProjectileRange: number;
  frontCooldown: number;
  broadsideCooldown: number;
}

export const DEFAULT_COMBAT_CONFIG: CombatConfig = {
  enemiesEnabled: true,
  godMode: false,

  maxShooters: 3,
  maxChasers: 3,
  waveDuration: 30 * 60,
  initialShooters: 1,
  initialChasers: 1,
  spawnInterval: 140,
  spawnJitter: 60,
  initialSpawnDelay: 60,
  spawnMargin: 140,
  spawnDepth: 220,
  minSpawnSpacing: 220,
  despawnDistanceScale: 2.4,
  shootersSpawnChasers: true,

  ramKnockback: 2.5,

  playerProjectileSpeed: MOVEMENT_SPEEDS.playerProjectile,
  playerProjectileRange: 640,
  frontCooldown: 14,
  broadsideCooldown: 28,
};
