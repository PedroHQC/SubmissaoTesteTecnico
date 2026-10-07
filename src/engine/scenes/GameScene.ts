// src/engine/scenes/GameScene.ts
import { Container, Texture, Ticker } from 'pixi.js';
import { GameBridge } from '../../bridge/GameBridge';
import { IScene } from '../core/IScene';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { ObjectPool } from '../pools/ObjectPool';
import { MapData } from '../tiles/MapData';
import { IslandOuterTextures, IslandTileTextures, TileRegistry } from '../tiles/TileRegistry';
import { TilemapLayer } from '../tiles/TilemapLayer';
import { TileType } from '../tiles/TileTypes';
import { EnemyRegistry, EnemyVariation, Textures4Hp } from '../types/entityConfig';
import { IslandGenerator } from '../tiles/IslandGenerator';
import { FlowField } from '../navigation/FlowField';
import { GameSettings } from '../../services/gameSettings';
import { audio } from '../services/audioManager';
import { attachWaterDebugGui, WaterLayer } from '../rendering/water';
import { CameraShake } from '../rendering/CameraShake';
import { findChaserLaunch } from '../combat/ChaserLaunch';
import { MOVEMENT_SPEEDS } from '../entities/MovementBalance';

export interface GameAssets {
  readonly playerTextures: Textures4Hp;
  readonly projectileTexture: Texture;
  readonly splashTexture: Texture;
  readonly enemyRegistry: EnemyRegistry;
  readonly waterTileTexture: Texture;
  readonly islandTextures: IslandTileTextures;
  readonly islandOuterTextures: IslandOuterTextures;
}

export class GameScene implements IScene {
  public readonly view: Container;

  // Camadas de Renderização
  private readonly backgroundLayer: Container;
  private readonly gameLayer: Container;

  // Sistema de Tiles
  private tilemapLayer: TilemapLayer | null = null;
  private mapData: MapData | null = null;
  private readonly tileSize: number = 32;
  private flowField: FlowField | null = null;
  private readonly waterLayer: WaterLayer;
  private disposeWaterGui: (() => void) | null = null;
  // Entidades e Pools
  private readonly player: Player;
  private readonly projectilePool: ObjectPool<Projectile>;
  private readonly enemyProjectilePool: ObjectPool<Projectile>;
  private readonly enemyPool: ObjectPool<Enemy>;

  // Entrada por teclado
  private readonly keys: Record<string, boolean> = {};

  private isRunning: boolean = false;
  private sessionTimeRemaining: number = 60;
  private sessionSettings: GameSettings | null = null;
  private enemySpawnIntervalTicks: number = 90;

  // Estado e Controle de Gameplay
  private screenWidth: number = 800;
  private screenHeight: number = 600;
  private enemySpawnTimer: number = 0;
  private score: number = 0;
  private isGameOver: boolean = false;
  private readonly shake = new CameraShake();

  // player shooting

  private frontShootCooldown: number = 0;
  private leftShootCooldown: number = 0;
  private rightShootCooldown: number = 0;
  private bridgeUnsubscribers: Array<() => void> = [];

  // Handlers vinculados para desvinculação precisa no destroy
  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Space') {
      event.preventDefault();
    }
    this.keys[event.code] = true;
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.keys[event.code] = false;
  };

  constructor(
    private readonly bridge: GameBridge,
    private readonly assets: GameAssets
  ) {
    this.view = new Container();

    // 1. Cria e empilha as camadas visuais (fundo e jogo)
    this.backgroundLayer = new Container();
    this.gameLayer = new Container();

    this.view.addChild(this.backgroundLayer);
    this.view.addChild(this.gameLayer);

    // Água via shader (1 draw call), sempre abaixo do tilemap
    this.waterLayer = new WaterLayer({ texture: this.assets.waterTileTexture });
    this.backgroundLayer.addChild(this.waterLayer);
    if (import.meta.env.DEV) {
      this.disposeWaterGui = attachWaterDebugGui(this.waterLayer);
    }

    // 2. Instancia o Jogador com os 4 sprites de HP
    this.player = new Player(this.assets.playerTextures);

    // 3. Pool de Projéteis (Canhão)
    this.projectilePool = new ObjectPool<Projectile>(() => {
      const projectile = new Projectile(this.assets.projectileTexture);
      this.gameLayer.addChild(projectile.view);
      return projectile;
    }, 60);

    // 4. Pool de Inimigos (Suporta as 7 variações)
    this.enemyPool = new ObjectPool<Enemy>(() => {
      const enemy = new Enemy(this.assets.enemyRegistry, this.assets.projectileTexture);

      enemy.onShoot = (spawnX, spawnY, dirX, dirY) => {
        const bullet = this.enemyProjectilePool.get();
        if (!bullet) return;
        bullet.spawn(spawnX, spawnY, dirX, dirY);
      };

      enemy.onSpawnChaser = (source) => {
        if (!this.mapData) return false;
        const chaserType = Math.random() > 0.5 ? 'chaser_1' : 'chaser_2';
        const config = this.assets.enemyRegistry[chaserType];
        const texture = config.textures[config.textures.length - 1];
        const launch = findChaserLaunch(
          source,
          Math.max(config.radius, texture.width / 2, texture.height / 2),
          this.mapData,
          this.enemyPool.rawPool.filter((other) => other.isActive),
          this.player
        );
        if (!launch) return false;
        const chaser = this.enemyPool.get();
        chaser.spawn(launch.x, launch.y, chaserType, launch.heading);
        chaser.launch();
        return true;
      };

      // Devolve ao pool quando a animação de morte termina
      enemy.onDeathComplete = (dyingEnemy) => {
        this.enemyPool.release(dyingEnemy);
      };

      this.gameLayer.addChild(enemy.view);
      return enemy;
    }, 10);
    // 5. Pool de projeteis inimigos
    this.enemyProjectilePool = new ObjectPool<Projectile>(() => {
      const p = new Projectile(this.assets.projectileTexture);
      p.speed = MOVEMENT_SPEEDS.enemyProjectile;
      this.gameLayer.addChild(p.view);
      return p;
    }, 30);
  }

  public init(): void {
    this.score = 0;
    this.isGameOver = false;
    this.enemySpawnTimer = 0;
    this.frontShootCooldown = 0;
    this.leftShootCooldown = 0;
    this.rightShootCooldown = 0;

    // 1. GUARDA AS FUNÇÕES DE UNSUBSCRIBE DA GAMEBRIDGE
    this.bridgeUnsubscribers.push(
      this.bridge.onUIEvent('START_GAME', ({ settings }) => {
        this.startSession(settings);
      })
    );

    this.bridgeUnsubscribers.push(
      this.bridge.onUIEvent('RESTART_GAME', () => {
        if (this.sessionSettings) this.startSession(this.sessionSettings);
      })
    );

    this.bridgeUnsubscribers.push(
      this.bridge.onUIEvent('PAUSE_GAME', () => {
        this.isRunning = false;
        audio.setSailing(false);
      })
    );

    this.bridgeUnsubscribers.push(
      this.bridge.onUIEvent('RESUME_GAME', () => {
        this.isRunning = true;
      })
    );

    // 2. REGISTO DE EVENTOS DE TECLADO
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    // 3. CENÁRIO E MAPA
    this.setupTilemap();

    this.gameLayer.addChild(this.player.view);
    this.player.reset(this.screenWidth / 2, this.screenHeight - 120);
    this.updatePlayerBounds();
  }
  public startSession(settings: GameSettings): void {
    this.sessionSettings = { ...settings };
    this.sessionTimeRemaining = settings.sessionTime;
    // 60 ticks por segundo no Ticker
    this.enemySpawnIntervalTicks = settings.enemySpawnInterval * 60;

    this.resetGame();
    this.isRunning = true;

    this.bridge.emitToUI('TIME_UPDATED', {
      remainingSeconds: Math.ceil(this.sessionTimeRemaining),
    });
    this.bridge.emitToUI('LIFE_UPDATED', { remainingLifePoints: this.player.hp });
    this.bridge.emitToUI('SCORE_UPDATED', { currentScore: this.score });
  }

  private setupTilemap(): void {
    const tileRegistry = new TileRegistry();

    tileRegistry.register(TileType.WATER, this.assets.waterTileTexture);
    tileRegistry.registerIsland4x4(this.assets.islandTextures);
    tileRegistry.registerIslandOuter3x3(this.assets.islandOuterTextures);

    const cols = Math.ceil(this.screenWidth / this.tileSize) + 2;
    const rows = Math.ceil(this.screenHeight / this.tileSize) + 2;

    this.mapData = new MapData(cols, rows, this.tileSize);
    this.mapData.fill(TileType.WATER);
    this.flowField = new FlowField(this.mapData);
    IslandGenerator.generate(this.mapData, {
      islandCount: 5, // Número de arquipélagos por rodada
      minDimension: 4, // Largura/altura mínima
      maxDimension: 4, // Largura/altura máxima (ilhas até 8x8 tiles)
      safePlayerX: this.screenWidth / 2,
      safePlayerY: this.screenHeight - 120,
      safeRadius: 190,
    });

    this.waterLayer.setMap(this.mapData);

    this.tilemapLayer = new TilemapLayer(this.mapData, tileRegistry, { renderWater: false });
    this.backgroundLayer.addChild(this.tilemapLayer);
  }
  private updatePlayerBounds(): void {
    this.player.bounds = {
      minX: 0,
      maxX: this.screenWidth,
      minY: 0,
      maxY: this.screenHeight,
    };
  }

  public update(ticker: Ticker): void {
    // A água anima também no menu e na pausa
    this.waterLayer.update(ticker.deltaMS / 1000);
    this.shake.update(ticker.deltaMS / 1000);
    this.view.position.set(Math.round(this.shake.x), Math.round(this.shake.y));

    // Não processa nada do jogo até que Play seja clicado
    if (!this.isRunning || this.isGameOver) return;

    const dt = ticker.deltaTime;

    // Atualização do Tempo de Sessão
    this.sessionTimeRemaining -= dt / 60;
    this.bridge.emitToUI('TIME_UPDATED', {
      remainingSeconds: Math.max(0, Math.ceil(this.sessionTimeRemaining)),
    });

    if (this.sessionTimeRemaining <= 0) {
      this.triggerGameOver('timeout');
      return;
    }

    // 1. Jogador
    this.player.updatePlayer(dt, this.keys);
    if (this.mapData) {
      const beforeX = this.player.x;
      const beforeY = this.player.y;
      if (this.mapData.resolveCircleCollision(this.player)) {
        const impact = this.player.applyCollisionPush(
          this.player.x - beforeX,
          this.player.y - beforeY
        );
        if (impact > 0.15) this.shake.impact(3 + impact * 2);
      }
    }

    // 2. Flow Field
    if (this.flowField) {
      this.flowField.update(this.player.x, this.player.y);
    }

    // 3. Spawns e Tiros
    this.handleShooting(dt);
    this.handleEnemySpawning(dt);
    this.updateProjectiles(ticker);

    // 4. Inimigos
    if (this.mapData && this.flowField) {
      const map = this.mapData;
      const nav = this.flowField;

      const activeEnemies = this.enemyPool.rawPool.filter((enemy) => enemy.isActive);
      for (const enemy of activeEnemies) {
        enemy.updateEnemy(ticker, this.player.x, this.player.y, map, nav);
      }

      this.resolveEnemySeparation();

      this.enemyPool.forEachActive((enemy) => {
        const x = enemy.x;
        const y = enemy.y;
        if (map.resolveCircleCollision(enemy)) {
          if (enemy.archetype === 'chaser') this.explodeChaser(enemy);
          else enemy.applyCollisionPush(enemy.x - x, enemy.y - y);
        }
      });
    }

    // 5. Colisões
    this.checkCollisions();
  }
  private updateProjectiles(ticker: Ticker): void {
    // Projéteis do Jogador
    this.projectilePool.forEachActive((proj) => {
      const isAlive = proj.updateProjectile(ticker, this.screenWidth, this.screenHeight);

      // Se saiu da tela OU encostou numa ilha, despawna imediatamente
      if (
        !isAlive ||
        (this.mapData && this.mapData.isCircleColliding(proj.x, proj.y, proj.radius))
      ) {
        this.projectilePool.release(proj);
      }
    });

    // Projéteis dos Inimigos
    this.enemyProjectilePool.forEachActive((bullet) => {
      const isAlive = bullet.updateProjectile(ticker, this.screenWidth, this.screenHeight);

      if (
        !isAlive ||
        (this.mapData && this.mapData.isCircleColliding(bullet.x, bullet.y, bullet.radius))
      ) {
        this.enemyProjectilePool.release(bullet);
      }
    });
  }

  private handleShooting(dt: number): void {
    // Atualiza os contadores de recarga
    this.frontShootCooldown -= dt;
    this.leftShootCooldown -= dt;
    this.rightShootCooldown -= dt;

    // 1. Vetor Frontal (Proa do navio)
    const forwardAngle = this.player.rotation - Math.PI / 2;
    const fwdX = -Math.cos(forwardAngle);
    const fwdY = -Math.sin(forwardAngle);

    // 2. Vetores Ortogonais (90° para esquerda e direita)
    // Esquerda (Bombordo): rotação anti-horária de 90°
    const leftX = fwdY;
    const leftY = -fwdX;

    // Direita (Estibordo): rotação horária de 90°
    const rightX = -fwdY;
    const rightY = fwdX;

    // --- DISPARO FRONTAL (Espaço) ---
    if (this.keys['Space'] && this.frontShootCooldown <= 0) {
      const proj = this.projectilePool.get();
      if (proj) {
        audio.playCannonFire();
        const spawnX = this.player.x + fwdX * this.player.radius;
        const spawnY = this.player.y + fwdY * this.player.radius;
        proj.spawn(spawnX, spawnY, fwdX, fwdY);
        this.frontShootCooldown = 14; // ~4 disparos por segundo
      }
    }

    // --- DISPARO LATERAL ESQUERDO (Tecla Q) ---
    if ((this.keys['KeyQ'] || this.keys['Keyq']) && this.leftShootCooldown <= 0) {
      this.fireBroadside(leftX, leftY, fwdX, fwdY);
      this.leftShootCooldown = 28; // Recarga de salva lateral
    }

    // --- DISPARO LATERAL DIREITO (Tecla E) ---
    if ((this.keys['KeyE'] || this.keys['Keye']) && this.rightShootCooldown <= 0) {
      this.fireBroadside(rightX, rightY, fwdX, fwdY);
      this.rightShootCooldown = 28; // Recarga de salva lateral
    }
  }
  private fireBroadside(
    lateralDirX: number,
    lateralDirY: number,
    fwdX: number,
    fwdY: number
  ): void {
    const spacing = 14; // Distância entre os canhões ao longo do comprimento
    const lateralOffset = this.player.radius * 0.8; // Ponto de saída na lateral do casco

    // Deslocamentos longitudinais: canhão dianteiro (+14), central (0) e traseiro (-14)
    const offsets = [spacing, 0, -spacing];

    for (let i = 0; i < offsets.length; i++) {
      const proj = this.projectilePool.get();
      if (!proj) break; // Se atingir o limite pré-alocado do pool, encerra
      audio.playSFX('cannon_broadside');
      const longitudinalOffset = offsets[i];

      // Posição de origem de cada canhão individual
      const spawnX = this.player.x + lateralDirX * lateralOffset + fwdX * longitudinalOffset;
      const spawnY = this.player.y + lateralDirY * lateralOffset + fwdY * longitudinalOffset;

      // Todos os 3 recebem o mesmo vetor diretor, mantendo trajetórias rigorosamente paralelas
      proj.spawn(spawnX, spawnY, lateralDirX, lateralDirY);
    }
  }

  private handleEnemySpawning(dt: number): void {
    this.enemySpawnTimer -= dt;

    if (this.enemySpawnTimer <= 0) {
      const enemy = this.enemyPool.get();
      if (!enemy) return;

      const spawnX = Math.random() * (this.screenWidth - 100) + 50;
      const spawnY = -40;

      const shooterTypes: readonly EnemyVariation[] = [
        'shooter_1',
        'shooter_2',
        'shooter_3',
        'shooter_4',
        'shooter_5',
      ];
      const randomIndex = Math.floor(Math.random() * shooterTypes.length);

      enemy.spawn(spawnX, spawnY, shooterTypes[randomIndex]);

      // Usa o valor parametrizado no Options
      this.enemySpawnTimer = this.enemySpawnIntervalTicks;
    }
  }

  private resetGame(): void {
    this.shake.reset();
    this.view.position.set(0, 0);
    this.score = 0;
    this.isGameOver = false;
    this.frontShootCooldown = 0;
    this.leftShootCooldown = 0;
    this.rightShootCooldown = 0;
    this.enemySpawnTimer = 30; // Spawna o primeiro inimigo logo nos primeiros frames

    this.player.reset(this.screenWidth / 2, this.screenHeight - 120);

    // Limpeza dos pools
    this.projectilePool.releaseAll();
    this.enemyProjectilePool.releaseAll();
    this.enemyPool.releaseAll();
  }
  private checkCollisions(): void {
    const enemies = this.enemyPool.rawPool;
    const playerProjectiles = this.projectilePool.rawPool;
    const enemyProjectiles = this.enemyProjectilePool.rawPool;

    // ----------------------------------------------------
    // 1. PROJÉTEIS INIMIGOS vs BARCO DO JOGADOR
    // ----------------------------------------------------
    for (let i = 0; i < enemyProjectiles.length; i++) {
      const bullet = enemyProjectiles[i];
      if (!bullet.isActive) continue;

      const dx = bullet.x - this.player.x;
      const dy = bullet.y - this.player.y;
      const dist = Math.hypot(dx, dy);

      if (dist < bullet.radius + this.player.radius) {
        // Devolve o projétil inimigo ao pool
        this.enemyProjectilePool.release(bullet);
        audio.playWoodHit();
        // Aplica dano ao jogador e notifica a interface
        const isPlayerDead = this.player.takeDamage(1);
        this.shake.impact(7);
        this.bridge.emitToUI('LIFE_UPDATED', {
          remainingLifePoints: this.player.hp,
        });

        if (isPlayerDead) {
          this.triggerGameOver('dead');
          return;
        }
      }
    }

    // ----------------------------------------------------
    // 2. INIMIGOS vs JOGADOR & INIMIGOS vs PROJÉTEIS DO JOGADOR
    // ----------------------------------------------------
    for (let e = 0; e < enemies.length; e++) {
      const enemy = enemies[e];

      // Ignora se estiver inativo no pool OU se for um Shooter já afundando (isDying)
      if (!enemy.isActive || enemy.isDying) continue;

      // --- A. Colisão física: Inimigo vivo vs Jogador ---
      const dxPlayer = enemy.x - this.player.x;
      const dyPlayer = enemy.y - this.player.y;
      const distToPlayer = Math.hypot(dxPlayer, dyPlayer);

      if (distToPlayer < enemy.radius + this.player.radius) {
        this.shake.impact(10);
        const result = enemy.takeDamage(enemy.archetype === 'chaser' ? enemy.currentHealth : 1);
        audio.playWoodHit();
        // Se for um Chaser (kamikaze), despawna na hora ao colidir
        if (result.defeated && result.despawnImmediate) {
          this.enemyPool.release(enemy);
          audio.playExplosion();
        }

        const isPlayerDead = this.player.takeDamage(1);
        this.bridge.emitToUI('LIFE_UPDATED', {
          remainingLifePoints: this.player.hp,
        });

        if (isPlayerDead) {
          this.triggerGameOver('dead');
          audio.playSFX('ship_sinking');
          return;
        }
        continue;
      }

      // --- B. Colisão: Projéteis do Jogador vs Inimigo vivo ---
      for (let p = 0; p < playerProjectiles.length; p++) {
        const proj = playerProjectiles[p];

        // Se o projétil já sumiu ou o inimigo morreu/entrou em estado de morte nesta iteração
        if (!proj.isActive || !enemy.isActive || enemy.isDying) continue;

        const dxProj = enemy.x - proj.x;
        const dyProj = enemy.y - proj.y;
        const distToProj = Math.hypot(dxProj, dyProj);

        if (distToProj < enemy.radius + proj.radius) {
          // Devolve o tiro do jogador ao pool
          this.projectilePool.release(proj);
          audio.playWoodHit();

          // Aplica dano ao inimigo
          const result = enemy.takeDamage(1);
          this.shake.impact(result.defeated ? 5 : 2);

          if (result.defeated) {
            // Pontuação por abate
            this.score += 1;
            this.bridge.emitToUI('SCORE_UPDATED', { currentScore: this.score });
            audio.playSFX('ship_sinking');

            if (result.despawnImmediate) {
              this.enemyPool.release(enemy);
            }
          }

          // A bala acertou este inimigo; encerra o loop de tiros para este inimigo
          break;
        }
      }
    }
  }
  private triggerGameOver(reason: 'dead' | 'timeout'): void {
    this.isGameOver = true;
    audio.setSailing(false);
    this.bridge.emitToUI('GAME_OVER', {
      finalScore: this.score,
      reason,
    });
  }

  public resize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;

    this.updatePlayerBounds();

    // Redimensiona e recria a grade de tiles para cobrir toda a nova resolução
    if (this.tilemapLayer) {
      this.backgroundLayer.removeChild(this.tilemapLayer);
      this.tilemapLayer.destroy({ children: true });
      this.tilemapLayer = null;
    }
    this.setupTilemap();
  }

  public destroy(): void {
    this.disposeWaterGui?.();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);

    this.bridgeUnsubscribers.forEach((unsub) => unsub());
    this.bridgeUnsubscribers = [];
    this.isRunning = false;

    // 4. Liberta entidades e pools
    this.player.destroy();
    this.projectilePool.releaseAll();
    this.enemyProjectilePool.releaseAll();
    this.enemyPool.releaseAll();

    // 5. Destrói camadas do mapa
    if (this.tilemapLayer) {
      this.tilemapLayer.destroy({ children: true });
      this.tilemapLayer = null;
    }

    // 6. Destrói o contentor da cena no Pixi
    this.view.removeAllListeners();
    this.view.destroy({ children: true });
  }

  private explodeChaser(enemy: Enemy): void {
    enemy.takeDamage(enemy.currentHealth);
    this.enemyPool.release(enemy);
    audio.playExplosion();
    this.shake.impact(3);
  }

  private resolveEnemySeparation(): void {
    const enemies = this.enemyPool.rawPool;
    const len = enemies.length;

    for (let i = 0; i < len; i++) {
      const e1 = enemies[i];
      if (!e1.isActive || e1.isDying) continue;

      for (let j = i + 1; j < len; j++) {
        const e2 = enemies[j];
        if (!e2.isActive || e2.isDying) continue;

        const dx = e1.x - e2.x;
        const dy = e1.y - e2.y;
        const minDist = e1.radius + e2.radius;
        const distSq = dx * dx + dy * dy;

        // Se houver invasão de espaço entre dois inimigos do mesmo tipo
        if (distSq < minDist * minDist) {
          if (e1.archetype === 'chaser' || e2.archetype === 'chaser') {
            if (e2.archetype === 'chaser') this.explodeChaser(e2);
            if (e1.archetype === 'chaser') {
              this.explodeChaser(e1);
              break;
            }
            continue;
          }
          const dist = Math.sqrt(distSq);

          if (dist > 0.0001) {
            const overlap = (minDist - dist) * 0.5;
            const nx = dx / dist;
            const ny = dy / dist;

            e1.x += nx * overlap;
            e1.y += ny * overlap;
            e2.x -= nx * overlap;
            e2.y -= ny * overlap;
          } else {
            // Caso de spawn exatamente no mesmo ponto
            e1.x += e1.radius * 0.5;
            e2.x -= e2.radius * 0.5;
          }
        }
      }
    }
  }
}
