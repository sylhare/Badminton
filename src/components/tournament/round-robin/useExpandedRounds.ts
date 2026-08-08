import { useEffect, useRef, useState } from 'react';

interface ExpandedRounds {
  isExpanded: (round: number) => boolean;
  toggle: (round: number) => void;
}

/**
 * Tracks which rounds are expanded: starts with the current round open, follows
 * the current round as it advances, and collapses everything once all matches
 * are complete.
 */
export function useExpandedRounds(currentRound: number, allComplete: boolean): ExpandedRounds {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([currentRound]));

  const prevCurrentRoundRef = useRef(currentRound);
  useEffect(() => {
    const prev = prevCurrentRoundRef.current;
    if (prev !== currentRound) {
      setExpanded(existing => {
        const next = new Set(existing);
        next.delete(prev);
        next.add(currentRound);
        return next;
      });
      prevCurrentRoundRef.current = currentRound;
    }
  }, [currentRound]);

  const prevAllCompleteRef = useRef(allComplete);
  useEffect(() => {
    if (allComplete && !prevAllCompleteRef.current) {
      setExpanded(new Set());
    }
    prevAllCompleteRef.current = allComplete;
  }, [allComplete]);

  const toggle = (round: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(round)) next.delete(round);
      else next.add(round);
      return next;
    });
  };

  return { isExpanded: round => expanded.has(round), toggle };
}
