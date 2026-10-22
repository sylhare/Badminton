import React from 'react';

import type { OnMatchResult, TournamentTeam, TournamentType } from '../../tournament/types';
import type { Tournament } from '../../tournament/Tournament';
import type { RoundRobinTournament } from '../../tournament/RoundRobinTournament';
import type { EliminationTournament } from '../../tournament/EliminationTournament';
import { GroupKnockoutTournament } from '../../tournament/GroupKnockoutTournament';
import type { GroupSetupNote } from '../../tournament/GroupKnockoutTournament';
import { NumberField } from '../common/NumberField';
import { useTranslation } from '../../i18n';
import type { Translate, TranslationKey } from '../../i18n';

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
  /** Message key for the mode-selector pill. */
  labelKey: TranslationKey;
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

/** Compose the setup note sentence from its data. */
function formatSetupNote(note: GroupSetupNote, t: Translate): string {
  const noun = t(note.shape.groups === 1 ? 'tournament.groupNounOne' : 'tournament.groupNounOther');
  const shapeText = note.shape.uniform
    ? t('tournament.groupShapeUniform', { count: note.shape.groups, noun, size: note.shape.sizes[0] })
    : t('tournament.groupShapeMixed', {
      count: note.shape.groups,
      noun,
      sizes: note.shape.sizes.join(', '),
    });

  const splitText = note.shape.undersized
    ? t('tournament.groupSplitShort', {
      teams: note.teamCount,
      size: note.requestedGroupSize,
      shape: shapeText,
    })
    : t('tournament.groupSplit', { teams: note.teamCount, shape: shapeText });

  if (note.issue === 'tooFewQualifiers') {
    return `${splitText} ${t('tournament.groupTooFewQualifiers')}`;
  }
  if (note.issue === 'allAdvance') {
    return `${splitText} ${t('tournament.groupAllAdvance', { count: note.qualifiersPerGroup })}`;
  }
  return splitText;
}

/** Group-stage setup fields plus the live "N groups of M" note. */
const GroupKnockoutSetup: React.FC<{ config: SetupConfig; teams: TournamentTeam[] }> = ({ config, teams }) => {
  const { t } = useTranslation();
  const note = GroupKnockoutTournament.setupSummary(teams, config.groupSize, config.qualifiersPerGroup);

  return (
    <div className="setup-section" data-testid="group-knockout-config">
      <h3>{t('tournament.groupsKnockout')}</h3>
      <div className="group-knockout-fields">
        <label className="group-knockout-field">
          {t('tournament.teamsPerGroup')}
          <NumberField
            value={config.groupSize}
            min={2}
            onChange={next => {
              config.setGroupSize(next);
              config.setQualifiersPerGroup(Math.min(config.qualifiersPerGroup, next));
            }}
            testId="group-size-input"
          />
        </label>
        <label className="group-knockout-field">
          {t('tournament.qualifiersPerGroup')}
          <NumberField
            value={config.qualifiersPerGroup}
            min={1}
            max={config.groupSize}
            onChange={config.setQualifiersPerGroup}
            testId="qualifiers-input"
          />
        </label>
      </div>
      {note && (
        <p className={`setup-${note.severity}`} data-testid="group-preview">
          {formatSetupNote(note, t)}
        </p>
      )}
    </div>
  );
};

/**
 * Per-format view wiring. Presentation *policy* (subtitles, which tables to show)
 * lives on the tournament classes; this registry only maps a format to its React
 * views so the Tournament component can render any format without branching.
 * Insertion order is the order the mode pills appear in.
 */
export const TOURNAMENT_KINDS: Record<TournamentType, TournamentKind> = {
  'round-robin': {
    labelKey: 'tournament.roundRobin',
    renderMatches: (t, onMatchResult) => (
      <RoundRobinMatches tournament={t as RoundRobinTournament} onMatchResult={onMatchResult} />
    ),
  },
  elimination: {
    labelKey: 'tournament.elimination',
    renderMatches: (t, onMatchResult) => (
      <EliminationBracket tournament={t as EliminationTournament} onMatchResult={onMatchResult} />
    ),
  },
  'group-knockout': {
    labelKey: 'tournament.groupsKnockout',
    renderMatches: (t, onMatchResult, onUpdate) => (
      <GroupKnockout
        tournament={t as GroupKnockoutTournament}
        onMatchResult={onMatchResult}
        onUpdateTournament={onUpdate as (next: GroupKnockoutTournament) => void}
      />
    ),
    matchesPerRound: (teams, c) => GroupKnockoutTournament.matchesPerRound(teams, c.groupSize),
    validateSetup: (teams, c) => GroupKnockoutTournament.validateConfig(teams, c.groupSize, c.qualifiersPerGroup),
    renderSetupConfig: (config, teams) => <GroupKnockoutSetup config={config} teams={teams} />,
  },
};

export const TOURNAMENT_TYPES = Object.keys(TOURNAMENT_KINDS) as TournamentType[];
