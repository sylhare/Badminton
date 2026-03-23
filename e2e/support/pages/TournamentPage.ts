import { expect, Page } from '@playwright/test';

import { MainPage } from './MainPage';

/**
 * Page object for the Tournament page (/tournament).
 */
export class TournamentPage {
  private readonly url: string;

  constructor(private page: Page, private mainPage: MainPage) {
    this.url = (process.env.E2E_BASE_URL || 'http://localhost:5173') + '/tournament';
  }

  /** Navigate directly to the tournament page. */
  async goto(): Promise<void> {
    await this.page.goto(this.url);
  }

  /** Add players via MainPage, then navigate to the tournament page. */
  async setup(players: string[]): Promise<void> {
    await this.mainPage.addPlayers(players);
    await this.goto();
  }

  /** Click Start Tournament and wait for the matches view to appear. */
  async start(): Promise<void> {
    await this.page.getByTestId('start-tournament-button').click();
    await expect(this.page.getByTestId('tournament-matches')).toBeVisible();
  }
}
