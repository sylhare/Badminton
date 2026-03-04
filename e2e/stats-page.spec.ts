import { test, expect } from '@playwright/test';

import { goToApp, navigateToStats, setupGameWithPlayers, playRound } from './helpers';

test.describe('Stats Page', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('stats page navigation - to and from app', async ({ page }) => {
    await test.step('can navigate to stats page', async () => {
      await expect(page.locator('h1')).toContainText('🏸 Badminton Court Manager');
      const statsLink = page.locator('a[href*="stats"]');
      await expect(statsLink).toBeVisible();
      await statsLink.click();
      await expect(page.locator('h1')).toContainText('Simulated Annealing Diagnostics');
      await expect(page.locator('.stats-subtitle')).toContainText('Simulated Annealing with iterative improvement');
    });

    await test.step('can navigate back to app', async () => {
      const backLink = page.getByTestId('back-to-app');
      await expect(backLink).toBeVisible();
      await backLink.click();
      await expect(page.locator('h1')).toContainText('🏸 Badminton Court Manager');
    });

    await test.step('start game link navigates back to app', async () => {
      await navigateToStats(page);
      await page.getByText('Start a Game →').click();
      await expect(page.locator('h1')).toContainText('🏸 Badminton Court Manager');
    });

    await test.step('app footer has GitHub feedback link', async () => {
      const footer = page.locator('.app-footer');
      await expect(footer).toBeVisible();
      await expect(footer.locator('a[href*="github.com"]')).toBeVisible();
    });
  });

  test('stats page empty state - no data message, notebook links and footer', async ({ page }) => {
    await navigateToStats(page);

    await test.step('shows no data message', async () => {
      await expect(page.locator('.no-data')).toBeVisible();
      await expect(page.getByText('No session data yet')).toBeVisible();
      await expect(page.getByText('Start a Game →')).toBeVisible();
    });

    await test.step('algorithm documentation link', async () => {
      const algorithmLink = page.getByTestId('algorithm-link');
      await expect(algorithmLink).toBeVisible();
      await expect(algorithmLink).toContainText('Algorithm Documentation');
    });

    await test.step('engine comparison link', async () => {
      const engineLink = page.getByTestId('engine-link');
      await expect(engineLink).toBeVisible();
      await expect(engineLink).toContainText('Engine Comparison');
    });

    await test.step('GitHub feedback link in footer', async () => {
      const footer = page.locator('.stats-footer');
      await expect(footer).toBeVisible();
      await expect(footer.getByText('Let us know on GitHub')).toBeVisible();
      const githubLink = footer.locator('a[href*="github.com"]');
      await expect(githubLink).toHaveAttribute('href', 'https://github.com/sylhare/Badminton/issues/new/choose');
    });
  });

  test('session diagnostics - all sections visible after playing', async ({ page }) => {
    const players = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
    await setupGameWithPlayers(page, players);
    await playRound(page);
    await page.locator('a[href*="stats"]').click();

    await test.step('stats grid visible with key cards', async () => {
      await expect(page.locator('h1')).toContainText('Simulated Annealing Diagnostics');
      await expect(page.locator('.stats-grid')).toBeVisible();
      await expect(page.getByText('Total Players')).toBeVisible();
      await expect(page.getByText('Rounds Played')).toBeVisible();
      await expect(page.locator('.stat-card').filter({ hasText: 'Repeated Pairs' })).toBeVisible();
      await expect(page.locator('.stat-card').filter({ hasText: 'Warnings' })).toBeVisible();
    });

    await test.step('bench distribution section', async () => {
      await expect(page.getByText('🪑 Bench Distribution')).toBeVisible();
      await expect(page.getByText(/Never benched/)).toBeVisible();
      await expect(page.getByText(/Benched once/)).toBeVisible();
      await expect(page.getByText(/Fairness score/)).toBeVisible();
    });

    await test.step('teammate connections section', async () => {
      await expect(page.getByText('👥 Teammate Connections')).toBeVisible();
    });

    await test.step('opponent matchups section', async () => {
      await expect(page.getByText('⚔️ Opponent Matchups')).toBeVisible();
    });

    await test.step('singles matches section', async () => {
      await expect(page.getByText('🎯 Singles Matches')).toBeVisible();
    });
  });

  test('bench section - expand and graph', async ({ page }) => {
    const players = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
    await setupGameWithPlayers(page, players);
    await navigateToStats(page);

    await test.step('can expand bench counts section', async () => {
      const benchDetails = page.locator('summary').filter({ hasText: /View bench counts per player/ });
      await expect(benchDetails).toBeVisible();
      await benchDetails.click();
      await expect(page.locator('.bench-graph')).toBeVisible();
    });

    await test.step('bench graph has svg and legend', async () => {
      const benchGraph = page.locator('.bench-graph');
      await expect(benchGraph.locator('svg')).toBeVisible();
      await expect(benchGraph.locator('.graph-legend')).toBeVisible();
    });
  });

  test('can expand repeated pairs section when available', async ({ page }) => {
    const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
    await setupGameWithPlayers(page, players);
    await playRound(page);
    await playRound(page);
    await navigateToStats(page);

    const teammateGraph = page.locator('.teammate-graph').first();
    if (await teammateGraph.isVisible()) {
      const pairsDetails = page.locator('summary').filter({ hasText: /View repeated pairs/ });
      if (await pairsDetails.isVisible()) {
        await pairsDetails.click();
        await expect(page.locator('.pairs-graph').first()).toBeVisible();
      }
    }
  });

  test('renders teammate network graph', async ({ page }) => {
    const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
    await setupGameWithPlayers(page, players);
    await navigateToStats(page);

    const teammateGraph = page.locator('.teammate-graph').first();
    await expect(teammateGraph).toBeVisible();
    await expect(teammateGraph.locator('svg')).toBeVisible();

    const legend = teammateGraph.locator('.graph-legend');
    await expect(legend).toBeVisible();
    await expect(legend).toContainText('1×');
    await expect(legend).toContainText('2×');
    await expect(legend).toContainText('3×');
    await expect(legend).toContainText('4×+');
  });

  test('data persistence - shows data after reload, clears after localStorage clear', async ({ page }) => {
    const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
    await setupGameWithPlayers(page, players);
    await navigateToStats(page);

    await test.step('shows data after page reload', async () => {
      await expect(page.locator('.stats-grid')).toBeVisible();
      await page.reload();
      await expect(page.locator('.stats-grid')).toBeVisible();
      await expect(page.getByText('Total Players')).toBeVisible();
    });

    await test.step('clears data after localStorage clear', async () => {
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await expect(page.locator('.no-data')).toBeVisible();
      await expect(page.getByText('No session data yet')).toBeVisible();
    });
  });
});
