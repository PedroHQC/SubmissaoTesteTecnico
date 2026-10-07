import { Container, Sprite, Texture } from 'pixi.js';

export type ExplosionKind = 'hit' | 'ship' | 'water';

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  spin: number;
  smoke: boolean;
  splash: boolean;
}

/** Pooled explosion quads and textured water splashes. */
export class ExplosionParticles {
  public readonly view = new Container();
  private readonly particles: Particle[] = [];
  private cursor = 0;
  private readonly limit = 512;

  constructor(private readonly splashTexture: Texture) {
    this.view.eventMode = 'none';
  }

  public burst(x: number, y: number, kind: ExplosionKind): void {
    const large = kind === 'ship';
    const water = kind === 'water';
    if (water) this.splash(x, y);
    const count = large ? 44 : water ? 14 : 20;
    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      const angle = Math.random() * Math.PI * 2;
      const smoke = !water && i > count * 0.72;
      const speed = (25 + Math.random() * 105) * (large ? 1.6 : 1) * (smoke ? 0.3 : 1);
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.age = 0;
      p.life = smoke ? 0.65 + Math.random() * 0.65 : 0.2 + Math.random() * (large ? 0.65 : 0.35);
      p.size = (smoke ? 10 : 2.5) + Math.random() * (large ? 9 : 4);
      p.smoke = smoke;
      p.splash = false;
      p.sprite.texture = Texture.WHITE;
      p.spin = (Math.random() - 0.5) * 8;
      p.sprite.position.set(x, y);
      p.sprite.rotation = angle;
      p.sprite.tint = smoke ? 0x54515a : water ? 0xa8eaff : i % 3 === 0 ? 0xff7438 : 0xffdf86;
      p.sprite.blendMode = smoke ? 'normal' : 'add';
      p.sprite.alpha = smoke ? 0.45 : 1;
      p.sprite.width = p.size;
      p.sprite.height = p.size * (smoke ? 1 : 0.5);
      p.sprite.visible = true;
    }
    if (!water) {
      const flash = this.acquire();
      flash.vx = flash.vy = flash.age = flash.spin = 0;
      flash.life = 0.13;
      flash.size = large ? 44 : 18;
      flash.smoke = false;
      flash.splash = false;
      flash.sprite.texture = Texture.WHITE;
      flash.sprite.position.set(x, y);
      flash.sprite.rotation = Math.PI / 4;
      flash.sprite.tint = 0xffebae;
      flash.sprite.blendMode = 'add';
      flash.sprite.alpha = 0.9;
      flash.sprite.width = flash.sprite.height = flash.size;
      flash.sprite.visible = true;
    }
  }

  private splash(x: number, y: number): void {
    const p = this.acquire();
    p.vx = p.vy = p.age = p.spin = 0;
    p.life = 0.85;
    p.size = 52 + Math.random() * 12;
    p.smoke = false;
    p.splash = true;
    p.sprite.texture = this.splashTexture;
    p.sprite.position.set(x, y);
    p.sprite.rotation = Math.random() * Math.PI * 2;
    p.sprite.tint = 0xffffff;
    p.sprite.blendMode = 'normal';
    p.sprite.alpha = 0.9;
    p.sprite.width = p.sprite.height = p.size;
    p.sprite.visible = true;
  }

  public update(seconds: number): void {
    for (const p of this.particles) {
      if (!p.sprite.visible) continue;
      p.age += seconds;
      if (p.age >= p.life) {
        p.sprite.visible = false;
        continue;
      }
      const t = p.age / p.life;
      if (p.splash) {
        const expansion = 1 - (1 - t) ** 3;
        p.sprite.width = p.sprite.height = p.size * (1 + expansion * 0.4);
        p.sprite.alpha = 0.9 * (1 - t) ** 1.4;
        continue;
      }
      const drag = Math.exp(-seconds * 3);
      p.vx *= drag;
      p.vy *= drag;
      p.sprite.x += p.vx * seconds;
      p.sprite.y += p.vy * seconds;
      p.sprite.rotation += p.spin * seconds;
      p.sprite.alpha = (1 - t) ** 2 * (p.smoke ? 0.45 : 1);
      const size = p.size * (p.smoke ? 1 + t * 2 : 1 - t * 0.6);
      p.sprite.width = size;
      p.sprite.height = size * (p.smoke || p.life === 0.13 ? 1 : 0.5);
    }
  }

  public clear(): void {
    for (const p of this.particles) p.sprite.visible = false;
  }

  private acquire(): Particle {
    const idle = this.particles.find((p) => !p.sprite.visible);
    if (idle) return idle;
    if (this.particles.length < this.limit) {
      const sprite = new Sprite(Texture.WHITE);
      sprite.anchor.set(0.5);
      this.view.addChild(sprite);
      const p = {
        sprite,
        vx: 0,
        vy: 0,
        age: 0,
        life: 0,
        size: 0,
        spin: 0,
        smoke: false,
        splash: false,
      };
      this.particles.push(p);
      return p;
    }
    const p = this.particles[this.cursor];
    this.cursor = (this.cursor + 1) % this.limit;
    return p;
  }
}
