// src/engine/tiles/TileRegistry.ts
import { Texture } from 'pixi.js';
import { TileType } from './TileTypes';

export type IslandTileTextures = Record<
  | 'tl'
  | 'top1'
  | 'top2'
  | 'tr'
  | 'left1'
  | 'centerTL'
  | 'centerTR'
  | 'right1'
  | 'left2'
  | 'centerBL'
  | 'centerBR'
  | 'right2'
  | 'bl'
  | 'bottom1'
  | 'bottom2'
  | 'br',
  Texture
>;

export type IslandOuterTextures = Record<
  'tl' | 'top' | 'tr' | 'left' | 'center' | 'right' | 'bl' | 'bottom' | 'br',
  Texture
>;

export class TileRegistry {
  private readonly textures = new Map<TileType, Texture>();

  public register(type: TileType, texture: Texture): void {
    if (!texture) return;
    this.textures.set(type, texture);
  }

  public registerIsland4x4(textures: IslandTileTextures | undefined): void {
    if (!textures) return;
    this.register(TileType.ISLAND_TL, textures.tl);
    this.register(TileType.ISLAND_TOP1, textures.top1);
    this.register(TileType.ISLAND_TOP2, textures.top2);
    this.register(TileType.ISLAND_TR, textures.tr);
    this.register(TileType.ISLAND_LEFT1, textures.left1);
    this.register(TileType.ISLAND_CENTERTL, textures.centerTL);
    this.register(TileType.ISLAND_CENTERTR, textures.centerTR);
    this.register(TileType.ISLAND_RIGHT1, textures.right1);
    this.register(TileType.ISLAND_LEFT2, textures.left2);
    this.register(TileType.ISLAND_CENTERBL, textures.centerBL);
    this.register(TileType.ISLAND_CENTERBR, textures.centerBR);
    this.register(TileType.ISLAND_RIGHT2, textures.right2);
    this.register(TileType.ISLAND_BL, textures.bl);
    this.register(TileType.ISLAND_BOTTOM1, textures.bottom1);
    this.register(TileType.ISLAND_BOTTOM2, textures.bottom2);
    this.register(TileType.ISLAND_BR, textures.br);
  }

  public registerIslandOuter3x3(textures: IslandOuterTextures | undefined): void {
    if (!textures) return;
    this.register(TileType.ISLAND_OUTER_TL, textures.tl);
    this.register(TileType.ISLAND_OUTER_TOP, textures.top);
    this.register(TileType.ISLAND_OUTER_TR, textures.tr);
    this.register(TileType.ISLAND_OUTER_LEFT, textures.left);
    this.register(TileType.ISLAND_OUTER_CENTER, textures.center);
    this.register(TileType.ISLAND_OUTER_RIGHT, textures.right);
    this.register(TileType.ISLAND_OUTER_BL, textures.bl);
    this.register(TileType.ISLAND_OUTER_BOTTOM, textures.bottom);
    this.register(TileType.ISLAND_OUTER_BR, textures.br);
  }

  public getTexture(type: TileType): Texture | undefined {
    return this.textures.get(type);
  }
}
