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

  test('Share button appears after adding players', async ({ page }) => {
    await expect(page.getByTestId('share-button')).not.toBeVisible();
    await mainPage.addPlayers(DEFAULT_PLAYERS);
    await expect(page.getByTestId('share-button')).toBeVisible();
  });

  test('Clicking Share opens modal with URL containing ?state=', async ({ page: _page }) => {
    await mainPage.addPlayers(DEFAULT_PLAYERS);
    await mainPage.openShareModal();

    const urlValue = await mainPage.getShareUrl();
    expect(urlValue).toContain('?state=');
  });

  test('Navigate to shared URL shows ImportStateModal', async ({ page }) => {
    await mainPage.addPlayers(DEFAULT_PLAYERS);
    await mainPage.openShareModal();
    const shareUrl = await mainPage.getShareUrl();
    expect(shareUrl).toContain('?state=');

    await page.evaluate(() => localStorage.clear());
    await page.goto(shareUrl);
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('import-state-modal')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('shared-saved-at')).toBeVisible();
    await expect(page.getByTestId('current-saved-at')).not.toBeVisible();
  });

  test('Accept import loads players from shared state', async ({ page }) => {
    await mainPage.addPlayers(DEFAULT_PLAYERS);
    await mainPage.openShareModal();
    const shareUrl = await mainPage.getShareUrl();

    await page.evaluate(() => localStorage.clear());
    await page.goto(shareUrl);
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('import-state-modal')).toBeVisible({ timeout: 5000 });
    await page.getByTestId('import-state-accept').click();
    await page.waitForLoadState('networkidle');

    await mainPage.expandPlayersSection();
    await expect(page.getByText('Alice')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Bob')).toBeVisible();
    await expect(page.getByText('Charlie')).toBeVisible();
    await expect(page.getByText('Diana')).toBeVisible();

    expect(page.url()).not.toContain('?state=');
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
