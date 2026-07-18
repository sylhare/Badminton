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
    const before1 = await mainPage.playerAtSlot('0:0');
    const before2 = await mainPage.playerAtSlot('2:0');
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

    await mainPage.dragPlayer('0:0', '2:0');

    await expect(page.getByTestId('court-1').locator('.crown')).not.toBeVisible();
  });

  test('records the win for the post-swap team, not the swapped-away player', async () => {
    const swappedAway = await mainPage.playerAtSlot('0:0'); // court 1, team 1, slot 0
    const swappedIn = await mainPage.playerAtSlot('2:0'); // court 2, team 1, slot 0
    expect(swappedAway).not.toBe(swappedIn);

    await mainPage.dragPlayer('0:0', '2:0');
    await expect.poll(async () => mainPage.playerAtSlot('0:0')).toBe(swappedIn);

    const winningTeam = (await mainPage.court(1).getTeamPlayers(1)).map(n => n.trim());
    expect(winningTeam).toContain(swappedIn);
    expect(winningTeam).not.toContain(swappedAway);

    await mainPage.court(1).selectWinner(1);

    const leaders = await mainPage.getLeaderboardPlayerNames();
    expect(leaders).toEqual(expect.arrayContaining(winningTeam));
    expect(leaders).not.toContain(swappedAway);
  });

  test('a plain tap on a player still selects the winner (gesture-split)', async ({ page }) => {
    await page.locator('[data-slot="0:0"]').click();
    await expect(page.getByTestId('court-1').locator('.crown')).toBeVisible();
  });

  test('shows a floating label and outlines the drop target mid-drag', async ({ page }) => {
    const src = page.locator('[data-slot="0:0"]');
    const dst = page.locator('[data-slot="2:0"]');
    const name = (await src.textContent())?.trim() ?? '';
    const sb = await src.boundingBox();
    const tb = await dst.boundingBox();
    if (!sb || !tb) throw new Error('Missing slot box');
    const tx = tb.x + tb.width / 2;
    const ty = tb.y + tb.height / 2;

    await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
    await page.mouse.down();
    await page.mouse.move(sb.x + sb.width / 2 + 15, sb.y + sb.height / 2, { steps: 4 });
    await page.mouse.move(tx, ty, { steps: 12 });
    await page.mouse.move(tx, ty);

    await expect(page.locator('.slot-drag-ghost')).toHaveText(name);
    await expect(dst).toHaveClass(/slot-drop-target/);

    await page.mouse.up();
    await expect(page.locator('.slot-drag-ghost')).toHaveCount(0);
  });
});
