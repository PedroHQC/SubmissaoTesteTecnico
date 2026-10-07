// src/engine/rendering/wake/WakeEffect.ts
import { Container } from 'pixi.js';
import { DEFAULT_WAKE_CONFIG, WakeConfig } from './WakeConfig';
import { WakeFoam } from './WakeFoam';
import { WakeTrail } from './WakeTrail';
import {
  createPlaceholderFoamTexture,
  createPlaceholderTrailTexture,
  loadOptionalTexture,
  WAKE_TEXTURE_PATHS,
} from './wakeTextures';

/** O que o rastro precisa saber do barco a cada frame. */
export interface WakeEmitter {
  readonly x: number;
  readonly y: number;
  /** Convenção do Player: rotation 0 = proa para +Y. */
  readonly rotation: number;
  /** Velocidade em px/frame. */
  readonly vx: number;
  readonly vy: number;
}

// Deslocamento maior que isso num frame é teleporte (respawn): limpa o rastro
const TELEPORT_DISTANCE = 200;

/**
 * Rastro do barco na água: trilha triangulada + quads de espuma.
 *
 * Uso:
 *   const wake = new WakeEffect();
 *   worldLayer.addChild(water, wake.view, islands, player);  // acima da água, abaixo do resto
 *   wake.update(emitter, deltaSeconds);                      // a cada frame
 *
 * Texturas: usa placeholders procedurais e troca automaticamente pelas finais
 * (WAKE_TEXTURE_PATHS) se os arquivos existirem.
 */
export class WakeEffect {
  public readonly view = new Container();
  public readonly config: WakeConfig;

  private readonly trail: WakeTrail;
  private readonly foam: WakeFoam;

  private odometer = 0;
  private lastPointOdometer = 0;
  private lastFoamOdometer = 0;
  private sternX = 0;
  private sternY = 0;
  private hasStern = false;
  private destroyed = false;

  constructor(config: Partial<WakeConfig> = {}) {
    this.config = { ...DEFAULT_WAKE_CONFIG, ...config };
    this.view.eventMode = 'none';

    this.trail = new WakeTrail(createPlaceholderTrailTexture());
    this.foam = new WakeFoam(createPlaceholderFoamTexture());
    this.view.addChild(this.trail.mesh, this.foam.container);

    void this.loadFinalTextures();
  }

  public get stats(): { trailPoints: number; foamQuads: number } {
    return { trailPoints: this.trail.pointCount, foamQuads: this.foam.activeCount };
  }

  public update(emitter: WakeEmitter, dtSeconds: number): void {
    const c = this.config;
    const fwdX = -Math.sin(emitter.rotation);
    const fwdY = Math.cos(emitter.rotation);
    const sternX = emitter.x - fwdX * c.sternOffset;
    const sternY = emitter.y - fwdY * c.sternOffset;

    // Odômetro da popa (distância real percorrida, inclusive em deriva)
    if (this.hasStern) {
      const moved = Math.hypot(sternX - this.sternX, sternY - this.sternY);
      if (moved > TELEPORT_DISTANCE) {
        this.clear();
      } else {
        this.odometer += moved;
      }
    }
    this.sternX = sternX;
    this.sternY = sternY;
    this.hasStern = true;

    const speed = Math.hypot(emitter.vx, emitter.vy);
    const strength = clamp01((speed - c.minSpeed) / Math.max(0.01, c.fullSpeed - c.minSpeed));

    // --- Trilha: um ponto a cada `pointSpacing` percorrido ---
    if (strength > 0 && this.odometer - this.lastPointOdometer >= c.pointSpacing) {
      this.trail.addPoint(sternX, sternY, this.odometer, strength);
      this.lastPointOdometer = this.odometer;
    }

    // --- Espuma: um par (bombordo + estibordo) a cada `foamSpacing` ---
    if (strength > 0 && this.odometer - this.lastFoamOdometer >= c.foamSpacing) {
      this.spawnFoamPair(emitter, fwdX, fwdY, strength);
      this.lastFoamOdometer = this.odometer;
    }

    this.trail.update(dtSeconds, sternX, sternY, this.odometer, strength, c);
    this.foam.update(dtSeconds, c);
  }

  public clear(): void {
    this.trail.clear();
    this.foam.clear();
    this.lastPointOdometer = this.odometer;
    this.lastFoamOdometer = this.odometer;
    this.hasStern = false;
  }

  public destroy(): void {
    this.destroyed = true;
    this.trail.destroy();
    this.foam.destroy();
    this.view.destroy();
  }

  private spawnFoamPair(emitter: WakeEmitter, fwdX: number, fwdY: number, strength: number): void {
    const c = this.config;
    // Posição ao longo do casco: 0 = popa (-sternOffset), 1 = proa (+sternOffset)
    const along = (c.foamAlongHull * 2 - 1) * c.sternOffset;
    const baseX = emitter.x + fwdX * along;
    const baseY = emitter.y + fwdY * along;
    const sideX = -fwdY;
    const sideY = fwdX;

    for (const side of [-1, 1]) {
      // Afasta para fora do casco e um pouco para trás
      const dirX = sideX * side - fwdX * 0.35;
      const dirY = sideY * side - fwdY * 0.35;
      this.foam.spawn(
        baseX + sideX * side * c.foamSideOffset,
        baseY + sideY * side * c.foamSideOffset,
        dirX,
        dirY,
        strength,
        c
      );
    }
  }

  private async loadFinalTextures(): Promise<void> {
    const [trail, foam] = await Promise.all([
      loadOptionalTexture(WAKE_TEXTURE_PATHS.trail),
      loadOptionalTexture(WAKE_TEXTURE_PATHS.foam),
    ]);
    if (this.destroyed) return;
    if (trail) this.trail.setTexture(trail);
    if (foam) this.foam.setTexture(foam);
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
