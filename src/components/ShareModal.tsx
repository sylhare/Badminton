import React, { useState } from 'react';
import { X } from '@phosphor-icons/react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, shareUrl }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose} data-testid="share-modal">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Share Session</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

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
      </div>
    </div>
  );
};

export default ShareModal;
