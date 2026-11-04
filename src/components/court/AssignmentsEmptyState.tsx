import React from 'react';
import { useTranslation } from 'react-i18next';

import { cx } from '../common/cx';

interface AssignmentsEmptyStateProps {
  hasAssignments: boolean;
  hasPlayers: boolean;
  isButtonShaking: boolean;
  onGenerate: () => void;
}

const AssignmentsEmptyState: React.FC<AssignmentsEmptyStateProps> = ({
  hasAssignments,
  hasPlayers,
  isButtonShaking,
  onGenerate,
}) => {
  const { t } = useTranslation();

  if (hasAssignments) return null;

  return (
    <div className={hasPlayers ? 'no-assignments-hint' : 'no-players-hint'}>
      <p>
        {hasPlayers ? (
          <>
            <strong>{t('court.empty.howItWorksTitle')}</strong>
            {t('court.empty.howItWorksDescription')}
          </>
        ) : (
          t('court.empty.noPlayers')
        )}
      </p>
      <button
        onClick={hasPlayers ? onGenerate : undefined}
        disabled={!hasPlayers}
        className={cx('generate-button', isButtonShaking && 'button-shake')}
        data-testid="generate-assignments-button"
      >
        {t('court.empty.generateButton')}
      </button>
    </div>
  );
};

export default React.memo(AssignmentsEmptyState);
