import React, { useState } from 'react';

import type { TournamentMatch, TournamentTeam } from '../../types/tournament';
import Tournament from '../../utils/Tournament';
import ScoreInputModal from '../modals/ScoreInputModal';
import './EliminationBracket.css';

interface Props {
  matches: TournamentMatch[];
  teams: TournamentTeam[];
  onMatchResult: (matchId: string, winner: 1 | 2, score?: { team1: number; team2: number }) => void;
}

// Layout constants
const MH = 64;        // match box height in px
const MG = 12;        // gap between adjacent match boxes
const SH = MH + MG;  // slot height (one unit of the bracket grid)
const CW = 176;       // column width (match box)
const CN = 36;        // connector strip width between columns

// Returns the top position (px) of a match box within its bracket section.
// roundIdx: 0-based index within WB or LB; matchIdx: 0-based within that round.
// Each subsequent round doubles the slot size (binary tree centering).
function wbTop(roundIdx: number, matchIdx: number): number {
  const slots = 1 << roundIdx;
  return matchIdx * slots * SH + ((slots - 1) * SH) / 2;
}

// Compute LB match top positions accounting for "drop-in" rounds (same count as prev)
// and "pure" rounds (half count of prev).
function computeLBTops(rounds: { matches: TournamentMatch[] }[]): number[][] {
  if (rounds.length === 0) return [];
  const result: number[][] = [];
  // First LB round: evenly spaced, same as WB first-round spacing
  result.push(rounds[0].matches.map((_, i) => i * SH));
  for (let r = 1; r < rounds.length; r++) {
    const prev = result[r - 1];
    const cur = rounds[r].matches;
    const prevCount = rounds[r - 1].matches.length;
    if (cur.length === prevCount) {
      // Drop-in: LB survivors match new WB losers 1-to-1. Keep same vertical positions.
      result.push([...prev]);
    } else {
      // Pure reduction: pairs of prev round → one match, centered between them.
      result.push(
        cur.map((_, i) => {
          const y1 = prev[2 * i] ?? 0;
          const y2 = prev[2 * i + 1] ?? y1;
          return (y1 + y2) / 2;
        }),
      );
    }
  }
  return result;
}

// ─── MatchCard ────────────────────────────────────────────────────────────────

interface MatchCardProps {
  match: TournamentMatch;
  top: number;
  left: number;
  onTeamClick: (match: TournamentMatch, team: 1 | 2) => void;
}

function MatchCard({ match, top, left, onTeamClick }: MatchCardProps) {
  const w = match.winner;
  return (
    <div
      className={`bracket-match${w ? ' bracket-match-done' : ''}`}
      style={{ position: 'absolute', top, left, width: CW, height: MH }}
      data-testid={`bracket-match-${match.id}`}
    >
      <div
        className={`bracket-team${w === 1 ? ' bracket-team-winner' : w === 2 ? ' bracket-team-loser' : ''}`}
        onClick={() => !w || w === 1 ? onTeamClick(match, 1) : undefined}
      >
        {Tournament.formatTeamName(match.team1)}
        {match.score && w === 1 && <span className="bracket-score">{match.score.team1}–{match.score.team2}</span>}
      </div>
      <div
        className={`bracket-team${w === 2 ? ' bracket-team-winner' : w === 1 ? ' bracket-team-loser' : ''}`}
        onClick={() => !w || w === 2 ? onTeamClick(match, 2) : undefined}
      >
        {Tournament.formatTeamName(match.team2)}
        {match.score && w === 2 && <span className="bracket-score">{match.score.team2}–{match.score.team1}</span>}
      </div>
    </div>
  );
}

// ─── BracketConnectors (SVG) ──────────────────────────────────────────────────

interface ConnectorsProps {
  fromTops: number[];  // center-y of source matches (= top + MH/2)
  toTops: number[];    // center-y of dest matches
  height: number;
  left: number;
}

function BracketConnectors({ fromTops, toTops, height, left }: ConnectorsProps) {
  const lines: React.ReactNode[] = [];
  const xMid = CN / 2;

  if (toTops.length === fromTops.length) {
    // 1-to-1 (drop-in LB round): straight horizontal connector
    toTops.forEach((destY, i) => {
      const srcY = fromTops[i];
      lines.push(
        <polyline
          key={i}
          points={`0,${srcY + MH / 2} ${xMid},${srcY + MH / 2} ${xMid},${destY + MH / 2} ${CN},${destY + MH / 2}`}
        />,
      );
    });
  } else {
    // 2-to-1 (binary): ├ connector
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
  }

  return (
    <svg
      className="bracket-connectors"
      style={{ position: 'absolute', left, top: 0, width: CN, height }}
    >
      {lines}
    </svg>
  );
}

// ─── BracketSection ───────────────────────────────────────────────────────────

interface SectionProps {
  label: string;
  rounds: { matches: TournamentMatch[] }[];
  tops: number[][];         // pre-computed tops per round per match
  r1Count: number;          // number of R1 matches (determines section height)
  onTeamClick: (match: TournamentMatch, team: 1 | 2) => void;
}

function BracketSection({ label, rounds, tops, r1Count, onTeamClick }: SectionProps) {
  if (rounds.length === 0) return null;
  const totalH = Math.max(r1Count, 1) * SH + MH;
  const totalW = rounds.length * CW + Math.max(rounds.length - 1, 0) * CN;

  return (
    <div className="bracket-section">
      <h4 className="bracket-section-label">{label}</h4>
      <div className="bracket-section-scroll">
        <div style={{ position: 'relative', width: totalW, height: totalH }}>
          {rounds.map((round, rIdx) => {
            const colLeft = rIdx * (CW + CN);
            const isLast = rIdx === rounds.length - 1;
            return (
              <React.Fragment key={rIdx}>
                {round.matches.map((match, mIdx) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    top={tops[rIdx][mIdx]}
                    left={colLeft}
                    onTeamClick={onTeamClick}
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
  );
}

// ─── EliminationBracket ───────────────────────────────────────────────────────

const EliminationBracket: React.FC<Props> = ({ matches, onMatchResult }) => {
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

  // Group matches by bracket type
  const wbMatches = matches.filter(m => m.bracket === 'winners');
  const lbMatches = matches.filter(m => m.bracket === 'losers');
  const gfMatch = matches.find(m => m.bracket === 'grand-final');

  // Group into rounds (sorted by round number), relative index per section
  const wbRoundNums = Array.from(new Set(wbMatches.map(m => m.round))).sort((a, b) => a - b);
  const lbRoundNums = Array.from(new Set(lbMatches.map(m => m.round))).sort((a, b) => a - b);

  const wbRounds = wbRoundNums.map(r => ({ matches: wbMatches.filter(m => m.round === r) }));
  const lbRounds = lbRoundNums.map(r => ({ matches: lbMatches.filter(m => m.round === r) }));

  const wbR1Count = wbRounds[0]?.matches.length ?? 0;
  const lbR1Count = lbRounds[0]?.matches.length ?? 0;

  // Compute positions
  const wbTops = wbRounds.map((round, rIdx) =>
    round.matches.map((_, mIdx) => wbTop(rIdx, mIdx)),
  );
  const lbTops = computeLBTops(lbRounds);

  return (
    <div className="elimination-bracket" data-testid="elimination-bracket">
      <BracketSection
        label="Winners Bracket"
        rounds={wbRounds}
        tops={wbTops}
        r1Count={wbR1Count}
        onTeamClick={handleTeamClick}
      />

      {lbRounds.length > 0 && (
        <BracketSection
          label="Losers Bracket"
          rounds={lbRounds}
          tops={lbTops}
          r1Count={lbR1Count}
          onTeamClick={handleTeamClick}
        />
      )}

      {gfMatch && (
        <div className="bracket-section">
          <h4 className="bracket-section-label">Grand Final</h4>
          <div style={{ position: 'relative', width: CW, height: MH }}>
            <MatchCard
              match={gfMatch}
              top={0}
              left={0}
              onTeamClick={handleTeamClick}
            />
          </div>
        </div>
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
