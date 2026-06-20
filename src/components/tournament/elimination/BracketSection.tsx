import React from 'react';

import type { BracketNode } from '../../../tournament/bracketTree';
import type { TournamentMatch } from '../../../tournament/types';
import { useIsMobile } from '../../../hooks/useIsMobile';

import { BracketRoundsCarousel } from './BracketRoundsCarousel';
import { BracketTreeDesktop } from './BracketTreeDesktop';

interface BracketSectionProps {
  title: string;
  testId: string;
  tree: BracketNode[][];
  height: number;
  roundLabel: (round: number, totalRounds: number) => string;
  onTeamClick: (match: TournamentMatch, teamNumber: 1 | 2) => void;
}

/**
 * One labelled bracket section (Winners / Consolation / 3rd Place).
 * Wraps the chosen layout so callers don't repeat the title + container markup.
 */
export const BracketSection: React.FC<BracketSectionProps> = ({
  title,
  testId,
  tree,
  height,
  roundLabel,
  onTeamClick,
}) => {
  const isMobile = useIsMobile();
  return (
    <div className="bracket-section" data-testid={testId}>
      <h3 className="bracket-section-title">{title}</h3>
      {isMobile
        ? <BracketRoundsCarousel tree={tree} roundLabel={roundLabel} onTeamClick={onTeamClick} />
        : <BracketTreeDesktop tree={tree} height={height} roundLabel={roundLabel} onTeamClick={onTeamClick} />
      }
    </div>
  );
};
