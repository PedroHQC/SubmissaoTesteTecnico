import { isCirclePathClear, SolidTileGrid } from '../tiles/TileCollision';

interface LaunchBody {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly hullRadius: number;
}

interface LaunchSource extends LaunchBody {
  readonly rotation: number;
}

/** Find a clear exit from the carrier's hull; never separate overlapping spawns by force. */
export function findChaserLaunch(
  source: LaunchSource,
  childHullRadius: number,
  terrain: SolidTileGrid,
  neighbors: readonly LaunchBody[],
  player: { readonly x: number; readonly y: number; readonly radius: number }
): { x: number; y: number; heading: number } | null {
  const distance = source.hullRadius + childHullRadius + 16;
  for (const offset of [0, 0.6, -0.6, 1.2, -1.2, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const heading = source.rotation + offset;
    const x = source.x - Math.sin(heading) * distance;
    const y = source.y + Math.cos(heading) * distance;
    if (!isCirclePathClear(terrain, source.x, source.y, x, y, childHullRadius + 6)) continue;
    if (Math.hypot(x - player.x, y - player.y) < childHullRadius + player.radius + 24) continue;
    if (
      neighbors.some(
        (other) => Math.hypot(x - other.x, y - other.y) < childHullRadius + other.hullRadius + 12
      )
    )
      continue;
    return { x, y, heading };
  }
  return null;
}
