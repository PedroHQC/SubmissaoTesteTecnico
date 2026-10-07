// src/engine/entities/Projectile.ts
import { Texture, Ticker } from 'pixi.js';
import { IPoolable } from '../pools/ObjectPool';
import { Entity } from './Entity';
import { audio } from '../services/audioManager';
import { MOVEMENT_SPEEDS } from './MovementBalance';
import { DAMAGE_RULES } from '../../config/gameplay';

export class Projectile extends Entity implements IPoolable {
  public speed: number = MOVEMENT_SPEEDS.playerProjectile;
  /** Alcance em px para uso no mundo aberto (updateWorld). */
  public maxDistance: number = Infinity;
  private travelled = 0;
  public directionX: number = 0;
  public directionY: number = -1;

  constructor(texture: Texture) {
    super(texture);
    this.radius = DAMAGE_RULES.projectileRadius;
    this.despawn(); // Inicia oculto e inativo
  }

  public spawn(startX: number, startY: number, dirX: number, dirY: number): void {
    this.travelled = 0;
    this.x = startX;
    this.y = startY;
    this.directionX = dirX;
    this.directionY = dirY;
    this.isActive = true;
    this.view.visible = true;
  }

  public despawn(): void {
    this.isActive = false;
    this.view.visible = false;
    this.directionX = 0;
    this.directionY = 0;
  }

  /**
   * Atualização para o mundo aberto: some ao atingir `maxDistance` (não depende da tela).
   * Retorna false quando o projétil expira.
   */
  public updateWorld(dt: number): boolean {
    if (!this.isActive) return false;

    const step = this.speed * dt;
    this.x += this.directionX * step;
    this.y += this.directionY * step;
    this.travelled += step;

    if (this.travelled >= this.maxDistance) {
      this.despawn();
      return false;
    }
    return true;
  }

  public updateProjectile(ticker: Ticker, screenWidth: number, screenHeight: number): boolean {
    if (!this.isActive) return false;

    const dt = ticker.deltaTime;
    this.x += this.directionX * this.speed * dt;
    this.y += this.directionY * this.speed * dt;

    // Margem de segurança de 40px em todas as 4 direções (X e Y)
    const margin = 40;
    const isOutOfBounds =
      this.x < -margin ||
      this.x > screenWidth + margin ||
      this.y < -margin ||
      this.y > screenHeight + margin;

    if (isOutOfBounds) {
      audio.playWaterHit();
      this.despawn();
      return false; // Notifica que saiu da tela
    }

    return true;
  }

  public override update(): void {
    // Mantém compatibilidade com a assinatura abstrata
  }
}
