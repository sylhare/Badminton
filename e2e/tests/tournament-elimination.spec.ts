import { test, expect } from '@playwright/test';

import { MainPage } from '../support/pages/MainPage';
import { TournamentPage } from '../support/pages/TournamentPage';

test.describe('Elimination Tournament', () => {
  let mainPage: MainPage;
  let tournamentPage: TournamentPage;

  test.beforeEach(async ({ page }) => {
    mainPage = new MainPage(page);
    tournamentPage = new TournamentPage(page, mainPage);
    await mainPage.goto();
    await mainPage.reset();
  });

  test('singles elimination — 4 players full walkthrough', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Carol', 'Dana']);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectEliminationType();
    await tournamentPage.startElimination();

    // R1: 2 match cards
    const matchCards = page.locator('[data-testid^="bracket-match-"]');
    await expect(matchCards).toHaveCount(2);

    const matchIds = await matchCards.evaluateAll((els: Element[]) =>
      els.map(el => el.getAttribute('data-testid')!.replace('bracket-match-', '')),
    );

    // Play R1 match 1 — team1 wins
    await tournamentPage.clickBracketTeam(matchIds[0], 1);
    await tournamentPage.confirmResult();

    // Play R1 match 2 — team1 wins
    await tournamentPage.clickBracketTeam(matchIds[1], 1);
    await tournamentPage.confirmResult();

    // R2 match should appear — 3 total match cards
    await expect(matchCards).toHaveCount(3);

    // Get R2 match ID (the new one)
    const allIds = await matchCards.evaluateAll((els: Element[]) =>
      els.map(el => el.getAttribute('data-testid')!.replace('bracket-match-', '')),
    );
    const r2MatchId = allIds.find(id => !matchIds.includes(id))!;

    // Play final
    await tournamentPage.clickBracketTeam(r2MatchId, 1);
    await tournamentPage.confirmResult();

    // Champion shown
    await expect(page.getByTestId('se-status-0')).toContainText('🏆');
  });

  test('doubles elimination — 4 players (2 teams, 1 match)', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Carol', 'Dana']);
    await tournamentPage.selectEliminationType();
    await tournamentPage.startElimination();

    // With 2 teams, only 1 match (the final)
    const matchCards = page.locator('[data-testid^="bracket-match-"]');
    await expect(matchCards).toHaveCount(1);

    const matchId = await matchCards.first().getAttribute('data-testid').then(id => id!.replace('bracket-match-', ''));

    await tournamentPage.clickBracketTeam(matchId, 1);
    await tournamentPage.confirmResult();

    await expect(page.getByTestId('se-status-0')).toContainText('🏆');
  });

  test('singles elimination — 3 players bye handling', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Carol']);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectEliminationType();
    await tournamentPage.startElimination();

    // 1 real match + 1 bye-advance slot
    const matchCards = page.locator('[data-testid^="bracket-match-"]');
    await expect(matchCards).toHaveCount(1);
    await expect(page.getByText('BYE')).toBeVisible();

    // Play the R1 real match
    const matchId = await matchCards.first().getAttribute('data-testid').then(id => id!.replace('bracket-match-', ''));
    await tournamentPage.clickBracketTeam(matchId, 1);
    await tournamentPage.confirmResult();

    // R2 final appears
    await expect(matchCards).toHaveCount(2);

    const allIds = await matchCards.evaluateAll((els: Element[]) =>
      els.map(el => el.getAttribute('data-testid')!.replace('bracket-match-', '')),
    );
    const r2MatchId = allIds.find(id => id !== matchId)!;

    await tournamentPage.clickBracketTeam(r2MatchId, 1);
    await tournamentPage.confirmResult();

    await expect(page.getByTestId('se-status-0')).toContainText('🏆');
  });

  test('elimination state persists across reload', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Carol', 'Dana']);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectEliminationType();
    await tournamentPage.startElimination();

    const matchCards = page.locator('[data-testid^="bracket-match-"]');
    const matchIds = await matchCards.evaluateAll((els: Element[]) =>
      els.map(el => el.getAttribute('data-testid')!.replace('bracket-match-', '')),
    );

    // Play first match
    await tournamentPage.clickBracketTeam(matchIds[0], 1);
    await tournamentPage.confirmResult();

    // Winner style visible before reload
    await expect(page.getByTestId(`bracket-team-1-${matchIds[0]}`)).toHaveClass(/bracket-team-winner/);

    await page.reload();

    // Bracket still visible and winner preserved
    await expect(page.getByTestId('elimination-bracket')).toBeVisible();
    await expect(page.getByTestId(`bracket-team-1-${matchIds[0]}`)).toHaveClass(/bracket-team-winner/);
  });
});
