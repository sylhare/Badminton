/**
 * Processes OCR text and extracts player names
 * @param text Raw OCR text
 * @returns Array of filtered player names
 */
export function extractPlayerNames(text: string): string[] {
  return text.split('\n').map(line => line.trim()).filter(line => line.length > 0).filter(line => {
    const lowerLine = line.toLowerCase();
    return !lowerLine.includes('list') &&
      !lowerLine.includes('players') &&
      !lowerLine.includes('badminton') &&
      !lowerLine.includes('court') &&
      !lowerLine.includes('noise') &&
      !lowerLine.includes('text') &&
      !lowerLine.includes('some') &&
      line.length < 50 &&
      line.length > 1;
  });
}