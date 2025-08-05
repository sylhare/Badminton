import { describe, expect, it } from 'vitest';

import { extractPlayerNames } from '../../src/utils/ocrEngine';

describe('OCR Text Processor', () => {
  it('should extract player names from your sample image text', () => {
    const sampleText = `Tinley
Ella
Avrella
Yvette
Gabriela
Noella`;

    const result = extractPlayerNames(sampleText);

    expect(result).toEqual([
      'Tinley',
      'Ella',
      'Avrella',
      'Yvette',
      'Gabriela',
      'Noella',
    ]);
  });

  it('should filter out very long text (not names)', () => {
    const textWithLongLines = `John
Jane
This is a very long line that should be filtered out because it is probably not a name
Mike
Another extremely long line that contains way too much text to be a person name
Sarah`;

    const result = extractPlayerNames(textWithLongLines);

    expect(result).toEqual(['John', 'Jane', 'Mike', 'Sarah']);
  });

  it('should filter out very short text (single characters)', () => {
    const textWithShortLines = `A
John
B
Jane
C
Mike
1
Sarah
-`;

    const result = extractPlayerNames(textWithShortLines);

    expect(result).toEqual(['John', 'Jane', 'Mike', 'Sarah']);
  });

  it('should handle empty or whitespace-only text', () => {
    expect(extractPlayerNames('')).toEqual([]);
    expect(extractPlayerNames('   \n  \n   ')).toEqual([]);
    expect(extractPlayerNames('\n\n\n')).toEqual([]);
  });

  it('should trim whitespace from names', () => {
    const textWithSpaces = `  John Doe  
    Jane Smith    
  Mike Johnson
Sarah Davis  `;

    const result = extractPlayerNames(textWithSpaces);

    expect(result).toEqual([
      'John Doe',
      'Jane Smith',
      'Mike Johnson',
      'Sarah Davis',
    ]);
  });
});