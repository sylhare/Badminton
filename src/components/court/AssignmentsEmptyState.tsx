import React from 'react';

import { cx } from '../common/cx';
import { useTranslation } from '../../i18n';

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
            <strong>{t('court.howItWorksTitle')}</strong> {t('court.howItWorksBody')}
          </>
        ) : (
          t('court.addPlayersFirst')
        )}
      </p>
      <button
        onClick={hasPlayers ? onGenerate : undefined}
        disabled={!hasPlayers}
        className={cx('generate-button', isButtonShaking && 'button-shake')}
        data-testid="generate-assignments-button"
      >
        {t('court.generate')}
      </button>
    </div>
  );
};

export default React.memo(AssignmentsEmptyState);
