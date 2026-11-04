import React from 'react';
import { useTranslation } from 'react-i18next';

import { getColorForCount } from '../../constants/graphColors';

/** Shared occurrence-count legend (1× … 4×+) rendered under the bubble and pairs graphs. */
export function GraphCountLegend(): React.ReactElement {
  const { t } = useTranslation();

  const labels = [
    t('stats.graphs.counts.once'),
    t('stats.graphs.counts.twice'),
    t('stats.graphs.counts.threeTimes'),
    t('stats.graphs.counts.fourPlus'),
  ];

  return (
    <div className="graph-legend">
      {labels.map((label, i) => (
        <div className="legend-item" key={label}>
          <span className="legend-dot" style={{ background: getColorForCount(i + 1) }}></span>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
