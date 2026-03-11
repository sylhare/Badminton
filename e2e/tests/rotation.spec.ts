import { test, expect } from '@playwright/test';

import { MainPage } from '../support/pages';

test.describe('Team Rotation', () => {
  let mainPage: MainPage;

  test.beforeEach(async ({ page }) => {
    mainPage = new MainPage(page);
    await mainPage.goto();
    await mainPage.reset();
  });

  test('Team rotation button changes team pairs and clears winner', async ({ page }) => {
    await mainPage.addPlayers(['Alice', 'Bob', 'Charlie', 'Diana']);
    await mainPage.generateAssignments(1);

    const court1 = mainPage.court(1);
    const team1Before = await court1.getTeamPlayers(1);
    const team2Before = await court1.getTeamPlayers(2);

    await court1.selectWinner();
    await expect(page.locator('.crown')).toHaveCount(1);

    await court1.rotate();
    await expect(page.locator('.crown')).toHaveCount(0);

    const team1After = await court1.getTeamPlayers(1);
    const team2After = await court1.getTeamPlayers(2);

    const sameTeams =
      JSON.stringify(team1Before.sort()) === JSON.stringify(team1After.sort()) &&
      JSON.stringify(team2Before.sort()) === JSON.stringify(team2After.sort());
    expect(sameTeams).toBe(false);

    await court1.selectWinner();
    await expect(page.locator('.crown')).toHaveCount(1);

    await mainPage.regenerate();

    await expect(page.locator('h2').filter({ hasText: 'Leaderboard' })).toBeVisible();
    await expect(page.locator('.leaderboard-table tbody tr')).toHaveCount(2);
  });

  test('Leaderboard reflects rotated team winners, not original team', async ({ page }) => {
    await mainPage.addPlayers(['Alice', 'Bob', 'Charlie', 'Diana']);
    await mainPage.generateAssignments(1);

    const court1 = mainPage.court(1);
    const team1NamesBefore = await court1.getTeamPlayers(1);

    await court1.selectWinner();
    await court1.rotate();

    const team1NamesAfter = await court1.getTeamPlayers(1);

    await court1.selectWinner();
    await mainPage.regenerate();

    await expect(page.locator('h2').filter({ hasText: 'Leaderboard' })).toBeVisible();

    const leaderboardNames = await mainPage.getLeaderboardPlayerNames();

    for (const name of team1NamesAfter) {
      expect(leaderboardNames).toContain(name.trim());
    }

    const droppedPlayer = team1NamesBefore
      .map(n => n.trim())
      .find(n => !team1NamesAfter.map(a => a.trim()).includes(n));
    if (droppedPlayer) {
      expect(leaderboardNames).not.toContain(droppedPlayer);
    }
  });
});
