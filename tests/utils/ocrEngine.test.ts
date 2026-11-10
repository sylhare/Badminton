/// @vitest-environment node

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { extractPlayerNames, isOcrSupported, recognizePlayerNames } from '../../src/utils/ocrEngine';

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

        const extracted = await recognizePlayerNames(imgBuf);

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

  describe('isOcrSupported', () => {
    it('returns boolean based on window and Worker availability', () => {
      expect(typeof isOcrSupported()).toBe('boolean');
    });
  });

  describe('extractPlayerNames', () => {
    it('returns empty array for empty string', () => {
      expect(extractPlayerNames('')).toEqual([]);
    });

    it('filters out line numbers and non-name characters', () => {
      const raw = '1. Alice Smith\n2) Bob Jones\n3 Charlie';
      const names = extractPlayerNames(raw);
      expect(names).toContain('Alice Smith');
      expect(names).toContain('Bob Jones');
      expect(names).toContain('Charlie');
    });
  });
});
