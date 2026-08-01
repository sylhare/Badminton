import React from 'react';

import { GRAPH_LEGEND_LABELS, getColorForCount } from '../../constants/graphColors';

/** Shared occurrence-count legend (1× … 4×+) rendered under the bubble and pairs graphs. */
export function GraphCountLegend(): React.ReactElement {
  return (
    <div className="graph-legend">
      {GRAPH_LEGEND_LABELS.map((label, i) => (
        <div className="legend-item" key={label}>
          <span className="legend-dot" style={{ background: getColorForCount(i + 1) }}></span>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
