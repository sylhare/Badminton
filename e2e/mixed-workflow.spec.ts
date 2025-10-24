import { test, expect } from '@playwright/test';

import {
  goToApp,
  addBulkPlayers,
  addSinglePlayer,
  expandStepIfNeeded,
  removeFirstPlayer,
  completeFullWorkflow,
  BULK_PLAYERS,
  SINGLE_PLAYERS,
} from './helpers';

test.describe('Mixed Player Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Mixed workflow - bulk first, then single additions', async ({ page }) => {
    await addBulkPlayers(page, BULK_PLAYERS);

    await expect(page.getByTestId('stats-present-count')).toHaveText('7');

    await expandStepIfNeeded(page, 'Add Players');

    await addSinglePlayer(page, SINGLE_PLAYERS[0]);
    await addSinglePlayer(page, SINGLE_PLAYERS[1]);

    await expect(page.getByTestId('stats-total-count')).toHaveText('9');

    await removeFirstPlayer(page);

    await expect(page.getByTestId('stats-total-count')).toHaveText('8');
    await expect(page.getByTestId('stats-present-count')).toHaveText('8');

    await completeFullWorkflow(page, 8, 2);
  });

  test('Mixed workflow - single first, then bulk addition', async ({ page }) => {
    await addSinglePlayer(page, SINGLE_PLAYERS[0]);
    await addSinglePlayer(page, SINGLE_PLAYERS[1]);

    await expect(page.getByTestId('stats-total-count')).toHaveText('2');

    await addBulkPlayers(page, BULK_PLAYERS.slice(0, 4));

    await expect(page.getByTestId('stats-total-count')).toHaveText('6');
    await expect(page.getByTestId('stats-present-count')).toHaveText('6');

    await completeFullWorkflow(page, 6, 2);
  });

  test('Complex mixed workflow with multiple alternations', async ({ page }) => {
    await addSinglePlayer(page, BULK_PLAYERS[0]);
    await addSinglePlayer(page, BULK_PLAYERS[1]);

    await addBulkPlayers(page, BULK_PLAYERS.slice(2, 5));

    await expandStepIfNeeded(page, 'Add Players');
    await addSinglePlayer(page, SINGLE_PLAYERS[0]);

    await expect(page.getByTestId('stats-total-count')).toHaveText('6');
    await expect(page.getByTestId('stats-present-count')).toHaveText('6');

    await completeFullWorkflow(page, 6, 2);
  });
});
