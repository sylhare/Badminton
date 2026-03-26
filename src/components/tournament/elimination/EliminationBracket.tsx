import React, { useState } from 'react';

import type { TournamentMatch } from '../../../tournament/types';
import { EliminationTournament } from '../../../tournament/EliminationTournament';
import { computeWBTree, computeCBTree, roundLabel } from '../../../tournament/bracketTree';
import ScoreInputModal from '../../modals/ScoreInputModal';

import BracketColumn, { CARD_HEIGHT, COLUMN_GAP, COLUMN_WIDTH, HEADER_HEIGHT } from './BracketColumn';
import BracketConnectors from './BracketConnectors';

import './EliminationBracket.css';

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

  const totalWBRounds = wbTree.length;
  const totalCBRounds = cbTree.length;

  const wbHeight = (bracketSize / 2) * CARD_HEIGHT + HEADER_HEIGHT;
  const cbBracketSize = cbSeeds.length > 0 ? Math.pow(2, Math.ceil(Math.log2(cbSeeds.length))) : 0;
  // Extra CB rounds (when WB has more rounds than the seed-bracket depth) push the last card
  // lower than the standard formula accounts for. Take the max of both extents.
  const cbCardAreaHeight = cbBracketSize > 0
    ? Math.max(
        (cbBracketSize / 2) * CARD_HEIGHT,
        totalCBRounds > 0 ? CARD_HEIGHT * (Math.pow(2, totalCBRounds - 1) + 1) / 2 : 0,
      )
    : 0;
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
      {/* Winners Bracket */}
      <div className="bracket-section" data-testid="wb-section">
        <h3 className="bracket-section-title">Winners Bracket</h3>
        <div
          className="bracket-tree"
          style={{
            position: 'relative',
            height: wbHeight,
            width: totalWBRounds * (COLUMN_WIDTH + COLUMN_GAP),
          }}
        >
          {wbTree.map((nodes, roundIdx) => {
            const round = roundIdx + 1;
            const label = roundLabel(round, totalWBRounds);
            return (
              <div
                key={round}
                style={{
                  position: 'absolute',
                  left: roundIdx * (COLUMN_WIDTH + COLUMN_GAP),
                  top: 0,
                  height: wbHeight,
                }}
              >
                <BracketColumn
                  nodes={nodes}
                  round={round}
                  label={label}
                  onTeamClick={handleTeamClick}
                />
                {roundIdx < wbTree.length - 1 && (
                  <BracketConnectors
                    fromNodes={nodes}
                    toNodes={wbTree[roundIdx + 1]}
                    fromRound={round}
                    toRound={round + 1}
                    totalHeight={wbHeight - HEADER_HEIGHT}
                    headerOffset={HEADER_HEIGHT}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Consolation Bracket */}
      {cbTree.length > 0 && (
        <div className="bracket-section" data-testid="cb-section">
          <h3 className="bracket-section-title">Consolation Bracket</h3>
          <div
            className="bracket-tree"
            style={{
              position: 'relative',
              height: cbHeight,
              width: totalCBRounds * (COLUMN_WIDTH + COLUMN_GAP),
            }}
          >
            {cbTree.map((nodes, roundIdx) => {
              const round = roundIdx + 1;
              const label = roundLabel(round, totalCBRounds);
              return (
                <div
                  key={round}
                  style={{
                    position: 'absolute',
                    left: roundIdx * (COLUMN_WIDTH + COLUMN_GAP),
                    top: 0,
                    height: cbHeight,
                  }}
                >
                  <BracketColumn
                    nodes={nodes}
                    round={round}
                    label={label}
                    onTeamClick={handleTeamClick}
                  />
                  {roundIdx < cbTree.length - 1 && (
                    <BracketConnectors
                      fromNodes={nodes}
                      toNodes={cbTree[roundIdx + 1]}
                      fromRound={round}
                      toRound={round + 1}
                      totalHeight={cbHeight - HEADER_HEIGHT}
                      headerOffset={HEADER_HEIGHT}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Score Input Modal */}
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
