import { test, expect } from '@playwright/test';
import { FloatingMenuTestHelpers, ANIMATION_TIMEOUT, TRANSITION_TIMEOUT } from './helpers';

test.describe('Floating Menu System - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await FloatingMenuTestHelpers.setupCleanState(page);
  });

  test.describe('Mobile Responsive Behavior', () => {
    test('should show floating action button on mobile when steps are collapsed', async ({ page }) => {
      const floatingButton = await FloatingMenuTestHelpers.setupCollapsedStepForMobile(page);
      await expect(floatingButton).toHaveAttribute('aria-label', 'Show collapsed steps and quick actions');
    });

    test('should hide floating action button when no steps are collapsed', async ({ page }) => {
      await FloatingMenuTestHelpers.setMobileViewport(page);

      const singlePlayerInput = page.getByTestId('single-player-input').locator(':visible').first();
      await expect(singlePlayerInput).toBeVisible();
      await singlePlayerInput.fill('Alice');
      await page.getByTestId('add-single-button').locator(':visible').first().click();

      await expect(page.getByTestId('stats-present-count').first()).toHaveText('1');

      const floatingButton = page.locator('.floating-action-btn');
      await expect(floatingButton).not.toBeVisible();
    });

    test('should hide floating action button on desktop', async ({ page }) => {
      await FloatingMenuTestHelpers.setDesktopViewport(page);

      await FloatingMenuTestHelpers.addBulkPlayers(page, ['Alice', 'Bob', 'Charlie', 'Diana']);

      const addPlayersHeader = page.locator('.desktop-steps h2').filter({ hasText: 'Add Players' });
      await expect(addPlayersHeader).toBeVisible();
      await addPlayersHeader.click();

      const floatingButton = page.locator('.floating-action-btn');
      await expect(floatingButton).not.toBeVisible();
    });
  });

  test.describe('Mobile Drawer Functionality', () => {
    test('should open drawer when floating action button is clicked', async ({ page }) => {
      const floatingButton = await FloatingMenuTestHelpers.setupCollapsedStepForMobile(page);
      await floatingButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();
      await expect(page.getByText('Quick Access')).toBeVisible();
      await expect(page.getByText('Collapsed Steps')).toBeVisible();
      await expect(page.getByText('Quick Actions')).toBeVisible();
    });

    test('should close drawer when close button is clicked', async ({ page }) => {
      const floatingButton = await FloatingMenuTestHelpers.setupCollapsedStepForMobile(page);
      await floatingButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();

      const closeButton = page.getByRole('button', { name: 'Close drawer' });
      await expect(closeButton).toBeVisible();
      await closeButton.click();

      await expect(drawer).not.toBeVisible();
    });

    test('should close drawer when backdrop is clicked', async ({ page }) => {
      const floatingButton = await FloatingMenuTestHelpers.setupCollapsedStepForMobile(page);
      await floatingButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();

      const overlay = page.locator('.mobile-drawer-overlay');
      await expect(overlay).toBeVisible();
      await overlay.click({ position: { x: 10, y: 10 } });

      await expect(drawer).not.toBeVisible();
    });

    test('should not close drawer when clicking drawer content', async ({ page }) => {
      const floatingButton = await FloatingMenuTestHelpers.setupCollapsedStepForMobile(page);
      await floatingButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();

      const drawerContent = page.locator('.drawer-content');
      await expect(drawerContent).toBeVisible();
      await drawerContent.click();

      await expect(drawer).toBeVisible();
    });
  });

  test.describe('Step Navigation via Drawer', () => {
    test('should expand collapsed step when clicked in drawer', async ({ page }) => {
      const floatingButton = await FloatingMenuTestHelpers.setupCollapsedStepForMobile(page);
      await floatingButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();

      const stepButton = page.getByRole('button', { name: /Add Players/i }).filter({ hasText: '📋' });
      await expect(stepButton).toBeVisible();
      await stepButton.click();

      await expect(drawer).not.toBeVisible();

      await expect(page.getByTestId('bulk-input').locator(':visible').first()).toBeVisible();
    });

    test('should show multiple collapsed steps in drawer', async ({ page }) => {
      await FloatingMenuTestHelpers.setMobileViewport(page);
      await FloatingMenuTestHelpers.addBulkPlayers(page, ['Alice', 'Bob', 'Charlie', 'Diana']);
      
      await FloatingMenuTestHelpers.setDesktopViewport(page);
      const managePlayersHeader = page.locator('.desktop-steps h2').filter({ hasText: 'Step 2: Manage Players' });
      await expect(managePlayersHeader).toBeVisible();
      await managePlayersHeader.click();
      
      await FloatingMenuTestHelpers.setMobileViewport(page);

      const floatingButton = page.locator('.floating-action-btn');
      await expect(floatingButton).toBeVisible();
      await floatingButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();

      const collapsedStepButtons = page.locator('.step-button');
      await expect(collapsedStepButtons).toHaveCount(2);
    });

    test('should only show collapsed steps in drawer, not expanded ones', async ({ page }) => {
      const floatingButton = await FloatingMenuTestHelpers.setupCollapsedStepForMobile(page);
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
      const floatingButton = await FloatingMenuTestHelpers.setupCollapsedStepForMobile(page);
      await floatingButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();

      const clearAllAction = page.locator('.mobile-drawer .action-button').filter({ hasText: 'Clear All Players' });
      await expect(clearAllAction).toBeVisible();
      await clearAllAction.click();

      await expect(drawer).not.toBeVisible();

      const floatingButtonAfter = page.locator('.floating-action-btn');
      await expect(floatingButtonAfter).not.toBeVisible();
    });

    test('should execute "Reset Algorithm" action from drawer', async ({ page }) => {
      // Setup game state with completed matches
      await FloatingMenuTestHelpers.setDesktopViewport(page);
      await FloatingMenuTestHelpers.addBulkPlayers(page, ['Alice', 'Bob', 'Charlie', 'Diana']);
      
      const generateButton = page.getByTestId('generate-assignments-button').locator(':visible').first();
      await expect(generateButton).toBeVisible();
      await generateButton.click();

      const firstTeam = page.locator('.team-clickable').locator(':visible').first();
      await expect(firstTeam).toBeVisible();
      await firstTeam.click();
      await FloatingMenuTestHelpers.waitForStableView(page, ANIMATION_TIMEOUT);

      await FloatingMenuTestHelpers.setMobileViewport(page);
      
      const mobileFloatingButton = page.locator('.floating-action-btn');
      await expect(mobileFloatingButton).toBeVisible();
      await mobileFloatingButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();

      const resetAction = page.getByRole('button', { name: /Reset Algorithm/i });
      await expect(resetAction).toBeVisible();
      await resetAction.click();

      await expect(drawer).not.toBeVisible();
    });

    test('should execute "Generate New Assignments" action from drawer', async ({ page }) => {
      await FloatingMenuTestHelpers.setDesktopViewport(page);
      await FloatingMenuTestHelpers.addBulkPlayers(page, ['Alice', 'Bob', 'Charlie', 'Diana']);
      
      const generateButton = page.getByTestId('generate-assignments-button').locator(':visible').first();
      await expect(generateButton).toBeVisible();
      await generateButton.click();
      
      await FloatingMenuTestHelpers.setMobileViewport(page);
      
      const mobileFloatingButton = page.locator('.floating-action-btn');
      await expect(mobileFloatingButton).toBeVisible();
      await mobileFloatingButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();

      const generateNewAction = page.locator('.mobile-drawer .action-button').filter({ hasText: 'Generate New Assignments' });
      await expect(generateNewAction).toBeVisible();
      await generateNewAction.click();

      await expect(drawer).not.toBeVisible();

      await expect(page.locator('[data-testid^="court-"]').locator(':visible').first()).toBeVisible();
    });

    test('should show destructive styling for destructive actions', async ({ page }) => {
      const floatingButton = await FloatingMenuTestHelpers.setupCollapsedStepForMobile(page);
      await floatingButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();

      const clearAllAction = page.locator('.mobile-drawer .action-button').filter({ hasText: 'Clear All Players' });
      await expect(clearAllAction).toBeVisible();
      await expect(clearAllAction).toHaveClass(/destructive/);

      const resetAction = page.locator('.mobile-drawer .action-button').filter({ hasText: 'Reset Algorithm' });
      if (await resetAction.count() > 0) {
        await expect(resetAction).not.toHaveClass(/destructive/);
      }
    });
  });

  test.describe('Responsive Behavior Switching', () => {
    test('should hide drawer when switching from mobile to desktop', async ({ page }) => {
      const floatingButton = await FloatingMenuTestHelpers.setupCollapsedStepForMobile(page);
      await floatingButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();

      await FloatingMenuTestHelpers.setDesktopViewport(page);

      await expect(drawer).not.toBeVisible();
      await expect(page.locator('.floating-action-btn')).not.toBeVisible();
    });

    test('should maintain step collapse state across viewport changes', async ({ page }) => {
      await FloatingMenuTestHelpers.setDesktopViewport(page);
      await FloatingMenuTestHelpers.addBulkPlayers(page, ['Alice', 'Bob', 'Charlie', 'Diana']);

      const addPlayersHeader = page.locator('.desktop-steps h2').filter({ hasText: 'Add Players' });
      await expect(addPlayersHeader).toBeVisible();

      await FloatingMenuTestHelpers.setMobileViewport(page);
      
      const floatingButton = page.locator('.floating-action-btn');
      await expect(floatingButton).toBeVisible();

      await FloatingMenuTestHelpers.setDesktopViewport(page);
      
      await expect(addPlayersHeader).toBeVisible();
      await expect(page.getByTestId('bulk-input').locator(':visible').first()).not.toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should support keyboard navigation in floating menu', async ({ page }) => {
      const floatingButton = await FloatingMenuTestHelpers.setupCollapsedStepForMobile(page);
      
      await floatingButton.focus();
      await page.keyboard.press('Enter');

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();

      const closeButton = page.getByRole('button', { name: 'Close drawer' });
      await expect(closeButton).toBeVisible();
      await closeButton.focus();
      await page.keyboard.press('Enter');
      
      await expect(drawer).not.toBeVisible();
    });

    test('should have proper ARIA labels and roles', async ({ page }) => {
      const floatingButton = await FloatingMenuTestHelpers.setupCollapsedStepForMobile(page);
      
      await expect(floatingButton).toHaveAttribute('aria-label', 'Show collapsed steps and quick actions');

      await floatingButton.click();

      const drawer = page.locator('.mobile-drawer');
      await expect(drawer).toBeVisible();

      const closeButton = page.getByRole('button', { name: 'Close drawer' });
      await expect(closeButton).toBeVisible();
      await expect(closeButton).toHaveAttribute('aria-label', 'Close drawer');
    });
  });
});
