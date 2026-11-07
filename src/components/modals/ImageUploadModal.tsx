import React, { useRef, useState } from 'react';
import { Camera, Check } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

import { useImageOcr } from '../../hooks/useImageOcr';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { getFirstFile, isImageFile } from '../../utils/fileUtils';
import { useAnalytics } from '../../hooks/useAnalytics';

import Modal from './Modal';

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
  const { t } = useTranslation();
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

  return (
    <Modal
      isOpen={isOpen}
      title={t('modals.imageUpload.title')}
      onClose={handleClose}
      testId="image-upload-modal"
      className="image-upload-modal"
    >
      <div className="modal-body">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="file-input"
          data-testid="image-file-input"
        />
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
                <p>{t('modals.imageUpload.instructions')}</p>
                <button type="button" className="upload-button">
                  {t('modals.imageUpload.chooseImage')}
                </button>
              </div>
            </div>

            {isProcessing && (
              <div className="processing">
                <p>{t('modals.imageUpload.processing')}</p>
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
                {t('modals.imageUpload.foundPlayers', {
                  count: extractedPlayers.length,
                  plural: extractedPlayers.length !== 1 ? 's' : '',
                })}
              </p>
              <div className="selection-actions">
                <button
                  type="button"
                  className="selection-action-btn"
                  onClick={handleSelectAll}
                  disabled={selectedPlayers.size === extractedPlayers.length}
                >
                  {t('modals.imageUpload.selectAll')}
                </button>
                <button
                  type="button"
                  className="selection-action-btn"
                  onClick={handleDeselectAll}
                  disabled={selectedPlayers.size === 0}
                >
                  {t('modals.imageUpload.deselectAll')}
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
              {t('modals.imageUpload.tryAnotherImage')}
            </button>
          </div>
        )}
      </div>

      {extractedPlayers.length > 0 && (
        <div className="modal-footer">
          <button className="button button-secondary" onClick={handleClose}>
            {t('modals.imageUpload.cancel')}
          </button>
          <button
            className="button button-primary"
            onClick={handleAddPlayers}
            disabled={selectedPlayers.size === 0}
            data-testid="add-extracted-players-button"
          >
            {t('modals.imageUpload.addPlayers', {
              count: selectedPlayers.size,
              plural: selectedPlayers.size !== 1 ? 's' : '',
            })}
          </button>
        </div>
      )}
    </Modal>
  );
};

export default ImageUploadModal;
