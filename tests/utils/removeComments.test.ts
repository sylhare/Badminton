import { describe, expect, it } from 'vitest';

import { removeComments } from '../../script/remove_comments';

describe('removeComments', () => {
  it('should remove single-line comments', () => {
    const input = 'const x = 1; // inline comment\n';
    expect(removeComments(input)).toBe('const x = 1; \n');
  });

  it('should remove comment-only lines entirely, not leave whitespace', () => {
    const input = 'function foo() {\n    // this is a comment\n    const x = 1;\n}\n';
    expect(removeComments(input)).toBe('function foo() {\n    const x = 1;\n}\n');
  });

  it('should remove comment-only lines with various indentation', () => {
    const input = 'const a = 1;\n  // comment with spaces\nconst b = 2;\n';
    expect(removeComments(input)).toBe('const a = 1;\nconst b = 2;\n');
  });

  it('should not remove intentional empty lines between code', () => {
    const input = 'const a = 1;\n\nconst b = 2;\n';
    expect(removeComments(input)).toBe('const a = 1;\n\nconst b = 2;\n');
  });

  it('should remove block comments', () => {
    const input = 'const x = 1;\n/* block comment */\nconst y = 2;\n';
    expect(removeComments(input)).toBe('const x = 1;\n\nconst y = 2;\n');
  });

  it('should preserve JSDoc comments', () => {
    const input = '/** JSDoc comment */\nfunction foo() {}\n';
    expect(removeComments(input)).toBe('/** JSDoc comment */\nfunction foo() {}\n');
  });

  it('should preserve triple-slash directives', () => {
    const input = '/// <reference types="react" />\nconst x = 1;\n';
    expect(removeComments(input)).toBe('/// <reference types="react" />\nconst x = 1;\n');
  });

  it('should preserve URLs', () => {
    const input = 'const url = "https://example.com";\n';
    expect(removeComments(input)).toBe('const url = "https://example.com";\n');
  });

  it('should not remove // inside string literals', () => {
    const input = 'const s = "value // not a comment";\n';
    expect(removeComments(input)).toBe('const s = "value // not a comment";\n');
  });

  it('should collapse multiple blank lines to at most two', () => {
    const input = 'const a = 1;\n\n\n\nconst b = 2;\n';
    expect(removeComments(input)).toBe('const a = 1;\n\nconst b = 2;\n');
  });
});
