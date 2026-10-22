import React from 'react';

import type { Player } from '../../types';
import { cx } from '../common/cx';
import { useTranslation } from '../../i18n';

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
}) => {
  const { t, tp } = useTranslation();

  return (
    <div className={cx('bench-section', isAnimating && 'animating-blur')}>
      <div className="bench-header">
        {tp('court.benchOne', 'court.benchOther', benchedPlayers.length)}
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
          {t('court.viewBenchCounts')}
        </button>
      )}
    </div>
  );
};

export default React.memo(BenchSection);
