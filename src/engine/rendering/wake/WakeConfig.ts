// src/engine/rendering/wake/WakeConfig.ts
import { MOVEMENT_SPEEDS } from '../../entities/MovementBalance';

/**
 * Parâmetros do rastro do barco. Distâncias em pixels de mundo, tempos em segundos.
 * Mutável de propósito: a GUI de debug edita os valores em tempo real.
 */
export interface WakeConfig {
  // --- Emissão ---
  /** Distância da popa ao centro do barco (o rastro nasce aqui). */
  sternOffset: number;
  /** Distância percorrida entre dois pontos do rastro. */
  pointSpacing: number;
  /** Abaixo desta velocidade (px/frame) o barco não deixa rastro. */
  minSpeed: number;
  /** Velocidade em que o rastro atinge intensidade máxima. */
  fullSpeed: number;

  // --- Trilha (malha triangulada) ---
  /** Tempo de vida de cada ponto: define o comprimento visível do rastro. */
  trailLifetime: number;
  /** Largura do rastro logo atrás da popa. */
  trailStartWidth: number;
  /** Largura no fim da vida (o rastro abre conforme se dissipa). */
  trailEndWidth: number;
  /** Expoente do esmaecimento ao longo da vida (maior = some mais cedo). */
  trailFadePower: number;
  /** Distância de fade-in a partir da popa (evita corte duro no casco). */
  trailHeadFade: number;
  /** Pixels de mundo por repetição da textura ao longo do rastro (0 = estica no rastro todo). */
  trailTextureLength: number;
  /** Rolagem da textura ao longo do rastro (repetições por segundo). */
  trailTextureScroll: number;
  trailOpacity: number;
  trailTint: number;

  // --- Espuma (quads auxiliares) ---
  /** Distância percorrida entre dois spawns de espuma. */
  foamSpacing: number;
  /** Afastamento lateral dos spawns em relação ao eixo do barco. */
  foamSideOffset: number;
  /** Onde nasce ao longo do casco: 0 = popa, 1 = proa. */
  foamAlongHull: number;
  foamLifetime: number;
  /** Tamanho em pixels ao nascer e ao morrer. */
  foamStartSize: number;
  foamEndSize: number;
  /** Velocidade de afastamento lateral (px/s). */
  foamDrift: number;
  foamOpacity: number;
  foamTint: number;
  /** Limite de quads de espuma vivos (pool). */
  foamMaxParticles: number;
}

export const DEFAULT_WAKE_CONFIG: WakeConfig = {
  sternOffset: 18,
  pointSpacing: 10,
  minSpeed: 0.25,
  fullSpeed: MOVEMENT_SPEEDS.player,

  trailLifetime: 1.8,
  trailStartWidth: 55,
  trailEndWidth: 175,
  trailFadePower: 1.6,
  trailHeadFade: 18,
  trailTextureLength: 160,
  trailTextureScroll: 0,
  trailOpacity: 0.7,
  trailTint: 0xffffff,

  foamSpacing: 16,
  foamSideOffset: 14,
  foamAlongHull: 0.65,
  foamLifetime: 1.1,
  foamStartSize: 28,
  foamEndSize: 80,
  foamDrift: 22,
  foamOpacity: 0.75,
  foamTint: 0xffffff,
  foamMaxParticles: 160,
};
