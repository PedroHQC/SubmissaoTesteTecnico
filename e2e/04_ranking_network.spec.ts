import { test, expect } from '@playwright/test';
import { setupIsolatedGame, play } from './helpers/gameTestHelper';
test('ranking pagination, empty and error states', async ({ page }) => {
  await setupIsolatedGame(page);
  await page.getByRole('button', { name: 'RANKING', exact: true }).click();
  await expect(page.getByText('Captain Flint', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Anne Bonny', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'MAIN MENU', exact: true }).click();
  await page.evaluate(() =>
    localStorage.setItem('pb_active_network_scenario_v1', 'SERVER_ERROR_500')
  );
  await page.getByRole('button', { name: 'RANKING', exact: true }).click();
  await expect(page.getByText('Could not load records.', { exact: true })).toBeVisible();
  await page.evaluate(() => localStorage.setItem('pb_active_network_scenario_v1', 'EMPTY_LIST'));
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText('No matches for this configuration.', { exact: true })).toBeVisible();
});
test('timeout after commit recovers across refresh without duplicates', async ({ page }) => {
  await setupIsolatedGame(page, { scenario: 'POST_TIMEOUT_THEN_RECOVER' });
  await play(page);
  await page.evaluate(() => window.__PIXI_TEST_HOOKS__!.finishMatch(25));
  await expect(
    page.getByRole('status').filter({ hasText: 'Saved locally. Upload pending.' })
  ).toBeVisible({ timeout: 10000 });
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('pb_pending_sync_matches_v1') || '[]').length
      )
    )
    .toBe(1);
  await page.evaluate(() => localStorage.setItem('pb_active_network_scenario_v1', 'SUCCESS'));
  await page.reload();
  await page.getByRole('button', { name: 'MATCH HISTORY', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('pb_pending_sync_matches_v1') || '[]').length
      )
    )
    .toBe(0);
  await expect(page.getByRole('cell', { name: '25', exact: true })).toHaveCount(1);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('pb_msw_confirmed_matches_v1') || '[]').filter(
          (record: { score: number }) => record.score === 25
        ).length
    )
  ).toBe(1);
});
test('switching tabs prevents a delayed ranking response from replacing history', async ({
  page,
}) => {
  await setupIsolatedGame(page, { scenario: 'OUT_OF_ORDER' });
  await page.getByRole('button', { name: 'RANKING', exact: true }).click();
  await page.getByRole('tab', { name: 'MATCH HISTORY', exact: true }).click();
  await expect(page.getByText('No matches played yet.', { exact: true })).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(page.getByText('No matches played yet.', { exact: true })).toBeVisible();
  await expect(page.getByText('Captain Flint', { exact: true })).toHaveCount(0);
});

test('history paginates completed matches and both tabs refresh after registration', async ({
  page,
}) => {
  await setupIsolatedGame(page);
  await play(page);
  for (let score = 41; score <= 46; score++) {
    await page.evaluate((value) => window.__PIXI_TEST_HOOKS__!.finishMatch(value), score);
    await expect(page.getByText('Match saved', { exact: true })).toBeVisible();
    if (score < 46) await page.getByRole('button', { name: 'PLAY AGAIN', exact: true }).click();
  }
  await page.getByRole('button', { name: 'MAIN MENU', exact: true }).click();
  await page.evaluate(() => localStorage.setItem('pb_test_latency_ms', '800'));
  await page.getByRole('button', { name: 'MATCH HISTORY', exact: true }).click();
  await expect(page.getByText('Loading naval records...', { exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '46', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByRole('cell', { name: '41', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
  await page.getByRole('tab', { name: 'RANKING', exact: true }).click();
  await expect(page.getByRole('cell', { name: '46', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'MAIN MENU', exact: true }).click();
  await page.evaluate(() => {
    localStorage.setItem('pb_test_latency_ms', '0');
    localStorage.setItem('pb_active_network_scenario_v1', 'HISTORY_FAILURE');
  });
  await page.getByRole('button', { name: 'MATCH HISTORY', exact: true }).click();
  await expect(page.getByText('Could not load records.', { exact: true })).toBeVisible();
});

test('unavailable registration permits another match and later retries once', async ({ page }) => {
  await setupIsolatedGame(page, { scenario: 'POST_SERVICE_UNAVAILABLE_503' });
  await play(page);
  await page.evaluate(() => window.__PIXI_TEST_HOOKS__!.finishMatch(28));
  await expect(page.getByRole('button', { name: 'Retry upload', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'PLAY AGAIN', exact: true }).click();
  expect(await page.evaluate(() => window.__PIXI_TEST_HOOKS__!.getState().running)).toBe(true);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'MAIN MENU', exact: true }).click();
  await page.evaluate(() => localStorage.setItem('pb_active_network_scenario_v1', 'SUCCESS'));
  await page.getByRole('button', { name: 'Last result', exact: true }).click();
  await page.getByRole('button', { name: 'Retry upload', exact: true }).click();
  await expect(page.getByText('Match saved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'MAIN MENU', exact: true }).click();
  await page.getByRole('button', { name: 'MATCH HISTORY', exact: true }).click();
  await expect(page.getByRole('cell', { name: '28', exact: true })).toHaveCount(1);
});
