import { test, expect } from '@playwright/test';
import { 
  goToApp, 
  addBulkPlayers, 
  removeFirstPlayer,
  completeFullWorkflow,
  BULK_PLAYERS 
} from './helpers';

test.describe('Bulk Player Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Complete bulk player workflow - add all at once', async ({ page }) => {
    await addBulkPlayers(page, BULK_PLAYERS);
    
    await expect(page.getByTestId('stats-present-count')).toHaveText('7');
    await expect(page.getByTestId('stats-total-count')).toHaveText('7');
    
    await removeFirstPlayer(page);
    
    await expect(page.getByTestId('stats-total-count')).toHaveText('6');
    await expect(page.getByTestId('stats-present-count')).toHaveText('6');
    
    await completeFullWorkflow(page, 6, 2);
  });

  test('Bulk add with large player list', async ({ page }) => {
    const largeBulkList = [
      ...BULK_PLAYERS,
      'Henry Garcia',
      'Ivy Thompson',
      'Jack Wilson',
      'Kate Brown',
      'Liam Davis',
      'Maya Smith'
    ];
    
    await addBulkPlayers(page, largeBulkList);
    
    await expect(page.getByTestId('stats-total-count')).toHaveText('13');
    await expect(page.getByTestId('stats-present-count')).toHaveText('13');
    
    await completeFullWorkflow(page, 13, 3);
  });
});
