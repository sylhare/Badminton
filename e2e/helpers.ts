import { Page, expect } from '@playwright/test';

// Test data
export const BULK_PLAYERS = [
  'Alice Johnson',
  'Bob Smith', 
  'Charlie Davis',
  'Diana Wilson',
  'Emma Brown',
  'Frank Miller',
  'Grace Lee',
];

export const SINGLE_PLAYERS = [
  'Henry Garcia',
  'Ivy Thompson',
];

// Navigation helpers
export async function goToApp(page: Page): Promise<void> {
  const targetUrl = process.env.E2E_BASE_URL || 'http://localhost:5173';
  await page.goto(targetUrl);
  await expect(page).toHaveTitle(/Badminton/);
  await expect(page.locator('h1')).toContainText('🏸 Badminton Court Manager');
}

// Player management helpers
export async function addBulkPlayers(page: Page, players: string[]): Promise<void> {
  const bulkTextarea = page.getByTestId('bulk-input');
  await expect(bulkTextarea).toBeVisible();
  await bulkTextarea.fill(players.join('\n'));
  await page.getByTestId('add-bulk-button').click();
}

export async function addSinglePlayer(page: Page, playerName: string): Promise<void> {
  const singlePlayerInput = page.getByTestId('single-player-input');
  await expect(singlePlayerInput).toBeVisible();
  await singlePlayerInput.fill(playerName);
  await page.getByTestId('add-single-button').click();
}

export async function expandStepIfNeeded(page: Page, stepName: string): Promise<void> {
  const stepHeader = page.locator('h2').filter({ hasText: new RegExp(stepName) });
  await stepHeader.click();
}

// Stats verification helpers
export async function verifyPlayerStats(page: Page, present: number, total: number): Promise<void> {
  await expect(page.getByTestId('stats-present-count')).toBeVisible();
  await expect(page.getByTestId('stats-present-count')).toHaveText(present.toString());
  await expect(page.getByTestId('stats-total-count')).toHaveText(total.toString());
  await expect(page.getByTestId('stats-absent-count')).toHaveText((total - present).toString());
}

// Player list management helpers
export async function removeFirstPlayer(page: Page): Promise<void> {
  const firstRemoveButton = page.locator('[data-testid^="remove-player-"]').first();
  await firstRemoveButton.click();
}

export async function toggleFirstPlayer(page: Page): Promise<void> {
  const firstPlayerCheckbox = page.locator('[data-testid^="player-checkbox-"]').first();
  await firstPlayerCheckbox.click();
}

// Court management helpers
export async function generateCourtAssignments(page: Page, expectedCourts?: number): Promise<void> {
  await expect(page.locator('h2').filter({ hasText: /Court Settings/ })).toBeVisible();
  
  const generateButton = page.getByTestId('generate-assignments-button');
  await expect(generateButton).toBeVisible();
  await generateButton.click();
  
  await expect(page.locator('[data-testid^="court-"]').first()).toBeVisible();
  
  if (expectedCourts !== undefined) {
    await expect(page.locator('[data-testid^="court-"]')).toHaveCount(expectedCourts);
  }
}

export async function selectWinnerOnFirstCourt(page: Page): Promise<void> {
  const firstCourt = page.getByTestId('court-1');
  await expect(firstCourt.locator('.court-header')).toContainText('Court 1');
  
  const firstTeam = firstCourt.locator('.team-clickable').first();
  await expect(firstTeam).toBeVisible();
  await firstTeam.click();
  
  await page.waitForTimeout(300);
  
  const winnerElement = page.locator('.crown, .team-winner');
  await expect(winnerElement).toHaveCount(2);
}

export async function generateNewAssignments(page: Page): Promise<void> {
  const generateNewButton = page.getByTestId('generate-new-assignments-button');
  await generateNewButton.click();
  await expect(page.locator('[data-testid^="court-"]').first()).toBeVisible();
}

export async function verifyLeaderboard(page: Page): Promise<void> {
  const leaderboard = page.locator('h2').filter({ hasText: 'Leaderboard' });
  await expect(leaderboard).toBeVisible();
}

// Full workflow helpers
export async function completeFullWorkflow(
  page: Page, 
  finalPlayerCount: number,
  expectedCourts?: number
): Promise<void> {
  await generateCourtAssignments(page, expectedCourts);
  await selectWinnerOnFirstCourt(page);
  await generateNewAssignments(page);
  await verifyLeaderboard(page);
  
  await expandStepIfNeeded(page, 'Manage Players');
  await verifyPlayerStats(page, finalPlayerCount, finalPlayerCount);
}
