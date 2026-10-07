// src/engine/world/IslandFeatures.ts
import { IslandGenerator } from '../tiles/IslandGenerator';
import { MapData } from '../tiles/MapData';
import { WorldConfig } from './WorldConfig';

/** Círculo (em pixels locais do chunk) onde nenhuma ilha pode nascer. */
export interface SafeZone {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

// Padding entre ilhas do mesmo arquipélago: os anéis rasos se encostam e formam um banco único
const ARCHIPELAGO_PADDING = 3;
const PLACEMENT_ATTEMPTS = 24;

/**
 * Popula um chunk com "features" de ilha:
 * - ilha única: retângulo com tamanho e proporção variados (de ilhota a ilha grande/alongada);
 * - arquipélago: grupo de ilhas menores bem próximas compartilhando o banco raso.
 *
 * Só usa retângulos porque o tileset não tem cantos côncavos.
 */
export function populateChunkIslands(
  map: MapData,
  random: () => number,
  config: WorldConfig,
  safe: SafeZone | null
): void {
  const featureRange = config.islandsPerChunkMax - config.islandsPerChunkMin + 1;
  const featureCount = config.islandsPerChunkMin + Math.floor(random() * featureRange);

  for (let i = 0; i < featureCount; i++) {
    if (random() < config.archipelagoChance) {
      placeArchipelago(map, random, config, safe);
    } else {
      placeSingle(map, random, config, safe);
    }
  }
}

function placeSingle(
  map: MapData,
  random: () => number,
  config: WorldConfig,
  safe: SafeZone | null
): boolean {
  for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
    const w = randomInt(random, config.islandMinDimension, config.islandMaxDimension);
    // Proporção limitada para evitar faixas finas demais
    const minH = Math.max(config.islandMinDimension, Math.ceil(w * 0.4));
    const maxH = Math.min(config.islandMaxDimension, Math.floor(w * 1.6));
    const h = randomInt(random, minH, Math.max(minH, maxH));

    const pos = randomPosition(map, random, config, w, h);
    if (!pos || intersectsSafe(map, pos.col, pos.row, w, h, safe)) continue;

    if (IslandGenerator.tryPlaceRect(map, pos.col, pos.row, w, h, config.islandSpacing)) {
      return true;
    }
  }
  return false;
}

function placeArchipelago(
  map: MapData,
  random: () => number,
  config: WorldConfig,
  safe: SafeZone | null
): void {
  const members = randomInt(random, config.archipelagoMinIslands, config.archipelagoMaxIslands);
  const maxDim = Math.max(config.islandMinDimension, config.archipelagoMaxDimension);

  // Primeira ilha define o "centro" do arquipélago
  let anchor: { col: number; row: number } | null = null;

  for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS && !anchor; attempt++) {
    const w = randomInt(random, config.islandMinDimension, maxDim);
    const h = randomInt(random, config.islandMinDimension, maxDim);
    const pos = randomPosition(map, random, config, w, h);
    if (!pos || intersectsSafe(map, pos.col, pos.row, w, h, safe)) continue;

    if (IslandGenerator.tryPlaceRect(map, pos.col, pos.row, w, h, config.islandSpacing)) {
      anchor = { col: pos.col + Math.floor(w / 2), row: pos.row + Math.floor(h / 2) };
    }
  }
  if (!anchor) return;

  // Demais ilhas nascem em volta da âncora, coladas pelo padding curto
  const spread = maxDim + ARCHIPELAGO_PADDING + 2;
  let placed = 1;

  for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS * 2 && placed < members; attempt++) {
    const w = randomInt(random, config.islandMinDimension, maxDim);
    const h = randomInt(random, config.islandMinDimension, maxDim);
    const col = anchor.col + randomInt(random, -spread, spread) - Math.floor(w / 2);
    const row = anchor.row + randomInt(random, -spread, spread) - Math.floor(h / 2);

    if (!insideMargins(map, config, col, row, w, h)) continue;
    if (intersectsSafe(map, col, row, w, h, safe)) continue;

    if (IslandGenerator.tryPlaceRect(map, col, row, w, h, ARCHIPELAGO_PADDING)) {
      placed++;
    }
  }
}

/** Posição aleatória respeitando a margem da borda do chunk (mantém rotas livres entre chunks). */
function randomPosition(
  map: MapData,
  random: () => number,
  config: WorldConfig,
  w: number,
  h: number
): { col: number; row: number } | null {
  const m = config.chunkEdgeMargin;
  const maxCol = map.cols - m - w;
  const maxRow = map.rows - m - h;
  if (maxCol < m || maxRow < m) return null;
  return { col: randomInt(random, m, maxCol), row: randomInt(random, m, maxRow) };
}

function insideMargins(
  map: MapData,
  config: WorldConfig,
  col: number,
  row: number,
  w: number,
  h: number
): boolean {
  const m = config.chunkEdgeMargin;
  return col >= m && row >= m && col + w <= map.cols - m && row + h <= map.rows - m;
}

function intersectsSafe(
  map: MapData,
  col: number,
  row: number,
  w: number,
  h: number,
  safe: SafeZone | null
): boolean {
  if (!safe) return false;
  const size = map.tileSize;
  // Distância do centro da zona segura ao retângulo da ilha (incluindo o anel)
  const nearestX = Math.max((col - 1) * size, Math.min(safe.x, (col + w + 1) * size));
  const nearestY = Math.max((row - 1) * size, Math.min(safe.y, (row + h + 1) * size));
  return Math.hypot(safe.x - nearestX, safe.y - nearestY) < safe.radius;
}

function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}
