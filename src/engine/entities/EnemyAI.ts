// src/engine/entities/EnemyAI.ts
import { ShipHandling } from './ShipController';
import { MOVEMENT_SPEEDS } from './MovementBalance';

/**
 * Parâmetros de comportamento dos inimigos. Compartilhado por todos (a GUI edita em tempo real).
 * Velocidades em px/frame (60 fps), distâncias em px de mundo, tempos em frames.
 */
export interface EnemyAIConfig {
  // --- Chaser (abalroamento) ---
  /** Multiplicador da velocidade do registry: < 1 deixa o player escapar acelerando. */
  chaserSpeedScale: number;
  /** Quanto o chaser antecipa a posição do player (0 = mira onde ele está). */
  chaserLeadFactor: number;

  // --- Shooter (artilharia) ---
  shooterSpeedScale: number;
  /** Faixa de distância que o shooter tenta manter do player. */
  shooterMinRange: number;
  shooterMaxRange: number;
  /** Peso da órbita (tangente) quando está dentro da faixa. */
  shooterOrbitWeight: number;
  /** Distância máxima de tiro. */
  shooterFireRange: number;
  /** Intervalo entre tiros (frames) + variação aleatória. */
  shooterFireCooldown: number;
  shooterFireCooldownJitter: number;
  /** Dispersão angular do tiro (radianos) para não ser 100% certeiro. */
  shooterAimSpread: number;
  /** Maximum bow-to-target angle that permits firing, in radians. */
  shooterFireHalfAngle: number;
  /** Velocidade do projétil inimigo (px/frame) — usada também na mira antecipada. */
  shooterProjectileSpeed: number;
  /** Alcance do projétil inimigo (px). */
  shooterProjectileRange: number;
  /** Atraso antes do primeiro tiro após ganhar linha de visão (frames). */
  shooterFirstShotDelay: number;

  // --- Direção (comum) ---
  /** Ângulo (rad) de erro de rumo que satura o leme. */
  steerSaturation: number;
  /** Raio em que inimigos se repelem. */
  separationRadius: number;
  separationWeight: number;
  /** Alcance das antenas de desvio de costa, em tiles (escala com a velocidade). */
  feelerTiles: number;
  avoidanceWeight: number;
}

export const ENEMY_AI: EnemyAIConfig = {
  chaserSpeedScale: 1,
  chaserLeadFactor: 0.35,

  shooterSpeedScale: 1,
  shooterMinRange: 190,
  shooterMaxRange: 320,
  shooterOrbitWeight: 0.9,
  shooterFireRange: 420,
  shooterFireCooldown: 95,
  shooterFireCooldownJitter: 35,
  shooterAimSpread: 0.06,
  shooterFireHalfAngle: Math.PI / 22.5,
  shooterProjectileSpeed: MOVEMENT_SPEEDS.enemyProjectile,
  shooterProjectileRange: 560,
  shooterFirstShotDelay: 45,

  steerSaturation: 0.55,
  separationRadius: 160,
  separationWeight: 2,
  feelerTiles: 2.5,
  avoidanceWeight: 2.2,
};

/** Dirigibilidade por arquétipo, derivada da velocidade do registry. */
export function chaserHandling(speed: number): Partial<ShipHandling> {
  return {
    maxForwardSpeed: speed * ENEMY_AI.chaserSpeedScale,
    maxReverseSpeed: 0.55,
    thrust: 0.045,
    brake: 0.08,
    waterDrag: 0.985,
    lateralGrip: 0.1,
    maxTurnRate: 0.045,
    turnAtRest: 0.65,
    turnResponse: 0.15,
    collisionFriction: 0.8,
    collisionBounce: 0.3,
  };
}

export function shooterHandling(speed: number): Partial<ShipHandling> {
  return {
    maxForwardSpeed: speed * ENEMY_AI.shooterSpeedScale,
    maxReverseSpeed: 0.4,
    thrust: 0.022,
    brake: 0.06,
    waterDrag: 0.98,
    lateralGrip: 0.07,
    maxTurnRate: 0.022,
    turnAtRest: 0.65,
    turnResponse: 0.1,
    collisionFriction: 0.85,
    collisionBounce: 0.25,
  };
}
