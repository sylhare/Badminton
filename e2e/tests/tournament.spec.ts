import { expect, test } from '@playwright/test';

import { DEFAULT_PLAYERS } from '../support/helpers';
import { MainPage } from '../support/pages/MainPage';
import { TournamentPage } from '../support/pages/TournamentPage';

test.describe('Tournament Page', () => {
  let mainPage: MainPage;
  let tournamentPage: TournamentPage;

  test.beforeEach(async ({ page }) => {
    mainPage = new MainPage(page);
    tournamentPage = new TournamentPage(page, mainPage);
    await mainPage.goto();
    await mainPage.reset();
  });

  test('navigate to tournament page directly', async ({ page }) => {
    await tournamentPage.goto();
    await expect(page.locator('h1')).toContainText('Tournament');
  });

  test('tournament setup flow', async ({ page }) => {
    await tournamentPage.setup(DEFAULT_PLAYERS);

    await test.step('present players are pre-selected', async () => {
      await expect(page.locator('h1')).toContainText('Tournament');
      await expect(page.getByTestId('player-selection').getByText('Alice')).toBeVisible();
      await expect(page.getByTestId('player-selection').getByText('Bob')).toBeVisible();
    });

    await test.step('format switch: singles vs doubles updates team display', async () => {
      await expect(page.locator('[data-testid^="team-card-"]')).toHaveCount(2);

      await page.getByTestId('format-pill-singles').click();
      await expect(page.locator('[data-testid^="team-card-"]')).toHaveCount(4);

      await page.getByTestId('format-pill-doubles').click();
      await expect(page.locator('[data-testid^="team-card-"]')).toHaveCount(2);
    });

    await test.step('team swap: click two slots swaps players', async () => {
      const slot00 = page.getByTestId('player-slot-0-0');
      const slot10 = page.getByTestId('player-slot-1-0');

      await expect(slot00).toContainText('Alice');
      await expect(slot10).toContainText('Charlie');

      await slot00.click();
      await expect(slot00).toHaveClass(/swap-selected/);

      await slot10.click();

      await expect(page.getByTestId('player-slot-0-0')).toContainText('Charlie');
      await expect(page.getByTestId('player-slot-1-0')).toContainText('Alice');
    });
  });

  test('odd player count in doubles disables Start Tournament', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie']);

    await expect(page.getByTestId('start-tournament-button')).toBeDisabled();
    await expect(page.getByTestId('setup-error')).toBeVisible();
  });

  test('full singles tournament with 3 players: 3 rounds, record results, finish', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie']);

    await page.getByTestId('format-pill-singles').click();

    await expect(page.getByTestId('start-tournament-button')).not.toBeDisabled();
    await tournamentPage.start();

    await expect(page.getByTestId('round-1')).toBeVisible();
    await expect(page.getByTestId('round-2')).toBeVisible();
    await expect(page.getByTestId('round-3')).toBeVisible();

    const firstClickable = page.getByTestId('singles-player-team1').first();
    await firstClickable.click();

    await mainPage.enterScore('21', '15');

    await expect(page.getByTestId('standings-subtitle')).toContainText('After Round 1 / 3');
  });

  test('tiebreaker: standings table renders with score diff', async ({ page }) => {
    await tournamentPage.setup(DEFAULT_PLAYERS);

    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.start();

    await expect(page.getByTestId('tournament-standings')).toBeVisible();
    await expect(page.locator('.standings-table')).toBeVisible();
  });

  test('last round collapses when all matches complete', async ({ page }) => {
    await tournamentPage.setup(DEFAULT_PLAYERS);
    await tournamentPage.start();

    const totalRounds = await page.locator('[data-testid^="round-"]').count();
    for (let r = 1; r <= totalRounds; r++) {
      const roundSection = page.getByTestId(`round-${r}`);
      const team1Buttons = roundSection.locator('[data-testid="team-1"]');
      const count = await team1Buttons.count();
      for (let i = 0; i < count; i++) {
        await team1Buttons.nth(i).click();
        await expect(page.getByTestId('score-input-modal')).toBeVisible();
        await page.getByTestId('score-modal-confirm').click();
      }
    }

    const lastRound = page.getByTestId(`round-${totalRounds}`);
    await expect(lastRound.getByTestId('round-matches')).not.toBeVisible();
  });

  test('tournament state persists across page reload', async ({ page }) => {
    await tournamentPage.setup(DEFAULT_PLAYERS);
    await tournamentPage.start();

    const team1 = page.locator('[data-testid="team-1"]').first();
    await team1.click();
    await mainPage.enterScore('21', '10');

    await page.reload();

    await expect(page.getByTestId('tournament-matches')).toBeVisible();
    await expect(page.getByTestId('score-diff-0')).toBeVisible();
  });

  test('player added on tournament page persists after starting a new tournament', async ({ page }) => {
    await tournamentPage.goto();
    await tournamentPage.addPlayers(['Alice', 'Bob', 'Charlie', 'Eve']);

    await page.getByTestId('format-pill-singles').click();
    await expect(page.getByTestId('start-tournament-button')).not.toBeDisabled();
    await tournamentPage.start();

    await tournamentPage.startNew();

    await expect(page.getByTestId('player-selection')).toContainText('Eve');
  });

  test('player added on tournament page appears on main page', async ({ page }) => {
    await tournamentPage.goto();
    await tournamentPage.addPlayers(['Eve']);

    await mainPage.goto();
    await mainPage.expandPlayersSection();

    await expect(page.getByTestId('manage-players-section')).toContainText('Eve');
  });

  test('best-of-3: blank sets with default placeholders, locks the decider by default, records a 2-set clinch', async ({ page }) => {
    await tournamentPage.setup(DEFAULT_PLAYERS);

    await page.getByTestId('best-of-pill-3').click();
    await tournamentPage.start();

    const team1 = page.locator('[data-testid="team-1"]').first();
    await team1.click();

    const modal = page.getByTestId('score-input-modal');
    await expect(modal).toBeVisible();

    await test.step('each set starts blank with the winner default as a placeholder and can be confirmed at once', async () => {
      await expect(page.getByTestId('score-input-team1-0')).toHaveValue('');
      await expect(page.getByTestId('score-input-team1-0')).toHaveAttribute('placeholder', '21');
      await expect(page.getByTestId('score-input-team2-0')).toHaveAttribute('placeholder', '18');
      await expect(modal).toContainText('Team 1 wins');
      await expect(page.getByTestId('score-modal-confirm')).toBeEnabled();
    });

    await test.step('the deciding set is locked by default since the winner clinches in two', async () => {
      await expect(page.getByTestId('score-input-team1-2')).toBeDisabled();
      await expect(page.getByTestId('score-input-team2-2')).toBeDisabled();
    });

    await test.step('splitting the first two sets unlocks the decider, then a clinch re-locks it', async () => {
      await page.getByTestId('score-input-team1-0').fill('18');
      await page.getByTestId('score-input-team2-0').fill('21');
      await expect(page.getByTestId('score-input-team1-2')).toBeEnabled();
      await page.getByTestId('score-input-team1-0').fill('21');
      await page.getByTestId('score-input-team2-0').fill('15');
      await page.getByTestId('score-input-team1-1').fill('21');
      await page.getByTestId('score-input-team2-1').fill('18');
      await expect(page.getByTestId('score-input-team1-2')).toBeDisabled();
      await expect(page.getByTestId('score-input-team2-2')).toBeDisabled();
    });

    await page.getByTestId('score-modal-confirm').click();
    await expect(modal).not.toBeVisible();

    await expect(page.getByTestId('round-1')).toHaveClass(/round-complete/);
    await expect(page.getByTestId('round-matches')).toBeHidden();
    await page.getByTestId('round-header-1').click();
    await expect(page.locator('.match-score').first()).toContainText('21 – 15, 21 – 18');
  });

  test('doubles tournament: start, record match, start new tournament', async ({ page }) => {
    await tournamentPage.setup(DEFAULT_PLAYERS);
    await tournamentPage.start();

    const team1 = page.locator('[data-testid="team-1"]').first();
    await team1.click();
    await expect(page.getByTestId('score-input-modal')).toBeVisible();
    await page.getByTestId('score-modal-confirm').click();

    await expect(page.getByTestId('new-tournament-button')).toBeVisible();
    await tournamentPage.startNew();

    await expect(page.getByTestId('start-tournament-button')).toBeVisible();
  });
});
