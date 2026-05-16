import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import NotFoundPage from '../../src/pages/NotFoundPage';

const renderNotFound = (path = '/unknown-page') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/tournament" element={<div data-testid="tournament-page">Tournament</div>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('NotFoundPage', () => {
  it('renders 404 page with heading, message, home link, and footer', () => {
    renderNotFound();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('404');
    expect(screen.getByText(/doesn't exist/)).toBeInTheDocument();

    const link = screen.getByTestId('go-home-link');
    expect(link).toHaveTextContent('Go back to the Court Manager');
    expect(link).toHaveAttribute('href', '/');

    expect(screen.getByTestId('app-footer')).toBeInTheDocument();
  });

  it('redirects to the known route when path is a sub-path of a known route', () => {
    renderNotFound('/tournament/some-sub-path');
    expect(screen.getByTestId('tournament-page')).toBeInTheDocument();
    expect(screen.queryByText('404')).not.toBeInTheDocument();
  });

  it('does not redirect for paths that merely share a prefix with a known route', () => {
    renderNotFound('/tournaments-extra');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('404');
  });
});
