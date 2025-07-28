/**
 * Processes OCR text and extracts player names
 * @param text Raw OCR text
 * @returns Array of filtered player names
 */
export function extractPlayerNames(text: string): string[] {
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => {
      // Filter out common OCR noise and non-name lines
      const lowerLine = line.toLowerCase()
      return !lowerLine.includes('list') && 
             !lowerLine.includes('players') &&
             !lowerLine.includes('badminton') &&
             !lowerLine.includes('court') &&
             !lowerLine.includes('noise') &&
             !lowerLine.includes('text') &&
             !lowerLine.includes('some') &&
             line.length < 50 && // Names shouldn't be too long
             line.length > 1 // Should have at least 2 characters
    })

  return lines
}

/**
 * Debug function to test OCR processing with known text
 */
export function debugOCR(testText: string): { input: string; output: string[]; filtered: string[] } {
  const input = testText
  const allLines = testText.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  const output = extractPlayerNames(testText)
  
  return {
    input,
    output,
    filtered: allLines.filter(line => !output.includes(line))
  }
} 