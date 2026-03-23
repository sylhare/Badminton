#!/usr/bin/env npx tsx

/**
 * How to run this script:
 * From project root: npx tsx e2e/integration/ocr/ocr-test.ts
 *
 * This script tests the real OCR functionality using the actual names.png image
 * and the real Tesseract.js library (not mocked).
 */

import fs from 'fs';
import path from 'path';

import { createWorker } from 'tesseract.js';

function extractPlayerNamesSimple(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const playerNames: string[] = [];

  for (const line of lines) {
    if (line.length < 2) continue;

    const letterCount = (line.match(/[a-zA-Z]/g) || []).length;
    if (letterCount < line.length * 0.7) continue;

    const parts = line.split(/[,;|\t]+/);

    for (let part of parts) {
      part = part.trim();

      if (part.length >= 2 && part.length <= 25) {
        const cleanName = part.replace(/\s+/g, ' ').trim();

        if (cleanName && !playerNames.includes(cleanName)) {
          playerNames.push(cleanName);
        }
      }
    }
  }

  return playerNames;
}

async function testRealOCR() {
  console.log('🔍 Testing Real OCR with names.png...\n');

  try {
    const imagePath = path.join(import.meta.dirname, '../../../tests/data/names.png');
    console.log(`📂 Loading image: ${imagePath}`);

    const imageBuffer = fs.readFileSync(imagePath);
    console.log(`✅ Image loaded successfully (${imageBuffer.length} bytes)\n`);

    console.log('🔧 Initializing Tesseract worker...');
    const worker = await createWorker('eng');

    try {
      console.log('✅ Tesseract worker ready\n');

      console.log('🔍 Processing image with OCR...');
      const { data: { text } } = await worker.recognize(imageBuffer);
      console.log('\n✅ OCR processing complete!\n');

      console.log('📝 Raw OCR Text:');
      console.log('='.repeat(50));
      console.log(text);
      console.log('='.repeat(50) + '\n');

      console.log('🎯 Extracting player names...');
      const extractedNames = extractPlayerNamesSimple(text);

      console.log('📋 Extracted Player Names:');
      console.log(JSON.stringify(extractedNames, null, 2));
      console.log('');

      const expectedNames = ['Tinley', 'Ella', 'Avrella', 'Yvette', 'Gabriela', 'Noella'];

      const foundNames = expectedNames.filter(name =>
        extractedNames.some(extracted =>
          extracted.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(extracted.toLowerCase()),
        ),
      );

      console.log('🎯 Results:');
      console.log(`   Expected names: ${expectedNames.length}`);
      console.log(`   Extracted names: ${extractedNames.length}`);
      console.log(`   Matched names: ${foundNames.length}`);
      console.log(`   Match rate: ${Math.round((foundNames.length / expectedNames.length) * 100)}%`);
      console.log('');

      console.log('✅ Expected:', expectedNames);
      console.log('🔍 Found matches:', foundNames);

      if (foundNames.length >= 4) {
        console.log('\n🎉 SUCCESS: OCR successfully extracted most names!');
      } else {
        console.log('\n⚠️  WARNING: OCR may need adjustment - only found', foundNames.length, 'out of', expectedNames.length, 'expected names');
      }

    } finally {
      await worker.terminate();
      console.log('\n🧹 Tesseract worker terminated');
    }

  } catch (error) {
    console.error('❌ Error during OCR test:', (error as Error).message);
    process.exit(1);
  }
}

testRealOCR().then(() => {
  console.log('\n✅ Real OCR test completed!');
}).catch(error => {
  console.error('\n❌ Real OCR test failed:', error);
  process.exit(1);
});
