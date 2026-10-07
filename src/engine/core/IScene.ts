// src/engine/core/IScene.ts
import { Container, Ticker } from 'pixi.js';

export interface IScene {
  readonly view: Container;

  init(): Promise<void> | void;

  update(ticker: Ticker): void;

  resize(width: number, height: number): void;

  destroy(): void;
}
