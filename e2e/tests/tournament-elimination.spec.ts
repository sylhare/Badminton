import { expect, test } from '@playwright/test';

import { MainPage } from '../support/pages/MainPage';
import { TournamentPage } from '../support/pages/TournamentPage';

test.describe('Tournament Page - Elimination', () => {
  let mainPage: MainPage;
  let tournamentPage: TournamentPage;

  test.beforeEach(async ({ page }) => {
    mainPage = new MainPage(page);
    tournamentPage = new TournamentPage(page, mainPage);
    await mainPage.goto();
    await mainPage.reset();
  });

  test('mode selector is visible with Round Robin default', async ({ page }) => {
    await tournamentPage.goto();
    await expect(page.getByTestId('type-pill-round-robin')).toBeVisible();
    await expect(page.getByTestId('type-pill-elimination')).toBeVisible();
    await expect(page.getByTestId('type-pill-round-robin')).toHaveClass(/format-pill-active/);
  });

  test('full 4-player elimination tournament (singles)', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana']);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    // WB should show "Semi Final" and "Final" columns
    await expect(page.getByTestId('bracket-round-label-Semi-Final')).toBeVisible();
    await expect(page.getByTestId('wb-section')).toBeVisible();

    // CB section should not be visible yet (WB R1 not complete)
    await expect(page.getByTestId('cb-section')).not.toBeVisible();

    // Record WB R1 matches
    const wbR1Teams = await page.locator('[data-testid^="bracket-team-1-"]').all();
    expect(wbR1Teams.length).toBeGreaterThanOrEqual(2);

    // Click first team in first WB match
    await wbR1Teams[0].click();
    await page.getByTestId('score-modal-confirm').click();

    // Click first team in second WB match
    const wbR1TeamsAfter = await page.locator('[data-testid^="bracket-team-1-"]').all();
    await wbR1TeamsAfter[1].click();
    await page.getByTestId('score-modal-confirm').click();

    // After WB R1 complete, CB section should appear
    await expect(page.getByTestId('cb-section')).toBeVisible();

    // Standings should be visible
    await expect(page.getByTestId('tournament-standings')).toBeVisible();
  });

  test('5-player elimination (singles) — bye-advance node visible', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana', 'Eve']);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    // Should have a bye-advance node (Eve is at slot 4, gets a bye)
    await expect(page.locator('[data-testid="bracket-node-bye"]').first()).toBeVisible();
  });

  test('8-player elimination — correct column headers', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry']);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    await expect(page.getByTestId('bracket-round-label-4th-of-Final')).toBeVisible();
    await expect(page.getByTestId('bracket-round-label-Semi-Final')).toBeVisible();
  });

  test('elimination tournament state persists across reload', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana']);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    // Record one result
    const firstTeamBtn = page.locator('[data-testid^="bracket-team-1-"]').first();
    await firstTeamBtn.click();
    await page.getByTestId('score-modal-confirm').click();

    // Reload
    await page.reload();

    // Should restore in elimination mode
    await expect(page.getByTestId('elimination-bracket')).toBeVisible({ timeout: 5000 });
  });

  test('can switch back to round-robin after resetting elimination tournament', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana']);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    // Reset to setup
    await page.getByTestId('new-tournament-button').click();

    // Should be back in setup with mode selector visible
    await expect(page.getByTestId('tournament-type-selector')).toBeVisible();
    await expect(page.getByTestId('start-tournament-button')).toBeVisible();

    // Start as round-robin
    await tournamentPage.selectType('round-robin');
    await tournamentPage.start();

    await expect(page.getByTestId('tournament-matches')).toBeVisible();
    await expect(page.getByTestId('elimination-bracket')).not.toBeVisible();
  });

  test('tbd nodes render for future rounds before results are entered', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana']);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    // Round 2 (final) should show TBD before any results
    await expect(page.locator('[data-testid="bracket-node-tbd"]').first()).toBeVisible();
  });
});
