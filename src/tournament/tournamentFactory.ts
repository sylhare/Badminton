import { RoundRobinTournament } from './RoundRobinTournament';
import { EliminationTournament } from './EliminationTournament';
import { GroupKnockoutTournament } from './GroupKnockoutTournament';
import type { TournamentCreateOptions, TournamentFormat, TournamentState, TournamentType } from './types';

/** Any concrete tournament instance. */
export type AnyTournament = RoundRobinTournament | EliminationTournament | GroupKnockoutTournament;

/** A `TournamentCreateOptions` plus the format `type`, so the factory can pick the right class. */
export interface CreateTournamentOptions extends TournamentCreateOptions {
  type: TournamentType;
  format: TournamentFormat;
  numberOfCourts: number;
  bestOf: number;
}

interface TournamentFactory {
  create: (options: CreateTournamentOptions) => AnyTournament;
  fromState: (state: TournamentState) => AnyTournament;
}

/** Per-format construction strategy: build a fresh tournament, or rebuild one from persisted state. */
export const TOURNAMENT_FACTORY: Record<TournamentType, TournamentFactory> = {
  'round-robin': {
    create: o => RoundRobinTournament.create(o),
    fromState: RoundRobinTournament.fromState,
  },
  elimination: {
    create: o => EliminationTournament.create(o),
    fromState: EliminationTournament.fromState,
  },
  'group-knockout': {
    create: o => GroupKnockoutTournament.create(o),
    fromState: GroupKnockoutTournament.fromState,
  },
};
