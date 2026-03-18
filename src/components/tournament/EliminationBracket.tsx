import React, { useState } from 'react';

import type { SEBracket, TournamentMatch, TournamentTeam } from '../../types/tournament';
import Tournament from '../../utils/Tournament';
import ScoreInputModal from '../modals/ScoreInputModal';
import './EliminationBracket.css';

interface Props {
  matches: TournamentMatch[];
  teams: TournamentTeam[];
  seBracket: SEBracket;
  onMatchResult: (matchId: string, winner: 1 | 2, score?: { team1: number; team2: number }) => void;
}

// Layout constants
const MH = 64;        // match box height in px
const MG = 12;        // gap between adjacent match boxes
const SH = MH + MG;  // slot height (one unit of the bracket grid)
const CW = 176;       // column width (match box)
const CN = 36;        // connector strip width between columns

// Returns the top position (px) of a match box within the bracket.
// roundIdx: 0-based round index; matchIdx: 0-based within that round.
// Each subsequent round doubles the slot size (binary tree centering).
function wbTop(roundIdx: number, matchIdx: number): number {
  const slots = 1 << roundIdx;
  return matchIdx * slots * SH + ((slots - 1) * SH) / 2;
}

// ─── BracketNode ──────────────────────────────────────────────────────────────

interface BracketNode {
  type: 'match' | 'bye-advance' | 'tbd';
  match?: TournamentMatch;
  team1: TournamentTeam | null;
  team2: TournamentTeam | null;
}

function computeBracketTree(
  seBracket: SEBracket,
  teams: TournamentTeam[],
  matches: TournamentMatch[],
): BracketNode[][] {
  const { size, seeding } = seBracket;
  const totalRounds = Math.log2(size);
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const nodes: BracketNode[][] = [];

  // R1: derive from seeding pairs
  const r1Nodes: BracketNode[] = [];
  for (let i = 0; i < size / 2; i++) {
    const t1Id = seeding[2 * i];
    const t2Id = seeding[2 * i + 1];
    if (t1Id === null || t2Id === null) {
      const advancingId = t1Id ?? t2Id;
      r1Nodes.push({
        type: 'bye-advance',
        team1: advancingId ? (teamMap.get(advancingId) ?? null) : null,
        team2: null,
      });
    } else {
      const match = matches.find(
        m => m.round === 1 &&
          ((m.team1.id === t1Id && m.team2.id === t2Id) ||
           (m.team1.id === t2Id && m.team2.id === t1Id)),
      );
      r1Nodes.push(
        match
          ? { type: 'match', match, team1: match.team1, team2: match.team2 }
          : { type: 'tbd', team1: null, team2: null },
      );
    }
  }
  nodes.push(r1Nodes);

  // R2+: derive team1/team2 from parent node advancers
  const getAdvancer = (node: BracketNode): TournamentTeam | null => {
    if (node.type === 'bye-advance') return node.team1;
    if (node.type === 'match' && node.match) {
      if (node.match.winner === 1) return node.match.team1;
      if (node.match.winner === 2) return node.match.team2;
    }
    return null;
  };

  for (let r = 1; r < totalRounds; r++) {
    const prevNodes = nodes[r - 1];
    const curCount = size >> (r + 1);
    const curNodes: BracketNode[] = [];

    for (let i = 0; i < curCount; i++) {
      const t1 = getAdvancer(prevNodes[2 * i]);
      const t2 = getAdvancer(prevNodes[2 * i + 1]);

      if (t1 && t2) {
        const match = matches.find(
          m => m.round === r + 1 &&
            ((m.team1.id === t1.id && m.team2.id === t2.id) ||
             (m.team1.id === t2.id && m.team2.id === t1.id)),
        );
        curNodes.push(
          match
            ? { type: 'match', match, team1: match.team1, team2: match.team2 }
            : { type: 'tbd', team1: t1, team2: t2 },
        );
      } else {
        curNodes.push({ type: 'tbd', team1: null, team2: null });
      }
    }
    nodes.push(curNodes);
  }

  return nodes;
}

// ─── NodeCard ─────────────────────────────────────────────────────────────────

interface NodeCardProps {
  node: BracketNode;
  top: number;
  left: number;
  onTeamClick: (match: TournamentMatch, team: 1 | 2) => void;
}

function NodeCard({ node, top, left, onTeamClick }: NodeCardProps) {
  const style = { position: 'absolute' as const, top, left, width: CW, height: MH };

  if (node.type === 'bye-advance') {
    return (
      <div className="bracket-match bracket-match-bye" style={style}>
        <div className="bracket-team bracket-team-bye">
          {node.team1 ? Tournament.formatTeamName(node.team1) : 'TBD'}
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

  // type === 'match'
  const match = node.match!;
  const w = match.winner;
  return (
    <div
      className={`bracket-match${w ? ' bracket-match-done' : ''}`}
      style={style}
      data-testid={`bracket-match-${match.id}`}
    >
      <div
        className={`bracket-team${w === 1 ? ' bracket-team-winner' : w === 2 ? ' bracket-team-loser' : ''}`}
        onClick={() => (!w || w === 1) ? onTeamClick(match, 1) : undefined}
      >
        {Tournament.formatTeamName(match.team1)}
        {match.score && w === 1 && <span className="bracket-score">{match.score.team1}–{match.score.team2}</span>}
      </div>
      <div
        className={`bracket-team${w === 2 ? ' bracket-team-winner' : w === 1 ? ' bracket-team-loser' : ''}`}
        onClick={() => (!w || w === 2) ? onTeamClick(match, 2) : undefined}
      >
        {Tournament.formatTeamName(match.team2)}
        {match.score && w === 2 && <span className="bracket-score">{match.score.team2}–{match.score.team1}</span>}
      </div>
    </div>
  );
}

// ─── BracketConnectors (SVG) ──────────────────────────────────────────────────

interface ConnectorsProps {
  fromTops: number[];
  toTops: number[];
  height: number;
  left: number;
}

function BracketConnectors({ fromTops, toTops, height, left }: ConnectorsProps) {
  const lines: React.ReactNode[] = [];
  const xMid = CN / 2;

  // Always 2-to-1 (binary bracket)
  toTops.forEach((destY, i) => {
    const y1 = fromTops[2 * i] + MH / 2;
    const y2 = (fromTops[2 * i + 1] ?? fromTops[2 * i]) + MH / 2;
    const ym = destY + MH / 2;
    lines.push(
      <g key={i}>
        <line x1={0} y1={y1} x2={xMid} y2={y1} />
        <line x1={0} y1={y2} x2={xMid} y2={y2} />
        <line x1={xMid} y1={y1} x2={xMid} y2={y2} />
        <line x1={xMid} y1={ym} x2={CN} y2={ym} />
      </g>,
    );
  });

  return (
    <svg
      className="bracket-connectors"
      style={{ position: 'absolute', left, top: 0, width: CN, height }}
    >
      {lines}
    </svg>
  );
}

// ─── EliminationBracket ───────────────────────────────────────────────────────

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

  const nodes = computeBracketTree(seBracket, teams, matches);
  const r1Count = seBracket.size / 2;
  const totalH = Math.max(r1Count, 1) * SH + MH;
  const totalW = nodes.length * CW + Math.max(nodes.length - 1, 0) * CN;

  const tops = nodes.map((roundNodes, rIdx) =>
    roundNodes.map((_, mIdx) => wbTop(rIdx, mIdx)),
  );

  return (
    <div className="elimination-bracket" data-testid="elimination-bracket">
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
