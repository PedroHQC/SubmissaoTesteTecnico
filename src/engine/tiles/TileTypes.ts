// src/engine/tiles/TileTypes.ts

export const enum TileType {
  EMPTY = 0,
  WATER = 1,

  // Matriz da Ilha 4x4 (Ilha Interna)
  ISLAND_TL = 2,
  ISLAND_TOP1 = 3,
  ISLAND_TOP2 = 4,
  ISLAND_TR = 5,
  ISLAND_LEFT1 = 6,
  ISLAND_CENTERTL = 7,
  ISLAND_CENTERTR = 8,
  ISLAND_RIGHT1 = 9,
  ISLAND_LEFT2 = 10,
  ISLAND_CENTERBL = 11,
  ISLAND_CENTERBR = 12,
  ISLAND_RIGHT2 = 13,
  ISLAND_BL = 14,
  ISLAND_BOTTOM1 = 15,
  ISLAND_BOTTOM2 = 16,
  ISLAND_BR = 17,

  // Matriz da Borda Externa 3x3 (island_outer)
  ISLAND_OUTER_TL = 18,
  ISLAND_OUTER_TOP = 19,
  ISLAND_OUTER_TR = 20,
  ISLAND_OUTER_LEFT = 21,
  ISLAND_OUTER_CENTER = 22,
  ISLAND_OUTER_RIGHT = 23,
  ISLAND_OUTER_BL = 24,
  ISLAND_OUTER_BOTTOM = 25,
  ISLAND_OUTER_BR = 26,
}

export interface TileDefinition {
  readonly id: TileType;
  readonly isSolid: boolean;
}

export const TILE_DEFINITIONS: Record<TileType, TileDefinition> = {
  [TileType.EMPTY]: { id: TileType.EMPTY, isSolid: false },
  [TileType.WATER]: { id: TileType.WATER, isSolid: false },

  // Ilha interior (Sólida)
  [TileType.ISLAND_TL]: { id: TileType.ISLAND_TL, isSolid: true },
  [TileType.ISLAND_TOP1]: { id: TileType.ISLAND_TOP1, isSolid: true },
  [TileType.ISLAND_TOP2]: { id: TileType.ISLAND_TOP2, isSolid: true },
  [TileType.ISLAND_TR]: { id: TileType.ISLAND_TR, isSolid: true },
  [TileType.ISLAND_LEFT1]: { id: TileType.ISLAND_LEFT1, isSolid: true },
  [TileType.ISLAND_CENTERTL]: { id: TileType.ISLAND_CENTERTL, isSolid: true },
  [TileType.ISLAND_CENTERTR]: { id: TileType.ISLAND_CENTERTR, isSolid: true },
  [TileType.ISLAND_RIGHT1]: { id: TileType.ISLAND_RIGHT1, isSolid: true },
  [TileType.ISLAND_LEFT2]: { id: TileType.ISLAND_LEFT2, isSolid: true },
  [TileType.ISLAND_CENTERBL]: { id: TileType.ISLAND_CENTERBL, isSolid: true },
  [TileType.ISLAND_CENTERBR]: { id: TileType.ISLAND_CENTERBR, isSolid: true },
  [TileType.ISLAND_RIGHT2]: { id: TileType.ISLAND_RIGHT2, isSolid: true },
  [TileType.ISLAND_BL]: { id: TileType.ISLAND_BL, isSolid: true },
  [TileType.ISLAND_BOTTOM1]: { id: TileType.ISLAND_BOTTOM1, isSolid: true },
  [TileType.ISLAND_BOTTOM2]: { id: TileType.ISLAND_BOTTOM2, isSolid: true },
  [TileType.ISLAND_BR]: { id: TileType.ISLAND_BR, isSolid: true },

  // Borda Externa 3x3 (Também sólida para colisão e bloqueio de tiros)
  [TileType.ISLAND_OUTER_TL]: { id: TileType.ISLAND_OUTER_TL, isSolid: false },
  [TileType.ISLAND_OUTER_TOP]: { id: TileType.ISLAND_OUTER_TOP, isSolid: false },
  [TileType.ISLAND_OUTER_TR]: { id: TileType.ISLAND_OUTER_TR, isSolid: false },
  [TileType.ISLAND_OUTER_LEFT]: { id: TileType.ISLAND_OUTER_LEFT, isSolid: true },
  [TileType.ISLAND_OUTER_CENTER]: { id: TileType.ISLAND_OUTER_CENTER, isSolid: false },
  [TileType.ISLAND_OUTER_RIGHT]: { id: TileType.ISLAND_OUTER_RIGHT, isSolid: false },
  [TileType.ISLAND_OUTER_BL]: { id: TileType.ISLAND_OUTER_BL, isSolid: false },
  [TileType.ISLAND_OUTER_BOTTOM]: { id: TileType.ISLAND_OUTER_BOTTOM, isSolid: false },
  [TileType.ISLAND_OUTER_BR]: { id: TileType.ISLAND_OUTER_BR, isSolid: false },
};

export function isIslandBorder(type: TileType): boolean {
  return (
    type === TileType.ISLAND_TL ||
    type === TileType.ISLAND_TOP1 ||
    type === TileType.ISLAND_TOP2 ||
    type === TileType.ISLAND_TR ||
    type === TileType.ISLAND_LEFT1 ||
    type === TileType.ISLAND_LEFT2 ||
    type === TileType.ISLAND_RIGHT1 ||
    type === TileType.ISLAND_RIGHT2 ||
    type === TileType.ISLAND_BL ||
    type === TileType.ISLAND_BOTTOM1 ||
    type === TileType.ISLAND_BOTTOM2 ||
    type === TileType.ISLAND_BR
  );
}

/** Tiles de terra firme (miolo 4x4), sem o anel raso outer. */
export function isIslandInterior(type: TileType): boolean {
  return type >= TileType.ISLAND_TL && type <= TileType.ISLAND_BR;
}

/** Flags visuais de tile: espelhamento para quebrar a repetição do tileset. */
export const TILE_FLIP_X = 1;
export const TILE_FLIP_Y = 2;
