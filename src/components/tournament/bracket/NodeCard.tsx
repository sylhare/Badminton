import React from 'react';

import { usePlayers } from '../../../hooks/usePlayers';
import type { TournamentMatch } from '../../../types/tournament';
import Tournament from '../../../tournament/Tournament';

import type { BracketNode } from '../../../tournament/bracket/types';
import { CW, MH } from '../../../tournament/bracket/types';

interface NodeCardProps {
  node: BracketNode;
  top: number;
  left: number;
  onTeamClick: (match: TournamentMatch, team: 1 | 2) => void;
}

export function NodeCard({ node, top, left, onTeamClick }: NodeCardProps) {
  const { players } = usePlayers();
  const style = { position: 'absolute' as const, top, left, width: CW, height: MH };

  if (node.type === 'empty') {
    return <div style={style} />;
  }

  if (node.type === 'bye-advance') {
    return (
      <div className="bracket-match bracket-match-bye" style={style}>
        <div className="bracket-team bracket-team-bye">
          {node.team1 ? Tournament.formatTeamName(node.team1, players) : 'TBD'}
        </div>
        <div className="bracket-team bracket-team-tbd">BYE</div>
      </div>
    );
  }

  if (node.type === 'tbd') {
    return (
      <div className="bracket-match" style={style}>
        <div className="bracket-team bracket-team-tbd">TBD</div>
        <div className="bracket-team bracket-team-tbd">TBD</div>
      </div>
    );
  }

  const match = node.match!;
  const w = match.winner;
  let team1Class = '';
  if (w === 1) team1Class = ' bracket-team-winner';
  else if (w === 2) team1Class = ' bracket-team-loser';
  let team2Class = '';
  if (w === 2) team2Class = ' bracket-team-winner';
  else if (w === 1) team2Class = ' bracket-team-loser';
  return (
    <div
      className={`bracket-match${w ? ' bracket-match-done' : ''}`}
      style={style}
      data-testid={`bracket-match-${match.id}`}
    >
      <div
        className={`bracket-team${team1Class}`}
        data-testid={`bracket-team-1-${match.id}`}
        onClick={() => (!w || w === 1) ? onTeamClick(match, 1) : undefined}
      >
        {Tournament.formatTeamName(match.team1, players)}
        {match.score && w === 1 && <span className="bracket-score">{match.score.team1}–{match.score.team2}</span>}
      </div>
      <div
        className={`bracket-team${team2Class}`}
        data-testid={`bracket-team-2-${match.id}`}
        onClick={() => (!w || w === 2) ? onTeamClick(match, 2) : undefined}
      >
        {Tournament.formatTeamName(match.team2, players)}
        {match.score && w === 2 && <span className="bracket-score">{match.score.team2}–{match.score.team1}</span>}
      </div>
    </div>
  );
}
