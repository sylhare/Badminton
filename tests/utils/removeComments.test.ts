import { describe, expect, it } from 'vitest';

import { removeComments } from '../../script/remove_comments';

const CASES: Array<[string, string, string]> = [
  ['single-line comments', 'const x = 1; // inline comment\n', 'const x = 1;\n'],
  [
    'comment-only lines entirely, not leave whitespace',
    'function foo() {\n    // this is a comment\n    const x = 1;\n}\n',
    'function foo() {\n    const x = 1;\n}\n',
  ],
  [
    'comment-only lines with various indentation',
    'const a = 1;\n  // comment with spaces\nconst b = 2;\n',
    'const a = 1;\nconst b = 2;\n',
  ],
  ['intentional empty lines between code', 'const a = 1;\n\nconst b = 2;\n', 'const a = 1;\n\nconst b = 2;\n'],
  ['block comments', 'const x = 1;\n/* block comment */\nconst y = 2;\n', 'const x = 1;\n\nconst y = 2;\n'],
  ['JSDoc comments', '/** JSDoc comment */\nfunction foo() {}\n', '/** JSDoc comment */\nfunction foo() {}\n'],
  ['triple-slash directives', '/// <reference types="react" />\nconst x = 1;\n', '/// <reference types="react" />\nconst x = 1;\n'],
  ['URLs', 'const url = "https://example.com";\n', 'const url = "https://example.com";\n'],
  ['// inside string literals', 'const s = "value // not a comment";\n', 'const s = "value // not a comment";\n'],
  ['multiple blank lines collapsed to at most two', 'const a = 1;\n\n\n\nconst b = 2;\n', 'const a = 1;\n\nconst b = 2;\n'],
  [
    'an apostrophe inside a comment is not a string opener',
    '// a slot\'s group\nconst mode = \'tap\';\nreturn mode;\n',
    '\nconst mode = \'tap\';\nreturn mode;\n',
  ],
  [
    'code following a comment that contains quotes',
    'function f() {\n  // don\'t drop the "return" below\n  return 1;\n}\n',
    'function f() {\n  return 1;\n}\n',
  ],
  [
    'code after a block comment containing an apostrophe',
    '/* it\'s fine */\nconst x = \'a\';\nconst y = \'b\';\n',
    '\nconst x = \'a\';\nconst y = \'b\';\n',
  ],
];

describe('removeComments', () => {
  it.each(CASES)('should remove %s', (_label, input, expected) => {
    expect(removeComments(input)).toBe(expected);
  });
});
