import { createContext, useContext, useMemo } from 'react';
import React from 'react';

import type { Player } from '../types';

interface PlayersContextValue {
  players: Player[];
  playersFrom: (ids: string[] | undefined) => Player[];
}

const PlayersContext = createContext<PlayersContextValue>({
  players: [],
  playersFrom: () => [],
});

export const PlayersProvider: React.FC<{ value: Player[]; children: React.ReactNode }> = ({ value, children }) => {
  const ctx = useMemo<PlayersContextValue>(
    () => ({
      players: value,
      playersFrom: (ids) => (ids ?? []).map(id => value.find(p => p.id === id)).filter((p): p is Player => p !== undefined),
    }),
    [value],
  );
  return <PlayersContext.Provider value={ctx}>{children}</PlayersContext.Provider>;
};

export function usePlayers(): PlayersContextValue {
  return useContext(PlayersContext);
}
