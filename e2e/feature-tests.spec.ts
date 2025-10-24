import { test, expect } from '@playwright/test';

import { goToApp, addSinglePlayer, addBulkPlayers } from './helpers';

test.describe('Feature Tests', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Player toggle functionality', async ({ page }) => {
    await addSinglePlayer(page, 'Test Player 1');
    await addSinglePlayer(page, 'Test Player 2');

    await expect(page.getByTestId('stats-present-count')).toHaveText('2');
    await expect(page.getByTestId('stats-absent-count')).toHaveText('0');

    const firstCheckbox = page.locator('[data-testid^="player-checkbox-"]').first();
    await firstCheckbox.uncheck();

    await expect(page.getByTestId('stats-present-count')).toHaveText('1');
    await expect(page.getByTestId('stats-absent-count')).toHaveText('1');

    await firstCheckbox.check();

    await expect(page.getByTestId('stats-present-count')).toHaveText('2');
    await expect(page.getByTestId('stats-absent-count')).toHaveText('0');
  });

  test('Manual court assignment functionality', async ({ page }) => {
    const players = ['Alice Johnson', 'Bob Smith', 'Charlie Davis', 'Diana Wilson', 'Emma Brown', 'Frank Miller'];
    await addBulkPlayers(page, players);

    await expect(page.getByTestId('stats-total-count')).toHaveText('6');

    const generateButton = page.getByTestId('generate-assignments-button');
    await expect(generateButton).toBeVisible();
    await generateButton.click();

    const manualCourtHeader = page.getByTestId('manual-court-header');
    await expect(manualCourtHeader).toBeVisible();
    await manualCourtHeader.click();
    await page.waitForTimeout(500);

    const firstPlayer = page.locator('[data-testid^="manual-court-player-"]').first();
    await expect(firstPlayer).toBeVisible();
    await firstPlayer.click();

    const secondPlayer = page.locator('[data-testid^="manual-court-player-"]').nth(1);
    await expect(secondPlayer).toBeVisible();
    await secondPlayer.click();

    await expect(page.locator('.selection-count')).toContainText('2/4 players selected');
    await expect(page.locator('.match-preview')).toContainText('Will create: Singles match');

    const generateNewButton = page.getByTestId('generate-new-assignments-button');
    await expect(generateNewButton).toBeVisible();
    await generateNewButton.click();

    await page.waitForTimeout(500);
    const court1 = page.getByTestId('court-1');
    await expect(court1).toBeVisible();
    await expect(court1.locator('.manual-court-icon')).toBeVisible();

    await manualCourtHeader.click();
    await page.waitForTimeout(500);
  });

  test('Clear all players functionality', async ({ page }) => {
    const players = ['Player 1', 'Player 2', 'Player 3'];
    await addBulkPlayers(page, players);

    await expect(page.getByTestId('stats-total-count')).toHaveText('3');

    await page.getByTestId('clear-all-button').click();

    await expect(page.getByTestId('confirm-modal')).toBeVisible();
    await page.getByTestId('confirm-modal-confirm').click();

    await expect(page.locator('.player-list')).toHaveCount(0);
    await expect(page.getByTestId('player-stats')).toHaveCount(0);
  });

  test('App resilience after session data loss', async ({ page }) => {
    const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
    await addBulkPlayers(page, players);

    await expect(page.getByTestId('stats-total-count')).toHaveText('4');

    const generateButton = page.getByTestId('generate-assignments-button');
    await generateButton.click();

    await expect(page.locator('[data-testid^="court-"]')).toHaveCount(1);

    const firstTeam = page.locator('.team-clickable').first();
    await firstTeam.click();
    await page.waitForTimeout(300);

    await expect(page.locator('.crown')).toHaveCount(1);

    const generateNewButton = page.getByTestId('generate-new-assignments-button');
    await generateNewButton.click();

    const leaderboard = page.locator('h2').filter({ hasText: 'Leaderboard' });
    await expect(leaderboard).toBeVisible();

    await page.evaluate(() => {
      localStorage.clear();
    });

    await page.reload();

    await expect(page).toHaveTitle(/Badminton/);
    await expect(page.locator('h1')).toContainText('🏸 Badminton Court Manager');

    await expect(page.getByTestId('player-stats')).toHaveCount(0);
    await expect(page.locator('.player-list')).toHaveCount(0);

    await addSinglePlayer(page, 'New Player');
    await expect(page.getByTestId('stats-total-count')).toHaveText('1');
    await expect(page.getByTestId('stats-present-count')).toHaveText('1');

    await addSinglePlayer(page, 'Second Player');

    const newGenerateButton = page.getByTestId('generate-assignments-button');
    await expect(newGenerateButton).toBeVisible();
    await newGenerateButton.click();

    await expect(page.locator('[data-testid^="court-"]')).toHaveCount(1);
  });
});
