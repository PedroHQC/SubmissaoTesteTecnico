// src/engine/rendering/water/WaterLayer.ts
import { Container, GlProgram, Mesh, MeshGeometry, Shader, Texture, UniformGroup } from 'pixi.js';

import {
  createShoreDistanceTexture,
  ShoreSourcePredicate,
  ShoreTileSource,
} from './ShoreDistanceField';
import { resolveWaterConfig, WaterConfig } from './WaterConfig';
import fragmentSource from './shaders/water.frag?raw';
import vertexSource from './shaders/water.vert?raw';

/** Região de tiles coberta pela água (MapData ou janela do mundo em chunks). */
export interface WaterRegionSource extends ShoreTileSource {
  readonly tileSize: number;
}

export interface WaterLayerOptions {
  /** Textura base da água (precisa ser seamless). */
  readonly texture: Texture;
  readonly config?: Partial<WaterConfig>;
  /** Quais tiles contam como terra para espuma/água rasa. */
  readonly isShoreSource?: ShoreSourcePredicate;
}

// Tempo volta a zero periodicamente para não perder precisão em float32 no shader
const TIME_WRAP_SECONDS = 3600;

/**
 * Alcance (em tiles) codificado no campo de distância: cobre a espuma e as zonas rasas das ilhas,
 * incluindo o quanto o noise pode empurrar o contorno.
 */
function shoreFieldRange(c: WaterConfig): number {
  const noiseReach = c.islandNoiseDistort * 0.5;
  return Math.max(
    c.shoreDistanceTiles,
    c.islandShallowRange + c.islandShallowSoftness + noiseReach,
    c.veryShallowRange + c.veryShallowSoftness + noiseReach
  );
}

/**
 * Água animada em um único draw call: um quad do tamanho do mapa com shader próprio.
 * Substitui a grade de sprites de água do TilemapLayer.
 *
 * Uso:
 *   const water = new WaterLayer({ texture });
 *   water.setMap(mapData);      // sempre que o mapa for (re)gerado
 *   water.update(deltaSeconds); // a cada frame
 */
export class WaterLayer extends Container {
  private config: WaterConfig;
  private map: WaterRegionSource | null = null;
  private readonly isShoreSource?: ShoreSourcePredicate;
  private readonly geometry: MeshGeometry;
  private readonly uniforms: UniformGroup;
  private readonly shader: Shader;
  private readonly mesh: Mesh<MeshGeometry, Shader>;

  private shoreTexture: Texture;
  private time = 0;

  constructor(options: WaterLayerOptions) {
    super();
    this.eventMode = 'none';
    this.config = resolveWaterConfig(options.config);
    this.isShoreSource = options.isShoreSource;

    // Textura dedicada à água: repetição feita pelo sampler (sem costuras de fract())
    options.texture.source.style.addressMode = 'repeat';
    options.texture.source.style.scaleMode = 'linear';

    // Placeholder 1x1 "mar aberto" até o primeiro setMap()
    this.shoreTexture = Texture.WHITE;

    this.uniforms = this.createUniforms();
    this.writeUniforms(this.config);
    this.shader = new Shader({
      glProgram: GlProgram.from({
        name: 'water-shader',
        vertex: vertexSource,
        fragment: fragmentSource,
        // mediump perde precisão com uTime alto e UVs grandes
        preferredFragmentPrecision: 'highp',
      }),
      resources: {
        waterUniforms: this.uniforms,
        uWaterTexture: options.texture.source,
        uShoreField: this.shoreTexture.source,
      },
    });

    this.geometry = new MeshGeometry({
      positions: new Float32Array(8),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    });

    this.mesh = new Mesh({ geometry: this.geometry, shader: this.shader });
    this.addChild(this.mesh);
  }

  /**
   * Ajusta o quad à região do mapa e regenera o campo de distância da costa.
   * `originX/Y` posicionam a região no mundo (pixels); 0,0 para um mapa fixo na tela.
   */
  public setMap(map: WaterRegionSource, originX = 0, originY = 0): void {
    this.map = map;
    const width = map.cols * map.tileSize;
    const height = map.rows * map.tileSize;
    const x1 = originX + width;
    const y1 = originY + height;

    this.geometry.positions = new Float32Array([
      originX,
      originY,
      x1,
      originY,
      x1,
      y1,
      originX,
      y1,
    ]);
    this.setVec2('uMapSize', width, height);
    this.setVec2('uRegionOrigin', originX, originY);
    this.rebuildShoreField(map);
  }

  public getConfig(): WaterConfig {
    return this.config;
  }

  /** Atualiza parâmetros em tempo real (usado pela GUI de debug). */
  public setConfig(overrides: Partial<WaterConfig>): void {
    const previous = this.config;
    this.config = { ...previous, ...overrides };
    this.writeUniforms(this.config);

    const shoreChanged =
      shoreFieldRange(previous) !== shoreFieldRange(this.config) ||
      previous.shoreFieldResolution !== this.config.shoreFieldResolution;
    if (shoreChanged && this.map) {
      this.rebuildShoreField(this.map);
    }
  }

  private rebuildShoreField(map: WaterRegionSource): void {
    const nextShore = createShoreDistanceTexture(map, {
      maxDistanceTiles: shoreFieldRange(this.config),
      resolution: this.config.shoreFieldResolution,
      isShoreSource: this.isShoreSource,
    });

    this.shader.resources.uShoreField = nextShore.source;
    this.releaseShoreTexture();
    this.shoreTexture = nextShore;
  }

  public update(deltaSeconds: number): void {
    this.time = (this.time + deltaSeconds) % TIME_WRAP_SECONDS;
    this.uniforms.uniforms.uTime = this.time;
  }

  public resetTime(): void {
    this.time = 0;
    this.uniforms.uniforms.uTime = 0;
  }

  public override destroy(options?: Parameters<Container['destroy']>[0]): void {
    // Mesh primeiro (desvincula geometria/shader), depois os recursos próprios.
    // O GlProgram é cacheado pelo Pixi e compartilhado entre cenas, então não é destruído.
    super.destroy(options);
    this.shader.destroy();
    this.geometry.destroy();
    this.releaseShoreTexture();
  }

  private releaseShoreTexture(): void {
    if (this.shoreTexture !== Texture.WHITE) {
      this.shoreTexture.destroy(true);
    }
  }

  private setVec2(name: string, x: number, y: number): void {
    const value = this.uniforms.uniforms[name] as Float32Array;
    value[0] = x;
    value[1] = y;
  }

  /** Cria o grupo com o layout de todos os uniforms; os valores vêm de writeUniforms(). */
  private createUniforms(): UniformGroup {
    const f32 = () => ({ value: 0, type: 'f32' as const });
    const vec2 = () => ({ value: new Float32Array(2), type: 'vec2<f32>' as const });
    const vec3 = () => ({ value: new Float32Array(3), type: 'vec3<f32>' as const });

    return new UniformGroup({
      uTime: f32(),
      uMapSize: { value: new Float32Array([1, 1]), type: 'vec2<f32>' as const },
      uRegionOrigin: { value: new Float32Array(2), type: 'vec2<f32>' as const },

      uDepthNoiseScale: f32(),
      uDepthNoiseDrift: vec2(),
      uDepthThreshold: f32(),
      uDepthSoftness: f32(),
      uDeepColor: vec3(),
      uShallowNoiseColor: vec3(),
      uDepthEdgeStrength: f32(),
      uDepthEdgeWidth: f32(),

      uShoreFieldRange: f32(),
      uShoreDistanceTiles: f32(),
      uIslandShallowStrength: f32(),
      uIslandShallowRange: f32(),
      uIslandShallowSoftness: f32(),
      uIslandNoiseDistort: f32(),
      uVeryShallowColor: vec3(),
      uVeryShallowStrength: f32(),
      uVeryShallowRange: f32(),
      uVeryShallowSoftness: f32(),
      uVeryShallowSurfaceFade: f32(),
      uSurfaceBlendMode: f32(),
      uSurfaceOpacityDeep: f32(),
      uSurfaceOpacityShallow: f32(),
      uSurfaceEnabled: f32(),

      uTextureScale: f32(),
      uScrollA: vec2(),
      uScrollB: vec2(),
      uDistortionStrength: f32(),
      uDistortionFrequency: f32(),
      uDistortionSpeed: f32(),
      uHighlightStrength: f32(),

      uDeepTint: vec3(),
      uShallowColor: vec3(),
      uShallowStrength: f32(),

      uFoamColor: vec3(),
      uFoamStrength: f32(),
      uFoamBands: f32(),
      uFoamSpeed: f32(),
      uFoamWidth: f32(),
    });
  }

  private writeUniforms(c: WaterConfig): void {
    const u = this.uniforms.uniforms;
    const vec = (name: string, v: readonly number[]) => (u[name] as Float32Array).set(v);

    u.uDepthNoiseScale = c.depthNoiseScale;
    vec('uDepthNoiseDrift', c.depthNoiseDrift);
    u.uDepthThreshold = c.depthThreshold;
    u.uDepthSoftness = c.depthSoftness;
    vec('uDeepColor', c.deepColor);
    vec('uShallowNoiseColor', c.shallowNoiseColor);
    u.uDepthEdgeStrength = c.depthEdgeStrength;
    u.uDepthEdgeWidth = c.depthEdgeWidth;

    u.uShoreFieldRange = shoreFieldRange(c);
    u.uShoreDistanceTiles = c.shoreDistanceTiles;
    u.uIslandShallowStrength = c.islandShallowStrength;
    u.uIslandShallowRange = c.islandShallowRange;
    u.uIslandShallowSoftness = c.islandShallowSoftness;
    u.uIslandNoiseDistort = c.islandNoiseDistort;
    vec('uVeryShallowColor', c.veryShallowColor);
    u.uVeryShallowStrength = c.veryShallowStrength;
    u.uVeryShallowRange = c.veryShallowRange;
    u.uVeryShallowSoftness = c.veryShallowSoftness;
    u.uVeryShallowSurfaceFade = c.veryShallowSurfaceFade;
    u.uSurfaceBlendMode = c.surfaceBlendMode;
    u.uSurfaceOpacityDeep = c.surfaceOpacityDeep;
    u.uSurfaceOpacityShallow = c.surfaceOpacityShallow;
    u.uSurfaceEnabled = c.surfaceEnabled ? 1 : 0;

    u.uTextureScale = c.textureScale;
    vec('uScrollA', c.scrollA);
    vec('uScrollB', c.scrollB);
    u.uDistortionStrength = c.distortionStrength;
    u.uDistortionFrequency = c.distortionFrequency;
    u.uDistortionSpeed = c.distortionSpeed;
    u.uHighlightStrength = c.highlightStrength;

    vec('uDeepTint', c.deepTint);
    vec('uShallowColor', c.shallowColor);
    u.uShallowStrength = c.shallowStrength;

    vec('uFoamColor', c.foamColor);
    u.uFoamStrength = c.foamStrength;
    u.uFoamBands = c.foamBands;
    u.uFoamSpeed = c.foamSpeed;
    u.uFoamWidth = c.foamWidth;
  }
}
