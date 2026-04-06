import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Footer from '../../src/components/Footer';

const renderFooter = () =>
  render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  );

describe('Footer', () => {
  it('renders the GitHub feedback link', () => {
    renderFooter();
    const link = screen.getByText('Let us know on GitHub');
    expect(link).toHaveAttribute('href', 'https://github.com/sylhare/Badminton/issues/new/choose');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders the stats analysis link', () => {
    renderFooter();
    const link = screen.getByTestId('stats-link');
    expect(link).toHaveTextContent('View Statistics & Analysis');
    expect(link).toHaveAttribute('href', '/stats');
  });

  it('does not render tournament link by default', () => {
    renderFooter();
    expect(screen.queryByTestId('tournament-link')).not.toBeInTheDocument();
  });

  it('renders tournament link when showTournamentLink is true', () => {
    render(
      <MemoryRouter>
        <Footer showTournamentLink />
      </MemoryRouter>,
    );
    const link = screen.getByTestId('tournament-link');
    expect(link).toHaveTextContent('Try Tournament Mode');
    expect(link).toHaveAttribute('href', '/tournament');
  });
});
