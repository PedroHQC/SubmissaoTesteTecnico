/** Decaying, bounded visual offset; never changes the camera's follow target. */
export class CameraShake {
  private strength = 0;
  private phase = 0;
  public x = 0;
  public y = 0;

  public impact(strength: number): void {
    this.strength = Math.min(12, Math.max(this.strength, strength));
  }

  public update(seconds: number): void {
    this.phase += seconds;
    this.strength = Math.max(0, this.strength - seconds * 32);
    this.x = Math.sin(this.phase * 137) * this.strength;
    this.y = Math.sin(this.phase * 173 + 1.2) * this.strength * 0.8;
  }

  public reset(): void {
    this.strength = this.x = this.y = this.phase = 0;
  }
}
