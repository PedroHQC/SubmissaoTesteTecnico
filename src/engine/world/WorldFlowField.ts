// src/engine/world/WorldFlowField.ts
import { FlowField, FlowGrid } from '../navigation/FlowField';
import { ChunkedWorld } from './ChunkedWorld';

/**
 * Flow field numa janela de tiles centrada no alvo (player), sobre o mundo infinito.
 * A janela recentra quando o alvo se afasta do centro; fora dela a direção é (0, 0)
 * e quem consulta deve cair na perseguição direta.
 */
export class WorldFlowField {
  private field: FlowField | null = null;
  private originCol = 0;
  private originRow = 0;
  private revision = -1;

  constructor(
    private readonly world: ChunkedWorld,
    /** Lado da janela em tiles (cobre a área onde os inimigos navegam). */
    private readonly windowTiles = 72,
    /** Distância do centro (tiles) que dispara o recentro. */
    private readonly recenterTiles = 14,
    private readonly clearance = 38
  ) {}

  public update(targetX: number, targetY: number): void {
    const size = this.world.tileSize;
    const targetCol = Math.floor(targetX / size);
    const targetRow = Math.floor(targetY / size);
    const half = Math.floor(this.windowTiles / 2);

    const centerCol = this.originCol + half;
    const centerRow = this.originRow + half;
    const needsRecenter =
      !this.field ||
      Math.abs(targetCol - centerCol) > this.recenterTiles ||
      Math.abs(targetRow - centerRow) > this.recenterTiles;

    if (needsRecenter) {
      this.originCol = targetCol - half;
      this.originRow = targetRow - half;
      this.field = new FlowField(this.createGrid(), this.clearance);
    }

    if (this.revision !== this.world.chunkRevision) {
      this.field!.invalidate();
      this.revision = this.world.chunkRevision;
    }
    this.field!.update(targetX - this.originCol * size, targetY - this.originRow * size);
  }

  public getDirection(
    x: number,
    y: number,
    out: { dirX: number; dirY: number },
    radius?: number
  ): void {
    const size = this.world.tileSize;
    const localX = x - this.originCol * size;
    const localY = y - this.originRow * size;
    const extent = this.windowTiles * size;

    if (!this.field || localX < 0 || localY < 0 || localX >= extent || localY >= extent) {
      out.dirX = 0;
      out.dirY = 0;
      return;
    }

    this.field.getDirection(localX, localY, out, radius);
  }

  private createGrid(): FlowGrid {
    const world = this.world;
    const originCol = this.originCol;
    const originRow = this.originRow;
    return {
      cols: this.windowTiles,
      rows: this.windowTiles,
      tileSize: world.tileSize,
      isSolid: (col, row) => world.isSolid(originCol + col, originRow + row),
    };
  }
}
