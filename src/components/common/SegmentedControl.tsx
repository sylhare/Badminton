import React from 'react';

import { cx } from './cx';

interface SegmentedControlProps<T extends string | number> {
  options: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
  label: (value: T) => React.ReactNode;
  testIdFor: (value: T) => string;
  containerTestId?: string;
  /** Class-name prefix: `${variant}-pills` / `${variant}-pill` / `${variant}-pill-active`. */
  variant?: string;
}

/** A row of mutually-exclusive pill buttons; the selected one gets the active class. */
export function SegmentedControl<T extends string | number>({
  options,
  selected,
  onSelect,
  label,
  testIdFor,
  containerTestId,
  variant = 'format',
}: SegmentedControlProps<T>): React.ReactElement {
  return (
    <div className={`${variant}-pills`} data-testid={containerTestId}>
      {options.map(value => (
        <button
          key={value}
          className={cx(`${variant}-pill`, value === selected && `${variant}-pill-active`)}
          onClick={() => onSelect(value)}
          data-testid={testIdFor(value)}
        >
          {label(value)}
        </button>
      ))}
    </div>
  );
}
