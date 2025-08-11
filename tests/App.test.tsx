import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import App from '../src/App';

describe('App', () => {
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

  describe('Player Toggle Integration', () => {
    const user = userEvent.setup();

    describe('Player Toggle Functionality', () => {
      beforeEach(async () => {
        render(<App />);
        const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
        await user.type(bulkInput, 'Alice\nBob\nCharlie');
        await user.click(screen.getByText('Add All Players'));
      });

      it('adds all players correctly with initial checked state', async () => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
        expect(screen.getByText('Charlie')).toBeInTheDocument();

        expect(screen.getByText('Present').previousElementSibling).toHaveTextContent('3');
        expect(screen.getByText('Total').previousElementSibling).toHaveTextContent('3');

        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes).toHaveLength(3);
        checkboxes.forEach(checkbox => {
          expect(checkbox).toBeChecked();
        });
      });

      it('updates stats when toggling a single player off', async () => {
        const checkboxes = screen.getAllByRole('checkbox');
        await user.click(checkboxes[0]); // Toggle off Alice

        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(checkboxes[0]).not.toBeChecked();

        expect(screen.getByText('Present').previousElementSibling).toHaveTextContent('2');
        expect(screen.getByText('Absent').previousElementSibling).toHaveTextContent('1');
        expect(screen.getByText('Total').previousElementSibling).toHaveTextContent('3');
      });

      it('keeps all players visible when all are toggled off', async () => {
        const checkboxes = screen.getAllByRole('checkbox');

        // Toggle off all players
        await user.click(checkboxes[0]); // Alice
        await user.click(checkboxes[1]); // Bob
        await user.click(checkboxes[2]); // Charlie

        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
        expect(screen.getByText('Charlie')).toBeInTheDocument();

        checkboxes.forEach(checkbox => {
          expect(checkbox).not.toBeChecked();
        });

        expect(screen.getByText('Present').previousElementSibling).toHaveTextContent('0');
        expect(screen.getByText('Absent').previousElementSibling).toHaveTextContent('3');
        expect(screen.getByText('Total').previousElementSibling).toHaveTextContent('3');
      });

      it('updates stats when toggling a player back on', async () => {
        const checkboxes = screen.getAllByRole('checkbox');

        // Toggle all off first
        await user.click(checkboxes[0]);
        await user.click(checkboxes[1]);
        await user.click(checkboxes[2]);

        // Toggle Alice back on
        await user.click(checkboxes[0]);

        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(checkboxes[0]).toBeChecked();

        expect(screen.getByText('Present').previousElementSibling).toHaveTextContent('1');
        expect(screen.getByText('Absent').previousElementSibling).toHaveTextContent('2');
        expect(screen.getByText('Total').previousElementSibling).toHaveTextContent('3');
      });
    });

    describe('Court Settings Visibility', () => {
      beforeEach(async () => {
        render(<App />);
        const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
        await user.type(bulkInput, 'Alice\nBob');
        await user.click(screen.getByText('Add All Players'));
      });

      it('displays court settings when players are present', () => {
        expect(screen.getByText('Step 3: Court Settings')).toBeInTheDocument();
      });

      it('hides court settings when all players are toggled off', async () => {
        const checkboxes = screen.getAllByRole('checkbox');
        await user.click(checkboxes[0]); // Alice
        await user.click(checkboxes[1]); // Bob

        expect(screen.getByText('Step 2: Manage Players')).toBeInTheDocument();
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
        expect(screen.queryByText('Step 3: Court Settings')).not.toBeInTheDocument();
      });

      it('shows court settings again when at least one player is toggled on', async () => {
        const checkboxes = screen.getAllByRole('checkbox');

        // Toggle all off first
        await user.click(checkboxes[0]); // Alice
        await user.click(checkboxes[1]); // Bob

        // Toggle Alice back on
        await user.click(checkboxes[0]);

        expect(screen.getByText('Step 3: Court Settings')).toBeInTheDocument();
      });
    });

    describe('Remove vs Toggle Functionality', () => {
      beforeEach(async () => {
        render(<App />);
        const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/);
        await user.type(bulkInput, 'Alice\nBob\nCharlie');
        await user.click(screen.getByText('Add All Players'));
      });

      it('keeps toggled-off players in the list', async () => {
        const checkboxes = screen.getAllByRole('checkbox');
        await user.click(checkboxes[0]); // Toggle off Alice

        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(checkboxes[0]).not.toBeChecked();
      });

      it('removes deleted players completely from the list', async () => {
        const removeButtons = screen.getAllByTitle('Delete player permanently');
        await user.click(removeButtons[1]); // Delete Bob

        expect(screen.queryByText('Bob')).not.toBeInTheDocument();
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Charlie')).toBeInTheDocument();
      });

      it('updates player counts and UI elements after removal', async () => {
        const removeButtons = screen.getAllByTitle('Delete player permanently');
        await user.click(removeButtons[1]); // Delete Bob

        expect(screen.getAllByRole('checkbox')).toHaveLength(2);
        expect(screen.getAllByTitle('Delete player permanently')).toHaveLength(2);
        expect(screen.getByText('Present').previousElementSibling).toHaveTextContent('2');
        expect(screen.getByText('Total').previousElementSibling).toHaveTextContent('2');
      });
    });
  });

});