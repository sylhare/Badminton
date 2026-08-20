import { expect, Locator, Page } from '@playwright/test';

/**
 * Page object for a single court card element.
 * Obtain via `mainPage.court(n)`.
 */
export class CourtCard {
  constructor(
    private locator: Locator,
    private page: Page,
  ) {}

  /** Returns the text of all player elements in a team. */
  async getTeamPlayers(teamNumber: 1 | 2): Promise<string[]> {
    return this.locator.locator(`[data-testid="team-${teamNumber}"] .team-player`).allTextContents();
  }

  /** Click a team without asserting the winner crown (deferred by the Smart engine's score modal, or under load). */
  async clickTeam(teamNumber: 1 | 2 = 1, options?: { timeout?: number }): Promise<void> {
    const team =
      teamNumber === 1
        ? this.locator.locator('.team-clickable').first()
        : this.locator.locator('.team-clickable').last();
    await expect(team).toBeVisible({ timeout: options?.timeout });
    await team.click(options);
  }

  /** Clicks a team to select it as winner. Defaults to team 1. */
  async selectWinner(teamNumber: 1 | 2 = 1): Promise<void> {
    await this.clickTeam(teamNumber);
    await expect(this.locator.locator('.crown')).toBeVisible();
  }

  /** Clicks the rotate-teams button on this court. */
  async rotate(): Promise<void> {
    const btn = this.page.getByTestId('rotate-teams-button');
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(this.locator.locator('.crown')).not.toBeVisible();
  }
}
