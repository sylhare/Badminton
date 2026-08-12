import React from 'react';

import { useIsMobile } from '../../../hooks/useIsMobile';

import type { BracketView } from './bracketView';
import { BracketRoundsCarousel } from './BracketRoundsCarousel';
import { BracketTreeDesktop } from './BracketTreeDesktop';

interface BracketSectionProps {
  title: string;
  testId: string;
  height: number;
  view: BracketView;
}

/**
 * One labelled bracket section (Winners / Consolation / 3rd Place).
 * Wraps the chosen layout so callers don't repeat the title + container markup.
 */
export const BracketSection: React.FC<BracketSectionProps> = ({
  title,
  testId,
  height,
  view,
}) => {
  const isMobile = useIsMobile();
  return (
    <div className="bracket-section" data-testid={testId}>
      <h3 className="bracket-section-title">{title}</h3>
      {isMobile
        ? <BracketRoundsCarousel view={view} />
        : <BracketTreeDesktop view={view} height={height} />
      }
    </div>
  );
};
