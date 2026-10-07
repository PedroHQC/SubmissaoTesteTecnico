import { expect, Page } from '@playwright/test';
import type { GameTestState } from '../../src/engine/testing';
import type { GameSettings } from '../../src/services/gameSettings';
export async function setupIsolatedGame(
  page: Page,
  options: { seed?: number; scenario?: string; settings?: GameSettings } = {}
) {
  await page.addInitScript(
    ({ seed, scenario, settings }) => {
      if (!sessionStorage.getItem('test_initialized')) {
        localStorage.clear();
        sessionStorage.setItem('test_initialized', '1');
        localStorage.setItem('pb_active_network_scenario_v1', scenario);
        localStorage.setItem('pb_test_latency_ms', '0');
        localStorage.setItem('PIXI_GAME_SETTINGS_V1', JSON.stringify(settings));
      }
      let state = seed;
      Math.random = () => {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return state / 4294967296;
      };
    },
    {
      seed: options.seed ?? 42,
      scenario: options.scenario ?? 'SUCCESS',
      settings: options.settings ?? { sessionTime: 60, enemySpawnInterval: 1.5, mode: 'arena' },
    }
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'PLAY', exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect.poll(() => page.evaluate(() => !!window.__PIXI_TEST_HOOKS__)).toBe(true);
  await page.evaluate(() => window.__PIXI_TEST_HOOKS__!.setManualClock(true));
}
export async function getEngineState(page: Page): Promise<GameTestState> {
  return page.evaluate(() => window.__PIXI_TEST_HOOKS__!.getState());
}
export async function advance(page: Page, seconds: number) {
  await page.evaluate((duration) => window.__PIXI_TEST_HOOKS__!.advance(duration), seconds);
}
export async function play(page: Page) {
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
}
export async function options(page: Page, tab = 'Game') {
  await page.getByRole('button', { name: 'OPTIONS', exact: true }).click();
  await page.getByRole('tab', { name: tab, exact: true }).click();
}
