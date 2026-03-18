export const MH = 64;        // match box height in px
export const MG = 12;        // gap between adjacent match boxes
export const SH = MH + MG;  // slot height (one unit of the bracket grid)
export const CW = 176;       // column width (match box)
export const CN = 36;        // connector strip width between columns

// Returns the top position (px) of a match box within the bracket.
// roundIdx: 0-based round index; matchIdx: 0-based within that round.
// Each subsequent round doubles the slot size (binary tree centering).
export function wbTop(roundIdx: number, matchIdx: number): number {
  const slots = 1 << roundIdx;
  return matchIdx * slots * SH + ((slots - 1) * SH) / 2;
}
