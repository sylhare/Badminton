import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isOcrSupported, recognizePlayerNames } from '../utils/ocrEngine';

interface UseImageOcrOptions {
  onPlayersExtracted: (players: string[]) => void;
}

export function useImageOcr({ onPlayersExtracted }: UseImageOcrOptions): {
  isSupported: boolean;
  isProcessing: boolean;
  progress: number;
  processImage: (file: File) => Promise<void>;
} {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const isSupported = isOcrSupported();

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
      alert(t('ocr.failed'));
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return { isSupported, isProcessing, progress, processImage };
}