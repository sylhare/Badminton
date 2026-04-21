import { expect, Page } from '@playwright/test';

import { MainPage } from './MainPage';

/**
 * Page object for the Tournament page (/tournament).
 */
export class TournamentPage {
  private readonly url: string;

  constructor(private page: Page, private mainPage: MainPage) {
    const base = (process.env.E2E_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
    this.url = base + '/tournament';
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

  /** Click Start Tournament and wait for the matches view to appear (round-robin). */
  async start(): Promise<void> {
    await this.page.getByTestId('start-tournament-button').click();
    await expect(this.page.getByTestId('tournament-matches')).toBeVisible();
  }

  /** Click Start Tournament and wait for the elimination bracket to appear. */
  async startElimination(): Promise<void> {
    await this.page.getByTestId('start-tournament-button').click();
    await expect(this.page.getByTestId('elimination-bracket')).toBeVisible();
  }

  /** Select the tournament type before starting. */
  async selectType(type: 'round-robin' | 'elimination'): Promise<void> {
    await this.page.getByTestId(`type-pill-${type}`).click();
  }

  /** Add players directly via the tournament page's ManualPlayerEntry. */
  async addPlayers(players: string[]): Promise<void> {
    const input = this.page.getByTestId('player-entry-input');
    await expect(input).toBeVisible();
    await input.fill(players.join(','));
    await this.page.getByTestId('add-player-button').click();
    await this.page.waitForTimeout(100);
  }
}
