import React from 'react';

import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { useTranslation } from '../../i18n';

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
    <Modal isOpen={isOpen} title={t('share.title')} onClose={onClose} testId="share-modal">
      <div className="modal-body">
        <p>{t('share.body')}</p>
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
          {t('common.close')}
        </button>
        <button
          className="button button-primary"
          onClick={handleCopy}
          data-testid="copy-share-url-button"
        >
          {copied ? t('common.copied') : t('share.copyUrl')}
        </button>
      </div>
    </Modal>
  );
};

export default ShareModal;
