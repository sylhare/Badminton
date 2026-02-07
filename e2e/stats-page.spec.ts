import { test, expect } from '@playwright/test';

import { goToApp, addBulkPlayers } from './helpers';

test.describe('Stats Page', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test.describe('Navigation', () => {
    test('can navigate to stats page from main app', async ({ page }) => {
      const statsLink = page.locator('a[href*="stats"]');
      await expect(statsLink).toBeVisible();
      await statsLink.click();

      await expect(page.locator('h1')).toContainText('Engine Diagnostics');
      await expect(page.locator('.stats-subtitle')).toContainText('Monitor algorithm behavior');
    });

    test('can navigate back to app from stats page', async ({ page }) => {
      await page.goto('/stats');

      const backLink = page.getByTestId('back-to-app');
      await expect(backLink).toBeVisible();
      await backLink.click();

      await expect(page.locator('h1')).toContainText('🏸 Badminton Court Manager');
    });
  });

  test.describe('No Data State', () => {
    test('shows no data message when no session data exists', async ({ page }) => {
      await page.goto('/stats');

      await expect(page.locator('.no-data')).toBeVisible();
      await expect(page.getByText('No session data yet')).toBeVisible();
      await expect(page.getByText('Start a Game →')).toBeVisible();
    });

    test('start game link navigates back to app', async ({ page }) => {
      await page.goto('/stats');

      await page.getByText('Start a Game →').click();

      await expect(page.locator('h1')).toContainText('🏸 Badminton Court Manager');
    });
  });

  test.describe('Notebook Links', () => {
    test('displays algorithm documentation link', async ({ page }) => {
      await page.goto('/stats');

      const algorithmLink = page.getByTestId('algorithm-link');
      await expect(algorithmLink).toBeVisible();
      await expect(algorithmLink).toContainText('Algorithm Documentation');
    });

    test('displays engine comparison link', async ({ page }) => {
      await page.goto('/stats');

      const analysisLink = page.getByTestId('analysis-link');
      await expect(analysisLink).toBeVisible();
      await expect(analysisLink).toContainText('Engine Comparison');
    });
  });

  test.describe('Session Diagnostics', () => {
    test('shows diagnostics after playing games', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
      await addBulkPlayers(page, players);

      const generateButton = page.getByTestId('generate-assignments-button');
      await generateButton.click();

      await expect(page.locator('[data-testid^="court-"]').first()).toBeVisible();

      const firstTeam = page.locator('.team-clickable').first();
      await firstTeam.click();
      await page.waitForTimeout(300);

      const generateNewButton = page.getByTestId('generate-assignments-button');
      await generateNewButton.click();
      await page.waitForTimeout(300);

      const statsLink = page.locator('a[href*="stats"]');
      await statsLink.click();

      await expect(page.locator('h1')).toContainText('Engine Diagnostics');

      await expect(page.locator('.stats-grid')).toBeVisible();
      await expect(page.getByText('Total Players')).toBeVisible();
      await expect(page.getByText('Rounds Played')).toBeVisible();
      await expect(page.locator('.stat-card').filter({ hasText: 'Repeated Pairs' })).toBeVisible();
      await expect(page.locator('.stat-card').filter({ hasText: 'Warnings' })).toBeVisible();
    });

    test('displays bench distribution section', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
      await addBulkPlayers(page, players);

      const generateButton = page.getByTestId('generate-assignments-button');
      await generateButton.click();

      await page.waitForTimeout(300);

      await page.goto('/stats');

      await expect(page.getByText('🪑 Bench Distribution')).toBeVisible();
      await expect(page.getByText(/Never benched/)).toBeVisible();
      await expect(page.getByText(/Benched once/)).toBeVisible();
      await expect(page.getByText(/Fairness score/)).toBeVisible();
    });

    test('displays teammate connections section', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
      await addBulkPlayers(page, players);

      const generateButton = page.getByTestId('generate-assignments-button');
      await generateButton.click();

      await page.waitForTimeout(300);

      await page.goto('/stats');

      await expect(page.getByText('👥 Teammate Connections')).toBeVisible();
    });

    test('displays opponent matchups section', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
      await addBulkPlayers(page, players);

      const generateButton = page.getByTestId('generate-assignments-button');
      await generateButton.click();

      await page.waitForTimeout(300);

      await page.goto('/stats');

      await expect(page.getByText('⚔️ Opponent Matchups')).toBeVisible();
    });

    test('displays singles matches section', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
      await addBulkPlayers(page, players);

      const generateButton = page.getByTestId('generate-assignments-button');
      await generateButton.click();

      await page.waitForTimeout(300);

      await page.goto('/stats');

      await expect(page.getByText('🎯 Singles Matches')).toBeVisible();
    });
  });

  test.describe('Expandable Sections', () => {
    test('can expand bench counts section', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
      await addBulkPlayers(page, players);

      const generateButton = page.getByTestId('generate-assignments-button');
      await generateButton.click();

      await page.waitForTimeout(300);

      await page.goto('/stats');

      const benchDetails = page.locator('summary').filter({ hasText: /View bench counts per player/ });
      await expect(benchDetails).toBeVisible();
      await benchDetails.click();

      await expect(page.locator('.bench-graph')).toBeVisible();
    });

    test('can expand repeated pairs section when available', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
      await addBulkPlayers(page, players);

      const generateButton = page.getByTestId('generate-assignments-button');
      await generateButton.click();

      await page.waitForTimeout(200);

      const firstTeam = page.locator('.team-clickable').first();
      await firstTeam.click();
      await page.waitForTimeout(200);

      const generateNewButton = page.getByTestId('generate-assignments-button');
      await generateNewButton.click();
      await page.waitForTimeout(200);

      await firstTeam.click();
      await page.waitForTimeout(200);

      await generateNewButton.click();
      await page.waitForTimeout(200);

      await page.goto('/stats');

      const teammateGraph = page.locator('.teammate-graph').first();
      if (await teammateGraph.isVisible()) {
        const pairsDetails = page.locator('summary').filter({ hasText: /View repeated pairs/ });
        if (await pairsDetails.isVisible()) {
          await pairsDetails.click();
          await expect(page.locator('.pairs-graph').first()).toBeVisible();
        }
      }
    });
  });

  test.describe('Graph Visualizations', () => {
    test('renders teammate network graph', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
      await addBulkPlayers(page, players);

      const generateButton = page.getByTestId('generate-assignments-button');
      await generateButton.click();

      await page.waitForTimeout(300);

      await page.goto('/stats');

      // Use first() because there are two graphs (teammates and opponents)
      const teammateGraph = page.locator('.teammate-graph').first();
      await expect(teammateGraph).toBeVisible();

      const svg = teammateGraph.locator('svg');
      await expect(svg).toBeVisible();

      const legend = teammateGraph.locator('.graph-legend');
      await expect(legend).toBeVisible();
      await expect(legend).toContainText('1×');
      await expect(legend).toContainText('2×');
      await expect(legend).toContainText('3×');
      await expect(legend).toContainText('4×+');
    });

    test('renders bench graph in expanded section', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
      await addBulkPlayers(page, players);

      const generateButton = page.getByTestId('generate-assignments-button');
      await generateButton.click();

      await page.waitForTimeout(300);

      await page.goto('/stats');

      const benchDetails = page.locator('summary').filter({ hasText: /View bench counts per player/ });
      await benchDetails.click();

      const benchGraph = page.locator('.bench-graph');
      await expect(benchGraph).toBeVisible();

      const svg = benchGraph.locator('svg');
      await expect(svg).toBeVisible();

      const legend = benchGraph.locator('.graph-legend');
      await expect(legend).toBeVisible();
    });
  });

  test.describe('Data Persistence', () => {
    test('stats page shows data after page reload', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
      await addBulkPlayers(page, players);

      const generateButton = page.getByTestId('generate-assignments-button');
      await generateButton.click();

      await page.waitForTimeout(300);

      await page.goto('/stats');
      await expect(page.locator('.stats-grid')).toBeVisible();

      await page.reload();

      await expect(page.locator('.stats-grid')).toBeVisible();
      await expect(page.getByText('Total Players')).toBeVisible();
    });

    test('stats page clears data when localStorage is cleared', async ({ page }) => {
      const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
      await addBulkPlayers(page, players);

      const generateButton = page.getByTestId('generate-assignments-button');
      await generateButton.click();

      await page.waitForTimeout(300);

      await page.goto('/stats');
      await expect(page.locator('.stats-grid')).toBeVisible();

      await page.evaluate(() => localStorage.clear());
      await page.reload();

      await expect(page.locator('.no-data')).toBeVisible();
      await expect(page.getByText('No session data yet')).toBeVisible();
    });
  });

  test.describe('Footer', () => {
    test('displays GitHub feedback link', async ({ page }) => {
      await page.goto('/stats');

      const footer = page.locator('.stats-footer');
      await expect(footer).toBeVisible();
      await expect(footer.getByText('Let us know on GitHub')).toBeVisible();

      const githubLink = footer.locator('a[href*="github.com"]');
      await expect(githubLink).toHaveAttribute('href', 'https://github.com/sylhare/Badminton/issues/new/choose');
    });
  });
});
