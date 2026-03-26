import React from 'react';

import type { BracketNode } from '../../../tournament/bracketTree';
import type { TournamentMatch } from '../../../tournament/types';

interface BracketMatchNodeProps {
  node: BracketNode;
  /** Card height in pixels */
  cardHeight: number;
  onTeamClick: (match: TournamentMatch, teamNumber: 1 | 2) => void;
}

function teamName(match: TournamentMatch, side: 1 | 2): string {
  const team = side === 1 ? match.team1 : match.team2;
  return team.players.map(p => p.name).join(' & ');
}

const BracketMatchNode: React.FC<BracketMatchNodeProps> = ({ node, cardHeight, onTeamClick }) => {
  const halfH = cardHeight / 2;

  if (node.type === 'empty') {
    return <div className="bracket-node bracket-node-empty" style={{ height: cardHeight }} />;
  }

  if (node.type === 'tbd') {
    return (
      <div className="bracket-node bracket-node-tbd" style={{ height: cardHeight }} data-testid="bracket-node-tbd">
        <div className="bracket-team bracket-team-tbd" style={{ height: halfH }}>TBD</div>
        <div className="bracket-team bracket-team-tbd" style={{ height: halfH }}>TBD</div>
      </div>
    );
  }

  if (node.type === 'bye-advance') {
    const name = node.team ? node.team.players.map(p => p.name).join(' & ') : 'BYE';
    return (
      <div className="bracket-node bracket-node-bye" style={{ height: cardHeight }} data-testid="bracket-node-bye">
        <div className="bracket-team bracket-team-winner" style={{ height: halfH }}>{name}</div>
        <div className="bracket-team bracket-team-bye-label" style={{ height: halfH }}>BYE</div>
      </div>
    );
  }

  const match = node.match!;
  const w = match.winner;

  function teamClass(teamNumber: 1 | 2): string {
    if (w === teamNumber) return 'bracket-team bracket-team-winner';
    if (w !== undefined) return 'bracket-team bracket-team-loser';
    return 'bracket-team';
  }

  return (
    <div className="bracket-node bracket-node-match" style={{ height: cardHeight }} data-testid="bracket-node-match">
      <button
        className={teamClass(1)}
        style={{ height: halfH }}
        onClick={() => onTeamClick(match, 1)}
        data-testid={`bracket-team-1-${match.id}`}
      >
        {teamName(match, 1)}
        {w === 1 && <span className="bracket-winner-badge">✓</span>}
      </button>
      <button
        className={teamClass(2)}
        style={{ height: halfH }}
        onClick={() => onTeamClick(match, 2)}
        data-testid={`bracket-team-2-${match.id}`}
      >
        {teamName(match, 2)}
        {w === 2 && <span className="bracket-winner-badge">✓</span>}
      </button>
    </div>
  );
};

export default BracketMatchNode;
