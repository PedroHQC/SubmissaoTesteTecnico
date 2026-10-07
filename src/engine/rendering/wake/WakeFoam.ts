// src/engine/rendering/wake/WakeFoam.ts
import { Particle, ParticleContainer, Texture } from 'pixi.js';
import { WakeConfig } from './WakeConfig';

interface FoamState {
  particle: Particle;
  vx: number;
  vy: number;
  spin: number;
  age: number;
  life: number;
  strength: number;
  /** Variação de tamanho por quad (0.75..1.25) para não ficarem idênticos. */
  sizeJitter: number;
}

/**
 * Quads auxiliares de espuma em um ParticleContainer (1 draw call, sem hierarquia de Sprites).
 * Nascem nas laterais do casco, se afastam do eixo do barco, crescem e esmaecem.
 * Os quads mortos voltam para um pool; nada é alocado depois do aquecimento.
 */
export class WakeFoam {
  public readonly container: ParticleContainer;

  private readonly active: FoamState[] = [];
  private readonly pool: FoamState[] = [];
  private texture: Texture;
  private textureSize = 1;

  constructor(texture: Texture) {
    this.texture = texture;
    this.textureSize = Math.max(1, Math.max(texture.width, texture.height));
    this.container = new ParticleContainer({
      texture,
      dynamicProperties: { position: true, scale: true, rotation: true, color: true },
    });
    this.container.eventMode = 'none';
  }

  public get activeCount(): number {
    return this.active.length;
  }

  public setTexture(texture: Texture): void {
    this.texture = texture;
    this.textureSize = Math.max(1, Math.max(texture.width, texture.height));
    this.container.texture = texture;
    for (const state of this.active) state.particle.texture = texture;
    for (const state of this.pool) state.particle.texture = texture;
  }

  /**
   * Nasce um quad em (x, y) que se afasta na direção (dirX, dirY).
   * `strength` (0..1) escala opacidade e velocidade de afastamento.
   */
  public spawn(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    strength: number,
    config: WakeConfig
  ): void {
    if (this.active.length >= config.foamMaxParticles) return;

    const state = this.pool.pop() ?? this.createState();
    const drift = config.foamDrift * (0.6 + 0.4 * strength) * (0.7 + Math.random() * 0.6);

    state.vx = dirX * drift;
    state.vy = dirY * drift;
    state.spin = (Math.random() - 0.5) * 1.2;
    state.age = 0;
    state.life = config.foamLifetime * (0.8 + Math.random() * 0.4);
    state.strength = strength;
    state.sizeJitter = 0.75 + Math.random() * 0.5;

    const p = state.particle;
    p.x = x;
    p.y = y;
    p.rotation = Math.random() * Math.PI * 2;
    p.alpha = 0;
    p.tint = config.foamTint;

    this.active.push(state);
    this.container.addParticle(p);
  }

  public update(dtSeconds: number, config: WakeConfig): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const state = this.active[i];
      state.age += dtSeconds;

      if (state.age >= state.life) {
        this.release(i);
        continue;
      }

      const t = state.age / state.life;
      const p = state.particle;

      // Desacelera ao se afastar (arrasto da água)
      const damping = Math.pow(0.15, dtSeconds);
      state.vx *= damping;
      state.vy *= damping;
      p.x += state.vx * dtSeconds;
      p.y += state.vy * dtSeconds;
      p.rotation += state.spin * dtSeconds;

      const size =
        (config.foamStartSize + (config.foamEndSize - config.foamStartSize) * t) * state.sizeJitter;
      const scale = size / this.textureSize;
      p.scaleX = scale;
      p.scaleY = scale;

      // Fade-in rápido (primeiros 15%) e fade-out suave
      const fadeIn = Math.min(1, t / 0.15);
      const fadeOut = 1 - t;
      p.alpha = config.foamOpacity * state.strength * fadeIn * fadeOut * fadeOut;
    }
  }

  public clear(): void {
    while (this.active.length > 0) this.release(this.active.length - 1);
  }

  public destroy(): void {
    this.active.length = 0;
    this.pool.length = 0;
    this.container.destroy();
  }

  private createState(): FoamState {
    return {
      particle: new Particle({ texture: this.texture, anchorX: 0.5, anchorY: 0.5 }),
      vx: 0,
      vy: 0,
      spin: 0,
      age: 0,
      life: 1,
      strength: 1,
      sizeJitter: 1,
    };
  }

  private release(index: number): void {
    const state = this.active[index];
    // Remoção O(1): troca com o último
    this.active[index] = this.active[this.active.length - 1];
    this.active.pop();
    this.container.removeParticle(state.particle);
    this.pool.push(state);
  }
}
