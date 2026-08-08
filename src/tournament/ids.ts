/** Build a time-stamped, index-suffixed id with a per-kind prefix (e.g. `team-1699…-3`). */
export function makeId(prefix: string, index: number): string {
  return `${prefix}-${Date.now()}-${index}`;
}
