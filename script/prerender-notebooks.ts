/**
 * Pre-render marimo notebook HTML exports using Playwright.
 * This removes the need for JavaScript execution at runtime by capturing
 * the fully rendered HTML after marimo's JS has executed.
 *
 * Usage: npx tsx script/prerender-notebooks.ts
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const INPUT_DIR = path.resolve(__dirname, '../analysis/html');
const OUTPUT_DIR = path.resolve(__dirname, '../public/analysis');

async function prerenderNotebook(inputPath: string, outputPath: string): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const fileUrl = `file://${inputPath}`;
    console.log(`  Loading: ${path.basename(inputPath)}`);

    await page.goto(fileUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const html = await page.content();
    fs.writeFileSync(outputPath, html, 'utf-8');

    console.log(`  ✓ Saved: ${path.basename(outputPath)}`);
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  console.log('Pre-rendering marimo notebooks...\n');

  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`Error: Input directory not found: ${INPUT_DIR}`);
    console.error('Run "uv run export-html" in the analysis/ directory first.');
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const htmlFiles = fs.readdirSync(INPUT_DIR).filter((f) => f.endsWith('.html'));

  if (htmlFiles.length === 0) {
    console.error('No HTML files found in analysis/html/');
    console.error('Run "uv run export-html" in the analysis/ directory first.');
    process.exit(1);
  }

  console.log(`Found ${htmlFiles.length} notebook(s) to pre-render:\n`);

  for (const file of htmlFiles) {
    const inputPath = path.join(INPUT_DIR, file);
    const outputPath = path.join(OUTPUT_DIR, file);
    await prerenderNotebook(inputPath, outputPath);
  }

  console.log(`\n✓ All notebooks pre-rendered to public/analysis/`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
