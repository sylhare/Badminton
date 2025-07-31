import { describe, it, expect } from 'vitest';
import type { Court, Player } from '../../src/App';

describe('Court Interface', () => {
  const mockPlayers: Player[] = [
    { id: '1', name: 'Alice', isPresent: true },
    { id: '2', name: 'Bob', isPresent: true },
    { id: '3', name: 'Charlie', isPresent: true },
    { id: '4', name: 'Diana', isPresent: true },
  ];

  it('should create a basic court without teams', () => {
    const court: Court = {
      courtNumber: 1,
      players: mockPlayers.slice(0, 2),
    };

    expect(court.courtNumber).toBe(1);
    expect(court.players).toHaveLength(2);
    expect(court.teams).toBeUndefined();
    expect(court.winner).toBeUndefined();
  });

  it('should create a court with teams but no winner', () => {
    const court: Court = {
      courtNumber: 2,
      players: mockPlayers,
      teams: {
        team1: [mockPlayers[0], mockPlayers[1]],
        team2: [mockPlayers[2], mockPlayers[3]],
      },
    };

    expect(court.courtNumber).toBe(2);
    expect(court.players).toHaveLength(4);
    expect(court.teams).toBeDefined();
    expect(court.teams!.team1).toHaveLength(2);
    expect(court.teams!.team2).toHaveLength(2);
    expect(court.winner).toBeUndefined();
  });

  it('should create a court with team1 as winner', () => {
    const court: Court = {
      courtNumber: 3,
      players: mockPlayers,
      teams: {
        team1: [mockPlayers[0], mockPlayers[1]],
        team2: [mockPlayers[2], mockPlayers[3]],
      },
      winner: 1,
    };

    expect(court.winner).toBe(1);
    expect(typeof court.winner).toBe('number');
  });

  it('should create a court with team2 as winner', () => {
    const court: Court = {
      courtNumber: 4,
      players: mockPlayers,
      teams: {
        team1: [mockPlayers[0], mockPlayers[1]],
        team2: [mockPlayers[2], mockPlayers[3]],
      },
      winner: 2,
    };

    expect(court.winner).toBe(2);
    expect(typeof court.winner).toBe('number');
  });

  it('should create a singles court with winner', () => {
    const court: Court = {
      courtNumber: 5,
      players: mockPlayers.slice(0, 2),
      teams: {
        team1: [mockPlayers[0]],
        team2: [mockPlayers[1]],
      },
      winner: 1,
    };

    expect(court.teams!.team1).toHaveLength(1);
    expect(court.teams!.team2).toHaveLength(1);
    expect(court.winner).toBe(1);
  });

  it('should allow winner to be undefined (cleared)', () => {
    const court: Court = {
      courtNumber: 6,
      players: mockPlayers,
      teams: {
        team1: [mockPlayers[0], mockPlayers[1]],
        team2: [mockPlayers[2], mockPlayers[3]],
      },
      winner: undefined,
    };

    expect(court.winner).toBeUndefined();
  });

  it('should handle court with empty teams', () => {
    const court: Court = {
      courtNumber: 7,
      players: [],
      teams: {
        team1: [],
        team2: [],
      },
      winner: undefined,
    };

    expect(court.teams!.team1).toHaveLength(0);
    expect(court.teams!.team2).toHaveLength(0);
    expect(court.winner).toBeUndefined();
  });

  it('should maintain type safety for winner field', () => {
    // TypeScript should enforce that winner can only be 1, 2, or undefined
    const validWinners: (1 | 2 | undefined)[] = [1, 2, undefined];
    
    validWinners.forEach((winner) => {
      const court: Court = {
        courtNumber: 8,
        players: mockPlayers,
        teams: {
          team1: [mockPlayers[0]],
          team2: [mockPlayers[1]],
        },
        winner,
      };

      if (winner !== undefined) {
        expect([1, 2]).toContain(court.winner);
      } else {
        expect(court.winner).toBeUndefined();
      }
    });
  });

  it('should work with complex team arrangements', () => {
    const court: Court = {
      courtNumber: 9,
      players: mockPlayers,
      teams: {
        team1: [mockPlayers[0]], // singles player
        team2: [mockPlayers[1], mockPlayers[2], mockPlayers[3]], // 3 players (unusual but valid)
      },
      winner: 2,
    };

    expect(court.teams!.team1).toHaveLength(1);
    expect(court.teams!.team2).toHaveLength(3);
    expect(court.winner).toBe(2);
  });

  describe('Court state transitions', () => {
    it('should handle winner state changes', () => {
      let court: Court = {
        courtNumber: 10,
        players: mockPlayers.slice(0, 2),
        teams: {
          team1: [mockPlayers[0]],
          team2: [mockPlayers[1]],
        },
      };

      // Initially no winner
      expect(court.winner).toBeUndefined();

      // Set team1 as winner
      court = { ...court, winner: 1 };
      expect(court.winner).toBe(1);

      // Switch to team2 as winner
      court = { ...court, winner: 2 };
      expect(court.winner).toBe(2);

      // Clear winner
      court = { ...court, winner: undefined };
      expect(court.winner).toBeUndefined();
    });

    it('should maintain data integrity when updating winner', () => {
      const originalCourt: Court = {
        courtNumber: 11,
        players: mockPlayers,
        teams: {
          team1: [mockPlayers[0], mockPlayers[1]],
          team2: [mockPlayers[2], mockPlayers[3]],
        },
      };

      const updatedCourt: Court = {
        ...originalCourt,
        winner: 1,
      };

      // Original court should remain unchanged
      expect(originalCourt.winner).toBeUndefined();
      expect(updatedCourt.winner).toBe(1);

      // Other properties should remain the same
      expect(updatedCourt.courtNumber).toBe(originalCourt.courtNumber);
      expect(updatedCourt.players).toBe(originalCourt.players);
      expect(updatedCourt.teams).toBe(originalCourt.teams);
    });
  });

  describe('Edge cases', () => {
    it('should handle court with winner but no teams', () => {
      const court: Court = {
        courtNumber: 12,
        players: mockPlayers.slice(0, 2),
        winner: 1, // This is technically valid but logically inconsistent
      };

      expect(court.winner).toBe(1);
      expect(court.teams).toBeUndefined();
    });

    it('should handle court with many players', () => {
      const manyPlayers: Player[] = Array.from({ length: 10 }, (_, i) => ({
        id: `player-${i}`,
        name: `Player ${i}`,
        isPresent: true,
      }));

      const court: Court = {
        courtNumber: 13,
        players: manyPlayers,
        teams: {
          team1: manyPlayers.slice(0, 5),
          team2: manyPlayers.slice(5, 10),
        },
        winner: 2,
      };

      expect(court.players).toHaveLength(10);
      expect(court.teams!.team1).toHaveLength(5);
      expect(court.teams!.team2).toHaveLength(5);
      expect(court.winner).toBe(2);
    });
  });
}); 