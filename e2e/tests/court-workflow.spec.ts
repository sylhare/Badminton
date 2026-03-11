import path from 'path';
import { fileURLToPath } from 'url';

import { test, expect } from '@playwright/test';

import { MainPage } from '../support/pages/MainPage';
import { BULK_PLAYERS, SINGLE_PLAYERS, completeWorkflow } from '../support/helpers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      await page.waitForTimeout(100);

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

    test('Image workflow - import players from image', async ({ page }) => {
      const imagePath = path.join(__dirname, '../tests/data/names.png');

      await test.step('open image upload modal', async () => {
        await page.getByTestId('open-image-modal-button').click();
        await expect(page.getByTestId('image-upload-modal')).toBeVisible();
      });

      await test.step('upload image and wait for OCR results', async () => {
        await page.getByTestId('image-file-input').setInputFiles(imagePath);
        await expect(page.locator('.extracted-players-section')).toBeVisible({ timeout: 30000 });
        const extractedCount = await page.locator('[data-testid^="extracted-player-"]').count();
        expect(extractedCount).toBeGreaterThanOrEqual(4);
        await expect(page.getByTestId('add-extracted-players-button')).toBeEnabled();
      });

      await test.step('deselect all disables button, select all re-enables it', async () => {
        await page.getByRole('button', { name: 'Deselect all' }).click();
        await expect(page.getByTestId('add-extracted-players-button')).toBeDisabled();
        await page.getByRole('button', { name: 'Select all', exact: true }).click();
        await expect(page.getByTestId('add-extracted-players-button')).toBeEnabled();
      });

      await test.step('add extracted players closes modal and updates count', async () => {
        await page.getByTestId('add-extracted-players-button').click();
        await expect(page.getByTestId('image-upload-modal')).not.toBeVisible();
        const totalCount = parseInt((await page.getByTestId('stats-total-count').textContent()) ?? '0');
        expect(totalCount).toBeGreaterThanOrEqual(4);
      });

      await mainPage.generateAssignments();
      await mainPage.court(1).selectWinner();
      await mainPage.regenerate();
      await expect(page.locator('h2').filter({ hasText: 'Leaderboard' })).toBeVisible();
    });
  });

  test.describe('Manual Court Assignment', () => {
    test('Manual court assignment functionality', async ({ page }) => {
      await mainPage.addPlayers([
        'Alice Johnson',
        'Bob Smith',
        'Charlie Davis',
        'Diana Wilson',
        'Emma Brown',
        'Frank Miller',
      ]);

      await expect(page.getByTestId('stats-total-count')).toHaveText('6');

      const manualCourtButton = page.getByTestId('manual-court-button');
      await expect(manualCourtButton).toBeVisible();
      await manualCourtButton.click();
      await page.waitForTimeout(300);

      const modal = page.getByTestId('manual-court-modal');
      await expect(modal).toBeVisible();

      const firstPlayer = page.locator('[data-testid^="manual-court-player-"]').first();
      await expect(firstPlayer).toBeVisible();
      await firstPlayer.click();

      const secondPlayer = page.locator('[data-testid^="manual-court-player-"]').nth(1);
      await expect(secondPlayer).toBeVisible();
      await secondPlayer.click();

      await expect(page.locator('.selection-count')).toContainText('2/4 players selected');
      await expect(page.locator('.match-preview')).toContainText('Will create: Singles match');

      await test.step('clear selection resets to 0 players', async () => {
        await page.getByTestId('clear-manual-selection').click();
        await expect(page.locator('.selection-count')).toContainText('0/4 players selected');
      });

      await firstPlayer.click();
      await secondPlayer.click();
      await expect(page.locator('.selection-count')).toContainText('2/4 players selected');

      await page.getByText('Done').click();
      await page.waitForTimeout(200);

      await mainPage.generateAssignments();

      await expect(page.getByTestId('court-1')).toBeVisible();
      await expect(page.getByTestId('court-1').locator('.manual-court-icon')).toBeVisible();
    });
  });

  test.describe('Team Rotation', () => {
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
});
