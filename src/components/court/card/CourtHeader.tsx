import React from 'react';

interface CourtHeaderProps {
  courtNumber: number;
  matchType?: string;
  isManualCourt?: boolean;
}

const CourtHeader: React.FC<CourtHeaderProps> = ({
  courtNumber,
  matchType,
  isManualCourt = false,
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
    </div>
  );
};

export default CourtHeader;

