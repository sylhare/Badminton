import { Page, expect } from '@playwright/test';

import type { MainPage } from '../support/pages/MainPage';

/** Sample player names for bulk testing */
export const BULK_PLAYERS = [
  'Alice Johnson',
  'Bob Smith',
  'Charlie Davis',
  'Diana Wilson',
  'Emma Brown',
  'Frank Miller',
  'Grace Lee',
];

/** Sample player names for single-add testing */
export const SINGLE_PLAYERS = [
  'Henry Garcia',
  'Ivy Thompson',
];

/**
 * Complete a full game workflow: generate, pick winner on court 1, regenerate, verify leaderboard and player stats.
 */
export async function completeWorkflow(mainPage: MainPage, page: Page, playerCount: number, courtCount?: number): Promise<void> {
  await mainPage.generateAssignments(courtCount);
  await mainPage.court(1).selectWinner();
  await mainPage.regenerate();
  await expect(page.locator('h2').filter({ hasText: 'Leaderboard' })).toBeVisible();
  await mainPage.expandPlayersSection();
  await expect(page.getByTestId('stats-present-count')).toHaveText(playerCount.toString());
  await expect(page.getByTestId('stats-total-count')).toHaveText(playerCount.toString());
}
