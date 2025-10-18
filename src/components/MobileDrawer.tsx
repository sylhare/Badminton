import React from 'react';
import { StepDefinition } from '../hooks/useStepRegistry';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  steps: StepDefinition[];
  onStepClick: (stepId: number) => void;
}

const MobileDrawer: React.FC<MobileDrawerProps> = ({ 
  isOpen, 
  onClose, 
  steps, 
  onStepClick 
}) => {
  if (!isOpen) {
    return null;
  }

  const collapsedSteps = steps.filter(step => step.isCollapsed);

  const handleStepClick = (stepId: number) => {
    onStepClick(stepId);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="mobile-drawer-overlay" onClick={handleBackdropClick}>
      <div className="mobile-drawer">
        <div className="drawer-header">
          <h3>Quick Access</h3>
          <button 
            className="close-btn" 
            onClick={onClose}
            aria-label="Close drawer"
          >
            ✕
          </button>
        </div>
        
        <div className="drawer-content">
          <div className="drawer-section">
            <h4>Collapsed Steps</h4>
            <div className="step-list">
              {collapsedSteps.map(step => (
                <button
                  key={step.id}
                  className="step-button"
                  onClick={() => handleStepClick(step.id)}
                >
                  <span className="step-icon">📋</span>
                  <span className="step-title">{step.baseTitle}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="drawer-section">
            <h4>Quick Actions</h4>
            <div className="actions-list">
              {steps.flatMap(step => step.actions || []).map((action, index) => (
                <button
                  key={index}
                  className={`action-button ${action.isDestructive ? 'destructive' : ''}`}
                  onClick={() => {
                    action.onClick();
                    onClose();
                  }}
                >
                  <span className="action-icon">{action.icon}</span>
                  <span className="action-label">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileDrawer;
