import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, waitFor } from '@testing-library/react';

import type { Court, GenerateResult, Player, UpdateWinnerParams } from '../../src/types';
import type { TournamentTeam } from '../../src/tournament/types';
import { RoundRobinTournament } from '../../src/tournament/RoundRobinTournament';
import { tournamentToScoredGames } from '../../src/engines/levelAdapters';
import { captureAppState, clearTestState, flushPendingSaves, renderWithProvider } from '../shared';
import { storageManager } from '../../src/utils/StorageManager';

const { appState, Capture } = captureAppState();

const alice: Player = { id: '1', name: 'Alice', isPresent: true, level: 50 };
const bob: Player = { id: '2', name: 'Bob', isPresent: true, level: 50 };
const carol: Player = { id: '3', name: 'Carol', isPresent: true, level: 50 };

async function setup(players: Player[] = [alice, bob]) {
  renderWithProvider(<Capture />);
  await waitFor(() => expect(appState.current?.isLoaded).toBe(true));
  await act(async () => { appState.current!.setPlayers(players); });
}

describe('AppStateProvider', () => {
  beforeEach(async () => {
    appState.current = null;
    await clearTestState();
  });
  afterEach(async () => await clearTestState());

  describe('generate', () => {
    it('returns a GenerateResult with a committed flag', async () => {
      renderWithProvider(<Capture />);
      await waitFor(() => expect(appState.current?.isLoaded).toBe(true));

      let result: GenerateResult;
      act(() => { result = appState.current!.generate([], 2, []); });

      expect(Array.isArray(result!.courts)).toBe(true);
      expect(typeof result!.committed).toBe('boolean');
    });

    it('updates player levels when previous courts had winners', async () => {
      const courtWithWinner: Court = {
        courtNumber: 1,
        players: [alice, bob],
        teams: { team1: [alice], team2: [bob] },
        winner: 1,
      };

      await setup([alice, bob]);

      act(() => { appState.current!.generate([alice, bob], 1, [courtWithWinner]); });

      await waitFor(() => {
        expect(appState.current!.players.find(p => p.id === '1')?.level).toBeGreaterThan(50);
        expect(appState.current!.players.find(p => p.id === '2')?.level).toBeLessThan(50);
      });
    });

    it('does not update player levels on rapid re-generation', async () => {
      const courtWithWinner: Court = {
        courtNumber: 1,
        players: [alice, bob],
        teams: { team1: [alice], team2: [bob] },
        winner: 1,
      };

      await setup([alice, bob]);

      act(() => { appState.current!.generate([alice, bob], 1, [courtWithWinner]); });
      await waitFor(() => {
        expect(appState.current!.players.find(p => p.id === '1')?.level).toBeGreaterThan(50);
      });
      const aliceLevel = appState.current!.players.find(p => p.id === '1')!.level;

      act(() => { appState.current!.generate([alice, bob], 1, [courtWithWinner]); });
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });

      expect(appState.current!.players.find(p => p.id === '1')?.level).toBe(aliceLevel);
    });
  });

  describe('updateWinner', () => {
    it('returns the courts with the winner set on the matching court', async () => {
      const court: Court = { courtNumber: 1, players: [] };
      renderWithProvider(<Capture />);
      await waitFor(() => expect(appState.current?.isLoaded).toBe(true));

      const params: UpdateWinnerParams = { courtNumber: 1, winner: 1, currentAssignments: [court] };
      let returned: Court[];
      act(() => { returned = appState.current!.updateWinner(params); });

      expect(returned!.find(c => c.courtNumber === 1)?.winner).toBe(1);
    });
  });

  describe('saveState', () => {
    it('persists state so it can be read back from storage', async () => {
      renderWithProvider(<Capture />);
      await waitFor(() => expect(appState.current?.isLoaded).toBe(true));

      await act(async () => { await appState.current!.saveState(); });
      await flushPendingSaves();

      expect(await storageManager.loadApp()).toBeDefined();
    });
  });

  describe('resetAlgorithm', () => {
    it('clears accumulated stats', async () => {
      const players: Player[] = [{ id: '1', name: 'Alice', isPresent: true }];
      renderWithProvider(<Capture />);
      await waitFor(() => expect(appState.current?.isLoaded).toBe(true));

      act(() => { appState.current!.generate(players, 2, []); });
      await waitFor(() => expect(appState.current!.benchCounts.size).toBeGreaterThan(0));

      await act(async () => { await appState.current!.resetAlgorithm(); });

      await waitFor(() => {
        expect(appState.current!.winCounts.size).toBe(0);
        expect(appState.current!.benchCounts.size).toBe(0);
      });
    });
  });

  describe('applyGameResults', () => {
    const court = (winner: 1 | 2): Court => ({
      courtNumber: 1,
      players: [alice, bob],
      teams: { team1: [alice], team2: [bob] },
      winner,
      score: { team1: winner === 1 ? 21 : 10, team2: winner === 2 ? 21 : 10 },
    });

    it('replays from baseline into the winner/loser levels', async () => {
      await setup([alice, bob]);
      act(() => { appState.current!.applyGameResults([{ court: court(1) }], [alice, bob]); });
      await waitFor(() => {
        expect(appState.current!.players.find(p => p.id === '1')!.level!).toBeGreaterThan(50);
        expect(appState.current!.players.find(p => p.id === '2')!.level!).toBeLessThan(50);
      });
    });

    it('is idempotent — applying the same baseline twice yields the same levels', async () => {
      await setup([alice, bob]);
      act(() => { appState.current!.applyGameResults([{ court: court(1) }], [alice, bob]); });
      await waitFor(() => expect(appState.current!.players.find(p => p.id === '1')!.level).not.toBe(50));
      const once = appState.current!.players.find(p => p.id === '1')!.level;

      act(() => { appState.current!.applyGameResults([{ court: court(1) }], [alice, bob]); });
      await waitFor(() => expect(appState.current!.players.find(p => p.id === '1')!.level).toBe(once));
    });

    it('reverts cleanly when the winner flips (replay always starts from baseline)', async () => {
      await setup([alice, bob]);
      act(() => { appState.current!.applyGameResults([{ court: court(1) }], [alice, bob]); });
      await waitFor(() => expect(appState.current!.players.find(p => p.id === '1')!.level!).toBeGreaterThan(50));

      act(() => { appState.current!.applyGameResults([{ court: court(2) }], [alice, bob]); });
      await waitFor(() => expect(appState.current!.players.find(p => p.id === '1')!.level!).toBeLessThan(50));
    });

    it('leaves non-participants untouched', async () => {
      await setup([alice, bob, carol]);
      act(() => { appState.current!.applyGameResults([{ court: court(1) }], [alice, bob]); });
      await waitFor(() => expect(appState.current!.players.find(p => p.id === '1')!.level).not.toBe(50));
      expect(appState.current!.players.find(p => p.id === '3')!.level).toBe(50);
    });

    it('preserves live name/gender/presence, merging only the Elo fields', async () => {
      const staleAlice: Player = { id: '1', name: 'OLD', isPresent: true, level: 50 };
      const liveAlice: Player = { id: '1', name: 'Alice Renamed', gender: 'F', isPresent: false, level: 50 };
      await setup([liveAlice, bob]);
      act(() => { appState.current!.applyGameResults([{ court: court(1) }], [staleAlice, bob]); });
      await waitFor(() => expect(appState.current!.players.find(p => p.id === '1')!.level).not.toBe(50));

      const merged = appState.current!.players.find(p => p.id === '1')!;
      expect(merged.name).toBe('Alice Renamed');
      expect(merged.gender).toBe('F');
      expect(merged.isPresent).toBe(false);
    });

    it('records no phantom Elo for players absent from the roster (e.g. cleared)', async () => {
      await setup([]);
      act(() => { appState.current!.applyGameResults([{ court: court(1) }], [alice, bob]); });
      await waitFor(() => expect(appState.current!.isLoaded).toBe(true));
      expect(appState.current!.players).toHaveLength(0);
      expect(appState.current!.engineState?.levelHistory?.['1']).toBeUndefined();
    });
  });

  describe('tournament Elo integration (real adapter → replay, as TournamentPage wires it)', () => {
    function singlesTournament() {
      const teamA: TournamentTeam = { id: 'a', players: [alice] };
      const teamB: TournamentTeam = { id: 'b', players: [bob] };
      return RoundRobinTournament.create('singles', 1).start([teamA, teamB], 1);
    }

    function applyResult(tournament: RoundRobinTournament) {
      const { baseline, games } = tournamentToScoredGames(tournament);
      act(() => { appState.current!.applyGameResults(games, baseline); });
    }

    const levelOf = (id: string) => appState.current!.players.find(p => p.id === id)!.level!;

    it('records a tournament win into player Elo — winner up, loser down', async () => {
      await setup();
      const t = singlesTournament();
      const match = t.matches()[0];
      const winnerId = match.team1.players[0].id;
      const loserId = match.team2.players[0].id;

      applyResult(t.withMatchResult(match.id, 1, { team1: 21, team2: 10 }));

      await waitFor(() => {
        expect(levelOf(winnerId)).toBeGreaterThan(50);
        expect(levelOf(loserId)).toBeLessThan(50);
      });
    });

    it('reverts through the adapter when the match winner is edited', async () => {
      await setup();
      const t = singlesTournament();
      const match = t.matches()[0];
      const team1Id = match.team1.players[0].id;

      applyResult(t.withMatchResult(match.id, 1, { team1: 21, team2: 10 }));
      await waitFor(() => expect(levelOf(team1Id)).toBeGreaterThan(50));

      applyResult(t.withMatchResult(match.id, 2, { team1: 10, team2: 21 }));
      await waitFor(() => expect(levelOf(team1Id)).toBeLessThan(50));
    });

    it('applies length-aware Elo for a shorter (to 15) tournament match', async () => {
      await setup();
      const t = singlesTournament();
      const winnerId = t.matches()[0].team1.players[0].id;

      applyResult(t.withMatchResult(t.matches()[0].id, 1, { team1: 15, team2: 2 }));
      await waitFor(() => expect(levelOf(winnerId)).toBeGreaterThan(50));
    });

    it('records a level-history snapshot so tournament Elo surfaces on the Stats graph', async () => {
      await setup();
      const t = singlesTournament();
      const match = t.matches()[0];
      const winnerId = match.team1.players[0].id;

      applyResult(t.withMatchResult(match.id, 1, { team1: 21, team2: 10 }));

      await waitFor(() => {
        const history = appState.current!.engineState?.levelHistory?.[winnerId];
        expect(history).toBeDefined();
        expect(history![history!.length - 1]).toBeGreaterThan(50);
      });
    });
  });
});
