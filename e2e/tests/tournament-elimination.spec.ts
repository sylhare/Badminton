import { expect, test, type Page } from '@playwright/test';

import { DEFAULT_PLAYERS } from '../support/helpers';
import { MainPage } from '../support/pages/MainPage';
import { TournamentPage } from '../support/pages/TournamentPage';

/** Decide every match (team 1 wins) across all sections until the whole bracket is complete. */
async function playWholeBracket(page: Page): Promise<void> {
  for (let guard = 0; guard < 40; guard++) {
    const undecided = page.locator('[data-testid="bracket-node-match"]')
      .filter({ hasNot: page.locator('.bracket-team-winner') });
    if (await undecided.count() === 0) break;
    await undecided.first().locator('[data-testid^="bracket-team-1-"]').click();
    await page.getByTestId('score-modal-confirm').click();
  }
}

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
    await tournamentPage.setup(DEFAULT_PLAYERS);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    await test.step('tbd nodes visible before results are entered', async () => {
      await expect(page.locator('[data-testid="bracket-node-tbd"]').first()).toBeVisible();
    });

    await expect(page.getByTestId('wb-section').getByTestId('bracket-round-label-Semi-Final')).toBeVisible();
    await expect(page.getByTestId('wb-section')).toBeVisible();

    await expect(page.getByTestId('cb-section')).toBeVisible();

    const wbR1Teams = await page.locator('[data-testid^="bracket-team-1-"]').all();
    expect(wbR1Teams.length).toBeGreaterThanOrEqual(2);

    await wbR1Teams[0].click();
    await page.getByTestId('score-modal-confirm').click();

    const wbR1TeamsAfter = await page.locator('[data-testid^="bracket-team-1-"]').all();
    await wbR1TeamsAfter[1].click();
    await page.getByTestId('score-modal-confirm').click();

    await expect(page.getByTestId('cb-section')).toBeVisible();

    await expect(page.getByTestId('tournament-standings')).toBeVisible();
  });

  test('5-player elimination play-through', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana', 'Eve']);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    await test.step('odd player count seeds byes onto the top seeds', async () => {
      await expect(page.locator('[data-testid="bracket-node-bye"]').first()).toBeVisible();
    });

    await playWholeBracket(page);

    await test.step('final results: five players ranked with a gold medal on top', async () => {
      await expect(page.getByTestId('standings-subtitle')).toHaveText('Final Results');
      await expect(page.getByTestId('standing-row-0')).toContainText('🥇');
      await expect(page.getByTestId('standing-row-4')).toBeVisible();
      await expect(page.getByTestId('standing-row-5')).toHaveCount(0);
    });
  });

  test('smart mode — winner row text is white for readability on the blue tint', async ({ page }) => {
    await mainPage.addPlayers(DEFAULT_PLAYERS);
    await mainPage.toggleSmartEngine();
    await tournamentPage.goto();
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    await expect(page.locator('.app.tournament-page')).toHaveClass(/smart-mode/);

    await page.locator('[data-testid^="bracket-team-1-"]').first().click();
    await page.getByTestId('score-modal-confirm').click();

    await expect(page.locator('.bracket-team-winner').first()).toHaveCSS('color', 'rgb(255, 255, 255)');
  });

  test('8-player elimination — correct column headers', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry']);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    const wbSection = page.getByTestId('wb-section');
    await expect(wbSection.getByTestId('bracket-round-label-4th-of-Final')).toBeVisible();
    await expect(wbSection.getByTestId('bracket-round-label-Semi-Final')).toBeVisible();
  });

  test('elimination tournament state persists across reload', async ({ page }) => {
    await tournamentPage.setup(DEFAULT_PLAYERS);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    const firstTeamBtn = page.locator('[data-testid^="bracket-team-1-"]').first();
    await firstTeamBtn.click();
    await page.getByTestId('score-modal-confirm').click();

    await page.reload();

    await expect(page.getByTestId('elimination-bracket')).toBeVisible({ timeout: 5000 });
  });

  test('can switch back to round-robin after resetting elimination tournament', async ({ page }) => {
    await tournamentPage.setup(DEFAULT_PLAYERS);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    await tournamentPage.startNew();

    await expect(page.getByTestId('tournament-type-selector')).toBeVisible();
    await expect(page.getByTestId('start-tournament-button')).toBeVisible();

    await tournamentPage.selectType('round-robin');
    await tournamentPage.start();

    await expect(page.getByTestId('tournament-matches')).toBeVisible();
    await expect(page.getByTestId('elimination-bracket')).not.toBeVisible();
  });

  test('score decides the winner even when the losing team was clicked', async ({ page }) => {
    await tournamentPage.setup(DEFAULT_PLAYERS);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    const wbSection = page.getByTestId('wb-section');
    const team1Btn = wbSection.locator('[data-testid^="bracket-team-1-"]').first();
    const matchId = (await team1Btn.getAttribute('data-testid'))!.replace('bracket-team-1-', '');
    const team2Btn = wbSection.getByTestId(`bracket-team-2-${matchId}`);

    await team1Btn.click();
    await expect(page.getByTestId('score-input-modal')).toBeVisible();
    await page.getByTestId('score-input-team1').fill('15');
    await page.getByTestId('score-input-team2').fill('21');
    await expect(page.getByText('🏆 Team 2 wins!')).toBeVisible();
    await page.getByTestId('score-modal-confirm').click();

    await expect(team2Btn).toHaveClass(/bracket-team-winner/);
    await expect(team1Btn).toHaveClass(/bracket-team-loser/);
  });

  test('6-player elimination — consolation bracket runs to a final and all six are ranked', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank']);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    await expect(page.getByTestId('cb-section')).toBeVisible();
    await playWholeBracket(page);

    await expect(page.getByTestId('standings-subtitle')).toHaveText('Final Results');
    await expect(page.getByTestId('standing-row-0')).toContainText('🥇');
    await expect(page.getByTestId('standing-row-5')).toBeVisible();
  });
});
