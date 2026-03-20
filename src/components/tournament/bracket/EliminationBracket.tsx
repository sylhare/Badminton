import React from 'react';

import { useMatchScoring } from '../../../hooks/useMatchScoring';
import { usePlayers } from '../../../hooks/usePlayers';
import type { EliminationSetup, TournamentMatch, TournamentTeam } from '../../../tournament/types';
import Tournament from '../../../tournament/Tournament';
import {
  computeBracketNodes,
  computeWinnersSeeding,
  computeConsolationSeeding,
} from '../../../tournament/BracketNodes';
import ScoreInputModal from '../../modals/ScoreInputModal';

import './EliminationBracket.css';
import { BracketSection } from './BracketSection';

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

  const wbMatches = matches.filter(m => Tournament.isWinners(m));
  const winners = computeBracketNodes(computeWinnersSeeding(seBracket), wbMatches, teams);

  const consolSeeding = computeConsolationSeeding(seBracket, wbMatches);
  const lbMatches = matches.filter(m => Tournament.isConsolation(m));
  const consolation =
    consolSeeding.length > 0
      ? computeBracketNodes(consolSeeding, lbMatches, teams)
      : { nodes: [], tops: [], connectorTypes: [], totalH: 0, totalW: 0 };

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
