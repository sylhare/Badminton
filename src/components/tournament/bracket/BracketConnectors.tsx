import React from 'react';

import { CN, MH } from './bracketLayout';

interface ConnectorsProps {
  fromTops: number[];
  toTops: number[];
  height: number;
  left: number;
}

export function BracketConnectors({ fromTops, toTops, height, left }: ConnectorsProps) {
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
