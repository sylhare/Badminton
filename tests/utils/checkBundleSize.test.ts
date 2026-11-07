import { describe, expect, it } from 'vitest';

import {
  type BundleBudgets,
  BUDGETS,
  evaluateChunk,
  formatSize,
  renderAsciiTable,
} from '../../script/check-bundle-size';

describe('check-bundle-size functionality', () => {
  const KB = 1024;
  const MOCK_BUDGETS: BundleBudgets = {
    entryGzip: 50 * KB,
    vendorReactGzip: 120 * KB,
    vendorReactRaw: 280 * KB,
    maxChunkRaw: 80 * KB,
  };

  describe('formatSize', () => {
    it('formats raw byte values to two decimal place kB strings', () => {
      expect(formatSize(1024)).toBe('1.00 kB');
      expect(formatSize(2048)).toBe('2.00 kB');
      expect(formatSize(1536)).toBe('1.50 kB');
      expect(formatSize(512)).toBe('0.50 kB');
    });
  });

  describe('evaluateChunk functionality', () => {
    it('passes entry index chunk when both gzip and raw sizes are within limits', () => {
      const raw = MOCK_BUDGETS.maxChunkRaw - KB;
      const gzip = MOCK_BUDGETS.entryGzip - KB;
      const result = evaluateChunk('index-hash.js', raw, gzip, true, MOCK_BUDGETS);

      expect(result.passed).toBe(true);
      expect(result.threshold).toBe(`gzip <= ${formatSize(MOCK_BUDGETS.entryGzip)}`);
      expect(result.notes).toBeUndefined();
    });

    it('fails entry index chunk when gzip size exceeds budget', () => {
      const raw = MOCK_BUDGETS.maxChunkRaw - KB;
      const gzip = MOCK_BUDGETS.entryGzip + KB;
      const result = evaluateChunk('index-hash.js', raw, gzip, true, MOCK_BUDGETS);

      expect(result.passed).toBe(false);
      expect(result.notes).toContain(`gzip > ${formatSize(MOCK_BUDGETS.entryGzip)}`);
    });

    it('fails entry index chunk when raw size exceeds raw ceiling', () => {
      const raw = MOCK_BUDGETS.maxChunkRaw + KB;
      const gzip = MOCK_BUDGETS.entryGzip - KB;
      const result = evaluateChunk('index-hash.js', raw, gzip, true, MOCK_BUDGETS);

      expect(result.passed).toBe(false);
      expect(result.notes).toContain(`raw > ${formatSize(MOCK_BUDGETS.maxChunkRaw)}`);
    });

    it('passes vendor-react chunk when sizes are within vendor limits', () => {
      const raw = MOCK_BUDGETS.vendorReactRaw - KB;
      const gzip = MOCK_BUDGETS.vendorReactGzip - KB;
      const result = evaluateChunk('vendor-react-hash.js', raw, gzip, true, MOCK_BUDGETS);

      expect(result.passed).toBe(true);
      expect(result.threshold).toBe(`gzip <= ${formatSize(MOCK_BUDGETS.vendorReactGzip)}`);
      expect(result.notes).toBeUndefined();
    });

    it('fails vendor-react chunk when gzip size exceeds vendor gzip budget', () => {
      const raw = MOCK_BUDGETS.vendorReactRaw - KB;
      const gzip = MOCK_BUDGETS.vendorReactGzip + KB;
      const result = evaluateChunk('vendor-react-hash.js', raw, gzip, true, MOCK_BUDGETS);

      expect(result.passed).toBe(false);
      expect(result.notes).toContain(`gzip > ${formatSize(MOCK_BUDGETS.vendorReactGzip)}`);
    });

    it('fails vendor-react chunk when raw size exceeds vendor raw ceiling', () => {
      const raw = MOCK_BUDGETS.vendorReactRaw + KB;
      const gzip = MOCK_BUDGETS.vendorReactGzip - KB;
      const result = evaluateChunk('vendor-react-hash.js', raw, gzip, true, MOCK_BUDGETS);

      expect(result.passed).toBe(false);
      expect(result.notes).toContain(`raw > ${formatSize(MOCK_BUDGETS.vendorReactRaw)}`);
    });

    it('evaluates generic chunk against general raw ceiling', () => {
      const rawPassing = MOCK_BUDGETS.maxChunkRaw - KB;
      const passingResult = evaluateChunk('feature-page.js', rawPassing, 5 * KB, true, MOCK_BUDGETS);

      expect(passingResult.passed).toBe(true);
      expect(passingResult.threshold).toBe(`raw <= ${formatSize(MOCK_BUDGETS.maxChunkRaw)}`);
      expect(passingResult.notes).toBeUndefined();

      const rawFailing = MOCK_BUDGETS.maxChunkRaw + KB;
      const failingResult = evaluateChunk('feature-page.js', rawFailing, 5 * KB, true, MOCK_BUDGETS);

      expect(failingResult.passed).toBe(false);
      expect(failingResult.notes).toContain(`raw > ${formatSize(MOCK_BUDGETS.maxChunkRaw)}`);
    });

    it('exempts opencv chunk when allowOpencv is true', () => {
      const result = evaluateChunk('opencv-chunk.js', 10000 * KB, 2500 * KB, true, MOCK_BUDGETS);

      expect(result.passed).toBe(true);
      expect(result.threshold).toBe('exempt (OpenCV)');
      expect(result.notes).toContain('OpenCV chunk exempted');
    });

    it('enforces raw ceiling on opencv chunk when allowOpencv is false', () => {
      const result = evaluateChunk('opencv-chunk.js', MOCK_BUDGETS.maxChunkRaw + KB, 2500 * KB, false, MOCK_BUDGETS);

      expect(result.passed).toBe(false);
      expect(result.notes).toContain(`raw > ${formatSize(MOCK_BUDGETS.maxChunkRaw)}`);
    });

    it('uses default BUDGETS when custom budgets are omitted', () => {
      const raw = BUDGETS.maxChunkRaw - KB;
      const result = evaluateChunk('modal-dialog.js', raw, 2 * KB);

      expect(result.passed).toBe(true);
      expect(result.threshold).toBe(`raw <= ${formatSize(BUDGETS.maxChunkRaw)}`);
    });
  });

  describe('renderAsciiTable', () => {
    it('renders a formatted ASCII table with headers, values, and status tags', () => {
      const evaluations = [
        evaluateChunk('entry.js', 10 * KB, 4 * KB, true, MOCK_BUDGETS),
        evaluateChunk('huge.js', MOCK_BUDGETS.maxChunkRaw + KB, 20 * KB, true, MOCK_BUDGETS),
      ];

      const table = renderAsciiTable(evaluations);

      expect(table).toContain('Chunk File');
      expect(table).toContain('Raw Size');
      expect(table).toContain('Gzip Size');
      expect(table).toContain('Threshold');
      expect(table).toContain('Status');
      expect(table).toContain('entry.js');
      expect(table).toContain('huge.js');
      expect(table).toContain('PASS');
      expect(table).toContain('FAIL');
    });
  });

  describe('BUDGETS configuration contract', () => {
    it('defines positive numeric thresholds for all required budgets', () => {
      expect(BUDGETS.entryGzip).toBeGreaterThan(0);
      expect(BUDGETS.vendorReactGzip).toBeGreaterThan(0);
      expect(BUDGETS.vendorReactRaw).toBeGreaterThan(0);
      expect(BUDGETS.maxChunkRaw).toBeGreaterThan(0);
    });
  });
});
