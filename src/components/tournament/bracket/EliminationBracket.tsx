import React from 'react';

import { useMatchScoring } from '../../../hooks/useMatchScoring';
import { usePlayers } from '../../../hooks/usePlayers';
import type { EliminationSetup, TournamentMatch, TournamentTeam } from '../../../types/tournament';
import ScoreInputModal from '../../modals/ScoreInputModal';

import './EliminationBracket.css';
import { BracketSection } from './BracketSection';
import { computeBracketNodes } from '../../../tournament/bracket/computeBracketNodes';

interface Props {
  matches: TournamentMatch[];
  teams: TournamentTeam[];
  seBracket: EliminationSetup;
  onMatchResult: (matchId: string, winner: 1 | 2, score?: { team1: number; team2: number }) => void;
}

const EliminationBracket: React.FC<Props> = ({ matches, teams, seBracket, onMatchResult }) => {
  const { playersFrom } = usePlayers();
  const { modalMatch, pendingWinner, handleTeamClick, handleModalConfirm, handleModalCancel } =
    useMatchScoring(onMatchResult);

  const winners = computeBracketNodes({ side: 'winners', setup: seBracket }, teams, matches);
  const consolation = computeBracketNodes({ side: 'consolation', setup: seBracket }, teams, matches);
  const hasConsolationBracket = Math.log2(seBracket.size) > 1;

  return (
    <div className="elimination-bracket" data-testid="elimination-bracket">
      {hasConsolationBracket && (
        <h3 className="bracket-section-label">Winners Bracket</h3>
      )}
      <BracketSection {...winners} onTeamClick={handleTeamClick} />

      {hasConsolationBracket && (
        <>
          <h3 className="bracket-section-label">Consolation Bracket</h3>
          <BracketSection {...consolation} onTeamClick={handleTeamClick} />
        </>
      )}

      <ScoreInputModal
        isOpen={modalMatch !== null && pendingWinner !== null}
        winnerTeam={pendingWinner ?? 1}
        team1Players={playersFrom(modalMatch?.team1.playerIds)}
        team2Players={playersFrom(modalMatch?.team2.playerIds)}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
      />
    </div>
  );
};

export default EliminationBracket;
