import React from 'react';

import Modal from './Modal';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = false,
}) => {
  return (
    <Modal isOpen={isOpen} title={title} onClose={onCancel} testId="confirm-modal">
      <div className="modal-body">
        <p>{message}</p>
      </div>

      <div className="modal-footer">
        <button className="button button-secondary" onClick={onCancel}>
          {cancelText}
        </button>
        <button
          className={`button ${isDestructive ? 'button-danger' : 'button-primary'}`}
          onClick={onConfirm}
          data-testid="confirm-modal-confirm"
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
