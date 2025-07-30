import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import App from '../../src/App';

describe('Generate Assignments Integration', () => {
  const user = userEvent.setup();

  it('can generate multiple new assignments in succession', async () => {
    render(<App />);

    const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
    await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana\nEve\nFrank\nGrace\nHenry');
    await user.click(screen.getByText('Add All Players'));

    await user.click(screen.getByText('🎲 Generate Random Assignments'));
    expect(screen.getByText(/Court.*1/)).toBeInTheDocument();
    expect(screen.getByText(/Court.*2/)).toBeInTheDocument();

    await user.click(screen.getByText('🎲 Generate New Assignments'));
    expect(screen.getByText(/Court.*1/)).toBeInTheDocument();
    expect(screen.getByText(/Court.*2/)).toBeInTheDocument();
  });

  it('preserves player present/absent status across regenerations', async () => {
    render(<App />);

    const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
    await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana\nEve\nFrank');
    await user.click(screen.getByText('Add All Players'));

    const playerItems = screen.getAllByRole('checkbox');
    const aliceCheckbox = playerItems[0]; // First player (Alice)
    const bobCheckbox = playerItems[1];   // Second player (Bob)
    await user.click(aliceCheckbox);
    await user.click(bobCheckbox);

    await user.click(screen.getByText('🎲 Generate Random Assignments'));

    const courtAssignments = screen.getByText('Step 4: Court Assignments').parentElement;
    expect(courtAssignments).not.toHaveTextContent('Alice');
    expect(courtAssignments).not.toHaveTextContent('Bob');
    expect(courtAssignments).toHaveTextContent('Charlie');
    expect(courtAssignments).toHaveTextContent('Diana');

    await user.click(screen.getByText('🎲 Generate New Assignments'));

    expect(courtAssignments).not.toHaveTextContent('Alice');
    expect(courtAssignments).not.toHaveTextContent('Bob');
  });

  it('properly benches single remaining players instead of assigning them to courts', async () => {
    render(<App />);

    const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
    await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana\nEve\nFrank\nGrace\nHenry\nIvy');
    await user.click(screen.getByText('Add All Players'));

    await user.click(screen.getByText('🎲 Generate Random Assignments'));

    expect(screen.getByText(/Court.*1/)).toBeInTheDocument();
    expect(screen.getByText(/Court.*2/)).toBeInTheDocument();
    expect(screen.queryByText(/Court.*3/)).not.toBeInTheDocument();

    expect(screen.getByText('🪑 Bench (1 player)')).toBeInTheDocument();

    const benchSection = screen.getByText('🪑 Bench (1 player)').closest('.bench-section');
    expect(benchSection).toBeInTheDocument();
  });
});