import { useState } from 'react';

import type { SetScore, TournamentMatch } from '../../tournament/types';

type MatchResultFn = (matchId: string, winner: 1 | 2, sets?: SetScore[]) => void;

interface UseMatchModalResult {
  modalMatch: TournamentMatch | null;
  pendingWinner: 1 | 2 | null;
  handleTeamClick: (match: TournamentMatch, teamNumber: 1 | 2) => void;
  handleModalConfirm: (winner: 1 | 2, sets: SetScore[]) => void;
  handleModalCancel: () => void;
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

  return {
    modalMatch: pending?.match ?? null,
    pendingWinner: pending?.winner ?? null,
    handleTeamClick,
    handleModalConfirm,
    handleModalCancel,
  };
}
