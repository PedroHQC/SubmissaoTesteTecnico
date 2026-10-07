// src/engine/rendering/water/index.ts
export { WaterLayer } from './WaterLayer';
export type { WaterLayerOptions, WaterRegionSource } from './WaterLayer';
export { DEFAULT_WATER_CONFIG, resolveWaterConfig } from './WaterConfig';
export type { RGB, Vec2, WaterConfig } from './WaterConfig';
export { createShoreDistanceTexture } from './ShoreDistanceField';
export type {
  ShoreFieldOptions,
  ShoreSourcePredicate,
  ShoreTileSource,
} from './ShoreDistanceField';
export { attachWaterDebugGui } from './debug/WaterDebugGui';
