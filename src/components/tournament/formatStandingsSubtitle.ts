import type { StandingsSubtitle } from '../../tournament/Tournament';
import type { Translate } from '../../i18n';

/** Turn the standings-subtitle data into a sentence in the active language. */
export function formatStandingsSubtitle(subtitle: StandingsSubtitle, t: Translate): string {
  switch (subtitle.kind) {
    case 'rounds':
      return subtitle.done > 0
        ? t('tournament.subtitleRounds', { done: subtitle.done, total: subtitle.total })
        : t('tournament.subtitleRoundZero', { total: subtitle.total });
    case 'final':
      return t('tournament.finalResults');
    case 'inProgress':
      return t('tournament.inProgress');
  }
}
