import React, { useMemo } from 'react';

import type { OnMatchResult } from '../../../tournament/types';
import type { BracketNode } from '../../../tournament/bracketTree';
import { nextPowerOf2, roundLabel } from '../../../tournament/bracketTree';
import { EliminationTournament } from '../../../tournament/EliminationTournament';
import { useMatchModal } from '../useMatchModal';

import { CARD_HEIGHT, HEADER_HEIGHT } from './BracketColumn';
import { BracketSection } from './BracketSection';

import './EliminationBracket.css';

interface BracketSectionConfig {
  key: string;
  testId: string;
  title: string;
  tree: BracketNode[][];
  height: number;
  roundLabel: (round: number, totalRounds: number) => string;
}

interface EliminationBracketProps {
  tournament: EliminationTournament;
  onMatchResult: OnMatchResult;
}

export const EliminationBracket: React.FC<EliminationBracketProps> = ({ tournament, onMatchResult }) => {
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

  const sections: BracketSectionConfig[] = [
    {
      key: 'wb',
      testId: 'wb-section',
      title: 'Winners Bracket',
      tree: wbTree,
      height: wbHeight,
      roundLabel,
    },
  ];

  if (cbTree.length > 0) {
    sections.push({
      key: 'cb',
      testId: 'cb-section',
      title: 'Consolation Bracket',
      tree: cbTree,
      height: cbHeight,
      roundLabel,
    });
  }

  if (thirdPlaceMatch) {
    sections.push({
      key: 'tp',
      testId: 'tp-section',
      title: '3rd Place',
      tree: [[{ type: 'match', match: thirdPlaceMatch, slotIndex: 0 }]],
      height: CARD_HEIGHT + HEADER_HEIGHT,
      roundLabel: () => '3rd Place',
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
          view={{ tree: section.tree, roundLabel: section.roundLabel, onTeamClick: handleTeamClick }}
        />
      ))}

      {scoreModal(tournament.state().bestOf, tournament.state().setSize)}
    </div>
  );
};
