# Analysis README

This folder contains the simulation script and the Marimo notebook for analyzing repeat teammate pairs.

## Setup (install dependencies)

Dependencies are declared in `analysis/pyproject.toml`.

```bash
cd analysis
uv venv
./.venv/bin/uv pip install .
```

## Run the simulation (generate CSVs)

The simulation writes results into `analysis/data/`.

```bash
cd analysis
SIM_RUNS=5000 SIM_ROUNDS=10 SIM_PLAYERS=20 SIM_COURTS=4 npx tsx ./simulate.ts
```

## Run the bench analysis simulation

```bash
cd analysis
SIM_TYPE=bench BENCH_RUNS=1000 BENCH_ROUNDS=50 BENCH_MIN_PLAYERS=17 BENCH_MAX_PLAYERS=20 npx tsx ./simulate.ts
```

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
mkdir -p html
uv run marimo export html --no-include-code algorithm_docs.py -o html/algorithm_docs.html
uv run marimo export html --no-include-code analysis.py -o html/analysis.html
uv run marimo export html --no-include-code bench_analysis.py -o html/bench_analysis.html
uv run marimo export html --no-include-code engine_analysis.py -o html/engine_analysis.html
```

Then prerender for the main app (from project root):

```bash
npx tsx script/prerender-notebooks.ts
```

This generates static HTML files in `public/analysis/` that render without JavaScript execution.