import React, { useState } from 'react';
import { X } from '@phosphor-icons/react';

interface ImportStateModalProps {
  isOpen: boolean;
  currentBackupUrl: string;
  sharedSavedAt?: number;
  currentSavedAt?: number;
  onAccept: () => void;
  onDecline: () => void;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

const ImportStateModal: React.FC<ImportStateModalProps> = ({
  isOpen,
  currentBackupUrl,
  sharedSavedAt,
  currentSavedAt,
  onAccept,
  onDecline,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyBackup = async () => {
    await navigator.clipboard.writeText(currentBackupUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" data-testid="import-state-modal">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Load Shared Session</h3>
          <button className="modal-close" onClick={onDecline}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p>A shared session was found in the URL. Loading it will replace your current session.</p>
          {(sharedSavedAt || currentSavedAt) && (
            <div className="import-state-timestamps">
              {sharedSavedAt && (
                <p data-testid="shared-saved-at">
                  Shared session saved: <strong>{formatTimestamp(sharedSavedAt)}</strong>
                </p>
              )}
              {currentSavedAt && (
                <p data-testid="current-saved-at">
                  Your session saved: <strong>{formatTimestamp(currentSavedAt)}</strong>
                </p>
              )}
            </div>
          )}
          {currentBackupUrl && (
            <>
              <p>Save this link to restore your current session later:</p>
              <div className="share-url-row">
                <input
                  type="text"
                  readOnly
                  value={currentBackupUrl}
                  className="share-url-input"
                  data-testid="import-state-backup-url"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  className="button button-secondary"
                  onClick={handleCopyBackup}
                  data-testid="copy-backup-url-button"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="button button-secondary"
            onClick={onDecline}
            data-testid="import-state-decline"
          >
            Keep my session
          </button>
          <button
            className="button button-primary"
            onClick={onAccept}
            data-testid="import-state-accept"
          >
            Load shared session
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportStateModal;
