import type { Court, Player } from '../../src/App';

export const TEST_PLAYERS: Player[] = [
  { id: '1', name: 'Alice', isPresent: true },
  { id: '2', name: 'Bob', isPresent: true },
  { id: '3', name: 'Charlie', isPresent: true },
  { id: '4', name: 'Diana', isPresent: true },
  { id: '5', name: 'Eve', isPresent: true },
  { id: '6', name: 'Frank', isPresent: true },
];

const createDoublesWithTeams = (players: Player[] = TEST_PLAYERS): Court => ({
  courtNumber: 1,
  players: players.slice(0, 4),
  teams: {
    team1: players.slice(0, 2),
    team2: players.slice(2, 4),
  },
});

const createSinglesWithTeams = (players: Player[] = TEST_PLAYERS): Court => ({
  courtNumber: 1,
  players: players.slice(0, 2),
  teams: {
    team1: [players[0]],
    team2: [players[1]],
  },
});

export const TEST_COURTS = {
  doublesWithTeams: createDoublesWithTeams,

  singlesWithTeams: createSinglesWithTeams,

  withWinner: (teamNumber: 1 | 2, players: Player[] = TEST_PLAYERS): Court => ({
    ...createDoublesWithTeams(players),
    winner: teamNumber,
  }),

  withoutTeams: (players: Player[] = TEST_PLAYERS): Court => ({
    courtNumber: 1,
    players: players.slice(0, 2),
  }),
};
