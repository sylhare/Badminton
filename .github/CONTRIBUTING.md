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
- `npm run lint` - Run ESLint
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run e2e tests

## Code Guidelines

### No inline comments

Code should be self-documenting through clear naming. Don't explain *what* the code does with comments — use a well-named function or variable instead. JSDoc on exported classes and public methods is fine.

```ts
// ❌
const v = arr.filter(p => p.present); // get present players

// ✅
const presentPlayers = arr.filter(p => p.present);
```

### TypeScript

- Use `interface` for object shapes and class contracts.
- Use `type` for unions, aliases, and simple literals.

```ts
interface Court { courtNumber: number; players: Player[]; }
type EngineType = 'sa' | 'mc' | 'cg' | 'sl';
```

### Components

- Functional components only, typed as `React.FC<Props>`.
- Define a `Props` interface directly above the component.
- Destructure props in the function signature with defaults where relevant.
- Prefix event handlers with `handle` (e.g. `handleTeamClick`).

### No duplication

Before adding a helper, check whether it already exists:

- **Unit test utilities** → `tests/shared.ts`, `tests/data/testData.ts`, `tests/data/testFactories.ts`
- **E2E utilities** → `e2e/helpers.ts`

Extend those files rather than copy-pasting setup logic across test files.

### Unit tests vs E2E tests

| | Unit (`tests/`) | E2E (`e2e/`) |
|---|---|---|
| **Scope** | A single function or class | A full user workflow |
| **Framework** | Vitest + Testing Library | Playwright |
| **File suffix** | `.test.ts` | `.spec.ts` |
| **What to test** | Algorithm correctness, edge cases, state management | UI interactions, cross-page navigation, real browser behaviour |

Prefer unit tests for logic. Only reach for E2E when the value comes from testing the real browser.

### Test file structure mirrors `src/`

```
src/engines/SimulatedAnnealingEngine.ts
tests/engines/SimulatedAnnealingEngine.test.ts
```
