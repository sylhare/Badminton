import React, { useState } from 'react';

import type { SEBracket, TournamentMatch, TournamentTeam } from '../../../types/tournament';
import ScoreInputModal from '../../modals/ScoreInputModal';

import './EliminationBracket.css';
import { BracketConnectors } from './BracketConnectors';
import { LBBracket } from './LBBracket';
import { CW, CN, MH, SH, wbTop } from './types';
import { computeBracketTree } from './computeBracketTree';
import { NodeCard } from './NodeCard';

interface Props {
  matches: TournamentMatch[];
  teams: TournamentTeam[];
  seBracket: SEBracket;
  onMatchResult: (matchId: string, winner: 1 | 2, score?: { team1: number; team2: number }) => void;
}

const EliminationBracket: React.FC<Props> = ({ matches, teams, seBracket, onMatchResult }) => {
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

  const wbMatches = matches.filter(m => (m.bracket ?? 'wb') === 'wb');
  const lbMatches = matches.filter(m => (m.bracket ?? 'wb') === 'lb');

  const nodes = computeBracketTree(seBracket, teams, wbMatches);
  const r1Count = seBracket.size / 2;
  const totalH = Math.max(r1Count, 1) * SH + MH;
  const totalW = nodes.length * CW + Math.max(nodes.length - 1, 0) * CN;

  const tops = nodes.map((roundNodes, rIdx) =>
    roundNodes.map((_, mIdx) => wbTop(rIdx, mIdx)),
  );

  const wbRounds = Math.log2(seBracket.size);
  const isDe = wbRounds > 1;

  return (
    <div className="elimination-bracket" data-testid="elimination-bracket">
      {isDe && (
        <h3 className="bracket-section-label">Battle for 1st &amp; 2nd</h3>
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
          <h3 className="bracket-section-label">Battle for 3rd</h3>
          <LBBracket lbMatches={lbMatches} teams={teams} onTeamClick={handleTeamClick} />
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
