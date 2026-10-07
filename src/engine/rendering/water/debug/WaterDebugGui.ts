// src/engine/rendering/water/debug/WaterDebugGui.ts
import type GUI from 'lil-gui';
import { SURFACE_BLEND_MODES, WaterConfig } from '../WaterConfig';
import { WaterLayer } from '../WaterLayer';

type Mutable<T> = {
  -readonly [K in keyof T]: T[K] extends readonly unknown[]
    ? { -readonly [I in keyof T[K]]: T[K][I] }
    : T[K];
};

/**
 * Painel lil-gui para ajustar a água em tempo real.
 * lil-gui é carregado sob demanda, então não entra no bundle de produção se não for chamado.
 * Retorna uma função que remove o painel.
 */
export function attachWaterDebugGui(
  water: WaterLayer,
  /** Adiciona pastas extras ao mesmo painel (ex.: controles do mundo). */
  extend?: (gui: GUI) => void
): () => void {
  let gui: GUI | null = null;
  let disposed = false;

  void import('lil-gui').then(({ default: LilGui }) => {
    if (disposed) return;
    gui = buildGui(new LilGui({ title: 'Water' }), water);
    extend?.(gui);
  });

  return () => {
    disposed = true;
    gui?.destroy();
    gui = null;
  };
}

function buildGui(gui: GUI, water: WaterLayer): GUI {
  const state = structuredClone(water.getConfig()) as unknown as Mutable<WaterConfig>;
  type Vec2Key = 'depthNoiseDrift' | 'scrollA' | 'scrollB';
  const vec2 = (folder: GUI, key: Vec2Key, range: number) => {
    folder.add(state[key], '0', -range, range, 0.1).name(`${key} x`);
    folder.add(state[key], '1', -range, range, 0.1).name(`${key} y`);
  };

  const depth = gui.addFolder('Profundidade (noise)');
  depth.add(state, 'depthNoiseScale', 50, 1500, 1);
  vec2(depth, 'depthNoiseDrift', 30);
  depth.add(state, 'depthThreshold', 0, 1, 0.005);
  depth.add(state, 'depthSoftness', 0.001, 0.5, 0.001);
  depth.addColor(state, 'deepColor', 1);
  depth.addColor(state, 'shallowNoiseColor', 1);
  depth.add(state, 'depthEdgeStrength', 0, 1, 0.01);
  depth.add(state, 'depthEdgeWidth', 0.001, 0.2, 0.001);

  const islands = gui.addFolder('Raso das ilhas');
  islands.add(state, 'islandShallowStrength', 0, 1, 0.01).name('Força do raso');
  islands.add(state, 'islandShallowRange', 0, 8, 0.05).name('Alcance (tiles)');
  islands.add(state, 'islandShallowSoftness', 0.01, 4, 0.01).name('Suavidade (tiles)');
  islands.add(state, 'islandNoiseDistort', 0, 6, 0.05).name('Ondulação pelo noise');
  islands.addColor(state, 'veryShallowColor', 1).name('Cor muito raso');
  islands.add(state, 'veryShallowStrength', 0, 1, 0.01).name('Força muito raso');
  islands.add(state, 'veryShallowRange', 0, 6, 0.05).name('Alcance muito raso');
  islands.add(state, 'veryShallowSoftness', 0.01, 3, 0.01).name('Suavidade muito raso');
  islands.add(state, 'veryShallowSurfaceFade', 0, 1, 0.01).name('Apaga superfície no muito raso');

  const blend = gui.addFolder('Composição superfície × profundidade');
  blend.add(state, 'surfaceBlendMode', SURFACE_BLEND_MODES).name('Modo de mistura');
  blend.add(state, 'surfaceOpacityDeep', 0, 1, 0.01).name('Opacidade no fundo');
  blend.add(state, 'surfaceOpacityShallow', 0, 1, 0.01).name('Opacidade no raso');

  const surface = gui.addFolder('Superfície');
  surface.add(state, 'surfaceEnabled').name('Superfície ligada');
  surface.add(state, 'textureScale', 16, 512, 1);
  vec2(surface, 'scrollA', 40);
  vec2(surface, 'scrollB', 40);
  surface.add(state, 'distortionStrength', 0, 0.2, 0.001);
  surface.add(state, 'distortionFrequency', 0, 0.2, 0.001);
  surface.add(state, 'distortionSpeed', 0, 5, 0.01);
  surface.add(state, 'highlightStrength', 0, 1, 0.01);
  surface.addColor(state, 'deepTint', 1);

  const shore = gui.addFolder('Costa / espuma');
  shore.addColor(state, 'shallowColor', 1);
  shore.add(state, 'shallowStrength', 0, 1, 0.01);
  shore.add(state, 'shoreDistanceTiles', 0.5, 6, 0.1);
  shore.add(state, 'shoreFieldResolution', 1, 8, 1);
  shore.addColor(state, 'foamColor', 1);
  shore.add(state, 'foamStrength', 0, 1, 0.01);
  shore.add(state, 'foamBands', 0, 6, 0.1);
  shore.add(state, 'foamSpeed', -2, 2, 0.01);
  shore.add(state, 'foamWidth', 0, 1, 0.01);

  const actions = {
    copiarConfig: () => {
      const json = JSON.stringify(state, null, 2);
      console.log('[Water config]\n' + json);
      void navigator.clipboard?.writeText(json);
    },
    reset: () => gui.reset(),
  };
  gui.add(actions, 'copiarConfig').name('Copiar config (JSON)');
  gui.add(actions, 'reset').name('Reset');

  gui.onChange(() => water.setConfig(structuredClone(state)));
  return gui;
}
