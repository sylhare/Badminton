import { expect, test } from '@playwright/test';

import { MainPage } from '../support/pages/MainPage';

const EIGHT = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];

test.describe('Court player drag-and-drop editing', () => {
  let mainPage: MainPage;

  test.beforeEach(async ({ page }) => {
    mainPage = new MainPage(page);
    await mainPage.goto();
    await mainPage.reset();
    await mainPage.addPlayers(EIGHT);
    await mainPage.generateAssignments(2);
  });

  test('drags a player from one court to another to swap them', async () => {
    const before1 = await mainPage.playerAtSlot('0:0'); // court 1, team 1, slot 0
    const before2 = await mainPage.playerAtSlot('2:0'); // court 2, team 1, slot 0
    expect(before1).not.toBe(before2);

    await mainPage.dragPlayer('0:0', '2:0');

    await expect
      .poll(async () => mainPage.playerAtSlot('0:0'))
      .toBe(before2);
    expect(await mainPage.playerAtSlot('2:0')).toBe(before1);
  });

  test('editing a court clears a winner already selected on it', async ({ page }) => {
    const court1 = mainPage.court(1);
    await court1.selectWinner(1);
    await expect(page.getByTestId('court-1').locator('.crown')).toBeVisible();

    // swap a court 1 player with a court 2 player -> court 1's result is void
    await mainPage.dragPlayer('0:0', '2:0');

    await expect(page.getByTestId('court-1').locator('.crown')).not.toBeVisible();
  });

  test('a plain tap on a player still selects the winner (gesture-split)', async ({ page }) => {
    await page.locator('[data-slot="0:0"]').click();
    await expect(page.getByTestId('court-1').locator('.crown')).toBeVisible();
  });
});
