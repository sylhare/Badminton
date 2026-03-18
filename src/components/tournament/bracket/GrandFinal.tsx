import React from 'react';

import type { TournamentMatch } from '../../../types/tournament';

import { CW, MH, MG } from './types';
import { NodeCard } from './NodeCard';

interface GrandFinalProps {
  gfMatch: TournamentMatch | null;
  onTeamClick: (match: TournamentMatch, team: 1 | 2) => void;
}

export function GrandFinal({ gfMatch, onTeamClick }: GrandFinalProps) {
  if (!gfMatch) {
    return <p className="bracket-pending">Awaiting finalists...</p>;
  }

  const totalH = MH + MG * 2;
  const node = { type: 'match' as const, match: gfMatch, team1: gfMatch.team1, team2: gfMatch.team2 };

  return (
    <div className="bracket-section">
      <div className="bracket-section-scroll">
        <div style={{ position: 'relative', width: CW, height: totalH }}>
          <NodeCard
            node={node}
            top={MG}
            left={0}
            onTeamClick={onTeamClick}
          />
        </div>
      </div>
    </div>
  );
}
