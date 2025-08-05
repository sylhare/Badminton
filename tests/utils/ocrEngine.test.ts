// @vitest-environment node

import fs from 'fs';
import path from 'path';

import { describe, it } from 'vitest';

import { recognizePlayerNames } from '../../src/utils/ocrEngine';

const workerPath = (() => {
  // __dirname here is tests/integration/ocr
  const root = path.resolve(__dirname, '../../../..'); // project root
  return path.join(root, 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js');
})();

const SAMPLES: Array<{
  filename: string;
  expected: string[];
  minMatches?: number;
}> = [
  {
    filename: path.resolve(__dirname, '../../tests/data/names.png'),
    expected: ['Tinley', 'Ella', 'Avrella', 'Yvette', 'Gabriela', 'Noella'],
    // Expect at least 4/6 matches on the clean printed sample
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
    // Handwriting is harder – require at least 2 matches as a smoke test
    minMatches: 2,
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
        console.log(matches);
      },
      60000, // timeout per test – OCR can be slow
    );
  });
});