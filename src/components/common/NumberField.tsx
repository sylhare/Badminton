import React from 'react';

interface NumberFieldProps {
  value: number;
  min: number;
  onChange: (value: number) => void;
  testId: string;
  max?: number;
}

/** A clamped numeric input: parses the entry and floors it at `min` before calling `onChange`. */
export const NumberField: React.FC<NumberFieldProps> = ({ value, min, onChange, testId, max }) => (
  <input
    type="number"
    min={min}
    max={max}
    value={value}
    onChange={e => onChange(Math.max(min, parseInt(e.target.value, 10) || min))}
    className="court-count-input"
    data-testid={testId}
  />
);
