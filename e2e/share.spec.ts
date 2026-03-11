import { expect, test } from '@playwright/test';

import { addPlayers, expandSectionIfNeeded, goToApp } from './helpers';

test.describe('Session Sharing via URL', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('Share button appears after adding players', async ({ page }) => {
    await expect(page.getByTestId('share-button')).not.toBeVisible();

    await addPlayers(page, ['Alice', 'Bob', 'Charlie', 'Diana']);
    await expect(page.getByTestId('share-button')).toBeVisible();
  });

  test('Clicking Share opens modal with URL containing ?state=', async ({ page }) => {
    await addPlayers(page, ['Alice', 'Bob', 'Charlie', 'Diana']);
    await page.getByTestId('share-button').click();

    await expect(page.getByTestId('share-modal')).toBeVisible();

    const urlInput = page.getByTestId('share-url-input');
    await expect(urlInput).toBeVisible();
    const urlValue = await urlInput.inputValue();
    expect(urlValue).toContain('?state=');
  });

  test('Navigate to shared URL shows ImportStateModal', async ({ page }) => {
    await addPlayers(page, ['Alice', 'Bob', 'Charlie', 'Diana']);
    await page.getByTestId('share-button').click();

    const urlInput = page.getByTestId('share-url-input');
    const shareUrl = await urlInput.inputValue();
    expect(shareUrl).toContain('?state=');

    await page.evaluate(() => localStorage.clear());
    await page.goto(shareUrl);
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('import-state-modal')).toBeVisible({ timeout: 5000 });
  });

  test('Accept import loads players from shared state', async ({ page }) => {
    await addPlayers(page, ['Alice', 'Bob', 'Charlie', 'Diana']);
    await page.getByTestId('share-button').click();

    const shareUrl = await page.getByTestId('share-url-input').inputValue();

    await page.evaluate(() => localStorage.clear());
    await page.goto(shareUrl);
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('import-state-modal')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('import-state-accept').click();
    await page.waitForLoadState('networkidle');

    await expandSectionIfNeeded(page, 'Manage Players');
    await expect(page.getByText('Alice')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Bob')).toBeVisible();
    await expect(page.getByText('Charlie')).toBeVisible();
    await expect(page.getByText('Diana')).toBeVisible();

    expect(page.url()).not.toContain('?state=');
  });

  test('Decline import keeps original session and cleans URL', async ({ page }) => {
    await addPlayers(page, ['Alice', 'Bob', 'Charlie', 'Diana']);
    await page.getByTestId('share-button').click();

    const shareUrl = await page.getByTestId('share-url-input').inputValue();

    await page.goto(shareUrl);
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('import-state-modal')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('import-state-decline').click();

    await expect(page.getByTestId('import-state-modal')).not.toBeVisible();
    expect(page.url()).not.toContain('?state=');

    await expandSectionIfNeeded(page, 'Manage Players');
    await expect(page.getByText('Alice')).toBeVisible();
  });
});
