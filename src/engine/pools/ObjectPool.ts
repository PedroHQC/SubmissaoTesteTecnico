// src/engine/pools/ObjectPool.ts
export interface IPoolable {
  isActive: boolean;
  despawn(): void;
}

export class ObjectPool<T extends IPoolable> {
  private readonly available: T[] = [];
  public readonly rawPool: T[] = [];

  constructor(
    private readonly factory: () => T,
    initialSize: number = 20
  ) {
    for (let i = 0; i < initialSize; i++) {
      const item = this.factory();
      item.despawn();
      this.available.push(item);
      this.rawPool.push(item);
    }
  }

  public get(): T {
    // 1. Se houver disponível no pool, retira e devolve
    if (this.available.length > 0) {
      return this.available.pop()!;
    }

    // 2. Fallback defensivo: se o pool esgotar, instancia sob demanda
    // para nunca travar o jogo ou retornar nulo
    const newItem = this.factory();
    this.rawPool.push(newItem);
    return newItem;
  }

  public release(item: T): void {
    if (!item.isActive) return;
    item.despawn();
    this.available.push(item);
  }

  /**
   * Desativa todas as entidades em jogo e devolve todas para o pool de disponíveis
   * sem destruir as instâncias da memória.
   */
  public releaseAll(): void {
    this.available.length = 0;

    for (let i = 0; i < this.rawPool.length; i++) {
      const item = this.rawPool[i];
      item.despawn();
      this.available.push(item);
    }
  }

  public forEachActive(callback: (item: T) => void): void {
    for (let i = 0; i < this.rawPool.length; i++) {
      const item = this.rawPool[i];
      if (item.isActive) {
        callback(item);
      }
    }
  }
}
