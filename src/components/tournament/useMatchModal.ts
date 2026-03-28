import { useState } from 'react';

import type { TournamentMatch } from '../../tournament/types';

type MatchResultFn = (matchId: string, winner: 1 | 2, score?: { team1: number; team2: number }) => void;

interface UseMatchModalResult {
  modalMatch: TournamentMatch | null;
  pendingWinner: 1 | 2 | null;
  handleTeamClick: (match: TournamentMatch, teamNumber: 1 | 2) => void;
  handleModalConfirm: (score: { team1: number; team2: number }) => void;
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

  const handleModalConfirm = (score: { team1: number; team2: number }) => {
    if (!pending) return;
    onMatchResult(pending.match.id, pending.winner, score);
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
