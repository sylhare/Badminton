import { expect, test } from '@playwright/test';

import { MainPage } from '../support/pages/MainPage';
import { TournamentPage } from '../support/pages/TournamentPage';

/**
 * Mobile elimination bracket: at narrow viewports the bracket switches from the
 * desktop tree to a World Cup–style scroll-snap carousel (one round per page).
 */
test.describe('Tournament Page - Elimination (mobile carousel)', () => {
  // Below the 768px breakpoint used by useIsMobile.
  test.use({ viewport: { width: 390, height: 844 } });

  let mainPage: MainPage;
  let tournamentPage: TournamentPage;

  test.beforeEach(async ({ page }) => {
    mainPage = new MainPage(page);
    tournamentPage = new TournamentPage(page, mainPage);
    await mainPage.goto();
    await mainPage.reset();
  });

  test('renders the carousel instead of the desktop tree', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry']);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    await expect(page.getByTestId('bracket-carousel').first()).toBeVisible();
    await expect(page.locator('.bracket-tree')).toHaveCount(0);
  });

  test('winners bracket shows one snap page per round', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry']);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    const wbSection = page.getByTestId('wb-section');
    // 8 teams → 3 WB rounds (4th of Final, Semi Final, Final).
    await expect(wbSection.getByTestId('bracket-carousel-page-1')).toBeVisible();
    await expect(wbSection.getByTestId('bracket-carousel-page-2')).toHaveCount(1);
    await expect(wbSection.getByTestId('bracket-carousel-page-3')).toHaveCount(1);
    await expect(wbSection.getByTestId('bracket-round-label-4th-of-Final')).toBeVisible();
  });

  test('carousel is horizontally scrollable to reach later rounds', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry']);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    const carousel = page.getByTestId('wb-section').getByTestId('bracket-carousel');
    const metrics = await carousel.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
  });

  test('clicking a team in the carousel opens the score modal and records a result', async ({ page }) => {
    await tournamentPage.setup(['Alice', 'Bob', 'Charlie', 'Diana']);
    await page.getByTestId('format-pill-singles').click();
    await tournamentPage.selectType('elimination');
    await tournamentPage.startElimination();

    const wbSection = page.getByTestId('wb-section');
    await wbSection.locator('[data-testid^="bracket-team-1-"]').first().click();
    await expect(page.getByTestId('score-input-modal')).toBeVisible();
    await page.getByTestId('score-modal-confirm').click();

    await expect(wbSection.locator('.bracket-team-winner').first()).toBeVisible();
  });
});
