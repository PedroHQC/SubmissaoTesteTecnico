import { test, expect } from '@playwright/test';
import {
  setupIsolatedGame,
  play,
  advance,
  getEngineState,
  options,
} from './helpers/gameTestHelper';
test('menus and settings fit the viewport in either orientation', async ({ page }) => {
  await setupIsolatedGame(page);
  for (const size of [
    { width: 667, height: 375 },
    { width: 568, height: 320 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    const panel = await page.locator('.main-menu').boundingBox();
    expect(panel!.x).toBeGreaterThanOrEqual(0);
    expect(panel!.y).toBeGreaterThanOrEqual(0);
    expect(panel!.y + panel!.height).toBeLessThanOrEqual(size.height);
    await options(page, 'Controls');
    await expect(page.getByLabel('Joystick', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'SAVE AND BACK' }).click();
  }
});
test('multi-touch joystick and cannon work together and release on cancel', async ({
  page,
  isMobile,
  context,
}) => {
  test.skip(!isMobile, 'Touch device required');
  await setupIsolatedGame(page);
  await play(page);
  const stick = (await page.getByRole('group', { name: 'Navigation joystick' }).boundingBox())!;
  const fire = (await page.getByRole('button', { name: 'Fire bow', exact: true }).boundingBox())!;
  const client = await context.newCDPSession(page);
  const stickPoint = { x: stick.x + stick.width * 0.5, y: stick.y + stick.height * 0.78, id: 1 };
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [stickPoint] });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [stickPoint, { x: fire.x + fire.width / 2, y: fire.y + fire.height / 2, id: 2 }],
  });
  const before = await getEngineState(page);
  await advance(page, 0.5);
  const after = await getEngineState(page);
  expect(after.player.y).toBeGreaterThan(before.player.y);
  expect(after.shots).toBeGreaterThan(0);
  await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  const released = await getEngineState(page);
  expect(released.stick).toEqual({ x: 0, y: 0 });
  expect(released.touchKeys.Space).toBe(false);
  await page.getByRole('button', { name: 'Pause', exact: true }).tap();
  await expect(page.getByRole('heading', { name: 'PAUSED' })).toBeVisible();
});
test('directional touch controls persist and release outside their button', async ({ page }) => {
  await setupIsolatedGame(page);
  await options(page, 'Controls');
  await page.getByLabel('Directional buttons', { exact: true }).check();
  await page.getByRole('button', { name: 'SAVE AND BACK' }).click();
  await play(page);
  const accelerate = page.getByRole('button', { name: 'Accelerate', exact: true });
  const rect = (await accelerate.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await advance(page, 0.3);
  expect((await getEngineState(page)).touchKeys.KeyW).toBe(true);
  await page.mouse.move(rect.x + 160, rect.y - 40);
  await page.mouse.up();
  expect((await getEngineState(page)).touchKeys.KeyW).toBe(false);
});
