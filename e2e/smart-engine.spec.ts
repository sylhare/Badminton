import { test, expect } from '@playwright/test';

import {
  goToApp,
  addSinglePlayer,
  addBulkPlayers,
  setCourtCount,
  toggleSmartEngine,
  playRound,
} from './helpers';

test.describe('Smart Engine', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test.describe('Tooltip', () => {
    test('clicking tooltip icon shows popup without toggling smart engine', async ({ page }) => {
      await addSinglePlayer(page, 'Test Player');

      const toggle = page.getByTestId('smart-engine-toggle');
      await expect(toggle).not.toBeChecked();

      const tooltipIcon = page.getByTestId('smart-engine-tooltip-icon');
      await tooltipIcon.click();

      await expect(page.getByTestId('smart-engine-tooltip-popup')).toBeVisible();
      await expect(toggle).not.toBeChecked();
    });

    test('clicking outside closes the tooltip', async ({ page }) => {
      await addSinglePlayer(page, 'Test Player');

      const tooltipIcon = page.getByTestId('smart-engine-tooltip-icon');
      await tooltipIcon.click();

      await expect(page.getByTestId('smart-engine-tooltip-popup')).toBeVisible();

      await page.mouse.click(10, 10);

      await expect(page.getByTestId('smart-engine-tooltip-popup')).not.toBeVisible();
    });

    test('clicking icon again toggles the tooltip closed', async ({ page }) => {
      await addSinglePlayer(page, 'Test Player');

      const tooltipIcon = page.getByTestId('smart-engine-tooltip-icon');
      await tooltipIcon.click();
      await expect(page.getByTestId('smart-engine-tooltip-popup')).toBeVisible();

      await tooltipIcon.click();
      await expect(page.getByTestId('smart-engine-tooltip-popup')).not.toBeVisible();

      const toggle = page.getByTestId('smart-engine-toggle');
      await expect(toggle).not.toBeChecked();
    });

    test('hovering over the icon for 1.5s shows the tooltip', async ({ page }) => {
      await addSinglePlayer(page, 'Test Player');

      const tooltipIcon = page.getByTestId('smart-engine-tooltip-icon');

      await expect(page.getByTestId('smart-engine-tooltip-popup')).not.toBeVisible();

      await tooltipIcon.hover();
      await page.waitForTimeout(1800);

      await expect(page.getByTestId('smart-engine-tooltip-popup')).toBeVisible();
    });

    test('moving mouse away before delay hides tooltip', async ({ page }) => {
      await addSinglePlayer(page, 'Test Player');

      const tooltipIcon = page.getByTestId('smart-engine-tooltip-icon');

      await tooltipIcon.hover();
      await page.waitForTimeout(500);
      await page.mouse.move(10, 10);

      await expect(page.getByTestId('smart-engine-tooltip-popup')).not.toBeVisible();
    });

    test('moving mouse away after hover closes the tooltip', async ({ page }) => {
      await addSinglePlayer(page, 'Test Player');

      const tooltipIcon = page.getByTestId('smart-engine-tooltip-icon');

      await tooltipIcon.hover();
      await page.waitForTimeout(1800);
      await expect(page.getByTestId('smart-engine-tooltip-popup')).toBeVisible();

      await page.mouse.move(10, 10);
      await expect(page.getByTestId('smart-engine-tooltip-popup')).not.toBeVisible();
    });
  });

  test.describe('Toggle & theme', () => {
    test('toggling on applies .night-theme', async ({ page }) => {
      await addSinglePlayer(page, 'Test Player');

      await expect(page.locator('.app')).not.toHaveClass(/night-theme/);

      await toggleSmartEngine(page);

      await expect(page.locator('.app')).toHaveClass(/night-theme/);
    });

    test('toggling off removes .night-theme', async ({ page }) => {
      await addSinglePlayer(page, 'Test Player');

      await toggleSmartEngine(page);
      await expect(page.locator('.app')).toHaveClass(/night-theme/);

      await toggleSmartEngine(page);
      await expect(page.locator('.app')).not.toHaveClass(/night-theme/);
    });
  });

  test.describe('Score input modal', () => {
    test('clicking a team opens score-input-modal', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
      await addBulkPlayers(page, players);
      await setCourtCount(page, 1);

      await page.getByTestId('generate-assignments-button').click();
      await expect(page.locator('.court-card')).toHaveCount(1);

      const firstTeam = page.locator('.team-clickable').first();
      await firstTeam.click();

      await expect(page.getByTestId('score-input-modal')).toBeVisible();
    });

    test('cancelling does not set a winner', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
      await addBulkPlayers(page, players);
      await setCourtCount(page, 1);

      await page.getByTestId('generate-assignments-button').click();
      await expect(page.locator('.court-card')).toHaveCount(1);

      const firstTeam = page.locator('.team-clickable').first();
      await firstTeam.click();

      await expect(page.getByTestId('score-input-modal')).toBeVisible();

      await page.locator('[data-testid="score-input-modal"] .modal-close').click();

      await expect(page.getByTestId('score-input-modal')).not.toBeVisible();
      await expect(page.locator('.crown')).toHaveCount(0);
    });

    test('skipping sets winner without score', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
      await addBulkPlayers(page, players);
      await setCourtCount(page, 1);

      await page.getByTestId('generate-assignments-button').click();
      await expect(page.locator('.court-card')).toHaveCount(1);

      const firstTeam = page.locator('.team-clickable').first();
      await firstTeam.click();

      await expect(page.getByTestId('score-input-modal')).toBeVisible();
      await page.getByTestId('score-modal-skip').click();

      await expect(page.getByTestId('score-input-modal')).not.toBeVisible();
      await expect(page.locator('.crown')).toHaveCount(1);
    });

    test('entering score and confirming saves score; avg pts shows after regenerate', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
      await addBulkPlayers(page, players);
      await setCourtCount(page, 1);
      await toggleSmartEngine(page);

      await page.getByTestId('generate-assignments-button').click();
      await expect(page.locator('.court-card')).toHaveCount(1);

      const firstTeam = page.locator('.team-clickable').first();
      await firstTeam.click();

      await expect(page.getByTestId('score-input-modal')).toBeVisible();
      await page.getByTestId('score-input-team1').fill('21');
      await page.getByTestId('score-input-team2').fill('10');
      await page.getByTestId('score-modal-confirm').click();

      await expect(page.getByTestId('score-input-modal')).not.toBeVisible();
      await expect(page.locator('.crown')).toHaveCount(1);

      await page.getByTestId('generate-assignments-button').click();
      await page.waitForTimeout(300);

      const leaderboard = page.locator('.leaderboard-table');
      await expect(leaderboard).toBeVisible();
      const avgPtsHeader = page.getByTestId('leaderboard-avg-pts-header');
      await expect(avgPtsHeader).toBeVisible();
    });
  });

  test.describe('Enhanced Leaderboard', () => {
    test('Level / Avg Pts / Matches column headers visible in smart mode', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
      await addBulkPlayers(page, players);
      await setCourtCount(page, 1);
      await toggleSmartEngine(page);

      await page.getByTestId('generate-assignments-button').click();
      await expect(page.locator('.court-card')).toHaveCount(1);

      const firstTeam = page.locator('.team-clickable').first();
      await firstTeam.click();

      await expect(page.getByTestId('score-input-modal')).toBeVisible();
      await page.getByTestId('score-modal-skip').click();

      await expect(page.getByTestId('leaderboard-level-header')).toBeVisible();
      await expect(page.getByTestId('leaderboard-avg-pts-header')).toBeVisible();
      await expect(page.getByTestId('leaderboard-matches-header')).toBeVisible();
    });

    test('after a scored game, Avg Pts shows a numeric value', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
      await addBulkPlayers(page, players);
      await setCourtCount(page, 1);
      await toggleSmartEngine(page);

      await page.getByTestId('generate-assignments-button').click();
      await expect(page.locator('.court-card')).toHaveCount(1);

      const firstTeam = page.locator('.team-clickable').first();
      await firstTeam.click();

      await expect(page.getByTestId('score-input-modal')).toBeVisible();
      await page.getByTestId('score-input-team1').fill('21');
      await page.getByTestId('score-input-team2').fill('15');
      await page.getByTestId('score-modal-confirm').click();

      await page.getByTestId('generate-assignments-button').click();
      await page.waitForTimeout(300);

      const leaderboardRows = page.locator('.leaderboard-table tbody tr');
      await expect(leaderboardRows.first()).toBeVisible();

      const avgPtsCell = leaderboardRows.first().locator('td').nth(3);
      const text = await avgPtsCell.textContent();
      expect(text).not.toBe('—');
      expect(parseFloat(text ?? '')).toBeGreaterThan(0);
    });

    test('normal mode leaderboard does not show Level column', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
      await addBulkPlayers(page, players);
      await setCourtCount(page, 1);

      await page.getByTestId('generate-assignments-button').click();
      await expect(page.locator('.court-card')).toHaveCount(1);

      const firstTeam = page.locator('.team-clickable').first();
      await firstTeam.click();

      await expect(page.getByTestId('score-input-modal')).toBeVisible();
      await page.getByTestId('score-modal-skip').click();

      await expect(page.locator('h2').filter({ hasText: 'Leaderboard' })).toBeVisible();
      await expect(page.getByTestId('leaderboard-level-header')).not.toBeVisible();
    });
  });

  test.describe('Stats Integration', () => {
    test('TeammateGraph shows gender legend when smart engine is enabled', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
      await addBulkPlayers(page, players);
      await toggleSmartEngine(page);
      await setCourtCount(page, 1);

      await page.getByTestId('generate-assignments-button').click();
      await page.waitForTimeout(300);
      await playRound(page);

      await page.locator('a[href*="stats"]').click();

      const teammateGraph = page.locator('.teammate-graph').first();
      await expect(teammateGraph).toBeVisible();
      
      await expect(teammateGraph.locator('.graph-legend')).toHaveCount(2);
      await expect(teammateGraph.locator('.graph-legend').last()).toContainText('M');
      await expect(teammateGraph.locator('.graph-legend').last()).toContainText('F');
    });

    test('TeammateGraph gender legend is absent in normal mode', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
      await addBulkPlayers(page, players);
      await setCourtCount(page, 1);

      await page.getByTestId('generate-assignments-button').click();
      await page.waitForTimeout(300);
      await playRound(page);

      await page.locator('a[href*="stats"]').click();

      const teammateGraph = page.locator('.teammate-graph').first();
      await expect(teammateGraph).toBeVisible();
      await expect(teammateGraph.locator('.graph-legend')).toHaveCount(1);
    });

    test('Level Progression section shows updated lines after a scored round', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
      await addBulkPlayers(page, players);
      await toggleSmartEngine(page);
      await setCourtCount(page, 1);

      await page.getByTestId('generate-assignments-button').click();
      await page.waitForTimeout(300);

      await playRound(page);

      await page.locator('a[href*="stats"]').click();

      await expect(page.getByText('📈 Level Progression')).toBeVisible();
      await expect(page.locator('.level-history-graph')).toBeVisible();
      await expect(page.locator('.level-history-graph svg')).toBeVisible();
      await expect(page.locator('.level-history-graph svg polyline').first()).toBeVisible();
    });

    test('Level Progression section is absent in normal mode', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
      await addBulkPlayers(page, players);
      await setCourtCount(page, 1);

      await page.getByTestId('generate-assignments-button').click();
      await page.waitForTimeout(300);
      await playRound(page);

      await page.locator('a[href*="stats"]').click();

      await expect(page.getByText('📈 Level Progression')).not.toBeVisible();
    });

    test('Level Progression section appears after first generate even without winners', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
      await addBulkPlayers(page, players);
      await toggleSmartEngine(page);
      await setCourtCount(page, 1);

      await page.getByTestId('generate-assignments-button').click();
      await page.waitForTimeout(300);

      await page.locator('a[href*="stats"]').click();

      await expect(page.getByText('📈 Level Progression')).toBeVisible();
      await expect(page.locator('.level-history-graph')).toBeVisible();
    });
  });
});
