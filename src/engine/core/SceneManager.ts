// src/engine/core/SceneManager.ts
import { Application, Ticker } from 'pixi.js';
import { IScene } from './IScene';

export class SceneManager {
  private currentScene: IScene | null = null;
  private readonly updateHandler: (ticker: Ticker) => void;
  private accumulator = 0;
  private destroyed = false;
  private readonly fixedTicker = { deltaTime: 1, deltaMS: 1000 / 60 } as Ticker;

  constructor(private readonly app: Application) {
    this.updateHandler = (ticker: Ticker) => {
      this.accumulator += Math.min(ticker.deltaMS, 100);
      while (this.accumulator >= 1000 / 60) {
        this.currentScene?.update(this.fixedTicker);
        this.accumulator -= 1000 / 60;
      }
    };
    this.app.ticker.add(this.updateHandler);
  }

  public async changeScene(newScene: IScene): Promise<void> {
    if (this.currentScene) {
      this.app.stage.removeChild(this.currentScene.view);
      this.currentScene.destroy();
      this.currentScene = null;
    }

    await newScene.init();
    if (this.destroyed) {
      newScene.destroy();
      return;
    }
    this.currentScene = newScene;
    this.app.stage.addChild(newScene.view);

    newScene.resize(this.app.screen.width, this.app.screen.height);
  }

  public resize(width: number, height: number): void {
    this.currentScene?.resize(width, height);
  }

  public destroy(): void {
    this.destroyed = true;
    this.app.ticker.remove(this.updateHandler);
    if (this.currentScene) {
      this.currentScene.destroy();
      this.currentScene = null;
    }
  }
}
