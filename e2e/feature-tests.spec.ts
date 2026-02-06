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

    const firstToggleButton = page.locator('[data-testid^="toggle-presence-"]').first();
    await firstToggleButton.click();

    await expect(page.getByTestId('stats-present-count')).toHaveText('1');
    await expect(page.getByTestId('stats-absent-count')).toHaveText('1');

    await firstToggleButton.click();

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

  test.describe('Player removal modal', () => {
    test('confirm removal', async ({ page }) => {
      await addSinglePlayer(page, 'Test Player 1');
      await addSinglePlayer(page, 'Test Player 2');

      await expect(page.getByTestId('stats-total-count')).toHaveText('2');

      const firstRemoveButton = page.locator('[data-testid^="remove-player-"]').first();
      await firstRemoveButton.click();

      const modal = page.getByTestId('player-removal-modal');
      await expect(modal).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Remove Player' })).toBeVisible();
      await expect(modal.getByText(/Test Player 1/)).toBeVisible();

      await page.getByTestId('player-removal-modal-remove').click();

      await expect(page.getByTestId('player-removal-modal')).not.toBeVisible();
      await expect(page.getByTestId('stats-total-count')).toHaveText('1');
    });

    test('mark as absent', async ({ page }) => {
      await addSinglePlayer(page, 'Test Player 1');
      await addSinglePlayer(page, 'Test Player 2');

      await expect(page.getByTestId('stats-total-count')).toHaveText('2');
      await expect(page.getByTestId('stats-present-count')).toHaveText('2');

      const firstRemoveButton = page.locator('[data-testid^="remove-player-"]').first();
      await firstRemoveButton.click();

      await expect(page.getByTestId('player-removal-modal')).toBeVisible();

      await page.getByTestId('player-removal-modal-absent').click();

      await expect(page.getByTestId('player-removal-modal')).not.toBeVisible();
      await expect(page.getByTestId('stats-total-count')).toHaveText('2');
      await expect(page.getByTestId('stats-present-count')).toHaveText('1');
      await expect(page.getByTestId('stats-absent-count')).toHaveText('1');
    });

    test('cancel with X button', async ({ page }) => {
      await addSinglePlayer(page, 'Test Player 1');
      await addSinglePlayer(page, 'Test Player 2');

      await expect(page.getByTestId('stats-total-count')).toHaveText('2');

      const firstRemoveButton = page.locator('[data-testid^="remove-player-"]').first();
      await firstRemoveButton.click();

      await expect(page.getByTestId('player-removal-modal')).toBeVisible();

      await page.getByTestId('player-removal-modal-close').click();

      await expect(page.getByTestId('player-removal-modal')).not.toBeVisible();
      await expect(page.getByTestId('stats-total-count')).toHaveText('2');
      await expect(page.getByTestId('stats-present-count')).toHaveText('2');
    });

    test('cancel by clicking overlay', async ({ page }) => {
      await addSinglePlayer(page, 'Test Player 1');

      await expect(page.getByTestId('stats-total-count')).toHaveText('1');

      const removeButton = page.locator('[data-testid^="remove-player-"]').first();
      await removeButton.click();

      await expect(page.getByTestId('player-removal-modal')).toBeVisible();

      const overlay = page.getByTestId('player-removal-modal');
      await overlay.click({ position: { x: 10, y: 10 } });

      await expect(page.getByTestId('player-removal-modal')).not.toBeVisible();
      await expect(page.getByTestId('stats-total-count')).toHaveText('1');
    });
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

  test('Leaderboard updates in real-time when changing winners', async ({ page }) => {
    const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
    await addBulkPlayers(page, players);

    await expect(page.getByTestId('stats-total-count')).toHaveText('4');

    const generateButton = page.getByTestId('generate-assignments-button');
    await generateButton.click();

    await expect(page.locator('[data-testid^="court-"]')).toHaveCount(1);

    const leaderboardBefore = page.locator('h2').filter({ hasText: 'Leaderboard' });
    await expect(leaderboardBefore).not.toBeVisible();

    const firstTeam = page.locator('.team-clickable').first();
    await firstTeam.click();
    await page.waitForTimeout(200);

    await expect(page.locator('.crown')).toHaveCount(1);

    const leaderboardAfterFirstClick = page.locator('h2').filter({ hasText: 'Leaderboard' });
    await expect(leaderboardAfterFirstClick).toBeVisible();

    const leaderboardRows = page.locator('.leaderboard-table tbody tr');
    await expect(leaderboardRows).toHaveCount(2);

    const firstRowWins = leaderboardRows.first().locator('td').nth(2);
    await expect(firstRowWins).toHaveText('1');

    const secondTeam = page.locator('.team-clickable').last();
    await secondTeam.click();
    await page.waitForTimeout(200);

    await expect(page.locator('.crown')).toHaveCount(1);

    const leaderboardAfterSecondClick = page.locator('h2').filter({ hasText: 'Leaderboard' });
    await expect(leaderboardAfterSecondClick).toBeVisible();

    const updatedLeaderboardRows = page.locator('.leaderboard-table tbody tr');
    await expect(updatedLeaderboardRows).toHaveCount(2);

    const firstRowWinsAfterSwitch = updatedLeaderboardRows.first().locator('td').nth(2);
    await expect(firstRowWinsAfterSwitch).toHaveText('1');

    await secondTeam.click();
    await page.waitForTimeout(200);

    await expect(page.locator('.crown')).toHaveCount(0);

    const leaderboardAfterRemoval = page.locator('h2').filter({ hasText: 'Leaderboard' });
    await expect(leaderboardAfterRemoval).not.toBeVisible();
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

  test('Force bench players and verify bench count updates', async ({ page }) => {
    const players = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'];
    await addBulkPlayers(page, players);

    await expect(page.getByTestId('stats-total-count')).toHaveText('10');

    const courtInput = page.locator('#courts');
    await expect(courtInput).toBeVisible();
    await courtInput.fill('2');

    const generateButton = page.getByTestId('generate-assignments-button');
    await generateButton.click();

    await expect(page.locator('[data-testid^="court-"]')).toHaveCount(2);

    const benchSection = page.locator('.bench-section');
    await expect(benchSection).toBeVisible();
    await expect(benchSection.locator('.bench-header')).toContainText('Bench (2 players)');

    const initialBenchedPlayers = await benchSection.locator('.bench-player').allTextContents();
    expect(initialBenchedPlayers.length).toBe(2);

    const viewBenchCountsButton = page.getByTestId('view-bench-counts-button');
    await expect(viewBenchCountsButton).toBeVisible();
    await viewBenchCountsButton.click();

    await page.waitForTimeout(300);

    const playerBenchRows = page.locator('.player-bench-row');
    await expect(playerBenchRows.first()).toBeVisible();

    for (const benchedPlayer of initialBenchedPlayers) {
      const playerItem = page.locator('.player-item').filter({ hasText: benchedPlayer.trim() });
      const benchCount = playerItem.locator('.bench-count-label strong');
      await expect(benchCount).toHaveText('1');
    }

    const aliceItem = page.locator('.player-item').filter({ hasText: 'Alice' });
    const bobItem = page.locator('.player-item').filter({ hasText: 'Bob' });

    const aliceInitialBenchText = await aliceItem.locator('.bench-count-emoji').textContent() || '🪑 0';
    const aliceInitialBenchCount = parseInt(aliceInitialBenchText.replace('🪑', '').trim());
    const bobInitialBenchText = await bobItem.locator('.bench-count-emoji').textContent() || '🪑 0';
    const bobInitialBenchCount = parseInt(bobInitialBenchText.replace('🪑', '').trim());

    const aliceBenchToggle = aliceItem.locator('.bench-next-toggle');
    const bobBenchToggle = bobItem.locator('.bench-next-toggle');

    await aliceBenchToggle.click();
    await bobBenchToggle.click();

    await expect(aliceItem.locator('.toggle-switch')).toHaveClass(/active/);
    await expect(bobItem.locator('.toggle-switch')).toHaveClass(/active/);

    const generateNewButton = page.getByTestId('generate-new-assignments-button');
    await generateNewButton.click();
    await page.waitForTimeout(500);

    const newBenchSection = page.locator('.bench-section');
    await expect(newBenchSection).toBeVisible();

    const newBenchedPlayers = await newBenchSection.locator('.bench-player').allTextContents();
    expect(newBenchedPlayers).toContain('Alice');
    expect(newBenchedPlayers).toContain('Bob');

    await viewBenchCountsButton.click();
    await page.waitForTimeout(300);

    const aliceItemAfter = page.locator('.player-item').filter({ hasText: 'Alice' });
    const bobItemAfter = page.locator('.player-item').filter({ hasText: 'Bob' });
    const aliceBenchCount = aliceItemAfter.locator('.bench-count-emoji');
    const bobBenchCount = bobItemAfter.locator('.bench-count-emoji');

    await expect(aliceBenchCount).toContainText((aliceInitialBenchCount + 1).toString());
    await expect(bobBenchCount).toContainText((bobInitialBenchCount + 1).toString());

    await expect(aliceItemAfter.locator('.toggle-switch')).not.toHaveClass(/active/);
    await expect(bobItemAfter.locator('.toggle-switch')).not.toHaveClass(/active/);
  });

  test('Bench counts are always visible in Manage Players', async ({ page }) => {
    const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
    await addBulkPlayers(page, players);

    const managePlayersStep = page.locator('.step').filter({ hasText: 'Manage Players' });
    await managePlayersStep.click();
    await page.waitForTimeout(200);

    const playerBenchRows = page.locator('.player-bench-row');
    await expect(playerBenchRows.first()).toBeVisible();

    const aliceItem = page.locator('.player-item').filter({ hasText: 'Alice' });
    const benchCount = aliceItem.locator('.bench-count-emoji');
    await expect(benchCount).toContainText('0');

    const benchToggle = aliceItem.locator('.bench-next-toggle');
    await expect(benchToggle).toBeVisible();
  });
});
