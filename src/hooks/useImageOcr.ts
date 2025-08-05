import { useState } from 'react';
import { recognizePlayerNames } from '../utils/ocrEngine';

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

      const playerNames = await recognizePlayerNames(file, {
        onProgress: (p) => setProgress(p),
      });
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