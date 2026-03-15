import React from 'react';
import { X } from '@phosphor-icons/react';

interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  testId: string;
  children: React.ReactNode;
  className?: string;
  closeOnOverlayClick?: boolean;
  closeButtonTestId?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  onClose,
  testId,
  children,
  className,
  closeOnOverlayClick = true,
  closeButtonTestId,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={closeOnOverlayClick ? onClose : undefined}
      data-testid={testId}
    >
      <div
        className={`modal-content${className ? ` ${className}` : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close" data-testid={closeButtonTestId}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default Modal;
