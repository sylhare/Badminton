import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useStepRegistry, StepCallbacks } from '../../src/hooks/useStepRegistry';
import { Player, Court } from '../../src/types';

describe('useStepRegistry Hook', () => {
  const mockPlayer1: Player = { id: '1', name: 'Alice', isPresent: true };
  const mockPlayer2: Player = { id: '2', name: 'Bob', isPresent: false };
  const mockPlayers: Player[] = [mockPlayer1, mockPlayer2];

  const mockCourt: Court = {
    courtNumber: 1,
    players: [mockPlayer1, mockPlayer2],
    teams: {
      team1: [mockPlayer1],
      team2: [mockPlayer2],
    },
  };

  const mockCallbacks: StepCallbacks = {
    handlePlayersExtracted: vi.fn(),
    handleManualPlayersAdded: vi.fn(),
    handlePlayerToggle: vi.fn(),
    handleRemovePlayer: vi.fn(),
    handleClearAllPlayers: vi.fn(),
    handleResetAlgorithm: vi.fn(),
    generateAssignments: vi.fn(),
    handleWinnerChange: vi.fn(),
    setNumberOfCourts: vi.fn(),
    setManualCourtSelection: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Step Definitions', () => {
    it('should show "Manage Players" step when players exist', () => {
      const { result } = renderHook(() =>
        useStepRegistry(
          mockPlayers,
          [],
          new Set(),
          mockCallbacks,
        ),
      );

      const { steps } = result.current;
      expect(steps).toHaveLength(3);
      expect(steps.find(step => step.baseTitle === 'Manage Players')).toBeDefined();
      expect(steps.find(step => step.baseTitle === 'Court Settings')).toBeDefined();
    });

    it('should show "Court Assignments" step when assignments exist', () => {
      const { result } = renderHook(() =>
        useStepRegistry(
          mockPlayers,
          [mockCourt],
          new Set(),
          mockCallbacks,
        ),
      );

      const { steps } = result.current;
      expect(steps).toHaveLength(4);
      expect(steps.find(step => step.baseTitle === 'Court Assignments')).toBeDefined();
    });

    it('should filter out invisible steps and handle empty data correctly', () => {
      const { result } = renderHook(() =>
        useStepRegistry(
          [],
          [],
          new Set(),
          mockCallbacks,
        ),
      );

      const { steps } = result.current;
      expect(steps).toHaveLength(1);
      expect(steps[0].baseTitle).toBe('Add Players');
      expect(steps.every(step => step.isVisible)).toBe(true);
      expect(steps.find(step => step.baseTitle === 'Manage Players')).toBeUndefined();
      expect(steps.find(step => step.baseTitle === 'Court Settings')).toBeUndefined();
    });

    it('should only show Court Settings when at least one player is present', () => {
      const allAbsentPlayers = mockPlayers.map(p => ({ ...p, isPresent: false }));

      const { result } = renderHook(() =>
        useStepRegistry(
          allAbsentPlayers,
          [],
          new Set(),
          mockCallbacks,
        ),
      );

      const { steps } = result.current;
      expect(steps.find(step => step.baseTitle === 'Court Settings')).toBeUndefined();
    });
  });

  describe('Step Titles', () => {
    it('should return collapsed title when step is collapsed', () => {
      const collapsedSteps = new Set([1, 2]);

      const { result } = renderHook(() =>
        useStepRegistry(
          mockPlayers,
          [],
          collapsedSteps,
          mockCallbacks,
        ),
      );

      const { steps } = result.current;
      const addPlayersStep = steps.find(step => step.id === 1);
      const managePlayersStep = steps.find(step => step.id === 2);

      expect(addPlayersStep?.title).toBe('Add Players');
      expect(managePlayersStep?.title).toBe('Manage Players');
    });

    it('should return full title when step is expanded', () => {
      const collapsedSteps = new Set([1]);

      const { result } = renderHook(() =>
        useStepRegistry(
          mockPlayers,
          [],
          collapsedSteps,
          mockCallbacks,
        ),
      );

      const { steps } = result.current;
      const addPlayersStep = steps.find(step => step.id === 1);
      const managePlayersStep = steps.find(step => step.id === 2);

      expect(addPlayersStep?.title).toBe('Add Players');
      expect(managePlayersStep?.title).toBe('Step 2: Manage Players');
    });

    it('should handle Court Assignments title correctly', () => {
      const { result } = renderHook(() =>
        useStepRegistry(
          mockPlayers,
          [mockCourt],
          new Set(),
          mockCallbacks,
        ),
      );

      const { steps } = result.current;
      const courtAssignmentsStep = steps.find(step => step.id === 4);
      expect(courtAssignmentsStep?.title).toBe('Step 4: Court Assignments');
    });
  });

  describe('Step Collapse State', () => {
    it('should correctly identify collapsed steps', () => {
      const collapsedSteps = new Set([2, 3]);

      const { result } = renderHook(() =>
        useStepRegistry(
          mockPlayers,
          [],
          collapsedSteps,
          mockCallbacks,
        ),
      );

      const { steps } = result.current;

      expect(steps.find(step => step.id === 1)?.isCollapsed).toBe(false);
      expect(steps.find(step => step.id === 2)?.isCollapsed).toBe(true);
      expect(steps.find(step => step.id === 3)?.isCollapsed).toBe(true);
    });

    it('should return correct hasCollapsedSteps flag', () => {
      const collapsedSteps = new Set([2]);

      const { result } = renderHook(() =>
        useStepRegistry(
          mockPlayers,
          [],
          collapsedSteps,
          mockCallbacks,
        ),
      );

      expect(result.current.hasCollapsedSteps).toBe(true);
    });

    it('should return false for hasCollapsedSteps when no steps are collapsed', () => {
      const { result } = renderHook(() =>
        useStepRegistry(
          mockPlayers,
          [],
          new Set(),
          mockCallbacks,
        ),
      );

      expect(result.current.hasCollapsedSteps).toBe(false);
    });

    it('should return correct collapsedSteps array', () => {
      const collapsedSteps = new Set([1, 3]);

      const { result } = renderHook(() =>
        useStepRegistry(
          mockPlayers,
          [],
          collapsedSteps,
          mockCallbacks,
        ),
      );

      const { collapsedSteps: collapsedStepsData } = result.current;
      expect(collapsedStepsData).toHaveLength(2);
      expect(collapsedStepsData.map(step => step.id)).toEqual([1, 3]);
    });
  });

  describe('Step Actions', () => {
    it('should include correct actions for Manage Players step', () => {
      const { result } = renderHook(() =>
        useStepRegistry(
          mockPlayers,
          [],
          new Set(),
          mockCallbacks,
        ),
      );

      const { steps } = result.current;
      const managePlayersStep = steps.find(step => step.id === 2);

      expect(managePlayersStep?.actions).toHaveLength(2);
      expect(managePlayersStep?.actions?.[0].label).toBe('Clear All Players');
      expect(managePlayersStep?.actions?.[0].isDestructive).toBe(true);
      expect(managePlayersStep?.actions?.[1].label).toBe('Reset Algorithm');
      expect(managePlayersStep?.actions?.[1].isDestructive).toBe(false);
    });

    it('should include correct actions for Court Assignments step', () => {
      const { result } = renderHook(() =>
        useStepRegistry(
          mockPlayers,
          [mockCourt],
          new Set(),
          mockCallbacks,
        ),
      );

      const { steps } = result.current;
      const courtAssignmentsStep = steps.find(step => step.id === 4);

      expect(courtAssignmentsStep?.actions).toHaveLength(1);
      expect(courtAssignmentsStep?.actions?.[0].label).toBe('Generate New Assignments');
      expect(courtAssignmentsStep?.actions?.[0].isDestructive).toBe(false);
    });

    it('should call correct callback when action is triggered', () => {
      const { result } = renderHook(() =>
        useStepRegistry(
          mockPlayers,
          [],
          new Set(),
          mockCallbacks,
        ),
      );

      const { steps } = result.current;
      const managePlayersStep = steps.find(step => step.id === 2);

      act(() => {
        managePlayersStep?.actions?.[0].onClick();
      });

      expect(mockCallbacks.handleClearAllPlayers).toHaveBeenCalledTimes(1);

      act(() => {
        managePlayersStep?.actions?.[1].onClick();
      });

      expect(mockCallbacks.handleResetAlgorithm).toHaveBeenCalledTimes(1);
    });
  });

  describe('Toggle Step Function', () => {
    it('should add step to collapsed set when not present', () => {
      const mockSetCollapsedSteps = vi.fn();
      const { result } = renderHook(() =>
        useStepRegistry(
          mockPlayers,
          [],
          new Set([1]),
          mockCallbacks,
        ),
      );

      act(() => {
        result.current.toggleStep(2, mockSetCollapsedSteps);
      });

      expect(mockSetCollapsedSteps).toHaveBeenCalledTimes(1);
      const setterCallback = mockSetCollapsedSteps.mock.calls[0][0];
      const newSet = setterCallback(new Set([1]));
      expect(newSet.has(2)).toBe(true);
      expect(newSet.has(1)).toBe(true);
    });

    it('should remove step from collapsed set when present', () => {
      const mockSetCollapsedSteps = vi.fn();
      const { result } = renderHook(() =>
        useStepRegistry(
          mockPlayers,
          [],
          new Set([1, 2]),
          mockCallbacks,
        ),
      );

      act(() => {
        result.current.toggleStep(2, mockSetCollapsedSteps);
      });

      expect(mockSetCollapsedSteps).toHaveBeenCalledTimes(1);
      const setterCallback = mockSetCollapsedSteps.mock.calls[0][0];
      const newSet = setterCallback(new Set([1, 2]));
      expect(newSet.has(2)).toBe(false);
      expect(newSet.has(1)).toBe(true);
    });
  });


  describe('Edge Cases', () => {
    it('should handle all steps collapsed', () => {
      const { result } = renderHook(() =>
        useStepRegistry(
          mockPlayers,
          [mockCourt],
          new Set([1, 2, 3, 4]),
          mockCallbacks,
        ),
      );

      expect(result.current.hasCollapsedSteps).toBe(true);
      expect(result.current.collapsedSteps).toHaveLength(4);
    });

    it('should handle missing actions gracefully', () => {
      const { result } = renderHook(() =>
        useStepRegistry(
          mockPlayers,
          [],
          new Set(),
          mockCallbacks,
        ),
      );

      const { steps } = result.current;
      const addPlayersStep = steps.find(step => step.id === 1);
      const courtSettingsStep = steps.find(step => step.id === 3);

      expect(addPlayersStep?.actions).toBeUndefined();
      expect(courtSettingsStep?.actions).toBeUndefined();
    });
  });

  describe('Integration with App State', () => {
    it('should react to changes in player state', () => {
      const { result, rerender } = renderHook(
        ({ players }) =>
          useStepRegistry(
            players,
            [],
            new Set(),
            mockCallbacks,
          ),
        { initialProps: { players: [] as Player[] } },
      );

      expect(result.current.steps).toHaveLength(1);

      rerender({ players: mockPlayers });
      expect(result.current.steps).toHaveLength(3);
    });

    it('should react to changes in assignments state', () => {
      const { result, rerender } = renderHook(
        ({ assignments }) =>
          useStepRegistry(
            mockPlayers,
            assignments,
            new Set(),
            mockCallbacks,
          ),
        { initialProps: { assignments: [] as Court[] } },
      );

      expect(result.current.steps).toHaveLength(3);

      rerender({ assignments: [mockCourt] });
      expect(result.current.steps).toHaveLength(4);
    });

    it('should react to changes in collapsed state', () => {
      const { result, rerender } = renderHook(
        ({ collapsedSteps }) =>
          useStepRegistry(
            mockPlayers,
            [],
            collapsedSteps,
            mockCallbacks,
          ),
        { initialProps: { collapsedSteps: new Set<number>() } },
      );

      expect(result.current.hasCollapsedSteps).toBe(false);

      rerender({ collapsedSteps: new Set([1, 2]) });
      expect(result.current.hasCollapsedSteps).toBe(true);
      expect(result.current.collapsedSteps).toHaveLength(2);
    });
  });
});
