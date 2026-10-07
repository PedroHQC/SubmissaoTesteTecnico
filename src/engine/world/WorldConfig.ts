// src/engine/world/WorldConfig.ts

export interface WorldConfig {
  /** Semente do mundo: o mesmo seed gera sempre as mesmas ilhas em cada chunk. */
  readonly seed: number;
  readonly tileSize: number;
  /** Lado do chunk em tiles. */
  readonly chunkTiles: number;

  // --- Streaming ---
  /** Anel de chunks além da tela mantido carregado (pré-geração antes de aparecer). */
  readonly loadMarginChunks: number;
  /** Anel extra antes de descarregar (histerese: evita gerar/destruir na borda). */
  readonly unloadMarginChunks: number;
  /** Limite de chunks gerados por frame (espalha o custo e evita travadas). */
  readonly maxChunkBuildsPerFrame: number;

  // --- Ilhas ---
  /** Quantidade de "features" (ilha única ou arquipélago) por chunk. */
  readonly islandsPerChunkMin: number;
  readonly islandsPerChunkMax: number;
  readonly islandMinDimension: number;
  readonly islandMaxDimension: number;
  /** Distância mínima (tiles de terra a terra) entre features diferentes: mantém rotas navegáveis. */
  readonly islandSpacing: number;
  /** Margem livre na borda de cada chunk, em tiles (rotas entre chunks). */
  readonly chunkEdgeMargin: number;
  /** Chance (0..1) de uma feature virar arquipélago. */
  readonly archipelagoChance: number;
  readonly archipelagoMinIslands: number;
  readonly archipelagoMaxIslands: number;
  /** Tamanho máximo de cada ilha do arquipélago. */
  readonly archipelagoMaxDimension: number;
  /** Raio sem ilhas em volta do spawn (centro do chunk 0,0), em pixels de mundo. */
  readonly spawnSafeRadius: number;

  // --- Visual ---
  /** Opacidade do anel raso (island_outer) em volta das ilhas. */
  readonly shelfAlpha: number;
}

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  seed: 2026,
  tileSize: 32,
  chunkTiles: 28,

  loadMarginChunks: 1,
  unloadMarginChunks: 2,
  maxChunkBuildsPerFrame: 2,

  islandsPerChunkMin: 1,
  islandsPerChunkMax: 2,
  islandMinDimension: 4,
  islandMaxDimension: 11,
  islandSpacing: 5,
  chunkEdgeMargin: 3,
  archipelagoChance: 0.35,
  archipelagoMinIslands: 2,
  archipelagoMaxIslands: 4,
  archipelagoMaxDimension: 6,
  spawnSafeRadius: 220,

  shelfAlpha: 1,
};
