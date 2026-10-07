import { test, expect } from '@playwright/test';
import {
  setupIsolatedGame,
  options,
  play,
  advance,
  getEngineState,
} from './helpers/gameTestHelper';
test('options validate, persist, and support keyboard focus', async ({ page }) => {
  await setupIsolatedGame(page);
  await options(page);
  const time = page.getByLabel('Game session time', { exact: true });
  await time.fill('10');
  await expect(time).toHaveValue('60');
  await time.fill('250');
  await expect(time).toHaveValue('180');
  await time.fill('90');
  await page.getByLabel('Enemy spawn time', { exact: true }).fill('2');
  await page.getByLabel('Game mode', { exact: true }).selectOption('open-sea');
  await page.getByRole('tab', { name: 'Controls', exact: true }).click();
  await page.getByLabel('Directional buttons', { exact: true }).check();
  await page.getByRole('button', { name: 'SAVE AND BACK' }).click();
  await page.reload();
  await options(page);
  await expect(time).toHaveValue('90');
  await expect(page.getByLabel('Game mode', { exact: true })).toHaveValue('open-sea');
  await page.getByRole('tab', { name: 'Controls', exact: true }).click();
  await expect(page.getByLabel('Directional buttons', { exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'SAVE AND BACK' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tab', { name: 'Game', exact: true })).toBeFocused();
});
test('failed asset loading shows retry and genuinely recovers', async ({ page, context }) => {
  await context.route('**/Ships/PlayerShip/player_ship_1.png', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByRole('button', { name: 'PLAY', exact: true })).toHaveCount(0);
  await context.unroute('**/Ships/PlayerShip/player_ship_1.png');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('button', { name: 'PLAY', exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('Open Sea follows the ship and permits gentle wheel zoom', async ({ page }) => {
  await setupIsolatedGame(page, {
    settings: { sessionTime: 60, enemySpawnInterval: 5, mode: 'open-sea' },
  });
  await play(page);
  await advance(page, 1);
  const initial = await getEngineState(page);
  expect(initial.mode).toBe('open-sea');
  await page.keyboard.down('KeyW');
  await advance(page, 1);
  await page.keyboard.up('KeyW');
  expect((await getEngineState(page)).camera.y).toBeGreaterThan(initial.camera.y);
  const viewport = page.viewportSize()!;
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  await page.mouse.wheel(0, 100);
  // Wheel dispatch is asynchronous; allow the real listener to consume it.
  await page.waitForTimeout(50);
  await advance(page, 1);
  expect((await getEngineState(page)).camera.zoom).toBeLessThan(initial.camera.zoom);
});
