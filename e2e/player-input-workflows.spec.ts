import { test, expect } from '@playwright/test';

import {
  goToApp,
  addBulkPlayers,
  addSinglePlayer,
  expandSectionIfNeeded,
  removeFirstPlayer,
  toggleFirstPlayer,
  completeFullWorkflow,
  BULK_PLAYERS,
  SINGLE_PLAYERS,
} from './helpers';

test.describe('Player Input Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Bulk workflow - add all at once, remove one, then play', async ({ page }) => {
    await addBulkPlayers(page, BULK_PLAYERS);

    await expect(page.getByTestId('stats-present-count')).toHaveText('7');
    await expect(page.getByTestId('stats-total-count')).toHaveText('7');

    await removeFirstPlayer(page);

    await expect(page.getByTestId('stats-total-count')).toHaveText('6');
    await expect(page.getByTestId('stats-present-count')).toHaveText('6');

    await completeFullWorkflow(page, 6, 2);
  });

  test('Bulk workflow - large player list', async ({ page }) => {
    const largeBulkList = [
      ...BULK_PLAYERS,
      'Henry Garcia',
      'Ivy Thompson',
      'Jack Wilson',
      'Kate Brown',
      'Liam Davis',
      'Maya Smith',
    ];

    await addBulkPlayers(page, largeBulkList);

    await expect(page.getByTestId('stats-total-count')).toHaveText('13');
    await expect(page.getByTestId('stats-present-count')).toHaveText('13');

    await completeFullWorkflow(page, 13, 3);
  });

  test('Single workflow - add one by one with toggle', async ({ page }) => {
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

  test('Mixed workflow - bulk first, then single additions', async ({ page }) => {
    await addBulkPlayers(page, BULK_PLAYERS);

    await expect(page.getByTestId('stats-present-count')).toHaveText('7');

    await expandSectionIfNeeded(page, 'Manage Players');

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
});
