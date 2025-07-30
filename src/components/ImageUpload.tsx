import React, { useRef, useState } from 'react';
import { createWorker } from 'tesseract.js';

import { extractPlayerNames } from '../utils/ocrTextProcessor';
import { getFirstFile, isImageFile } from '../utils/fileUtils';
import { useDragAndDrop } from '../hooks/useDragAndDrop';

interface ImageUploadProps {
  onPlayersExtracted: (players: string[]) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onPlayersExtracted }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = async (file: File) => {
    setIsProcessing(true);
    try {
      const worker = await createWorker({
        logger: m => console.log(m),
      });
      await worker.loadLanguage('eng');
      await worker.initialize('eng');

      const { data: { text } } = await worker.recognize(file);
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
    }
  };

  const { isDragOver, handleDrop, handleDragOver, handleDragLeave } = useDragAndDrop({
    onFileDropped: processImage,
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = getFirstFile(event.target.files);
    if (isImageFile(file)) {
      processImage(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <div
        className={`upload-area ${isDragOver ? 'dragover' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <div className="upload-content">
          <h3>📸 Upload Player List Image</h3>
          <p>
            Take a photo or upload an image of your player list.
            <br />
            Drag and drop an image here, or click to select a file.
          </p>
          <button type="button" className="upload-button">
            Choose Image
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="file-input"
        />
      </div>

      {isProcessing && (
        <div className="processing">
          <p>🔍 Processing image and extracting player names...</p>
          <p>This may take a few moments.</p>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;