import React, { useState } from 'react';

import type { BracketNode } from '../../../tournament/bracketTree';
import type { TournamentMatch } from '../../../tournament/types';
import { EliminationTournament } from '../../../tournament/EliminationTournament';
import { computeWBTree, computeCBTree, roundLabel } from '../../../tournament/bracketTree';
import ScoreInputModal from '../../modals/ScoreInputModal';

import BracketColumn, { CARD_HEIGHT, COLUMN_GAP, COLUMN_WIDTH, HEADER_HEIGHT } from './BracketColumn';
import BracketConnectors from './BracketConnectors';

import './EliminationBracket.css';

function renderBracketRounds(
  tree: BracketNode[][],
  height: number,
  onTeamClick: (match: TournamentMatch, teamNumber: 1 | 2) => void,
): React.ReactNode {
  return tree.map((nodes, roundIdx) => {
    const round = roundIdx + 1;
    const label = roundLabel(round, tree.length);
    return (
      <div
        key={round}
        style={{
          position: 'absolute',
          left: roundIdx * (COLUMN_WIDTH + COLUMN_GAP),
          top: 0,
          height,
        }}
      >
        <BracketColumn nodes={nodes} round={round} label={label} onTeamClick={onTeamClick} />
        {roundIdx < tree.length - 1 && (
          <BracketConnectors
            fromNodes={nodes}
            toNodes={tree[roundIdx + 1]}
            fromRound={round}
            toRound={round + 1}
            totalHeight={height - HEADER_HEIGHT}
            headerOffset={HEADER_HEIGHT}
          />
        )}
      </div>
    );
  });
}

interface EliminationBracketProps {
  tournament: EliminationTournament;
  onMatchResult: (matchId: string, winner: 1 | 2, score?: { team1: number; team2: number }) => void;
}

const EliminationBracket: React.FC<EliminationBracketProps> = ({ tournament, onMatchResult }) => {
  const [modalMatch, setModalMatch] = useState<TournamentMatch | null>(null);
  const [pendingWinner, setPendingWinner] = useState<1 | 2 | null>(null);

  const teams = tournament.teams();
  const bracketSize = tournament.bracketSize();
  const wbMatches = tournament.wbMatches();
  const cbSeeds = tournament.wbR1Losers();
  const cbMatches = tournament.cbMatches();

  const wbTree = computeWBTree(teams, bracketSize, wbMatches);
  const cbTree = computeCBTree(cbSeeds, cbMatches, bracketSize);

  const wbHeight = (bracketSize / 2) * CARD_HEIGHT + HEADER_HEIGHT;
  const cbBracketSize = cbSeeds.length > 0 ? Math.pow(2, Math.ceil(Math.log2(cbSeeds.length))) : 0;
  const extraRoundHeight = cbTree.length > 0 ? CARD_HEIGHT * (Math.pow(2, cbTree.length - 1) + 1) / 2 : 0;
  const cbCardAreaHeight = cbBracketSize > 0 ? Math.max((cbBracketSize / 2) * CARD_HEIGHT, extraRoundHeight) : 0;
  const cbHeight = cbCardAreaHeight > 0 ? cbCardAreaHeight + HEADER_HEIGHT : 0;

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

  return (
    <div className="elimination-bracket" data-testid="elimination-bracket">
      <div className="bracket-section" data-testid="wb-section">
        <h3 className="bracket-section-title">Winners Bracket</h3>
        <div
          className="bracket-tree"
          style={{
            position: 'relative',
            height: wbHeight,
            width: wbTree.length * (COLUMN_WIDTH + COLUMN_GAP),
          }}
        >
          {renderBracketRounds(wbTree, wbHeight, handleTeamClick)}
        </div>
      </div>

      {cbTree.length > 0 && (
        <div className="bracket-section" data-testid="cb-section">
          <h3 className="bracket-section-title">Consolation Bracket</h3>
          <div
            className="bracket-tree"
            style={{
              position: 'relative',
              height: cbHeight,
              width: cbTree.length * (COLUMN_WIDTH + COLUMN_GAP),
            }}
          >
            {renderBracketRounds(cbTree, cbHeight, handleTeamClick)}
          </div>
        </div>
      )}

      {modalMatch && pendingWinner !== null && (
        <ScoreInputModal
          isOpen
          winnerTeam={pendingWinner}
          team1Players={modalMatch.team1.players}
          team2Players={modalMatch.team2.players}
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
        />
      )}
    </div>
  );
};

export default EliminationBracket;
