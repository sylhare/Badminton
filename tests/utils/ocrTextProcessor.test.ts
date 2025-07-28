import { describe, it, expect } from 'vitest'
import { extractPlayerNames, debugOCR } from '../../src/utils/ocrTextProcessor'

describe('OCR Text Processor', () => {
  it('should extract player names from your sample image text', () => {
    // This is what OCR might extract from your names.png image
    const sampleText = `Tinley
Ella
Avrella
Yvette
Gabriela
Noella`

    const result = extractPlayerNames(sampleText)
    
    expect(result).toEqual([
      'Tinley',
      'Ella',
      'Avrella', 
      'Yvette',
      'Gabriela',
      'Noella'
    ])
  })

  it('should filter out common badminton-related noise words', () => {
    const noisyText = `Player List
Badminton Club
John Doe
list
Jane Smith
court 1
players
Mike Johnson
badminton session
Sarah Davis`

    const result = extractPlayerNames(noisyText)
    
    expect(result).toEqual([
      'John Doe',
      'Jane Smith',
      'Mike Johnson', 
      'Sarah Davis'
    ])
  })

  it('should filter out very long text (not names)', () => {
    const textWithLongLines = `John
Jane
This is a very long line that should be filtered out because it is probably not a name
Mike
Another extremely long line that contains way too much text to be a person name
Sarah`

    const result = extractPlayerNames(textWithLongLines)
    
    expect(result).toEqual(['John', 'Jane', 'Mike', 'Sarah'])
  })

  it('should filter out very short text (single characters)', () => {
    const textWithShortLines = `A
John
B
Jane
C
Mike
1
Sarah
-`

    const result = extractPlayerNames(textWithShortLines)
    
    expect(result).toEqual(['John', 'Jane', 'Mike', 'Sarah'])
  })

  it('should handle empty or whitespace-only text', () => {
    expect(extractPlayerNames('')).toEqual([])
    expect(extractPlayerNames('   \n  \n   ')).toEqual([])
    expect(extractPlayerNames('\n\n\n')).toEqual([])
  })

  it('should trim whitespace from names', () => {
    const textWithSpaces = `  John Doe  
    Jane Smith    
  Mike Johnson
Sarah Davis  `

    const result = extractPlayerNames(textWithSpaces)
    
    expect(result).toEqual([
      'John Doe',
      'Jane Smith',
      'Mike Johnson',
      'Sarah Davis'
    ])
  })

  it('debugOCR should provide detailed processing info', () => {
    const testText = `Player List
John
Jane
list
Mike`

    const debug = debugOCR(testText)
    
    expect(debug.input).toBe(testText)
    expect(debug.output).toEqual(['John', 'Jane', 'Mike'])
    expect(debug.filtered).toEqual(['Player List', 'list'])
  })
}) 