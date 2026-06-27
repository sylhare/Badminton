import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { MainPage } from '../support/pages/MainPage';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../tests/data');

function fixtureBase64(name: string): string {
  return fs.readFileSync(path.join(DATA_DIR, name)).toString('base64');
}

/** Runs preprocessImage in the page against a fixture, tracking URL revocation. */
async function runPreprocess(page: Page, name: string, b64: string) {
  return page.evaluate(async ({ name, b64 }) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const file = new File([bytes], name, { type: 'image/png' });

    const revoked: string[] = [];
    const realRevoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url: string) => {
      revoked.push(url);
      realRevoke(url);
    };

    const { preprocessImage } = await import('/src/utils/imagePreprocess.ts');
    try {
      const canvas = await preprocessImage(file);
      return { status: 'resolved', width: canvas.width, height: canvas.height, revoked: revoked.length };
    } catch {
      return { status: 'rejected', width: 0, height: 0, revoked: revoked.length };
    } finally {
      URL.revokeObjectURL = realRevoke;
    }
  }, { name, b64 });
}

test.describe('Image upload', () => {
  /**
   * Regression guard for the vendored Tesseract assets (copy-tesseract-assets
   * Vite plugin in vite.config.ts). The assets must be copied in the plugin's
   * `configResolved` hook, BEFORE the dev server's public-dir middleware is set
   * up. If copied later (e.g. in `buildStart`), requests for /tesseract/* fall
   * through to the SPA fallback and return index.html with a 200 status — so the
   * worker "loads" but is actually HTML, and OCR fails with an opaque
   * importScripts error. A status check alone would not catch that, so we assert
   * the served body is the real asset.
   */
  test.describe('vendored tesseract assets', () => {
    test('worker is served as real JS, not the SPA fallback HTML', async ({ request }) => {
      const res = await request.get('/tesseract/worker.min.js');

      expect(res.status()).toBe(200);
      expect(res.headers()['content-type'] ?? '').not.toContain('text/html');

      const body = await res.text();
      expect(body.toLowerCase()).not.toContain('<!doctype html');
      // The real worker is ~111 KB; the SPA fallback index.html is a few KB.
      expect(body.length).toBeGreaterThan(50_000);
    });

    test('language data is served as a real file, not the SPA fallback HTML', async ({ request }) => {
      const res = await request.get('/tesseract/eng.traineddata.gz');

      expect(res.status()).toBe(200);
      expect(res.headers()['content-type'] ?? '').not.toContain('text/html');

      // The traineddata is multi-MB; the SPA fallback index.html is a few KB.
      // (Don't assert gzip magic bytes: the dev server may send Content-Encoding:
      // gzip, in which case the HTTP client transparently decompresses the body.)
      const buf = await res.body();
      expect(buf.length).toBeGreaterThan(1_000_000);
    });
  });

  /**
   * Real-browser tests for preprocessImage. Unlike the jsdom unit test, nothing
   * is stubbed here: the actual browser image decoder, real OpenCV WASM and real
   * URL.createObjectURL/revokeObjectURL run. The fixtures are loaded from disk
   * and reconstructed as Files inside the page; preprocessImage is imported live
   * from the Vite dev server (base '/' in dev).
   */
  test.describe('preprocessImage (real browser)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
    });

    test('decodes a valid image into a canvas and revokes its object URL', async ({ page }) => {
      const result = await runPreprocess(page, 'names.png', fixtureBase64('names.png'));

      expect(result.status).toBe('resolved');
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
      expect(result.revoked).toBeGreaterThanOrEqual(1);
    });

    test('rejects a corrupt image the browser cannot decode and still revokes its object URL', async ({ page }) => {
      const result = await runPreprocess(page, 'corrupt.png', fixtureBase64('corrupt.png'));

      expect(result.status).toBe('rejected');
      expect(result.revoked).toBeGreaterThanOrEqual(1);
    });
  });

  /** Full UI flow: upload a photo, run OCR, select players and add them. */
  test.describe('import players from image', () => {
    let mainPage: MainPage;

    test.beforeEach(async ({ page }) => {
      mainPage = new MainPage(page);
      await mainPage.goto();
      await mainPage.reset();
    });

    test('extracts names from a photo and adds the selected players', async ({ page }) => {
      await test.step('open image upload modal', async () => {
        await page.getByTestId('open-image-modal-button').click();
        await expect(page.getByTestId('image-upload-modal')).toBeVisible();
      });

      await test.step('upload image and wait for OCR results', async () => {
        await page.getByTestId('image-file-input').setInputFiles(path.join(DATA_DIR, 'names.png'));
        await expect(page.locator('.extracted-players-section')).toBeVisible({ timeout: 60000 });
        const extractedCount = await page.locator('[data-testid^="extracted-player-"]').count();
        expect(extractedCount).toBeGreaterThanOrEqual(4);
        await expect(page.getByTestId('add-extracted-players-button')).toBeEnabled();
      });

      await test.step('deselect all disables button, select all re-enables it', async () => {
        await page.getByRole('button', { name: 'Deselect all' }).click();
        await expect(page.getByTestId('add-extracted-players-button')).toBeDisabled();
        await page.getByRole('button', { name: 'Select all', exact: true }).click();
        await expect(page.getByTestId('add-extracted-players-button')).toBeEnabled();
      });

      await test.step('add extracted players closes modal and updates count', async () => {
        await page.getByTestId('add-extracted-players-button').click();
        await expect(page.getByTestId('image-upload-modal')).not.toBeVisible();
        const totalCount = parseInt((await page.getByTestId('stats-total-count').textContent()) ?? '0');
        expect(totalCount).toBeGreaterThanOrEqual(4);
      });
    });

    /**
     * A corrupt image can't be decoded, so preprocessImage rejects and the real
     * Tesseract worker then fails on the same bytes. useImageOcr's catch branch
     * surfaces a window.alert — the app must stay usable and add no players.
     */
    test('a corrupt image fails gracefully without adding players', async ({ page }) => {
      test.setTimeout(120_000);

      await page.getByTestId('open-image-modal-button').click();
      await expect(page.getByTestId('image-upload-modal')).toBeVisible();

      const dialogPromise = page.waitForEvent('dialog', { timeout: 90_000 });
      await page.getByTestId('image-file-input').setInputFiles(path.join(DATA_DIR, 'corrupt.png'));

      const dialog = await dialogPromise;
      expect(dialog.message()).toContain('Failed to process image');
      await dialog.accept();

      // No players extracted; the modal stays on its upload screen and the app lives.
      await expect(page.getByTestId('add-extracted-players-button')).toHaveCount(0);
      await expect(page.locator('.modal-upload-area')).toBeVisible();
      await expect(page.locator('h1')).toContainText('🏸 Badminton Court Manager');
      await expect(page.getByTestId('stats-total-count')).toHaveCount(0);
    });
  });
});
