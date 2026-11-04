import React from 'react';
import { useTranslation } from 'react-i18next';

import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';

import Modal from './Modal';

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
  const { t } = useTranslation();
  const { copied, copy } = useCopyToClipboard();

  const handleCopyBackup = () => copy(currentBackupUrl);

  return (
    <Modal
      isOpen={isOpen}
      title={t('modals.importState.title')}
      onClose={onDecline}
      testId="import-state-modal"
      closeOnOverlayClick={false}
    >
      <div className="modal-body">
        <p>{t('modals.importState.description')}</p>
        {(sharedSavedAt || currentSavedAt) && (
          <div className="import-state-timestamps">
            {sharedSavedAt && (
              <p data-testid="shared-saved-at">
                {t('modals.importState.sharedSavedAt', { time: formatTimestamp(sharedSavedAt) })}
              </p>
            )}
            {currentSavedAt && (
              <p data-testid="current-saved-at">
                {t('modals.importState.currentSavedAt', { time: formatTimestamp(currentSavedAt) })}
              </p>
            )}
          </div>
        )}
        {currentBackupUrl && (
          <>
            <p>{t('modals.importState.backupPrompt')}</p>
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
                {copied ? t('modals.importState.copied') : t('modals.importState.copy')}
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
          {t('modals.importState.decline')}
        </button>
        <button
          className="button button-primary"
          onClick={onAccept}
          data-testid="import-state-accept"
        >
          {t('modals.importState.accept')}
        </button>
      </div>
    </Modal>
  );
};

export default ImportStateModal;
