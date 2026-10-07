// src/engine/scenes/WorldSandboxScene.ts
import { Container, Ticker } from 'pixi.js';
import type GUI from 'lil-gui';
import { IScene } from '../core/IScene';
import { Player } from '../entities/Player';
import { attachWaterDebugGui, WaterLayer, WaterRegionSource } from '../rendering/water';
import { WakeEffect } from '../rendering/wake';
import { EnemyWakes } from '../rendering/wake/EnemyWakes';
import { CameraShake } from '../rendering/CameraShake';
import { EnemyIndicators } from '../rendering/EnemyIndicators';
import { CombatSystem } from '../combat/CombatSystem';
import { ENEMY_AI } from '../entities/EnemyAI';
import { TileRegistry } from '../tiles/TileRegistry';
import { TileType } from '../tiles/TileTypes';
import { ChunkedWorld, ChunkWindow } from '../world';
import { GameAssets } from './GameScene';
import { audio } from '../services/audioManager';
import { GameBridge } from '../../bridge/GameBridge';
import { GameSettings, getDefaultSettings } from '../../services/gameSettings';
import type { GameTestHooks } from '../testing';
import { isCircleCollidingTiles } from '../tiles/TileCollision';

/**
 * Mundo em chunks com câmera, combate e fluxo de sessão conectado à UI.
 *
 * Hierarquia:
 *   view
 *   └─ worldLayer (transformada pela câmera)
 *      ├─ water   (quad cobrindo a janela de chunks carregados)
 *      ├─ wake    (rastro do barco: trilha + espuma)
 *      ├─ world   (sprites das ilhas por chunk, com culling)
 *      ├─ combat  (inimigos + projéteis)
 *      └─ player
 */
export class WorldSandboxScene implements IScene {
  public readonly view = new Container();

  private readonly worldLayer = new Container();
  private readonly world: ChunkedWorld;
  private readonly water: WaterLayer;
  private readonly player: Player;
  private readonly wake = new WakeEffect();
  private readonly enemyWakes = new EnemyWakes();
  private readonly enemyIndicators = new EnemyIndicators();
  private readonly combat: CombatSystem;
  private readonly unsubscribers: Array<() => void> = [];
  private isRunning = false;
  private isGameOver = false;
  private score = 0;
  private timeRemaining = 60;
  private sessionSettings = getDefaultSettings();
  private lastLife = 4;
  private lastWave = 0;

  private readonly keys: Record<string, boolean> = {};
  private readonly touchKeys: Record<string, boolean> = {};
  private testHooks?: GameTestHooks;
  private manualClock = false;
  private lastDisplayedSecond = -1;
  private touchStick = { x: 0, y: 0 };
  private screenWidth = 800;
  private screenHeight = 600;

  // Câmera: segue o player com suavização e antecipa a direção do movimento
  private readonly camera = {
    /** Frames de velocidade projetados à frente do barco. */
    lookAhead: 28,
    /** Fração da distância percorrida por frame até o alvo (0..1). */
    follow: 0.08,
  };
  private cameraX = 0;
  private cameraY = 0;
  private zoom = 0.92;
  private targetZoom = 0.92;
  private arenaZoomFactor = 1;
  private readonly shake = new CameraShake();

  // Estado da última região enviada à água (evita rebuilds desnecessários)
  private waterWindow: ChunkWindow | null = null;
  private waterRevision = -1;

  private disposeGui: (() => void) | null = null;

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.isRunning) return;
    if (event.target instanceof Element && event.target.closest('input, select, textarea')) return;
    if (
      ![
        'Space',
        'KeyQ',
        'KeyE',
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
      ].includes(event.code)
    )
      return;
    event.preventDefault();
    this.keys[event.code] = true;
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.keys[event.code] = false;
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    if (this.sessionSettings.mode !== 'open-sea') return;
    if (!this.isRunning || event.ctrlKey) return;
    if (event.target instanceof Element && event.target.closest('button, input, select, .lil-gui'))
      return;
    event.preventDefault();
    const pixels =
      event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.screenHeight : 1);
    const delta = Math.max(-100, Math.min(100, pixels));
    this.targetZoom = Math.max(0.7, Math.min(1.08, this.targetZoom * Math.exp(-delta * 0.0006)));
  };

  private readonly clearKeys = (): void => {
    for (const key of Object.keys(this.keys)) delete this.keys[key];
    for (const key of Object.keys(this.touchKeys)) delete this.touchKeys[key];
    this.touchStick = { x: 0, y: 0 };
    audio.setSailing(false);
  };

  constructor(
    assets: GameAssets,
    private readonly bridge?: GameBridge
  ) {
    const registry = new TileRegistry();
    registry.register(TileType.WATER, assets.waterTileTexture);
    registry.registerIsland4x4(assets.islandTextures);
    registry.registerIslandOuter3x3(assets.islandOuterTextures);

    this.world = new ChunkedWorld(registry);
    this.world.setArena(true);
    this.water = new WaterLayer({ texture: assets.waterTileTexture });
    this.player = new Player(assets.playerTextures);
    this.combat = new CombatSystem(assets, this.world, this.player, { godMode: !bridge });
    this.combat.onEnemyDefeated = () => {
      this.score++;
      this.bridge?.emitToUI('SCORE_UPDATED', { currentScore: this.score });
    };
    this.combat.onImpact = (x, y, strength) => {
      const distance = Math.hypot(x - this.player.x, y - this.player.y);
      this.shake.impact(strength * Math.max(0, 1 - distance / 700));
    };

    // Rastro acima da água e abaixo das ilhas; inimigos/projéteis abaixo do player
    this.worldLayer.addChild(
      this.water,
      this.wake.view,
      this.enemyWakes.view,
      this.world.view,
      this.combat.view,
      this.player.view
    );
    this.view.addChild(this.worldLayer, this.enemyIndicators.view);
    this.enemyIndicators.view.visible = false;
  }

  public init(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('wheel', this.handleWheel, { passive: false });
    window.addEventListener('blur', this.clearKeys);

    const spawn = this.world.spawnPoint;
    this.player.reset(spawn.x, spawn.y);
    this.cameraX = spawn.x;
    this.cameraY = spawn.y;

    if (this.bridge) {
      this.unsubscribers.push(
        this.bridge.onUIEvent('ABANDON_GAME', () => {
          this.isRunning = false;
          this.isGameOver = false;
          this.clearKeys();
          this.combat.reset();
          this.wake.clear();
          this.enemyWakes.clear();
          this.enemyIndicators.view.visible = false;
          this.player.ship.reset();
        }),
        this.bridge.onUIEvent('TOUCH_STICK', (stick) => {
          this.touchStick = this.isRunning ? stick : { x: 0, y: 0 };
        }),
        this.bridge.onUIEvent('TOUCH_KEY', ({ code, pressed }) => {
          this.touchKeys[code] = this.isRunning && pressed;
        }),
        this.bridge.onUIEvent('START_GAME', ({ settings }) => this.startSession(settings)),
        this.bridge.onUIEvent('RESTART_GAME', () => this.startSession(this.sessionSettings)),
        this.bridge.onUIEvent('PAUSE_GAME', () => {
          this.isRunning = false;
          this.enemyIndicators.view.visible = false;
          this.clearKeys();
        }),
        this.bridge.onUIEvent('RESUME_GAME', () => {
          if (!this.isGameOver) this.isRunning = true;
        })
      );
    } else {
      this.isRunning = true;
    }

    if (import.meta.env.MODE === 'test' || import.meta.env.MODE === 'profile') {
      this.testHooks = {
        setInvulnerable: (enabled) => {
          this.combat.config.godMode = enabled;
        },
        encounter: (type) => this.combat.prepareTestEncounter(type),
        setManualClock: (enabled) => {
          this.manualClock = enabled;
        },
        advance: (seconds) => {
          if (!this.manualClock) throw new Error('Enable manual clock before advancing');
          const frames = Math.round(seconds * 60);
          for (let frame = 0; frame < frames; frame++)
            this.updateFrame({ deltaTime: 1, deltaMS: 1000 / 60 } as Ticker);
        },
        getState: () => ({
          score: this.score,
          mode: this.sessionSettings.mode || 'arena',
          camera: { x: this.cameraX, y: this.cameraY, zoom: this.zoom },
          onLand: isCircleCollidingTiles(
            this.world,
            this.player.x,
            this.player.y,
            this.player.radius
          ),
          ...this.combat.testState,
          running: this.isRunning,
          time: this.timeRemaining,
          player: {
            x: this.player.x,
            y: this.player.y,
            rotation: this.player.rotation,
            vx: this.player.ship.vx,
            vy: this.player.ship.vy,
            hp: this.player.hp,
          },
          enemies: this.combat.stats.shooters + this.combat.stats.chasers,
          shots: this.combat.stats.playerShots,
          stick: { ...this.touchStick },
          touchKeys: { ...this.touchKeys },
        }),
        finishMatch: (score) => {
          this.score = score;
          this.finishSession('timeout');
        },
        setPlayerHp: (hp) => {
          this.player.hp = hp;
        },
      };
      window.__PIXI_TEST_HOOKS__ = this.testHooks;
    }
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('debug')) {
      this.disposeGui = attachWaterDebugGui(this.water, (gui) => this.buildWorldGui(gui));
    }
  }

  public update(ticker: Ticker): void {
    if (!this.manualClock) this.updateFrame(ticker);
  }

  private updateFrame(ticker: Ticker): void {
    const dt = ticker.deltaTime;
    const seconds = ticker.deltaMS / 1000;

    if (this.isRunning && this.bridge) {
      this.timeRemaining = Math.max(0, this.timeRemaining - seconds);
      const second = Math.ceil(this.timeRemaining);
      if (second !== this.lastDisplayedSecond) {
        this.lastDisplayedSecond = second;
        this.bridge.emitToUI('TIME_UPDATED', { remainingSeconds: second });
      }
      if (this.timeRemaining <= 0) this.finishSession('timeout');
    }

    // 1. Player + ricochete nas ilhas.
    if (this.isRunning) {
      this.player.updatePlayer(dt, this.activeKeys(), this.touchStick);
      const beforeX = this.player.x;
      const beforeY = this.player.y;
      if (this.world.resolveCircleCollision(this.player)) {
        const impact = this.player.applyCollisionPush(
          this.player.x - beforeX,
          this.player.y - beforeY
        );
        if (impact > 0.15) {
          this.shake.impact(3 + impact * 2);
          audio.playSFX('ship_collision');
        }
      }
    }

    // 2. Câmera suave com look-ahead na direção do movimento
    const { ship } = this.player;
    const targetX = this.player.x + ship.vx * this.camera.lookAhead;
    const targetY = this.player.y + ship.vy * this.camera.lookAhead;
    const follow = 1 - Math.pow(1 - this.camera.follow, dt);
    this.cameraX += (targetX - this.cameraX) * follow;
    this.cameraY += (targetY - this.cameraY) * follow;

    this.zoom += (this.targetZoom - this.zoom) * (1 - Math.exp(-seconds * 9));
    const arena = this.world.arenaLayoutBounds;
    if (arena) {
      // Fixed center and 25% more visible world area; only a gentle speed-based zoom.
      if (this.isRunning) {
        const speedRatio = Math.min(
          1,
          Math.hypot(ship.vx, ship.vy) / ship.handling.maxForwardSpeed
        );
        this.arenaZoomFactor +=
          (1 - speedRatio * 0.03 - this.arenaZoomFactor) * (1 - Math.exp(-seconds * 1.5));
      }
      this.zoom =
        (Math.min(this.screenWidth / arena.width, this.screenHeight / arena.height) /
          Math.sqrt(1.25)) *
        this.arenaZoomFactor;
      this.cameraX = arena.width / 2;
      this.cameraY = arena.height / 2;
    }
    const width = this.screenWidth / this.zoom;
    const height = this.screenHeight / this.zoom;
    const camX = this.cameraX - width / 2;
    const camY = this.cameraY - height / 2;

    // 3. Streaming + culling de chunks
    const viewRect = { x: camX, y: camY, width, height };
    if (arena) {
      this.world.setArenaViewport(viewRect);
      this.player.bounds = {
        minX: camX,
        minY: camY,
        maxX: camX + width,
        maxY: camY + height,
      };
      this.player.clampToBounds(this.player.bounds);
    }
    const padding = 16 / this.zoom;
    this.world.update({
      x: camX - padding,
      y: camY - padding,
      width: width + padding * 2,
      height: height + padding * 2,
    });

    // 3b. Combate: spawn fora da tela, IA, projéteis e colisões
    if (this.isRunning) {
      this.combat.update(ticker, this.activeKeys(), viewRect);
      if (this.player.bounds) this.player.clampToBounds(this.player.bounds);
      if (this.combat.wave.number !== this.lastWave) {
        this.lastWave = this.combat.wave.number;
        this.bridge?.emitToUI('WAVE_UPDATED', { wave: this.lastWave });
      }
      if (this.player.hp !== this.lastLife) {
        this.lastLife = this.player.hp;
        this.bridge?.emitToUI('LIFE_UPDATED', { remainingLifePoints: this.player.hp });
      }
      if (this.player.hp <= 0) this.finishSession('dead');
    }
    if (this.isRunning || this.isGameOver) this.combat.explosions.update(seconds);
    this.shake.update(seconds);
    this.worldLayer.scale.set(this.zoom);
    this.worldLayer.position.set(
      Math.round(-camX * this.zoom + this.shake.x),
      Math.round(-camY * this.zoom + this.shake.y)
    );
    this.enemyIndicators.view.visible = this.isRunning;
    if (this.isRunning) {
      this.enemyIndicators.update(
        this.combat.ships,
        this.screenWidth,
        this.screenHeight,
        this.zoom,
        this.worldLayer.x,
        this.worldLayer.y
      );
    }

    // 4. Água acompanha a janela de chunks carregados
    this.syncWaterRegion(viewRect);
    this.water.update(ticker.deltaMS / 1000);

    // 5. Rastro do barco
    if (this.isRunning || this.isGameOver) {
      this.enemyWakes.update(
        this.combat.ships,
        ticker.deltaMS / 1000,
        this.wake.config,
        this.player.width,
        this.player.height,
        this.isRunning
      );
      this.wake.update(
        {
          x: this.player.x,
          y: this.player.y,
          rotation: this.player.rotation,
          vx: this.isRunning ? ship.vx : 0,
          vy: this.isRunning ? ship.vy : 0,
        },
        ticker.deltaMS / 1000
      );
    }
  }

  private activeKeys(): Record<string, boolean> {
    const keys = { ...this.keys };
    for (const [code, pressed] of Object.entries(this.touchKeys)) {
      keys[code] = keys[code] || pressed;
    }
    return keys;
  }

  private startSession(settings: GameSettings): void {
    this.arenaZoomFactor = 1;
    this.lastWave = 1;
    this.bridge?.emitToUI('WAVE_UPDATED', { wave: 1 });
    this.sessionSettings = { ...settings };
    this.world.setArena(settings.mode !== 'open-sea');
    this.waterWindow = null;
    this.water.resetTime();
    this.timeRemaining = settings.sessionTime;
    this.lastDisplayedSecond = settings.sessionTime;
    this.score = 0;
    this.isGameOver = false;
    this.clearKeys();
    this.combat.reset();
    this.combat.config.spawnInterval = settings.enemySpawnInterval * 60;
    this.combat.config.spawnJitter = 0;
    this.wake.clear();
    this.enemyWakes.clear();
    this.enemyIndicators.view.visible = false;
    this.shake.reset();
    const spawn = this.world.spawnPoint;
    this.player.reset(spawn.x, spawn.y);
    const bounds = this.world.arenaBounds;
    this.player.bounds = bounds
      ? {
          minX: bounds.x,
          minY: bounds.y,
          maxX: bounds.x + bounds.width,
          maxY: bounds.y + bounds.height,
        }
      : null;
    this.lastLife = this.player.hp;
    this.cameraX = spawn.x;
    this.cameraY = spawn.y;
    this.isRunning = true;
    this.bridge?.emitToUI('LIFE_UPDATED', { remainingLifePoints: this.player.hp });
    this.bridge?.emitToUI('SCORE_UPDATED', { currentScore: 0 });
    this.bridge?.emitToUI('TIME_UPDATED', { remainingSeconds: Math.ceil(this.timeRemaining) });
    audio.playSFX('game_start');
  }

  private finishSession(reason: 'dead' | 'timeout'): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.isRunning = false;
    this.enemyIndicators.view.visible = false;
    this.clearKeys();
    audio.playSFX(reason === 'dead' ? 'game_over' : 'game_complete');
    this.bridge?.emitToUI('GAME_OVER', {
      finalScore: this.score,
      reason,
      durationSeconds: Math.max(0, this.sessionSettings.sessionTime - this.timeRemaining),
    });
  }

  public resize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
  }

  public destroy(): void {
    if (window.__PIXI_TEST_HOOKS__ === this.testHooks) delete window.__PIXI_TEST_HOOKS__;
    this.disposeGui?.();
    this.disposeGui = null;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('blur', this.clearKeys);
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());

    this.player.destroy();
    this.wake.destroy();
    this.enemyWakes.destroy();
    this.enemyIndicators.destroy();
    this.combat.destroy();
    this.world.destroy();
    this.view.destroy({ children: true });
  }

  /**
   * Reconstrói a região da água quando a janela muda (o quad precisa cobrir a tela)
   * ou quando a geração pendente termina (o campo de distância passa a ver as ilhas novas).
   */
  private syncWaterRegion(viewRect: { x: number; y: number; width: number; height: number }): void {
    const { chunkTiles, tileSize } = this.world.config;
    const chunkSize = chunkTiles * tileSize;
    const margin = 32 / this.zoom;
    const win = this.world.arenaBounds
      ? {
          cx0: Math.floor((viewRect.x - margin) / chunkSize),
          cy0: Math.floor((viewRect.y - margin) / chunkSize),
          cx1: Math.floor((viewRect.x + viewRect.width + margin) / chunkSize),
          cy1: Math.floor((viewRect.y + viewRect.height + margin) / chunkSize),
        }
      : this.world.loadedWindow;
    const windowMoved = !this.waterWindow || !sameWindow(win, this.waterWindow);
    const chunksSettled =
      this.world.stats.pending === 0 && this.world.chunkRevision !== this.waterRevision;

    if (!windowMoved && !chunksSettled) return;

    const originCol = win.cx0 * chunkTiles;
    const originRow = win.cy0 * chunkTiles;
    const world = this.world;

    const region: WaterRegionSource = {
      cols: (win.cx1 - win.cx0 + 1) * chunkTiles,
      rows: (win.cy1 - win.cy0 + 1) * chunkTiles,
      tileSize,
      getTile: (col, row) => world.getTile(originCol + col, originRow + row),
    };

    this.water.setMap(region, originCol * tileSize, originRow * tileSize);
    this.waterWindow = win;
    this.waterRevision = this.world.chunkRevision;
  }

  private buildWorldGui(gui: GUI): void {
    const folder = gui.addFolder('Mundo (chunks)');
    const state = { shelfAlpha: this.world.config.shelfAlpha };

    folder
      .add(state, 'shelfAlpha', 0, 1, 0.01)
      .name('Opacidade da costa')
      .onChange((value: number) => this.world.setShelfAlpha(value));

    // Ilhas: regenera o mundo ao soltar o slider (geração é determinística pelo seed)
    const islands = gui.addFolder('Ilhas (regenera)');
    const islandState = { ...this.world.config };
    const regenerate = () =>
      this.world.reconfigure({ ...islandState, shelfAlpha: this.world.config.shelfAlpha });
    islands.add(islandState, 'seed', 0, 99999, 1).onFinishChange(regenerate);
    islands.add(islandState, 'chunkTiles', 16, 48, 1).onFinishChange(regenerate);
    islands.add(islandState, 'islandsPerChunkMin', 0, 4, 1).onFinishChange(regenerate);
    islands.add(islandState, 'islandsPerChunkMax', 0, 6, 1).onFinishChange(regenerate);
    islands.add(islandState, 'islandMinDimension', 2, 12, 1).onFinishChange(regenerate);
    islands.add(islandState, 'islandMaxDimension', 2, 24, 1).onFinishChange(regenerate);
    islands.add(islandState, 'islandSpacing', 3, 12, 1).onFinishChange(regenerate);
    islands.add(islandState, 'chunkEdgeMargin', 1, 8, 1).onFinishChange(regenerate);
    islands.add(islandState, 'archipelagoChance', 0, 1, 0.01).onFinishChange(regenerate);
    islands.add(islandState, 'archipelagoMinIslands', 1, 6, 1).onFinishChange(regenerate);
    islands.add(islandState, 'archipelagoMaxIslands', 1, 8, 1).onFinishChange(regenerate);
    islands.add(islandState, 'archipelagoMaxDimension', 2, 12, 1).onFinishChange(regenerate);

    // Barco: edita o handling diretamente (aplicado no próximo frame)
    const ship = gui.addFolder('Barco');
    const h = this.player.ship.handling;
    ship.add(h, 'maxForwardSpeed', 0.5, 8, 0.05).name('Velocidade máx.');
    ship.add(h, 'maxReverseSpeed', 0, 4, 0.05).name('Velocidade de ré');
    ship.add(h, 'thrust', 0.005, 0.3, 0.005).name('Aceleração');
    ship.add(h, 'brake', 0.005, 0.4, 0.005).name('Freio');
    ship.add(h, 'reverseThrust', 0.005, 0.2, 0.005).name('Aceleração de ré');
    ship.add(h, 'waterDrag', 0.9, 1, 0.001).name('Retenção na água');
    ship.add(h, 'lateralGrip', 0.005, 1, 0.005).name('Aderência lateral');
    ship.add(h, 'maxTurnRate', 0.005, 0.12, 0.001).name('Curva máx.');
    ship.add(h, 'turnAtRest', 0, 1, 0.01).name('Curva parado');
    ship.add(h, 'turnResponse', 0.01, 1, 0.01).name('Resposta do leme');
    ship.add(h, 'collisionFriction', 0, 1, 0.01).name('Atrito na costa');
    ship.add(h, 'collisionBounce', 0, 1, 0.01).name('Ricochete');

    // Rastro: edita o config diretamente (aplicado no próximo frame)
    const wake = gui.addFolder('Rastro');
    const w = this.wake.config;
    wake.add(w, 'sternOffset', 0, 40, 1).name('Offset da popa');
    wake.add(w, 'pointSpacing', 2, 40, 1).name('Espaçamento dos pontos');
    wake.add(w, 'minSpeed', 0, 2, 0.01).name('Velocidade mínima');
    wake.add(w, 'fullSpeed', 0.5, 8, 0.05).name('Velocidade plena');
    wake.add(w, 'trailLifetime', 0.2, 6, 0.05).name('Trilha: duração (s)');
    wake.add(w, 'trailStartWidth', 0, 120, 1).name('Trilha: largura inicial');
    wake.add(w, 'trailEndWidth', 0, 240, 1).name('Trilha: largura final');
    wake.add(w, 'trailFadePower', 0.2, 5, 0.05).name('Trilha: curva do fade');
    wake.add(w, 'trailHeadFade', 0, 80, 1).name('Trilha: fade na popa');
    wake.add(w, 'trailTextureLength', 0, 600, 1).name('Trilha: repetição UV (px)');
    wake.add(w, 'trailTextureScroll', -3, 3, 0.01).name('Trilha: rolagem UV');
    wake.add(w, 'trailOpacity', 0, 1, 0.01).name('Trilha: opacidade');
    wake.addColor(w, 'trailTint').name('Trilha: cor');
    wake.add(w, 'foamSpacing', 2, 60, 1).name('Espuma: espaçamento');
    wake.add(w, 'foamSideOffset', 0, 40, 1).name('Espuma: afastamento lateral');
    wake.add(w, 'foamAlongHull', 0, 1, 0.01).name('Espuma: posição no casco');
    wake.add(w, 'foamLifetime', 0.1, 4, 0.05).name('Espuma: duração (s)');
    wake.add(w, 'foamStartSize', 1, 80, 1).name('Espuma: tamanho inicial');
    wake.add(w, 'foamEndSize', 1, 160, 1).name('Espuma: tamanho final');
    wake.add(w, 'foamDrift', 0, 120, 1).name('Espuma: deriva (px/s)');
    wake.add(w, 'foamOpacity', 0, 1, 0.01).name('Espuma: opacidade');
    wake.addColor(w, 'foamTint').name('Espuma: cor');
    wake.add(w, 'foamMaxParticles', 0, 600, 1).name('Espuma: máx. quads');

    // Inimigos: director e teste
    const enemies = gui.addFolder('Inimigos');
    const c = this.combat.config;
    enemies.add(c, 'enemiesEnabled').name('Inimigos ativos');
    enemies.add(c, 'godMode').name('Vida infinita');
    enemies.add(c, 'maxShooters', 0, 12, 1).name('Máx. shooters');
    enemies.add(c, 'maxChasers', 0, 20, 1).name('Máx. chasers');
    enemies.add(c, 'spawnInterval', 10, 600, 1).name('Intervalo de spawn');
    enemies.add(c, 'spawnJitter', 0, 300, 1).name('Variação do spawn');
    enemies.add(c, 'spawnMargin', 0, 600, 1).name('Margem fora da tela');
    enemies.add(c, 'minSpawnSpacing', 0, 600, 1).name('Espaço entre spawns');
    enemies.add(c, 'despawnDistanceScale', 1.2, 5, 0.05).name('Distância de reciclagem');
    enemies.add(c, 'shootersSpawnChasers').name('Shooters lançam chasers');
    enemies.add(c, 'ramKnockback', 0, 8, 0.1).name('Empurrão do abalroamento');

    // IA: compartilhada por todos os inimigos (velocidades valem no próximo spawn)
    const ai = gui.addFolder('IA dos inimigos');
    ai.add(ENEMY_AI, 'chaserSpeedScale', 0.3, 1.5, 0.01).name('Chaser: velocidade');
    ai.add(ENEMY_AI, 'chaserLeadFactor', 0, 2, 0.05).name('Chaser: antecipação');
    ai.add(ENEMY_AI, 'shooterSpeedScale', 0.3, 1.5, 0.01).name('Shooter: velocidade');
    ai.add(ENEMY_AI, 'shooterMinRange', 50, 500, 1).name('Shooter: distância mín.');
    ai.add(ENEMY_AI, 'shooterMaxRange', 80, 700, 1).name('Shooter: distância máx.');
    ai.add(ENEMY_AI, 'shooterOrbitWeight', 0, 2, 0.05).name('Shooter: órbita');
    ai.add(ENEMY_AI, 'shooterFireRange', 100, 900, 1).name('Shooter: alcance de tiro');
    ai.add(ENEMY_AI, 'shooterFireCooldown', 10, 300, 1).name('Shooter: cadência');
    ai.add(ENEMY_AI, 'shooterAimSpread', 0, 0.5, 0.01).name('Shooter: dispersão');
    ai.add(ENEMY_AI, 'shooterProjectileSpeed', 2, 16, 0.1).name('Shooter: vel. do tiro');
    ai.add(ENEMY_AI, 'separationRadius', 20, 300, 1).name('Separação: raio');
    ai.add(ENEMY_AI, 'separationWeight', 0, 5, 0.05).name('Separação: força');
    ai.add(ENEMY_AI, 'feelerTiles', 0.5, 6, 0.1).name('Desvio: alcance (tiles)');
    ai.add(ENEMY_AI, 'avoidanceWeight', 0, 6, 0.05).name('Desvio: força');

    const camera = gui.addFolder('Câmera');
    camera.add(this.camera, 'lookAhead', 0, 80, 1).name('Look-ahead (frames)');
    camera.add(this.camera, 'follow', 0.01, 1, 0.01).name('Suavização');

    const stats = {
      loaded: 0,
      visible: 0,
      pending: 0,
      trailPoints: 0,
      foamQuads: 0,
      shooters: 0,
      chasers: 0,
      enemyShots: 0,
      playerShots: 0,
      playerHits: 0,
    };
    folder.add(stats, 'loaded').name('Chunks carregados').disable().listen();
    folder.add(stats, 'visible').name('Chunks visíveis').disable().listen();
    folder.add(stats, 'pending').name('Chunks pendentes').disable().listen();
    folder.add(stats, 'trailPoints').name('Rastro: pontos').disable().listen();
    folder.add(stats, 'foamQuads').name('Rastro: quads de espuma').disable().listen();
    folder.add(stats, 'shooters').name('Shooters ativos').disable().listen();
    folder.add(stats, 'chasers').name('Chasers ativos').disable().listen();
    folder.add(stats, 'enemyShots').name('Tiros inimigos').disable().listen();
    folder.add(stats, 'playerHits').name('Acertos no player').disable().listen();

    const refresh = () => {
      if (!this.disposeGui) return;
      Object.assign(stats, this.world.stats, this.wake.stats, this.combat.stats);
      requestAnimationFrame(refresh);
    };
    refresh();
  }
}

function sameWindow(a: ChunkWindow, b: ChunkWindow): boolean {
  return a.cx0 === b.cx0 && a.cy0 === b.cy0 && a.cx1 === b.cx1 && a.cy1 === b.cy1;
}
