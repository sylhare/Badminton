import { test, expect } from '@playwright/test';

test.describe('Floating Menu System - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    const targetUrl = process.env.E2E_BASE_URL || 'http://localhost:5173';
    await page.goto(targetUrl);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  async function setupCollapsedStepForMobile(page) {
    await page.setViewportSize({ width: 375, height: 667 });
    
    const bulkTextarea = page.getByTestId('bulk-input').and(page.locator(':visible')).first();
    await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
    await page.getByTestId('add-bulk-button').and(page.locator(':visible')).first().click();

    await expect(page.getByTestId('stats-present-count').first()).toHaveText('4');

    const floatingButton = page.locator('.floating-action-btn');
    await expect(floatingButton).toBeVisible();
    
    return floatingButton;
  }

  test.describe('Mobile Responsive Behavior', () => {
    test('should show floating action button on mobile when steps are collapsed', async ({ page }) => {
      const floatingButton = await setupCollapsedStepForMobile(page);
      await expect(floatingButton).toHaveAttribute('aria-label', 'Show collapsed steps and quick actions');
    });

    test('should hide floating action button when no steps are collapsed', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const singlePlayerInput = page.getByTestId('single-player-input').and(page.locator(':visible')).first();
      await singlePlayerInput.fill('Alice');
      await page.getByTestId('add-single-button').and(page.locator(':visible')).first().click();

      await expect(page.getByTestId('stats-present-count').first()).toHaveText('1');

      const floatingButton = page.locator('.floating-action-btn');
      await expect(floatingButton).not.toBeVisible();
    });

    test('should hide floating action button on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });

      const bulkTextarea = page.getByTestId('bulk-input').and(page.locator(':visible')).first();
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
      await page.getByTestId('add-bulk-button').and(page.locator(':visible')).first().click();

      const addPlayersHeader = page.locator('.desktop-steps h2').filter({ hasText: 'Add Players' });
      await expect(addPlayersHeader).toBeVisible();
      await addPlayersHeader.click();

      const floatingButton = page.locator('.floating-action-btn');
      await expect(floatingButton).not.toBeVisible();
    });
  });

  test.describe('Mobile Drawer Functionality', () => {
    test('should open drawer when floating action button is clicked', async ({ page }) => {
      const floatingButton = await setupCollapsedStepForMobile(page);
      await floatingButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();
      await expect(page.getByText('Quick Access')).toBeVisible();
      await expect(page.getByText('Collapsed Steps')).toBeVisible();
      await expect(page.getByText('Quick Actions')).toBeVisible();
    });

    test('should close drawer when close button is clicked', async ({ page }) => {
      const floatingButton = await setupCollapsedStepForMobile(page);
      await floatingButton.click();

      const closeButton = page.getByRole('button', { name: 'Close drawer' });
      await closeButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).not.toBeVisible();
    });

    test('should close drawer when backdrop is clicked', async ({ page }) => {
      const floatingButton = await setupCollapsedStepForMobile(page);
      await floatingButton.click();

      const overlay = page.locator('.mobile-drawer-overlay');
      await overlay.click({ position: { x: 10, y: 10 } });

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).not.toBeVisible();
    });

    test('should not close drawer when clicking drawer content', async ({ page }) => {
      const floatingButton = await setupCollapsedStepForMobile(page);
      await floatingButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();

      const drawerContent = page.locator('.drawer-content');
      await drawerContent.click();

      await expect(drawer).toBeVisible();
    });
  });

  test.describe('Step Navigation via Drawer', () => {
    test('should expand collapsed step when clicked in drawer', async ({ page }) => {
      const floatingButton = await setupCollapsedStepForMobile(page);
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
      
      await page.setViewportSize({ width: 1024, height: 768 });
      const managePlayersHeader = page.locator('.desktop-steps h2').filter({ hasText: 'Step 2: Manage Players' });
      await expect(managePlayersHeader).toBeVisible();
      await managePlayersHeader.click();
      
      await page.setViewportSize({ width: 375, height: 667 });

      const floatingButton = page.locator('.floating-action-btn');
      await floatingButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();

      const collapsedStepButtons = page.locator('.step-button');
      await expect(collapsedStepButtons).toHaveCount(2);
    });

    test('should only show collapsed steps in drawer, not expanded ones', async ({ page }) => {
      const floatingButton = await setupCollapsedStepForMobile(page);
      await floatingButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();

      const collapsedStepButtons = page.locator('.step-button');
      await expect(collapsedStepButtons).toHaveCount(1);
      await expect(collapsedStepButtons.first()).toContainText('Add Players');
    });
  });

  test.describe('Quick Actions via Drawer', () => {
    test('should execute "Clear All Players" action from drawer', async ({ page }) => {
      const floatingButton = await setupCollapsedStepForMobile(page);
      await floatingButton.click();

      const clearAllAction = page.locator('.mobile-drawer .action-button').filter({ hasText: 'Clear All Players' });
      await clearAllAction.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).not.toBeVisible();

      const floatingButtonAfter = page.locator('.floating-action-btn');
      await expect(floatingButtonAfter).not.toBeVisible();
    });

    test('should execute "Reset Algorithm" action from drawer', async ({ page }) => {
      const floatingButton = await setupCollapsedStepForMobile(page);
      
      await page.setViewportSize({ width: 1024, height: 768 });
      const generateButton = page.getByTestId('generate-assignments-button').and(page.locator(':visible')).first();
      await expect(generateButton).toBeVisible();
      await generateButton.click();

      const firstTeam = page.locator('.team-clickable').and(page.locator(':visible')).first();
      await expect(firstTeam).toBeVisible();
      await firstTeam.click();
      await page.waitForTimeout(300);

      await page.setViewportSize({ width: 375, height: 667 });
      
      const mobileFloatingButton = page.locator('.floating-action-btn');
      await expect(mobileFloatingButton).toBeVisible();
      await mobileFloatingButton.click();

      const resetAction = page.getByRole('button', { name: /Reset Algorithm/i });
      await resetAction.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).not.toBeVisible();
    });

    test('should execute "Generate New Assignments" action from drawer', async ({ page }) => {
      const floatingButton = await setupCollapsedStepForMobile(page);
      
      await page.setViewportSize({ width: 1024, height: 768 });
      const generateButton = page.getByTestId('generate-assignments-button').and(page.locator(':visible')).first();
      await expect(generateButton).toBeVisible();
      await generateButton.click();
      
      await page.setViewportSize({ width: 375, height: 667 });
      
      const mobileFloatingButton = page.locator('.floating-action-btn');
      await expect(mobileFloatingButton).toBeVisible();
      await mobileFloatingButton.click();

      const generateNewAction = page.locator('.mobile-drawer .action-button').filter({ hasText: 'Generate New Assignments' });
      await generateNewAction.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).not.toBeVisible();

      await expect(page.locator('[data-testid^="court-"]').and(page.locator(':visible')).first()).toBeVisible();
    });

    test('should show destructive styling for destructive actions', async ({ page }) => {
      const floatingButton = await setupCollapsedStepForMobile(page);
      await floatingButton.click();

      const clearAllAction = page.locator('.mobile-drawer .action-button').filter({ hasText: 'Clear All Players' });
      await expect(clearAllAction).toHaveClass(/destructive/);

      const resetAction = page.locator('.mobile-drawer .action-button').filter({ hasText: 'Reset Algorithm' });
      await expect(resetAction).not.toHaveClass(/destructive/);
    });
  });

  test.describe('Responsive Behavior Switching', () => {
    test('should hide drawer when switching from mobile to desktop', async ({ page }) => {
      const floatingButton = await setupCollapsedStepForMobile(page);
      await floatingButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();

      await page.setViewportSize({ width: 1024, height: 768 });

      await expect(drawer).not.toBeVisible();
      await expect(page.locator('.floating-action-btn')).not.toBeVisible();
    });

    test('should maintain step collapse state across viewport changes', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });

      const bulkTextarea = page.getByTestId('bulk-input').and(page.locator(':visible')).first();
      await bulkTextarea.fill('Alice\nBob\nCharlie\nDiana');
      await page.getByTestId('add-bulk-button').and(page.locator(':visible')).first().click();

      const addPlayersHeader = page.locator('.desktop-steps h2').filter({ hasText: 'Add Players' });
      await expect(addPlayersHeader).toBeVisible();

      await page.setViewportSize({ width: 375, height: 667 });
      
      const floatingButton = page.locator('.floating-action-btn');
      await expect(floatingButton).toBeVisible();

      await page.setViewportSize({ width: 1024, height: 768 });
      
      await expect(addPlayersHeader).toBeVisible();
      await expect(page.getByTestId('bulk-input').and(page.locator(':visible')).first()).not.toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should support keyboard navigation in floating menu', async ({ page }) => {
      const floatingButton = await setupCollapsedStepForMobile(page);
      
      await floatingButton.focus();
      await page.keyboard.press('Enter');

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();

      const closeButton = page.getByRole('button', { name: 'Close drawer' });
      await closeButton.focus();
      await page.keyboard.press('Enter');
      await expect(drawer).not.toBeVisible();
    });

    test('should have proper ARIA labels and roles', async ({ page }) => {
      const floatingButton = await setupCollapsedStepForMobile(page);
      await expect(floatingButton).toHaveAttribute('aria-label', 'Show collapsed steps and quick actions');

      await floatingButton.click();

      const closeButton = page.getByRole('button', { name: 'Close drawer' });
      await expect(closeButton).toBeVisible();
      await expect(closeButton).toHaveAttribute('aria-label', 'Close drawer');
    });
  });
});
