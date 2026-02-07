import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { CourtHeader } from '../../../../src/components/court/card';

describe('CourtHeader', () => {
  it('renders court number correctly', () => {
    render(<CourtHeader courtNumber={1} />);
    expect(screen.getByText(/Court 1/)).toBeInTheDocument();
  });

  it('renders with match type', () => {
    render(<CourtHeader courtNumber={2} matchType="Singles" />);
    expect(screen.getByText(/Court 2 - Singles/)).toBeInTheDocument();
  });

  it('renders with doubles match type', () => {
    render(<CourtHeader courtNumber={3} matchType="Doubles" />);
    expect(screen.getByText(/Court 3 - Doubles/)).toBeInTheDocument();
  });

  it('displays manual court icon when isManualCourt is true', () => {
    render(<CourtHeader courtNumber={1} isManualCourt={true} />);
    const icon = screen.getByTitle('Manually assigned court');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveTextContent('⚙️');
  });

  it('does not display manual court icon when isManualCourt is false', () => {
    render(<CourtHeader courtNumber={1} isManualCourt={false} />);
    expect(screen.queryByTitle('Manually assigned court')).not.toBeInTheDocument();
  });

  it('does not display manual court icon by default', () => {
    render(<CourtHeader courtNumber={1} />);
    expect(screen.queryByTitle('Manually assigned court')).not.toBeInTheDocument();
  });

  it('renders correctly without match type', () => {
    render(<CourtHeader courtNumber={5} />);
    expect(screen.getByText('Court 5')).toBeInTheDocument();
    expect(screen.queryByText('Singles')).not.toBeInTheDocument();
    expect(screen.queryByText('Doubles')).not.toBeInTheDocument();
  });
});

