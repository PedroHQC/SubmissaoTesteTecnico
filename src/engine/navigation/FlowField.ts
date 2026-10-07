import { isCircleCollidingTiles, isCirclePathClear } from '../tiles/TileCollision';

/** Grid shared by finite maps and windows into the streamed world. */
export interface FlowGrid {
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  isSolid(col: number, row: number): boolean;
}

const DC = [0, 0, -1, 1];
const DR = [-1, 1, 0, 0];
const UNREACHABLE = 65535;

/** One breadth-first route search shared by all enemies chasing the same target. */
export class FlowField {
  private readonly distances: Uint16Array;
  private readonly blocked: Uint8Array;
  private readonly queue: Int32Array;
  private lastTargetCol = -1;
  private lastTargetRow = -1;
  private terrainDirty = true;

  constructor(
    private readonly map: FlowGrid,
    // Largest enemy hull (26px) plus room to turn near shore.
    private readonly clearance = 38
  ) {
    const cells = map.cols * map.rows;
    this.distances = new Uint16Array(cells).fill(UNREACHABLE);
    this.blocked = new Uint8Array(cells);
    this.queue = new Int32Array(cells);
  }

  public invalidate(): void {
    this.terrainDirty = true;
  }

  public update(targetX: number, targetY: number): void {
    const { cols, rows, tileSize: size } = this.map;
    const col = Math.max(0, Math.min(cols - 1, Math.floor(targetX / size)));
    const row = Math.max(0, Math.min(rows - 1, Math.floor(targetY / size)));
    if (!this.terrainDirty && col === this.lastTargetCol && row === this.lastTargetRow) return;

    if (this.terrainDirty) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          this.blocked[r * cols + c] = Number(
            isCircleCollidingTiles(this.map, (c + 0.5) * size, (r + 0.5) * size, this.clearance)
          );
        }
      }
      this.terrainDirty = false;
    }
    this.lastTargetCol = col;
    this.lastTargetRow = row;
    this.distances.fill(UNREACHABLE);

    // The player can get closer to land than our padded navigation grid.
    let start = -1;
    let nearest = Infinity;
    for (let i = 0; i < this.blocked.length; i++) {
      if (this.blocked[i]) continue;
      const d = ((i % cols) - col) ** 2 + (Math.floor(i / cols) - row) ** 2;
      if (d < nearest) {
        nearest = d;
        start = i;
      }
    }
    if (start < 0) return;

    let head = 0;
    let tail = 0;
    this.distances[start] = 0;
    this.queue[tail++] = start;
    while (head < tail) {
      const current = this.queue[head++];
      const c = current % cols;
      const r = Math.floor(current / cols);
      for (let i = 0; i < 4; i++) {
        const nc = c + DC[i];
        const nr = r + DR[i];
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const next = nr * cols + nc;
        if (this.blocked[next] || this.distances[next] !== UNREACHABLE) continue;
        this.distances[next] = this.distances[current] + 1;
        this.queue[tail++] = next;
      }
    }
  }

  public getDirection(
    x: number,
    y: number,
    out: { dirX: number; dirY: number },
    radius = this.clearance - 10
  ): void {
    const { cols, rows, tileSize: size } = this.map;
    const c = Math.max(0, Math.min(cols - 1, Math.floor(x / size)));
    const r = Math.max(0, Math.min(rows - 1, Math.floor(y / size)));
    const current = this.distances[r * cols + c];
    let best = Infinity;
    out.dirX = out.dirY = 0;

    // Follow an actual descending route; a smoothed gradient can point into an island.
    const reach = current === UNREACHABLE ? 3 : 1;
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const nc = c + dx;
        const nr = r + dy;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const distance = this.distances[nr * cols + nc];
        if (distance === UNREACHABLE || (current > 0 && distance >= current)) continue;
        const tx = (nc + 0.5) * size;
        const ty = (nr + 0.5) * size;
        const score = distance + Math.hypot(tx - x, ty - y) / size;
        if (score >= best) continue;
        if (!isCirclePathClear(this.map, x, y, tx, ty, radius)) continue;
        best = score;
        const len = Math.hypot(tx - x, ty - y) || 1;
        out.dirX = (tx - x) / len;
        out.dirY = (ty - y) / len;
      }
    }
  }
}
