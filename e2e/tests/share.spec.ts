import { expect, test } from '@playwright/test';

import { DEFAULT_PLAYERS } from '../support/helpers';
import { MainPage } from '../support/pages/MainPage';

test.describe('Session Sharing via URL', () => {
  let mainPage: MainPage;

  test.beforeEach(async ({ page }) => {
    mainPage = new MainPage(page);
    await mainPage.goto();
    await mainPage.reset();
    await page.waitForLoadState('networkidle');
  });

  test('share button and URL state', async ({ page }) => {
    await expect(page.getByTestId('share-button')).not.toBeVisible();
    await mainPage.addPlayers(DEFAULT_PLAYERS);

    await test.step('share button appears', async () => {
      await expect(page.getByTestId('share-button')).toBeVisible();
    });

    await mainPage.openShareModal();

    await test.step('share modal URL contains ?state=', async () => {
      const urlValue = await mainPage.getShareUrl();
      expect(urlValue).toContain('?state=');
    });
  });

  test('import from shared URL', async ({ page }) => {
    await mainPage.addPlayers(DEFAULT_PLAYERS);
    await mainPage.openShareModal();
    const shareUrl = await mainPage.getShareUrl();
    expect(shareUrl).toContain('?state=');

    await page.evaluate(() => localStorage.clear());
    await page.goto(shareUrl);
    await page.waitForLoadState('networkidle');

    await test.step('import modal visible with shared metadata', async () => {
      await expect(page.getByTestId('import-state-modal')).toBeVisible({ timeout: 5000 });
      await expect(page.getByTestId('shared-saved-at')).toBeVisible();
      await expect(page.getByTestId('current-saved-at')).not.toBeVisible();
    });

    await page.getByTestId('import-state-accept').click();
    await page.waitForLoadState('networkidle');

    await test.step('accepting loads players from shared state', async () => {
      await mainPage.expandPlayersSection();
      await expect(page.getByText('Alice')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('Bob')).toBeVisible();
      await expect(page.getByText('Charlie')).toBeVisible();
      await expect(page.getByText('Diana')).toBeVisible();
      expect(page.url()).not.toContain('?state=');
    });
  });

  test('Decline import keeps original session and cleans URL', async ({ page }) => {
    await mainPage.addPlayers(DEFAULT_PLAYERS);
    await mainPage.openShareModal();
    const shareUrl = await mainPage.getShareUrl();

    await page.goto(shareUrl);
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('import-state-modal')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('shared-saved-at')).not.toBeVisible();
    await expect(page.getByTestId('current-saved-at')).not.toBeVisible();
    await page.getByTestId('import-state-decline').click();

    await expect(page.getByTestId('import-state-modal')).not.toBeVisible();
    expect(page.url()).not.toContain('?state=');

    await mainPage.expandPlayersSection();
    await expect(page.getByText('Alice')).toBeVisible();
  });
});
