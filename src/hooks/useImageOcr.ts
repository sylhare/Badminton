import { useState } from 'react';
import { createWorker } from 'tesseract.js';

import { extractPlayerNames } from '../utils/ocrTextProcessor';
import { preprocessImage } from '../utils/imagePreprocess';

interface UseImageOcrOptions {
  onPlayersExtracted: (players: string[]) => void;
}

/**
 * Hook that exposes OCR processing for an image file.
 * Provides processing state, progress percentage and a function to invoke OCR.
 */
export function useImageOcr({ onPlayersExtracted }: UseImageOcrOptions): {
  isProcessing: boolean;
  progress: number;
  processImage: (file: File) => Promise<void>;
} {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0); // 0–1

  const processImage = async (file: File) => {
    setIsProcessing(true);
    setProgress(0);
    try {
      const worker = await createWorker({
        logger: m => {
          if (m.status === 'recognizing text') {
            setProgress(m.progress);
          }
        },
      });
      await worker.loadLanguage('eng');
      await worker.initialize('eng');

      if (typeof (worker as any).setParameters === 'function') {
        await (worker as any).setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ',
          preserve_interword_spaces: '1',
          tessedit_pageseg_mode: '6' as any,
          user_defined_dpi: '300',
        });
      }

      let imageForOCR: File | HTMLCanvasElement = file;
      try {
        imageForOCR = await preprocessImage(file);
      } catch (e) {
        console.warn('Image preprocessing skipped:', e);
      }

      const { data: { text } } = await worker.recognize(imageForOCR as any);
      await worker.terminate();

      console.log('OCR Raw text:', text);
      const playerNames = extractPlayerNames(text);
      console.log('Extracted player names:', playerNames);
      onPlayersExtracted(playerNames);
    } catch (error) {
      console.error('OCR processing failed:', error);
      alert('Failed to process image. Please try again or add players manually.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return { isProcessing, progress, processImage };
}