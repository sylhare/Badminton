import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Player } from '../../types';
import { DEFAULT_LEVEL } from '../../types';
import { Tooltip } from '../Tooltip';
import { SegmentedControl } from '../common/SegmentedControl';

import Modal from './Modal';

interface PlayerEditModalProps {
  player: Player | null;
  isOpen: boolean;
  onSave: (id: string, gender: Player['gender'], level: number) => void;
  onCancel: () => void;
}

const PlayerEditModal: React.FC<PlayerEditModalProps> = ({
  player,
  isOpen,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [gender, setGender] = useState<Player['gender']>('Unknown');
  const [level, setLevel] = useState<number>(50);

  useEffect(() => {
    if (player) {
      setGender(player.gender ?? 'Unknown');
      setLevel(player.level ?? DEFAULT_LEVEL);
    }
  }, [player]);

  if (!player) return null;

  const handleSave = () => {
    onSave(player.id, gender, level);
  };

  const genderLabel = (g: 'F' | 'M' | 'Unknown') => {
    if (g === 'F') return t('modals.playerEdit.genderOptions.female');
    if (g === 'M') return t('modals.playerEdit.genderOptions.male');
    return t('modals.playerEdit.genderOptions.unknown');
  };

  return (
    <Modal isOpen={isOpen} title={player.name} onClose={onCancel} testId="player-edit-modal" closeButtonTestId="player-edit-modal-close">
      <div className="modal-body">
        <div className="player-edit-field">
          <label className="player-edit-label">
            {t('modals.playerEdit.gender')}
            <Tooltip testId="gender" text={t('modals.playerEdit.genderTooltip')} />
          </label>
          <SegmentedControl
            variant="gender"
            options={['F', 'M', 'Unknown'] as const}
            selected={gender ?? 'Unknown'}
            onSelect={setGender}
            label={genderLabel}
            testIdFor={g => `gender-pill-${g}`}
          />
        </div>

        <div className="player-edit-field">
          <label className="player-edit-label">
            {t('modals.playerEdit.level', { level })}
            <Tooltip testId="level" text={t('modals.playerEdit.levelTooltip')} />
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            className="level-slider"
            data-testid="level-slider"
          />
        </div>
      </div>

      <div className="modal-footer">
        <button className="button button-secondary" onClick={onCancel} data-testid="player-edit-cancel">
          {t('modals.playerEdit.cancel')}
        </button>
        <button className="button button-primary" onClick={handleSave} data-testid="player-edit-save">
          {t('modals.playerEdit.save')}
        </button>
      </div>
    </Modal>
  );
};

export default PlayerEditModal;
