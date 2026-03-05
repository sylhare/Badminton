import { test, expect } from '@playwright/test';

import { goToApp, addBulkPlayers, setCourtCount, generateCourtAssignments, expandSectionIfNeeded } from './helpers';

test.describe('State Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should persist players and presence state across reload', async ({ page }) => {
    await addBulkPlayers(page, ['Alice', 'Bob', 'Charlie', 'Diana']);

    await page.locator('[data-testid^="toggle-presence-"]').nth(1).click();
    await page.waitForTimeout(300);

    await page.reload();

    await expandSectionIfNeeded(page, 'Manage Players');

    await expect(page.getByText('Alice')).toBeVisible();
    await expect(page.getByText('Bob')).toBeVisible();
    await expect(page.getByText('Charlie')).toBeVisible();
    await expect(page.getByText('Diana')).toBeVisible();
    await expect(page.getByTestId('stats-present-count')).toHaveText('3');
    await expect(page.getByTestId('stats-absent-count')).toHaveText('1');

    const toggleButtons = page.locator('[data-testid^="toggle-presence-"]');
    await expect(toggleButtons.nth(0)).toHaveClass(/present/);
    await expect(toggleButtons.nth(1)).toHaveClass(/absent/);
  });

  test('should persist court count setting across reload', async ({ page }) => {
    await addBulkPlayers(page, ['Alice', 'Bob', 'Charlie', 'Diana']);
    await setCourtCount(page, 6);
    await expect(page.getByTestId('court-count-input')).toHaveValue('6');

    await page.waitForTimeout(300);
    await page.reload();

    await expect(page.getByTestId('court-count-input')).toHaveValue('6');
  });

  test('should persist court assignments across reload', async ({ page }) => {
    await addBulkPlayers(page, ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Hank']);
    await generateCourtAssignments(page);

    await expect(page.getByTestId('court-1')).toBeVisible();
    await expect(page.getByTestId('court-2')).toBeVisible();

    await page.waitForTimeout(300);
    await page.reload();

    await expect(page.getByTestId('court-1')).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId('court-2')).toBeVisible({ timeout: 3000 });
  });

  test('should collapse Manage Players section on reload when players exist', async ({ page }) => {
    await addBulkPlayers(page, ['Alice', 'Bob', 'Charlie', 'Diana']);
    await page.waitForTimeout(200);
    await page.reload();

    await expect(page.getByTestId('manage-players-section')).toHaveClass(/collapsed/);
  });

  test('should show Manage Players section expanded on first load with no players', async ({ page }) => {
    await expect(page.getByTestId('manage-players-section')).not.toHaveClass(/collapsed/);
  });

  test('should clear all data when clear all is confirmed and stay clear after reload', async ({ page }) => {
    await addBulkPlayers(page, ['Alice', 'Bob', 'Charlie', 'Diana']);
    await generateCourtAssignments(page);

    await expandSectionIfNeeded(page, 'Manage Players');
    await page.getByTestId('clear-all-button').click();
    await page.getByTestId('confirm-modal-confirm').click();

    await expect(page.getByText('Alice')).not.toBeVisible();

    await page.waitForTimeout(300);
    await page.reload();

    await expect(page.getByText('Alice')).not.toBeVisible();
  });

  test('should persist reset algorithm state across reload', async ({ page }) => {
    await addBulkPlayers(page, ['Alice', 'Bob', 'Charlie', 'Diana']);
    await generateCourtAssignments(page);

    await expandSectionIfNeeded(page, 'Manage Players');
    await page.getByTestId('reset-algorithm-button').click();
    await page.getByTestId('confirm-modal-confirm').click();

    await page.waitForTimeout(300);
    await page.reload();

    await expandSectionIfNeeded(page, 'Manage Players');
    await expect(page.getByText('Alice')).toBeVisible();
  });
});

test.describe('Leaderboard Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should persist leaderboard data across reload', async ({ page }) => {
    await addBulkPlayers(page, ['Alice', 'Bob', 'Charlie', 'Diana']);
    await generateCourtAssignments(page);

    const firstTeam = page.locator('.team-clickable').first();
    await firstTeam.click();

    await expect(page.locator('h2').filter({ hasText: 'Leaderboard' })).toBeVisible();

    await page.waitForTimeout(300);
    await page.reload();

    await expect(page.locator('h2').filter({ hasText: 'Leaderboard' })).toBeVisible({ timeout: 3000 });
  });
});
