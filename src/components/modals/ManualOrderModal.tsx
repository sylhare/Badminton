import React, { useEffect, useState } from 'react';

import type { TournamentTeam } from '../../tournament/types';
import { formatTeamName } from '../../tournament/types';

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
  const [ordered, setOrdered] = useState<TournamentTeam[]>(teams);

  useEffect(() => {
    if (isOpen) setOrdered(teams);
  }, [isOpen, teams]);

  return (
    <Modal isOpen={isOpen} title="Set the tie-break order" onClose={onCancel} testId="manual-order-modal">
      <div className="modal-body">
        <p>These teams are tied on every metric — put them in the order they should finish:</p>
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
                  aria-label={`Move ${formatTeamName(team)} up`}
                  data-testid={`manual-order-up-${index}`}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="button button-secondary manual-order-down"
                  disabled={index === ordered.length - 1}
                  onClick={() => setOrdered(prev => move(prev, index, 1))}
                  aria-label={`Move ${formatTeamName(team)} down`}
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
          Cancel
        </button>
        <button
          className="button button-primary"
          onClick={() => onConfirm(ordered.map(team => team.id))}
          data-testid="manual-order-save"
        >
          Save order
        </button>
      </div>
    </Modal>
  );
};

export default ManualOrderModal;
