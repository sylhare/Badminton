import { test, expect } from '@playwright/test';

test.describe('Badminton Court Manager - Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start with a clean slate by clearing localStorage
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Complete player management and match workflow', async ({ page }) => {
    // Verify we're on the main page
    await expect(page).toHaveTitle(/Badminton/);
    await expect(page.locator('h1')).toContainText('🏸 Badminton Court Manager');

    // Step 1: Add 7 players using bulk entry
    const bulkPlayerNames = [
      'Alice Johnson',
      'Bob Smith', 
      'Charlie Davis',
      'Diana Wilson',
      'Emma Brown',
      'Frank Miller',
      'Grace Lee'
    ];

    // Find and fill the bulk entry textarea
    const bulkTextarea = page.getByTestId('bulk-input');
    await expect(bulkTextarea).toBeVisible();
    
    await bulkTextarea.fill(bulkPlayerNames.join('\n'));
    await page.getByTestId('add-bulk-button').click();

    // Verify 7 players were added
    await expect(page.getByTestId('stats-present-count')).toHaveText('7');

    // Step 2: Add 2 more players individually
    // First, need to expand the "Add Players" section since it gets collapsed after bulk add
    const addPlayersHeader = page.locator('h2').filter({ hasText: 'Add Players' });
    await addPlayersHeader.click();
    
    const singlePlayerInput = page.getByTestId('single-player-input');
    
    // Add first individual player
    await singlePlayerInput.fill('Henry Garcia');
    await page.getByTestId('add-single-button').click();
    
    // Add second individual player  
    await singlePlayerInput.fill('Ivy Thompson');
    await page.getByTestId('add-single-button').click();

    // Verify we now have 9 players total
    await expect(page.getByTestId('stats-total-count')).toHaveText('9');

    // Step 3: Remove 1 player 
    // Find the first remove button and click it
    const firstRemoveButton = page.locator('[data-testid^="remove-player-"]').first();
    await firstRemoveButton.click();

    // Verify we now have 8 players total
    await expect(page.getByTestId('stats-total-count')).toHaveText('8');
    await expect(page.getByTestId('stats-present-count')).toHaveText('8');

    // Step 4: Generate court assignments
    // The Court Settings section should be visible since we have present players
    await expect(page.locator('h2').filter({ hasText: /Court Settings/ })).toBeVisible();
    
    // Click to expand if collapsed
    const courtSettingsHeader = page.locator('h2').filter({ hasText: /Court Settings/ });
    
    // Check if the section is collapsed by looking for the generate button
    const generateButton = page.getByTestId('generate-assignments-button');
    const isButtonVisible = await generateButton.isVisible();
    
    if (!isButtonVisible) {
      // Section is collapsed, click to expand
      await courtSettingsHeader.click();
      await page.waitForTimeout(300);
    }
    
    // Now the generate button should be visible
    await expect(generateButton).toBeVisible();
    await generateButton.click();

    // Verify court assignments were created (should be at least 1 court)
    await expect(page.locator('[data-testid^="court-"]')).toHaveCount(2); // 8 players = 2 courts (4 players each)
    
    // Verify some players are assigned to courts
    const firstCourt = page.getByTestId('court-1');
    await expect(firstCourt.locator('.court-header')).toContainText('Court 1');

    // Step 5: Select a winner for the first court
    // Find the first team and click to select as winner
    const court1 = page.getByTestId('court-1');
    
    // Click on the first team (based on the HTML structure we saw)
    const firstTeam = court1.locator('.team-clickable').first();
    await expect(firstTeam).toBeVisible();
    await firstTeam.click();
    
    // Wait a moment for the winner state to update
    await page.waitForTimeout(300);
    
    // Verify winner was selected - check for crown or team-winner class
    // Should have at least 1 winner element (could be more if multiple courts)
    const winnerElement = page.locator('.crown, .team-winner');
    await expect(winnerElement).toHaveCount(2); // Expecting 2 since we have 2 courts

    // Step 6: Generate new assignments
    const generateNewButton = page.getByTestId('generate-new-assignments-button');
    await generateNewButton.click();

    // Verify new assignments were generated (winners should be cleared)
    await expect(page.locator('[data-testid^="court-"]')).toHaveCount(2); // Still 2 courts for 8 players
    
    // Verify that assignments changed by checking if courts still exist and have players
    const newCourtCards = page.locator('[data-testid^="court-"]');
    await expect(newCourtCards).toHaveCount(2);
    
    // Verify we can see the leaderboard section
    const leaderboard = page.locator('h2').filter({ hasText: 'Leaderboard' });
    await expect(leaderboard).toBeVisible();

    // Optional: Check that benched players section exists if there are benched players
    const benchSection = page.locator('.bench-section');
    if (await benchSection.isVisible()) {
      await expect(benchSection.locator('.bench-header')).toContainText('Bench');
    }

    // Verify final state: 8 players present
    await expect(page.getByTestId('stats-present-count')).toHaveText('8');
  });

  test('Player toggle functionality', async ({ page }) => {
    await page.goto('/');
    
    // Add a couple of players for testing
    const singlePlayerInput = page.getByTestId('single-player-input');
    await singlePlayerInput.fill('Test Player 1');
    await page.getByTestId('add-single-button').click();
    
    await singlePlayerInput.fill('Test Player 2');
    await page.getByTestId('add-single-button').click();

    // Initial state: 2 present players
    await expect(page.getByTestId('stats-present-count')).toHaveText('2');
    await expect(page.getByTestId('stats-absent-count')).toHaveText('0');

    // Toggle first player to absent
    const firstCheckbox = page.locator('[data-testid^="player-checkbox-"]').first();
    await firstCheckbox.uncheck();

    // Verify stats updated: 1 present, 1 absent  
    await expect(page.getByTestId('stats-present-count')).toHaveText('1');
    await expect(page.getByTestId('stats-absent-count')).toHaveText('1');

    // Toggle back to present
    await firstCheckbox.check();

    // Verify stats: back to 2 present, 0 absent
    await expect(page.getByTestId('stats-present-count')).toHaveText('2');
    await expect(page.getByTestId('stats-absent-count')).toHaveText('0');
  });

  test('Clear all players functionality', async ({ page }) => {
    await page.goto('/');
    
    // Add players
    const bulkTextarea = page.getByTestId('bulk-input');
    await bulkTextarea.fill('Player 1\nPlayer 2\nPlayer 3');
    await page.getByTestId('add-bulk-button').click();

    // Verify players were added
    await expect(page.getByTestId('stats-total-count')).toHaveText('3');

    // Click clear all button
    await page.getByTestId('clear-all-button').click();

    // Confirm in modal
    await expect(page.getByTestId('confirm-modal')).toBeVisible();
    await page.getByTestId('confirm-modal-confirm').click();

    // Verify all players cleared
    await expect(page.locator('.player-list')).toHaveCount(0);
    await expect(page.getByTestId('player-stats')).toHaveCount(0);
  });
});
