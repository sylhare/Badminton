import { Locator, Page, expect } from '@playwright/test';

import type { MainPage } from './pages';

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
 * Navigates to the app and verifies it loaded correctly
 */
export async function goToApp(page: Page): Promise<void> {
  const targetUrl = process.env.E2E_BASE_URL || 'http://localhost:5173';
  await page.goto(targetUrl);
  await expect(page).toHaveTitle(/Badminton/);
  await expect(page.locator('h1')).toContainText('🏸 Badminton Court Manager');
}

/**
 * Alias for goToStatsPage - navigates directly to stats page via URL
 */
export async function navigateToStats(page: Page): Promise<void> {
  await page.goto('/stats');
}

/**
 * Adds multiple players via the unified input field using comma separation
 */
export async function addPlayers(page: Page, players: string[]): Promise<void> {
  const input = page.getByTestId('player-entry-input');
  await expect(input).toBeVisible();
  await input.fill(players.join(','));
  await page.getByTestId('add-player-button').click();
  await page.waitForTimeout(100);
}

/**
 * Alias for addPlayers - maintained for backward compatibility
 */
export async function addBulkPlayers(page: Page, players: string[]): Promise<void> {
  await addPlayers(page, players);
}

/**
 * Adds a single player via the input field
 */
export async function addSinglePlayer(page: Page, playerName: string): Promise<void> {
  const input = page.getByTestId('player-entry-input');
  await expect(input).toBeVisible();
  await input.fill(playerName);
  await page.getByTestId('add-player-button').click();
  await page.waitForTimeout(100);
}

/**
 * Expands a collapsible section if it's currently collapsed
 */
export async function expandSectionIfNeeded(page: Page, sectionName: string): Promise<void> {
  const sectionHeader = page.locator('h2').filter({ hasText: new RegExp(sectionName) });
  const section = sectionHeader.locator('..');
  const isCollapsed = await section.evaluate(el => el.closest('.section')?.classList.contains('collapsed'));
  if (isCollapsed) {
    await sectionHeader.click();
    await page.waitForTimeout(200);
  }
}

/**
 * Legacy alias for expandSectionIfNeeded
 * @deprecated Use expandSectionIfNeeded instead
 */
export async function expandStepIfNeeded(page: Page, stepName: string): Promise<void> {
  await expandSectionIfNeeded(page, stepName);
}

/**
 * Verifies the player statistics display shows expected counts
 */
export async function verifyPlayerStats(page: Page, present: number, total: number): Promise<void> {
  await expect(page.getByTestId('stats-present-count')).toBeVisible();
  await expect(page.getByTestId('stats-present-count')).toHaveText(present.toString());
  await expect(page.getByTestId('stats-total-count')).toHaveText(total.toString());
  await expect(page.getByTestId('stats-absent-count')).toHaveText((total - present).toString());
}

/**
 * Removes the first player in the list via the removal modal
 */
export async function removeFirstPlayer(page: Page): Promise<void> {
  const firstRemoveButton = page.locator('[data-testid^="remove-player-"]').first();
  await firstRemoveButton.click();
  await page.getByTestId('player-removal-modal-remove').click();
}

/**
 * Toggles the presence status of the first player in the list
 */
export async function toggleFirstPlayer(page: Page): Promise<void> {
  const firstToggleButton = page.locator('[data-testid^="toggle-presence-"]').first();
  await firstToggleButton.click();
}

/**
 * Sets the court count input to the specified value.
 * Uses native value setter to properly trigger React's synthetic events.
 */
export async function setCourtCount(page: Page, count: number): Promise<void> {
  const courtInput = page.getByTestId('court-count-input');
  await courtInput.evaluate((el: HTMLInputElement, val: string) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, val);
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, count.toString());
  await page.waitForTimeout(100);
}

/**
 * Generates court assignments and optionally verifies the expected court count
 */
export async function generateCourtAssignments(page: Page, expectedCourts?: number): Promise<void> {
  await expect(page.locator('h2').filter({ hasText: /Court Assignments/ })).toBeVisible();

  if (expectedCourts !== undefined) {
    await setCourtCount(page, expectedCourts);
  }

  const generateButton = page.getByTestId('generate-assignments-button');
  await expect(generateButton).toBeVisible();
  await generateButton.click();

  await expect(page.locator('.court-card').first()).toBeVisible({ timeout: 5000 });

  if (expectedCourts !== undefined) {
    await expect(page.locator('.court-card')).toHaveCount(expectedCourts);
  }
}

/**
 * Selects the first team as winner on court 1 and verifies the winner indicator appears.
 */
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

/**
 * Clicks the generate/regenerate button and waits for court cards to appear
 */
export async function generateNewAssignments(page: Page): Promise<void> {
  const generateButton = page.getByTestId('generate-assignments-button');
  await generateButton.click();
  await expect(page.locator('.court-card').first()).toBeVisible({ timeout: 5000 });
}

/**
 * Verifies the leaderboard section is visible
 */
export async function verifyLeaderboard(page: Page): Promise<void> {
  const leaderboard = page.locator('h2').filter({ hasText: 'Leaderboard' });
  await expect(leaderboard).toBeVisible();
}

/**
 * Executes a complete workflow: generate assignments, select winner, regenerate, and verify stats
 */
export async function completeFullWorkflow(
  page: Page,
  finalPlayerCount: number,
  expectedCourts?: number,
): Promise<void> {
  if (expectedCourts !== undefined) {
    await setCourtCount(page, expectedCourts);
  }

  await generateCourtAssignments(page);

  if (expectedCourts !== undefined) {
    await expect(page.locator('.court-card')).toHaveCount(expectedCourts);
  }

  await selectWinnerOnFirstCourt(page);
  await generateNewAssignments(page);
  await verifyLeaderboard(page);

  await expandSectionIfNeeded(page, 'Manage Players');
  await verifyPlayerStats(page, finalPlayerCount, finalPlayerCount);
}

/**
 * Toggles the Smart Engine on or off.
 * Expands the Manage Players section first if it is collapsed.
 */
export async function toggleSmartEngine(page: Page): Promise<void> {
  await expandSectionIfNeeded(page, 'Manage Players');
  await page.getByTestId('smart-engine-toggle-label').click();
}

/**
 * Sets up a game with the given players and generates initial court assignments
 */
export async function setupGameWithPlayers(page: Page, players: string[]): Promise<void> {
  await addBulkPlayers(page, players);
  const generateButton = page.getByTestId('generate-assignments-button');
  await generateButton.click();
  await page.waitForTimeout(300);
}

/**
 * Enters a score in the score input modal and confirms it.
 * Asserts the modal is visible before filling and gone after confirming.
 */
export async function enterAndConfirmScore(page: Page, team1Score: string, team2Score: string): Promise<void> {
  await expect(page.getByTestId('score-input-modal')).toBeVisible();
  await page.getByTestId('score-input-team1').fill(team1Score);
  await page.getByTestId('score-input-team2').fill(team2Score);
  await page.getByTestId('score-modal-confirm').click();
  await expect(page.getByTestId('score-input-modal')).not.toBeVisible();
}

/**
 * Regenerates court assignments and asserts the Avg Pts column shows a numeric value.
 */
export async function assertAvgPtsNumeric(page: Page): Promise<void> {
  await page.getByTestId('generate-assignments-button').click();
  await page.waitForTimeout(300);
  const leaderboardRows = page.locator('.leaderboard-table tbody tr');
  await expect(leaderboardRows.first()).toBeVisible();
  const avgPts = await leaderboardRows.first().locator('td').nth(3).textContent();
  expect(avgPts).not.toBe('—');
  expect(parseFloat(avgPts ?? '')).toBeGreaterThan(0);
}

/**
 * Selects a winner on a specific court and team number.
 * Clicks the team and waits briefly for the state update.
 */
export async function selectWinner(page: Page, courtNumber: number, teamNumber: 1 | 2 = 1): Promise<void> {
  const court = page.getByTestId(`court-${courtNumber}`);
  const teamLocator = teamNumber === 1 ? court.locator('.team-clickable').first() : court.locator('.team-clickable').last();
  await expect(teamLocator).toBeVisible();
  await teamLocator.click();
  await page.waitForTimeout(200);
}

/**
 * Returns the text content of all player elements in a given team on a court locator.
 */
export async function getTeamPlayers(court: Locator, teamNumber: 1 | 2): Promise<string[]> {
  return court.locator(`[data-testid="team-${teamNumber}"] .team-player`).allTextContents();
}

/**
 * Returns the player names from the leaderboard table, stripping leading medal/emoji characters.
 */
export async function getLeaderboardPlayerNames(page: Page): Promise<string[]> {
  const nameCells = page.locator('.leaderboard-table tbody tr td:nth-child(2)');
  const contents = await nameCells.allTextContents();
  return contents.map(n => n.replace(/^[^\w]+/, '').trim());
}

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

/**
 * Plays a round by selecting the first team as winner and generating new assignments.
 * For use in normal mode only (no score modal).
 */
export async function playRound(page: Page): Promise<void> {
  const firstTeam = page.locator('.team-clickable').first();
  await firstTeam.click();

  const generateButton = page.getByTestId('generate-assignments-button');
  await generateButton.click();
  await page.waitForTimeout(200);
}
