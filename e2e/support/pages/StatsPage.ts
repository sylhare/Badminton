import { Page } from '@playwright/test';

/**
 * Page object for the Stats page (/stats).
 */
export class StatsPage {
  constructor(private page: Page) {}

  /** Navigate directly to the stats page via URL. */
  async goto(): Promise<void> {
    await this.page.goto('/stats');
  }

  /** True if the stats data grid is visible (i.e. there is session data). */
  async hasData(): Promise<boolean> {
    return this.page.locator('.stats-grid').isVisible();
  }
}
