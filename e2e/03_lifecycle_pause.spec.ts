import { test, expect } from '@playwright/test';
import { setupIsolatedGame, play, advance, getEngineState } from './helpers/gameTestHelper';
test.beforeEach(async ({ page }) => setupIsolatedGame(page));
test('pause, blur and resume clear held input and freeze simulation', async ({ page }) => {
  await play(page);
  await page.keyboard.down('KeyW');
  await advance(page, 1);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const before = await getEngineState(page);
  await advance(page, 3);
  expect(await getEngineState(page)).toEqual(before);
  await page.keyboard.up('KeyW');
  await page.getByRole('button', { name: 'RESUME', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('heading', { name: 'PAUSED' })).toBeVisible();
  await page.getByRole('button', { name: 'RESUME', exact: true }).click();
  await advance(page, 1);
  expect((await getEngineState(page)).time).toBeLessThan(before.time);
});
test('timeout freezes gameplay, persists result, and restart is clean', async ({ page }) => {
  await play(page);
  await page.evaluate(() => window.__PIXI_TEST_HOOKS__!.setInvulnerable(true));
  await advance(page, 60.1);
  await expect(page.getByRole('heading', { name: 'BATTLE COMPLETE' })).toBeVisible();
  const ended = await getEngineState(page);
  await advance(page, 2);
  expect((await getEngineState(page)).player).toEqual(ended.player);
  await expect(page.getByText('Match saved', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Last result', exact: true }).click();
  await expect(page.getByText('TIME UP', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'PLAY AGAIN', exact: true }).click();
  const state = await getEngineState(page);
  expect(state.player.hp).toBe(4);
  expect(state.score).toBe(0);
  expect(state.time).toBeGreaterThan(59);
});
test('death registers once and abandoning does not register', async ({ page }) => {
  await play(page);
  await page.evaluate(() => window.__PIXI_TEST_HOOKS__!.setPlayerHp(0));
  await advance(page, 1 / 60);
  await expect(page.getByText('SUNK', { exact: true })).toBeVisible();
  await expect(page.getByText('Match saved', { exact: true })).toBeVisible();
  const count = await page.evaluate(
    () => JSON.parse(localStorage.getItem('pb_msw_confirmed_matches_v1') || '[]').length
  );
  await page.getByRole('button', { name: 'PLAY AGAIN', exact: true }).click();
  await advance(page, 1);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'MAIN MENU', exact: true }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('pb_msw_confirmed_matches_v1') || '[]').length
    )
  ).toBe(count);
  await expect(page.locator('canvas')).toHaveCount(1);
});
