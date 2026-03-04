import { test, expect } from '@playwright/test';

import {
  goToApp,
  addSinglePlayer,
  addBulkPlayers,
  setCourtCount,
  toggleSmartEngine,
  enterAndConfirmScore,
  assertAvgPtsNumeric,
} from './helpers';

const PLAYERS = ['Alice', 'Bob', 'Charlie', 'Diana'];

test.describe('Smart Engine', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test.describe('Tooltip', () => {
    test('tooltip click interactions', async ({ page }) => {
      await addSinglePlayer(page, 'Test Player');

      const toggle = page.getByTestId('smart-engine-toggle');
      const tooltipIcon = page.getByTestId('smart-engine-tooltip-icon');
      const tooltipPopup = page.getByTestId('smart-engine-tooltip-popup');

      await test.step('clicking shows popup without toggling smart engine', async () => {
        await expect(toggle).not.toBeChecked();
        await tooltipIcon.click();
        await expect(tooltipPopup).toBeVisible();
        await expect(toggle).not.toBeChecked();
      });

      await test.step('clicking icon again closes tooltip', async () => {
        await tooltipIcon.click();
        await expect(tooltipPopup).not.toBeVisible();
        await expect(toggle).not.toBeChecked();
      });

      await test.step('clicking outside closes the tooltip', async () => {
        await tooltipIcon.click();
        await expect(tooltipPopup).toBeVisible();
        await page.mouse.click(10, 10);
        await expect(tooltipPopup).not.toBeVisible();
      });
    });

    test('tooltip hover interactions', async ({ page }) => {
      await addSinglePlayer(page, 'Test Player');

      const tooltipIcon = page.getByTestId('smart-engine-tooltip-icon');
      const tooltipPopup = page.getByTestId('smart-engine-tooltip-popup');

      await test.step('moving mouse away before delay keeps tooltip hidden', async () => {
        await tooltipIcon.hover();
        await page.waitForTimeout(500);
        await page.mouse.move(10, 10);
        await expect(tooltipPopup).not.toBeVisible();
      });

      await test.step('hovering 1.5s shows the tooltip', async () => {
        await tooltipIcon.hover();
        await page.waitForTimeout(1800);
        await expect(tooltipPopup).toBeVisible();
      });

      await test.step('moving mouse away after hover closes the tooltip', async () => {
        await page.mouse.move(10, 10);
        await expect(tooltipPopup).not.toBeVisible();
      });
    });
  });

  test.describe('Toggle & theme', () => {
    test('theme toggle - on applies night-theme, off removes it', async ({ page }) => {
      await addSinglePlayer(page, 'Test Player');

      await test.step('toggling on applies .night-theme', async () => {
        await expect(page.locator('.app')).not.toHaveClass(/night-theme/);
        await toggleSmartEngine(page);
        await expect(page.locator('.app')).toHaveClass(/night-theme/);
      });

      await test.step('toggling off removes .night-theme', async () => {
        await toggleSmartEngine(page);
        await expect(page.locator('.app')).not.toHaveClass(/night-theme/);
      });
    });
  });

  test.describe('Score input modal', () => {
    test.beforeEach(async ({ page }) => {
      await addBulkPlayers(page, PLAYERS);
      await toggleSmartEngine(page);
      await setCourtCount(page, 1);
      await page.getByTestId('generate-assignments-button').click();
      await expect(page.locator('.court-card')).toHaveCount(1);
    });

    test('clicking a team opens score-input-modal', async ({ page }) => {
      await page.locator('.team-clickable').first().click();
      await expect(page.getByTestId('score-input-modal')).toBeVisible();
    });

    test('cancelling does not set a winner', async ({ page }) => {
      await page.locator('.team-clickable').first().click();
      await expect(page.getByTestId('score-input-modal')).toBeVisible();

      await page.locator('[data-testid="score-input-modal"] .modal-close').click();

      await expect(page.getByTestId('score-input-modal')).not.toBeVisible();
      await expect(page.locator('.crown')).toHaveCount(0);
    });

    test('skipping sets winner without score', async ({ page }) => {
      await page.locator('.team-clickable').first().click();
      await expect(page.getByTestId('score-input-modal')).toBeVisible();
      await page.getByTestId('score-modal-skip').click();

      await expect(page.getByTestId('score-input-modal')).not.toBeVisible();
      await expect(page.locator('.crown')).toHaveCount(1);
    });

    test('entering score and confirming saves score; avg pts shows after regenerate', async ({ page }) => {
      await page.locator('.team-clickable').first().click();

      await test.step('confirm disabled when winner score is lower than opponent', async () => {
        await page.getByTestId('score-input-team1').fill('10');
        await page.getByTestId('score-input-team2').fill('21');
        await expect(page.getByTestId('score-modal-confirm')).toBeDisabled();
        await page.getByTestId('score-input-team1').fill('');
        await page.getByTestId('score-input-team2').fill('');
      });

      await enterAndConfirmScore(page, '21', '10');
      await expect(page.locator('.crown')).toHaveCount(1);

      await page.getByTestId('generate-assignments-button').click();
      await page.waitForTimeout(300);

      const leaderboard = page.locator('.leaderboard-table');
      await expect(leaderboard).toBeVisible();
      await expect(page.getByTestId('leaderboard-avg-pts-header')).toBeVisible();
    });
  });

  test.describe('Enhanced Leaderboard', () => {
    test('Level / Avg Pts / Matches column headers visible in smart mode', async ({ page }) => {
      await addBulkPlayers(page, PLAYERS);
      await setCourtCount(page, 1);
      await toggleSmartEngine(page);

      await page.getByTestId('generate-assignments-button').click();
      await expect(page.locator('.court-card')).toHaveCount(1);

      await page.locator('.team-clickable').first().click();
      await expect(page.getByTestId('score-input-modal')).toBeVisible();
      await page.getByTestId('score-modal-skip').click();

      await expect(page.getByTestId('leaderboard-level-header')).toBeVisible();
      await expect(page.getByTestId('leaderboard-avg-pts-header')).toBeVisible();
      await expect(page.getByTestId('leaderboard-matches-header')).toBeVisible();
    });

    test('after a scored game, Avg Pts shows a numeric value', async ({ page }) => {
      await addBulkPlayers(page, PLAYERS);
      await setCourtCount(page, 1);
      await toggleSmartEngine(page);

      await page.getByTestId('generate-assignments-button').click();
      await expect(page.locator('.court-card')).toHaveCount(1);

      await page.locator('.team-clickable').first().click();
      await enterAndConfirmScore(page, '21', '15');
      await assertAvgPtsNumeric(page);
    });
  });

  test.describe('Stats Integration', () => {
    test('TeammateGraph shows gender legend when smart engine is enabled', async ({ page }) => {
      await addBulkPlayers(page, PLAYERS);
      await toggleSmartEngine(page);
      await setCourtCount(page, 1);

      await page.getByTestId('generate-assignments-button').click();
      await expect(page.locator('.court-card')).toHaveCount(1);

      await page.locator('.team-clickable').first().click();
      await enterAndConfirmScore(page, '21', '10');
      await assertAvgPtsNumeric(page);

      await page.locator('a[href*="stats"]').click();

      const teammateGraph = page.locator('.teammate-graph').first();
      await expect(teammateGraph).toBeVisible();
      await expect(teammateGraph.locator('.graph-legend')).toHaveCount(2);
      await expect(teammateGraph.locator('.graph-legend').last()).toContainText('M');
      await expect(teammateGraph.locator('.graph-legend').last()).toContainText('F');
    });

    test('normal mode - no Level column, no gender legend, no Level Progression', async ({ page }) => {
      await addBulkPlayers(page, PLAYERS);
      await setCourtCount(page, 1);

      await page.getByTestId('generate-assignments-button').click();
      await expect(page.locator('.court-card')).toHaveCount(1);
      await page.locator('.team-clickable').first().click();

      await test.step('leaderboard does not show Level column', async () => {
        await expect(page.locator('h2').filter({ hasText: 'Leaderboard' })).toBeVisible();
        await expect(page.getByTestId('leaderboard-level-header')).not.toBeVisible();
      });

      await page.getByTestId('generate-assignments-button').click();
      await page.waitForTimeout(200);
      await page.locator('a[href*="stats"]').click();

      await test.step('TeammateGraph gender legend is absent', async () => {
        const teammateGraph = page.locator('.teammate-graph').first();
        await expect(teammateGraph).toBeVisible();
        await expect(teammateGraph.locator('.graph-legend')).toHaveCount(1);
      });

      await test.step('Level Progression section is absent', async () => {
        await expect(page.getByText('📈 Level Progression')).not.toBeVisible();
      });
    });

    test('Level Progression section shows updated lines after a scored round', async ({ page }) => {
      await addBulkPlayers(page, PLAYERS);
      await toggleSmartEngine(page);
      await setCourtCount(page, 1);

      await page.getByTestId('generate-assignments-button').click();
      await expect(page.locator('.court-card')).toHaveCount(1);

      await page.locator('.team-clickable').first().click();
      await enterAndConfirmScore(page, '21', '10');
      await assertAvgPtsNumeric(page);

      await page.locator('a[href*="stats"]').click();

      await expect(page.getByText('📈 Level Progression')).toBeVisible();
      await expect(page.locator('.level-history-graph')).toBeVisible();
      await expect(page.locator('.level-history-graph svg')).toBeVisible();
      await expect(page.locator('.level-history-graph svg polyline').first()).toBeVisible();
    });

    test('Level Progression section appears after first generate even without winners', async ({ page }) => {
      await addBulkPlayers(page, PLAYERS);
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
