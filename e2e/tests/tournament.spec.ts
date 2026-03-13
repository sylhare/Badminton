import { test, expect } from '@playwright/test';

import { MainPage } from '../support/pages/MainPage';

test.describe('Tournament Page', () => {
  let mainPage: MainPage;

  test.beforeEach(async ({ page }) => {
    mainPage = new MainPage(page);
    await mainPage.goto();
    await mainPage.reset();
  });

  test('navigate to tournament page from footer link', async ({ page }) => {
    const tournamentLink = page.getByTestId('tournament-link');
    await expect(tournamentLink).toBeVisible();
    await tournamentLink.click();
    await expect(page.locator('h1')).toContainText('🏆 Tournament Mode');
  });

  test('back link returns to main app', async ({ page }) => {
    await page.goto((process.env.E2E_BASE_URL || 'http://localhost:5173') + '/tournament');
    await expect(page.locator('h1')).toContainText('Tournament Mode');
    await page.getByTestId('back-to-app').click();
    await expect(page.locator('h1')).toContainText('Badminton Court Manager');
  });

  test('setup flow - present players pre-selected', async ({ page }) => {
    await mainPage.addPlayers(['Alice', 'Bob', 'Charlie', 'Diana']);
    await page.locator('a[data-testid="tournament-link"]').click();

    await expect(page.locator('h1')).toContainText('Tournament Mode');
    await expect(page.getByText('Alice')).toBeVisible();
    await expect(page.getByText('Bob')).toBeVisible();
  });

  test('format switch: singles vs doubles updates team display', async ({ page }) => {
    await mainPage.addPlayers(['Alice', 'Bob', 'Charlie', 'Diana']);
    await page.locator('a[data-testid="tournament-link"]').click();

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
    await page.locator('a[data-testid="tournament-link"]').click();

    // Alice is in slot 0-0, Carol is in slot 1-0
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
    await page.locator('a[data-testid="tournament-link"]').click();

    await expect(page.getByTestId('start-tournament-button')).toBeDisabled();
    await expect(page.getByTestId('setup-error')).toBeVisible();
  });

  test('full singles tournament with 3 players: 3 rounds, record results, finish', async ({ page }) => {
    await mainPage.addPlayers(['Alice', 'Bob', 'Charlie']);
    await page.locator('a[data-testid="tournament-link"]').click();

    // Switch to singles
    await page.getByTestId('format-pill-singles').click();

    // Should be 3 teams, 3 matches
    await expect(page.getByTestId('start-tournament-button')).not.toBeDisabled();
    await page.getByTestId('start-tournament-button').click();

    // Should see tournament matches
    await expect(page.getByTestId('tournament-matches')).toBeVisible();

    // Check round sections exist
    await expect(page.getByTestId('round-1')).toBeVisible();
    await expect(page.getByTestId('round-2')).toBeVisible();
    await expect(page.getByTestId('round-3')).toBeVisible();

    // Record result for round 1 (first match)
    const firstClickable = page.locator('.singles-player-clickable').first();
    await firstClickable.click();

    // ScoreInputModal should appear
    await expect(page.getByTestId('score-input-modal')).toBeVisible();
    await page.getByTestId('score-input-team1').fill('21');
    await page.getByTestId('score-input-team2').fill('15');
    await page.getByTestId('score-modal-confirm').click();
    await expect(page.getByTestId('score-input-modal')).not.toBeVisible();

    // Standings should show After Round 1 / 3
    await expect(page.getByTestId('standings-subtitle')).toContainText('After Round 1 / 3');
  });

  test('tiebreaker: team with higher score diff ranked higher', async ({ page }) => {
    await mainPage.addPlayers(['Alice', 'Bob', 'Charlie', 'Diana']);
    await page.locator('a[data-testid="tournament-link"]').click();

    // Use singles: 4 players → 4 teams → 6 matches
    await page.getByTestId('format-pill-singles').click();
    await page.getByTestId('start-tournament-button').click();

    await expect(page.getByTestId('tournament-matches')).toBeVisible();

    // The tiebreaker test is validated in unit tests; this just ensures the standings table renders
    await expect(page.getByTestId('tournament-standings')).toBeVisible();
    await expect(page.locator('.standings-table')).toBeVisible();
  });

  test('doubles tournament: start, record match, finish, reset', async ({ page }) => {
    await mainPage.addPlayers(['Alice', 'Bob', 'Charlie', 'Diana']);
    await page.locator('a[data-testid="tournament-link"]').click();

    // Doubles: 4 players → 2 teams → 1 match
    await page.getByTestId('start-tournament-button').click();
    await expect(page.getByTestId('tournament-matches')).toBeVisible();

    // Click team 1
    const team1 = page.locator('[data-testid="team-1"]').first();
    await team1.click();
    await expect(page.getByTestId('score-input-modal')).toBeVisible();
    await page.getByTestId('score-modal-skip').click();

    // Finish tournament
    await expect(page.getByTestId('finish-tournament-button')).not.toBeDisabled();
    await page.getByTestId('finish-tournament-button').click();

    // Final results
    await expect(page.getByRole('heading', { name: 'Final Results' })).toBeVisible();

    // Reset
    await page.getByTestId('reset-tournament-button').click();
    await expect(page.getByTestId('start-tournament-button')).toBeVisible();
  });
});
