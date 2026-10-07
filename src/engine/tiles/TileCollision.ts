// src/engine/tiles/TileCollision.ts

/** Qualquer grade que saiba dizer se um tile é sólido (MapData, mundo em chunks...). */
export interface SolidTileGrid {
  readonly tileSize: number;
  /** Deve retornar false fora dos limites da grade. */
  isSolid(col: number, row: number): boolean;
}

export interface CollidableEntity {
  x: number;
  y: number;
  readonly radius: number;
}

/** Sweeps the hull so thin islands and corners are detected. */
export function isCirclePathClear(
  grid: SolidTileGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number
): boolean {
  const distance = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(distance / (grid.tileSize / 4)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (isCircleCollidingTiles(grid, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius)) {
      return false;
    }
  }
  return true;
}

/** Retorna true se qualquer parte do círculo encostar em um tile sólido. */
export function isCircleCollidingTiles(
  grid: SolidTileGrid,
  x: number,
  y: number,
  radius: number
): boolean {
  const size = grid.tileSize;
  const minCol = Math.floor((x - radius) / size);
  const maxCol = Math.floor((x + radius) / size);
  const minRow = Math.floor((y - radius) / size);
  const maxRow = Math.floor((y + radius) / size);

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      if (!grid.isSolid(c, r)) continue;

      const nearestX = Math.max(c * size, Math.min(x, c * size + size));
      const nearestY = Math.max(r * size, Math.min(y, r * size + size));
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
 * Empurra o círculo para fora dos tiles sólidos (permite deslizar na costa).
 * 2 iterações garantem estabilidade na quina entre 2 tiles.
 */
export function resolveCircleVsTiles(grid: SolidTileGrid, entity: CollidableEntity): boolean {
  const size = grid.tileSize;
  let hasCollided = false;

  for (let iter = 0; iter < 2; iter++) {
    const minCol = Math.floor((entity.x - entity.radius) / size);
    const maxCol = Math.floor((entity.x + entity.radius) / size);
    const minRow = Math.floor((entity.y - entity.radius) / size);
    const maxRow = Math.floor((entity.y + entity.radius) / size);

    let passCollided = false;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (!grid.isSolid(c, r)) continue;

        const tileLeft = c * size;
        const tileRight = tileLeft + size;
        const tileTop = r * size;
        const tileBottom = tileTop + size;

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
            // Centro dentro do tile: empurra para a borda mais próxima
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
