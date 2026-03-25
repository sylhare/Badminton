import React, { useState } from 'react';

import type { TournamentMatch } from '../../../tournament/types';
import { EliminationTournament } from '../../../tournament/EliminationTournament';
import { computeWBTree, computeCBTree, roundLabel } from '../../../tournament/bracketTree';
import ScoreInputModal from '../../modals/ScoreInputModal';

import BracketColumn, { CARD_HEIGHT, COLUMN_GAP, COLUMN_WIDTH } from './BracketColumn';
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
  const cbTree = computeCBTree(cbSeeds, cbMatches);

  const totalWBRounds = wbTree.length;
  const totalCBRounds = cbTree.length;

  // Height for WB bracket: bracketSize slots × CARD_HEIGHT
  const wbHeight = bracketSize * CARD_HEIGHT + 40; // +40 for header
  // Height for CB bracket
  const cbBracketSize = cbSeeds.length > 0 ? Math.pow(2, Math.ceil(Math.log2(cbSeeds.length))) : 0;
  const cbHeight = cbBracketSize > 0 ? cbBracketSize * CARD_HEIGHT + 40 : 0;

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
            // Compute column top offset in the absolute container
            const colTop = 40; // below header area
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
                  totalRounds={totalWBRounds}
                  label={label}
                  onTeamClick={handleTeamClick}
                />
                {roundIdx < wbTree.length - 1 && (
                  <BracketConnectors
                    fromNodes={nodes}
                    toNodes={wbTree[roundIdx + 1]}
                    fromRound={round}
                    toRound={round + 1}
                    totalHeight={wbHeight - colTop}
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
                    totalRounds={totalCBRounds}
                    label={label}
                    onTeamClick={handleTeamClick}
                  />
                  {roundIdx < cbTree.length - 1 && (
                    <BracketConnectors
                      fromNodes={nodes}
                      toNodes={cbTree[roundIdx + 1]}
                      fromRound={round}
                      toRound={round + 1}
                      totalHeight={cbHeight - 40}
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
