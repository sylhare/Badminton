import React from 'react';

interface FloatingActionButtonProps {
  onClick: () => void;
  hasCollapsedSteps: boolean;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onClick,
  hasCollapsedSteps,
}) => {
  if (!hasCollapsedSteps) {
    return null;
  }

  return (
    <button
      className="floating-action-btn"
      onClick={onClick}
      aria-label="Show collapsed steps and quick actions"
    >
      <span className="fab-icon">☰</span>
    </button>
  );
};

export default FloatingActionButton;
