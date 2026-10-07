// src/engine/tiles/TilemapLayer.ts
import { Container, Sprite } from 'pixi.js';
import { MapData } from './MapData';
import { TileRegistry } from './TileRegistry';
import { isIslandBorder, isIslandInterior, TILE_FLIP_X, TILE_FLIP_Y, TileType } from './TileTypes';

export interface TilemapLayerOptions {
  /**
   * Desenha a grade de sprites de água na camada base.
   * Desligue quando a água for renderizada por outra camada (ex.: WaterLayer).
   */
  readonly renderWater?: boolean;
}

export class TilemapLayer extends Container {
  private readonly renderWater: boolean;
  private readonly waterLayer: Container;
  private readonly underlayLayer: Container;
  /** Anel raso (island_outer) em camada própria para controlar a opacidade da costa. */
  private readonly shelfLayer: Container;
  private readonly mainLayer: Container;

  constructor(
    private readonly mapData: MapData,
    private readonly registry: TileRegistry,
    options: TilemapLayerOptions = {}
  ) {
    super();
    this.renderWater = options.renderWater ?? true;
    this.eventMode = 'none';

    // Criação dos sub-containers organizados por profundidade
    this.waterLayer = new Container();
    this.underlayLayer = new Container();
    this.shelfLayer = new Container();
    this.mainLayer = new Container();

    this.waterLayer.eventMode = 'none';
    this.underlayLayer.eventMode = 'none';
    this.shelfLayer.eventMode = 'none';
    this.mainLayer.eventMode = 'none';

    // Adiciona na ordem estrita de renderização (Z-Index natural)
    this.addChild(this.waterLayer);
    this.addChild(this.underlayLayer);
    this.addChild(this.shelfLayer);
    this.addChild(this.mainLayer);

    this.buildMap();
  }

  private buildMap(): void {
    this.waterLayer.removeChildren();
    this.underlayLayer.removeChildren();
    this.shelfLayer.removeChildren();
    this.mainLayer.removeChildren();

    const { cols, rows, tileSize } = this.mapData;
    const waterTexture = this.registry.getTexture(TileType.WATER);
    const outerCenterTexture = this.registry.getTexture(TileType.ISLAND_OUTER_CENTER);

    // 1. CAMADA BASE: Água em toda a extensão do mapa
    if (this.renderWater && waterTexture) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const waterSprite = new Sprite(waterTexture);
          waterSprite.width = tileSize;
          waterSprite.height = tileSize;
          waterSprite.position.set(c * tileSize, r * tileSize);
          waterSprite.eventMode = 'none';
          this.waterLayer.addChild(waterSprite);
        }
      }
    }

    // 2. SUBCAMADA: outer_center sob as bordas da ilha
    // Garante que a transparência das bordas revele o shelf/areia rasa
    if (outerCenterTexture) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const tileType = this.mapData.getTile(c, r);

          if (isIslandBorder(tileType)) {
            const underlaySprite = new Sprite(outerCenterTexture);
            underlaySprite.width = tileSize;
            underlaySprite.height = tileSize;
            underlaySprite.position.set(c * tileSize, r * tileSize);
            underlaySprite.eventMode = 'none';
            this.underlayLayer.addChild(underlaySprite);
          }
        }
      }
    }

    // 3. CAMADA PRINCIPAL: Anel outer 3x3 e tiles da Ilha 4x4
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tileType = this.mapData.getTile(c, r);

        // Água já foi preenchida na camada 1
        if (tileType === TileType.EMPTY || tileType === TileType.WATER) continue;

        const texture = this.registry.getTexture(tileType);
        if (!texture) continue;

        const tileSprite = new Sprite(texture);
        tileSprite.width = tileSize;
        tileSprite.height = tileSize;

        // Âncora no centro para o espelhamento (TILE_FLIP_X/Y) não deslocar o tile
        const flags = this.mapData.getFlags(c, r);
        tileSprite.anchor.set(0.5);
        if (flags & TILE_FLIP_X) tileSprite.scale.x *= -1;
        if (flags & TILE_FLIP_Y) tileSprite.scale.y *= -1;
        tileSprite.position.set((c + 0.5) * tileSize, (r + 0.5) * tileSize);
        tileSprite.eventMode = 'none';
        (isIslandInterior(tileType) ? this.mainLayer : this.shelfLayer).addChild(tileSprite);
      }
    }
  }

  /** Opacidade do anel raso em volta das ilhas (0..1). */
  public setShelfAlpha(alpha: number): void {
    this.shelfLayer.alpha = alpha;
    this.underlayLayer.alpha = alpha;
  }

  public rebuild(): void {
    this.buildMap();
  }
}
