import React from 'react';

import type { Player } from '../../types';

import type { SlotBinding } from './edit/slotBinding';
import { TeamPlayerList } from './team';

interface BenchSectionProps {
  benchedPlayers: Player[];
  isAnimating: boolean;
  slotBinding?: SlotBinding;
  onViewBenchCounts?: () => void;
}

const BenchSection: React.FC<BenchSectionProps> = ({
  benchedPlayers,
  isAnimating,
  slotBinding,
  onViewBenchCounts,
}) => (
  <div className={`bench-section ${isAnimating ? 'animating-blur' : ''}`}>
    <div className="bench-header">
      🪑 Bench ({benchedPlayers.length} player{benchedPlayers.length !== 1 ? 's' : ''})
    </div>
    <div className="bench-players">
      <TeamPlayerList
        players={benchedPlayers}
        className="bench-player"
        slotBinding={slotBinding}
      />
    </div>
    {onViewBenchCounts && (
      <button
        onClick={onViewBenchCounts}
        className="view-bench-counts-button"
        data-testid="view-bench-counts-button"
      >
        View bench counts &amp; manage
      </button>
    )}
  </div>
);

export default BenchSection;
