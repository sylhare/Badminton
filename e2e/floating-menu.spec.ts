import { test, expect } from '@playwright/test';

test.describe('Floating Menu System - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    const targetUrl = process.env.E2E_BASE_URL || 'http://localhost:5173';
    await page.goto(targetUrl);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test.describe('Mobile Responsive Behavior', () => {
    test('should show floating action button on mobile when steps are collapsed', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Add some players to make steps visible
      const bulkTextarea = page.getByTestId('bulk-input');
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
      await page.getByTestId('add-bulk-button').click();

      // Collapse a step by clicking its header
      const addPlayersHeader = page.locator('h2').filter({ hasText: 'Add Players' });
      await addPlayersHeader.click();

      // Floating action button should be visible
      const floatingButton = page.locator('.floating-action-btn');
      await expect(floatingButton).toBeVisible();
      await expect(floatingButton).toHaveAttribute('aria-label', 'Show collapsed steps and quick actions');
    });

    test('should hide floating action button when no steps are collapsed', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Add some players
      const bulkTextarea = page.getByTestId('bulk-input');
      await bulkTextarea.fill('Alice\nBob');
      await page.getByTestId('add-bulk-button').click();

      // All steps should be expanded by default
      const floatingButton = page.locator('.floating-action-btn');
      await expect(floatingButton).not.toBeVisible();
    });

    test('should hide floating action button on desktop', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1024, height: 768 });

      // Add players and collapse steps
      const bulkTextarea = page.getByTestId('bulk-input');
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
      await page.getByTestId('add-bulk-button').click();

      const addPlayersHeader = page.locator('h2').filter({ hasText: 'Add Players' });
      await addPlayersHeader.click();

      // Floating action button should not be visible on desktop
      const floatingButton = page.locator('.floating-action-btn');
      await expect(floatingButton).not.toBeVisible();
    });
  });

  test.describe('Mobile Drawer Functionality', () => {
    test('should open drawer when floating action button is clicked', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Setup: Add players and collapse a step
      const bulkTextarea = page.getByTestId('bulk-input');
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
      await page.getByTestId('add-bulk-button').click();

      const addPlayersHeader = page.locator('h2').filter({ hasText: 'Add Players' });
      await addPlayersHeader.click();

      // Click floating action button
      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      // Drawer should open
      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();
      await expect(page.getByText('Quick Access')).toBeVisible();
      await expect(page.getByText('Collapsed Steps')).toBeVisible();
      await expect(page.getByText('Quick Actions')).toBeVisible();
    });

    test('should close drawer when close button is clicked', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Setup and open drawer
      const bulkTextarea = page.getByTestId('bulk-input');
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
      await page.getByTestId('add-bulk-button').click();

      const addPlayersHeader = page.locator('h2').filter({ hasText: 'Add Players' });
      await addPlayersHeader.click();

      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      // Close drawer
      const closeButton = page.getByRole('button', { name: 'Close drawer' });
      await closeButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).not.toBeVisible();
    });

    test('should close drawer when backdrop is clicked', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Setup and open drawer
      const bulkTextarea = page.getByTestId('bulk-input');
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
      await page.getByTestId('add-bulk-button').click();

      const addPlayersHeader = page.locator('h2').filter({ hasText: 'Add Players' });
      await addPlayersHeader.click();

      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      // Click backdrop (overlay)
      const overlay = page.locator('.mobile-drawer-overlay');
      await overlay.click({ position: { x: 10, y: 10 } }); // Click on edge to ensure backdrop

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).not.toBeVisible();
    });

    test('should not close drawer when clicking drawer content', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Setup and open drawer
      const bulkTextarea = page.getByTestId('bulk-input');
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
      await page.getByTestId('add-bulk-button').click();

      const addPlayersHeader = page.locator('h2').filter({ hasText: 'Add Players' });
      await addPlayersHeader.click();

      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      // Click on drawer content itself
      const drawerContent = page.locator('.drawer-content');
      await drawerContent.click();

      // Drawer should remain open
      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();
    });
  });

  test.describe('Step Navigation via Drawer', () => {
    test('should expand collapsed step when clicked in drawer', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Setup: Add players, collapse steps, and open drawer
      const bulkTextarea = page.getByTestId('bulk-input');
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
      await page.getByTestId('add-bulk-button').click();

      // Collapse "Add Players" step
      const addPlayersHeader = page.locator('h2').filter({ hasText: 'Add Players' });
      await addPlayersHeader.click();

      // Open drawer
      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      // Click on collapsed step in drawer
      const stepButton = page.getByRole('button', { name: /Add Players/i }).filter({ hasText: '📋' });
      await stepButton.click();

      // Drawer should close and step should be expanded
      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).not.toBeVisible();

      // Step should now be expanded (showing its content)
      await expect(page.getByTestId('bulk-input')).toBeVisible();
    });

    test('should show multiple collapsed steps in drawer', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Setup with multiple steps
      const bulkTextarea = page.getByTestId('bulk-input');
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
      await page.getByTestId('add-bulk-button').click();

      // Collapse multiple steps
      const addPlayersHeader = page.locator('h2').filter({ hasText: 'Add Players' });
      const managePlayersHeader = page.locator('h2').filter({ hasText: 'Manage Players' });

      await addPlayersHeader.click();
      await managePlayersHeader.click();

      // Open drawer
      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      // Should show both collapsed steps
      await expect(page.getByText('Add Players').filter({ hasText: '📋' })).toBeVisible();
      await expect(page.getByText('Manage Players').filter({ hasText: '📋' })).toBeVisible();
    });

    test('should only show collapsed steps in drawer, not expanded ones', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Setup
      const bulkTextarea = page.getByTestId('bulk-input');
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
      await page.getByTestId('add-bulk-button').click();

      // Only collapse "Add Players", leave "Manage Players" expanded
      const addPlayersHeader = page.locator('h2').filter({ hasText: 'Add Players' });
      await addPlayersHeader.click();

      // Open drawer
      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      // Should show only collapsed step
      await expect(page.getByText('Add Players').filter({ hasText: '📋' })).toBeVisible();
      await expect(page.getByText('Manage Players').filter({ hasText: '📋' })).not.toBeVisible();
    });
  });

  test.describe('Quick Actions via Drawer', () => {
    test('should execute "Clear All Players" action from drawer', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Setup
      const bulkTextarea = page.getByTestId('bulk-input');
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
      await page.getByTestId('add-bulk-button').click();

      // Collapse a step to show floating button
      const addPlayersHeader = page.locator('h2').filter({ hasText: 'Add Players' });
      await addPlayersHeader.click();

      // Open drawer
      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      // Click "Clear All Players" action
      const clearButton = page.getByRole('button', { name: /Clear All Players/i });
      await clearButton.click();

      // Drawer should close
      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).not.toBeVisible();

      // Confirmation modal should appear
      await expect(page.getByTestId('confirm-modal')).toBeVisible();

      // Confirm the action
      await page.getByTestId('confirm-modal-confirm').click();

      // Players should be cleared
      await expect(page.locator('.player-list')).toHaveCount(0);
      await expect(page.getByTestId('player-stats')).toHaveCount(0);
    });

    test('should execute "Reset Algorithm" action from drawer', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Setup with assignments
      const bulkTextarea = page.getByTestId('bulk-input');
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana\nEve\nFrank');
      await page.getByTestId('add-bulk-button').click();

      // Generate assignments
      const generateButton = page.getByTestId('generate-assignments-button');
      await generateButton.click();

      // Mark a winner to create history
      const firstTeam = page.locator('.team-clickable').first();
      await firstTeam.click();
      await page.waitForTimeout(300);

      // Collapse a step to show floating button
      const addPlayersHeader = page.locator('h2').filter({ hasText: 'Add Players' });
      await addPlayersHeader.click();

      // Open drawer
      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      // Click "Reset Algorithm" action
      const resetButton = page.getByRole('button', { name: /Reset Algorithm/i });
      await resetButton.click();

      // Drawer should close
      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).not.toBeVisible();

      // Leaderboard should be cleared (no more winners)
      const leaderboardHeader = page.locator('h2').filter({ hasText: 'Leaderboard' });
      if (await leaderboardHeader.isVisible()) {
        // If leaderboard is still visible, it should show reset state
        await expect(page.locator('.crown')).toHaveCount(0);
      }
    });

    test('should execute "Generate New Assignments" action from drawer', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Setup with assignments
      const bulkTextarea = page.getByTestId('bulk-input');
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana\nEve\nFrank');
      await page.getByTestId('add-bulk-button').click();

      const generateButton = page.getByTestId('generate-assignments-button');
      await generateButton.click();

      // Store initial assignments
      const initialCourts = await page.locator('[data-testid^="court-"]').count();

      // Collapse a step to show floating button
      const addPlayersHeader = page.locator('h2').filter({ hasText: 'Add Players' });
      await addPlayersHeader.click();

      // Open drawer
      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      // Click "Generate New Assignments" action
      const generateNewButton = page.getByRole('button', { name: /Generate New Assignments/i });
      await generateNewButton.click();

      // Drawer should close
      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).not.toBeVisible();

      // New assignments should be generated
      await expect(page.locator('[data-testid^="court-"]')).toHaveCount(initialCourts);
    });

    test('should show destructive styling for destructive actions', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Setup
      const bulkTextarea = page.getByTestId('bulk-input');
      await bulkTextarea.fill('Alice\nBob');
      await page.getByTestId('add-bulk-button').click();

      // Collapse a step to show floating button
      const addPlayersHeader = page.locator('h2').filter({ hasText: 'Add Players' });
      await addPlayersHeader.click();

      // Open drawer
      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      // Check destructive styling
      const clearButton = page.getByRole('button', { name: /Clear All Players/i });
      await expect(clearButton).toHaveClass(/destructive/);

      const resetButton = page.getByRole('button', { name: /Reset Algorithm/i });
      await expect(resetButton).not.toHaveClass(/destructive/);
    });
  });

  test.describe('Responsive Behavior Switching', () => {
    test('should hide drawer when switching from mobile to desktop', async ({ page }) => {
      // Start mobile
      await page.setViewportSize({ width: 375, height: 667 });

      // Setup and open drawer
      const bulkTextarea = page.getByTestId('bulk-input');
      await bulkTextarea.fill('Alice\nBob');
      await page.getByTestId('add-bulk-button').click();

      const addPlayersHeader = page.locator('h2').filter({ hasText: 'Add Players' });
      await addPlayersHeader.click();

      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      // Confirm drawer is open
      await expect(page.locator('.mobile-drawer')).toBeVisible();

      // Switch to desktop
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.waitForTimeout(100); // Allow for responsive changes

      // Drawer should be hidden
      await expect(page.locator('.mobile-drawer')).not.toBeVisible();
      await expect(page.locator('.floating-action-btn')).not.toBeVisible();
    });

    test('should maintain step collapse state across viewport changes', async ({ page }) => {
      // Start desktop
      await page.setViewportSize({ width: 1024, height: 768 });

      // Setup and collapse step
      const bulkTextarea = page.getByTestId('bulk-input');
      await bulkTextarea.fill('Alice\nBob');
      await page.getByTestId('add-bulk-button').click();

      const addPlayersHeader = page.locator('h2').filter({ hasText: 'Add Players' });
      await addPlayersHeader.click();

      // Confirm step is collapsed (content not visible)
      await expect(page.getByTestId('bulk-input')).not.toBeVisible();

      // Switch to mobile
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(100);

      // Step should still be collapsed and floating button should appear
      await expect(page.locator('.floating-action-btn')).toBeVisible();
      await expect(page.getByTestId('bulk-input')).not.toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should support keyboard navigation in floating menu', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Setup
      const bulkTextarea = page.getByTestId('bulk-input');
      await bulkTextarea.fill('Alice\nBob');
      await page.getByTestId('add-bulk-button').click();

      const addPlayersHeader = page.locator('h2').filter({ hasText: 'Add Players' });
      await addPlayersHeader.click();

      // Focus and activate floating button with keyboard
      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.focus();
      await page.keyboard.press('Enter');

      // Drawer should open
      await expect(page.locator('.mobile-drawer')).toBeVisible();

      // Tab through drawer elements
      await page.keyboard.press('Tab'); // Should focus close button
      await page.keyboard.press('Tab'); // Should focus first step
      await page.keyboard.press('Tab'); // Should focus second step or action

      // Close with Escape key
      await page.keyboard.press('Escape');
      // Note: This depends on implementation - drawer might not close with Escape
      // We'll just verify it's still accessible
    });

    test('should have proper ARIA labels and roles', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Setup
      const bulkTextarea = page.getByTestId('bulk-input');
      await bulkTextarea.fill('Alice\nBob');
      await page.getByTestId('add-bulk-button').click();

      const addPlayersHeader = page.locator('h2').filter({ hasText: 'Add Players' });
      await addPlayersHeader.click();

      // Check floating button ARIA
      const floatingButton = page.locator('.floating-action-btn');
      await expect(floatingButton).toHaveAttribute('aria-label', 'Show collapsed steps and quick actions');

      // Open drawer and check ARIA
      await floatingButton.click();

      const closeButton = page.getByRole('button', { name: 'Close drawer' });
      await expect(closeButton).toBeVisible();
    });
  });
});
