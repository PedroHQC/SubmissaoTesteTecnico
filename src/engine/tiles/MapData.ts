// src/engine/tiles/MapData.ts
import { TILE_DEFINITIONS, TileType } from './TileTypes';

export interface CollidableEntity {
  x: number;
  y: number;
  readonly radius: number;
}

export class MapData {
  public readonly cols: number;
  public readonly rows: number;
  public readonly tileSize: number;
  private readonly buffer: Uint8Array;
  /** Flags visuais por tile (TILE_FLIP_X / TILE_FLIP_Y). */
  private readonly flags: Uint8Array;

  constructor(cols: number, rows: number, tileSize: number = 32) {
    this.cols = cols;
    this.rows = rows;
    this.tileSize = tileSize;
    this.buffer = new Uint8Array(cols * rows);
    this.flags = new Uint8Array(cols * rows);
  }

  public getTile(col: number, row: number): TileType {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return TileType.EMPTY;
    }
    return this.buffer[row * this.cols + col] as TileType;
  }

  public setTile(col: number, row: number, type: TileType, flags = 0): void {
    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      this.buffer[row * this.cols + col] = type;
      this.flags[row * this.cols + col] = flags;
    }
  }

  /** Flags visuais do tile (espelhamento). 0 fora do mapa. */
  public getFlags(col: number, row: number): number {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return 0;
    }
    return this.flags[row * this.cols + col];
  }

  public fill(type: TileType): void {
    this.buffer.fill(type);
    this.flags.fill(0);
  }

  public isSolid(col: number, row: number): boolean {
    const tileType = this.getTile(col, row);
    return TILE_DEFINITIONS[tileType]?.isSolid ?? false;
  }

  /**
   * Checagem para Projéteis: Retorna true se qualquer parte do círculo encostar em terra
   */
  public isCircleColliding(x: number, y: number, radius: number): boolean {
    const minCol = Math.max(0, Math.floor((x - radius) / this.tileSize));
    const maxCol = Math.min(this.cols - 1, Math.floor((x + radius) / this.tileSize));
    const minRow = Math.max(0, Math.floor((y - radius) / this.tileSize));
    const maxRow = Math.min(this.rows - 1, Math.floor((y + radius) / this.tileSize));

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (!this.isSolid(c, r)) continue;

        const tileLeft = c * this.tileSize;
        const tileRight = tileLeft + this.tileSize;
        const tileTop = r * this.tileSize;
        const tileBottom = tileTop + this.tileSize;

        const nearestX = Math.max(tileLeft, Math.min(x, tileRight));
        const nearestY = Math.max(tileTop, Math.min(y, tileBottom));

        const dx = x - nearestX;
        const dy = y - nearestY;

        if (dx * dx + dy * dy < radius * radius) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Resolução para Navios: Empurra suavemente para fora da terra (permite deslizar na costa)
   */
  public resolveCircleCollision(entity: CollidableEntity): boolean {
    let hasCollided = false;

    // 2 iterações garantem estabilidade caso o navio colida na quina entre 2 tiles
    for (let iter = 0; iter < 2; iter++) {
      const minCol = Math.max(0, Math.floor((entity.x - entity.radius) / this.tileSize));
      const maxCol = Math.min(
        this.cols - 1,
        Math.floor((entity.x + entity.radius) / this.tileSize)
      );
      const minRow = Math.max(0, Math.floor((entity.y - entity.radius) / this.tileSize));
      const maxRow = Math.min(
        this.rows - 1,
        Math.floor((entity.y + entity.radius) / this.tileSize)
      );

      let passCollided = false;

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          if (!this.isSolid(c, r)) continue;

          const tileLeft = c * this.tileSize;
          const tileRight = tileLeft + this.tileSize;
          const tileTop = r * this.tileSize;
          const tileBottom = tileTop + this.tileSize;

          const nearestX = Math.max(tileLeft, Math.min(entity.x, tileRight));
          const nearestY = Math.max(tileTop, Math.min(entity.y, tileBottom));

          const dx = entity.x - nearestX;
          const dy = entity.y - nearestY;
          const distSq = dx * dx + dy * dy;

          if (distSq < entity.radius * entity.radius) {
            hasCollided = true;
            passCollided = true;
            const dist = Math.sqrt(distSq);

            if (dist > 0.0001) {
              const overlap = entity.radius - dist;
              entity.x += (dx / dist) * overlap;
              entity.y += (dy / dist) * overlap;
            } else {
              // Caso o centro esteja exatamente dentro do tile, empurra para a borda mais próxima
              const dLeft = Math.abs(entity.x - tileLeft);
              const dRight = Math.abs(tileRight - entity.x);
              const dTop = Math.abs(entity.y - tileTop);
              const dBottom = Math.abs(tileBottom - entity.y);

              const minD = Math.min(dLeft, dRight, dTop, dBottom);
              if (minD === dLeft) entity.x = tileLeft - entity.radius;
              else if (minD === dRight) entity.x = tileRight + entity.radius;
              else if (minD === dTop) entity.y = tileTop - entity.radius;
              else entity.y = tileBottom + entity.radius;
            }
          }
        }
      }

      if (!passCollided) break;
    }

    return hasCollided;
  }
  public hasLineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    let c0 = Math.floor(x0 / this.tileSize);
    let r0 = Math.floor(y0 / this.tileSize);
    const c1 = Math.floor(x1 / this.tileSize);
    const r1 = Math.floor(y1 / this.tileSize);

    const dx = Math.abs(c1 - c0);
    const dy = Math.abs(r1 - r0);
    const sx = c0 < c1 ? 1 : -1;
    const sy = r0 < r1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      // Se cruzou um tile sólido de ilha, a visão está bloqueada
      if (this.isSolid(c0, r0)) {
        return false;
      }

      if (c0 === c1 && r0 === r1) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        c0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        r0 += sy;
      }
    }

    return true;
  }
}
