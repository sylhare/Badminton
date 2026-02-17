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

## Run the notebook (editable)

```bash
cd analysis
./.venv/bin/marimo edit ./analysis.py
```

## Run the notebook (read-only app)

```bash
cd analysis
./.venv/bin/marimo run ./analysis.py --host 127.0.0.1 --port 2786
```

## Run all notebooks (with hot reload)

Serves all notebooks with automatic refresh on file changes:

```bash
cd analysis
uv run serve.py
```

Then open:
- http://localhost:8765/analysis
- http://localhost:8765/algorithm_docs
- http://localhost:8765/bench_analysis
- http://localhost:8765/engine_analysis

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