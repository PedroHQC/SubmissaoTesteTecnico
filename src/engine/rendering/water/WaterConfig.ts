// src/engine/rendering/water/WaterConfig.ts

/** Cor RGB linear normalizada (0..1). */
export type RGB = readonly [number, number, number];

/** Vetor 2D em pixels por segundo. */
export type Vec2 = readonly [number, number];

/** Modos de mistura da superfície sobre a profundidade (valor enviado ao shader). */
export const SURFACE_BLEND_MODES = {
  Normal: 0,
  Multiply: 1,
  Screen: 2,
  Overlay: 3,
  'Soft Light': 4,
  'Detail (luminância)': 5,
} as const;

export type SurfaceBlendMode = (typeof SURFACE_BLEND_MODES)[keyof typeof SURFACE_BLEND_MODES];

/**
 * Parâmetros artísticos do shader de água.
 * Todos os valores espaciais estão em pixels de mundo, e os temporais em segundos.
 */
export interface WaterConfig {
  // --- Profundidade (noise procedural sob a superfície) ---
  /** Tamanho em pixels de mundo de uma célula do noise (oitava base). */
  readonly depthNoiseScale: number;
  /** Deriva lenta do noise. */
  readonly depthNoiseDrift: Vec2;
  /** Valor do noise (0..1) que separa fundo e raso. */
  readonly depthThreshold: number;
  /** Largura do gradiente de transição em torno do threshold. */
  readonly depthSoftness: number;
  readonly deepColor: RGB;
  readonly shallowNoiseColor: RGB;
  /** Brilho da borda (contorno) entre raso e fundo. */
  readonly depthEdgeStrength: number;
  readonly depthEdgeWidth: number;

  // --- Raso em volta das ilhas (usa o campo de distância da costa) ---
  /** Força do raso das ilhas (0..1); combina com o raso do noise por max(). */
  readonly islandShallowStrength: number;
  /** Alcance do raso a partir da ilha, em tiles. */
  readonly islandShallowRange: number;
  /** Suavidade da transição do raso, em tiles. */
  readonly islandShallowSoftness: number;
  /** Quanto o noise de profundidade ondula o contorno, em tiles. */
  readonly islandNoiseDistort: number;
  /** Cor da faixa "muito rasa" colada na ilha. */
  readonly veryShallowColor: RGB;
  readonly veryShallowStrength: number;
  /** Alcance da faixa muito rasa, em tiles. */
  readonly veryShallowRange: number;
  readonly veryShallowSoftness: number;
  /** Quanto a faixa muito rasa apaga a superfície texturizada (0..1). */
  readonly veryShallowSurfaceFade: number;

  // --- Composição superfície × profundidade ---
  /** Como a superfície se combina com a cor da profundidade. */
  readonly surfaceBlendMode: SurfaceBlendMode;
  /** Opacidade da superfície sobre a água funda (0 = só profundidade, 1 = mistura total). */
  readonly surfaceOpacityDeep: number;
  /** Opacidade da superfície sobre a água rasa do noise. */
  readonly surfaceOpacityShallow: number;

  // --- Superfície (textura base em duas camadas) ---
  /** Liga/desliga a camada de superfície texturizada (desligada = só o noise de profundidade). */
  readonly surfaceEnabled: boolean;
  /** Tamanho em pixels de mundo de uma repetição da textura base. */
  readonly textureScale: number;
  /** Velocidade de rolagem da camada A. */
  readonly scrollA: Vec2;
  /** Velocidade de rolagem da camada B (girada e reescalada para quebrar a repetição). */
  readonly scrollB: Vec2;
  /** Distorção senoidal de UV (em UV da textura). */
  readonly distortionStrength: number;
  /** Frequência espacial da distorção (radianos por pixel). */
  readonly distortionFrequency: number;
  /** Velocidade da distorção. */
  readonly distortionSpeed: number;
  /** Intensidade do brilho onde as cristas das duas camadas coincidem. */
  readonly highlightStrength: number;

  // --- Cor ---
  /** Multiplicador de cor da superfície texturizada. */
  readonly deepTint: RGB;
  /** Cor da água rasa perto da costa. */
  readonly shallowColor: RGB;
  /** Quanto a água rasa substitui a cor base (0..1). */
  readonly shallowStrength: number;

  // --- Costa / espuma ---
  /** Alcance do campo de distância da costa, em tiles. */
  readonly shoreDistanceTiles: number;
  /** Subdivisões por tile do campo de distância (resolução da textura). */
  readonly shoreFieldResolution: number;
  readonly foamColor: RGB;
  readonly foamStrength: number;
  /** Quantidade de faixas de espuma ao longo do alcance da costa. */
  readonly foamBands: number;
  /** Velocidade das faixas indo em direção à costa (faixas por segundo). */
  readonly foamSpeed: number;
  /** Espessura relativa de cada faixa (0..1). */
  readonly foamWidth: number;
}

export const DEFAULT_WATER_CONFIG: WaterConfig = {
  depthNoiseScale: 644,
  depthNoiseDrift: [0, 0],
  depthThreshold: 0.485,
  depthSoftness: 0.187,
  deepColor: [0.0, 0.314, 0.459],
  shallowNoiseColor: [0.035, 0.678, 0.808],
  depthEdgeStrength: 0.02,
  depthEdgeWidth: 0.2,

  islandShallowStrength: 1,
  islandShallowRange: 2,
  islandShallowSoftness: 0.8,
  islandNoiseDistort: 1.5,
  veryShallowColor: [0.42, 0.86, 0.9],
  veryShallowStrength: 0.7,
  veryShallowRange: 0.9,
  veryShallowSoftness: 0.5,
  veryShallowSurfaceFade: 0.6,

  surfaceBlendMode: SURFACE_BLEND_MODES.Overlay,
  surfaceOpacityDeep: 0.62,
  surfaceOpacityShallow: 0.36,

  surfaceEnabled: true,
  textureScale: 299,
  scrollA: [12.5, 26.2],
  scrollB: [0, 0],
  distortionStrength: 0.082,
  distortionFrequency: 0.003,
  distortionSpeed: 0,
  highlightStrength: 0.4,

  deepTint: [0.384, 0.698, 0.894],
  shallowColor: [0.384, 0.698, 0.894],
  shallowStrength: 0.55,

  shoreDistanceTiles: 3.5,
  shoreFieldResolution: 4,
  foamColor: [0.663, 0.929, 0.996],
  foamStrength: 0.66,
  foamBands: 1.7,
  foamSpeed: 0.23,
  foamWidth: 0.15,
};

/** Mescla parâmetros parciais sobre os valores padrão. */
export function resolveWaterConfig(overrides: Partial<WaterConfig> = {}): WaterConfig {
  return { ...DEFAULT_WATER_CONFIG, ...overrides };
}
