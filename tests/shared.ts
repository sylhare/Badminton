import { CourtAssignmentEngine } from '../src/utils/CourtAssignmentEngine';

/** Common test data used across multiple test files */
export const COMMON_PLAYERS = {
  FOUR: 'Alice\nBob\nCharlie\nDiana',
  SIX: 'Alice\nBob\nCharlie\nDiana\nEve\nFrank',
  EIGHT: 'Alice\nBob\nCharlie\nDiana\nEve\nFrank\nGrace\nHank',
};

/** Common setup/teardown used across multiple test files */
export const clearTestState = (): void => {
  localStorage.clear();
  CourtAssignmentEngine.resetHistory();
};
