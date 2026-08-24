import React, { useState } from 'react';

import type { SetScore, TournamentMatch } from '../../tournament/types';
import ScoreInputModal from '../modals/ScoreInputModal';

type MatchResultFn = (matchId: string, winner: 1 | 2, sets?: SetScore[]) => void;

interface UseMatchModalResult {
  modalMatch: TournamentMatch | null;
  pendingWinner: 1 | 2 | null;
  handleTeamClick: (match: TournamentMatch, teamNumber: 1 | 2) => void;
  handleModalConfirm: (winner: 1 | 2, sets: SetScore[]) => void;
  handleModalCancel: () => void;
  /** The score-input modal wired to this hook; render it once in the matches view. */
  scoreModal: (bestOf: number, setSize?: number) => React.ReactNode;
}

export function useMatchModal(onMatchResult: MatchResultFn): UseMatchModalResult {
  const [pending, setPending] = useState<{ match: TournamentMatch; winner: 1 | 2 } | null>(null);

  const handleTeamClick = (match: TournamentMatch, teamNumber: 1 | 2) => {
    if (match.winner === teamNumber) {
      onMatchResult(match.id, teamNumber);
      return;
    }
    setPending({ match, winner: teamNumber });
  };

  const handleModalConfirm = (winner: 1 | 2, sets: SetScore[]) => {
    if (!pending) return;
    onMatchResult(pending.match.id, winner, sets);
    setPending(null);
  };

  const handleModalCancel = () => {
    setPending(null);
  };

  const scoreModal = (bestOf: number, setSize?: number) => (
    <ScoreInputModal
      isOpen={pending !== null}
      winnerTeam={pending?.winner ?? 1}
      team1Players={pending?.match.team1.players ?? []}
      team2Players={pending?.match.team2.players ?? []}
      bestOf={bestOf}
      setSize={setSize}
      onConfirm={handleModalConfirm}
      onCancel={handleModalCancel}
    />
  );

  return {
    modalMatch: pending?.match ?? null,
    pendingWinner: pending?.winner ?? null,
    handleTeamClick,
    handleModalConfirm,
    handleModalCancel,
    scoreModal,
  };
}
