import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import App from '../src/App';
import { addPlayers, generateAndWaitForAssignments, clearTestState } from './shared';

describe('App', () => {
  beforeEach(clearTestState);
  afterEach(clearTestState);

  describe('UI Structure', () => {
    const user = userEvent.setup();

    it('renders Manage Players section', () => {
      render(<App />);
      expect(screen.getByText('👥 Manage Players')).toBeInTheDocument();
    });

    it('renders Court Assignments section', () => {
      render(<App />);
      expect(screen.getByText('🏟️ Court Assignments')).toBeInTheDocument();
    });

    it('shows player list after adding players', async () => {
      render(<App />);
      await addPlayers(user, 'Alice');

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByTestId('player-stats')).toBeInTheDocument();
    });

    it('enables generate button after adding players', async () => {
      render(<App />);

      // Initially disabled
      expect(screen.getByTestId('generate-assignments-button')).toBeDisabled();

      await addPlayers(user, 'Alice');

      // Now enabled
      expect(screen.getByTestId('generate-assignments-button')).not.toBeDisabled();
    });

    it('renders court assignments after generation', async () => {
      render(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana');

      await act(async () => {
        await user.click(screen.getByTestId('generate-assignments-button'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('court-1')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('can generate multiple new assignments in succession', async () => {
      render(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana,Eve,Frank,Grace,Henry');

      await generateAndWaitForAssignments(user);

      expect(screen.getByTestId('court-1')).toBeInTheDocument();
      expect(screen.getByTestId('court-2')).toBeInTheDocument();

      await act(async () => {
        await user.click(screen.getByTestId('generate-assignments-button'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('court-1')).toBeInTheDocument();
        expect(screen.getByTestId('court-2')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('preserves player present/absent status across regenerations', async () => {
      render(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana,Eve,Frank');

      const toggleButtons = screen.getAllByTestId(/^toggle-presence-/);
      const aliceToggle = toggleButtons[0];
      const bobToggle = toggleButtons[1];

      await act(async () => {
        await user.click(aliceToggle);
        await user.click(bobToggle);
      });

      await generateAndWaitForAssignments(user);

      const courtSection = screen.getByTestId('court-assignments-section');
      expect(courtSection).not.toHaveTextContent('Alice');
      expect(courtSection).not.toHaveTextContent('Bob');
      expect(courtSection).toHaveTextContent('Charlie');
      expect(courtSection).toHaveTextContent('Diana');
    });

    it('properly benches single remaining players instead of assigning them to courts', async () => {
      render(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana,Eve,Frank,Grace,Henry,Ivy');

      await generateAndWaitForAssignments(user);

      expect(screen.getByTestId('court-1')).toBeInTheDocument();
      expect(screen.getByTestId('court-2')).toBeInTheDocument();
      expect(screen.queryByTestId('court-3')).not.toBeInTheDocument();
      expect(screen.getByText('🪑 Bench (1 player)')).toBeInTheDocument();
    });

    it('collapses Manage Players section after first assignment', async () => {
      render(<App />);
      await addPlayers(user, 'Alice,Bob,Charlie,Diana');

      const managePlayersSection = screen.getByTestId('manage-players-section');
      expect(managePlayersSection).not.toHaveClass('collapsed');

      await generateAndWaitForAssignments(user);

      expect(managePlayersSection).toHaveClass('collapsed');
    });
  });

  describe('Player Toggle Integration', () => {
    const user = userEvent.setup();

    describe('Player Toggle Functionality', () => {
      beforeEach(async () => {
        render(<App />);
        await addPlayers(user, 'Alice,Bob,Charlie');
      });

      it('adds all players correctly with initial present state', async () => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
        expect(screen.getByText('Charlie')).toBeInTheDocument();

        expect(screen.getByTestId('stats-present-count')).toHaveTextContent('3');
        expect(screen.getByTestId('stats-total-count')).toHaveTextContent('3');

        const toggleButtons = screen.getAllByTestId(/^toggle-presence-/);
        expect(toggleButtons).toHaveLength(3);
        toggleButtons.forEach(button => {
          expect(button).toHaveClass('present');
        });
      });

      it('updates stats when toggling a single player off', async () => {
        const toggleButtons = screen.getAllByTestId(/^toggle-presence-/);
        await user.click(toggleButtons[0]);

        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(toggleButtons[0]).toHaveClass('absent');

        expect(screen.getByTestId('stats-present-count')).toHaveTextContent('2');
        expect(screen.getByTestId('stats-absent-count')).toHaveTextContent('1');
        expect(screen.getByTestId('stats-total-count')).toHaveTextContent('3');
      });

      it('keeps all players visible when all are toggled off', async () => {
        const toggleButtons = screen.getAllByTestId(/^toggle-presence-/);

        await user.click(toggleButtons[0]);
        await user.click(toggleButtons[1]);
        await user.click(toggleButtons[2]);

        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
        expect(screen.getByText('Charlie')).toBeInTheDocument();

        toggleButtons.forEach(button => {
          expect(button).toHaveClass('absent');
        });

        expect(screen.getByTestId('stats-present-count')).toHaveTextContent('0');
        expect(screen.getByTestId('stats-absent-count')).toHaveTextContent('3');
        expect(screen.getByTestId('stats-total-count')).toHaveTextContent('3');
      });

      it('updates stats when toggling a player back on', async () => {
        const toggleButtons = screen.getAllByTestId(/^toggle-presence-/);

        await user.click(toggleButtons[0]);
        await user.click(toggleButtons[1]);
        await user.click(toggleButtons[2]);

        await user.click(toggleButtons[0]);

        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(toggleButtons[0]).toHaveClass('present');

        expect(screen.getByTestId('stats-present-count')).toHaveTextContent('1');
        expect(screen.getByTestId('stats-absent-count')).toHaveTextContent('2');
        expect(screen.getByTestId('stats-total-count')).toHaveTextContent('3');
      });
    });

    describe('Generate Button State', () => {
      beforeEach(async () => {
        render(<App />);
        await addPlayers(user, 'Alice,Bob');
      });

      it('enables generate button when players are present', () => {
        expect(screen.getByTestId('generate-assignments-button')).not.toBeDisabled();
      });

      it('disables generate button when all players are toggled off', async () => {
        const toggleButtons = screen.getAllByTestId(/^toggle-presence-/);
        await user.click(toggleButtons[0]);
        await user.click(toggleButtons[1]);

        expect(screen.getByTestId('generate-assignments-button')).toBeDisabled();
      });

      it('enables generate button when at least one player is toggled back on', async () => {
        const toggleButtons = screen.getAllByTestId(/^toggle-presence-/);

        await user.click(toggleButtons[0]);
        await user.click(toggleButtons[1]);

        await user.click(toggleButtons[0]);

        expect(screen.getByTestId('generate-assignments-button')).not.toBeDisabled();
      });
    });

    describe('Remove vs Toggle Functionality', () => {
      beforeEach(async () => {
        render(<App />);
        await addPlayers(user, 'Alice,Bob,Charlie');
      });

      it('keeps toggled-off players in the list', async () => {
        const toggleButtons = screen.getAllByTestId(/^toggle-presence-/);
        await user.click(toggleButtons[0]);

        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(toggleButtons[0]).toHaveClass('absent');
      });

      it('removes deleted players completely from the list', async () => {
        const removeButtons = screen.getAllByTitle('Delete player permanently');
        await user.click(removeButtons[1]);

        await user.click(screen.getByTestId('player-removal-modal-remove'));

        expect(screen.queryByText('Bob')).not.toBeInTheDocument();
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Charlie')).toBeInTheDocument();
      });

      it('updates player counts and UI elements after removal', async () => {
        const removeButtons = screen.getAllByTitle('Delete player permanently');
        await user.click(removeButtons[1]);

        await user.click(screen.getByTestId('player-removal-modal-remove'));

        expect(screen.getAllByTestId(/^toggle-presence-/)).toHaveLength(2);
        expect(screen.getAllByTitle('Delete player permanently')).toHaveLength(2);
        expect(screen.getByTestId('stats-present-count')).toHaveTextContent('2');
        expect(screen.getByTestId('stats-total-count')).toHaveTextContent('2');
      });
    });
  });
});
