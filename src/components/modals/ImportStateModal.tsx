import React from 'react';

import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { useTranslation } from '../../i18n';
import type { Locale } from '../../i18n';

import Modal from './Modal';

interface ImportStateModalProps {
  isOpen: boolean;
  currentBackupUrl: string;
  sharedSavedAt?: number;
  currentSavedAt?: number;
  onAccept: () => void;
  onDecline: () => void;
}

function formatTimestamp(ts: number, locale: Locale): string {
  return new Date(ts).toLocaleString(locale === 'ja' ? 'ja-JP' : undefined, {
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
  const { t, locale } = useTranslation();
  const { copied, copy } = useCopyToClipboard();

  const handleCopyBackup = () => copy(currentBackupUrl);

  return (
    <Modal
      isOpen={isOpen}
      title={t('import.title')}
      onClose={onDecline}
      testId="import-state-modal"
      closeOnOverlayClick={false}
    >
      <div className="modal-body">
        <p>{t('import.body')}</p>
        {(sharedSavedAt || currentSavedAt) && (
          <div className="import-state-timestamps">
            {sharedSavedAt && (
              <p data-testid="shared-saved-at">
                {t('import.sharedSavedAt')} <strong>{formatTimestamp(sharedSavedAt, locale)}</strong>
              </p>
            )}
            {currentSavedAt && (
              <p data-testid="current-saved-at">
                {t('import.currentSavedAt')} <strong>{formatTimestamp(currentSavedAt, locale)}</strong>
              </p>
            )}
          </div>
        )}
        {currentBackupUrl && (
          <>
            <p>{t('import.backupHint')}</p>
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
                {copied ? t('common.copied') : t('import.copy')}
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
          {t('import.keepMine')}
        </button>
        <button
          className="button button-primary"
          onClick={onAccept}
          data-testid="import-state-accept"
        >
          {t('import.loadShared')}
        </button>
      </div>
    </Modal>
  );
};

export default ImportStateModal;
