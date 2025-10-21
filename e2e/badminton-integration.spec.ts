import { test, expect } from '@playwright/test';
import { TestHelpers, ANIMATION_TIMEOUT, TRANSITION_TIMEOUT } from './helpers';

test.describe('Badminton Court Manager - Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await TestHelpers.setupCleanState(page);
  });

  test('Player addition workflow', async ({ page }) => {
    await expect(page).toHaveTitle(/Badminton/);
    await expect(page.locator('h1')).toContainText('🏸 Badminton Court Manager');

    const bulkPlayerNames = [
      'Alice Johnson',
      'Bob Smith', 
      'Charlie Davis',
      'Diana Wilson',
      'Emma Brown',
      'Frank Miller',
      'Grace Lee',
    ];

    await TestHelpers.addBulkPlayers(page, bulkPlayerNames);
    await expect(page.getByTestId('stats-present-count').first()).toHaveText('7');

    await TestHelpers.addSinglePlayer(page, 'Henry Garcia');
    await TestHelpers.addSinglePlayer(page, 'Ivy Thompson');
    
    await expect(page.getByTestId('stats-total-count').first()).toHaveText('9');

    const firstRemoveButton = page.locator('[data-testid^="remove-player-"]').first();
    await expect(firstRemoveButton).toBeVisible();
    await firstRemoveButton.click();

    await expect(page.getByTestId('stats-total-count').first()).toHaveText('8');
    await expect(page.getByTestId('stats-present-count').first()).toHaveText('8');
  });

  test('Court generation and match workflow', async ({ page }) => {
    const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Emma', 'Frank', 'Grace', 'Henry'];
    await TestHelpers.addBulkPlayers(page, playerNames);
    
    await expect(page.getByTestId('stats-present-count').first()).toHaveText('8');

    await expect(page.locator('h2').filter({ hasText: /Court Settings/ }).first()).toBeVisible();

    const generateButton = page.getByTestId('generate-assignments-button').locator(':visible').first();
    await expect(generateButton).toBeVisible();
    await generateButton.click();

    await expect(page.locator('[data-testid^="court-"]')).toHaveCount(4);

    const firstCourt = page.getByTestId('court-1').locator(':visible').first();
    await expect(firstCourt.locator('.court-header')).toContainText('Court 1');
  });

  test('Match completion and winner selection', async ({ page }) => {
    const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Emma', 'Frank', 'Grace', 'Henry'];
    await TestHelpers.addBulkPlayers(page, playerNames);
    
    const generateButton = page.getByTestId('generate-assignments-button').locator(':visible').first();
    await generateButton.click();
    await expect(page.locator('[data-testid^="court-"]')).toHaveCount(4);

    const court1 = page.getByTestId('court-1').first();
    const firstTeam = court1.locator('.team-clickable').first();
    await expect(firstTeam).toBeVisible();
    await firstTeam.click();

    await TestHelpers.waitForStableView(page, ANIMATION_TIMEOUT);

    const winnerElements = page.locator('.crown, .team-winner');
    await expect(winnerElements).toHaveCount(4);

    const leaderboard = page.locator('h2').filter({ hasText: 'Leaderboard' });
    await expect(leaderboard).toBeVisible();
  });

  test('New assignment generation workflow', async ({ page }) => {
    const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Emma', 'Frank', 'Grace', 'Henry'];
    await TestHelpers.addBulkPlayers(page, playerNames);
    
    const generateButton = page.getByTestId('generate-assignments-button').locator(':visible').first();
    await generateButton.click();

    const firstTeam = page.locator('.team-clickable').first();
    await firstTeam.click();
    await TestHelpers.waitForStableView(page, ANIMATION_TIMEOUT);

    const generateNewButton = page.getByTestId('generate-new-assignments-button').locator(':visible').first();
    await expect(generateNewButton).toBeVisible();
    await generateNewButton.click();

    await expect(page.locator('[data-testid^="court-"]')).toHaveCount(4);
  });

  test('Player toggle functionality', async ({ page }) => {
    await TestHelpers.addSinglePlayer(page, 'Test Player 1');
    await TestHelpers.addSinglePlayer(page, 'Test Player 2');

    await expect(page.getByTestId('stats-present-count').first()).toHaveText('2');
    await expect(page.getByTestId('stats-absent-count').first()).toHaveText('0');

    const firstCheckbox = page.locator('[data-testid^="player-checkbox-"]').first();
    await expect(firstCheckbox).toBeVisible();
    await firstCheckbox.uncheck();

    await expect(page.getByTestId('stats-present-count').first()).toHaveText('1');
    await expect(page.getByTestId('stats-absent-count').first()).toHaveText('1');

    await firstCheckbox.check();

    await expect(page.getByTestId('stats-present-count').first()).toHaveText('2');
    await expect(page.getByTestId('stats-absent-count').first()).toHaveText('0');
  });

  test('Manual court assignment functionality', async ({ page }) => {
    const playerNames = ['Alice Johnson', 'Bob Smith', 'Charlie Davis', 'Diana Wilson', 'Emma Brown', 'Frank Miller'];
    await TestHelpers.addBulkPlayers(page, playerNames);

    await expect(page.getByTestId('stats-total-count').first()).toHaveText('6');

    const generateButton = page.getByTestId('generate-assignments-button').locator(':visible').first();
    await expect(generateButton).toBeVisible();
    await generateButton.click();

    const manualCourtHeader = page.getByTestId('manual-court-header').locator(':visible').first();
    await expect(manualCourtHeader).toBeVisible();
    await manualCourtHeader.click();
    await TestHelpers.waitForStableView(page, TRANSITION_TIMEOUT);

    const firstPlayer = page.locator('[data-testid^="manual-court-player-"]').first();
    await expect(firstPlayer).toBeVisible();
    await firstPlayer.click();

    const secondPlayer = page.locator('[data-testid^="manual-court-player-"]').nth(1);
    await expect(secondPlayer).toBeVisible();
    await secondPlayer.click();

    await expect(page.locator('.selection-count')).toContainText('2/4 players selected');
    await expect(page.locator('.match-preview')).toContainText('Will create: Singles match');

    const generateNewButton = page.getByTestId('generate-new-assignments-button').locator(':visible').first();
    await expect(generateNewButton).toBeVisible();
    await generateNewButton.click();

    await TestHelpers.waitForStableView(page, TRANSITION_TIMEOUT);
    const court1 = page.getByTestId('court-1').locator(':visible').first();
    await expect(court1).toBeVisible();
    await expect(court1.locator('.manual-court-icon')).toBeVisible();
  });

  test('Clear all players functionality', async ({ page }) => {
    const playerNames = ['Player 1', 'Player 2', 'Player 3'];
    await TestHelpers.addBulkPlayers(page, playerNames);

    await expect(page.getByTestId('stats-total-count').first()).toHaveText('3');

    const clearAllButton = page.getByTestId('clear-all-button').locator(':visible').first();
    await expect(clearAllButton).toBeVisible();
    await clearAllButton.click();

    const confirmModal = page.getByTestId('confirm-modal');
    await expect(confirmModal).toBeVisible();
    
    const confirmButton = page.getByTestId('confirm-modal-confirm');
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    await expect(page.locator('.player-list')).toHaveCount(0);
    await expect(page.getByTestId('player-stats')).toHaveCount(0);
  });

  test('App resilience after session data loss', async ({ page }) => {
    const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana'];
    await TestHelpers.addBulkPlayers(page, playerNames);

    await expect(page.getByTestId('stats-total-count').first()).toHaveText('4');

    const generateButton = page.getByTestId('generate-assignments-button').locator(':visible').first();
    await generateButton.click();

    await expect(page.locator('[data-testid^="court-"]')).toHaveCount(2);

    const firstTeam = page.locator('.team-clickable').first();
    await expect(firstTeam).toBeVisible();
    await firstTeam.click();
    await TestHelpers.waitForStableView(page, ANIMATION_TIMEOUT);

    await expect(page.locator('.crown')).toHaveCount(2);

    const generateNewButton = page.getByTestId('generate-new-assignments-button').locator(':visible').first();
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

    await TestHelpers.addSinglePlayer(page, 'New Player');
    await expect(page.getByTestId('stats-total-count').first()).toHaveText('1');
    await expect(page.getByTestId('stats-present-count').first()).toHaveText('1');

    await TestHelpers.addSinglePlayer(page, 'Second Player');

    const newGenerateButton = page.getByTestId('generate-assignments-button').locator(':visible').first();
    await expect(newGenerateButton).toBeVisible();
    await newGenerateButton.click();

    await expect(page.locator('[data-testid^="court-"]')).toHaveCount(2);
  });
});
