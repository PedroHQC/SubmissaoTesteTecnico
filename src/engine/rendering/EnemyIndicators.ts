import { Container, Graphics } from 'pixi.js';
import type { Enemy } from '../entities/Enemy';

/** Reusable arrows in screen space, independent of camera zoom. */
export class EnemyIndicators {
  public readonly view = new Container({ eventMode: 'none' });
  private readonly arrows: Graphics[] = [];

  public update(
    enemies: readonly Enemy[],
    width: number,
    height: number,
    zoom: number,
    offsetX: number,
    offsetY: number
  ): void {
    const centerX = width / 2;
    const centerY = height / 2;
    const edgeX = Math.max(1, centerX - 24);
    const edgeY = Math.max(1, centerY - 24);
    let count = 0;

    for (const enemy of enemies) {
      if (!enemy.isActive || enemy.isDying || enemy.currentHealth <= 0) continue;
      const x = enemy.x * zoom + offsetX;
      const y = enemy.y * zoom + offsetY;
      const cos = Math.abs(Math.cos(enemy.rotation));
      const sin = Math.abs(Math.sin(enemy.rotation));
      const halfWidth = ((enemy.hullWidth * cos + enemy.hullLength * sin) / 2) * zoom;
      const halfHeight = ((enemy.hullWidth * sin + enemy.hullLength * cos) / 2) * zoom;
      // Keep the arrow hidden while any part of the hull is still on screen.
      if (
        x + halfWidth >= 0 &&
        x - halfWidth <= width &&
        y + halfHeight >= 0 &&
        y - halfHeight <= height
      )
        continue;

      const dx = x - centerX;
      const dy = y - centerY;
      const distanceToEdge = 1 / Math.max(Math.abs(dx) / edgeX, Math.abs(dy) / edgeY);
      const arrow = this.arrows[count] ?? this.createArrow();
      arrow.position.set(centerX + dx * distanceToEdge, centerY + dy * distanceToEdge);
      arrow.rotation = Math.atan2(dy, dx);
      arrow.visible = true;
      count++;
    }

    for (let i = count; i < this.arrows.length; i++) this.arrows[i].visible = false;
  }

  private createArrow(): Graphics {
    const arrow = new Graphics()
      .poly([12, 0, -8, -9, -4, 0, -8, 9])
      .fill(0xff8066)
      .stroke({ color: 0x17202a, width: 5, join: 'round' })
      .poly([12, 0, -8, -9, -4, 0, -8, 9])
      .stroke({ color: 0xffe7b0, width: 2, join: 'round' });
    this.arrows.push(arrow);
    this.view.addChild(arrow);
    return arrow;
  }

  public destroy(): void {
    this.view.destroy({ children: true });
    this.arrows.length = 0;
  }
}
