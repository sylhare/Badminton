import { expect, test } from '@playwright/test';

import { MainPage } from '../support/pages/MainPage';

test.describe('Leaderboard', () => {
  let mainPage: MainPage;

  test.beforeEach(async ({ page }) => {
    mainPage = new MainPage(page);
    await mainPage.goto();
    await mainPage.reset();
  });

  test('Leaderboard updates in real-time when changing winners', async ({ page }) => {
    await mainPage.addPlayers(['Alice', 'Bob', 'Charlie', 'Diana']);
    await expect(page.getByTestId('stats-total-count')).toHaveText('4');
    await mainPage.generateAssignments(1);

    await expect(page.getByTestId('last-generated')).toBeVisible();
    await expect(page.getByTestId('last-generated')).toContainText(/Last generated (just now|\d+s ago)/);
    await expect(page.locator('h2').filter({ hasText: 'Leaderboard' })).not.toBeVisible();
    await expect(page.locator('.winner-instructions')).toBeVisible();

    const court1 = mainPage.court(1);
    await court1.selectWinner();

    await expect(page.locator('.crown')).toHaveCount(1);
    await expect(page.locator('.winner-instructions')).not.toBeVisible();
    await expect(page.locator('h2').filter({ hasText: 'Leaderboard' })).toBeVisible();

    const rows = page.locator('.leaderboard-table tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.first().locator('td').nth(2)).toHaveText('1');

    await court1.selectWinner(2);

    await expect(page.locator('.crown')).toHaveCount(1);
    await expect(page.locator('h2').filter({ hasText: 'Leaderboard' })).toBeVisible();
    await expect(rows).toHaveCount(2);
    await expect(rows.first().locator('td').nth(2)).toHaveText('1');

    await page.getByTestId('court-1').locator('.team-clickable').last().click();
    await page.waitForTimeout(200);

    await expect(page.locator('.crown')).toHaveCount(0);
    await expect(page.locator('h2').filter({ hasText: 'Leaderboard' })).not.toBeVisible();
  });

  test('Player deletion removes player from leaderboard immediately and persists after reload', async ({ page }) => {
    await mainPage.addPlayers(['Alice', 'Bob', 'Charlie', 'Diana']);
    await mainPage.generateAssignments(1);
    await mainPage.court(1).selectWinner();

    await expect(page.locator('h2').filter({ hasText: 'Leaderboard' })).toBeVisible();

    const names = await mainPage.getLeaderboardPlayerNames();
    const winningPlayerName = names[0];

    await mainPage.expandPlayersSection();
    const playerRow = page.locator('.player-item').filter({ hasText: winningPlayerName });
    await playerRow.locator('[data-testid^="remove-player-"]').click();
    await page.getByTestId('player-removal-modal-remove').click();
    await page.waitForTimeout(200);

    await test.step('player removed from leaderboard immediately', async () => {
      expect(await mainPage.getLeaderboardPlayerNames()).not.toContain(winningPlayerName);
    });

    await page.reload();
    await expect(page).toHaveTitle(/Badminton/);

    await test.step('deleted player wins not restored after reload', async () => {
      expect(await mainPage.getLeaderboardPlayerNames()).not.toContain(winningPlayerName);
    });
  });
});
