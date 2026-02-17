/// @vitest-environment node

import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { recognizePlayerNames } from '../../src/utils/ocrEngine';

const workerPath = (() => {
  const root = path.resolve(__dirname, '../../../..');
  return path.join(root, 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js');
})();

const SAMPLES: Array<{
  filename: string;
  expected: string[];
  minMatches: number;
}> = [
  {
    filename: path.resolve(__dirname, '../../tests/data/names.png'),
    expected: ['Tinley', 'Ella', 'Avrella', 'Yvette', 'Gabriela', 'Noella'],
    minMatches: 4,
  },
  {
    filename: path.resolve(__dirname, '../../tests/data/handwritten-names.png'),
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
    it(`should detect most expected names ${path.basename(sample.filename)}`, async () => {
        const imgBuf = fs.readFileSync(sample.filename);

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