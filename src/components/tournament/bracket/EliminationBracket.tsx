import React from 'react';

import { useMatchScoring } from '../../../hooks/useMatchScoring';
import { usePlayers } from '../../../hooks/usePlayers';
import type { SEBracket, TournamentMatch, TournamentTeam } from '../../../types/tournament';
import ScoreInputModal from '../../modals/ScoreInputModal';

import './EliminationBracket.css';
import { BracketConnectors } from './BracketConnectors';
import { LBBracket } from './LBBracket';
import { CN, CW, MH, SH, wbTop } from './types';
import { computeBracketTree } from './computeBracketTree';
import { computeConsolationTree } from './computeConsolationTree';
import { NodeCard } from './NodeCard';

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

  const wbMatches = matches.filter(m => (m.bracket ?? 'wb') === 'wb');

  const nodes = computeBracketTree(seBracket, teams, wbMatches);
  const consolationNodes = computeConsolationTree(seBracket, matches);
  const r1Count = seBracket.size / 2;
  const totalH = Math.max(r1Count, 1) * SH + MH;
  const totalW = nodes.length * CW + Math.max(nodes.length - 1, 0) * CN;

  const tops = nodes.map((roundNodes, rIdx) =>
    roundNodes.map((_, mIdx) => wbTop(rIdx, mIdx)),
  );

  const isDe = Math.log2(seBracket.size) > 1;

  return (
    <div className="elimination-bracket" data-testid="elimination-bracket">
      {isDe && (
        <h3 className="bracket-section-label">Winners Bracket</h3>
      )}
      <BracketSection {...winners} onTeamClick={handleTeamClick} />

      {hasConsolationBracket && consolation.nodes.length > 0 && (
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
