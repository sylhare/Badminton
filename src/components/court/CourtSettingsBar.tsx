import React from 'react';
import { ArrowsLeftRight } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

import { cx } from '../common/cx';

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
}) => {
  const { t } = useTranslation();

  return (
    <div className="court-settings-inline">
      <div className="court-input-group">
        <label htmlFor="courts">{t('court.settings.courts')}</label>
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
          className={cx('rearrange-button', isEditMode && 'active')}
          data-testid="rearrange-button"
          aria-pressed={isEditMode}
          data-tooltip={t('court.settings.rearrangeTooltip')}
        >
          <ArrowsLeftRight size={16} weight="bold" />
          {t('court.settings.rearrange')}
        </button>
      )}
    </div>
  );
};

export default React.memo(CourtSettingsBar);
