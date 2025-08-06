import { createWorker } from 'tesseract.js';

import { preprocessImage } from './imagePreprocess';

export interface OcrOptions {
  /** When running in Node, provide the absolute path to tesseract.js node worker */
  workerPath?: string;
  /** Callback for progress (0–1) */
  onProgress?: (progress: number) => void;
  /** Whether to preprocess image (browser only). Defaults to true in browsers, false in Node. */
  preprocess?: boolean;
}

/**
 * Runs Tesseract OCR on an image (File, Blob or Buffer) and extracts player names.
 * The same parameters are used as in the React hook so results match the app.
 */
export async function recognizePlayerNames(
  image: File | Blob | Buffer,
  { workerPath, onProgress, preprocess }: OcrOptions = {},
): Promise<string[]> {
  const pushProgress = (progress: number) => {
    if (onProgress) {
      onProgress(progress);
    }
  };

  const isBrowser = typeof window !== 'undefined' && !!window.document;
  const shouldPreprocess = preprocess ?? isBrowser;

  pushProgress(0.1);

  // Dynamically import path only in Node to avoid bundler complaints in browser
  const worker: any = await (createWorker as any)('eng', workerPath ? { workerPath } : undefined);

  pushProgress(0.2);

  worker.logger = (m: any) => {
    if (m.status === 'recognizing text') {
      pushProgress(0.6 + (m.progress * 0.4));
    }
  };

  if (typeof worker.setParameters === 'function') {
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ',
      preserve_interword_spaces: '1',
      tessedit_pageseg_mode: '11',
      user_defined_dpi: '300',
    });
  }

  pushProgress(0.3);

  let imageForOCR: any = image;
  if (shouldPreprocess && image instanceof File) {
    try {
      pushProgress(0.35);

      imageForOCR = await preprocessImage(image);

      pushProgress(0.6);
    } catch (err) {
      console.warn('Image preprocessing skipped:', err);
      pushProgress(0.6);
    }
  } else {
    pushProgress(0.6);
  }

  const {
    data: { text },
  } = await worker.recognize(imageForOCR);
  await worker.terminate();

  return extractPlayerNames(text);
}

/**
 * Processes OCR text and extracts player names
 * Remove simple list numbering like "1." or "2)"
 * Skip very short or very long strings
 * Require that at least 70% of the characters are letters (ignores spaces)
 * Split by common separators in case multiple names are on one line
 * @param text Raw OCR text
 * @returns Array of filtered player names
 */
export function extractPlayerNames(text: string): string[] {
  if (!text) {
    return [];
  }

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const found: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/^\s*\d+[.)]?\s*/, '');
    if (line.length < 2 || line.length > 50) continue;

    const letters = (line.match(/[A-Za-z]/g) || []).length;
    if (letters < (line.replace(/\s+/g, '').length) * 0.7) continue;

    const parts = line.split(/[,;|\t]+/);
    for (let part of parts) {
      part = part.trim();
      part = part.replace(/[^A-Za-z\s]/g, '').replace(/\s+/g, ' ').trim();

      if (part.length < 2 || part.length > 25) continue;
      if (!found.some(existing => existing.toLowerCase() === part.toLowerCase())) {
        found.push(part);
      }
    }
  }

  return found;
}