import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import App from '../src/App';

describe('App Step Visibility', () => {
  const user = userEvent.setup();

  it('renders Step 3 only after players are added', async () => {
    render(<App />);

    expect(screen.queryByText('Step 3: Court Settings')).not.toBeInTheDocument();

    const singleInput = screen.getByPlaceholderText('Enter player name...');
    await user.type(singleInput, 'Alice');
    await user.click(screen.getByRole('button', { name: /add player/i }));

    expect(screen.getByText('Step 3: Court Settings')).toBeInTheDocument();
  });

  it('renders court assignments after first generation', async () => {
    render(<App />);
    const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
    await user.type(
      bulkInput,
      'Alice\nBob\nCharlie\nDiana',
    );
    await user.click(screen.getByText('Add All Players'));

    await user.click(screen.getByText('🎲 Generate Random Assignments'));

    expect(screen.getByText('Court Assignments')).toBeInTheDocument();
    expect(screen.queryByText('Step 4')).not.toBeInTheDocument();
  });
});