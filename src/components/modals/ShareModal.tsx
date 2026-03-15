import React, { useState } from 'react';

import Modal from './Modal';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, shareUrl }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} title="Share Session" onClose={onClose} testId="share-modal">
      <div className="modal-body">
        <p>Share this URL to let others load your current session:</p>
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
          Close
        </button>
        <button
          className="button button-primary"
          onClick={handleCopy}
          data-testid="copy-share-url-button"
        >
          {copied ? 'Copied!' : 'Copy URL'}
        </button>
      </div>
    </Modal>
  );
};

export default ShareModal;
