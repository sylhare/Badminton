import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { OnMatchResult } from '../../../tournament/types';
import type { BracketNode } from '../../../tournament/bracketTree';
import { nextPowerOf2, roundHeader } from '../../../tournament/bracketTree';
import { EliminationTournament } from '../../../tournament/EliminationTournament';
import { useMatchModal } from '../useMatchModal';

import { CARD_HEIGHT, HEADER_HEIGHT } from './BracketColumn';
import type { BracketRoundHeader } from './bracketView';
import { BracketSection } from './BracketSection';

import './EliminationBracket.css';

interface BracketSectionConfig {
  key: string;
  testId: string;
  title: string;
  tree: BracketNode[][];
  height: number;
  roundHeader: (round: number, totalRounds: number) => BracketRoundHeader;
}

interface EliminationBracketProps {
  tournament: EliminationTournament;
  onMatchResult: OnMatchResult;
}

export const EliminationBracket: React.FC<EliminationBracketProps> = ({ tournament, onMatchResult }) => {
  const { t } = useTranslation();
  const { handleTeamClick, scoreModal } = useMatchModal(onMatchResult);

  const bracketSize = tournament.bracketSize();

  const wbTree = useMemo(
    () => tournament.winners.computeTree(),
    [tournament],
  );
  const [cbTree, consolationSeedsLength] = useMemo(() => {
    const cb = tournament.consolation;
    return [cb.computeTree(), cb.seeds().length];
  }, [tournament]);

  const thirdPlaceMatch = tournament.thirdPlaceMatch;

  const wbHeight = (bracketSize / 2) * CARD_HEIGHT + HEADER_HEIGHT;
  const consolationBracketSize = consolationSeedsLength > 0 ? nextPowerOf2(consolationSeedsLength) : 0;
  const extraRoundHeight = cbTree.length > 0 ? CARD_HEIGHT * (Math.pow(2, cbTree.length - 1) + 1) / 2 : 0;
  const cbCardAreaHeight = consolationBracketSize > 0 ? Math.max((consolationBracketSize / 2) * CARD_HEIGHT, extraRoundHeight) : 0;
  const cbHeight = cbCardAreaHeight > 0 ? cbCardAreaHeight + HEADER_HEIGHT : 0;

  const formatRoundHeader = (r: number, tot: number): BracketRoundHeader => {
    const { label, testId } = roundHeader(r, tot);
    return { label: t(label.key, label.params), testId };
  };

  const sections: BracketSectionConfig[] = [
    {
      key: 'wb',
      testId: 'wb-section',
      title: t('tournament.elimination.winnersBracket'),
      tree: wbTree,
      height: wbHeight,
      roundHeader: formatRoundHeader,
    },
  ];

  if (cbTree.length > 0) {
    sections.push({
      key: 'cb',
      testId: 'cb-section',
      title: t('tournament.elimination.consolationBracket'),
      tree: cbTree,
      height: cbHeight,
      roundHeader: formatRoundHeader,
    });
  }

  if (thirdPlaceMatch) {
    sections.push({
      key: 'tp',
      testId: 'tp-section',
      title: t('tournament.elimination.thirdPlace'),
      tree: [[{ type: 'match', match: thirdPlaceMatch, slotIndex: 0 }]],
      height: CARD_HEIGHT + HEADER_HEIGHT,
      roundHeader: () => ({
        label: t('tournament.elimination.thirdPlace'),
        testId: '3rd-Place',
      }),
    });
  }

  return (
    <div className="elimination-bracket" data-testid="elimination-bracket">
      {sections.map(section => (
        <BracketSection
          key={section.key}
          title={section.title}
          testId={section.testId}
          height={section.height}
          view={{
            tree: section.tree,
            roundHeader: section.roundHeader,
            onTeamClick: handleTeamClick,
          }}
        />
      ))}

      {scoreModal(tournament.state().bestOf, tournament.state().setSize)}
    </div>
  );
};
