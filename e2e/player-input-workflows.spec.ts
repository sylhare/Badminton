import path from 'path';
import { fileURLToPath } from 'url';

import { test, expect } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import {
  goToApp,
  addBulkPlayers,
  addSinglePlayer,
  expandSectionIfNeeded,
  removeFirstPlayer,
  toggleFirstPlayer,
  completeFullWorkflow,
  generateCourtAssignments,
  selectWinnerOnFirstCourt,
  generateNewAssignments,
  verifyLeaderboard,
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
    const input = page.getByTestId('player-entry-input');
    await input.fill(BULK_PLAYERS.join(','));

    await test.step('multi-player hint shows with correct count and button label', async () => {
      await expect(page.locator('.multi-input-hint')).toBeVisible();
      await expect(page.locator('.multi-input-hint')).toContainText(`Detected ${BULK_PLAYERS.length} players`);
      await expect(page.getByTestId('add-player-button')).toContainText(`Add ${BULK_PLAYERS.length} Players`);
    });

    await page.getByTestId('add-player-button').click();
    await page.waitForTimeout(100);

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

  test('Image workflow - import players from image', async ({ page }) => {
    const imagePath = path.join(__dirname, '../tests/data/names.png');

    await test.step('open image upload modal', async () => {
      await page.getByTestId('open-image-modal-button').click();
      await expect(page.getByTestId('image-upload-modal')).toBeVisible();
    });

    await test.step('upload image and wait for OCR results', async () => {
      await page.getByTestId('image-file-input').setInputFiles(imagePath);
      await expect(page.locator('.extracted-players-section')).toBeVisible({ timeout: 30000 });
      const extractedCount = await page.locator('[data-testid^="extracted-player-"]').count();
      expect(extractedCount).toBeGreaterThanOrEqual(4);
      await expect(page.getByTestId('add-extracted-players-button')).toBeEnabled();
    });

    await test.step('deselect all disables button, select all re-enables it', async () => {
      await page.getByRole('button', { name: 'Deselect all' }).click();
      await expect(page.getByTestId('add-extracted-players-button')).toBeDisabled();
      await page.getByRole('button', { name: 'Select all', exact: true }).click();
      await expect(page.getByTestId('add-extracted-players-button')).toBeEnabled();
    });

    await test.step('add extracted players closes modal and updates count', async () => {
      await page.getByTestId('add-extracted-players-button').click();
      await expect(page.getByTestId('image-upload-modal')).not.toBeVisible();
      const totalCount = parseInt(await page.getByTestId('stats-total-count').textContent() ?? '0');
      expect(totalCount).toBeGreaterThanOrEqual(4);
    });

    await generateCourtAssignments(page);
    await selectWinnerOnFirstCourt(page);
    await generateNewAssignments(page);
    await verifyLeaderboard(page);
  });
});
