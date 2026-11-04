import React from 'react';
import { useTranslation } from 'react-i18next';

import type { Player } from '../../types';
import { cx } from '../common/cx';

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
  const { t } = useTranslation();

  return (
    <div className={cx('bench-section', isAnimating && 'animating-blur')}>
      <div className="bench-header">
        {benchedPlayers.length === 1
          ? t('bench.titleSingle')
          : t('bench.title', { count: benchedPlayers.length })}
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
          {t('bench.viewCounts')}
        </button>
      )}
    </div>
  );
};

export default React.memo(BenchSection);
