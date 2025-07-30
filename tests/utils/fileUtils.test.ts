import { describe, expect, it } from 'vitest';

import { getFirstFile, isImageFile } from '../../src/utils/fileUtils';

import { createMockFileList, MOCK_FILES } from './testFactories';

describe('File Utils', () => {
  describe('isImageFile', () => {
    it('should return true for image files', () => {
      expect(isImageFile(MOCK_FILES.image.jpg)).toBe(true);
      expect(isImageFile(MOCK_FILES.image.png)).toBe(true);
      expect(isImageFile(MOCK_FILES.image.gif)).toBe(true);
      expect(isImageFile(MOCK_FILES.image.svg)).toBe(true);
    });

    it('should return false for non-image files', () => {
      expect(isImageFile(MOCK_FILES.nonImage.txt)).toBe(false);
      expect(isImageFile(MOCK_FILES.nonImage.pdf)).toBe(false);
      expect(isImageFile(MOCK_FILES.nonImage.json)).toBe(false);
      expect(isImageFile(MOCK_FILES.nonImage.video)).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(isImageFile(null)).toBe(false);
      expect(isImageFile(undefined)).toBe(false);
    });

    it('should handle edge cases with partial image types', () => {
      const mockFile = new File([''], 'test.txt', { type: 'text/image' });
      expect(isImageFile(mockFile)).toBe(false);
      expect(isImageFile(MOCK_FILES.image.svg)).toBe(true);
    });
  });

  describe('getFirstFile', () => {
    it('should return the first file from FileList', () => {
      const mockFileList = createMockFileList([MOCK_FILES.image.jpg, MOCK_FILES.image.png]);

      const result = getFirstFile(mockFileList);
      expect(result).toBe(MOCK_FILES.image.jpg);
    });

    it('should return null for empty FileList', () => {
      const mockFileList = createMockFileList([]);

      const result = getFirstFile(mockFileList);
      expect(result).toBe(null);
    });

    it('should return null for null FileList', () => {
      const result = getFirstFile(null);
      expect(result).toBe(null);
    });

    it('should return null for undefined FileList', () => {
      const result = getFirstFile(undefined as any);
      expect(result).toBe(null);
    });

    it('should handle FileList with single file', () => {
      const mockFileList = createMockFileList([MOCK_FILES.image.jpg]);

      const result = getFirstFile(mockFileList);
      expect(result).toBe(MOCK_FILES.image.jpg);
    });
  });
});