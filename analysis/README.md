# Analysis README

This folder contains the simulation script and Marimo notebooks for analyzing court assignment algorithms.

## Setup (install dependencies)

Dependencies are declared in `analysis/pyproject.toml`.

```bash
cd analysis
uv venv
./.venv/bin/uv pip install .
```

## Run the simulation (generate CSVs)

The simulation compares all four court assignment algorithms (Random Baseline, Monte Carlo, Simulated Annealing, and Conflict Graph) and generates comprehensive metrics.

### Configuration

Create or edit `analysis/data/config.json`:

```json
{
  "runs": 100,
  "rounds": 10,
  "playerCounts": [20],
  "numCourts": 4
}
```

- **runs**: Number of simulation sessions per algorithm
- **rounds**: Number of rounds per session
- **playerCounts**: Array of player counts to test (e.g., `[17, 18, 19, 20]`)
- **numCourts**: Number of available courts

### Run the simulation

```bash
cd analysis
npx tsx ./simulation/index.ts
```

### Output

The simulation generates data in `analysis/data/`:
- `random_baseline/`, `mc_algo/`, `sa_algo/`, `cg_algo/`: Per-engine results
  - `summary.csv`: Repeat pair statistics per simulation
  - `pair_events.csv`: Individual repeat pair occurrences
  - `match_events.csv`: Match outcomes with team strengths
  - `bench_stats.csv`: Bench fairness metrics
  - `match_pair_summary.csv`: Player pair interaction counts
  - `player_stats.csv`: Win/loss records per player
  - `config.json`: Configuration and aggregate statistics
- `comparison_summary.csv`: Side-by-side engine comparison

### Metrics tracked

- **Repeat pairs**: How often the same team plays together across rounds
- **Balance**: Team strength matching (based on simulated skill levels)
- **Bench fairness**: Distribution of bench time and gaps between benches
- **Win distribution**: Player win rates relative to skill levels

## Run the UI load test (drive the real app)

Instead of calling the engines directly, this harness drives the **actual app in a
browser** with Playwright, reusing the `e2e/support/pages` page objects. It seeds
players + levels into `localStorage`, generates rounds, records winners (the score
modal in Smart mode), and regenerates — then reads the saved state back for metrics.
It sweeps a **concurrency** range to load-test the UI and samples CPU/RAM while runs
execute.

### Configuration

The `ui` block in `analysis/data/config.json`:

```json
"ui": {
  "engines": ["sa", "sl"],
  "concurrency": [1, 2, 4, 8],
  "durationSec": 45,
  "runs": 4,
  "rounds": 10,
  "playerCount": 16,
  "sampleIntervalMs": 250,
  "headless": true
}
```

- **engines**: which shipped engines to exercise — `sa` (default) and/or `sl` (Smart)
- **concurrency**: browser sessions to run at once, one value per sweep point
- **durationSec**: when set, each cell runs for this many seconds (equal-time load), looping sessions until the window closes — this **overrides `runs`**. Omit it to run a fixed `runs` count instead
- **runs**: sessions per (engine, concurrency) cell, used only when `durationSec` is unset
- **rounds**: rounds generated per session
- **playerCount**: players seeded (levels come from `playerProfiles`); courts from `numCourts`
- **sampleIntervalMs**: CPU/RAM sampling period
- **headless**: run the browser headless

### Run it

```bash
cd analysis
npx tsx ./ui_simulation/index.ts
```

The harness reuses a dev server already on `http://localhost:5173`, or starts
`npm run dev` itself (override with `E2E_BASE_URL`). Output CSVs land in
`analysis/data/ui/`: `sessions.csv`, `generate_events.csv`, `resources.csv`,
`concurrency_summary.csv`, `match_events.csv`, `player_stats.csv`, `config.json`.
View them with the `ui_load_analysis` notebook below.

### Matched engine baseline (for the Engine-vs-UI comparison)

To compare the UI fairly against the raw engine, generate a baseline that runs the
**same engines with the same defaults, players, courts and rounds** as the UI (and
the same teammate-repeat metric), directly in Node with no browser:

```bash
cd analysis
npx tsx ./ui_simulation/engine_baseline.ts
```

This writes `analysis/data/ui/engine_baseline.json`, which the notebook uses as the
reference. Do **not** compare against the `sa_algo`/`sl_algo` batch — that runs 15–18
players with benching, which makes repeats trivially avoidable and is not comparable
to the UI's tighter 16-players / 4-courts setup.

## Run the notebook (editable)

```bash
cd analysis
./.venv/bin/marimo edit ./engine_analysis.py
```

## Run the notebook (read-only app)

```bash
cd analysis
./.venv/bin/marimo run ./engine_analysis.py --host 127.0.0.1 --port 2786
```

## Run all notebooks (with hot reload)

Serves all notebooks with automatic refresh on file changes:

```bash
cd analysis
uv run serve.py
```

Then open:
- http://localhost:8765/algorithm_docs
- http://localhost:8765/engine_analysis
- http://localhost:8765/level_tracker_analysis
- http://localhost:8765/ui_load_analysis

## Export notebooks to static HTML

Export all notebooks without code cells (output only):

```bash
cd analysis
uv run export-html
```

Then prerender for the main app (from project root):

```bash
npx tsx script/prerender-notebooks.ts
```

This generates static HTML files in `public/analysis/` that render without JavaScript execution.