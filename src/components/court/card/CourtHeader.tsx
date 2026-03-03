import React from 'react';

interface CourtHeaderProps {
  courtNumber: number;
  matchType?: string;
  isManualCourt?: boolean;
  onRotateTeams?: () => void;
}

const CourtHeader: React.FC<CourtHeaderProps> = ({
  courtNumber,
  matchType,
  isManualCourt = false,
  onRotateTeams,
}) => {
  return (
    <div className="court-header">
      <h3>
        Court {courtNumber}{matchType ? ` - ${matchType}` : ''}
        {isManualCourt && (
          <span className="manual-court-icon" title="Manually assigned court">
            ⚙️
          </span>
        )}
      </h3>
      {onRotateTeams && (
        <button
          className="rotate-teams-button"
          onClick={onRotateTeams}
          title="Rotate team assignment"
          aria-label="Rotate team assignment"
          data-testid="rotate-teams-button"
        >
          ↻
        </button>
      )}
    </div>
  );
};

export default CourtHeader;

