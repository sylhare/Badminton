/**
 * Copy Tesseract.js runtime assets (worker, WASM core, language data) from
 * node_modules into public/tesseract so they are served locally instead of
 * fetched from the jsdelivr CDN at runtime.
 *
 * Without this, every OCR call downloads ~13 MB (worker + core + eng
 * traineddata) from the CDN on the fly, which is slow and non-deterministic
 * (the source of the flaky image-import e2e test). Serving them locally makes
 * OCR fast and reliable for tests and real users alike.
 *
 * The output dir is gitignored and regenerated on predev / prebuild.
 *
 * Usage: npx tsx script/copy-tesseract-assets.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'tesseract');

const CORE_VARIANTS = [
  'tesseract-core-lstm',
  'tesseract-core-simd-lstm',
  'tesseract-core-relaxedsimd-lstm',
];

function copy(from: string, toName: string): void {
  if (!fs.existsSync(from)) {
    throw new Error(`Missing Tesseract asset: ${from} (is the dependency installed?)`);
  }
  fs.copyFileSync(from, path.join(OUT_DIR, toName));
  console.log(`  ✓ ${toName}`);
}

export function copyTesseractAssets(): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  copy(path.join(ROOT, 'node_modules/tesseract.js/dist/worker.min.js'), 'worker.min.js');

  for (const variant of CORE_VARIANTS) {
    const dir = path.join(ROOT, 'node_modules/tesseract.js-core');
    copy(path.join(dir, `${variant}.wasm`), `${variant}.wasm`);
    copy(path.join(dir, `${variant}.wasm.js`), `${variant}.wasm.js`);
  }

  copy(
    path.join(ROOT, 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'),
    'eng.traineddata.gz',
  );

  console.log(`Tesseract assets copied to ${path.relative(ROOT, OUT_DIR)}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  copyTesseractAssets();
}
