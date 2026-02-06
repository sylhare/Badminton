import React, { useRef, useState } from 'react';
import { X, Camera, Check } from '@phosphor-icons/react';

import { useImageOcr } from '../hooks/useImageOcr';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { getFirstFile, isImageFile } from '../utils/fileUtils';
import { useAnalytics } from '../hooks/useAnalytics';

interface ImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayersAdded: (players: string[]) => void;
}

const ImageUploadModal: React.FC<ImageUploadModalProps> = ({
  isOpen,
  onClose,
  onPlayersAdded,
}) => {
  const [extractedPlayers, setExtractedPlayers] = useState<string[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { trackPlayerAction } = useAnalytics();

  const handlePlayersExtracted = (players: string[]) => {
    setExtractedPlayers(players);
    setSelectedPlayers(new Set(players));
  };

  const { isProcessing, progress, processImage } = useImageOcr({ onPlayersExtracted: handlePlayersExtracted });

  const handleImageUpload = (file: File) => {
    trackPlayerAction('upload_image', { method: 'image-upload' });
    setExtractedPlayers([]);
    setSelectedPlayers(new Set());
    processImage(file);
  };

  const { isDragOver, handleDrop, handleDragOver, handleDragLeave } = useDragAndDrop({
    onFileDropped: handleImageUpload,
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = getFirstFile(event.target.files);
    if (isImageFile(file)) {
      handleImageUpload(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handlePlayerToggle = (playerName: string) => {
    setSelectedPlayers(prev => {
      const next = new Set(prev);
      if (next.has(playerName)) {
        next.delete(playerName);
      } else {
        next.add(playerName);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedPlayers(new Set(extractedPlayers));
  };

  const handleDeselectAll = () => {
    setSelectedPlayers(new Set());
  };

  const handleAddPlayers = () => {
    const playersToAdd = Array.from(selectedPlayers);
    if (playersToAdd.length > 0) {
      trackPlayerAction('add_players', { method: 'image-ocr', count: playersToAdd.length });
      onPlayersAdded(playersToAdd);
      handleClose();
    }
  };

  const handleClose = () => {
    setExtractedPlayers([]);
    setSelectedPlayers(new Set());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose} data-testid="image-upload-modal">
      <div className="modal-content image-upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📸 Import Players from Image</h3>
          <button className="modal-close" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {extractedPlayers.length === 0 ? (
            <>
              <div
                className={`upload-area modal-upload-area ${isDragOver ? 'dragover' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={handleClick}
              >
                <div className="upload-content">
                  <Camera size={48} weight="light" className="upload-icon" />
                  <p>
                    Take a photo or upload an image of your player list.
                    <br />
                    Drag and drop, or click to select.
                  </p>
                  <button type="button" className="upload-button">
                    Choose Image
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="file-input"
                  data-testid="image-file-input"
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
            </>
          ) : (
            <div className="extracted-players-section">
              <div className="extracted-players-header">
                <p className="extracted-count">
                  Found <strong>{extractedPlayers.length}</strong> player{extractedPlayers.length !== 1 ? 's' : ''}
                </p>
                <div className="selection-actions">
                  <button
                    type="button"
                    className="selection-action-btn"
                    onClick={handleSelectAll}
                    disabled={selectedPlayers.size === extractedPlayers.length}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="selection-action-btn"
                    onClick={handleDeselectAll}
                    disabled={selectedPlayers.size === 0}
                  >
                    Deselect all
                  </button>
                </div>
              </div>

              <div className="extracted-players-list">
                {extractedPlayers.map((player, index) => (
                  <label
                    key={`${player}-${index}`}
                    className={`extracted-player-item ${selectedPlayers.has(player) ? 'selected' : ''}`}
                  >
                    <span className="player-checkbox">
                      {selectedPlayers.has(player) && <Check size={14} weight="bold" />}
                    </span>
                    <span className="player-name-text">{player}</span>
                    <input
                      type="checkbox"
                      checked={selectedPlayers.has(player)}
                      onChange={() => handlePlayerToggle(player)}
                      className="hidden-checkbox"
                      data-testid={`extracted-player-${index}`}
                    />
                  </label>
                ))}
              </div>

              <button
                type="button"
                className="try-another-image-btn"
                onClick={handleClick}
              >
                📸 Try another image
              </button>
            </div>
          )}
        </div>

        {extractedPlayers.length > 0 && (
          <div className="modal-footer">
            <button className="button button-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button
              className="button button-primary"
              onClick={handleAddPlayers}
              disabled={selectedPlayers.size === 0}
              data-testid="add-extracted-players-button"
            >
              Add {selectedPlayers.size} Player{selectedPlayers.size !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUploadModal;
