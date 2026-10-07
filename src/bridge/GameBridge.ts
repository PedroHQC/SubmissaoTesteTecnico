// src/bridge/GameBridge.ts
import { EngineToUIEvents, UIToEngineEvents } from './events';

type Callback<T> = (payload: T) => void;

export class GameBridge {
  private gameListeners = new Map<keyof EngineToUIEvents, Set<Callback<never>>>();
  private uiListeners = new Map<keyof UIToEngineEvents, Set<Callback<never>>>();

  // --- Game -> UI ---
  public emitToUI<K extends keyof EngineToUIEvents>(
    event: K,
    ...args: EngineToUIEvents[K] extends void ? [] : [payload: EngineToUIEvents[K]]
  ): void {
    const payload = args[0];
    this.gameListeners
      .get(event)
      ?.forEach((cb) => (cb as Callback<EngineToUIEvents[K]>)(payload as EngineToUIEvents[K]));
  }

  public onGameEvent<K extends keyof EngineToUIEvents>(
    event: K,
    callback: Callback<EngineToUIEvents[K]>
  ): () => void {
    if (!this.gameListeners.has(event)) {
      this.gameListeners.set(event, new Set());
    }
    this.gameListeners.get(event)!.add(callback);

    return () => this.gameListeners.get(event)?.delete(callback);
  }

  // --- UI -> Game ---
  public emitToGame<K extends keyof UIToEngineEvents>(
    event: K,
    ...args: UIToEngineEvents[K] extends void ? [] : [payload: UIToEngineEvents[K]]
  ): void {
    const payload = args[0];
    this.uiListeners
      .get(event)
      ?.forEach((cb) => (cb as Callback<UIToEngineEvents[K]>)(payload as UIToEngineEvents[K]));
  }

  public onUIEvent<K extends keyof UIToEngineEvents>(
    event: K,
    callback: Callback<UIToEngineEvents[K]>
  ): () => void {
    if (!this.uiListeners.has(event)) {
      this.uiListeners.set(event, new Set());
    }
    this.uiListeners.get(event)!.add(callback);

    return () => this.uiListeners.get(event)?.delete(callback);
  }

  public destroy(): void {
    this.gameListeners.clear();
    this.uiListeners.clear();
  }
}
