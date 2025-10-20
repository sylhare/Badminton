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
      await page.setViewportSize({ width: 375, height: 667 });

      const bulkTextarea = page.getByTestId('bulk-input').and(page.locator(':visible')).first();
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
      await page.getByTestId('add-bulk-button').and(page.locator(':visible')).first().click();

      const addPlayersHeader = page.locator('.mobile-steps h2').filter({ hasText: 'Step 1: Add Players' });
      await addPlayersHeader.click();

      const floatingButton = page.locator('.floating-action-btn');
      await expect(floatingButton).toBeVisible();
      await expect(floatingButton).toHaveAttribute('aria-label', 'Show collapsed steps and quick actions');
    });

    test('should hide floating action button when no steps are collapsed', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const bulkTextarea = page.getByTestId('bulk-input').and(page.locator(':visible')).first();
      await bulkTextarea.fill('Alice\nBob');
      await page.getByTestId('add-bulk-button').and(page.locator(':visible')).first().click();

      const floatingButton = page.locator('.floating-action-btn');
      await expect(floatingButton).not.toBeVisible();
    });

    test('should hide floating action button on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });

      const bulkTextarea = page.getByTestId('bulk-input').and(page.locator(':visible')).first();
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
      await page.getByTestId('add-bulk-button').and(page.locator(':visible')).first().click();

      const addPlayersHeader = page.locator('.desktop-steps h2').filter({ hasText: 'Step 1: Add Players' });
      await addPlayersHeader.click();

      const floatingButton = page.locator('.floating-action-btn');
      await expect(floatingButton).not.toBeVisible();
    });
  });

  test.describe('Mobile Drawer Functionality', () => {
    test('should open drawer when floating action button is clicked', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const bulkTextarea = page.getByTestId('bulk-input').and(page.locator(':visible')).first();
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
      await page.getByTestId('add-bulk-button').and(page.locator(':visible')).first().click();

      const addPlayersHeader = page.locator('.mobile-steps h2').filter({ hasText: 'Step 1: Add Players' });
      await addPlayersHeader.click();

      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();
      await expect(page.getByText('Quick Access')).toBeVisible();
      await expect(page.getByText('Collapsed Steps')).toBeVisible();
      await expect(page.getByText('Quick Actions')).toBeVisible();
    });

    test('should close drawer when close button is clicked', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const bulkTextarea = page.getByTestId('bulk-input').and(page.locator(':visible')).first();
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
      await page.getByTestId('add-bulk-button').and(page.locator(':visible')).first().click();

      const addPlayersHeader = page.locator('.mobile-steps h2').filter({ hasText: 'Step 1: Add Players' });
      await addPlayersHeader.click();

      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      const closeButton = page.getByRole('button', { name: 'Close drawer' });
      await closeButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).not.toBeVisible();
    });

    test('should close drawer when backdrop is clicked', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const bulkTextarea = page.getByTestId('bulk-input').and(page.locator(':visible')).first();
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
      await page.getByTestId('add-bulk-button').and(page.locator(':visible')).first().click();

      const addPlayersHeader = page.locator('.mobile-steps h2').filter({ hasText: 'Step 1: Add Players' });
      await addPlayersHeader.click();

      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      const overlay = page.locator('.mobile-drawer-overlay');
      await overlay.click({ position: { x: 10, y: 10 } });

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).not.toBeVisible();
    });

    test('should not close drawer when clicking drawer content', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const bulkTextarea = page.getByTestId('bulk-input').and(page.locator(':visible')).first();
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
      await page.getByTestId('add-bulk-button').and(page.locator(':visible')).first().click();

      const addPlayersHeader = page.locator('.mobile-steps h2').filter({ hasText: 'Step 1: Add Players' });
      await addPlayersHeader.click();

      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      const drawerContent = page.locator('.drawer-content');
      await drawerContent.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();
    });
  });

  test.describe('Step Navigation via Drawer', () => {
    test('should expand collapsed step when clicked in drawer', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const bulkTextarea = page.getByTestId('bulk-input').and(page.locator(':visible')).first();
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
      await page.getByTestId('add-bulk-button').and(page.locator(':visible')).first().click();

      const addPlayersHeader = page.locator('.mobile-steps h2').filter({ hasText: 'Step 1: Add Players' });
      await addPlayersHeader.click();

      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      const stepButton = page.getByRole('button', { name: /Add Players/i }).filter({ hasText: '📋' });
      await stepButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).not.toBeVisible();

      await expect(page.getByTestId('bulk-input').and(page.locator(':visible')).first()).toBeVisible();
    });

    test('should show multiple collapsed steps in drawer', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const bulkTextarea = page.getByTestId('bulk-input').and(page.locator(':visible')).first();
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
      await page.getByTestId('add-bulk-button').and(page.locator(':visible')).first().click();

      const addPlayersHeader = page.locator('.mobile-steps h2').filter({ hasText: 'Step 1: Add Players' });
      const managePlayersHeader = page.locator('.mobile-steps h2').filter({ hasText: 'Step 2: Manage Players' });

      await addPlayersHeader.click();
      await managePlayersHeader.click();

      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      await expect(page.getByText('Add Players').filter({ hasText: '📋' })).toBeVisible();
      await expect(page.getByText('Manage Players').filter({ hasText: '📋' })).toBeVisible();
    });

    test('should only show collapsed steps in drawer, not expanded ones', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const bulkTextarea = page.getByTestId('bulk-input').and(page.locator(':visible')).first();
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
      await page.getByTestId('add-bulk-button').and(page.locator(':visible')).first().click();

      const addPlayersHeader = page.locator('.mobile-steps h2').filter({ hasText: 'Step 1: Add Players' });
      await addPlayersHeader.click();

      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      await expect(page.getByText('Add Players').filter({ hasText: '📋' })).toBeVisible();
      await expect(page.getByText('Manage Players').filter({ hasText: '📋' })).not.toBeVisible();
    });
  });

  test.describe('Quick Actions via Drawer', () => {
    test('should execute "Clear All Players" action from drawer', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const bulkTextarea = page.getByTestId('bulk-input').and(page.locator(':visible')).first();
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
      await page.getByTestId('add-bulk-button').and(page.locator(':visible')).first().click();

      const addPlayersHeader = page.locator('.mobile-steps h2').filter({ hasText: 'Step 1: Add Players' });
      await addPlayersHeader.click();

      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      const clearButton = page.getByRole('button', { name: /Clear All Players/i });
      await clearButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).not.toBeVisible();

      await expect(page.getByTestId('confirm-modal').first()).toBeVisible();

      await page.getByTestId('confirm-modal-confirm').first().click();

      await expect(page.locator('.player-list')).toHaveCount(0);
      await expect(page.getByTestId('player-stats').first()).toHaveCount(0);
    });

    test('should execute "Reset Algorithm" action from drawer', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const bulkTextarea = page.getByTestId('bulk-input').and(page.locator(':visible')).first();
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana\nEve\nFrank');
      await page.getByTestId('add-bulk-button').and(page.locator(':visible')).first().click();

      const generateButton = page.getByTestId('generate-assignments-button').and(page.locator(':visible')).first();
      await generateButton.click();

      const firstTeam = page.locator('.team-clickable').first();
      await firstTeam.click();
      await page.waitForTimeout(300);

      const addPlayersHeader = page.locator('.mobile-steps h2').filter({ hasText: 'Step 1: Add Players' });
      await addPlayersHeader.click();

      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      const resetButton = page.getByRole('button', { name: /Reset Algorithm/i });
      await resetButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).not.toBeVisible();

      const leaderboardHeader = page.locator('h2').filter({ hasText: 'Leaderboard' });
      if (await leaderboardHeader.isVisible()) {
        await expect(page.locator('.crown')).toHaveCount(0);
      }
    });

    test('should execute "Generate New Assignments" action from drawer', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const bulkTextarea = page.getByTestId('bulk-input').and(page.locator(':visible')).first();
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana\nEve\nFrank');
      await page.getByTestId('add-bulk-button').and(page.locator(':visible')).first().click();

      const generateButton = page.getByTestId('generate-assignments-button').and(page.locator(':visible')).first();
      await generateButton.click();

      const initialCourts = await page.locator('[data-testid^="court-"]').count();

      const addPlayersHeader = page.locator('.mobile-steps h2').filter({ hasText: 'Step 1: Add Players' });
      await addPlayersHeader.click();

      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      const generateNewButton = page.getByRole('button', { name: /Generate New Assignments/i });
      await generateNewButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).not.toBeVisible();

      await expect(page.locator('[data-testid^="court-"]')).toHaveCount(initialCourts);
    });

    test('should show destructive styling for destructive actions', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const bulkTextarea = page.getByTestId('bulk-input').and(page.locator(':visible')).first();
      await bulkTextarea.fill('Alice\nBob');
      await page.getByTestId('add-bulk-button').and(page.locator(':visible')).first().click();

      const addPlayersHeader = page.locator('.mobile-steps h2').filter({ hasText: 'Step 1: Add Players' });
      await addPlayersHeader.click();

      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      const clearButton = page.getByRole('button', { name: /Clear All Players/i });
      await expect(clearButton).toHaveClass(/destructive/);

      const resetButton = page.getByRole('button', { name: /Reset Algorithm/i });
      await expect(resetButton).not.toHaveClass(/destructive/);
    });
  });

  test.describe('Responsive Behavior Switching', () => {
    test('should hide drawer when switching from mobile to desktop', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const bulkTextarea = page.getByTestId('bulk-input').and(page.locator(':visible')).first();
      await bulkTextarea.fill('Alice\nBob');
      await page.getByTestId('add-bulk-button').and(page.locator(':visible')).first().click();

      const addPlayersHeader = page.locator('.mobile-steps h2').filter({ hasText: 'Step 1: Add Players' });
      await addPlayersHeader.click();

      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      await expect(page.locator('.mobile-drawer')).toBeVisible();

      await page.setViewportSize({ width: 1024, height: 768 });
      await page.waitForTimeout(100);

      await expect(page.locator('.mobile-drawer')).not.toBeVisible();
      await expect(page.locator('.floating-action-btn')).not.toBeVisible();
    });

    test('should maintain step collapse state across viewport changes', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });

      const bulkTextarea = page.getByTestId('bulk-input').and(page.locator(':visible')).first();
      await bulkTextarea.fill('Alice\nBob');
      await page.getByTestId('add-bulk-button').and(page.locator(':visible')).first().click();

      const addPlayersHeader = page.locator('.desktop-steps h2').filter({ hasText: 'Step 1: Add Players' });
      await addPlayersHeader.click();

      await expect(page.getByTestId('bulk-input').and(page.locator(':visible')).first()).not.toBeVisible();

      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(100);

      await expect(page.locator('.floating-action-btn')).toBeVisible();
      await expect(page.getByTestId('bulk-input').and(page.locator(':visible')).first()).not.toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should support keyboard navigation in floating menu', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const bulkTextarea = page.getByTestId('bulk-input').and(page.locator(':visible')).first();
      await bulkTextarea.fill('Alice\nBob');
      await page.getByTestId('add-bulk-button').and(page.locator(':visible')).first().click();

      const addPlayersHeader = page.locator('.mobile-steps h2').filter({ hasText: 'Step 1: Add Players' });
      await addPlayersHeader.click();

      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.focus();
      await page.keyboard.press('Enter');

      await expect(page.locator('.mobile-drawer')).toBeVisible();

      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      await page.keyboard.press('Escape');
    });

    test('should have proper ARIA labels and roles', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const bulkTextarea = page.getByTestId('bulk-input').and(page.locator(':visible')).first();
      await bulkTextarea.fill('Alice\nBob');
      await page.getByTestId('add-bulk-button').and(page.locator(':visible')).first().click();

      const addPlayersHeader = page.locator('.mobile-steps h2').filter({ hasText: 'Step 1: Add Players' });
      await addPlayersHeader.click();

      const floatingButton = page.locator('.floating-action-btn');
      await expect(floatingButton).toHaveAttribute('aria-label', 'Show collapsed steps and quick actions');

      await floatingButton.click();

      const closeButton = page.getByRole('button', { name: 'Close drawer' });
      await expect(closeButton).toBeVisible();
    });
  });
});