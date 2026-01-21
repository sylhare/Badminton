import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import App from '../src/App';
import { CourtAssignmentEngine } from '../src/utils/CourtAssignmentEngine';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    CourtAssignmentEngine.resetHistory();
  });

  afterEach(() => {
    localStorage.clear();
    CourtAssignmentEngine.resetHistory();
  });

  describe('App Step Visibility', () => {
    const user = userEvent.setup();

    it('renders Step 3 only after players are added', async () => {
      render(<App />);

      expect(screen.queryByText('Step 3: Court Settings')).not.toBeInTheDocument();

      const singleInput = screen.getAllByPlaceholderText('Enter player name...')[0];
      await act(async () => {
        await user.type(singleInput, 'Alice');
        await user.click(screen.getAllByTestId('add-single-button')[0]);
      });

      expect(screen.getAllByText('Step 3: Court Settings')[0]).toBeInTheDocument();
    });

    it('renders court assignments after first generation', async () => {
      render(<App />);
      const bulkInput = screen.getAllByTestId('bulk-input')[0];
      await act(async () => {
        await user.type(
          bulkInput,
          'Alice\nBob\nCharlie\nDiana',
        );
        await user.click(screen.getAllByTestId('add-bulk-button')[0]);
      });

      await act(async () => {
        await user.click(screen.getAllByTestId('generate-assignments-button')[0]);
      });

      expect(screen.getAllByText('Step 4: Court Assignments')[0]).toBeInTheDocument();
      expect(screen.queryByText('Step 4')).not.toBeInTheDocument();
    });

    it('can generate multiple new assignments in succession', async () => {
      render(<App />);

      const bulkInput = screen.getAllByTestId('bulk-input')[0];
      await act(async () => {
        await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana\nEve\nFrank\nGrace\nHenry');
        await user.click(screen.getAllByTestId('add-bulk-button')[0]);
      });
      await act(async () => {
        await user.click(screen.getAllByTestId('generate-assignments-button')[0]);
      });
      expect(screen.getAllByText(/Court.*1/)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Court.*2/)[0]).toBeInTheDocument();

      await act(async () => {
        await user.click(screen.getAllByText('🎲 Generate New Assignments')[0]);
      });
      expect(screen.getAllByText(/Court.*1/)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Court.*2/)[0]).toBeInTheDocument();
    });

    it('preserves player present/absent status across regenerations', async () => {
      render(<App />);

      const bulkInput = screen.getAllByTestId('bulk-input')[0];
      await act(async () => {
        await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana\nEve\nFrank');
        await user.click(screen.getAllByTestId('add-bulk-button')[0]);
      });

      const toggleButtons = screen.getAllByTestId(/^toggle-presence-/);
      const aliceToggle = toggleButtons[0];
      const bobToggle = toggleButtons[1];
      await act(async () => {
        await user.click(aliceToggle);
        await user.click(bobToggle);
        await user.click(screen.getAllByTestId('generate-assignments-button')[0]);
      });

      const courtAssignmentsSection = screen.getByText('Step 4: Court Assignments').closest('.step');
      expect(courtAssignmentsSection).not.toHaveTextContent('Alice');
      expect(courtAssignmentsSection).not.toHaveTextContent('Bob');
      expect(courtAssignmentsSection).toHaveTextContent('Charlie');
      expect(courtAssignmentsSection).toHaveTextContent('Diana');

      await act(async () => {
        await user.click(screen.getAllByText('🎲 Generate New Assignments')[0]);
      });

      expect(courtAssignmentsSection).not.toHaveTextContent('Alice');
      expect(courtAssignmentsSection).not.toHaveTextContent('Bob');
    });

    it('properly benches single remaining players instead of assigning them to courts', async () => {
      render(<App />);

      const bulkInput = screen.getAllByTestId('bulk-input')[0];
      await act(async () => {
        await user.type(bulkInput, 'Alice\nBob\nCharlie\nDiana\nEve\nFrank\nGrace\nHenry\nIvy');
        await user.click(screen.getAllByTestId('add-bulk-button')[0]);
      });

      await act(async () => {
        await user.click(screen.getAllByTestId('generate-assignments-button')[0]);
      });

      expect(screen.getAllByText(/Court.*1/)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Court.*2/)[0]).toBeInTheDocument();
      expect(screen.queryByText(/Court.*3/)).not.toBeInTheDocument();

      expect(screen.getAllByText('🪑 Bench (1 player)')[0]).toBeInTheDocument();

      const benchSection = screen.getAllByText('🪑 Bench (1 player)')[0].closest('.bench-section');
      expect(benchSection).toBeInTheDocument();
    });
  });

  describe('Player Toggle Integration', () => {
    const user = userEvent.setup();

    describe('Player Toggle Functionality', () => {
      beforeEach(async () => {
        render(<App />);
        const bulkInput = screen.getAllByTestId('bulk-input')[0];
        await user.type(bulkInput, 'Alice\nBob\nCharlie');
        await user.click(screen.getAllByTestId('add-bulk-button')[0]);
      });

      it('adds all players correctly with initial present state', async () => {
        expect(screen.getAllByText('Alice')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Bob')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Charlie')[0]).toBeInTheDocument();

        expect(screen.getAllByText('Present')[0].previousElementSibling).toHaveTextContent('3');
        expect(screen.getAllByText('Total')[0].previousElementSibling).toHaveTextContent('3');

        const toggleButtons = screen.getAllByTestId(/^toggle-presence-/);
        expect(toggleButtons).toHaveLength(3); // 3 players
        toggleButtons.forEach(button => {
          expect(button).toHaveClass('present');
        });
      });

      it('updates stats when toggling a single player off', async () => {
        const toggleButtons = screen.getAllByTestId(/^toggle-presence-/);
        await user.click(toggleButtons[0]);

        expect(screen.getAllByText('Alice')[0]).toBeInTheDocument();
        expect(toggleButtons[0]).toHaveClass('absent');

        expect(screen.getAllByText('Present')[0].previousElementSibling).toHaveTextContent('2');
        expect(screen.getAllByText('Absent')[0].previousElementSibling).toHaveTextContent('1');
        expect(screen.getAllByText('Total')[0].previousElementSibling).toHaveTextContent('3');
      });

      it('keeps all players visible when all are toggled off', async () => {
        const toggleButtons = screen.getAllByTestId(/^toggle-presence-/);

        await user.click(toggleButtons[0]);
        await user.click(toggleButtons[1]);
        await user.click(toggleButtons[2]);

        expect(screen.getAllByText('Alice')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Bob')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Charlie')[0]).toBeInTheDocument();

        toggleButtons.forEach(button => {
          expect(button).toHaveClass('absent');
        });

        expect(screen.getAllByText('Present')[0].previousElementSibling).toHaveTextContent('0');
        expect(screen.getAllByText('Absent')[0].previousElementSibling).toHaveTextContent('3');
        expect(screen.getAllByText('Total')[0].previousElementSibling).toHaveTextContent('3');
      });

      it('updates stats when toggling a player back on', async () => {
        const toggleButtons = screen.getAllByTestId(/^toggle-presence-/);

        await user.click(toggleButtons[0]);
        await user.click(toggleButtons[1]);
        await user.click(toggleButtons[2]);

        await user.click(toggleButtons[0]);

        expect(screen.getAllByText('Alice')[0]).toBeInTheDocument();
        expect(toggleButtons[0]).toHaveClass('present');

        expect(screen.getAllByText('Present')[0].previousElementSibling).toHaveTextContent('1');
        expect(screen.getAllByText('Absent')[0].previousElementSibling).toHaveTextContent('2');
        expect(screen.getAllByText('Total')[0].previousElementSibling).toHaveTextContent('3');
      });
    });

    describe('Court Settings Visibility', () => {
      beforeEach(async () => {
        render(<App />);
        const bulkInput = screen.getAllByTestId('bulk-input')[0];
        await user.type(bulkInput, 'Alice\nBob');
        await user.click(screen.getAllByTestId('add-bulk-button')[0]);
      });

      it('displays court settings when players are present', () => {
        expect(screen.getAllByText('Step 3: Court Settings')[0]).toBeInTheDocument();
      });

      it('hides court settings when all players are toggled off', async () => {
        const toggleButtons = screen.getAllByTestId(/^toggle-presence-/);
        await user.click(toggleButtons[0]);
        await user.click(toggleButtons[1]);

        expect(screen.getAllByText('Step 2: Manage Players')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Alice')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Bob')[0]).toBeInTheDocument();
        expect(screen.queryByText('Step 3: Court Settings')).not.toBeInTheDocument();
      });

      it('shows court settings again when at least one player is toggled on', async () => {
        const toggleButtons = screen.getAllByTestId(/^toggle-presence-/);

        await user.click(toggleButtons[0]);
        await user.click(toggleButtons[1]);

        await user.click(toggleButtons[0]);

        expect(screen.getAllByText('Step 3: Court Settings')[0]).toBeInTheDocument();
      });
    });

    describe('Remove vs Toggle Functionality', () => {
      beforeEach(async () => {
        render(<App />);
        const bulkInput = screen.getAllByTestId('bulk-input')[0];
        await user.type(bulkInput, 'Alice\nBob\nCharlie');
        await user.click(screen.getAllByTestId('add-bulk-button')[0]);
      });

      it('keeps toggled-off players in the list', async () => {
        const toggleButtons = screen.getAllByTestId(/^toggle-presence-/);
        await user.click(toggleButtons[0]);

        expect(screen.getAllByText('Alice')[0]).toBeInTheDocument();
        expect(toggleButtons[0]).toHaveClass('absent');
      });

      it('removes deleted players completely from the list', async () => {
        const removeButtons = screen.getAllByTitle('Delete player permanently');
        await user.click(removeButtons[1]);

        await user.click(screen.getByTestId('player-removal-modal-remove'));

        expect(screen.queryByText('Bob')).not.toBeInTheDocument();
        expect(screen.getAllByText('Alice')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Charlie')[0]).toBeInTheDocument();
      });

      it('updates player counts and UI elements after removal', async () => {
        const removeButtons = screen.getAllByTitle('Delete player permanently');
        await user.click(removeButtons[1]);

        await user.click(screen.getByTestId('player-removal-modal-remove'));

        expect(screen.getAllByTestId(/^toggle-presence-/)).toHaveLength(2); // 2 players
        expect(screen.getAllByTitle('Delete player permanently')).toHaveLength(2); // 2 players
        expect(screen.getAllByText('Present')[0].previousElementSibling).toHaveTextContent('2');
        expect(screen.getAllByText('Total')[0].previousElementSibling).toHaveTextContent('2');
      });
    });
  });

});