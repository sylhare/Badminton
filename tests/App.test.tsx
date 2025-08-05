import React from 'react';
import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import App from '../src/App';

describe('App Step Visibility', () => {
  const user = userEvent.setup();

  it('renders Step 3 only after players are added', async () => {
    render(<App />);

    expect(screen.queryByText('Step 3: Court Settings')).not.toBeInTheDocument();

    const singleInput = screen.getByPlaceholderText('Enter player name...');
    await act(async () => {
      await user.type(singleInput, 'Alice');
      await user.click(screen.getByRole('button', { name: /add player/i }));
    });

    expect(screen.getByText('Step 3: Court Settings')).toBeInTheDocument();
  });

  it('renders court assignments after first generation', async () => {
    render(<App />);
    const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
    await act(async () => {
      await user.type(
        bulkInput,
        'Alice\nBob\nCharlie\nDiana',
      );
      await user.click(screen.getByText('Add All Players'));
    });

    await act(async () => {
      await user.click(screen.getByText('🎲 Generate Random Assignments'));
    });

    expect(screen.getByText('Court Assignments')).toBeInTheDocument();
    expect(screen.queryByText('Step 4')).not.toBeInTheDocument();
  });

  it('can generate multiple new assignments in succession', async () => {
    render(<App />);

    const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
    await act(async () => {
      await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana\nEve\nFrank\nGrace\nHenry');
      await user.click(screen.getByText('Add All Players'));
    });
    await act(async () => {
      await user.click(screen.getByText('🎲 Generate Random Assignments'));
    });
    expect(screen.getByText(/Court.*1/)).toBeInTheDocument();
    expect(screen.getByText(/Court.*2/)).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByText('🎲 Generate New Assignments'));
    });
    expect(screen.getByText(/Court.*1/)).toBeInTheDocument();
    expect(screen.getByText(/Court.*2/)).toBeInTheDocument();
  });

  it('preserves player present/absent status across regenerations', async () => {
    render(<App />);

    const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
    await act(async () => {
      await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana\nEve\nFrank');
      await user.click(screen.getByText('Add All Players'));
    });

    const playerItems = screen.getAllByRole('checkbox');
    const aliceCheckbox = playerItems[0]; // First player (Alice)
    const bobCheckbox = playerItems[1];   // Second player (Bob)
    await act(async () => {
      await user.click(aliceCheckbox);
      await user.click(bobCheckbox);
      await user.click(screen.getByText('🎲 Generate Random Assignments'));
    });

    const courtAssignments = screen.getByText('Court Assignments').parentElement;
    expect(courtAssignments).not.toHaveTextContent('Alice');
    expect(courtAssignments).not.toHaveTextContent('Bob');
    expect(courtAssignments).toHaveTextContent('Charlie');
    expect(courtAssignments).toHaveTextContent('Diana');

    await act(async () => {
      await user.click(screen.getByText('🎲 Generate New Assignments'));
    });

    expect(courtAssignments).not.toHaveTextContent('Alice');
    expect(courtAssignments).not.toHaveTextContent('Bob');
  });

  it('properly benches single remaining players instead of assigning them to courts', async () => {
    render(<App />);

    const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
    await act(async () => {
      await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana\nEve\nFrank\nGrace\nHenry\nIvy');
      await user.click(screen.getByText('Add All Players'));
    });

    await act(async () => {
      await user.click(screen.getByText('🎲 Generate Random Assignments'));
    });

    expect(screen.getByText(/Court.*1/)).toBeInTheDocument();
    expect(screen.getByText(/Court.*2/)).toBeInTheDocument();
    expect(screen.queryByText(/Court.*3/)).not.toBeInTheDocument();

    expect(screen.getByText('🪑 Bench (1 player)')).toBeInTheDocument();

    const benchSection = screen.getByText('🪑 Bench (1 player)').closest('.bench-section');
    expect(benchSection).toBeInTheDocument();
  });
});