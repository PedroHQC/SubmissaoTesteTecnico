// src/engine/combat/CombatSystem.ts
import { Container, Ticker } from 'pixi.js';
import { Enemy, EnemyContext } from '../entities/Enemy';
import { ENEMY_AI } from '../entities/EnemyAI';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { ObjectPool } from '../pools/ObjectPool';
import { GameAssets } from '../scenes/GameScene';
import { isCircleCollidingTiles } from '../tiles/TileCollision';
import { EnemyVariation } from '../types/entityConfig';
import { ChunkedWorld, WorldRect } from '../world';
import { WorldFlowField } from '../world/WorldFlowField';
import { CombatConfig, DEFAULT_COMBAT_CONFIG } from './CombatConfig';
import { ShipCannons } from './ShipCannons';
import { findChaserLaunch } from './ChaserLaunch';
import { audio } from '../services/audioManager';
import { ExplosionParticles } from '../rendering/ExplosionParticles';
import { DAMAGE_RULES } from '../../config/gameplay';

const SHOOTER_TYPES: readonly EnemyVariation[] = [
  'shooter_1',
  'shooter_2',
  'shooter_3',
  'shooter_4',
  'shooter_5',
];
const CHASER_TYPES: readonly EnemyVariation[] = ['chaser_1', 'chaser_2'];
const SPAWN_ATTEMPTS = 14;

export interface CombatStats {
  readonly shooters: number;
  readonly chasers: number;
  readonly enemyShots: number;
  readonly playerShots: number;
  readonly playerHits: number;
}

/**
 * Combate no mundo aberto: director de spawn, IA dos inimigos, projéteis e colisões.
 *
 * - Spawn sempre fora da tela, em água livre e longe dos outros inimigos;
 *   limites separados para shooters e chasers.
 * - Inimigos longe demais são reciclados (pool), então o custo fica constante.
 * - Navegação: WorldFlowField em volta do player + linha de visão nos chunks.
 */
export class CombatSystem {
  public readonly view = new Container();
  public readonly config: CombatConfig;
  public onImpact: ((x: number, y: number, strength: number) => void) | null = null;
  public onEnemyDefeated: (() => void) | null = null;
  public readonly explosions: ExplosionParticles;

  private readonly enemyLayer = new Container();
  private readonly projectileLayer = new Container();

  private readonly flow: WorldFlowField;
  private readonly cannons = new ShipCannons();
  private readonly enemies: ObjectPool<Enemy>;
  private readonly enemyShots: ObjectPool<Projectile>;
  private readonly playerShots: ObjectPool<Projectile>;

  private spawnTimer: number;
  private playerHits = 0;
  private shooterCount = 0;
  private chaserCount = 0;
  private waveElapsed = 0;

  public get wave() {
    const index = Math.floor(this.waveElapsed / Math.max(1, this.config.waveDuration));
    return {
      number: index + 1,
      shooters: Math.min(this.config.maxShooters, this.config.initialShooters + index),
      chasers: Math.min(this.config.maxChasers, this.config.initialChasers + index),
    };
  }

  constructor(
    private readonly assets: GameAssets,
    private readonly world: ChunkedWorld,
    private readonly player: Player,
    config: Partial<CombatConfig> = {}
  ) {
    this.config = { ...DEFAULT_COMBAT_CONFIG, ...config };
    this.explosions = new ExplosionParticles(assets.splashTexture);
    this.spawnTimer = this.config.initialSpawnDelay;
    const largestHull = Math.max(
      ...Object.values(assets.enemyRegistry).flatMap((entry) =>
        entry.textures.map((texture) =>
          Math.max(entry.radius, texture.width / 2, texture.height / 2)
        )
      )
    );
    this.flow = new WorldFlowField(world, 72, 14, largestHull + 12);

    this.view.addChild(this.enemyLayer, this.projectileLayer, this.explosions.view);

    this.enemies = new ObjectPool<Enemy>(() => {
      const enemy = new Enemy(assets.enemyRegistry, assets.projectileTexture);
      enemy.onShoot = (x, y, dirX, dirY) => this.fireEnemyShot(x, y, dirX, dirY);
      enemy.onSpawnChaser = (source) => this.spawnChaserFrom(source);
      enemy.onDeathComplete = (dead) => this.enemies.release(dead);
      this.enemyLayer.addChild(enemy.view);
      return enemy;
    }, 12);

    this.enemyShots = new ObjectPool<Projectile>(() => {
      const p = new Projectile(assets.projectileTexture);
      this.projectileLayer.addChild(p.view);
      return p;
    }, 40);

    this.playerShots = new ObjectPool<Projectile>(() => {
      const p = new Projectile(assets.projectileTexture);
      this.projectileLayer.addChild(p.view);
      return p;
    }, 60);
  }

  public get stats(): CombatStats {
    let enemyShots = 0;
    let playerShots = 0;
    this.enemyShots.forEachActive(() => enemyShots++);
    this.playerShots.forEachActive(() => playerShots++);
    return {
      shooters: this.shooterCount,
      chasers: this.chaserCount,
      enemyShots,
      playerShots,
      playerHits: this.playerHits,
    };
  }

  /** Renderers observe pooled ships without owning their simulation or lifetime. */
  public get ships(): readonly Enemy[] {
    return this.enemies.rawPool;
  }

  public get testState() {
    return {
      wave: this.wave,
      enemyStates: this.enemies.rawPool
        .filter((enemy) => enemy.isActive && !enemy.isDying)
        .map((enemy) => ({
          x: enemy.x,
          y: enemy.y,
          archetype: enemy.archetype,
          hp: enemy.currentHealth,
        })),
      projectiles: this.playerShots.rawPool
        .filter((shot) => shot.isActive)
        .map((shot) => ({ x: shot.x, y: shot.y, dx: shot.directionX, dy: shot.directionY })),
    };
  }

  public prepareTestEncounter(archetype: 'chaser' | 'shooter'): void {
    if (import.meta.env.MODE !== 'test') return;
    this.reset();
    this.spawnTimer = Infinity;
    this.player.reset(this.world.spawnPoint.x, this.world.spawnPoint.y);
    const enemy = this.enemies.get();
    enemy.spawn(
      this.player.x,
      this.player.y + 180,
      archetype === 'chaser' ? 'chaser_1' : 'shooter_1',
      Math.PI
    );
    this.countEnemies();
  }

  public update(ticker: Ticker, keys: Record<string, boolean>, viewRect: WorldRect): void {
    const dt = ticker.deltaTime;
    this.player.godMode = this.config.godMode;

    this.cannons.update(dt, keys, this.player, this.config, (x, y, vx, vy) =>
      this.firePlayerShot(x, y, vx, vy)
    );

    this.countEnemies();

    if (this.config.enemiesEnabled) {
      this.flow.update(this.player.x, this.player.y);
      this.updateDirector(dt, viewRect);
      this.updateEnemies(ticker);
    } else if (this.shooterCount + this.chaserCount > 0) {
      this.enemies.releaseAll();
    }

    this.updateProjectiles(dt);
    this.resolveHits();
    this.clampShipsToArena();
  }

  public destroy(): void {
    this.enemies.releaseAll();
    this.enemyShots.releaseAll();
    this.playerShots.releaseAll();
    this.view.destroy({ children: true });
  }

  public reset(): void {
    this.enemies.releaseAll();
    this.enemyShots.releaseAll();
    this.playerShots.releaseAll();
    this.cannons.reset();
    this.explosions.clear();
    this.playerHits = this.shooterCount = this.chaserCount = 0;
    this.waveElapsed = 0;
    this.spawnTimer = this.config.initialSpawnDelay;
  }

  // ---------------------------------------------------------------------------
  // Director
  // ---------------------------------------------------------------------------

  private countEnemies(): void {
    let shooters = 0;
    let chasers = 0;
    this.enemies.forEachActive((enemy) => {
      if (enemy.archetype === 'shooter') shooters++;
      else chasers++;
    });
    this.shooterCount = shooters;
    this.chaserCount = chasers;
  }

  private updateDirector(dt: number, view: WorldRect): void {
    this.waveElapsed += dt;
    const halfDiagonal = Math.hypot(view.width, view.height) / 2;

    // Recicla quem ficou longe demais (o player os deixou para trás)
    const despawnDistance = halfDiagonal * this.config.despawnDistanceScale;
    this.enemies.forEachActive((enemy) => {
      if (
        !this.world.arenaBounds &&
        Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) > despawnDistance
      ) {
        this.enemies.release(enemy);
      }
    });

    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = this.config.spawnInterval + Math.random() * this.config.spawnJitter;

    // Waves introduce carriers only. Chasers must launch from a living carrier.
    if (this.shooterCount >= this.wave.shooters) return;
    const variation = SHOOTER_TYPES[Math.floor(Math.random() * SHOOTER_TYPES.length)];

    this.spawnOffscreen(variation, view);
  }

  /** Procura um ponto no anel fora da tela, em água livre e afastado dos outros inimigos. */
  private spawnOffscreen(variation: EnemyVariation, view: WorldRect): void {
    const c = this.config;
    const config = this.assets.enemyRegistry[variation];
    const hullRadius = Math.max(
      config.radius,
      ...config.textures.map((texture) => Math.hypot(texture.width, texture.height) / 2)
    );
    const clearance = hullRadius + this.world.tileSize;
    const centerX = view.x + view.width / 2;
    const centerY = view.y + view.height / 2;
    const margin = hullRadius + Math.max(0, c.spawnMargin);

    for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      // Intersect an expanded viewport: the entire hull starts beyond an edge.
      const edgeDistance = Math.min(
        (view.width / 2 + margin) / Math.abs(dx),
        (view.height / 2 + margin) / Math.abs(dy)
      );
      const distance = edgeDistance + Math.random() * Math.max(0, c.spawnDepth);
      const x = centerX + dx * distance;
      const y = centerY + dy * distance;
      if (Math.hypot(x - this.player.x, y - this.player.y) < 260) continue;

      if (isCircleCollidingTiles(this.world, x, y, clearance)) continue;
      if (this.isCrowded(x, y, c.minSpawnSpacing)) continue;

      const enemy = this.enemies.get();
      // Nasce já apontando para o player
      const heading = Math.atan2(-(this.player.x - x), this.player.y - y);
      enemy.spawn(x, y, variation, heading);
      enemy.isEnteringArena = this.world.arenaBounds !== null;
      this.countEnemies();
      return;
    }
  }

  private spawnChaserFrom(source: Enemy): boolean {
    if (!this.config.enemiesEnabled || !this.config.shootersSpawnChasers) return false;
    if (!source.isActive || source.isDying || source.archetype !== 'shooter') return false;
    this.countEnemies();
    if (this.chaserCount >= this.wave.chasers) return false;
    const variation = CHASER_TYPES[Math.floor(Math.random() * CHASER_TYPES.length)];
    const config = this.assets.enemyRegistry[variation];
    const texture = config.textures[config.textures.length - 1];
    const hullRadius = Math.max(config.radius, texture.width / 2, texture.height / 2);
    const launch = findChaserLaunch(
      source,
      hullRadius,
      this.world,
      this.enemies.rawPool.filter((enemy) => enemy.isActive),
      this.player
    );
    if (!launch) return false;

    const enemy = this.enemies.get();
    enemy.spawn(launch.x, launch.y, variation, launch.heading);
    enemy.launch();
    this.chaserCount++;
    return true;
  }

  private isCrowded(x: number, y: number, spacing: number): boolean {
    let crowded = false;
    this.enemies.forEachActive((enemy) => {
      if (!crowded && Math.hypot(enemy.x - x, enemy.y - y) < spacing) crowded = true;
    });
    return crowded;
  }

  // ---------------------------------------------------------------------------
  // Inimigos
  // ---------------------------------------------------------------------------

  private updateEnemies(ticker: Ticker): void {
    const context: EnemyContext = {
      playerVx: this.player.ship.vx,
      playerVy: this.player.ship.vy,
      neighbors: this.enemies.rawPool,
      arenaBounds: this.world.arenaBounds,
    };

    // Snapshot: a launched boat starts its first physics step on the next frame,
    // independent of which slot the pool happened to reuse.
    const activeEnemies = this.enemies.rawPool.filter((enemy) => enemy.isActive);
    for (const enemy of activeEnemies) {
      enemy.updateEnemy(ticker, this.player.x, this.player.y, this.world, this.flow, context);
      if (enemy.isDying) continue;

      const beforeX = enemy.x;
      const beforeY = enemy.y;
      if (this.resolveEnemyShore(enemy)) {
        if (enemy.archetype === 'chaser') this.explodeChaser(enemy);
        else enemy.applyShoreCollision(enemy.x - beforeX, enemy.y - beforeY);
      }
    }

    this.separateEnemies();
    // Separation must not leave a hull embedded in the shore.
    this.enemies.forEachActive((enemy) => {
      if (enemy.isDying) return;
      const x = enemy.x;
      const y = enemy.y;
      if (this.resolveEnemyShore(enemy)) {
        if (enemy.archetype === 'chaser') this.explodeChaser(enemy);
        else enemy.applyShoreCollision(enemy.x - x, enemy.y - y);
      }
    });
  }

  private resolveEnemyShore(enemy: Enemy): boolean {
    const hull = { x: enemy.x, y: enemy.y, radius: enemy.hullRadius + 3 };
    const collided = this.world.resolveCircleCollision(hull);
    enemy.x = hull.x;
    enemy.y = hull.y;
    return collided;
  }

  private clampShipsToArena(): void {
    const bounds = this.world.arenaBounds;
    if (!bounds) return;
    this.enemies.forEachActive((enemy) => {
      const cos = Math.abs(Math.cos(enemy.rotation));
      const sin = Math.abs(Math.sin(enemy.rotation));
      const halfWidth = (enemy.hullWidth * cos + enemy.hullLength * sin) / 2;
      const halfHeight = (enemy.hullWidth * sin + enemy.hullLength * cos) / 2;
      const x = enemy.x;
      const y = enemy.y;
      if (enemy.isEnteringArena) {
        // Let arrivals sail through the edge before enforcing arena boundaries.
        if (
          x - halfWidth < bounds.x ||
          x + halfWidth > bounds.x + bounds.width ||
          y - halfHeight < bounds.y ||
          y + halfHeight > bounds.y + bounds.height
        )
          return;
        enemy.isEnteringArena = false;
      }
      enemy.x = Math.max(bounds.x + halfWidth, Math.min(bounds.x + bounds.width - halfWidth, x));
      enemy.y = Math.max(bounds.y + halfHeight, Math.min(bounds.y + bounds.height - halfHeight, y));
      if (enemy.x !== x || enemy.y !== y) enemy.applyCollisionPush(enemy.x - x, enemy.y - y);
    });
  }

  /** Separação rígida: nenhum par de inimigos se sobrepõe (complementa a separação da IA). */
  private separateEnemies(): void {
    const list = this.enemies.rawPool;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.isActive || a.isDying) continue;

      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.isActive || b.isDying) continue;

        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const minDist = a.radius + b.radius + 4;
        const distSq = dx * dx + dy * dy;
        if (distSq >= minDist * minDist) continue;

        const contactDistance = a.radius + b.radius;
        if (
          distSq < contactDistance * contactDistance &&
          (a.archetype === 'chaser' || b.archetype === 'chaser')
        ) {
          if (b.archetype === 'chaser') this.explodeChaser(b);
          if (a.archetype === 'chaser') {
            this.explodeChaser(a);
            break;
          }
          continue;
        }

        const dist = Math.sqrt(distSq) || 0.001;
        const push = (minDist - dist) * 0.5;
        const nx = dist > 0.001 ? dx / dist : 1;
        const ny = dist > 0.001 ? dy / dist : 0;
        a.x += nx * push;
        a.y += ny * push;
        b.x -= nx * push;
        b.y -= ny * push;
        a.applyCollisionPush(nx * push, ny * push);
        b.applyCollisionPush(-nx * push, -ny * push);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Projéteis e colisões
  // ---------------------------------------------------------------------------

  private fireEnemyShot(x: number, y: number, dirX: number, dirY: number): void {
    if (this.isAudible(x, y)) audio.playCannonFire();
    const shot = this.enemyShots.get();
    shot.speed = ENEMY_AI.shooterProjectileSpeed;
    shot.maxDistance = ENEMY_AI.shooterProjectileRange;
    shot.spawn(x, y, dirX, dirY);
  }

  private firePlayerShot(x: number, y: number, vx: number, vy: number): void {
    const speed = Math.hypot(vx, vy) || 1;
    const shot = this.playerShots.get();
    shot.speed = speed;
    shot.maxDistance = this.config.playerProjectileRange;
    shot.spawn(x, y, vx / speed, vy / speed);
  }

  private updateProjectiles(dt: number): void {
    const step = (pool: ObjectPool<Projectile>) => {
      pool.forEachActive((shot) => {
        const arena = this.world.arenaBounds;
        const alive = shot.updateWorld(dt);
        if (
          arena &&
          (shot.x < arena.x ||
            shot.y < arena.y ||
            shot.x > arena.x + arena.width ||
            shot.y > arena.y + arena.height)
        ) {
          pool.release(shot);
          return;
        }
        const hitLand = isCircleCollidingTiles(this.world, shot.x, shot.y, shot.radius);
        if (hitLand) {
          this.onImpact?.(shot.x, shot.y, 2);
          this.explosions.burst(shot.x, shot.y, 'hit');
        } else if (!alive) this.explosions.burst(shot.x, shot.y, 'water');
        if ((!alive || hitLand) && this.isAudible(shot.x, shot.y)) audio.playWaterHit();
        if (!alive || hitLand) {
          pool.release(shot);
        }
      });
    };
    step(this.enemyShots);
    step(this.playerShots);
  }

  private resolveHits(): void {
    const player = this.player;

    // Tiros inimigos → player
    this.enemyShots.forEachActive((shot) => {
      if (player.hp <= 0) return;
      if (Math.hypot(shot.x - player.x, shot.y - player.y) < shot.radius + player.radius) {
        this.explosions.burst(shot.x, shot.y, 'hit');
        this.enemyShots.release(shot);
        this.damagePlayer(DAMAGE_RULES.enemyProjectileDamage);
        audio.playWoodHit();
        this.onImpact?.(player.x, player.y, 7);
        this.playerHits++;
      }
    });

    this.enemies.forEachActive((enemy) => {
      if (enemy.isDying || player.hp <= 0) return;

      // Contato inimigo ↔ player
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.hypot(dx, dy);
      const minDist = enemy.radius + player.radius;

      if (dist < minDist) {
        const nx = dist > 0.001 ? dx / dist : 1;
        const ny = dist > 0.001 ? dy / dist : 0;

        if (enemy.archetype === 'chaser') {
          // Abalroamento: chaser explode, player leva dano e é empurrado
          this.explodeChaser(enemy);
          this.damagePlayer(DAMAGE_RULES.chaserImpactDamage);
          this.onImpact?.(player.x, player.y, 10);
          this.playerHits++;
          player.ship.vx += nx * this.config.ramKnockback;
          player.ship.vy += ny * this.config.ramKnockback;
          return;
        }

        // Shooter: só se empurram
        const push = (minDist - dist) * 0.5;
        player.x += nx * push;
        player.y += ny * push;
        enemy.x -= nx * push;
        enemy.y -= ny * push;
        const impact = player.applyCollisionPush(nx * push, ny * push);
        if (impact > 0.15) {
          this.onImpact?.(player.x, player.y, 3 + impact);
          audio.playSFX('ship_collision');
        }
        enemy.applyCollisionPush(-nx * push, -ny * push);
      }

      // Tiros do player → inimigo
      this.playerShots.forEachActive((shot) => {
        if (!enemy.isActive || enemy.isDying) return;
        if (Math.hypot(shot.x - enemy.x, shot.y - enemy.y) >= shot.radius + enemy.radius) return;

        this.explosions.burst(shot.x, shot.y, 'hit');
        this.playerShots.release(shot);
        const result = enemy.takeDamage(DAMAGE_RULES.playerProjectileDamage);
        if (result.defeated) {
          this.explosions.burst(enemy.x, enemy.y, 'ship');
          this.onEnemyDefeated?.();
        }
        if (this.isAudible(enemy.x, enemy.y)) {
          audio.playWoodHit();
          if (result.defeated) audio.playSFX('ship_sinking');
        }
        this.onImpact?.(enemy.x, enemy.y, result.defeated ? 6 : 3);
        if (result.defeated && result.despawnImmediate) {
          this.enemies.release(enemy);
        }
      });
    });
  }

  private isAudible(x: number, y: number): boolean {
    return Math.hypot(x - this.player.x, y - this.player.y) < 700;
  }

  private explodeChaser(enemy: Enemy): void {
    this.explosions.burst(enemy.x, enemy.y, 'ship');
    this.onImpact?.(enemy.x, enemy.y, 3);
    if (this.isAudible(enemy.x, enemy.y)) audio.playExplosion();
    enemy.takeDamage(enemy.currentHealth);
    this.enemies.release(enemy);
  }

  private damagePlayer(amount: number): void {
    if (this.player.takeDamage(amount)) {
      this.explosions.burst(this.player.x, this.player.y, 'ship');
      this.player.view.visible = false;
      audio.playExplosion();
    }
  }
}
