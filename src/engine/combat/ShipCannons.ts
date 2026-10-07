// src/engine/combat/ShipCannons.ts
import { Player } from '../entities/Player';
import { CombatConfig } from './CombatConfig';
import { audio } from '../services/audioManager';

/** Dispara um projétil em (x, y) com velocidade (vx, vy) em px/frame. */
export type FireProjectile = (x: number, y: number, vx: number, vy: number) => void;

/**
 * Canhões do player: proa (Espaço) e salvas laterais de 3 tiros (Q = bombordo, E = estibordo).
 * Os tiros herdam a velocidade do barco, então acertam o que está à frente mesmo em alta velocidade.
 */
export class ShipCannons {
  private frontCooldown = 0;
  private leftCooldown = 0;
  private rightCooldown = 0;

  public reset(): void {
    this.frontCooldown = this.leftCooldown = this.rightCooldown = 0;
  }

  public update(
    dt: number,
    keys: Record<string, boolean>,
    player: Player,
    config: CombatConfig,
    fire: FireProjectile
  ): void {
    this.frontCooldown -= dt;
    this.leftCooldown -= dt;
    this.rightCooldown -= dt;

    // Mesma convenção do Player: rotation 0 = proa para +Y
    const fwdX = -Math.sin(player.rotation);
    const fwdY = Math.cos(player.rotation);
    const { vx, vy } = player.ship;
    const speed = config.playerProjectileSpeed;

    if (keys['Space'] && this.frontCooldown <= 0) {
      audio.playCannonFire();
      fire(
        player.x + fwdX * player.radius,
        player.y + fwdY * player.radius,
        fwdX * speed + vx,
        fwdY * speed + vy
      );
      this.frontCooldown = config.frontCooldown;
    }

    if (keys['KeyQ'] && this.leftCooldown <= 0) {
      this.broadside(player, fwdY, -fwdX, fwdX, fwdY, config, fire);
      this.leftCooldown = config.broadsideCooldown;
    }

    if (keys['KeyE'] && this.rightCooldown <= 0) {
      this.broadside(player, -fwdY, fwdX, fwdX, fwdY, config, fire);
      this.rightCooldown = config.broadsideCooldown;
    }
  }

  /** Três canhões ao longo do casco disparando em paralelo para a lateral. */
  private broadside(
    player: Player,
    sideX: number,
    sideY: number,
    fwdX: number,
    fwdY: number,
    config: CombatConfig,
    fire: FireProjectile
  ): void {
    const spacing = 14;
    audio.playSFX('cannon_broadside');
    const lateral = player.radius * 0.8;
    const speed = config.playerProjectileSpeed;
    const { vx, vy } = player.ship;

    for (const along of [spacing, 0, -spacing]) {
      fire(
        player.x + sideX * lateral + fwdX * along,
        player.y + sideY * lateral + fwdY * along,
        sideX * speed + vx,
        sideY * speed + vy
      );
    }
  }
}
