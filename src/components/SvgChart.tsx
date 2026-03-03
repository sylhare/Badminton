import React from 'react';

interface SvgChartProps {
  viewBoxWidth: number;
  viewBoxHeight: number;
  children: React.ReactNode;
  ariaLabel?: string;
  /** Max rendered width in px; omit for full container width */
  maxWidth?: number;
}

/**
 * Shared SVG canvas with responsive sizing.
 * Renders a `<svg>` capped at 400 px tall, with a viewBox-preserving aspect ratio.
 * Used by BubbleGraph, PairsGraph, and LevelHistoryGraph to avoid boilerplate.
 */
export function SvgChart({
  viewBoxWidth,
  viewBoxHeight,
  children,
  ariaLabel,
  maxWidth,
}: SvgChartProps): React.ReactElement {
  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      width="100%"
      height={Math.min(400, viewBoxHeight)}
      style={{
        display: 'block',
        maxWidth: maxWidth ? `${maxWidth}px` : undefined,
        margin: '0 auto',
      }}
      aria-label={ariaLabel}
    >
      {children}
    </svg>
  );
}

export default SvgChart;
