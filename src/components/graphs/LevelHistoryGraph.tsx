import React, { useMemo } from 'react';

import { SvgChart } from './SvgChart';

interface LevelHistoryGraphProps {
  /** playerId -> [levelAfterRound1, levelAfterRound2, ...] */
  levelHistory: Record<string, number[]>;
  getPlayerName: (id: string) => string;
}

const LEVEL_COLORS = [
  '#58a6ff',
  '#7ee787',
  '#ffa657',
  '#f78166',
  '#bc8cff',
  '#d2a8ff',
  '#79c0ff',
  '#56d364',
  '#ff9a6e',
  '#ffb3d1',
] as const;

const MARGIN = { top: 16, right: 90, bottom: 32, left: 36 };
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const INNER_W = CANVAS_WIDTH - MARGIN.left - MARGIN.right;
const INNER_H = CANVAS_HEIGHT - MARGIN.top - MARGIN.bottom;

function toX(round: number, totalRounds: number): number {
  if (totalRounds <= 1) return MARGIN.left + INNER_W / 2;
  return MARGIN.left + ((round - 1) / (totalRounds - 1)) * INNER_W;
}

/**
 * SVG line chart showing player level progression across rounds.
 * Top 10 players (by final level) get distinct colours; others are grey.
 */
export function LevelHistoryGraph({
  levelHistory,
  getPlayerName,
}: LevelHistoryGraphProps): React.ReactElement | null {
  const { topPlayers, greyPlayers, totalRounds, yMin, yMax } = useMemo(() => {
    const entries = Object.entries(levelHistory).filter(([, h]) => h.length > 0);
    if (entries.length === 0) return { topPlayers: [], greyPlayers: [], totalRounds: 0, yMin: 0, yMax: 100 };

    const rounds = Math.max(...entries.map(([, h]) => h.length));

    const allLevels = entries.flatMap(([, h]) => h);
    const rawMin = Math.min(...allLevels);
    const rawMax = Math.max(...allLevels);
    const yMin = Math.max(0, rawMin - 5);
    const yMax = Math.min(100, rawMax + 5);

    entries.sort((a, b) => {
      const aFinal = a[1][a[1].length - 1] ?? 50;
      const bFinal = b[1][b[1].length - 1] ?? 50;
      return bFinal - aFinal;
    });

    const top = entries.slice(0, 10).map(([id, history], idx) => ({
      id,
      history,
      color: LEVEL_COLORS[idx],
      name: getPlayerName(id),
    }));

    const grey = entries.slice(10).map(([id, history]) => ({
      id,
      history,
      color: '#555',
      name: getPlayerName(id),
    }));

    return { topPlayers: top, greyPlayers: grey, totalRounds: rounds, yMin, yMax };
  }, [levelHistory, getPlayerName]);

  if (totalRounds === 0) return null;

  const toY = (level: number): number =>
    MARGIN.top + INNER_H - ((level - yMin) / (yMax - yMin)) * INNER_H;

  const yRange = yMax - yMin;
  const step = Math.max(1, Math.ceil(yRange / 4));
  const firstTick = Math.ceil(yMin / step) * step;
  const yTicks: number[] = [];
  for (let t = firstTick; t <= yMax; t += step) yTicks.push(t);
  if (!yTicks.includes(yMin)) yTicks.unshift(yMin);
  if (!yTicks.includes(yMax)) yTicks.push(yMax);

  const xTicks = Array.from({ length: totalRounds }, (_, i) => i + 1);
  const xLabelStep = Math.max(1, Math.ceil(totalRounds / 10));

  const polylinePoints = (history: number[]): string =>
    history.map((level, i) => `${toX(i + 1, totalRounds)},${toY(level)}`).join(' ');

  return (
    <div className="level-history-graph">
      <SvgChart viewBoxWidth={CANVAS_WIDTH} viewBoxHeight={CANVAS_HEIGHT} maxWidth={CANVAS_WIDTH} ariaLabel="Level progression chart">
        {/* Y gridlines and labels */}
        {yTicks.map(tick => {
          const y = toY(tick);
          return (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                y1={y}
                x2={MARGIN.left + INNER_W}
                y2={y}
                stroke="#333"
                strokeWidth={1}
                strokeDasharray={tick === yMin || tick === yMax ? undefined : '3 3'}
              />
              <text
                x={MARGIN.left - 4}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fill="#8b949e"
                fontSize={10}
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* X gridlines and labels */}
        {xTicks.map(round => {
          const x = toX(round, totalRounds);
          const showLabel = round % xLabelStep === 0 || round === 1;
          return (
            <g key={round}>
              <line
                x1={x}
                y1={MARGIN.top}
                x2={x}
                y2={MARGIN.top + INNER_H}
                stroke="#2a2a2a"
                strokeWidth={1}
              />
              {showLabel && (
                <text
                  x={x}
                  y={MARGIN.top + INNER_H + 14}
                  textAnchor="middle"
                  fill="#8b949e"
                  fontSize={10}
                >
                  {round}
                </text>
              )}
            </g>
          );
        })}

        {/* X axis label */}
        <text
          x={MARGIN.left + INNER_W / 2}
          y={CANVAS_HEIGHT - 2}
          textAnchor="middle"
          fill="#8b949e"
          fontSize={10}
        >
          Round
        </text>

        {/* Grey lines first (below coloured ones) */}
        {greyPlayers.map(({ id, history, color }) => (
          <polyline
            key={id}
            points={polylinePoints(history)}
            fill="none"
            stroke={color}
            strokeWidth={1}
            opacity={0.5}
          />
        ))}

        {/* Top-10 coloured lines */}
        {topPlayers.map(({ id, history, color, name }) => {
          const lastLevel = history[history.length - 1] ?? 50;
          const labelX = toX(history.length, totalRounds) + 4;
          const labelY = toY(lastLevel);
          return (
            <g key={id}>
              <polyline
                points={polylinePoints(history)}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <text
                x={labelX}
                y={labelY}
                dominantBaseline="middle"
                fill={color}
                fontSize={9}
                style={{ pointerEvents: 'none' }}
              >
                {name.length > 8 ? name.slice(0, 7) + '…' : name}
              </text>
            </g>
          );
        })}
      </SvgChart>

      {/* Legend for top-10 players */}
      {topPlayers.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginTop: '8px',
            justifyContent: 'center',
          }}
        >
          {topPlayers.map(({ id, color, name }) => (
            <div
              key={id}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '20px',
                  height: '3px',
                  background: color,
                  borderRadius: '2px',
                  flexShrink: 0,
                }}
              />
              <span style={{ color: '#c9d1d9' }}>{name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LevelHistoryGraph;
