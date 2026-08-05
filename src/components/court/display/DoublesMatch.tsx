import React from 'react';

import type { Player } from '../../../types';
import { cx } from '../../common/cx';
import type { SlotBinding } from '../edit/slotBinding';

import TeamDisplay from './TeamDisplay';

interface DoublesMatchProps {
  team1Players: Player[];
  team2Players: Player[];
  winner?: 1 | 2;
  isAnimating?: boolean;
  onTeamClick?: (event: React.MouseEvent, teamNumber: number) => void;
  isClickable?: boolean;
  team1Binding?: SlotBinding;
  team2Binding?: SlotBinding;
}

const DoublesMatch: React.FC<DoublesMatchProps> = ({
  team1Players,
  team2Players,
  winner,
  isAnimating = false,
  onTeamClick,
  isClickable = false,
  team1Binding,
  team2Binding,
}) => {
  const hasTeam2 = team2Players.length > 0;
  return (
    <div className={cx('teams', isAnimating && 'animating-blur')}>
      <TeamDisplay
        teamNumber={1}
        players={team1Players}
        showVsDivider={hasTeam2}
        isWinner={winner === 1}
        onTeamClick={onTeamClick}
        isClickable={isClickable}
        slotBinding={team1Binding}
      />
      {hasTeam2 && (
        <TeamDisplay
          teamNumber={2}
          players={team2Players}
          isWinner={winner === 2}
          onTeamClick={onTeamClick}
          isClickable={isClickable}
          slotBinding={team2Binding}
        />
      )}
    </div>
  );
};

export default DoublesMatch;

