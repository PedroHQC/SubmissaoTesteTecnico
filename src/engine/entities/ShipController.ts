// src/engine/entities/ShipController.ts
import { MOVEMENT_SPEEDS } from './MovementBalance';

/**
 * Parâmetros de dirigibilidade do barco.
 * Unidades por frame a 60 fps (o passo é escalado por `dt` do Ticker).
 */
export interface ShipHandling {
  // --- Propulsão ---
  /** Velocidade máxima para frente (px/frame). */
  maxForwardSpeed: number;
  /** Velocidade máxima de ré (px/frame). */
  maxReverseSpeed: number;
  /** Aceleração para frente com W. */
  thrust: number;
  /** Desaceleração ao segurar S andando para frente (freio). */
  brake: number;
  /** Aceleração de ré com S quando já parado. */
  reverseThrust: number;
  /** Retenção de velocidade por frame sem aceleração (1 = desliza para sempre). */
  waterDrag: number;

  // --- Deriva ---
  /** Quanto da velocidade lateral é removida por frame (0 = desliza de lado, 1 = trilho). */
  lateralGrip: number;

  // --- Leme ---
  /** Velocidade angular máxima (rad/frame) em velocidade de cruzeiro. */
  maxTurnRate: number;
  /** Fração da curva disponível parado (barcos viram pouco sem andar). */
  turnAtRest: number;
  /** Rapidez com que o leme atinge a curva desejada (0..1 por frame). */
  turnResponse: number;

  // --- Colisão ---
  /** Velocidade mantida ao bater na costa (0 = para, 1 = desliza sem perder nada). */
  collisionFriction: number;
  /** Ricochete na direção da costa (0 = nenhum). */
  collisionBounce: number;
}

export const DEFAULT_SHIP_HANDLING: ShipHandling = {
  maxForwardSpeed: MOVEMENT_SPEEDS.player,
  maxReverseSpeed: MOVEMENT_SPEEDS.playerReverse,
  thrust: 0.045,
  brake: 0.12,
  reverseThrust: 0.03,
  waterDrag: 0.985,

  lateralGrip: 0.08,

  maxTurnRate: 0.04,
  turnAtRest: 0.3,
  turnResponse: 0.12,

  collisionFriction: 0.85,
  collisionBounce: 0.65,
};

export interface ShipInput {
  /** -1 (ré/freio) .. 1 (frente). */
  readonly throttle: number;
  /** -1 (bombordo/esquerda) .. 1 (estibordo/direita). */
  readonly steer: number;
}

/** O que o controlador move: posição e rotação do barco. */
export interface ShipBody {
  x: number;
  y: number;
  rotation: number;
}

/**
 * Física de barco top-down:
 * - velocidade vetorial com inércia e arrasto da água;
 * - deriva: só parte da velocidade lateral é removida a cada frame;
 * - leme suave com inércia angular, mais efetivo em movimento;
 * - resposta de colisão que desliza ao longo da costa em vez de travar.
 *
 * Convenção do sprite: rotation 0 = proa para +Y (frente = (-sin r, cos r)).
 */
export class ShipController {
  public readonly handling: ShipHandling;

  public vx = 0;
  public vy = 0;
  public angularVelocity = 0;
  private collisionRecovery = 0;

  public get isRecovering(): boolean {
    return this.collisionRecovery > 0;
  }

  constructor(handling: Partial<ShipHandling> = {}) {
    this.handling = { ...DEFAULT_SHIP_HANDLING, ...handling };
  }

  /** Velocidade ao longo da proa (negativa = ré). */
  public forwardSpeed(rotation: number): number {
    return this.vx * -Math.sin(rotation) + this.vy * Math.cos(rotation);
  }

  public step(body: ShipBody, input: ShipInput, dt: number): void {
    // Let the impact carry the hull away before the engine pushes into land again.
    if (this.collisionRecovery > 0) {
      this.collisionRecovery = Math.max(0, this.collisionRecovery - dt);
      const drag = Math.pow(0.97, dt);
      this.vx *= drag;
      this.vy *= drag;
      body.rotation += input.steer * this.handling.maxTurnRate * dt;
      body.x += this.vx * dt;
      body.y += this.vy * dt;
      return;
    }
    const h = this.handling;
    const fwdX = -Math.sin(body.rotation);
    const fwdY = Math.cos(body.rotation);
    const sideX = -fwdY;
    const sideY = fwdX;

    // Decompõe a velocidade no referencial do barco
    let forward = this.vx * fwdX + this.vy * fwdY;
    let lateral = this.vx * sideX + this.vy * sideY;

    // --- Propulsão ---
    if (input.throttle > 0) {
      forward += h.thrust * input.throttle * dt;
    } else if (input.throttle < 0) {
      forward += (forward > 0.05 ? h.brake : h.reverseThrust) * input.throttle * dt;
    } else {
      forward *= Math.pow(h.waterDrag, dt);
    }
    forward = clamp(forward, -h.maxReverseSpeed, h.maxForwardSpeed);

    // --- Deriva: remove parte da velocidade lateral ---
    lateral *= Math.pow(1 - h.lateralGrip, dt);

    this.vx = fwdX * forward + sideX * lateral;
    this.vy = fwdY * forward + sideY * lateral;

    // --- Leme: curva escala com a velocidade; em ré o leme inverte ---
    const speedRatio = Math.min(1, Math.abs(forward) / h.maxForwardSpeed);
    const authority = h.turnAtRest + (1 - h.turnAtRest) * speedRatio;
    const direction = forward < -0.05 ? -1 : 1;
    const targetTurn = input.steer * h.maxTurnRate * authority * direction;
    this.angularVelocity +=
      (targetTurn - this.angularVelocity) * (1 - Math.pow(1 - h.turnResponse, dt));

    body.rotation += this.angularVelocity * dt;
    body.x += this.vx * dt;
    body.y += this.vy * dt;
  }

  /**
   * Resposta de colisão a partir do quanto a costa empurrou o barco neste frame.
   * Remove a velocidade contra a costa (com ricochete) e aplica atrito tangencial.
   */
  public applyCollision(pushX: number, pushY: number): number {
    const len = Math.hypot(pushX, pushY);
    if (len < 1e-4) return 0;

    const nx = pushX / len;
    const ny = pushY / len;
    const into = this.vx * nx + this.vy * ny;
    if (into >= 0) return 0;

    const h = this.handling;
    const rebound = Math.max(1.2, -into * h.collisionBounce);
    this.vx = (this.vx - nx * into) * h.collisionFriction + nx * rebound;
    this.vy = (this.vy - ny * into) * h.collisionFriction + ny * rebound;
    this.collisionRecovery = 16;
    return -into;
  }

  public reset(): void {
    this.vx = 0;
    this.vy = 0;
    this.angularVelocity = 0;
    this.collisionRecovery = 0;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
