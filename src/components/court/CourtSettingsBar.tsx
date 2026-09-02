import React from 'react';
import { ArrowsLeftRight } from '@phosphor-icons/react';

import { MAX_COURTS, MIN_COURTS } from './courtCountUtils';

interface CourtSettingsBarProps {
  courtInputValue: string;
  onCourtsChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onCourtsBlur: () => void;
  canRearrange: boolean;
  isEditMode: boolean;
  onToggleEditMode: () => void;
}

const CourtSettingsBar: React.FC<CourtSettingsBarProps> = ({
  courtInputValue,
  onCourtsChange,
  onCourtsBlur,
  canRearrange,
  isEditMode,
  onToggleEditMode,
}) => (
  <div className="court-settings-inline">
    <div className="court-input-group">
      <label htmlFor="courts">Courts:</label>
      <input
        id="courts"
        type="number"
        min={MIN_COURTS}
        max={MAX_COURTS}
        value={courtInputValue}
        onChange={onCourtsChange}
        onBlur={onCourtsBlur}
        className="court-input"
        data-testid="court-count-input"
      />
    </div>

    {canRearrange && (
      <button
        onClick={onToggleEditMode}
        className={`rearrange-button ${isEditMode ? 'active' : ''}`}
        data-testid="rearrange-button"
        aria-pressed={isEditMode}
        data-tooltip="Drag a player onto another to swap them between teams, courts and the bench — or tap two players."
      >
        <ArrowsLeftRight size={16} weight="bold" />
        Rearrange players
      </button>
    )}
  </div>
);

export default CourtSettingsBar;
