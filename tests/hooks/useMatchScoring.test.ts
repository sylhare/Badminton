import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useMatchScoring } from '../../src/hooks/useMatchScoring';
import { makeMatch, makeTeam } from '../data/tournamentFactories';

const teamA = makeTeam('a', ['Alice']);
const teamB = makeTeam('b', ['Bob']);

describe('useMatchScoring', () => {
  it('handleTeamClick opens modal with correct match and pending winner', () => {
    const onMatchResult = vi.fn();
    const { result } = renderHook(() => useMatchScoring(onMatchResult));
    const match = makeMatch('m1', 1, teamA, teamB);

    act(() => { result.current.handleTeamClick(match, 1); });

    expect(result.current.modalMatch).toBe(match);
    expect(result.current.pendingWinner).toBe(1);
    expect(onMatchResult).not.toHaveBeenCalled();
  });

  it('handleTeamClick on current winner calls onMatchResult immediately without opening modal', () => {
    const onMatchResult = vi.fn();
    const { result } = renderHook(() => useMatchScoring(onMatchResult));
    const match = makeMatch('m1', 1, teamA, teamB, 1);

    act(() => { result.current.handleTeamClick(match, 1); });

    expect(result.current.modalMatch).toBeNull();
    expect(result.current.pendingWinner).toBeNull();
    expect(onMatchResult).toHaveBeenCalledWith('m1', 1);
  });

  it('handleModalConfirm calls onMatchResult with id, winner and score, then resets state', () => {
    const onMatchResult = vi.fn();
    const { result } = renderHook(() => useMatchScoring(onMatchResult));
    const match = makeMatch('m1', 1, teamA, teamB);

    act(() => { result.current.handleTeamClick(match, 2); });
    act(() => { result.current.handleModalConfirm({ team1: 21, team2: 15 }); });

    expect(onMatchResult).toHaveBeenCalledWith('m1', 2, { team1: 21, team2: 15 });
    expect(result.current.modalMatch).toBeNull();
    expect(result.current.pendingWinner).toBeNull();
  });

  it('handleModalConfirm is a no-op when there is no pending match', () => {
    const onMatchResult = vi.fn();
    const { result } = renderHook(() => useMatchScoring(onMatchResult));

    act(() => { result.current.handleModalConfirm({ team1: 21, team2: 15 }); });

    expect(onMatchResult).not.toHaveBeenCalled();
  });

  it('handleModalCancel resets state without calling onMatchResult', () => {
    const onMatchResult = vi.fn();
    const { result } = renderHook(() => useMatchScoring(onMatchResult));
    const match = makeMatch('m1', 1, teamA, teamB);

    act(() => { result.current.handleTeamClick(match, 1); });
    act(() => { result.current.handleModalCancel(); });

    expect(onMatchResult).not.toHaveBeenCalled();
    expect(result.current.modalMatch).toBeNull();
    expect(result.current.pendingWinner).toBeNull();
  });
});
