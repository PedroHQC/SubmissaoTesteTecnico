// src/engine/entities/Player.ts
import { audio } from '../services/audioManager';
import { Textures4Hp } from '../types/entityConfig';
import { Entity } from './Entity';
import { ShipController } from './ShipController';
import { joystickShipInput, StickPosition, STICK_DEADZONE } from './JoystickInput';
import { DAMAGE_RULES } from '../../config/gameplay';

export interface ScreenBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export class Player extends Entity {
  // Configurações de Atributos e Vida
  public readonly maxHp: number = DAMAGE_RULES.playerHealth;
  public hp: number = this.maxHp;

  // Física do barco (inércia, deriva e leme suave)
  public readonly ship = new ShipController();

  /** Velocidade atual ao longo da proa (negativa = ré). */
  public get currentSpeed(): number {
    return this.ship.forwardSpeed(this.rotation);
  }

  /** Teste: recebe o feedback de dano mas nunca perde vida. */
  public godMode = false;

  // Limites de tela
  public bounds: ScreenBounds | null = null;

  // Temporizador para feedback de dano
  private damageTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly healthTextures: Textures4Hp) {
    // Textures are ordered wreck, heavily damaged, damaged, intact.
    super(healthTextures[3]);
    this.hp = this.maxHp;
    this.radius = 20;
    this.rotation -= Math.PI / 2;
    // Garante ponto de ancoragem no centro para rotação correta
    this.sprite.anchor.set(0.5);
  }

  /**
   * Getters e Setters de rotação e dimensões delegados ao nó do Pixi
   */
  public get rotation(): number {
    return this.view.rotation;
  }

  public set rotation(value: number) {
    this.view.rotation = value;
  }

  public get width(): number {
    return this.sprite.width;
  }

  public get height(): number {
    return this.sprite.height;
  }

  /**
   * Loop de atualização do Player com inputs do teclado.
   * W/↑ acelera, S/↓ freia e dá ré, A/D ou ←/→ giram o leme.
   */
  public updatePlayer(
    deltaTime: number,
    keys: Record<string, boolean>,
    stick?: StickPosition
  ): void {
    const right = keys['ArrowRight'] || keys['KeyD'] ? 1 : 0;
    const left = keys['ArrowLeft'] || keys['KeyA'] ? 1 : 0;
    const forward = keys['ArrowUp'] || keys['KeyW'] ? 1 : 0;
    const back = keys['ArrowDown'] || keys['KeyS'] ? 1 : 0;

    const input =
      stick && Math.hypot(stick.x, stick.y) > STICK_DEADZONE && !(right || left || forward || back)
        ? joystickShipInput(
            stick,
            this.rotation,
            this.currentSpeed < -0.05 && !this.ship.isRecovering
          )
        : { throttle: forward - back, steer: right - left };
    this.ship.step(this, input, deltaTime);
    audio.setSailing(Math.hypot(this.ship.vx, this.ship.vy) > 0.3);
    this.updateHealthBar(this.hp, this.maxHp);

    if (this.bounds) {
      this.clampToBounds(this.bounds);
    }
  }

  /**
   * Repassa ao controlador o quanto a costa empurrou o barco (posição depois - antes da colisão).
   */
  public applyCollisionPush(pushX: number, pushY: number): number {
    return this.ship.applyCollision(pushX, pushY);
  }

  /**
   * Mantém a compatibilidade com a assinatura abstrata herdada de Entity
   */
  public override update(): void {
    // A chamada principal agora ocorre via updatePlayer()
  }

  public clampToBounds(bounds: ScreenBounds): void {
    const cos = Math.abs(Math.cos(this.rotation));
    const sin = Math.abs(Math.sin(this.rotation));
    const halfWidth = (this.width * cos + this.height * sin) / 2;
    const halfHeight = (this.width * sin + this.height * cos) / 2;
    const beforeX = this.x;
    const beforeY = this.y;

    this.x = this.clamp(this.x, bounds.minX + halfWidth, bounds.maxX - halfWidth);
    this.y = this.clamp(this.y, bounds.minY + halfHeight, bounds.maxY - halfHeight);
    this.applyCollisionPush(this.x - beforeX, this.y - beforeY);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Aplica dano, troca a textura conforme a vida e pisca em vermelho
   * Retorna true caso o jogador tenha morrido (HP <= 0)
   */
  public takeDamage(amount: number = 1): boolean {
    if (!this.godMode) {
      this.hp = Math.max(0, this.hp - amount);
    }

    // 1. Atualiza a textura correspondente à nova vida restante
    this.updateHealthTexture();

    // 2. Feedback visual de dano (Flash vermelho)
    this.sprite.tint = 0xff0000;

    if (this.damageTimeoutId) {
      clearTimeout(this.damageTimeoutId);
    }

    this.damageTimeoutId = setTimeout(() => {
      this.sprite.tint = 0xffffff;
      this.damageTimeoutId = null;
    }, 100);

    return this.hp <= 0;
  }

  private updateHealthTexture(): void {
    this.updateHealthBar(this.hp, this.maxHp);
    const stage =
      this.hp <= 0 ? 0 : Math.min(3, Math.max(1, Math.floor((this.hp / this.maxHp) * 3)));
    this.sprite.texture = this.healthTextures[stage];
  }

  public reset(startX: number, startY: number): void {
    this.hp = this.maxHp;
    this.ship.reset();
    this.x = startX;
    this.y = startY;
    this.rotation = 0;
    this.sprite.tint = 0xffffff;
    this.updateHealthTexture();
    this.view.visible = true;
  }

  public destroy(): void {
    audio.setSailing(false);
    if (this.damageTimeoutId) {
      clearTimeout(this.damageTimeoutId);
      this.damageTimeoutId = null;
    }
  }
}
