import React from 'react';

import { clamp } from '../../utils/numberUtils';

interface NumberFieldProps {
  value: number;
  min: number;
  onChange: (value: number) => void;
  testId: string;
  max?: number;
  ariaLabel?: string;
  id?: string;
}

/** A clamped numeric input: parses the entry and clamps it to `[min, max]` before calling `onChange`. */
export const NumberField: React.FC<NumberFieldProps> = ({
  value,
  min,
  onChange,
  testId,
  max,
  ariaLabel,
  id,
}) => (
  <input
    id={id}
    type="number"
    min={min}
    max={max}
    value={value}
    onChange={e => onChange(clamp(parseInt(e.target.value, 10) || min, min, max ?? Infinity))}
    className="court-count-input"
    data-testid={testId}
    aria-label={ariaLabel}
  />
);
