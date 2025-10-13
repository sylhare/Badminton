import React from 'react';
import { describe, it } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import TeamPlayerList from '../../src/components/TeamPlayerList';
import { MOCK_PLAYERS } from '../data/testFactories';
import { expectEmptyRender, expectPlayersInOrder, expectPlayersToBeRendered } from '../data/testHelpers';

describe('TeamPlayerList Component', () => {
  it('should render all players', () => {
    render(<TeamPlayerList players={MOCK_PLAYERS.withAbsent} />);

    expectPlayersToBeRendered(MOCK_PLAYERS.withAbsent);
  });

  it('should render nothing when no players provided', () => {
    const { container } = render(<TeamPlayerList players={[]} />);

    expectEmptyRender(container);
  });

  it('should render single player correctly', () => {
    render(<TeamPlayerList players={MOCK_PLAYERS.single} />);

    expectPlayersToBeRendered(MOCK_PLAYERS.single);
  });

  it('should handle players with special characters in names', () => {
    render(<TeamPlayerList players={MOCK_PLAYERS.specialNames} />);

    expectPlayersToBeRendered(MOCK_PLAYERS.specialNames);
  });

  it('should preserve player order', () => {
    render(<TeamPlayerList players={MOCK_PLAYERS.withAbsent} />);

    expectPlayersInOrder(MOCK_PLAYERS.withAbsent);
  });

  it('should handle long player names', () => {
    render(<TeamPlayerList players={MOCK_PLAYERS.longName} />);

    expectPlayersToBeRendered(MOCK_PLAYERS.longName);
  });
});
