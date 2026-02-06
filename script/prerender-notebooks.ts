/**
 * Pre-render marimo notebook HTML exports using Playwright.
 * This removes the need for JavaScript execution at runtime by capturing
 * the fully rendered HTML after marimo's JS has executed.
 *
 * Usage: npx tsx script/prerender-notebooks.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_DIR = path.resolve(__dirname, '../analysis/html');
const OUTPUT_DIR = path.resolve(__dirname, '../public/analysis');

// Only these notebooks are included in the app
const NOTEBOOKS_TO_PRERENDER = ['algorithm_docs.html', 'engine_analysis.html'];

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

  // Check which notebooks exist and need to be prerendered
  const existingFiles = fs.readdirSync(INPUT_DIR).filter((f) => f.endsWith('.html'));
  const htmlFiles = NOTEBOOKS_TO_PRERENDER.filter((f) => existingFiles.includes(f));
  const missingFiles = NOTEBOOKS_TO_PRERENDER.filter((f) => !existingFiles.includes(f));

  if (htmlFiles.length === 0) {
    console.error('No HTML files found in analysis/html/');
    console.error('Run the following in the analysis/ directory first:');
    console.error('  uv run marimo export html --no-include-code algorithm_docs.py -o html/algorithm_docs.html');
    console.error('  uv run marimo export html --no-include-code engine_analysis.py -o html/engine_analysis.html');
    process.exit(1);
  }

  if (missingFiles.length > 0) {
    console.warn(`Warning: Missing notebooks: ${missingFiles.join(', ')}`);
    console.warn('These will be skipped.\n');
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
