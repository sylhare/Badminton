#!/usr/bin/env node

/**
 * Integration test for OCR on a photo of handwritten names.
 *
 * Usage:  node tests/integration/ocr/handwritten-ocr-test.cjs
 * (Make sure you have run `npm install` so that tesseract.js is available.)
 */

const { createWorker } = require('tesseract.js');
const fs = require('fs');
const path = require('path');

// Minimal name-extraction helper (same logic as in ocr-test.cjs)
function extractPlayerNamesSimple(text) {
  if (!text || typeof text !== 'string') return [];

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const names = [];
  for (const line of lines) {
    if (line.length < 2) continue;

    const letters = (line.match(/[a-zA-Z]/g) || []).length;
    if (letters < line.length * 0.7) continue;

    const parts = line.split(/[,;|\t]+/);
    for (let part of parts) {
      part = part.trim();
      if (part.length >= 2 && part.length <= 25) {
        const clean = part.replace(/\s+/g, ' ').trim();
        if (clean && !names.includes(clean)) names.push(clean);
      }
    }
  }
  return names;
}

async function run() {
  console.log('✏️  OCR test – handwritten-names.png');

  // Resolve the sample image (tests/data/handwritten-names.png)
  const imagePath = path.resolve(__dirname, '../../data/handwritten-names.png');
  if (!fs.existsSync(imagePath)) {
    console.error('❌  Sample image not found:', imagePath);
    process.exit(1);
  }
  const imageBuffer = fs.readFileSync(imagePath);

  const worker = await createWorker('eng');
  // Apply the same parameters used in the app for better consistency
  if (typeof worker.setParameters === 'function') {
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ',
      preserve_interword_spaces: '1',
      tessedit_pageseg_mode: '11', // sparse text – better for lists
      user_defined_dpi: '300',
    });
  }
  try {
    console.log('🔄  Running OCR…');
    const { data: { text, confidence } } = await worker.recognize(imageBuffer);
    console.log('🔤  Raw OCR text:\n', text);
    console.log('⚙️   Mean confidence:', confidence);

    const extracted = extractPlayerNamesSimple(text);
    console.log('📋  Extracted names:', extracted);

    const expected = [
      'Amy Thomas',
      'Chelsea Cook',
      'Joel Nylund',
      'Kim Taylor',
      'Lori Davis',
      'Wendy Clark',
    ];

    const matches = expected.filter((name) =>
      extracted.some((e) =>
        e.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(e.toLowerCase())
      )
    );

    console.log(`✅  Matched ${matches.length}/${expected.length} expected names`);
    if (matches.length >= 4) {
      console.log('🎉  SUCCESS: OCR detected the majority of names.');
    } else {
      console.warn('⚠️   WARNING: OCR accuracy is low, consider tuning parameters.');
    }
  } finally {
    await worker.terminate();
  }
}

run().catch((err) => {
  console.error('❌  Test errored:', err);
  process.exit(1);
}); 