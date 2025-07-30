import React, { useRef } from 'react';

import { useImageOcr } from '../hooks/useImageOcr';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { getFirstFile, isImageFile } from '../utils/fileUtils';

interface ImageUploadProps {
  onPlayersExtracted: (players: string[]) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onPlayersExtracted }) => {
  const { isProcessing, progress, processImage } = useImageOcr({ onPlayersExtracted });
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          <div className="progress-container">
            <div
              className="progress-bar"
              style={{ width: `${(progress * 100).toFixed(0)}%` }}
            />
          </div>
          <p>{Math.round(progress * 100)}%</p>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;