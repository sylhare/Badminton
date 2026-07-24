import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CourtHeader from '../../../../src/components/court/card/CourtHeader';

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

  it('renders correctly without match type', () => {
    render(<CourtHeader courtNumber={5} />);
    expect(screen.getByText('Court 5')).toBeInTheDocument();
    expect(screen.queryByText('Singles')).not.toBeInTheDocument();
    expect(screen.queryByText('Doubles')).not.toBeInTheDocument();
  });

  describe('Rotate teams button', () => {
    it('renders rotate button when onRotateTeams is provided', () => {
      render(<CourtHeader courtNumber={1} onRotateTeams={vi.fn()} />);
      expect(screen.getByTestId('rotate-teams-button')).toBeInTheDocument();
    });

    it('does not render rotate button when onRotateTeams is not provided', () => {
      render(<CourtHeader courtNumber={1} />);
      expect(screen.queryByTestId('rotate-teams-button')).not.toBeInTheDocument();
    });

    it('calls onRotateTeams when rotate button is clicked', async () => {
      const user = userEvent.setup();
      const mockRotate = vi.fn();
      render(<CourtHeader courtNumber={1} onRotateTeams={mockRotate} />);

      await user.click(screen.getByTestId('rotate-teams-button'));

      expect(mockRotate).toHaveBeenCalledTimes(1);
    });
  });
});

