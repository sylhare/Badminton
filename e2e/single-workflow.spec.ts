import { test, expect } from '@playwright/test';

import {
  goToApp,
  addSinglePlayer,
  toggleFirstPlayer,
  completeFullWorkflow,
  BULK_PLAYERS,
} from './helpers';

test.describe('Single Player Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Complete single player workflow - add one by one', async ({ page }) => {
    for (const playerName of BULK_PLAYERS.slice(0, 6)) {
      await addSinglePlayer(page, playerName);
    }

    await expect(page.getByTestId('stats-total-count')).toHaveText('6');
    await expect(page.getByTestId('stats-present-count')).toHaveText('6');

    await toggleFirstPlayer(page);

    await expect(page.getByTestId('stats-present-count')).toHaveText('5');
    await expect(page.getByTestId('stats-absent-count')).toHaveText('1');

    await toggleFirstPlayer(page);

    await completeFullWorkflow(page, 6, 2);
  });

  test('Single player additions with immediate play', async ({ page }) => {
    await addSinglePlayer(page, BULK_PLAYERS[0]);
    await addSinglePlayer(page, BULK_PLAYERS[1]);
    await addSinglePlayer(page, BULK_PLAYERS[2]);
    await addSinglePlayer(page, BULK_PLAYERS[3]);

    await expect(page.getByTestId('stats-total-count')).toHaveText('4');
    await expect(page.getByTestId('stats-present-count')).toHaveText('4');

    await completeFullWorkflow(page, 4, 1);
  });
});
