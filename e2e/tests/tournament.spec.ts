import { test, expect } from '@playwright/test';

import { MainPage } from '../support/pages/MainPage';

const TOURNAMENT_URL = (process.env.E2E_BASE_URL || 'http://localhost:5173') + '/tournament';

test.describe('Tournament Page', () => {
  let mainPage: MainPage;

  test.beforeEach(async ({ page }) => {
    mainPage = new MainPage(page);
    await mainPage.goto();
    await mainPage.reset();
  });

  test('navigate to tournament page directly', async ({ page }) => {
    await page.goto(TOURNAMENT_URL);
    await expect(page.locator('h1')).toContainText('🏆 Tournament Mode');
  });

  test('setup flow - present players pre-selected', async ({ page }) => {
    await mainPage.addPlayers(['Alice', 'Bob', 'Charlie', 'Diana']);
    await page.goto(TOURNAMENT_URL);

    await expect(page.locator('h1')).toContainText('Tournament Mode');
    await expect(page.getByText('Alice')).toBeVisible();
    await expect(page.getByText('Bob')).toBeVisible();
  });

  test('format switch: singles vs doubles updates team display', async ({ page }) => {
    await mainPage.addPlayers(['Alice', 'Bob', 'Charlie', 'Diana']);
    await page.goto(TOURNAMENT_URL);

    // Default: doubles → 2 teams
    await expect(page.locator('[data-testid^="team-card-"]')).toHaveCount(2);

    // Switch to singles → 4 teams
    await page.getByTestId('format-pill-singles').click();
    await expect(page.locator('[data-testid^="team-card-"]')).toHaveCount(4);

    // Switch back to doubles → 2 teams
    await page.getByTestId('format-pill-doubles').click();
    await expect(page.locator('[data-testid^="team-card-"]')).toHaveCount(2);
  });

  test('team swap: click two slots swaps players', async ({ page }) => {
    await mainPage.addPlayers(['Alice', 'Bob', 'Charlie', 'Diana']);
    await page.goto(TOURNAMENT_URL);

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
    await mainPage.addPlayers(['Alice', 'Bob', 'Charlie']);
    await page.goto(TOURNAMENT_URL);

    await expect(page.getByTestId('start-tournament-button')).toBeDisabled();
    await expect(page.getByTestId('setup-error')).toBeVisible();
  });

  test('full singles tournament with 3 players: 3 rounds, record results, finish', async ({ page }) => {
    await mainPage.addPlayers(['Alice', 'Bob', 'Charlie']);
    await page.goto(TOURNAMENT_URL);

    await page.getByTestId('format-pill-singles').click();

    await expect(page.getByTestId('start-tournament-button')).not.toBeDisabled();
    await page.getByTestId('start-tournament-button').click();

    await expect(page.getByTestId('tournament-matches')).toBeVisible();

    await expect(page.getByTestId('round-1')).toBeVisible();
    await expect(page.getByTestId('round-2')).toBeVisible();
    await expect(page.getByTestId('round-3')).toBeVisible();

    // Record result for round 1
    const firstClickable = page.locator('.singles-player-clickable').first();
    await firstClickable.click();

    await expect(page.getByTestId('score-input-modal')).toBeVisible();
    await page.getByTestId('score-input-team1').fill('21');
    await page.getByTestId('score-input-team2').fill('15');
    await page.getByTestId('score-modal-confirm').click();
    await expect(page.getByTestId('score-input-modal')).not.toBeVisible();

    // Standings should show After Round 1 / 3
    await expect(page.getByTestId('standings-subtitle')).toContainText('After Round 1 / 3');
  });

  test('tiebreaker: standings table renders with score diff', async ({ page }) => {
    await mainPage.addPlayers(['Alice', 'Bob', 'Charlie', 'Diana']);
    await page.goto(TOURNAMENT_URL);

    await page.getByTestId('format-pill-singles').click();
    await page.getByTestId('start-tournament-button').click();

    await expect(page.getByTestId('tournament-standings')).toBeVisible();
    await expect(page.locator('.standings-table')).toBeVisible();
  });

  test('doubles tournament: start, record match, start new tournament', async ({ page }) => {
    await mainPage.addPlayers(['Alice', 'Bob', 'Charlie', 'Diana']);
    await page.goto(TOURNAMENT_URL);

    // Doubles: 4 players → 2 teams → 1 match
    await page.getByTestId('start-tournament-button').click();
    await expect(page.getByTestId('tournament-matches')).toBeVisible();

    const team1 = page.locator('[data-testid="team-1"]').first();
    await team1.click();
    await expect(page.getByTestId('score-input-modal')).toBeVisible();
    await page.getByTestId('score-modal-confirm').click();

    await expect(page.getByTestId('new-tournament-button')).toBeVisible();
    await page.getByTestId('new-tournament-button').click();

    await expect(page.getByTestId('start-tournament-button')).toBeVisible();
  });
});
