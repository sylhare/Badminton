import { expect, test } from '@playwright/test';

import { DEFAULT_PLAYERS } from '../support/helpers';
import { MainPage } from '../support/pages/MainPage';
import { TournamentPage } from '../support/pages/TournamentPage';

test.describe('Tournament Page - Group + Knockout', () => {
  let mainPage: MainPage;
  let tournamentPage: TournamentPage;

  test.beforeEach(async ({ page }) => {
    mainPage = new MainPage(page);
    tournamentPage = new TournamentPage(page, mainPage);
    await mainPage.goto();
    await mainPage.reset();
  });

  test('mode selector shows the group-knockout option and its config', async ({ page }) => {
    await tournamentPage.setup(DEFAULT_PLAYERS);

    await expect(page.getByTestId('type-pill-group-knockout')).toBeVisible();
    await expect(page.getByTestId('group-knockout-config')).toHaveCount(0);

    await tournamentPage.selectType('group-knockout');
    await expect(page.getByTestId('group-knockout-config')).toBeVisible();
    await expect(page.getByTestId('group-size-input')).toBeVisible();
    await expect(page.getByTestId('qualifiers-input')).toBeVisible();
  });

  test('warns but still allows Start when every team would qualify', async ({ page }) => {
    await tournamentPage.setup(DEFAULT_PLAYERS);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('group-knockout');

    await tournamentPage.setGroupConfig(3, 2);

    await expect(page.getByTestId('qualifiers-warning')).toBeVisible();
    await expect(page.getByTestId('start-tournament-button')).toBeEnabled();
  });

  test('full play-through: group stage then knockout final', async ({ page }) => {
    await tournamentPage.setup(DEFAULT_PLAYERS);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('group-knockout');
    await tournamentPage.setGroupConfig(2, 1);
    await tournamentPage.startGroupKnockout();

    await test.step('two groups render with standings and matches', async () => {
      await expect(page.getByTestId('group-stage')).toBeVisible();
      await expect(page.getByTestId('group-section-0')).toBeVisible();
      await expect(page.getByTestId('group-section-1')).toBeVisible();
      await expect(page.getByTestId('group-0-standing-0')).toBeVisible();
      await expect(page.getByTestId('knockout-stage')).toHaveCount(0);
    });

    await test.step('deciding every group match seeds the knockout', async () => {
      for (const group of [0, 1]) {
        await page.getByTestId(`group-section-${group}`)
          .locator('[data-testid="singles-player-team1"]').first().click();
        await expect(page.getByTestId('score-input-modal')).toBeVisible();
        await page.getByTestId('score-modal-confirm').click();
      }
      await expect(page.getByTestId('knockout-stage')).toBeVisible();
    });

    await test.step('deciding the knockout final crowns a winner', async () => {
      const knockout = page.getByTestId('knockout-stage');
      await knockout.locator('[data-testid^="bracket-team-1-"]').first().click();
      await expect(page.getByTestId('score-input-modal')).toBeVisible();
      await page.getByTestId('score-modal-confirm').click();

      await expect(knockout.locator('.bracket-team-winner').first()).toBeVisible();
    });
  });

  test('group-knockout state persists across reload', async ({ page }) => {
    await tournamentPage.setup(DEFAULT_PLAYERS);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('group-knockout');
    await tournamentPage.setGroupConfig(2, 1);
    await tournamentPage.startGroupKnockout();

    await page.getByTestId('group-section-0')
      .locator('[data-testid="singles-player-team1"]').first().click();
    await page.getByTestId('score-modal-confirm').click();

    await page.reload();

    await expect(page.getByTestId('group-knockout')).toBeVisible();
    await expect(page.getByTestId('group-section-0')).toBeVisible();
  });
});
