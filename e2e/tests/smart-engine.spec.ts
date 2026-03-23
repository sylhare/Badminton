import { expect, test } from '@playwright/test';

import { MainPage } from '../support/pages/MainPage';

const PLAYERS = ['Alice', 'Bob', 'Charlie', 'Diana'];

test.describe('Smart Engine', () => {
  let mainPage: MainPage;

  test.beforeEach(async ({ page }) => {
    mainPage = new MainPage(page);
    await mainPage.goto();
    await mainPage.reset();
  });

  test.describe('Tooltip', () => {
    test('tooltip click interactions', async ({ page }) => {
      await mainPage.addPlayer('Test Player');

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
      await mainPage.addPlayer('Test Player');

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
      await mainPage.addPlayer('Test Player');

      await test.step('toggling on applies .night-theme', async () => {
        await expect(page.locator('.app')).not.toHaveClass(/night-theme/);
        await mainPage.toggleSmartEngine();
        await expect(page.locator('.app')).toHaveClass(/night-theme/);
      });

      await test.step('toggling off removes .night-theme', async () => {
        await mainPage.toggleSmartEngine();
        await expect(page.locator('.app')).not.toHaveClass(/night-theme/);
      });
    });
  });

  test.describe('Score input modal', () => {
    test.beforeEach(async ({ page: _page }) => {
      await mainPage.addPlayers(PLAYERS);
      await mainPage.toggleSmartEngine();
      await mainPage.generateAssignments(1);
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

    test('entering score and confirming saves score; avg pts shows after regenerate', async ({ page }) => {
      await page.locator('.team-clickable').first().click();

      await test.step('confirm disabled when winner score is lower than opponent', async () => {
        await page.getByTestId('score-input-team1').fill('10');
        await page.getByTestId('score-input-team2').fill('21');
        await expect(page.getByTestId('score-modal-confirm')).toBeDisabled();
        await page.getByTestId('score-input-team1').fill('');
        await page.getByTestId('score-input-team2').fill('');
      });

      await mainPage.enterScore('21', '10');
      await expect(page.locator('.crown')).toHaveCount(1);

      await mainPage.regenerate();

      const leaderboard = page.locator('.leaderboard-table');
      await expect(leaderboard).toBeVisible();
      await expect(page.getByTestId('leaderboard-avg-pts-header')).toBeVisible();
    });
  });

  test.describe('Enhanced Leaderboard', () => {
    test('Level / Avg Pts / Matches column headers visible in smart mode', async ({ page }) => {
      await mainPage.addPlayers(PLAYERS);
      await mainPage.setCourtCount(1);
      await mainPage.toggleSmartEngine();
      await mainPage.generateAssignments(1);

      await page.locator('.team-clickable').first().click();
      await expect(page.getByTestId('score-input-modal')).toBeVisible();
      await page.getByTestId('score-modal-confirm').click();

      await expect(page.getByTestId('leaderboard-level-header')).toBeVisible();
      await expect(page.getByTestId('leaderboard-avg-pts-header')).toBeVisible();
      await expect(page.getByTestId('leaderboard-matches-header')).toBeVisible();
    });

    test('after a scored game, Avg Pts shows a numeric value', async ({ page }) => {
      await mainPage.addPlayers(PLAYERS);
      await mainPage.generateAssignments(1);
      await mainPage.toggleSmartEngine();

      await page.locator('.team-clickable').first().click();
      await mainPage.enterScore('21', '15');

      await mainPage.regenerate();
      await page.waitForTimeout(300);
      const firstRow = page.locator('.leaderboard-table tbody tr').first();
      await expect(firstRow).toBeVisible();
      const avgPts = await firstRow.locator('td').nth(3).textContent();
      expect(avgPts).not.toBe('—');
      expect(parseFloat(avgPts ?? '')).toBeGreaterThan(0);
    });
  });

  test.describe('Level Trend Indicator', () => {
    test.beforeEach(async ({ page: _page }) => {
      await mainPage.addPlayers(PLAYERS);
      await mainPage.toggleSmartEngine();
      await mainPage.generateAssignments(1);
    });

    test('shows ▲/▼ in leaderboard level column after second round', async ({ page }) => {
      await page.locator('.team-clickable').first().click();
      await mainPage.enterScore('21', '10');
      await mainPage.regenerate();

      const trendIndicator = page.locator('.leaderboard-table .trend-up, .leaderboard-table .trend-down');
      await expect(trendIndicator.first()).toBeVisible();
    });

    test('no ▲/▼ on first round (only one snapshot)', async ({ page }) => {
      await page.locator('.team-clickable').first().click();
      await expect(page.getByTestId('score-input-modal')).toBeVisible();
      await page.getByTestId('score-modal-confirm').click();

      await expect(page.locator('.leaderboard-table .trend-up')).toHaveCount(0);
      await expect(page.locator('.leaderboard-table .trend-down')).toHaveCount(0);
    });
  });

  test.describe('Stats Integration', () => {
    test('TeammateGraph shows gender legend when smart engine is enabled', async ({ page }) => {
      await mainPage.addPlayers(PLAYERS);
      await mainPage.toggleSmartEngine();
      await mainPage.generateAssignments(1);

      await page.locator('.team-clickable').first().click();
      await mainPage.enterScore('21', '10');
      await mainPage.regenerate();

      await page.locator('a[href*="stats"]').click();

      const teammateGraph = page.locator('.teammate-graph').first();
      await expect(teammateGraph).toBeVisible();
      await expect(teammateGraph.locator('.graph-legend')).toHaveCount(2);
      await expect(teammateGraph.locator('.graph-legend').last()).toContainText('M');
      await expect(teammateGraph.locator('.graph-legend').last()).toContainText('F');
    });

    test('normal mode - no Level column, no gender legend, no Level Progression', async ({ page }) => {
      await mainPage.addPlayers(PLAYERS);
      await mainPage.generateAssignments(1);
      await page.locator('.team-clickable').first().click();

      await test.step('leaderboard does not show Level column', async () => {
        await expect(page.locator('h2').filter({ hasText: 'Leaderboard' })).toBeVisible();
        await expect(page.getByTestId('leaderboard-level-header')).not.toBeVisible();
      });

      await mainPage.regenerate();
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
      await mainPage.addPlayers(PLAYERS);
      await mainPage.toggleSmartEngine();
      await mainPage.generateAssignments(1);

      await page.locator('.team-clickable').first().click();
      await mainPage.enterScore('21', '10');
      await mainPage.regenerate();
      await expect(page.locator('.crown')).toHaveCount(0);

      await page.locator('.team-clickable').first().click();
      await mainPage.enterScore('21', '15');
      await mainPage.regenerate();

      await page.locator('a[href*="stats"]').click();

      await expect(page.getByText('📈 Level Progression')).toBeVisible();
      await expect(page.locator('.level-history-graph')).toBeVisible();
      await expect(page.locator('.level-history-graph svg')).toBeVisible();
      await expect(page.locator('.level-history-graph svg polyline').first()).toBeVisible();
    });

    test('Level Progression section appears after first generate even without winners', async ({ page }) => {
      await mainPage.addPlayers(PLAYERS);
      await mainPage.toggleSmartEngine();
      await mainPage.generateAssignments(1);

      await page.locator('a[href*="stats"]').click();

      await expect(page.getByText('📈 Level Progression')).toBeVisible();
      await expect(page.locator('.level-history-graph')).toBeVisible();
    });
  });
});
