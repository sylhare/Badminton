import React from 'react';

import { useMatchScoring } from '../../../hooks/useMatchScoring';
import type { SEBracket, TournamentMatch, TournamentTeam } from '../../../types/tournament';
import ScoreInputModal from '../../modals/ScoreInputModal';

import './EliminationBracket.css';
import { BracketConnectors } from './BracketConnectors';
import { LBBracket } from './LBBracket';
import { CW, CN, MH, SH, wbTop } from './types';
import { computeBracketTree } from './computeBracketTree';
import { computeConsolationTree } from './computeConsolationTree';
import { NodeCard } from './NodeCard';

interface Props {
  matches: TournamentMatch[];
  teams: TournamentTeam[];
  seBracket: SEBracket;
  onMatchResult: (matchId: string, winner: 1 | 2, score?: { team1: number; team2: number }) => void;
}

const EliminationBracket: React.FC<Props> = ({ matches, teams, seBracket, onMatchResult }) => {
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
      <div className="bracket-section">
        <div className="bracket-section-scroll">
          <div style={{ position: 'relative', width: totalW, height: totalH }}>
            {nodes.map((roundNodes, rIdx) => {
              const colLeft = rIdx * (CW + CN);
              const isLast = rIdx === nodes.length - 1;
              return (
                <React.Fragment key={rIdx}>
                  {roundNodes.map((node, nIdx) => (
                    <NodeCard
                      key={nIdx}
                      node={node}
                      top={tops[rIdx][nIdx]}
                      left={colLeft}
                      onTeamClick={handleTeamClick}
                    />
                  ))}
                  {!isLast && (
                    <BracketConnectors
                      fromTops={tops[rIdx]}
                      toTops={tops[rIdx + 1]}
                      height={totalH}
                      left={colLeft + CW}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {isDe && (
        <>
          <h3 className="bracket-section-label">Consolation Bracket</h3>
          <LBBracket nodes={consolationNodes} onTeamClick={handleTeamClick} />
        </>
      )}

      <ScoreInputModal
        isOpen={modalMatch !== null && pendingWinner !== null}
        winnerTeam={pendingWinner ?? 1}
        team1Players={modalMatch?.team1.players ?? []}
        team2Players={modalMatch?.team2.players ?? []}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
      />
    </div>
  );
};

export default EliminationBracket;
