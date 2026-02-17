/** Records a single match with team compositions, strengths, and outcome. */
export type MatchEvent = {
  simulationId: number;
  roundIndex: number;
  courtIndex: number;
  team1Players: string;
  team2Players: string;
  team1Strength: number;
  team2Strength: number;
  strengthDifferential: number;
  winner: 1 | 2;
  strongerTeamWon: boolean;
  team1EngineWins: number;
  team2EngineWins: number;
  engineWinDifferential: number;
  engineBalancedTeamWon: boolean;
};

/** Aggregate statistics for a player across all simulations. */
export type PlayerStats = {
  playerId: string;
  level: number;
  totalWins: number;
  totalLosses: number;
  gamesPlayed: number;
};

/** Aggregate bench fairness statistics for a session. */
export type SessionBenchStats = {
  simulationId: number;
  numPlayers: number;
  maxBenchCount: number;
  minBenchCount: number;
  benchRange: number;
  avgBenchCount: number;
  meanGap: number;
  doubleBenchCount: number;
  totalGapEvents: number;
};

/** Tracks when two players were in the same match. */
export type MatchPairEvent = {
  simulationId: number;
  roundIndex: number;
  pairId: string;
  wasTeammate: boolean;
};

/** Summary of repeat pair statistics for a simulation. */
export type SimulationSummary = {
  simulationId: number;
  rounds: number;
  repeatAnyPair: boolean;
  repeatPairDifferentOpponents: boolean;
  repeatPairSameOpponents: boolean;
  repeatPairCount: number;
  repeatPairDifferentOpponentsCount: number;
  repeatPairSameOpponentsCount: number;
};

/** Records when a team pairing was repeated across rounds. */
export type PairEvent = {
  simulationId: number;
  fromRound: number;
  toRound: number;
  pairId: string;
  opponentFrom: string;
  opponentTo: string;
  opponentChanged: boolean;
};

/** Results extracted from a single round. */
export type RoundResult = {
  roundIndex: number;
  pairToOpponent: Map<string, string>;
  matchEvents: MatchEvent[];
  matchPairEvents: MatchPairEvent[];
};

/** Simulation configuration from config.json */
export type SimulationConfig = {
  runs: number;
  rounds: number;
  playerCounts: number[];
  numCourts: number;
};
