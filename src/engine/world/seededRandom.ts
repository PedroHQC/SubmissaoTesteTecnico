// src/engine/world/seededRandom.ts

/** PRNG mulberry32: rápido, 32 bits, determinístico. Retorna valores em [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semente única por chunk: o mesmo (seed, cx, cy) sempre gera o mesmo conteúdo. */
export function chunkSeed(worldSeed: number, cx: number, cy: number): number {
  let h = worldSeed >>> 0;
  h = Math.imul(h ^ (cx | 0), 0x85ebca6b);
  h = Math.imul(h ^ (cy | 0), 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
