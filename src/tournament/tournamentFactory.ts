import { RoundRobinTournament } from './RoundRobinTournament';
import { EliminationTournament } from './EliminationTournament';
import { GroupKnockoutTournament } from './GroupKnockoutTournament';
import type { TournamentFormat, TournamentState, TournamentType } from './types';

/** Any concrete tournament instance. */
export type AnyTournament = RoundRobinTournament | EliminationTournament | GroupKnockoutTournament;

export interface CreateTournamentOptions {
  format: TournamentFormat;
  numberOfCourts: number;
  bestOf: number;
  setSize?: number;
  groupSize?: number;
  qualifiersPerGroup?: number;
}

interface TournamentFactory {
  create: (options: CreateTournamentOptions) => AnyTournament;
  fromState: (state: TournamentState) => AnyTournament;
}

/** Per-format construction strategy: build a fresh tournament, or rebuild one from persisted state. */
export const TOURNAMENT_FACTORY: Record<TournamentType, TournamentFactory> = {
  'round-robin': {
    create: o => RoundRobinTournament.create(o.format, o.numberOfCourts, o.bestOf, o.setSize),
    fromState: RoundRobinTournament.fromState,
  },
  elimination: {
    create: o => EliminationTournament.create(o.format, o.numberOfCourts, o.bestOf, o.setSize),
    fromState: EliminationTournament.fromState,
  },
  'group-knockout': {
    create: o =>
      GroupKnockoutTournament.create(
        o.format, o.numberOfCourts, o.bestOf, o.groupSize, o.qualifiersPerGroup, o.setSize,
      ),
    fromState: GroupKnockoutTournament.fromState,
  },
};
