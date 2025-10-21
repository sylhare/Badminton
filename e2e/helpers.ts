import { expect } from '@playwright/test';

export const ANIMATION_TIMEOUT = 300;
export const TRANSITION_TIMEOUT = 500;
export const STABLE_VIEW_TIMEOUT = 1000;
export const VIEWPORT_STABILIZATION_TIMEOUT = 200;

export const MOBILE_VIEWPORT = { width: 375, height: 667 };
export const DESKTOP_VIEWPORT = { width: 1024, height: 768 };

/**
 * Base test utilities
 */
export class TestHelpers {
  static getTargetUrl(): string {
    return process.env.E2E_BASE_URL || 'http://localhost:5173';
  }

  static async setupCleanState(page: any): Promise<void> {
    await page.goto(this.getTargetUrl());
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  }

  static async addBulkPlayers(page: any, names: string[]): Promise<void> {
    const bulkTextarea = page.getByTestId('bulk-input').locator(':visible').first();
    await expect(bulkTextarea).toBeVisible();
    await bulkTextarea.fill(names.join('\n'));
    await page.getByTestId('add-bulk-button').locator(':visible').first().click();
  }

  static async addSinglePlayer(page: any, name: string): Promise<void> {
    const singlePlayerInput = page.getByTestId('single-player-input').locator(':visible').first();
    await expect(singlePlayerInput).toBeVisible();
    await singlePlayerInput.fill(name);
    await page.getByTestId('add-single-button').locator(':visible').first().click();
  }

  static async waitForStableView(page: any, timeout: number = STABLE_VIEW_TIMEOUT): Promise<void> {
    await page.waitForTimeout(timeout);
    await page.waitForLoadState('domcontentloaded');
  }
}

/**
 * Floating menu specific test utilities
 */
export class FloatingMenuTestHelpers extends TestHelpers {
  static async setMobileViewport(page: any): Promise<void> {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.waitForTimeout(VIEWPORT_STABILIZATION_TIMEOUT);
    await page.waitForLoadState('domcontentloaded');
  }

  static async setDesktopViewport(page: any): Promise<void> {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.waitForTimeout(VIEWPORT_STABILIZATION_TIMEOUT);
    await page.waitForLoadState('domcontentloaded');
  }

  static async setupCollapsedStepForMobile(page: any) {
    await this.setMobileViewport(page);
    
    await this.addBulkPlayers(page, ['Alice', 'Bob', 'Charlie', 'Diana']);
    await expect(page.getByTestId('stats-present-count').first()).toHaveText('4');

    const floatingButton = page.locator('.floating-action-btn');
    await expect(floatingButton).toBeVisible();
    
    return floatingButton;
  }

  static async waitForStableView(page: any, timeout: number = TRANSITION_TIMEOUT): Promise<void> {
    await page.waitForTimeout(timeout);
    await page.waitForLoadState('domcontentloaded');
  }
}
