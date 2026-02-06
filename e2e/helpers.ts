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

export async function goToStatsPage(page: Page): Promise<void> {
  const targetUrl = process.env.E2E_BASE_URL || 'http://localhost:5173';
  await page.goto(`${targetUrl}/stats`);
  await expect(page.locator('h1')).toContainText('Engine Diagnostics');
}

// Player management helpers - now using unified input
export async function addPlayers(page: Page, players: string[]): Promise<void> {
  const input = page.getByTestId('player-entry-input');
  await expect(input).toBeVisible();
  await input.fill(players.join(','));
  await page.getByTestId('add-player-button').click();
  await page.waitForTimeout(100);
}

// Alias for backward compatibility
export async function addBulkPlayers(page: Page, players: string[]): Promise<void> {
  await addPlayers(page, players);
}

export async function addSinglePlayer(page: Page, playerName: string): Promise<void> {
  const input = page.getByTestId('player-entry-input');
  await expect(input).toBeVisible();
  await input.fill(playerName);
  await page.getByTestId('add-player-button').click();
  await page.waitForTimeout(100);
}

export async function expandSectionIfNeeded(page: Page, sectionName: string): Promise<void> {
  const sectionHeader = page.locator('h2').filter({ hasText: new RegExp(sectionName) });
  const section = sectionHeader.locator('..');
  const isCollapsed = await section.evaluate(el => el.closest('.section')?.classList.contains('collapsed'));
  if (isCollapsed) {
    await sectionHeader.click();
    await page.waitForTimeout(200);
  }
}

// Legacy alias
export async function expandStepIfNeeded(page: Page, stepName: string): Promise<void> {
  await expandSectionIfNeeded(page, stepName);
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
  await page.getByTestId('player-removal-modal-remove').click();
}

export async function toggleFirstPlayer(page: Page): Promise<void> {
  const firstToggleButton = page.locator('[data-testid^="toggle-presence-"]').first();
  await firstToggleButton.click();
}

// Court management helpers
export async function generateCourtAssignments(page: Page, expectedCourts?: number): Promise<void> {
  // Court settings are now inline in Court Assignments section
  await expect(page.locator('h2').filter({ hasText: /Court Assignments/ })).toBeVisible();

  // If expected courts specified, set the court count first
  if (expectedCourts !== undefined) {
    const courtInput = page.locator('#courts');
    await courtInput.clear();
    await courtInput.type(expectedCourts.toString());
    await page.waitForTimeout(100);
  }

  const generateButton = page.getByTestId('generate-assignments-button');
  await expect(generateButton).toBeVisible();
  await generateButton.click();

  await expect(page.locator('[data-testid^="court-"]').first()).toBeVisible({ timeout: 5000 });

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
  // After first generation, button text changes to "Regenerate"
  const generateButton = page.getByTestId('generate-assignments-button');
  await generateButton.click();
  await expect(page.locator('[data-testid^="court-"]').first()).toBeVisible({ timeout: 5000 });
}

export async function verifyLeaderboard(page: Page): Promise<void> {
  const leaderboard = page.locator('h2').filter({ hasText: 'Leaderboard' });
  await expect(leaderboard).toBeVisible();
}

// Full workflow helpers
export async function completeFullWorkflow(
  page: Page,
  finalPlayerCount: number,
  expectedCourts?: number,
): Promise<void> {
  await generateCourtAssignments(page, expectedCourts);
  await selectWinnerOnFirstCourt(page);
  await generateNewAssignments(page);
  await verifyLeaderboard(page);

  await expandSectionIfNeeded(page, 'Manage Players');
  await verifyPlayerStats(page, finalPlayerCount, finalPlayerCount);
}
