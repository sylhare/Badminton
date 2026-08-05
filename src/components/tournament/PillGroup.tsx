import React from 'react';

interface PillGroupProps<T extends string | number> {
  options: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
  label: (value: T) => React.ReactNode;
  testIdFor: (value: T) => string;
  containerTestId?: string;
}

/** A row of mutually-exclusive `format-pill` buttons; the selected one gets the active class. */
export function PillGroup<T extends string | number>({
  options,
  selected,
  onSelect,
  label,
  testIdFor,
  containerTestId,
}: PillGroupProps<T>): React.ReactElement {
  return (
    <div className="format-pills" data-testid={containerTestId}>
      {options.map(value => (
        <button
          key={value}
          className={`format-pill${value === selected ? ' format-pill-active' : ''}`}
          onClick={() => onSelect(value)}
          data-testid={testIdFor(value)}
        >
          {label(value)}
        </button>
      ))}
    </div>
  );
}
