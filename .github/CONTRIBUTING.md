# Contributing

## Development Setup

### Installation

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5174`

### Scripts

- `npm run build` - Build for production
- `npm run lint:fix` - Run ESLint (and fix most of them automatically)
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run e2e tests

## Code Guidelines

### No inline comments

Code should be self-documenting through clear naming. Don't explain *what* the code does with comments — use a
well-named function or variable instead. Don't use `{/* ... */}` JSX comments either — the surrounding structure
and `data-testid` attributes already convey intent. Only add a comment when documenting a non-obvious *why*
(a hidden constraint, subtle invariant, or external workaround) that can't be expressed in a name — and put it in
the JSDoc of the enclosing function, not inline.

```ts
// ❌
const v = arr.filter(p => p.present); // get present players

// ✅
const presentPlayers = arr.filter(p => p.present);
```

### JSDoc style

Use JSDoc only on exported functions and classes. Describe *why* or *what* at a high level; omit `@param` and
`@returns` tags — the type signatures and names are already self-documenting.

```ts
// ❌
/**
 * @param bracketSize Power-of-2 total slot count
 * @returns Array of rounds
 */
export function computeWBTree(bracketSize: number): BracketNode[][] { ... }

// ✅
/**
 * Computes a round-by-round bracket tree. Indices beyond teams.length are treated as byes.
 */
export function computeWBTree(bracketSize: number): BracketNode[][] { ... }
```

### Node.js built-in imports

Always use the `node:` protocol prefix for Node.js built-in modules:

```ts
// ❌
import fs from 'fs';
import path from 'path';

// ✅
import fs from 'node:fs';
import path from 'node:path';
```

This applies to all built-ins: `node:fs`, `node:path`, `node:url`, `node:crypto`, etc.

### TypeScript

- Use `interface` for object shapes and class contracts.
- Use `type` for unions, aliases, and simple literals.

```ts
interface Court {
  courtNumber: number;
  players: Player[];
}

type EngineType = 'sa' | 'mc' | 'cg' | 'sl';
```

### Components

- Functional components only, typed as `React.FC<Props>`.
- Use named `export const` declarations, not default exports.
- Define a `Props` interface directly above the component.
- Destructure props in the function signature with defaults where relevant.
- Prefix event handlers with `handle` (e.g. `handleTeamClick`).

### No duplication

Before adding a helper, check whether it already exists:

- **Unit test utilities** → `tests/shared.ts`, `tests/setup.ts`, `tests/data/*`,
- **E2E utilities** → `e2e/helpers.ts`

Extend those files rather than copy-pasting setup logic across test files.

### Unit tests vs E2E tests

|                  | Unit (`tests/`)                                     | E2E (`e2e/`)                                                   |
|------------------|-----------------------------------------------------|----------------------------------------------------------------|
| **Scope**        | A single function or class                          | A full user workflow                                           |
| **Framework**    | Vitest + Testing Library                            | Playwright                                                     |
| **File suffix**  | `.test.ts`                                          | `.spec.ts`                                                     |
| **What to test** | Algorithm correctness, edge cases, state management | UI interactions, cross-page navigation, real browser behaviour |

Prefer unit tests for logic. Only reach for E2E when the value comes from testing the real browser.

### Test file structure mirrors `src/`

```
src/engines/SimulatedAnnealingEngine.ts
tests/engines/SimulatedAnnealingEngine.test.ts
```

### Unit test structure for classes

Wrap all tests for a class in a top-level `describe('ClassName')`. Inside it, use a nested `describe('methodName')` only when a method has more than one test. Single-test methods use a bare `it` directly inside the class describe.

```ts
describe('MyClass', () => {
  // single test → bare it, no nested describe
  it('someMethod returns the expected value', () => { ... });

  // multiple tests → nested describe
  describe('otherMethod', () => {
    it('returns X when ...', () => { ... });
    it('returns Y when ...', () => { ... });
  });
});
```

## Pull Request Guidelines

### Commit messages

Use the imperative mood — write the message as a command:

```
# ❌
Added rotation button
Fixing bench fairness bug

# ✅
Add rotation button
Fix bench fairness bug
```

### Prefer rebase to merge commits

Keep the history linear. 
Rebase your branch on `main` before marking a PR ready for review instead of merging `main`into your branch.

```bash
git fetch origin
git rebase origin/main
```
