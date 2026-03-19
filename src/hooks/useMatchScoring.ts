import { useState } from 'react';

import type { TournamentMatch } from '../types/tournament';

export function useMatchScoring(
  onMatchResult: (matchId: string, winner: 1 | 2, score?: { team1: number; team2: number }) => void,
) {
  const [modalMatch, setModalMatch] = useState<TournamentMatch | null>(null);
  const [pendingWinner, setPendingWinner] = useState<1 | 2 | null>(null);

  const handleTeamClick = (match: TournamentMatch, team: 1 | 2) => {
    if (match.winner === team) {
      onMatchResult(match.id, team);
      return;
    }
    setModalMatch(match);
    setPendingWinner(team);
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
