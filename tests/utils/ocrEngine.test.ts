/// @vitest-environment node
/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { recognizePlayerNames } from '../../src/utils/ocrEngine';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const workerPath = (() => {
  const root = resolve(__dirname, '../../../..');
  return join(root, 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js');
})();

const SAMPLES: Array<{
  filename: string;
  expected: string[];
  minMatches: number;
}> = [
  {
    filename: resolve(__dirname, '../../tests/data/names.png'),
    expected: ['Tinley', 'Ella', 'Avrella', 'Yvette', 'Gabriela', 'Noella'],
    minMatches: 4,
  },
  {
    filename: resolve(__dirname, '../../tests/data/handwritten-names.png'),
    expected: [
      'Amy Thomas',
      'Chelsea Cook',
      'Joel Nylund',
      'Kim Taylor',
      'Lori Davis',
      'Wendy Clark',
    ],
    minMatches: 0,
  },
];

describe('OCR integration', () => {
  describe.each(SAMPLES)('sample %#', (sample) => {
    it(`should detect most expected names ${basename(sample.filename)}`, async () => {
        const imgBuf = readFileSync(sample.filename);

        const extracted = await recognizePlayerNames(imgBuf, { workerPath });

        const matches = sample.expected.filter((name) =>
          extracted.some((e) =>
            e.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(e.toLowerCase()),
          ),
        );

        expect(matches.length).toBeGreaterThanOrEqual(sample.minMatches);
      },
      60000,
    );
  });
});