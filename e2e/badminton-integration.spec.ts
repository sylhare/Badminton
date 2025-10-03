import { test, expect } from '@playwright/test';

test.describe('Badminton Court Manager - Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    const targetUrl = process.env.E2E_BASE_URL || 'http://localhost:5173';

    // Use absolute URL directly since baseURL configuration doesn't work with subpaths
    await page.goto(targetUrl);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Complete player management and match workflow', async ({ page }) => {
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

    const bulkTextarea = page.getByTestId('bulk-input');
    await expect(bulkTextarea).toBeVisible();

    await bulkTextarea.fill(bulkPlayerNames.join('\n'));
    await page.getByTestId('add-bulk-button').click();

    await expect(page.getByTestId('stats-present-count')).toHaveText('7');

    const addPlayersHeader = page.locator('h2').filter({ hasText: 'Add Players' });
    await addPlayersHeader.click();

    const singlePlayerInput = page.getByTestId('single-player-input');

    await singlePlayerInput.fill('Henry Garcia');
    await page.getByTestId('add-single-button').click();

    await singlePlayerInput.fill('Ivy Thompson');
    await page.getByTestId('add-single-button').click();

    await expect(page.getByTestId('stats-total-count')).toHaveText('9');

    const firstRemoveButton = page.locator('[data-testid^="remove-player-"]').first();
    await firstRemoveButton.click();

    await expect(page.getByTestId('stats-total-count')).toHaveText('8');
    await expect(page.getByTestId('stats-present-count')).toHaveText('8');

    await expect(page.locator('h2').filter({ hasText: /Court Settings/ })).toBeVisible();

    const generateButton = page.getByTestId('generate-assignments-button');
    await expect(generateButton).toBeVisible();
    await generateButton.click();

    await expect(page.locator('[data-testid^="court-"]')).toHaveCount(2);

    const firstCourt = page.getByTestId('court-1');
    await expect(firstCourt.locator('.court-header')).toContainText('Court 1');

    const court1 = page.getByTestId('court-1');

    const firstTeam = court1.locator('.team-clickable').first();
    await expect(firstTeam).toBeVisible();
    await firstTeam.click();

    await page.waitForTimeout(300);

    const winnerElement = page.locator('.crown, .team-winner');
    await expect(winnerElement).toHaveCount(2);

    const generateNewButton = page.getByTestId('generate-new-assignments-button');
    await generateNewButton.click();

    await expect(page.locator('[data-testid^="court-"]')).toHaveCount(2);

    const newCourtCards = page.locator('[data-testid^="court-"]');
    await expect(newCourtCards).toHaveCount(2);

    const leaderboard = page.locator('h2').filter({ hasText: 'Leaderboard' });
    await expect(leaderboard).toBeVisible();

    await expect(page.getByTestId('stats-present-count')).toHaveText('8');
  });

  test('Player toggle functionality', async ({ page }) => {
    const targetUrl = process.env.E2E_BASE_URL || 'http://localhost:5173';
    await page.goto(targetUrl);

    const singlePlayerInput = page.getByTestId('single-player-input');
    await singlePlayerInput.fill('Test Player 1');
    await page.getByTestId('add-single-button').click();

    await singlePlayerInput.fill('Test Player 2');
    await page.getByTestId('add-single-button').click();

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
    await page.goto('/');

    const bulkTextarea = page.getByTestId('bulk-input');
    await bulkTextarea.fill('Alice Johnson\nBob Smith\nCharlie Davis\nDiana Wilson\nEmma Brown\nFrank Miller');
    await page.getByTestId('add-bulk-button').click();

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
    const targetUrl = process.env.E2E_BASE_URL || 'http://localhost:5173';
    await page.goto(targetUrl);

    const bulkTextarea = page.getByTestId('bulk-input');
    await bulkTextarea.fill('Player 1\nPlayer 2\nPlayer 3');
    await page.getByTestId('add-bulk-button').click();

    await expect(page.getByTestId('stats-total-count')).toHaveText('3');

    await page.getByTestId('clear-all-button').click();

    await expect(page.getByTestId('confirm-modal')).toBeVisible();
    await page.getByTestId('confirm-modal-confirm').click();

    await expect(page.locator('.player-list')).toHaveCount(0);
    await expect(page.getByTestId('player-stats')).toHaveCount(0);
  });

  test('App resilience after session data loss', async ({ page }) => {
    const targetUrl = process.env.E2E_BASE_URL || 'http://localhost:5173';
    await page.goto(targetUrl);

    const bulkTextarea = page.getByTestId('bulk-input');
    await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
    await page.getByTestId('add-bulk-button').click();

    await expect(page.getByTestId('stats-total-count')).toHaveText('4');

    const generateButton = page.getByTestId('generate-assignments-button');
    await generateButton.click();

    await expect(page.locator('[data-testid^="court-"]')).toHaveCount(1);

    const firstTeam = page.locator('.team-clickable').first();
    await firstTeam.click();
    await page.waitForTimeout(300);

    await expect(page.locator('.crown')).toHaveCount(1); // Only one crown per team

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

    const singlePlayerInput = page.getByTestId('single-player-input');
    await singlePlayerInput.fill('New Player');
    await page.getByTestId('add-single-button').click();

    await expect(page.getByTestId('stats-total-count')).toHaveText('1');
    await expect(page.getByTestId('stats-present-count')).toHaveText('1');

    await singlePlayerInput.fill('Second Player');
    await page.getByTestId('add-single-button').click();

    const newGenerateButton = page.getByTestId('generate-assignments-button');
    await expect(newGenerateButton).toBeVisible();
    await newGenerateButton.click();

    await expect(page.locator('[data-testid^="court-"]')).toHaveCount(1);
  });
});
