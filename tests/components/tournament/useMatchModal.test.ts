import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useMatchModal } from '../../../src/components/tournament/useMatchModal';
import { createTournamentTeam, createTournamentMatch } from '../../data/testFactories';

const teamA = createTournamentTeam('a', ['Alice']);
const teamB = createTournamentTeam('b', ['Bob']);

describe('useMatchModal', () => {
  it('initialises with no open modal', () => {
    const { result } = renderHook(() => useMatchModal(vi.fn()));

    expect(result.current.modalMatch).toBeNull();
    expect(result.current.pendingWinner).toBeNull();
  });

  describe('handleTeamClick', () => {
    it('opens modal when team has no winner yet', () => {
      const match = createTournamentMatch('m1', 1, teamA, teamB);
      const { result } = renderHook(() => useMatchModal(vi.fn()));

      act(() => result.current.handleTeamClick(match, 1));

      expect(result.current.modalMatch).toBe(match);
      expect(result.current.pendingWinner).toBe(1);
    });

    it('calls onMatchResult directly when clicking the current winner (deselect)', () => {
      const match = createTournamentMatch('m1', 1, teamA, teamB, 1);
      const onMatchResult = vi.fn();
      const { result } = renderHook(() => useMatchModal(onMatchResult));

      act(() => result.current.handleTeamClick(match, 1));

      expect(onMatchResult).toHaveBeenCalledWith('m1', 1);
      expect(result.current.modalMatch).toBeNull();
    });

    it('opens modal when clicking a different team than the current winner', () => {
      const match = createTournamentMatch('m1', 1, teamA, teamB, 1);
      const { result } = renderHook(() => useMatchModal(vi.fn()));

      act(() => result.current.handleTeamClick(match, 2));

      expect(result.current.modalMatch).toBe(match);
      expect(result.current.pendingWinner).toBe(2);
    });
  });

  describe('handleModalConfirm', () => {
    it('calls onMatchResult with match id, winner, and score, then closes modal', () => {
      const match = createTournamentMatch('m1', 1, teamA, teamB);
      const onMatchResult = vi.fn();
      const { result } = renderHook(() => useMatchModal(onMatchResult));

      act(() => result.current.handleTeamClick(match, 2));
      act(() => result.current.handleModalConfirm({ team1: 21, team2: 15 }));

      expect(onMatchResult).toHaveBeenCalledWith('m1', 2, { team1: 21, team2: 15 });
      expect(result.current.modalMatch).toBeNull();
      expect(result.current.pendingWinner).toBeNull();
    });

    it('does nothing if called without a pending match', () => {
      const onMatchResult = vi.fn();
      const { result } = renderHook(() => useMatchModal(onMatchResult));

      act(() => result.current.handleModalConfirm({ team1: 21, team2: 15 }));

      expect(onMatchResult).not.toHaveBeenCalled();
    });
  });

  describe('handleModalCancel', () => {
    it('closes modal without calling onMatchResult', () => {
      const match = createTournamentMatch('m1', 1, teamA, teamB);
      const onMatchResult = vi.fn();
      const { result } = renderHook(() => useMatchModal(onMatchResult));

      act(() => result.current.handleTeamClick(match, 1));
      act(() => result.current.handleModalCancel());

      expect(onMatchResult).not.toHaveBeenCalled();
      expect(result.current.modalMatch).toBeNull();
      expect(result.current.pendingWinner).toBeNull();
    });
  });
});
