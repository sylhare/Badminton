import { expect, test } from '@playwright/test';

import { DEFAULT_PLAYERS } from '../support/helpers';
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
    await tournamentPage.setup(DEFAULT_PLAYERS);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    await test.step('tbd nodes visible before results are entered', async () => {
      await expect(page.locator('[data-testid="bracket-node-tbd"]').first()).toBeVisible();
    });

    await expect(page.getByTestId('bracket-round-label-Semi-Final')).toBeVisible();
    await expect(page.getByTestId('wb-section')).toBeVisible();

    await expect(page.getByTestId('cb-section')).not.toBeVisible();

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

    await test.step('bye-advance node visible with odd player count', async () => {
      await expect(page.locator('[data-testid="bracket-node-bye"]').first()).toBeVisible();
    });

    await expect(page.getByTestId('cb-section')).not.toBeVisible();

    const wbSection = page.getByTestId('wb-section');

    await wbSection.locator('[data-testid^="bracket-team-1-"]').nth(0).click();
    await page.getByTestId('score-modal-confirm').click();
    await wbSection.locator('[data-testid^="bracket-team-1-"]').nth(1).click();
    await page.getByTestId('score-modal-confirm').click();

    const cbSection = page.getByTestId('cb-section');

    await test.step('CB has 2 rounds: R1 + Final fed by WB Semi-Final loser', async () => {
      await expect(cbSection).toBeVisible();
      await expect(cbSection.locator('[data-testid="bracket-node-match"]')).toHaveCount(1);
      await expect(cbSection.locator('[data-testid="bracket-node-tbd"]')).toHaveCount(1);

      await cbSection.locator('[data-testid^="bracket-team-1-"]').nth(0).click();
      await page.getByTestId('score-modal-confirm').click();
      await expect(cbSection.locator('[data-testid="bracket-node-tbd"]')).toHaveCount(1);

      await wbSection.locator('[data-testid^="bracket-team-1-"]').nth(2).click();
      await page.getByTestId('score-modal-confirm').click();
      await expect(cbSection.locator('[data-testid="bracket-node-tbd"]')).toHaveCount(0);
      await expect(cbSection.locator('[data-testid="bracket-node-match"]')).toHaveCount(2);

      await cbSection.locator('[data-testid^="bracket-team-1-"]').nth(1).click();
      await page.getByTestId('score-modal-confirm').click();

      await wbSection.locator('[data-testid^="bracket-team-1-"]').nth(3).click();
      await page.getByTestId('score-modal-confirm').click();
    });

    await test.step('final results: gold medal visible, CB winner ranked 3rd, WB finalist 2nd', async () => {
      await expect(page.getByTestId('standings-subtitle')).toHaveText('Final Results');
      await expect(page.getByTestId('standing-row-0')).toContainText('🥇');
      await expect(page.getByTestId('standing-row-1')).toContainText('Eve');
      await expect(page.getByTestId('standing-row-2')).toContainText('Bob');
    });
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

    await page.getByTestId('new-tournament-button').click();

    await expect(page.getByTestId('tournament-type-selector')).toBeVisible();
    await expect(page.getByTestId('start-tournament-button')).toBeVisible();

    await tournamentPage.selectType('round-robin');
    await tournamentPage.start();

    await expect(page.getByTestId('tournament-matches')).toBeVisible();
    await expect(page.getByTestId('elimination-bracket')).not.toBeVisible();
  });

  test('consolation bracket — 6-player: CB Final shows players after single CB R1 match (odd seeds bug)', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank']);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    const wbSection = page.getByTestId('wb-section');
    const cbSection = page.getByTestId('cb-section');

    for (let i = 0; i < 3; i++) {
      await wbSection.locator('[data-testid^="bracket-team-1-"]').nth(i).click();
      await page.getByTestId('score-modal-confirm').click();
    }

    await expect(cbSection).toBeVisible();
    await expect(cbSection.locator('[data-testid="bracket-node-match"]')).toHaveCount(1);
    await expect(cbSection.locator('[data-testid="bracket-node-bye"]')).toHaveCount(1);

    await expect(cbSection.locator('[data-testid="bracket-node-tbd"]')).toHaveCount(1);

    await cbSection.locator('[data-testid^="bracket-team-1-"]').nth(0).click();
    await page.getByTestId('score-modal-confirm').click();

    await expect(cbSection.locator('[data-testid="bracket-node-tbd"]')).toHaveCount(0);
    await expect(cbSection.locator('[data-testid="bracket-node-match"]')).toHaveCount(2);

    await cbSection.locator('[data-testid^="bracket-team-1-"]').nth(1).click();
    await page.getByTestId('score-modal-confirm').click();

    await expect(page.getByTestId('tournament-standings')).toBeVisible();
  });
});
