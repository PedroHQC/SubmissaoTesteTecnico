// src/engine/entities/Enemy.ts
import { Texture, Ticker } from 'pixi.js';
import { IPoolable } from '../pools/ObjectPool';
import { isCirclePathClear, SolidTileGrid } from '../tiles/TileCollision';
import { EnemyArchetype, EnemyConfig, EnemyRegistry, EnemyVariation } from '../types/entityConfig';
import { chaserHandling, ENEMY_AI, shooterHandling } from './EnemyAI';
import { Entity } from './Entity';
import { DEFAULT_SHIP_HANDLING, ShipController, ShipInput } from './ShipController';
import type { WorldRect } from '../world';

/** Terreno consultado pela IA (MapData ou ChunkedWorld). */
export interface EnemyTerrain extends SolidTileGrid {
  hasLineOfSight(x0: number, y0: number, x1: number, y1: number): boolean;
}

/** Navegação por flow field (FlowField ou WorldFlowField). (0, 0) = sem informação. */
export interface EnemyFlow {
  getDirection(x: number, y: number, out: { dirX: number; dirY: number }, radius?: number): void;
}

/** Dados extras opcionais: sem eles a IA funciona, só sem antecipação/separação. */
export interface EnemyContext {
  readonly playerVx: number;
  readonly playerVy: number;
  readonly neighbors: readonly Enemy[];
  readonly arenaBounds?: WorldRect | null;
}

export interface DamageResult {
  defeated: boolean;
  despawnImmediate: boolean;
}

const FLOW_DIR = { dirX: 0, dirY: 0 };
const LOS_CHECK_INTERVAL = 6; // frames entre checagens de linha de visão

/**
 * Inimigo com a mesma física de barco do player (ShipController).
 * A IA só produz input (acelerador + leme), então inimigos derivam, freiam e
 * fazem curva como o player.
 *
 * - Chaser: persegue com antecipação e abalroa.
 * - Shooter: mantém uma faixa de distância orbitando o player e atira com mira antecipada.
 */
export class Enemy extends Entity implements IPoolable {
  public currentHealth: number = 1;
  public maxHealth: number = 1;
  public speed: number = 2;
  public archetype: EnemyArchetype = 'chaser';
  public spawnGeneration = 0;
  public isEnteringArena = false;

  public readonly ship = new ShipController();

  // Controle do estado de morte
  public isDying: boolean = false;
  private deathTimer: number = 0;

  private currentTextures: readonly Texture[] = [];
  private shootTimer: number = 0;
  private spawnChaserTimer: number = 0;
  /** Lado da órbita do shooter (±1), sorteado no spawn. */
  private orbitSign = 1;
  /** Raia própria dentro da faixa do shooter (-1..1): espalha os shooters em distâncias diferentes. */
  private rangeLane = 0;
  private hasLineOfSight = false;
  private losTimer = 0;
  private avoidanceHeading: number | null = null;
  private avoidanceHold = 0;
  private shoreEscapeTime = 0;
  private shoreEscapeX = 0;
  private shoreEscapeY = 0;

  public onShoot: ((x: number, y: number, dirX: number, dirY: number) => void) | null = null;
  public onSpawnChaser: ((source: Enemy) => boolean) | null = null;
  public onDeathComplete: ((enemy: Enemy) => void) | null = null;

  constructor(
    private readonly registry: EnemyRegistry,
    fallbackTexture: Texture
  ) {
    super(fallbackTexture);
    this.despawn();
  }

  public get rotation(): number {
    return this.view.rotation;
  }

  public get hullRadius(): number {
    return Math.max(this.radius, this.sprite.width / 2, this.sprite.height / 2);
  }

  public get hullWidth(): number {
    return this.sprite.width;
  }

  public get hullLength(): number {
    return this.sprite.height;
  }

  /** Leave the carrier already moving, without an oversized launch impulse. */
  public launch(): void {
    const speed = this.ship.handling.maxForwardSpeed * 0.4;
    this.ship.vx = -Math.sin(this.rotation) * speed;
    this.ship.vy = Math.cos(this.rotation) * speed;
  }

  public set rotation(value: number) {
    this.view.rotation = value;
  }

  /** `heading` opcional (rad): por padrão o barco nasce com rumo aleatório. */
  public spawn(
    startX: number,
    startY: number,
    variation: EnemyVariation,
    heading = Math.random() * Math.PI * 2
  ): void {
    const config: EnemyConfig = this.registry[variation];
    this.spawnGeneration++;
    this.isEnteringArena = false;

    this.archetype = config.archetype;
    this.maxHealth = config.maxHealth;
    this.currentHealth = config.maxHealth;
    this.speed = config.speed;
    this.radius = config.radius;
    this.currentTextures = config.textures;

    const handling =
      config.archetype === 'chaser' ? chaserHandling(config.speed) : shooterHandling(config.speed);
    Object.assign(this.ship.handling, DEFAULT_SHIP_HANDLING, handling);
    this.ship.reset();

    this.x = startX;
    this.y = startY;
    this.rotation = heading;
    this.isActive = true;
    this.isDying = false;
    this.deathTimer = 0;

    this.view.alpha = 1;
    this.view.visible = true;

    this.orbitSign = Math.random() < 0.5 ? -1 : 1;
    this.rangeLane = Math.random() * 1.6 - 0.8;
    this.hasLineOfSight = false;
    this.avoidanceHeading = null;
    this.avoidanceHold = this.shoreEscapeTime = 0;
    this.losTimer = Math.floor(Math.random() * LOS_CHECK_INTERVAL);
    this.shootTimer = ENEMY_AI.shooterFirstShotDelay + Math.random() * 40;
    this.spawnChaserTimer = 150 + Math.random() * 100;

    this.updateSpriteState();
  }

  public despawn(): void {
    this.isEnteringArena = false;
    this.isActive = false;
    this.isDying = false;
    this.deathTimer = 0;
    this.view.visible = false;
    this.view.alpha = 1;
    this.currentHealth = 0;
    this.ship.reset();
  }

  public takeDamage(amount: number = 1): DamageResult {
    // Navios já em processo de afundamento não recebem mais dano
    if (this.isDying || !this.isActive) {
      return { defeated: false, despawnImmediate: false };
    }

    this.currentHealth = Math.max(0, this.currentHealth - amount);

    if (this.currentHealth > 0) {
      this.updateSpriteState();
      return { defeated: false, despawnImmediate: false };
    }

    // HP chegou a 0
    if (this.archetype === 'shooter') {
      this.isDying = true;
      this.deathTimer = 0;
      this.updateSpriteState(); // Muda para o 4º sprite (naufrágio)
      return { defeated: true, despawnImmediate: false };
    }

    // Chasers morrem imediatamente no impacto/tiro
    return { defeated: true, despawnImmediate: true };
  }

  /** Repassa ao controlador o quanto a costa empurrou o barco neste frame. */
  public applyCollisionPush(pushX: number, pushY: number): void {
    this.ship.applyCollision(pushX, pushY);
  }

  public applyShoreCollision(pushX: number, pushY: number): void {
    this.applyCollisionPush(pushX, pushY);
    const length = Math.hypot(pushX, pushY);
    if (length < 0.001) return;
    this.shoreEscapeX = pushX / length;
    this.shoreEscapeY = pushY / length;
    this.shoreEscapeTime = 100;
    this.avoidanceHold = 0;
  }

  public updateEnemy(
    ticker: Ticker,
    playerX: number,
    playerY: number,
    terrain: EnemyTerrain,
    flow: EnemyFlow,
    context?: EnemyContext
  ): void {
    if (!this.isActive) return;

    const dt = ticker.deltaTime;
    this.avoidanceHold = Math.max(0, this.avoidanceHold - dt);
    this.shoreEscapeTime = Math.max(0, this.shoreEscapeTime - dt);

    // --- SEQUÊNCIA DE MORTE DO SHOOTER ---
    if (this.isDying) {
      // Sem leme nem motor: o casco perde velocidade com o arrasto
      this.ship.step(this, { throttle: 0, steer: 0 }, dt);
      this.updateDeath(dt);
      return;
    }

    // Linha de visão é cara o bastante para não checar todo frame
    this.losTimer -= dt;
    if (this.losTimer <= 0) {
      this.hasLineOfSight = terrain.hasLineOfSight(this.x, this.y, playerX, playerY);
      this.losTimer = LOS_CHECK_INTERVAL;
    }

    const input = this.think(playerX, playerY, terrain, flow, context);
    this.ship.step(this, input, dt);
    this.updateHealthBar(this.currentHealth, this.maxHealth);

    if (this.archetype === 'shooter' && !this.isEnteringArena) {
      this.updateShooting(dt, playerX, playerY, context);

      this.spawnChaserTimer -= dt;
      if (this.spawnChaserTimer <= 0) {
        const launched = this.onSpawnChaser?.(this) ?? false;
        this.spawnChaserTimer = launched ? 220 + Math.random() * 120 : 45;
      }
    }
  }

  public override update(): void {}

  // ---------------------------------------------------------------------------
  // IA
  // ---------------------------------------------------------------------------

  /** Decide o rumo desejado e converte em input de barco. */
  private think(
    playerX: number,
    playerY: number,
    terrain: EnemyTerrain,
    flow: EnemyFlow,
    context?: EnemyContext
  ): ShipInput {
    const ai = ENEMY_AI;
    if (this.isEnteringArena && context?.arenaBounds) {
      // Enter fully before orbiting, firing or launching smaller boats.
      playerX = context.arenaBounds.x + context.arenaBounds.width / 2;
      playerY = context.arenaBounds.y + context.arenaBounds.height / 2;
    }
    const toX = playerX - this.x;
    const toY = playerY - this.y;
    const dist = Math.hypot(toX, toY) || 1;
    const towardX = toX / dist;
    const towardY = toY / dist;

    let desireX: number;
    let desireY: number;
    let throttle = 1;

    if (this.isEnteringArena) {
      desireX = towardX;
      desireY = towardY;
    } else if (this.archetype === 'chaser') {
      if (
        this.hasLineOfSight &&
        isCirclePathClear(terrain, this.x, this.y, playerX, playerY, this.hullRadius + 2)
      ) {
        // Interceptação: mira onde o player vai estar
        const t = (dist / Math.max(0.5, this.ship.handling.maxForwardSpeed)) * ai.chaserLeadFactor;
        const leadX = playerX + (context?.playerVx ?? 0) * Math.min(t, 90) - this.x;
        const leadY = playerY + (context?.playerVy ?? 0) * Math.min(t, 90) - this.y;
        const len = Math.hypot(leadX, leadY) || 1;
        const leadClear = isCirclePathClear(
          terrain,
          this.x,
          this.y,
          this.x + leadX,
          this.y + leadY,
          this.hullRadius + 2
        );
        desireX = leadClear ? leadX / len : towardX;
        desireY = leadClear ? leadY / len : towardY;
      } else {
        [desireX, desireY] = this.flowDirection(flow);
      }
    } else if (
      !this.hasLineOfSight ||
      !isCirclePathClear(terrain, this.x, this.y, playerX, playerY, this.hullRadius + 2)
    ) {
      [desireX, desireY] = this.flowDirection(flow);
    } else {
      // Shooter: mantém a faixa [min, max] orbitando (tangente) o player
      const tangentX = -towardY * this.orbitSign;
      const tangentY = towardX * this.orbitSign;

      if (dist <= ai.shooterFireRange && this.shootTimer <= ai.shooterFirstShotDelay) {
        // Turn the hull toward the intercept point before firing its bow cannon.
        const travel = dist / Math.max(0.5, ai.shooterProjectileSpeed);
        desireX = toX + (context?.playerVx ?? 0) * travel;
        desireY = toY + (context?.playerVy ?? 0) * travel;
        const aimLength = Math.hypot(desireX, desireY) || 1;
        desireX /= aimLength;
        desireY /= aimLength;
        throttle = dist > ai.shooterMaxRange ? 0.7 : 0;
      } else if (dist > ai.shooterMaxRange) {
        desireX = towardX + tangentX * 0.3;
        desireY = towardY + tangentY * 0.3;
      } else if (dist < ai.shooterMinRange) {
        desireX = -towardX + tangentX * 0.6;
        desireY = -towardY + tangentY * 0.6;
        throttle = 0.85;
      } else {
        // Dentro da faixa: órbita + correção suave para o centro da faixa
        const half = Math.max(1, (ai.shooterMaxRange - ai.shooterMinRange) / 2);
        const mid = ai.shooterMinRange + half + this.rangeLane * half * 0.7;
        const radial = (dist - mid) / half; // -1 perto .. 1 longe
        desireX = tangentX * ai.shooterOrbitWeight + towardX * radial;
        desireY = tangentY * ai.shooterOrbitWeight + towardY * radial;
        throttle = 0.65;
      }
    }

    // Separação: empurra para longe dos vizinhos (evita amontoar)
    if (context) {
      const sep = this.separation(context.neighbors);
      desireX += sep.x * ai.separationWeight;
      desireY += sep.y * ai.separationWeight;
    }

    // Shore escape takes priority over chasing and separation until the hull is clear.
    if (this.shoreEscapeTime > 0) {
      desireX = this.shoreEscapeX;
      desireY = this.shoreEscapeY;
    }

    const avoid = this.avoidance(terrain, desireX, desireY);
    const input = this.steerToward(avoid.x, avoid.y, throttle);
    // Coasting is not enough with ship inertia: brake before the shoreline.
    return avoid.brake && this.ship.forwardSpeed(this.rotation) > 0.08
      ? { throttle: -1, steer: input.steer }
      : input;
  }

  private flowDirection(flow: EnemyFlow): [number, number] {
    flow.getDirection(this.x, this.y, FLOW_DIR, this.hullRadius + 2);
    // Missing routes must not send the boat straight through the island toward the player.
    if (FLOW_DIR.dirX === 0 && FLOW_DIR.dirY === 0) {
      const heading = this.avoidanceHeading ?? this.rotation;
      return [-Math.sin(heading), Math.cos(heading)];
    }
    return [FLOW_DIR.dirX, FLOW_DIR.dirY];
  }

  private separation(neighbors: readonly Enemy[]): { x: number; y: number } {
    const radius = ENEMY_AI.separationRadius;
    let sx = 0;
    let sy = 0;

    for (const other of neighbors) {
      if (other === this || !other.isActive || other.isDying) continue;
      const dx = this.x - other.x;
      const dy = this.y - other.y;
      const d = Math.hypot(dx, dy);
      if (d <= 0.001 || d >= radius) continue;
      const push = 1 - d / radius;
      sx += (dx / d) * push;
      sy += (dy / d) * push;
    }

    return { x: sx, y: sy };
  }

  /** Choose a clear corridor for the entire hull and commit long enough to turn into it. */
  private avoidance(
    terrain: EnemyTerrain,
    desireX: number,
    desireY: number
  ): { x: number; y: number; brake: boolean } {
    const speed = Math.hypot(this.ship.vx, this.ship.vy);
    const stoppingDistance = (speed * speed) / (2 * this.ship.handling.brake);
    const reach = Math.max(terrain.tileSize * ENEMY_AI.feelerTiles, stoppingDistance + speed * 30);
    const radius = this.hullRadius + 2;
    const clearDistance = (angle: number): number => {
      const dx = -Math.sin(angle);
      const dy = Math.cos(angle);
      for (let step = 1; step <= 6; step++) {
        const distance = (reach * step) / 6;
        if (
          !isCirclePathClear(
            terrain,
            this.x,
            this.y,
            this.x + dx * distance,
            this.y + dy * distance,
            radius
          )
        ) {
          return (reach * (step - 1)) / 6;
        }
      }
      return reach;
    };
    const desired = Math.atan2(-desireX, desireY);
    const forwardClear = clearDistance(this.rotation);
    const desiredClear = clearDistance(desired);
    if (forwardClear === reach && desiredClear === reach && this.avoidanceHold <= 0) {
      this.avoidanceHeading = null;
      return { x: desireX, y: desireY, brake: false };
    }

    let heading = this.avoidanceHeading;
    if (heading === null || this.avoidanceHold <= 0 || clearDistance(heading) < reach * 0.75) {
      let bestScore = -Infinity;
      for (let i = 0; i < 24; i++) {
        const candidate = desired + (i * Math.PI) / 12;
        const distance = clearDistance(candidate);
        // A full safe corridor always outranks one ending at the coast.
        const score =
          (distance === reach ? 8 : 0) +
          (distance / reach) * 3 +
          Math.cos(candidate - desired) * 1.5 +
          (heading === null ? 0 : Math.cos(candidate - heading) * 0.6);
        if (score > bestScore) {
          bestScore = score;
          this.avoidanceHeading = candidate;
        }
      }
      heading = this.avoidanceHeading ?? desired;
      this.avoidanceHold = 45;
    }
    const turning = Math.abs(wrapAngle(heading - this.rotation)) > 0.5;
    return {
      x: -Math.sin(heading),
      y: Math.cos(heading),
      brake: turning || forwardClear < stoppingDistance + terrain.tileSize,
    };
  }

  /** Converte rumo desejado em leme/acelerador (mesma interface do teclado do player). */
  private steerToward(dirX: number, dirY: number, throttle: number): ShipInput {
    const len = Math.hypot(dirX, dirY);
    if (len < 1e-4) return { throttle: 0, steer: 0 };

    const targetRotation = Math.atan2(-dirX / len, dirY / len);
    const diff = wrapAngle(targetRotation - this.rotation);
    const reverse = this.ship.forwardSpeed(this.rotation) < -0.05 && !this.ship.isRecovering;
    const steer = Math.max(-1, Math.min(1, diff / ENEMY_AI.steerSaturation)) * (reverse ? -1 : 1);

    // Curva fechada: alivia o acelerador para virar no próprio eixo
    const alignment = Math.cos(diff);
    const throttleScale = alignment < 0.85 ? 0 : 0.45 + 0.55 * alignment;

    return { throttle: throttle * throttleScale, steer };
  }

  private updateShooting(
    dt: number,
    playerX: number,
    playerY: number,
    context?: EnemyContext
  ): void {
    const ai = ENEMY_AI;
    const dist = Math.hypot(playerX - this.x, playerY - this.y);

    if (!this.hasLineOfSight || dist > ai.shooterFireRange) {
      // Ao reencontrar o player, espera um pouco antes do primeiro tiro
      this.shootTimer = Math.max(this.shootTimer, ai.shooterFirstShotDelay);
      return;
    }

    this.shootTimer -= dt;
    if (this.shootTimer > 0) return;

    // Mira antecipada: onde o player estará quando a bala chegar
    const t = dist / Math.max(0.5, ai.shooterProjectileSpeed);
    const aimX = playerX + (context?.playerVx ?? 0) * t - this.x;
    const aimY = playerY + (context?.playerVy ?? 0) * t - this.y;
    const bowX = -Math.sin(this.rotation);
    const bowY = Math.cos(this.rotation);
    const facingThreshold = Math.cos(ai.shooterFireHalfAngle);
    const targetAlignment =
      (bowX * (playerX - this.x) + bowY * (playerY - this.y)) / Math.max(dist, 0.001);
    const aimAlignment = (bowX * aimX + bowY * aimY) / Math.max(Math.hypot(aimX, aimY), 0.001);
    if (targetAlignment < facingThreshold || aimAlignment < facingThreshold) return;

    const spread = (Math.random() * 2 - 1) * ai.shooterAimSpread;
    const angle = this.rotation + Math.PI / 2 + spread;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    const muzzle = this.hullRadius + 4;
    this.onShoot?.(this.x + bowX * muzzle, this.y + bowY * muzzle, dirX, dirY);
    this.shootTimer = ai.shooterFireCooldown + Math.random() * ai.shooterFireCooldownJitter;
  }

  private updateDeath(dt: number): void {
    this.deathTimer += dt;

    // 60 ticks ≈ 1 segundo a 60 FPS
    const STILL_TIME = 120; // 2 segundos à deriva
    const BLINK_TIME = 60; // 1 segundo piscando
    const TOTAL_TIME = STILL_TIME + BLINK_TIME;

    if (this.deathTimer > STILL_TIME) {
      const blinkCycle = Math.floor(this.deathTimer / 6);
      this.view.alpha = blinkCycle % 2 === 0 ? 1 : 0.2;
    }

    if (this.deathTimer >= TOTAL_TIME) {
      // Let the pool release the active ship first, so its slot and wake can be reused.
      if (this.onDeathComplete) this.onDeathComplete(this);
      else this.despawn();
    }
  }

  private updateSpriteState(): void {
    this.updateHealthBar(this.currentHealth, this.maxHealth);
    if (this.archetype === 'shooter') {
      // HP 3 -> textures[3] (100%) ... HP 0 -> textures[0] (naufrágio)
      const texture = this.currentTextures[this.currentHealth];
      if (texture) this.sprite.texture = texture;
    } else {
      // Chaser (3 sprites normais de 1 a 3 HP)
      const texture = this.currentTextures[Math.max(0, this.currentHealth - 1)];
      if (texture) this.sprite.texture = texture;
    }
  }
}

function wrapAngle(angle: number): number {
  let a = angle % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}
