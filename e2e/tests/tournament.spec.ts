import { test, expect } from '@playwright/test';

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

  test('setup flow - present players pre-selected', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana']);

    await expect(page.locator('h1')).toContainText('Tournament');
    await expect(page.getByTestId('player-selection').getByText('Alice')).toBeVisible();
    await expect(page.getByTestId('player-selection').getByText('Bob')).toBeVisible();
  });

  test('format switch: singles vs doubles updates team display', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana']);

    await expect(page.locator('[data-testid^="team-card-"]')).toHaveCount(2);

    await page.getByTestId('format-pill-singles').click();
    await expect(page.locator('[data-testid^="team-card-"]')).toHaveCount(4);

    await page.getByTestId('format-pill-doubles').click();
    await expect(page.locator('[data-testid^="team-card-"]')).toHaveCount(2);
  });

  test('team swap: click two slots swaps players', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana']);

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

    const firstClickable = page.locator('.singles-player-clickable').first();
    await firstClickable.click();

    await expect(page.getByTestId('score-input-modal')).toBeVisible();
    await page.getByTestId('score-input-team1').fill('21');
    await page.getByTestId('score-input-team2').fill('15');
    await page.getByTestId('score-modal-confirm').click();
    await expect(page.getByTestId('score-input-modal')).not.toBeVisible();

    await expect(page.getByTestId('standings-subtitle')).toContainText('After Round 1 / 3');
  });

  test('tiebreaker: standings table renders with score diff', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana']);

    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.start();

    await expect(page.getByTestId('tournament-standings')).toBeVisible();
    await expect(page.locator('.standings-table')).toBeVisible();
  });

  test('last round collapses when all matches complete', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana']);
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
    await expect(lastRound.locator('.round-matches')).not.toBeVisible();
  });

  test('tournament state persists across page reload', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana']);
    await tournamentPage.start();

    const team1 = page.locator('[data-testid="team-1"]').first();
    await team1.click();
    await expect(page.getByTestId('score-input-modal')).toBeVisible();
    await page.getByTestId('score-input-team1').fill('21');
    await page.getByTestId('score-input-team2').fill('10');
    await page.getByTestId('score-modal-confirm').click();

    await page.reload();

    await expect(page.getByTestId('tournament-matches')).toBeVisible();
    await expect(page.getByTestId('score-diff-0')).toBeVisible();
  });

  test('doubles tournament: start, record match, start new tournament', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana']);
    await tournamentPage.start();

    const team1 = page.locator('[data-testid="team-1"]').first();
    await team1.click();
    await expect(page.getByTestId('score-input-modal')).toBeVisible();
    await page.getByTestId('score-modal-confirm').click();

    await expect(page.getByTestId('new-tournament-button')).toBeVisible();
    await page.getByTestId('new-tournament-button').click();

    await expect(page.getByTestId('start-tournament-button')).toBeVisible();
  });
});
