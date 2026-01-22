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

