// src/engine/entities/Entity.ts
import { Container, Graphics, Sprite, Texture, Ticker } from 'pixi.js';

export abstract class Entity {
  public readonly view: Container;
  protected readonly sprite: Sprite;
  private healthBar: Graphics | null = null;
  private displayedHealth = -1;
  public isActive: boolean = true;
  public radius: number = 16;

  constructor(initialTexture: Texture) {
    this.view = new Container();
    this.sprite = new Sprite(initialTexture);

    this.sprite.anchor.set(0.5);
    this.view.addChild(this.sprite);
  }

  public abstract update(ticker: Ticker): void;

  protected updateHealthBar(current: number, maximum: number): void {
    if (!this.healthBar) {
      this.healthBar = new Graphics();
      this.view.addChild(this.healthBar);
    }
    const bar = this.healthBar;
    if (this.displayedHealth !== current) {
      this.displayedHealth = current;
      bar.clear().roundRect(-19, -3, 38, 6, 2).fill(0x17202a);
      bar
        .roundRect(-18, -2, Math.max(0, Math.min(36, (36 * current) / maximum)), 4, 1)
        .fill(current / maximum > 0.35 ? 0x86df8a : 0xff8066);
    }
    const offset = Math.max(this.sprite.width, this.sprite.height) / 2 + 10;
    bar.rotation = -this.view.rotation;
    bar.position.set(
      -Math.sin(this.view.rotation) * offset,
      -Math.cos(this.view.rotation) * offset
    );
    bar.visible = current > 0;
  }

  public get x(): number {
    return this.view.position.x;
  }

  public set x(value: number) {
    this.view.position.x = value;
  }

  public get y(): number {
    return this.view.position.y;
  }

  public set y(value: number) {
    this.view.position.y = value;
  }
}
