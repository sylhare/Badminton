import React, { useEffect, useState } from 'react';

import type { TournamentTeam } from '../../tournament/types';
import { formatTeamName } from '../../tournament/types';
import { useTranslation } from '../../i18n';

import Modal from './Modal';

interface ManualOrderModalProps {
  isOpen: boolean;
  /** The tied teams, in their current standings order. */
  teams: TournamentTeam[];
  onConfirm: (orderedTeamIds: string[]) => void;
  onCancel: () => void;
}

/** Move the item at `index` by `delta` (±1), returning a new array (or the same if out of bounds). */
function move<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * Manually order teams the standings metrics can't separate (equal wins/points/diffs).
 * The user nudges the tied teams into the finishing order they want; saving persists it
 * as the tie-break.
 */
const ManualOrderModal: React.FC<ManualOrderModalProps> = ({ isOpen, teams, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  const [ordered, setOrdered] = useState<TournamentTeam[]>(teams);

  useEffect(() => {
    if (isOpen) setOrdered(teams);
  }, [isOpen, teams]);

  return (
    <Modal isOpen={isOpen} title={t('tournament.tieBreakTitle')} onClose={onCancel} testId="manual-order-modal">
      <div className="modal-body">
        <p>{t('tournament.tieBreakBody')}</p>
        <ol className="manual-order-list" data-testid="manual-order-list">
          {ordered.map((team, index) => (
            <li key={team.id} className="manual-order-item" data-testid={`manual-order-item-${index}`}>
              <span className="manual-order-position">{index + 1}</span>
              <span className="manual-order-name">{formatTeamName(team)}</span>
              <span className="manual-order-controls">
                <button
                  type="button"
                  className="button button-secondary manual-order-up"
                  disabled={index === 0}
                  onClick={() => setOrdered(prev => move(prev, index, -1))}
                  aria-label={t('tournament.moveUp', { team: formatTeamName(team) })}
                  data-testid={`manual-order-up-${index}`}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="button button-secondary manual-order-down"
                  disabled={index === ordered.length - 1}
                  onClick={() => setOrdered(prev => move(prev, index, 1))}
                  aria-label={t('tournament.moveDown', { team: formatTeamName(team) })}
                  data-testid={`manual-order-down-${index}`}
                >
                  ▼
                </button>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="modal-footer">
        <button className="button button-secondary" onClick={onCancel} data-testid="manual-order-cancel">
          {t('common.cancel')}
        </button>
        <button
          className="button button-primary"
          onClick={() => onConfirm(ordered.map(team => team.id))}
          data-testid="manual-order-save"
        >
          {t('tournament.saveOrder')}
        </button>
      </div>
    </Modal>
  );
};

export default ManualOrderModal;
