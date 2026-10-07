// src/engine/rendering/wake/WakeTrail.ts
import { Color, Geometry, GlProgram, Mesh, Shader, Texture, UniformGroup } from 'pixi.js';
import { WakeConfig } from './WakeConfig';
import fragmentSource from './shaders/wake.frag?raw';
import vertexSource from './shaders/wake.vert?raw';

/** Capacidade do ring de pontos (vida × velocidade / espaçamento com folga). */
const MAX_POINTS = 256;
/** +1 para o ponto "vivo" que acompanha a popa a cada frame. */
const MAX_VERTS = (MAX_POINTS + 1) * 2;

/**
 * Line renderer custom: uma faixa triangulada (triangle list) atrás do barco.
 *
 * Cada ponto guarda posição, idade, odômetro e intensidade. A cada frame a malha é
 * reconstruída em buffers pré-alocados (sem alocação/GC):
 * - largura abre com a idade (o rastro se espalha);
 * - alpha esmaece com a idade e faz fade-in perto da popa;
 * - v = odômetro / comprimento da textura → padrão ancorado na água, não no barco.
 * Vértices não usados viram triângulos degenerados com alpha 0.
 */
export class WakeTrail {
  public readonly mesh: Mesh<Geometry, Shader>;

  // Pontos (mais antigo no índice 0)
  private readonly px = new Float32Array(MAX_POINTS);
  private readonly py = new Float32Array(MAX_POINTS);
  private readonly age = new Float32Array(MAX_POINTS);
  private readonly odometer = new Float32Array(MAX_POINTS);
  private readonly strength = new Float32Array(MAX_POINTS);
  private count = 0;

  // Buffers da malha
  private readonly positions = new Float32Array(MAX_VERTS * 2);
  private readonly uvs = new Float32Array(MAX_VERTS * 2);
  private readonly alphas = new Float32Array(MAX_VERTS);
  private readonly geometry: Geometry;
  private readonly uniforms: UniformGroup;
  private readonly shader: Shader;

  private scroll = 0;
  private lastTint = -1;

  constructor(texture: Texture) {
    this.geometry = new Geometry({
      attributes: {
        aPosition: { buffer: this.positions, format: 'float32x2' },
        aUV: { buffer: this.uvs, format: 'float32x2' },
        aAlpha: { buffer: this.alphas, format: 'float32' },
      },
      indexBuffer: buildStripIndices(MAX_POINTS + 1),
    });

    this.uniforms = new UniformGroup({
      uTint: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
      uOpacity: { value: 1, type: 'f32' },
      uScroll: { value: 0, type: 'f32' },
    });

    this.shader = new Shader({
      glProgram: GlProgram.from({
        name: 'wake-trail-shader',
        vertex: vertexSource,
        fragment: fragmentSource,
        preferredFragmentPrecision: 'highp',
      }),
      resources: {
        wakeUniforms: this.uniforms,
        uTexture: texture.source,
      },
    });

    this.mesh = new Mesh({ geometry: this.geometry, shader: this.shader });
    this.mesh.eventMode = 'none';
    this.setTexture(texture);
  }

  public get pointCount(): number {
    return this.count;
  }

  public setTexture(texture: Texture): void {
    // Repete ao longo do rastro (v); através (u) fica preso na borda
    texture.source.style.addressModeU = 'clamp-to-edge';
    texture.source.style.addressModeV = 'repeat';
    texture.source.style.scaleMode = 'linear';
    this.shader.resources.uTexture = texture.source;
  }

  /** Adiciona um ponto na posição atual da popa. */
  public addPoint(x: number, y: number, odometer: number, strength: number): void {
    if (this.count === MAX_POINTS) this.dropOldest(1);
    const i = this.count++;
    this.px[i] = x;
    this.py[i] = y;
    this.age[i] = 0;
    this.odometer[i] = odometer;
    this.strength[i] = strength;
  }

  /**
   * Envelhece os pontos, remove os expirados e reconstrói a malha.
   * (headX, headY) é a popa agora: conecta o rastro ao casco sem degrau.
   */
  public update(
    dtSeconds: number,
    headX: number,
    headY: number,
    headOdometer: number,
    headStrength: number,
    config: WakeConfig
  ): void {
    const life = Math.max(0.01, config.trailLifetime);

    for (let i = 0; i < this.count; i++) this.age[i] += dtSeconds;
    let expired = 0;
    while (expired < this.count && this.age[expired] >= life) expired++;
    if (expired > 0) this.dropOldest(expired);

    this.scroll = (this.scroll + config.trailTextureScroll * dtSeconds) % 1;
    this.writeUniforms(config);
    this.buildMesh(headX, headY, headOdometer, headStrength, life, config);
  }

  public clear(): void {
    this.count = 0;
  }

  public destroy(): void {
    this.mesh.destroy();
    this.shader.destroy();
    this.geometry.destroy();
  }

  private dropOldest(n: number): void {
    const remaining = this.count - n;
    this.px.copyWithin(0, n, this.count);
    this.py.copyWithin(0, n, this.count);
    this.age.copyWithin(0, n, this.count);
    this.odometer.copyWithin(0, n, this.count);
    this.strength.copyWithin(0, n, this.count);
    this.count = Math.max(0, remaining);
  }

  private writeUniforms(config: WakeConfig): void {
    const u = this.uniforms.uniforms;
    if (config.trailTint !== this.lastTint) {
      const tint = new Color(config.trailTint);
      (u.uTint as Float32Array).set([tint.red, tint.green, tint.blue]);
      this.lastTint = config.trailTint;
    }
    u.uOpacity = config.trailOpacity;
    u.uScroll = this.scroll;
  }

  private buildMesh(
    headX: number,
    headY: number,
    headOdometer: number,
    headStrength: number,
    life: number,
    config: WakeConfig
  ): void {
    const total = this.count + 1; // pontos + cabeça viva
    const texLength = config.trailTextureLength;
    // Subtrai a parte inteira para manter v pequeno (precisão) sem mudar a repetição
    const vBase = texLength > 0 ? Math.floor(headOdometer / texLength) : 0;

    for (let i = 0; i < total; i++) {
      const isHead = i === this.count;
      const x = isHead ? headX : this.px[i];
      const y = isHead ? headY : this.py[i];
      const odo = isHead ? headOdometer : this.odometer[i];
      const strength = isHead ? headStrength : this.strength[i];
      const t = isHead ? 0 : Math.min(1, this.age[i] / life);

      // Direção suavizada pelos vizinhos → normal da faixa
      const prev = Math.max(0, i - 1);
      const next = Math.min(total - 1, i + 1);
      let dx = this.pointX(next, headX) - this.pointX(prev, headX);
      let dy = this.pointY(next, headY) - this.pointY(prev, headY);
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;

      const halfWidth =
        0.5 * (config.trailStartWidth + (config.trailEndWidth - config.trailStartWidth) * t);
      const nx = -dy * halfWidth;
      const ny = dx * halfWidth;

      const headFade =
        config.trailHeadFade > 0 ? Math.min(1, (headOdometer - odo) / config.trailHeadFade) : 1;
      const alpha = Math.pow(1 - t, config.trailFadePower) * strength * headFade;

      const v =
        texLength > 0 ? odo / texLength - vBase : (headOdometer - odo) / Math.max(1, headOdometer);

      this.writeVertex(i * 2, x + nx, y + ny, 0, v, alpha);
      this.writeVertex(i * 2 + 1, x - nx, y - ny, 1, v, alpha);
    }

    // Degenerados: colapsa o resto na cabeça, invisível
    for (let i = total; i < MAX_POINTS + 1; i++) {
      this.writeVertex(i * 2, headX, headY, 0, 0, 0);
      this.writeVertex(i * 2 + 1, headX, headY, 1, 0, 0);
    }

    this.geometry.getBuffer('aPosition').update();
    this.geometry.getBuffer('aUV').update();
    this.geometry.getBuffer('aAlpha').update();
  }

  private pointX(i: number, headX: number): number {
    return i === this.count ? headX : this.px[i];
  }

  private pointY(i: number, headY: number): number {
    return i === this.count ? headY : this.py[i];
  }

  private writeVertex(index: number, x: number, y: number, u: number, v: number, a: number): void {
    this.positions[index * 2] = x;
    this.positions[index * 2 + 1] = y;
    this.uvs[index * 2] = u;
    this.uvs[index * 2 + 1] = v;
    this.alphas[index] = a;
  }
}

/** Índices de uma faixa com `points` pares de vértices (2 triângulos por segmento). */
function buildStripIndices(points: number): Uint32Array {
  const indices = new Uint32Array((points - 1) * 6);
  for (let i = 0; i < points - 1; i++) {
    const a = i * 2;
    const o = i * 6;
    indices[o] = a;
    indices[o + 1] = a + 1;
    indices[o + 2] = a + 2;
    indices[o + 3] = a + 1;
    indices[o + 4] = a + 3;
    indices[o + 5] = a + 2;
  }
  return indices;
}
