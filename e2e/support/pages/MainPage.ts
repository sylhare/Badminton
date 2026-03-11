import { Page, expect } from '@playwright/test';

import { CourtCard } from './CourtCard';

/**
 * Page object for the main Badminton Court Manager app (/).
 *
 * @example
 * let mainPage: MainPage;
 * test.beforeEach(async ({ page }) => {
 *   mainPage = new MainPage(page);
 *   await mainPage.goto();
 *   await mainPage.reset();
 * });
 */
export class MainPage {
  private readonly baseUrl: string;

  constructor(private page: Page) {
    this.baseUrl = process.env.E2E_BASE_URL || 'http://localhost:5173';
  }

  /** Navigate to the app and verify it loaded. */
  async goto(): Promise<void> {
    await this.page.goto(this.baseUrl);
    await expect(this.page).toHaveTitle(/Badminton/);
    await expect(this.page.locator('h1')).toContainText('🏸 Badminton Court Manager');
  }

  /** Clear localStorage and reload — call in beforeEach to start with a clean slate. */
  async reset(): Promise<void> {
    await this.page.evaluate(() => localStorage.clear());
    await this.page.reload();
  }

  /** Add multiple players at once via the comma-separated input. */
  async addPlayers(players: string[]): Promise<void> {
    const input = this.page.getByTestId('player-entry-input');
    await expect(input).toBeVisible();
    await input.fill(players.join(','));
    await this.page.getByTestId('add-player-button').click();
    await this.page.waitForTimeout(100);
  }

  /** Add a single player. */
  async addPlayer(name: string): Promise<void> {
    await this.addPlayers([name]);
  }

  /** Expand the Manage Players section if it is currently collapsed. */
  async expandPlayersSection(): Promise<void> {
    const header = this.page.locator('h2').filter({ hasText: /Manage Players/ });
    const isCollapsed = await header
      .locator('..')
      .evaluate(el => el.closest('.section')?.classList.contains('collapsed'));
    if (isCollapsed) {
      await header.click();
      await this.page.waitForTimeout(200);
    }
  }

  /** Remove the first player in the list (opens and confirms the removal modal). */
  async removeFirstPlayer(): Promise<void> {
    await this.page.locator('[data-testid^="remove-player-"]').first().click();
    await this.page.getByTestId('player-removal-modal-remove').click();
  }

  /** Toggle the presence state of the first player. */
  async toggleFirstPlayer(): Promise<void> {
    await this.page.locator('[data-testid^="toggle-presence-"]').first().click();
  }

  /** Set the court count input. Uses the native value setter to trigger React's synthetic events. */
  async setCourtCount(count: number): Promise<void> {
    const input = this.page.getByTestId('court-count-input');
    await input.evaluate((el: HTMLInputElement, val: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (setter) setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, count.toString());
    await this.page.waitForTimeout(100);
  }

  /** Click Generate and wait for court cards to appear. Optionally set the court count first. */
  async generateAssignments(expectedCount?: number): Promise<void> {
    if (expectedCount !== undefined) await this.setCourtCount(expectedCount);
    const btn = this.page.getByTestId('generate-assignments-button');
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(this.page.locator('.court-card').first()).toBeVisible({ timeout: 5000 });
    if (expectedCount !== undefined) {
      await expect(this.page.locator('.court-card')).toHaveCount(expectedCount);
    }
  }

  /** Click Generate without any setup, just waiting for courts to appear. */
  async regenerate(): Promise<void> {
    await this.page.getByTestId('generate-assignments-button').click();
    await expect(this.page.locator('.court-card').first()).toBeVisible({ timeout: 5000 });
  }

  /** Return a CourtCard object for the given court number. */
  court(number: number): CourtCard {
    return new CourtCard(this.page.getByTestId(`court-${number}`), this.page);
  }

  /** True if the Leaderboard heading is currently visible. */
  async isLeaderboardVisible(): Promise<boolean> {
    return this.page.locator('h2').filter({ hasText: 'Leaderboard' }).isVisible();
  }

  /** Returns player names from the leaderboard, stripping leading medal/emoji characters. */
  async getLeaderboardPlayerNames(): Promise<string[]> {
    const cells = this.page.locator('.leaderboard-table tbody tr td:nth-child(2)');
    const contents = await cells.allTextContents();
    return contents.map(n => n.replace(/^[^\w]+/, '').trim());
  }

  /** Toggle the Smart Engine on or off (expands the players section first if needed). */
  async toggleSmartEngine(): Promise<void> {
    await this.expandPlayersSection();
    await this.page.getByTestId('smart-engine-toggle-label').click();
  }

  /**
   * Fill the score input modal and confirm it.
   * Asserts the modal is visible before filling and gone after confirming.
   */
  async enterScore(team1Score: string, team2Score: string): Promise<void> {
    await expect(this.page.getByTestId('score-input-modal')).toBeVisible();
    await this.page.getByTestId('score-input-team1').fill(team1Score);
    await this.page.getByTestId('score-input-team2').fill(team2Score);
    await this.page.getByTestId('score-modal-confirm').click();
    await expect(this.page.getByTestId('score-input-modal')).not.toBeVisible();
  }

  /** Click the share button and wait for the modal to appear. */
  async openShareModal(): Promise<void> {
    await this.page.getByTestId('share-button').click();
    await expect(this.page.getByTestId('share-modal')).toBeVisible();
  }

  /** Return the current value of the share URL input (call after openShareModal). */
  async getShareUrl(): Promise<string> {
    return this.page.getByTestId('share-url-input').inputValue();
  }

  /**
   * Quick setup: add players and generate the first round.
   * Equivalent to the old `setupGameWithPlayers` helper.
   */
  async setupGame(players: string[]): Promise<void> {
    await this.addPlayers(players);
    await this.page.getByTestId('generate-assignments-button').click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Play one round: click the first available team and regenerate.
   * For use in normal mode (no score modal).
   */
  async playRound(): Promise<void> {
    await this.page.locator('.team-clickable').first().click();
    await this.page.getByTestId('generate-assignments-button').click();
    await this.page.waitForTimeout(200);
  }
}
