import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import yaml from 'yaml';

interface LocaleDictionary {
  app: {
    title: string;
  };
  stats: {
    githubAnalysis: {
      description: string;
    };
  };
}

const readLocale = (locale: string): LocaleDictionary =>
  yaml.parse(fs.readFileSync(path.resolve(import.meta.dirname, `../../src/i18n/locales/${locale}.yml`), 'utf-8'));

const en = readLocale('en');
const ja = readLocale('ja');
const zh = readLocale('zh');
const fr = readLocale('fr');
const de = readLocale('de');
const hi = readLocale('hi');
const ms = readLocale('ms');

test.describe('i18n', () => {
  test('ja via locale: ja-JP context renders Japanese title', async ({ browser }) => {
    const context = await browser.newContext({
      locale: 'ja-JP',
    });
    const page = await context.newPage();
    await page.goto('/');

    await expect(page.locator('h1')).toContainText(ja.app.title);
    await expect(page.locator('h1')).not.toContainText(en.app.title);
    await context.close();
  });

  test('zh via localStorage badminton-locale renders Chinese title', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem('badminton-locale', 'zh');
    });
    await page.goto('/');

    await expect(page.locator('h1')).toContainText(zh.app.title);
    await context.close();
  });

  test('fr via locale: fr-FR context renders French title', async ({ browser }) => {
    const context = await browser.newContext({
      locale: 'fr-FR',
    });
    const page = await context.newPage();
    await page.goto('/');

    await expect(page.locator('h1')).toContainText(fr.app.title);
    await expect(page.locator('h1')).not.toContainText(en.app.title);
    await context.close();
  });

  test('de via locale: de-DE context renders German title', async ({ browser }) => {
    const context = await browser.newContext({
      locale: 'de-DE',
    });
    const page = await context.newPage();
    await page.goto('/');

    await expect(page.locator('h1')).toContainText(de.app.title);
    await expect(page.locator('h1')).not.toContainText(en.app.title);
    await context.close();
  });

  test('hi via locale: hi-IN context renders Hindi title', async ({ browser }) => {
    const context = await browser.newContext({
      locale: 'hi-IN',
    });
    const page = await context.newPage();
    await page.goto('/');

    await expect(page.locator('h1')).toContainText(hi.app.title);
    await expect(page.locator('h1')).not.toContainText(en.app.title);
    await context.close();
  });

  test('ms via locale: ms-MY context renders Malaysian title', async ({ browser }) => {
    const context = await browser.newContext({
      locale: 'ms-MY',
    });
    const page = await context.newPage();
    await page.goto('/');

    await expect(page.locator('h1')).toContainText(ms.app.title);
    await expect(page.locator('h1')).not.toContainText(en.app.title);
    await context.close();
  });

  test('footer language switch en -> ja -> en updates text and persists across reload', async ({ page }) => {
    await page.goto('/');
    const selector = page.getByTestId('language-selector');
    await expect(selector).toBeVisible();
    await expect(selector).toHaveValue('en');
    await expect(page.locator('h1')).toContainText(en.app.title);

    await selector.selectOption('ja');
    await expect(page.locator('h1')).toContainText(ja.app.title);

    await page.reload();
    await expect(page.locator('h1')).toContainText(ja.app.title);
    await expect(page.getByTestId('language-selector')).toHaveValue('ja');

    await page.getByTestId('language-selector').selectOption('en');
    await expect(page.locator('h1')).toContainText(en.app.title);
    await page.reload();
    await expect(page.locator('h1')).toContainText(en.app.title);
  });

  test('initial load for an English user does not request non-English chunks', async ({ page }) => {
    const requestedLocales: string[] = [];
    const nonEnLocales = ['ja', 'zh', 'fr', 'de', 'hi', 'ms'];
    page.on('request', request => {
      const url = request.url();
      for (const loc of nonEnLocales) {
        if (url.includes(`/${loc}.yml`) || url.match(new RegExp(`/${loc}-[^/]+\\.js`))) {
          requestedLocales.push(url);
        }
      }
    });

    await page.goto('/');
    await expect(page.locator('h1')).toContainText(en.app.title);

    expect(requestedLocales).toHaveLength(0);
  });

  test('stats page in ja renders translated GitHub analysis description', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'ja-JP' });
    const page = await context.newPage();
    await page.goto('./stats');

    await expect(page.locator('.analysis-card p')).toContainText(ja.stats.githubAnalysis.description);
    await context.close();
  });
});
