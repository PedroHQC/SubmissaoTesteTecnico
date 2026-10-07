// src/engine/world/Chunk.ts
import { Container } from 'pixi.js';
import { MapData } from '../tiles/MapData';
import { TilemapLayer } from '../tiles/TilemapLayer';
import { TileRegistry } from '../tiles/TileRegistry';
import { TileType } from '../tiles/TileTypes';
import { populateChunkIslands } from './IslandFeatures';
import { chunkSeed, mulberry32 } from './seededRandom';
import { WorldConfig } from './WorldConfig';

/**
 * Um pedaço quadrado do mundo: dados de tiles (MapData local) + sprites das ilhas.
 * Chunks só de água não criam sprites (a água é desenhada pelo WaterLayer).
 */
export class Chunk {
  public readonly view: Container;
  public readonly map: MapData;
  private readonly tilemap: TilemapLayer | null;

  constructor(
    public readonly cx: number,
    public readonly cy: number,
    config: WorldConfig,
    registry: TileRegistry
  ) {
    const { chunkTiles, tileSize } = config;
    const chunkPx = chunkTiles * tileSize;

    this.map = new MapData(chunkTiles, chunkTiles, tileSize);
    this.map.fill(TileType.WATER);

    // O spawn fica no centro do chunk (0,0): só ele precisa da zona segura
    const isSpawnChunk = cx === 0 && cy === 0;
    const safe = isSpawnChunk
      ? { x: chunkPx / 2, y: chunkPx / 2, radius: config.spawnSafeRadius }
      : null;

    populateChunkIslands(this.map, mulberry32(chunkSeed(config.seed, cx, cy)), config, safe);

    this.view = new Container();
    this.view.eventMode = 'none';
    this.view.position.set(cx * chunkPx, cy * chunkPx);

    this.tilemap = hasLand(this.map)
      ? new TilemapLayer(this.map, registry, { renderWater: false })
      : null;

    if (this.tilemap) {
      this.tilemap.setShelfAlpha(config.shelfAlpha);
      this.view.addChild(this.tilemap);
    }
  }

  public setShelfAlpha(alpha: number): void {
    this.tilemap?.setShelfAlpha(alpha);
  }

  public destroy(): void {
    this.view.destroy({ children: true });
  }
}

function hasLand(map: MapData): boolean {
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      if (map.getTile(c, r) !== TileType.WATER) return true;
    }
  }
  return false;
}
