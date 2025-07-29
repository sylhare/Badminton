import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

import App from '../../src/App';

describe('Generate Assignments Integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('preserves players and courts when generating new assignments', async () => {
    const user = userEvent.setup();
    render(<App />);

    const singlePlayerInput = screen.getByPlaceholderText('Enter player name...');
    const addPlayerButton = screen.getByRole('button', { name: /add player/i });

    const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
    for (const name of playerNames) {
      await user.type(singlePlayerInput, name);
      await user.click(addPlayerButton);
      await waitFor(() => {
        expect(screen.getAllByText(name)[0]).toBeInTheDocument();
      });
    }

     for (const name of playerNames) {
       expect(screen.getAllByText(name)[0]).toBeInTheDocument();
     }

    const courtsInput = screen.getByLabelText('Number of Courts:') as HTMLInputElement;
    fireEvent.change(courtsInput, { target: { value: '2' } });
    await waitFor(() => {
      expect(courtsInput).toHaveValue(2);
    });

    const generateButton = screen.getByRole('button', { name: /generate random assignments/i });
    await user.click(generateButton);
    await waitFor(() => {
      expect(screen.getByText(/Court 1/)).toBeInTheDocument();
      expect(screen.getByText(/Court 2/)).toBeInTheDocument();
    });

     expect(screen.getByText(/Court 1/)).toBeInTheDocument();
     expect(screen.getByText(/Court 2/)).toBeInTheDocument();

     for (const name of playerNames) {
       expect(screen.getAllByText(name).length).toBeGreaterThan(0);
     }

    const regenerateButton = screen.getByRole('button', { name: /generate new assignments/i });
    await user.click(regenerateButton);
    await waitFor(() => {
      expect(screen.getByText(/Court 1/)).toBeInTheDocument();
      expect(screen.getByText(/Court 2/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Court 1/)).toBeInTheDocument();
    expect(screen.getByText(/Court 2/)).toBeInTheDocument();

    for (const name of playerNames) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }

    expect(courtsInput).toHaveValue(2);

    const playerListSection = screen.getByText('Step 2: Manage Players').parentElement;
    expect(playerListSection).toBeInTheDocument();

    expect(regenerateButton).toBeEnabled();
  });

  it('can generate multiple new assignments in succession', async () => {
    const user = userEvent.setup();
    render(<App />);

    const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
    const addAllButton = screen.getByRole('button', { name: /add all players/i });

    await user.type(bulkInput, 'Player1, Player2, Player3, Player4, Player5, Player6, Player7, Player8');
    await user.click(addAllButton);
    await waitFor(() => {
      expect(screen.getAllByText('Player1')[0]).toBeInTheDocument();
    });

    const generateButton = screen.getByRole('button', { name: /generate random assignments/i });
    await user.click(generateButton);
    await waitFor(() => {
      expect(screen.getByText(/Court 1/)).toBeInTheDocument();
    });

    const regenerateButton = screen.getByRole('button', { name: /generate new assignments/i });

    await user.click(regenerateButton);
    await user.click(regenerateButton);
    await user.click(regenerateButton);

     for (let i = 1; i <= 8; i++) {
       expect(screen.getAllByText(`Player${i}`).length).toBeGreaterThan(0);
     }

     expect(screen.getByText(/Court 1/)).toBeInTheDocument();

    expect(regenerateButton).toBeEnabled();
  });

  it('preserves player present/absent status across regenerations', async () => {
    const user = userEvent.setup();
    render(<App />);

    const singlePlayerInput = screen.getByPlaceholderText('Enter player name...');
    const addPlayerButton = screen.getByRole('button', { name: /add player/i });

    await user.type(singlePlayerInput, 'Alice');
    await user.click(addPlayerButton);
    await waitFor(() => expect(screen.getAllByText('Alice')[0]).toBeInTheDocument());

    await user.type(singlePlayerInput, 'Bob');
    await user.click(addPlayerButton);
    await waitFor(() => expect(screen.getAllByText('Bob')[0]).toBeInTheDocument());

    await user.type(singlePlayerInput, 'Charlie');
    await user.click(addPlayerButton);
    await waitFor(() => expect(screen.getAllByText('Charlie')[0]).toBeInTheDocument());

    await user.type(singlePlayerInput, 'Diana');
    await user.click(addPlayerButton);
    await waitFor(() => expect(screen.getAllByText('Diana')[0]).toBeInTheDocument());

     const bobPlayerItems = screen.getAllByText('Bob');
     const bobPlayerListItem = bobPlayerItems.find(el =>
       el.parentElement?.querySelector('.player-checkbox'),
     );
         const bobToggle = bobPlayerListItem?.parentElement?.querySelector('.player-checkbox') as HTMLElement;
    await user.click(bobToggle);
    await waitFor(() => {
      expect(bobToggle).not.toBeChecked();
    });

    const generateButton = screen.getByRole('button', { name: /generate random assignments/i });
    await user.click(generateButton);
    await waitFor(() => {
      expect(screen.getByText(/Court 1/)).toBeInTheDocument();
    });

    const playerListSection = screen.getByText('Step 2: Manage Players').parentElement!;
    expect(playerListSection).toHaveTextContent('Bob');

    const regenerateButton = screen.getByRole('button', { name: /generate new assignments/i });
    await user.click(regenerateButton);
    await waitFor(() => {
      expect(screen.getByText(/Court 1/)).toBeInTheDocument();
    });

    expect(playerListSection).toHaveTextContent('Bob');

     const bobCheckboxAfter = bobPlayerListItem?.parentElement?.querySelector('.player-checkbox') as HTMLInputElement;
     expect(bobCheckboxAfter).not.toBeChecked();

     expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
     expect(screen.getAllByText('Charlie').length).toBeGreaterThan(0);
     expect(screen.getAllByText('Diana').length).toBeGreaterThan(0);
  });
});