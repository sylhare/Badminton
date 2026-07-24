import { expect, test } from '@playwright/test';

import { MainPage } from '../support/pages/MainPage';
import { BULK_PLAYERS, completeWorkflow, DEFAULT_PLAYERS, SINGLE_PLAYERS } from '../support/helpers';

test.describe('Court Workflow', () => {
  let mainPage: MainPage;

  test.beforeEach(async ({ page }) => {
    mainPage = new MainPage(page);
    await mainPage.goto();
    await mainPage.reset();
  });

  test.describe('Player Input', () => {
    test('Bulk workflow - add all at once, remove one, then play', async ({ page }) => {
      const input = page.getByTestId('player-entry-input');
      await input.fill(BULK_PLAYERS.join(','));

      await test.step('multi-player hint shows with correct count and button label', async () => {
        await expect(page.locator('.multi-input-hint')).toBeVisible();
        await expect(page.locator('.multi-input-hint')).toContainText(`Detected ${BULK_PLAYERS.length} players`);
        await expect(page.getByTestId('add-player-button')).toContainText(`Add ${BULK_PLAYERS.length} Players`);
      });

      await page.getByTestId('add-player-button').click();

      await expect(page.getByTestId('stats-present-count')).toHaveText('7');
      await expect(page.getByTestId('stats-total-count')).toHaveText('7');

      await mainPage.removeFirstPlayer();

      await expect(page.getByTestId('stats-total-count')).toHaveText('6');
      await expect(page.getByTestId('stats-present-count')).toHaveText('6');

      await completeWorkflow(mainPage, page, 6, 2);
    });

    test('Bulk workflow - large player list', async ({ page }) => {
      const largeBulkList = [
        ...BULK_PLAYERS,
        'Henry Garcia',
        'Ivy Thompson',
        'Jack Wilson',
        'Kate Brown',
        'Liam Davis',
        'Maya Smith',
      ];

      await mainPage.addPlayers(largeBulkList);

      await expect(page.getByTestId('stats-total-count')).toHaveText('13');
      await expect(page.getByTestId('stats-present-count')).toHaveText('13');

      await completeWorkflow(mainPage, page, 13, 3);
    });

    test('Single workflow - add one by one with toggle', async ({ page }) => {
      for (const playerName of BULK_PLAYERS.slice(0, 6)) {
        await mainPage.addPlayer(playerName);
      }

      await expect(page.getByTestId('stats-total-count')).toHaveText('6');
      await expect(page.getByTestId('stats-present-count')).toHaveText('6');

      await mainPage.toggleFirstPlayer();

      await expect(page.getByTestId('stats-present-count')).toHaveText('5');
      await expect(page.getByTestId('stats-absent-count')).toHaveText('1');

      await mainPage.toggleFirstPlayer();

      await completeWorkflow(mainPage, page, 6, 2);
    });

    test('Mixed workflow - bulk first, then single additions', async ({ page }) => {
      await mainPage.addPlayers(BULK_PLAYERS);

      await expect(page.getByTestId('stats-present-count')).toHaveText('7');

      await mainPage.expandPlayersSection();

      await mainPage.addPlayer(SINGLE_PLAYERS[0]);
      await mainPage.addPlayer(SINGLE_PLAYERS[1]);

      await expect(page.getByTestId('stats-total-count')).toHaveText('9');

      await mainPage.removeFirstPlayer();

      await expect(page.getByTestId('stats-total-count')).toHaveText('8');
      await expect(page.getByTestId('stats-present-count')).toHaveText('8');

      await completeWorkflow(mainPage, page, 8, 2);
    });

    test('Mixed workflow - single first, then bulk addition', async ({ page }) => {
      await mainPage.addPlayer(SINGLE_PLAYERS[0]);
      await mainPage.addPlayer(SINGLE_PLAYERS[1]);

      await expect(page.getByTestId('stats-total-count')).toHaveText('2');

      await mainPage.addPlayers(BULK_PLAYERS.slice(0, 4));

      await expect(page.getByTestId('stats-total-count')).toHaveText('6');
      await expect(page.getByTestId('stats-present-count')).toHaveText('6');

      await completeWorkflow(mainPage, page, 6, 2);
    });
  });

  test.describe('Rearrange players', () => {
    test('Rearrange button enters edit mode and swaps two players via tap-to-swap', async ({ page }) => {
      await mainPage.addPlayers(DEFAULT_PLAYERS);
      await mainPage.generateAssignments(1);

      const rearrange = page.getByTestId('rearrange-button');
      await expect(rearrange).toBeVisible();

      const team1Slot = '0:0';
      const team2Slot = '1:0';
      const before1 = (await mainPage.playerAtSlot(team1Slot)).trim();
      const before2 = (await mainPage.playerAtSlot(team2Slot)).trim();
      expect(before1).not.toBe(before2);

      await test.step('clicking the button reveals the edit-mode banner', async () => {
        await rearrange.click();
        await expect(page.getByTestId('edit-mode-banner')).toBeVisible();
      });

      await test.step('tapping two players swaps them', async () => {
        await page.locator(`[data-slot="${team1Slot}"]`).click({ force: true });
        await page.locator(`[data-slot="${team2Slot}"]`).click({ force: true });
        await expect(page.locator(`[data-slot="${team1Slot}"]`)).toHaveText(before2);
        await expect(page.locator(`[data-slot="${team2Slot}"]`)).toHaveText(before1);
      });

      await test.step('Done leaves edit mode', async () => {
        await page.getByTestId('edit-mode-done').click();
        await expect(page.getByTestId('edit-mode-banner')).not.toBeVisible();
      });
    });
  });

  test.describe('Team Rotation', () => {
    test('team rotation', async ({ page }) => {
      await mainPage.addPlayers(DEFAULT_PLAYERS);
      await mainPage.generateAssignments(1);

      const court1 = mainPage.court(1);
      const team1Before = await court1.getTeamPlayers(1);
      const team2Before = await court1.getTeamPlayers(2);

      await court1.selectWinner();
      await expect(page.locator('.crown')).toHaveCount(1);
      await court1.rotate();

      let team1After: string[] = [];
      let team2After: string[] = [];

      await test.step('rotation clears winner and changes team composition', async () => {
        await expect(page.locator('.crown')).toHaveCount(0);
        team1After = await court1.getTeamPlayers(1);
        team2After = await court1.getTeamPlayers(2);
        const sameTeams =
          JSON.stringify(team1Before.sort()) === JSON.stringify(team1After.sort()) &&
          JSON.stringify(team2Before.sort()) === JSON.stringify(team2After.sort());
        expect(sameTeams).toBe(false);
      });

      await court1.selectWinner();
      await expect(page.locator('.crown')).toHaveCount(1);
      await mainPage.regenerate();

      await test.step('leaderboard shows rotated team winners, not original team', async () => {
        await expect(page.locator('h2').filter({ hasText: 'Leaderboard' })).toBeVisible();
        await expect(page.locator('.leaderboard-table tbody tr')).toHaveCount(2);
        const leaderboardNames = await mainPage.getLeaderboardPlayerNames();
        for (const name of team1After) {
          expect(leaderboardNames).toContain(name.trim());
        }
        const droppedPlayer = team1Before
          .map(n => n.trim())
          .find(n => !team1After.map(a => a.trim()).includes(n));
        expect(droppedPlayer).toBeDefined();
        expect(leaderboardNames).not.toContain(droppedPlayer);
      });
    });
  });
});
