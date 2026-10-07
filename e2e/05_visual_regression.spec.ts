import { test, expect } from '@playwright/test';
import { setupIsolatedGame, play, advance } from './helpers/gameTestHelper';
test('main menu visual baseline', async ({ page }) => {
  await setupIsolatedGame(page);
  await page.locator('canvas').evaluate((canvas) => {
    canvas.style.visibility = 'hidden';
  });
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot('main-menu.png');
});
test('stable arena and HUD visual baseline', async ({ page }) => {
  await setupIsolatedGame(page);
  await play(page);
  await advance(page, 1 / 60);
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot('arena-gameplay.png');
});
test('result visual baseline', async ({ page }) => {
  await setupIsolatedGame(page);
  await play(page);
  await page.evaluate(() => window.__PIXI_TEST_HOOKS__!.finishMatch(24));
  await expect(page.getByText('Match saved', { exact: true })).toBeVisible();
  await page.locator('canvas').evaluate((canvas) => {
    canvas.style.visibility = 'hidden';
  });
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot('battle-complete-modal.png');
});
