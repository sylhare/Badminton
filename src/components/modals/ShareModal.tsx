import React from 'react';
import { useTranslation } from 'react-i18next';

import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';

import Modal from './Modal';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, shareUrl }) => {
  const { t } = useTranslation();
  const { copied, copy } = useCopyToClipboard();

  const handleCopy = () => copy(shareUrl);

  return (
    <Modal isOpen={isOpen} title={t('modals.share.title')} onClose={onClose} testId="share-modal">
      <div className="modal-body">
        <p>{t('modals.share.description')}</p>
        <input
          type="text"
          readOnly
          value={shareUrl}
          className="share-url-input"
          data-testid="share-url-input"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
      </div>

      <div className="modal-footer">
        <button className="button button-secondary" onClick={onClose}>
          {t('modals.share.close')}
        </button>
        <button
          className="button button-primary"
          onClick={handleCopy}
          data-testid="copy-share-url-button"
        >
          {copied ? t('modals.share.copied') : t('modals.share.copyUrl')}
        </button>
      </div>
    </Modal>
  );
};

export default ShareModal;
