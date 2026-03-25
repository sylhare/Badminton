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

  test('consolation bracket — 6-player: CB Final shows players after single CB R1 match (odd seeds bug)', async ({ page }) => {
    // 6 teams → 3 WB R1 matches → 3 losers → cbBracketSize=4 → CB R1 has 1 match + 1 bye-advance
    // Bug: with odd CB seeds, the bye-advance team was not included when generating CB Final
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank']);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    const wbSection = page.getByTestId('wb-section');
    const cbSection = page.getByTestId('cb-section');

    // Play all 3 WB R1 matches
    for (let i = 0; i < 3; i++) {
      await wbSection.locator('[data-testid^="bracket-team-1-"]').nth(i).click();
      await page.getByTestId('score-modal-confirm').click();
    }

    // CB section appears: 1 match node (L1 vs L2) + 1 bye-advance (L3)
    await expect(cbSection).toBeVisible();
    await expect(cbSection.locator('[data-testid="bracket-node-match"]')).toHaveCount(1);
    await expect(cbSection.locator('[data-testid="bracket-node-bye"]')).toHaveCount(1);

    // CB Final is TBD while CB R1 match hasn't been played
    await expect(cbSection.locator('[data-testid="bracket-node-tbd"]')).toHaveCount(1);

    // Play the CB R1 match — CB Final should now show real players (L1 vs L3)
    await cbSection.locator('[data-testid^="bracket-team-1-"]').nth(0).click();
    await page.getByTestId('score-modal-confirm').click();

    // CB Final is now a match node, not TBD
    await expect(cbSection.locator('[data-testid="bracket-node-tbd"]')).toHaveCount(0);
    await expect(cbSection.locator('[data-testid="bracket-node-match"]')).toHaveCount(2);

    // Play the CB Final
    await cbSection.locator('[data-testid^="bracket-team-1-"]').nth(1).click();
    await page.getByTestId('score-modal-confirm').click();

    await expect(page.getByTestId('tournament-standings')).toBeVisible();
  });

  test('consolation bracket — 8-player: CB Final shows players after CB R1 complete', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry']);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    const wbSection = page.getByTestId('wb-section');
    const cbSection = page.getByTestId('cb-section');

    // Play all 4 WB R1 matches (CB R1 only generates after all WB R1 are done)
    for (let i = 0; i < 4; i++) {
      await wbSection.locator('[data-testid^="bracket-team-1-"]').nth(i).click();
      await page.getByTestId('score-modal-confirm').click();
    }

    // CB R1 should appear with 2 match nodes (player names, not TBD)
    await expect(cbSection).toBeVisible();
    await expect(cbSection.locator('[data-testid="bracket-node-match"]')).toHaveCount(2);

    // Play CB R1 match 1 — after this, CB Final is still TBD (only one parent known)
    await cbSection.locator('[data-testid^="bracket-team-1-"]').nth(0).click();
    await page.getByTestId('score-modal-confirm').click();
    await expect(cbSection.locator('[data-testid="bracket-node-tbd"]')).toHaveCount(1);

    // Play CB R1 match 2 — CB Final should now show real players
    await cbSection.locator('[data-testid^="bracket-team-1-"]').nth(1).click();
    await page.getByTestId('score-modal-confirm').click();

    // CB section: 2 played R1 nodes + 1 CB Final match node (no longer TBD)
    await expect(cbSection.locator('[data-testid="bracket-node-match"]')).toHaveCount(3);
    await expect(cbSection.locator('[data-testid="bracket-node-tbd"]')).toHaveCount(0);

    // Play the CB Final
    await cbSection.locator('[data-testid^="bracket-team-1-"]').nth(2).click();
    await page.getByTestId('score-modal-confirm').click();

    // Standings should be visible
    await expect(page.getByTestId('tournament-standings')).toBeVisible();
  });

  test('consolation bracket — full play-through (4-player singles)', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana']);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    // CB not visible before WB R1 is complete
    await expect(page.getByTestId('cb-section')).not.toBeVisible();

    const wbSection = page.getByTestId('wb-section');

    // Play WB R1 match 1 — team 1 wins; WB Final still TBD after this
    await wbSection.locator('[data-testid^="bracket-team-1-"]').nth(0).click();
    await page.getByTestId('score-modal-confirm').click();

    // Play WB R1 match 2 — team 1 wins
    await wbSection.locator('[data-testid^="bracket-team-1-"]').nth(1).click();
    await page.getByTestId('score-modal-confirm').click();

    // Both WB R1 done: CB section should appear, WB Final match should be visible
    await expect(page.getByTestId('cb-section')).toBeVisible();

    // WB Final is the 3rd team-1 button in the WB section (after R1M1 and R1M2)
    await expect(wbSection.locator('[data-testid^="bracket-team-1-"]')).toHaveCount(3);

    // CB section contains exactly one match with clickable team buttons
    const cbSection = page.getByTestId('cb-section');
    await expect(cbSection.locator('[data-testid^="bracket-team-1-"]')).toHaveCount(1);

    // Play CB Final — team 1 wins
    await cbSection.locator('[data-testid^="bracket-team-1-"]').first().click();
    await page.getByTestId('score-modal-confirm').click();

    // Play WB Final — team 1 wins
    await wbSection.locator('[data-testid^="bracket-team-1-"]').nth(2).click();
    await page.getByTestId('score-modal-confirm').click();

    // Tournament complete: standings show "Final Results" and medal emoji for 1st
    await expect(page.getByTestId('standings-subtitle')).toHaveText('Final Results');
    await expect(page.getByTestId('standing-row-0')).toContainText('🥇');
  });
});
