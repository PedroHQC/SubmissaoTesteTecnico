// src/engine/rendering/wake/wakeTextures.ts
import { Assets, Texture } from 'pixi.js';

/**
 * Caminhos das texturas finais do rastro (pasta public/).
 * Enquanto os arquivos não existirem, o sistema usa os placeholders procedurais abaixo.
 *
 * - trail: faixa do rastro. Eixo X = através do rastro (bordas = laterais do sulco),
 *   eixo Y = ao longo do rastro, precisa repetir verticalmente sem emenda.
 * - foam: quad de espuma, centrado, com fundo transparente.
 */
export const WAKE_TEXTURE_PATHS = {
  trail: '/assets/UsedAssets/Effects/wake_trail.png',
  foam: '/assets/UsedAssets/Effects/wake_foam.png',
} as const;

// All ship wakes share these fallback textures for the lifetime of the renderer cache.
let placeholderTrail: Texture | null = null;
let placeholderFoam: Texture | null = null;

/**
 * Carrega uma textura se o arquivo existir. Retorna null sem gerar erro se ele não existir
 * (o dev server responde HTML para caminhos ausentes, então checamos o content-type).
 */
export async function loadOptionalTexture(src: string): Promise<Texture | null> {
  try {
    const response = await fetch(src, { method: 'HEAD' });
    const type = response.headers.get('content-type') ?? '';
    if (!response.ok || !type.startsWith('image/')) return null;
    return await Assets.load<Texture>(src);
  } catch {
    return null;
  }
}

/** Placeholder do rastro: duas linhas de espuma nas bordas e miolo translúcido com granulado. */
export function createPlaceholderTrailTexture(): Texture {
  if (placeholderTrail) return placeholderTrail;
  const width = 64;
  const height = 128;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1); // 0..1 através
      const edge = Math.abs(u - 0.5) * 2; // 0 no centro, 1 nas bordas
      // Crista de espuma perto das bordas + miolo leve
      const crest = Math.exp(-Math.pow((edge - 0.78) / 0.12, 2));
      const core = 0.25 * (1 - edge);
      // Granulado tileável em Y (usa seno com período = altura)
      const grain =
        0.5 +
        0.5 *
          Math.sin((y / height) * Math.PI * 2 * 6 + x * 0.9) *
          Math.sin(x * 2.3 + (y / height) * Math.PI * 2 * 3);
      const alpha = Math.min(1, (crest + core) * (0.7 + 0.3 * grain)) * (edge < 1 ? 1 : 0);

      const i = (y * width + x) * 4;
      image.data[i] = 255;
      image.data[i + 1] = 255;
      image.data[i + 2] = 255;
      image.data[i + 3] = Math.round(alpha * 255);
    }
  }

  ctx.putImageData(image, 0, 0);
  placeholderTrail = Texture.from(canvas);
  return placeholderTrail;
}

/** Placeholder de espuma: blob radial macio com bordas irregulares. */
export function createPlaceholderFoamTexture(): Texture {
  if (placeholderFoam) return placeholderFoam;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(size, size);
  const c = (size - 1) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - c) / c;
      const dy = (y - c) / c;
      const angle = Math.atan2(dy, dx);
      const wobble = 0.85 + 0.15 * Math.sin(angle * 5) * Math.cos(angle * 3);
      const d = Math.hypot(dx, dy) / wobble;
      const alpha = Math.max(0, 1 - d) ** 0.8;

      const i = (y * size + x) * 4;
      image.data[i] = 255;
      image.data[i + 1] = 255;
      image.data[i + 2] = 255;
      image.data[i + 3] = Math.round(alpha * 255);
    }
  }

  ctx.putImageData(image, 0, 0);
  placeholderFoam = Texture.from(canvas);
  return placeholderFoam;
}
