import { Page, expect } from '@playwright/test';

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

  /** Click the Elimination type pill. */
  async selectEliminationType(): Promise<void> {
    await this.page.getByTestId('tournament-type-pill-elimination').click();
  }

  /** Start tournament and wait for the elimination bracket to appear. */
  async startElimination(): Promise<void> {
    await this.page.getByTestId('start-tournament-button').click();
    await expect(this.page.getByTestId('elimination-bracket')).toBeVisible();
  }

  /** Click a team row in the bracket by match data-testid and team number. */
  async clickBracketTeam(matchId: string, team: 1 | 2): Promise<void> {
    await this.page.getByTestId(`bracket-team-${team}-${matchId}`).click();
  }

  /** Confirm the score modal (uses default scores). */
  async confirmResult(): Promise<void> {
    await this.page.getByTestId('score-modal-confirm').click();
  }
}
