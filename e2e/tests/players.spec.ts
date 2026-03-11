import { test, expect } from '@playwright/test';

import { MainPage } from '../support/pages';

test.describe('Player Management', () => {
  let mainPage: MainPage;

  test.beforeEach(async ({ page }) => {
    mainPage = new MainPage(page);
    await mainPage.goto();
    await mainPage.reset();
  });

  test('Player toggle and bench counts always visible', async ({ page }) => {
    const players = ['Alice', 'Bob', 'Charlie', 'Diana'];

    await test.step('no players hint visible with disabled generate button', async () => {
      await expect(page.locator('.no-players-hint')).toBeVisible();
      await expect(page.locator('.no-players-hint')).toContainText('Add some players above');
      await expect(page.getByTestId('generate-assignments-button')).toBeDisabled();
    });

    await mainPage.addPlayers(players);

    await test.step('no assignments hint visible after adding players', async () => {
      await expect(page.locator('.no-assignments-hint')).toBeVisible();
      await expect(page.locator('.no-assignments-hint')).toContainText('How it works');
      await expect(page.getByTestId('generate-assignments-button')).toBeEnabled();
    });

    await test.step('toggle player changes present/absent counts', async () => {
      await expect(page.getByTestId('stats-present-count')).toHaveText('4');
      await expect(page.getByTestId('stats-absent-count')).toHaveText('0');

      const firstToggleButton = page.locator('[data-testid^="toggle-presence-"]').first();
      await firstToggleButton.click();

      await expect(page.getByTestId('stats-present-count')).toHaveText('3');
      await expect(page.getByTestId('stats-absent-count')).toHaveText('1');

      await firstToggleButton.click();

      await expect(page.getByTestId('stats-present-count')).toHaveText('4');
      await expect(page.getByTestId('stats-absent-count')).toHaveText('0');
    });

    await test.step('bench counts always visible in player list', async () => {
      await expect(page.locator('.player-bench-row').first()).toBeVisible();

      const aliceItem = page.locator('.player-item').filter({ hasText: 'Alice' });
      await expect(aliceItem.locator('.bench-count-emoji')).toContainText('0');
      await expect(aliceItem.locator('.bench-next-toggle')).toBeVisible();
    });
  });

  test('Player removal modal - all scenarios', async ({ page }) => {
    await mainPage.addPlayer('Test Player 1');
    await mainPage.addPlayer('Test Player 2');

    await test.step('confirm removal drops total count', async () => {
      await expect(page.getByTestId('stats-total-count')).toHaveText('2');

      const firstRemoveButton = page.locator('[data-testid^="remove-player-"]').first();
      await firstRemoveButton.click();

      const modal = page.getByTestId('player-removal-modal');
      await expect(modal).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Remove Player' })).toBeVisible();
      await expect(modal.getByText(/Test Player 1/)).toBeVisible();

      await page.getByTestId('player-removal-modal-remove').click();

      await expect(modal).not.toBeVisible();
      await expect(page.getByTestId('stats-total-count')).toHaveText('1');
    });

    await mainPage.addPlayer('Test Player 1');

    await test.step('mark as absent keeps total but marks player absent', async () => {
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

    await test.step('cancel with X button closes modal without changes', async () => {
      const firstRemoveButton = page.locator('[data-testid^="remove-player-"]').first();
      await firstRemoveButton.click();

      await expect(page.getByTestId('player-removal-modal')).toBeVisible();
      await page.getByTestId('player-removal-modal-close').click();

      await expect(page.getByTestId('player-removal-modal')).not.toBeVisible();
      await expect(page.getByTestId('stats-total-count')).toHaveText('2');
    });

    await test.step('cancel by clicking overlay closes modal without changes', async () => {
      const removeButton = page.locator('[data-testid^="remove-player-"]').first();
      await removeButton.click();

      await expect(page.getByTestId('player-removal-modal')).toBeVisible();

      const overlay = page.getByTestId('player-removal-modal');
      await overlay.click({ position: { x: 10, y: 10 } });

      await expect(page.getByTestId('player-removal-modal')).not.toBeVisible();
      await expect(page.getByTestId('stats-total-count')).toHaveText('2');
    });
  });

  test('Clear all players functionality', async ({ page }) => {
    await mainPage.addPlayers(['Player 1', 'Player 2', 'Player 3']);

    await expect(page.getByTestId('stats-total-count')).toHaveText('3');

    await page.getByTestId('clear-all-button').click();

    await expect(page.getByTestId('confirm-modal')).toBeVisible();
    await page.getByTestId('confirm-modal-confirm').click();

    await expect(page.locator('.player-list')).toHaveCount(0);
    await expect(page.getByTestId('player-stats')).toHaveCount(0);
  });

  test('Force bench players and verify bench count updates', async ({ page }) => {
    const players = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'];
    await mainPage.addPlayers(players);

    await expect(page.getByTestId('stats-total-count')).toHaveText('10');

    await mainPage.generateAssignments(2);

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
      const benchCount = playerItem.locator('.bench-count-emoji');
      await expect(benchCount).toContainText('1');
    }

    const aliceItem = page.locator('.player-item').filter({ hasText: 'Alice' });
    const bobItem = page.locator('.player-item').filter({ hasText: 'Bob' });

    const aliceInitialBenchText = (await aliceItem.locator('.bench-count-emoji').textContent()) || '🪑 0';
    const aliceInitialBenchCount = parseInt(aliceInitialBenchText.replace('🪑', '').trim());
    const bobInitialBenchText = (await bobItem.locator('.bench-count-emoji').textContent()) || '🪑 0';
    const bobInitialBenchCount = parseInt(bobInitialBenchText.replace('🪑', '').trim());

    await aliceItem.locator('.bench-next-toggle').click();
    await bobItem.locator('.bench-next-toggle').click();

    await expect(aliceItem.locator('.toggle-switch')).toHaveClass(/active/);
    await expect(bobItem.locator('.toggle-switch')).toHaveClass(/active/);

    await mainPage.regenerate();
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

    await expect(aliceItemAfter.locator('.bench-count-emoji')).toContainText((aliceInitialBenchCount + 1).toString());
    await expect(bobItemAfter.locator('.bench-count-emoji')).toContainText((bobInitialBenchCount + 1).toString());

    await expect(aliceItemAfter.locator('.toggle-switch')).not.toHaveClass(/active/);
    await expect(bobItemAfter.locator('.toggle-switch')).not.toHaveClass(/active/);
  });
});
