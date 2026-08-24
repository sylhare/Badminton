import React from 'react';

import type { OnMatchResult, TournamentTeam, TournamentType } from '../../tournament/types';
import type { Tournament } from '../../tournament/Tournament';
import type { RoundRobinTournament } from '../../tournament/RoundRobinTournament';
import type { EliminationTournament } from '../../tournament/EliminationTournament';
import { GroupKnockoutTournament } from '../../tournament/GroupKnockoutTournament';
import { NumberField } from '../common/NumberField';

import { RoundRobinMatches } from './round-robin/RoundRobinMatches';
import { EliminationBracket } from './elimination/EliminationBracket';
import { GroupKnockout } from './GroupKnockout';

type OnUpdateTournament = (next: Tournament) => void;

/** The format-specific setup fields (and their setters) a kind may read or render. */
export interface SetupConfig {
  groupSize: number;
  qualifiersPerGroup: number;
  setGroupSize: (n: number) => void;
  setQualifiersPerGroup: (n: number) => void;
}

export interface TournamentKind {
  /** Label for the mode-selector pill. */
  label: string;
  /**
   * Render this format's matches view. The cast is safe because the key is taken
   * from `tournament.state().type`, which always matches the concrete class.
   * `onUpdate` lets a view replace the whole tournament (e.g. a manual tie-break);
   * formats that never do so simply ignore it.
   */
  renderMatches: (
    tournament: Tournament,
    onMatchResult: OnMatchResult,
    onUpdate: OnUpdateTournament,
  ) => React.ReactNode;
  /** Peak concurrent matches per round for the setup court warning; defaults to the round-robin count. */
  matchesPerRound?: (teams: TournamentTeam[], config: SetupConfig) => number;
  /** Blocking setup error (e.g. too few qualifiers) that disables Start, else null. */
  validateSetup?: (teams: TournamentTeam[], config: SetupConfig) => string | null;
  /** Format-specific setup fields, rendered in the setup form under the shared ones. */
  renderSetupConfig?: (config: SetupConfig, teams: TournamentTeam[]) => React.ReactNode;
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
    renderMatches: (t, onMatchResult, onUpdate) => (
      <GroupKnockout
        tournament={t as GroupKnockoutTournament}
        onMatchResult={onMatchResult}
        onUpdateTournament={onUpdate as (next: GroupKnockoutTournament) => void}
      />
    ),
    matchesPerRound: (teams, c) => GroupKnockoutTournament.matchesPerRound(teams, c.groupSize),
    validateSetup: (teams, c) => GroupKnockoutTournament.validateConfig(teams, c.groupSize, c.qualifiersPerGroup),
    renderSetupConfig: (c, teams) => {
      const note = GroupKnockoutTournament.setupSummary(teams, c.groupSize, c.qualifiersPerGroup);
      return (
      <div className="setup-section" data-testid="group-knockout-config">
        <h3>Groups + Knockout</h3>
        <div className="group-knockout-fields">
          <label className="group-knockout-field">
            Teams per group
            <NumberField
              value={c.groupSize}
              min={2}
              onChange={next => {
                c.setGroupSize(next);
                c.setQualifiersPerGroup(Math.min(c.qualifiersPerGroup, next));
              }}
              testId="group-size-input"
            />
          </label>
          <label className="group-knockout-field">
            Qualifiers per group
            <NumberField
              value={c.qualifiersPerGroup}
              min={1}
              max={c.groupSize}
              onChange={c.setQualifiersPerGroup}
              testId="qualifiers-input"
            />
          </label>
        </div>
        {note && (
          <p className={`setup-${note.severity}`} data-testid="group-preview">
            {note.message}
          </p>
        )}
      </div>
      );
    },
  },
};

export const TOURNAMENT_TYPES = Object.keys(TOURNAMENT_KINDS) as TournamentType[];
