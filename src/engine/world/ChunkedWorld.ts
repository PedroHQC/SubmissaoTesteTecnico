// src/engine/world/ChunkedWorld.ts
import { Container } from 'pixi.js';
import { CollidableEntity, resolveCircleVsTiles, SolidTileGrid } from '../tiles/TileCollision';
import { TileRegistry } from '../tiles/TileRegistry';
import { TILE_DEFINITIONS, TileType } from '../tiles/TileTypes';
import { Chunk } from './Chunk';
import { DEFAULT_WORLD_CONFIG, WorldConfig } from './WorldConfig';
import { MapData } from '../tiles/MapData';
import { TilemapLayer } from '../tiles/TilemapLayer';
import { IslandGenerator } from '../tiles/IslandGenerator';

/** Retângulo em pixels de mundo. */
export interface WorldRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Faixa de chunks (inclusiva) carregada em volta da câmera. */
export interface ChunkWindow {
  readonly cx0: number;
  readonly cy0: number;
  readonly cx1: number;
  readonly cy1: number;
}

export interface WorldStats {
  readonly loaded: number;
  readonly visible: number;
  readonly pending: number;
}

const chunkKey = (cx: number, cy: number): string => `${cx},${cy}`;

/**
 * Mundo infinito gerado em chunks em volta da câmera.
 *
 * - Streaming: carrega a janela visível + `loadMarginChunks`, gera no máximo
 *   `maxChunkBuildsPerFrame` por frame (mais próximos do centro primeiro) e
 *   descarrega fora de `unloadMarginChunks` (histerese).
 * - Culling: chunks carregados fora da tela ficam `visible = false`.
 * - Consultas em coordenadas de tile de mundo (getTile/isSolid), usadas pela
 *   colisão e pelo campo de distância da água.
 */
export class ChunkedWorld implements SolidTileGrid {
  public readonly view: Container;
  private settings: WorldConfig;
  private arenaMap: MapData | null = null;
  private arenaLayer: TilemapLayer | null = null;
  private arenaViewport: WorldRect | null = null;

  public get arenaBounds(): WorldRect | null {
    return this.arenaMap ? this.arenaViewport : null;
  }

  /** Island layout reference, independent of the device's playable viewport. */
  public get arenaLayoutBounds(): WorldRect | null {
    return this.arenaMap
      ? {
          x: 0,
          y: 0,
          width: this.arenaMap.cols * this.tileSize,
          height: this.arenaMap.rows * this.tileSize,
        }
      : null;
  }

  public setArenaViewport(view: WorldRect): void {
    if (this.arenaMap) this.arenaViewport = { ...view };
  }

  public setArena(enabled: boolean): void {
    this.arenaLayer?.destroy({ children: true });
    this.arenaLayer = null;
    this.arenaMap = null;
    this.arenaViewport = null;
    this.reconfigure({});
    if (!enabled) return;
    const map = new MapData(40, 24, this.tileSize);
    map.fill(TileType.WATER);
    IslandGenerator.tryPlaceRect(map, 8, 6, 4, 4);
    IslandGenerator.tryPlaceRect(map, 28, 14, 4, 4);
    this.arenaMap = map;
    this.arenaViewport = this.arenaLayoutBounds;
    this.arenaLayer = new TilemapLayer(map, this.registry, { renderWater: false });
    this.view.addChild(this.arenaLayer);
    this.window = { cx0: 0, cy0: 0, cx1: 1, cy1: 0 };
    this.revision++;
  }

  private readonly chunks = new Map<string, Chunk>();
  private pending: Array<{ cx: number; cy: number }> = [];
  private window: ChunkWindow = { cx0: 0, cy0: 0, cx1: -1, cy1: -1 };
  private visibleCount = 0;
  /** Incrementa sempre que o conjunto de chunks muda (para quem depende do layout, ex.: água). */
  private revision = 0;

  // Cache do último chunk consultado: getTile é chamado em sequência dentro do mesmo chunk
  private lastChunk: Chunk | null = null;

  constructor(
    private readonly registry: TileRegistry,
    config: Partial<WorldConfig> = {}
  ) {
    this.settings = { ...DEFAULT_WORLD_CONFIG, ...config };
    this.view = new Container();
    this.view.eventMode = 'none';
  }

  public get config(): WorldConfig {
    return this.settings;
  }

  public get tileSize(): number {
    return this.config.tileSize;
  }

  public get chunkPixelSize(): number {
    return this.config.chunkTiles * this.config.tileSize;
  }

  /** Centro do chunk (0,0): ponto de spawn com zona segura sem ilhas. */
  public get spawnPoint(): { x: number; y: number } {
    if (this.arenaMap) return { x: 640, y: 384 };
    const half = this.chunkPixelSize / 2;
    return { x: half, y: half };
  }

  public get loadedWindow(): ChunkWindow {
    return this.window;
  }

  public get chunkRevision(): number {
    return this.revision;
  }

  public get stats(): WorldStats {
    return { loaded: this.chunks.size, visible: this.visibleCount, pending: this.pending.length };
  }

  /** Chamado a cada frame com o retângulo visível da câmera. */
  public update(viewRect: WorldRect): void {
    if (this.arenaMap) return;
    const chunkPx = this.chunkPixelSize;
    const viewCx0 = Math.floor(viewRect.x / chunkPx);
    const viewCy0 = Math.floor(viewRect.y / chunkPx);
    const viewCx1 = Math.floor((viewRect.x + viewRect.width) / chunkPx);
    const viewCy1 = Math.floor((viewRect.y + viewRect.height) / chunkPx);

    const load = this.config.loadMarginChunks;
    const nextWindow: ChunkWindow = {
      cx0: viewCx0 - load,
      cy0: viewCy0 - load,
      cx1: viewCx1 + load,
      cy1: viewCy1 + load,
    };

    if (!sameWindow(nextWindow, this.window)) {
      this.window = nextWindow;
      this.unloadOutside(this.config.unloadMarginChunks - load);
      this.queueMissing((viewCx0 + viewCx1) / 2, (viewCy0 + viewCy1) / 2);
    }

    this.buildPending();
    this.cull(viewRect);
  }

  public getTile(col: number, row: number): TileType {
    if (this.arenaMap) return this.arenaMap.getTile(col, row) || TileType.WATER;
    const size = this.config.chunkTiles;
    const cx = Math.floor(col / size);
    const cy = Math.floor(row / size);

    let chunk = this.lastChunk;
    if (!chunk || chunk.cx !== cx || chunk.cy !== cy) {
      chunk = this.chunks.get(chunkKey(cx, cy)) ?? null;
      if (!chunk) return TileType.WATER; // ainda não gerado: trata como mar aberto
      this.lastChunk = chunk;
    }

    return chunk.map.getTile(col - cx * size, row - cy * size);
  }

  public isSolid(col: number, row: number): boolean {
    // Water beyond the island layout is playable; exact viewport bounds constrain ships.
    return TILE_DEFINITIONS[this.getTile(col, row)]?.isSolid ?? false;
  }

  /** Bresenham em tiles de mundo: false se qualquer tile sólido estiver no caminho. */
  public hasLineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    const size = this.config.tileSize;
    let c = Math.floor(x0 / size);
    let r = Math.floor(y0 / size);
    const c1 = Math.floor(x1 / size);
    const r1 = Math.floor(y1 / size);

    const dc = Math.abs(c1 - c);
    const dr = Math.abs(r1 - r);
    const sc = c < c1 ? 1 : -1;
    const sr = r < r1 ? 1 : -1;
    let err = dc - dr;

    for (;;) {
      if (this.isSolid(c, r)) return false;
      if (c === c1 && r === r1) return true;

      const e2 = 2 * err;
      if (e2 > -dr) {
        err -= dr;
        c += sc;
      }
      if (e2 < dc) {
        err += dc;
        r += sr;
      }
    }
  }

  public resolveCircleCollision(entity: CollidableEntity): boolean {
    return resolveCircleVsTiles(this, entity);
  }

  public setShelfAlpha(alpha: number): void {
    this.settings = { ...this.settings, shelfAlpha: alpha };
    this.chunks.forEach((chunk) => chunk.setShelfAlpha(alpha));
  }

  /**
   * Aplica nova configuração e regenera o mundo: descarta todos os chunks e
   * deixa o próximo update() reenfileirar a janela atual.
   */
  public reconfigure(overrides: Partial<WorldConfig>): void {
    this.settings = { ...this.settings, ...overrides };
    this.chunks.forEach((chunk) => chunk.destroy());
    this.chunks.clear();
    this.pending = [];
    this.lastChunk = null;
    this.window = { cx0: 0, cy0: 0, cx1: -1, cy1: -1 };
    this.revision++;
  }

  public destroy(): void {
    this.chunks.forEach((chunk) => chunk.destroy());
    this.chunks.clear();
    this.pending = [];
    this.lastChunk = null;
    this.view.destroy({ children: true });
  }

  private unloadOutside(extraMargin: number): void {
    const { cx0, cy0, cx1, cy1 } = this.window;
    const m = Math.max(0, extraMargin);

    this.chunks.forEach((chunk, key) => {
      const outside =
        chunk.cx < cx0 - m || chunk.cx > cx1 + m || chunk.cy < cy0 - m || chunk.cy > cy1 + m;
      if (!outside) return;

      if (this.lastChunk === chunk) this.lastChunk = null;
      chunk.destroy();
      this.chunks.delete(key);
      this.revision++;
    });
  }

  /** Enfileira os chunks faltantes da janela, ordenados do centro para fora. */
  private queueMissing(centerCx: number, centerCy: number): void {
    const { cx0, cy0, cx1, cy1 } = this.window;
    const missing: Array<{ cx: number; cy: number; d: number }> = [];

    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        if (this.chunks.has(chunkKey(cx, cy))) continue;
        const dx = cx - centerCx;
        const dy = cy - centerCy;
        missing.push({ cx, cy, d: dx * dx + dy * dy });
      }
    }

    missing.sort((a, b) => a.d - b.d);
    this.pending = missing.map(({ cx, cy }) => ({ cx, cy }));
  }

  private buildPending(): void {
    let budget = this.config.maxChunkBuildsPerFrame;

    while (budget > 0 && this.pending.length > 0) {
      const { cx, cy } = this.pending.shift()!;
      const key = chunkKey(cx, cy);
      if (this.chunks.has(key)) continue;

      const chunk = new Chunk(cx, cy, this.config, this.registry);
      this.chunks.set(key, chunk);
      this.view.addChild(chunk.view);
      this.revision++;
      budget--;
    }
  }

  /** Culling por chunk: só o que intersecta a tela é desenhado. */
  private cull(viewRect: WorldRect): void {
    const chunkPx = this.chunkPixelSize;
    let visible = 0;

    this.chunks.forEach((chunk) => {
      const x = chunk.cx * chunkPx;
      const y = chunk.cy * chunkPx;
      const isVisible =
        x < viewRect.x + viewRect.width &&
        x + chunkPx > viewRect.x &&
        y < viewRect.y + viewRect.height &&
        y + chunkPx > viewRect.y;

      chunk.view.visible = isVisible;
      if (isVisible) visible++;
    });

    this.visibleCount = visible;
  }
}

function sameWindow(a: ChunkWindow, b: ChunkWindow): boolean {
  return a.cx0 === b.cx0 && a.cy0 === b.cy0 && a.cx1 === b.cx1 && a.cy1 === b.cy1;
}
