import { Page } from '@playwright/test';

/**
 * Page object for the Stats page (/stats).
 */
export class StatsPage {
  private readonly url: string;

  constructor(private page: Page) {
    const base = (process.env.E2E_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
    this.url = base + '/stats';
  }

  /** Navigate directly to the stats page via URL. */
  async goto(): Promise<void> {
    await this.page.goto(this.url);
  }

  /** True if the stats data grid is visible (i.e. there is session data). */
  async hasData(): Promise<boolean> {
    return this.page.locator('.stats-grid').isVisible();
  }
}
