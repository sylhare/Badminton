import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import * as zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'dist', 'assets');

const KB = 1024;

export const BUDGETS = {
  entryGzip: 40 * KB,
  vendorReactGzip: 110 * KB,
  maxChunkRaw: 500 * KB,
};

export interface ChunkEvaluation {
  file: string;
  rawSize: number;
  gzipSize: number;
  threshold: string;
  passed: boolean;
  notes?: string;
}

export interface CheckSizeResult {
  passed: boolean;
  totalChunks: number;
  passedChunks: number;
  failedChunks: number;
  evaluations: ChunkEvaluation[];
}

export function formatSize(bytes: number): string {
  return `${(bytes / KB).toFixed(2)} kB`;
}

export function evaluateChunk(file: string, rawSize: number, gzipSize: number, allowOpencv = false): ChunkEvaluation {
  const isEntry = /^index(-.*)?\.js$/i.test(file);
  const isVendorReact = /^vendor-react(-.*)?\.js$/i.test(file);
  const isOpenCv = /^opencv(-.*)?\.js$/i.test(file);

  if (isOpenCv && allowOpencv) {
    return {
      file,
      rawSize,
      gzipSize,
      threshold: 'exempt (ALLOW_OPENCV)',
      passed: true,
      notes: 'OpenCV chunk exempted via configuration',
    };
  }

  if (isEntry) {
    const passedGzip = gzipSize <= BUDGETS.entryGzip;
    const passedCeiling = rawSize <= BUDGETS.maxChunkRaw;
    const passed = passedGzip && passedCeiling;
    const failureReasons: string[] = [];
    if (!passedGzip) failureReasons.push(`gzip > ${formatSize(BUDGETS.entryGzip)}`);
    if (!passedCeiling) failureReasons.push(`raw > ${formatSize(BUDGETS.maxChunkRaw)}`);

    return {
      file,
      rawSize,
      gzipSize,
      threshold: `gzip <= ${formatSize(BUDGETS.entryGzip)}`,
      passed,
      notes: failureReasons.length > 0 ? failureReasons.join(', ') : undefined,
    };
  }

  if (isVendorReact) {
    const passedGzip = gzipSize <= BUDGETS.vendorReactGzip;
    const passedCeiling = rawSize <= BUDGETS.maxChunkRaw;
    const passed = passedGzip && passedCeiling;
    const failureReasons: string[] = [];
    if (!passedGzip) failureReasons.push(`gzip > ${formatSize(BUDGETS.vendorReactGzip)}`);
    if (!passedCeiling) failureReasons.push(`raw > ${formatSize(BUDGETS.maxChunkRaw)}`);

    return {
      file,
      rawSize,
      gzipSize,
      threshold: `gzip <= ${formatSize(BUDGETS.vendorReactGzip)}`,
      passed,
      notes: failureReasons.length > 0 ? failureReasons.join(', ') : undefined,
    };
  }

  const passedCeiling = rawSize <= BUDGETS.maxChunkRaw;
  return {
    file,
    rawSize,
    gzipSize,
    threshold: `raw <= ${formatSize(BUDGETS.maxChunkRaw)}`,
    passed: passedCeiling,
    notes: !passedCeiling ? `raw exceeds ceiling of ${formatSize(BUDGETS.maxChunkRaw)}` : undefined,
  };
}

export function renderAsciiTable(evaluations: ChunkEvaluation[]): string {
  const headers = ['Chunk File', 'Raw Size', 'Gzip Size', 'Threshold', 'Status'];
  const rows = evaluations.map(e => [
    e.file,
    formatSize(e.rawSize),
    formatSize(e.gzipSize),
    e.threshold,
    e.passed ? 'PASS' : 'FAIL',
  ]);

  const colWidths = headers.map((header, colIndex) => {
    const maxRowWidth = rows.reduce((max, row) => Math.max(max, (row[colIndex] ?? '').length), 0);
    return Math.max(header.length, maxRowWidth);
  });

  const makeSeparator = (char: string, cross: string): string =>
    `+${colWidths.map(w => char.repeat(w + 2)).join(cross)}+`;

  const formatRow = (cols: string[]): string =>
    `| ${cols.map((col, i) => {
      // Right-align numbers (raw/gzip size), left-align others
      if (i === 1 || i === 2) {
        return col.padStart(colWidths[i] ?? 0);
      }
      return col.padEnd(colWidths[i] ?? 0);
    }).join(' | ')} |`;

  const topBorder = makeSeparator('-', '+');
  const headerLine = formatRow(headers);
  const headerSep = makeSeparator('=', '+');
  const bodyLines = rows.map(formatRow).join('\n');
  const bottomBorder = makeSeparator('-', '+');

  return [topBorder, headerLine, headerSep, bodyLines, bottomBorder].join('\n');
}

export function checkBundleSize(): CheckSizeResult {
  if (!fs.existsSync(ASSETS_DIR)) {
    console.error(`Error: Assets directory not found at ${ASSETS_DIR}`);
    console.error('Please run "pnpm build" before checking bundle sizes.');
    return {
      passed: false,
      totalChunks: 0,
      passedChunks: 0,
      failedChunks: 0,
      evaluations: [],
    };
  }

  const jsFiles = fs.readdirSync(ASSETS_DIR)
    .filter(file => file.endsWith('.js'))
    .sort();

  if (jsFiles.length === 0) {
    console.error(`Error: No .js files found in ${ASSETS_DIR}`);
    return {
      passed: false,
      totalChunks: 0,
      passedChunks: 0,
      failedChunks: 0,
      evaluations: [],
    };
  }

  const allowOpencv = process.env.CHECK_SIZE_ALLOW_OPENCV === 'true' ||
    process.env.ALLOW_OPENCV === 'true' ||
    process.argv.includes('--allow-opencv');

  const evaluations: ChunkEvaluation[] = jsFiles.map(file => {
    const filePath = path.join(ASSETS_DIR, file);
    const content = fs.readFileSync(filePath);
    const rawSize = content.length;
    const gzipSize = zlib.gzipSync(content).length;

    return evaluateChunk(file, rawSize, gzipSize, allowOpencv);
  });

  const passedChunks = evaluations.filter(e => e.passed).length;
  const failedChunks = evaluations.filter(e => !e.passed).length;
  const passed = failedChunks === 0;

  console.log('\nBundle Size Budget Report:');
  console.log(renderAsciiTable(evaluations));
  console.log(`\nSummary: ${evaluations.length} chunk(s) evaluated: ${passedChunks} passed, ${failedChunks} failed.`);

  if (!passed) {
    console.log('\nFailures:');
    for (const e of evaluations.filter(item => !item.passed)) {
      console.log(`  - ${e.file}: ${e.notes ?? 'Threshold exceeded'}`);
    }
  }

  return {
    passed,
    totalChunks: evaluations.length,
    passedChunks,
    failedChunks,
    evaluations,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const result = checkBundleSize();
  process.exit(result.passed ? 0 : 1);
}
