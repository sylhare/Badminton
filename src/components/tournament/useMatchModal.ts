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
  const [modalMatch, setModalMatch] = useState<TournamentMatch | null>(null);
  const [pendingWinner, setPendingWinner] = useState<1 | 2 | null>(null);

  const handleTeamClick = (match: TournamentMatch, teamNumber: 1 | 2) => {
    if (match.winner === teamNumber) {
      onMatchResult(match.id, teamNumber);
      return;
    }
    setModalMatch(match);
    setPendingWinner(teamNumber);
  };

  const handleModalConfirm = (score: { team1: number; team2: number }) => {
    if (!modalMatch || pendingWinner === null) return;
    onMatchResult(modalMatch.id, pendingWinner, score);
    setModalMatch(null);
    setPendingWinner(null);
  };

  const handleModalCancel = () => {
    setModalMatch(null);
    setPendingWinner(null);
  };

  return { modalMatch, pendingWinner, handleTeamClick, handleModalConfirm, handleModalCancel };
}
