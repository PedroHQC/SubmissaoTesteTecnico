import { Container } from 'pixi.js';
import type { Enemy } from '../../entities/Enemy';
import type { WakeConfig } from './WakeConfig';
import { WakeEffect, type WakeEmitter } from './WakeEffect';

interface ShipWake {
  effect: WakeEffect;
  generation: number;
  emitter: { -readonly [Key in keyof WakeEmitter]: WakeEmitter[Key] };
}

/** The same water-space wake as the player, reused alongside each pooled enemy. */
export class EnemyWakes {
  public readonly view = new Container();
  private readonly wakes = new Map<Enemy, ShipWake>();

  public update(
    ships: readonly Enemy[],
    seconds: number,
    playerConfig: WakeConfig,
    playerWidth: number,
    playerLength: number,
    running: boolean
  ): void {
    for (const ship of ships) {
      let wake = this.wakes.get(ship);
      if (!wake && ship.isActive && !ship.isDying) {
        wake = {
          effect: new WakeEffect(playerConfig),
          generation: ship.spawnGeneration,
          emitter: { x: ship.x, y: ship.y, rotation: ship.rotation, vx: 0, vy: 0 },
        };
        this.wakes.set(ship, wake);
        this.view.addChild(wake.effect.view);
      }
      if (!wake) continue;

      if (ship.isActive && !ship.isDying) {
        if (wake.generation !== ship.spawnGeneration) {
          wake.effect.clear();
          wake.generation = ship.spawnGeneration;
        }
        const widthScale = ship.hullWidth / Math.max(1, playerWidth);
        const lengthScale = ship.hullLength / Math.max(1, playerLength);
        Object.assign(wake.effect.config, playerConfig, {
          sternOffset: playerConfig.sternOffset * lengthScale,
          pointSpacing: playerConfig.pointSpacing * lengthScale,
          minSpeed: Math.min(playerConfig.minSpeed, ship.ship.handling.maxForwardSpeed * 0.15),
          fullSpeed: ship.ship.handling.maxForwardSpeed,
          trailStartWidth: playerConfig.trailStartWidth * widthScale,
          trailEndWidth: playerConfig.trailEndWidth * widthScale,
          trailHeadFade: playerConfig.trailHeadFade * lengthScale,
          trailTextureLength: playerConfig.trailTextureLength * lengthScale,
          foamSpacing: playerConfig.foamSpacing * lengthScale,
          foamSideOffset: playerConfig.foamSideOffset * widthScale,
          foamStartSize: playerConfig.foamStartSize * widthScale,
          foamEndSize: playerConfig.foamEndSize * widthScale,
        });
        wake.emitter.x = ship.x;
        wake.emitter.y = ship.y;
        wake.emitter.rotation = ship.rotation;
        wake.emitter.vx = running ? ship.ship.vx : 0;
        wake.emitter.vy = running ? ship.ship.vy : 0;
        wake.effect.view.visible = true;
      } else {
        // Let old foam fade where the ship sank instead of emitting from its pooled location.
        wake.emitter.vx = wake.emitter.vy = 0;
        const stats = wake.effect.stats;
        if (!stats.trailPoints && !stats.foamQuads) {
          wake.effect.view.visible = false;
          continue;
        }
      }
      wake.effect.update(wake.emitter, seconds);
    }
  }

  public clear(): void {
    for (const wake of this.wakes.values()) {
      wake.effect.clear();
      wake.effect.view.visible = false;
    }
  }

  public destroy(): void {
    for (const wake of this.wakes.values()) wake.effect.destroy();
    this.wakes.clear();
    this.view.destroy();
  }
}
