// src/engine/tiles/IslandGenerator.ts
import { MapData } from './MapData';
import { TILE_FLIP_X, TILE_FLIP_Y, TileType } from './TileTypes';

export interface GenerationConfig {
  readonly islandCount: number;
  readonly safePlayerX: number;
  readonly safePlayerY: number;
  readonly safeRadius: number;
  readonly minDimension?: number;
  readonly maxDimension?: number;
  /** Fonte de aleatoriedade (0..1). Padrão: Math.random. Use uma seeded para geração determinística. */
  readonly random?: () => number;
}

export class IslandGenerator {
  public static generate(map: MapData, config: GenerationConfig): void {
    const {
      islandCount,
      safePlayerX,
      safePlayerY,
      safeRadius,
      minDimension = 4,
      maxDimension = 7,
      random = Math.random,
    } = config;

    let islandsPlaced = 0;
    let attempts = 0;
    const maxAttempts = 120;

    while (islandsPlaced < islandCount && attempts < maxAttempts) {
      attempts++;

      const width = Math.floor(random() * (maxDimension - minDimension + 1)) + minDimension;
      const height = Math.floor(random() * (maxDimension - minDimension + 1)) + minDimension;

      // Deixa espaço extra de 2 tiles para a borda outer e margem de navegação
      const maxCol = map.cols - width - 4;
      const maxRow = map.rows - height - 5;
      if (maxCol <= 3 || maxRow <= 3) continue;

      const startCol = Math.floor(random() * (maxCol - 3 + 1)) + 3;
      const startRow = Math.floor(random() * (maxRow - 3 + 1)) + 3;

      const islandCenterX = (startCol + width / 2) * map.tileSize;
      const islandCenterY = (startRow + height / 2) * map.tileSize;

      if (Math.hypot(islandCenterX - safePlayerX, islandCenterY - safePlayerY) < safeRadius) {
        continue;
      }

      // Máscara da ilha principal
      const mask = this.createRectMask(width, height);

      // Validação de espaço livre (incluindo o anel da borda outer)
      if (!this.canPlaceIsland(map, startCol, startRow, width, height)) {
        continue;
      }

      // 1. Aplica o miolo e bordas da ilha 4x4
      this.applyInnerIsland(map, mask, startCol, startRow, width, height);

      // 2. Aplica a borda externa 3x3 (island_outer) ao redor
      this.applyOuterBorder(map, mask, startCol, startRow, width, height);

      islandsPlaced++;
    }
  }

  private static createRectMask(w: number, h: number): boolean[][] {
    return Array.from({ length: h }, () => Array(w).fill(true));
  }

  /**
   * Tenta posicionar uma ilha retangular (miolo + anel outer) em (startCol, startRow).
   * Falha se o anel sair do mapa ou se houver terra a menos de `padding` tiles.
   */
  public static tryPlaceRect(
    map: MapData,
    startCol: number,
    startRow: number,
    w: number,
    h: number,
    padding = 3
  ): boolean {
    const ringFits =
      startCol >= 1 && startRow >= 1 && startCol + w < map.cols && startRow + h < map.rows;
    if (!ringFits || !this.canPlaceIsland(map, startCol, startRow, w, h, padding)) {
      return false;
    }

    const mask = this.createRectMask(w, h);
    this.applyInnerIsland(map, mask, startCol, startRow, w, h);
    this.applyOuterBorder(map, mask, startCol, startRow, w, h);
    return true;
  }

  private static canPlaceIsland(
    map: MapData,
    startCol: number,
    startRow: number,
    w: number,
    h: number,
    padding = 3
  ): boolean {
    for (let r = -padding; r < h + padding; r++) {
      for (let c = -padding; c < w + padding; c++) {
        if (map.isSolid(startCol + c, startRow + r)) {
          return false;
        }
      }
    }
    return true;
  }

  private static applyInnerIsland(
    map: MapData,
    mask: boolean[][],
    startCol: number,
    startRow: number,
    w: number,
    h: number
  ): void {
    const isLand = (c: number, r: number) => r >= 0 && r < h && c >= 0 && c < w && mask[r][c];

    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (!mask[r][c]) continue;

        const hasN = isLand(c, r - 1);
        const hasS = isLand(c, r + 1);
        const hasW = isLand(c - 1, r);
        const hasE = isLand(c + 1, r);

        let tile: TileType = TileType.WATER;
        let flags = 0;

        // Tiling espelhado (período 4): A, B, B espelhado, A espelhado.
        // O tileset tem degradê embutido; espelhar a cada bloco de 2 deixa as emendas contínuas.
        // Em ilhas 4x4 só ocorrem as fases 0 e 1, então o visual original não muda.
        const col = mirrorPhase(c);
        const row = mirrorPhase(r);

        // Cantos interiores
        if (!hasN && !hasW) tile = TileType.ISLAND_TL;
        else if (!hasN && !hasE) tile = TileType.ISLAND_TR;
        else if (!hasS && !hasW) tile = TileType.ISLAND_BL;
        else if (!hasS && !hasE) tile = TileType.ISLAND_BR;
        // Bordas
        else if (!hasN) {
          tile = col.first ? TileType.ISLAND_TOP1 : TileType.ISLAND_TOP2;
          flags = col.flipped ? TILE_FLIP_X : 0;
        } else if (!hasS) {
          tile = col.first ? TileType.ISLAND_BOTTOM1 : TileType.ISLAND_BOTTOM2;
          flags = col.flipped ? TILE_FLIP_X : 0;
        } else if (!hasW) {
          tile = row.first ? TileType.ISLAND_LEFT1 : TileType.ISLAND_LEFT2;
          flags = row.flipped ? TILE_FLIP_Y : 0;
        } else if (!hasE) {
          tile = row.first ? TileType.ISLAND_RIGHT1 : TileType.ISLAND_RIGHT2;
          flags = row.flipped ? TILE_FLIP_Y : 0;
        }
        // Centro
        else {
          tile = row.first
            ? col.first
              ? TileType.ISLAND_CENTERTL
              : TileType.ISLAND_CENTERTR
            : col.first
              ? TileType.ISLAND_CENTERBL
              : TileType.ISLAND_CENTERBR;
          flags = (col.flipped ? TILE_FLIP_X : 0) | (row.flipped ? TILE_FLIP_Y : 0);
        }

        map.setTile(startCol + c, startRow + r, tile, flags);
      }
    }
  }

  private static applyOuterBorder(
    map: MapData,
    mask: boolean[][],
    startCol: number,
    startRow: number,
    w: number,
    h: number
  ): void {
    const isLand = (c: number, r: number) => r >= 0 && r < h && c >= 0 && c < w && mask[r][c];

    // Percorre o anel imediatamente exterior (1 tile de distância)
    for (let r = -1; r <= h; r++) {
      for (let c = -1; c <= w; c++) {
        if (isLand(c, r)) continue;

        const hasN = isLand(c, r - 1);
        const hasS = isLand(c, r + 1);
        const hasW = isLand(c - 1, r);
        const hasE = isLand(c + 1, r);

        const hasNW = isLand(c - 1, r - 1);
        const hasNE = isLand(c + 1, r - 1);
        const hasSW = isLand(c - 1, r + 1);
        const hasSE = isLand(c + 1, r + 1);

        let outerTile: TileType = TileType.WATER;

        // 1. Cantos Exteriores Diagonais
        if (hasSE && !hasS && !hasE && !hasN && !hasW) outerTile = TileType.ISLAND_OUTER_TL;
        else if (hasSW && !hasS && !hasW && !hasN && !hasE) outerTile = TileType.ISLAND_OUTER_TR;
        else if (hasNE && !hasN && !hasE && !hasS && !hasW) outerTile = TileType.ISLAND_OUTER_BL;
        else if (hasNW && !hasN && !hasW && !hasS && !hasE) outerTile = TileType.ISLAND_OUTER_BR;

        // 2. Bordas Cardeais
        else if (hasS) outerTile = TileType.ISLAND_OUTER_TOP;
        else if (hasN) outerTile = TileType.ISLAND_OUTER_BOTTOM;
        else if (hasE) outerTile = TileType.ISLAND_OUTER_LEFT;
        else if (hasW) outerTile = TileType.ISLAND_OUTER_RIGHT;

        if (outerTile !== TileType.WATER) {
          map.setTile(startCol + c, startRow + r, outerTile);
        }
      }
    }
  }
}

/**
 * Fase do tiling espelhado para o índice local (a partir de 1, primeira célula após o canto).
 * Sequência: [A, B, B espelhado, A espelhado] — `first` escolhe A/B, `flipped` espelha.
 */
function mirrorPhase(index: number): { first: boolean; flipped: boolean } {
  const phase = (((index - 1) % 4) + 4) % 4;
  return { first: phase === 0 || phase === 3, flipped: phase >= 2 };
}
