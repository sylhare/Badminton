import React from 'react';

import type { SetScore, TournamentType } from '../../tournament/types';
import type { Tournament } from '../../tournament/Tournament';
import type { RoundRobinTournament } from '../../tournament/RoundRobinTournament';
import type { EliminationTournament } from '../../tournament/EliminationTournament';
import type { GroupKnockoutTournament } from '../../tournament/GroupKnockoutTournament';

import { RoundRobinMatches } from './round-robin/RoundRobinMatches';
import { EliminationBracket } from './elimination/EliminationBracket';
import { GroupKnockout } from './GroupKnockout';

type OnMatchResult = (matchId: string, winner: 1 | 2, sets?: SetScore[]) => void;

export interface TournamentKind {
  /** Label for the mode-selector pill. */
  label: string;
  /**
   * Render this format's matches view. The cast is safe because the key is taken
   * from `tournament.state().type`, which always matches the concrete class.
   */
  renderMatches: (tournament: Tournament, onMatchResult: OnMatchResult) => React.ReactNode;
}

/**
 * Per-format view wiring. Presentation *policy* (subtitles, which tables to show)
 * lives on the tournament classes; this registry only maps a format to its React
 * views so the Tournament component can render any format without branching.
 * Insertion order is the order the mode pills appear in.
 */
export const TOURNAMENT_KINDS: Record<TournamentType, TournamentKind> = {
  'round-robin': {
    label: 'Round Robin',
    renderMatches: (t, onMatchResult) => (
      <RoundRobinMatches tournament={t as RoundRobinTournament} onMatchResult={onMatchResult} />
    ),
  },
  elimination: {
    label: 'Elimination',
    renderMatches: (t, onMatchResult) => (
      <EliminationBracket tournament={t as EliminationTournament} onMatchResult={onMatchResult} />
    ),
  },
  'group-knockout': {
    label: 'Groups + Knockout',
    renderMatches: (t, onMatchResult) => (
      <GroupKnockout tournament={t as GroupKnockoutTournament} onMatchResult={onMatchResult} />
    ),
  },
};

export const TOURNAMENT_TYPES = Object.keys(TOURNAMENT_KINDS) as TournamentType[];
