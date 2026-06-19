import React from 'react';

import type { BracketNode } from '../../../tournament/bracketTree';
import type { TournamentMatch } from '../../../tournament/types';

import { BracketMatchNode } from './BracketMatchNode';

const MOBILE_CARD_HEIGHT = 72;

interface BracketRoundsCarouselProps {
  tree: BracketNode[][];
  roundLabel: (round: number, totalRounds: number) => string;
  onTeamClick: (match: TournamentMatch, teamNumber: 1 | 2) => void;
}

/**
 * Mobile layout: one round per horizontally scroll-snapped page (World Cup
 * style). Matches are packed and evenly spaced — no doubling whitespace or
 * connectors — so each card stays large and legible. A sliver of the next
 * round peeks at the edge to hint the swipe.
 */
export const BracketRoundsCarousel: React.FC<BracketRoundsCarouselProps> = ({
  tree,
  roundLabel,
  onTeamClick,
}) => {
  return (
    <div className="bracket-carousel" data-testid="bracket-carousel">
      {tree.map((nodes, roundIdx) => {
        const round = roundIdx + 1;
        const label = roundLabel(round, tree.length);
        const visible = nodes.filter(node => node.type !== 'empty');
        return (
          <div className="bracket-carousel-page" key={round} data-testid={`bracket-carousel-page-${round}`}>
            <div
              className="bracket-column-header"
              data-testid={`bracket-round-label-${label.replace(/\s/g, '-')}`}
            >
              {label}
            </div>
            <div className="bracket-carousel-matches">
              {visible.map(node => (
                <BracketMatchNode
                  key={node.slotIndex}
                  node={node}
                  cardHeight={MOBILE_CARD_HEIGHT}
                  onTeamClick={onTeamClick}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
