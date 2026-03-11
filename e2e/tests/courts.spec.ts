import { test, expect } from '@playwright/test';

import { MainPage } from '../support/pages';

test.describe('Court Management', () => {
  let mainPage: MainPage;

  test.beforeEach(async ({ page }) => {
    mainPage = new MainPage(page);
    await mainPage.goto();
    await mainPage.reset();
  });

  test('Manual court assignment functionality', async ({ page }) => {
    await mainPage.addPlayers([
      'Alice Johnson',
      'Bob Smith',
      'Charlie Davis',
      'Diana Wilson',
      'Emma Brown',
      'Frank Miller',
    ]);

    await expect(page.getByTestId('stats-total-count')).toHaveText('6');

    const manualCourtButton = page.getByTestId('manual-court-button');
    await expect(manualCourtButton).toBeVisible();
    await manualCourtButton.click();
    await page.waitForTimeout(300);

    const modal = page.getByTestId('manual-court-modal');
    await expect(modal).toBeVisible();

    const firstPlayer = page.locator('[data-testid^="manual-court-player-"]').first();
    await expect(firstPlayer).toBeVisible();
    await firstPlayer.click();

    const secondPlayer = page.locator('[data-testid^="manual-court-player-"]').nth(1);
    await expect(secondPlayer).toBeVisible();
    await secondPlayer.click();

    await expect(page.locator('.selection-count')).toContainText('2/4 players selected');
    await expect(page.locator('.match-preview')).toContainText('Will create: Singles match');

    await test.step('clear selection resets to 0 players', async () => {
      await page.getByTestId('clear-manual-selection').click();
      await expect(page.locator('.selection-count')).toContainText('0/4 players selected');
    });

    await firstPlayer.click();
    await secondPlayer.click();
    await expect(page.locator('.selection-count')).toContainText('2/4 players selected');

    await page.getByText('Done').click();
    await page.waitForTimeout(200);

    await mainPage.generateAssignments();

    await expect(page.getByTestId('court-1')).toBeVisible();
    await expect(page.getByTestId('court-1').locator('.manual-court-icon')).toBeVisible();
  });
});
