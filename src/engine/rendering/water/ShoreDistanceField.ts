// src/engine/rendering/water/ShoreDistanceField.ts
import { BufferImageSource, Texture } from 'pixi.js';
import { isIslandInterior, TileType } from '../../tiles/TileTypes';

export type ShoreSourcePredicate = (type: TileType) => boolean;

/** Grade de tiles lida pelo campo (MapData ou uma janela do mundo em chunks). */
export interface ShoreTileSource {
  readonly cols: number;
  readonly rows: number;
  getTile(col: number, row: number): TileType;
}

export interface ShoreFieldOptions {
  /** Alcance máximo da distância, em tiles. Além disso o valor satura em 1. */
  readonly maxDistanceTiles: number;
  /** Subdivisões por tile (resolução do campo). */
  readonly resolution: number;
  /** Quais tiles contam como terra. Padrão: miolo da ilha. */
  readonly isShoreSource?: ShoreSourcePredicate;
}

const DIAGONAL = Math.SQRT2;

/**
 * Gera uma textura de campo de distância até a costa a partir de uma grade de tiles.
 * Canal R: 0 sobre a terra, 1 a `maxDistanceTiles` ou mais.
 *
 * Usa transformada de distância chamfer (2 passadas, pesos 1 e √2):
 * O(n) sobre a grade e roda só quando o mapa muda.
 */
export function createShoreDistanceTexture(
  map: ShoreTileSource,
  options: ShoreFieldOptions
): Texture {
  const { maxDistanceTiles, resolution } = options;
  const isShoreSource = options.isShoreSource ?? isIslandInterior;

  const width = map.cols * resolution;
  const height = map.rows * resolution;
  const distances = computeDistanceGrid(map, width, height, resolution, isShoreSource);

  const maxDistance = maxDistanceTiles * resolution;
  const pixels = new Uint8Array(width * height * 4);

  for (let i = 0; i < distances.length; i++) {
    const value = Math.round(Math.min(1, distances[i] / maxDistance) * 255);
    const p = i * 4;
    pixels[p] = value;
    pixels[p + 1] = value;
    pixels[p + 2] = value;
    pixels[p + 3] = 255;
  }

  const source = new BufferImageSource({
    resource: pixels,
    width,
    height,
    format: 'rgba8unorm',
    alphaMode: 'no-premultiply-alpha',
    scaleMode: 'linear',
    addressMode: 'clamp-to-edge',
  });

  return new Texture({ source });
}

function computeDistanceGrid(
  map: ShoreTileSource,
  width: number,
  height: number,
  resolution: number,
  isShoreSource: ShoreSourcePredicate
): Float32Array {
  const grid = new Float32Array(width * height);

  // Máscara de terra por tile (1 consulta por tile, não por subcélula)
  const land = new Uint8Array(map.cols * map.rows);
  for (let row = 0; row < map.rows; row++) {
    for (let col = 0; col < map.cols; col++) {
      land[row * map.cols + col] = isShoreSource(map.getTile(col, row)) ? 1 : 0;
    }
  }

  // Semente: 0 nas células de terra, "infinito" no resto
  for (let y = 0; y < height; y++) {
    const rowOffset = Math.floor(y / resolution) * map.cols;
    for (let x = 0; x < width; x++) {
      grid[y * width + x] = land[rowOffset + Math.floor(x / resolution)] ? 0 : Infinity;
    }
  }

  // Passada direta (cima-esquerda → baixo-direita)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      let d = grid[i];
      if (x > 0) d = Math.min(d, grid[i - 1] + 1);
      if (y > 0) {
        d = Math.min(d, grid[i - width] + 1);
        if (x > 0) d = Math.min(d, grid[i - width - 1] + DIAGONAL);
        if (x < width - 1) d = Math.min(d, grid[i - width + 1] + DIAGONAL);
      }
      grid[i] = d;
    }
  }

  // Passada reversa (baixo-direita → cima-esquerda)
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      let d = grid[i];
      if (x < width - 1) d = Math.min(d, grid[i + 1] + 1);
      if (y < height - 1) {
        d = Math.min(d, grid[i + width] + 1);
        if (x < width - 1) d = Math.min(d, grid[i + width + 1] + DIAGONAL);
        if (x > 0) d = Math.min(d, grid[i + width - 1] + DIAGONAL);
      }
      grid[i] = d;
    }
  }

  return grid;
}
