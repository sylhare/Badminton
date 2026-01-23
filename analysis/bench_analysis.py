import marimo

__generated_with = "0.19.4"
app = marimo.App(width="medium")


@app.cell
def _():
    return


@app.cell
def _():
    import io
    import json
    import math
    import os
    import random
    from pathlib import Path

    import marimo as mo
    import polars as pl
    return Path, io, json, mo, os, pl, random


@app.cell
def _(Path, os):
    # Set up matplotlib directories before importing matplotlib
    _mpl_config_dir = Path(__file__).parent / ".mplconfig"
    _cache_dir = Path(__file__).parent / ".cache"
    _mpl_config_dir.mkdir(exist_ok=True)
    _cache_dir.mkdir(exist_ok=True)
    _ = os.environ.setdefault("MPLCONFIGDIR", str(_mpl_config_dir))
    _ = os.environ.setdefault("XDG_CACHE_HOME", str(_cache_dir))
    mpl_configured = True
    return (mpl_configured,)


@app.cell
def _(mpl_configured):
    # Import matplotlib after config is set
    _ = mpl_configured  # Ensure config runs first
    import matplotlib.pyplot as plt
    import numpy as np
    return np, plt


@app.cell
def _(Path, json, pl):
    # Load bench analysis data (aggregated format)
    # Use __file__ to get the script directory
    _script_path = Path(__file__).resolve()
    data_dir = _script_path.parent / "data" / "bench_analysis"
    
    # Debug output to server console
    print(f"[DEBUG] Script path: {_script_path}")
    print(f"[DEBUG] Data dir: {data_dir}")
    print(f"[DEBUG] Data dir exists: {data_dir.exists()}")

    # Load config
    config_path = data_dir / "config.json"
    if config_path.exists():
        config = json.loads(config_path.read_text())
    else:
        config = {
            "runs": 1000,
            "rounds": 50,
            "minPlayers": 17,
            "maxPlayers": 20,
            "numCourts": 4,
            "numBatches": 5,
        }

    # Load aggregated summary files
    all_summaries = []
    all_events = []
    all_distributions = []

    for _num_players in range(config["minPlayers"], config["maxPlayers"] + 1):
        _summary_file = data_dir / f"summary_{_num_players}p.csv"
        _events_file = data_dir / f"events_summary_{_num_players}p.csv"
        _dist_file = data_dir / f"gap_distribution_{_num_players}p.csv"

        if _summary_file.exists():
            all_summaries.append(pl.read_csv(_summary_file))

        if _events_file.exists():
            all_events.append(pl.read_csv(_events_file))
            
        if _dist_file.exists():
            all_distributions.append(pl.read_csv(_dist_file))

    has_data = len(all_summaries) > 0
    print(f"[DEBUG] Has data: {has_data}, Summaries: {len(all_summaries)}")

    if has_data:
        summaries = pl.concat(all_summaries, how="diagonal_relaxed")
        events_summary = pl.concat(all_events, how="diagonal_relaxed")
        gap_distributions = pl.concat(all_distributions, how="diagonal_relaxed")
    else:
        summaries = pl.DataFrame()
        events_summary = pl.DataFrame()
        gap_distributions = pl.DataFrame()

    return config, events_summary, gap_distributions, has_data, summaries


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
# Bench Analysis

This notebook analyzes the **bench distribution algorithm** performance - specifically how many games players get to play between being benched.

**Key Questions:**
- How close does the algorithm get to the theoretical maximum games between benches?
- How does it compare to random player selection?
- Does it minimize "double benching" (consecutive rounds on the bench)?
    """)
    return


@app.cell(hide_code=True)
def _(has_data, mo, summaries):
    mo.stop(not has_data, mo.md("""
    ## No Data Found

    Please run the bench simulation first:

    ```bash
    cd analysis
    SIM_TYPE=bench npx tsx simulate.ts
    ```

    This will generate data for 17-20 players with 4 courts over 50 rounds.
    """))
    
    mo.md(f"**Data loaded:** {len(summaries)} player configurations (17-20 players)")
    return


@app.cell(hide_code=True)
def _(mo):
    # Mathematical demonstration in expandable box
    _content = mo.md(r"""
**Setup:**
- $N$ = total number of players
- $C$ = number of courts
- $S = 4C$ = playing spots per round (4 players per court)
- $B = N - S$ = players benched per round

**Constraint:** Each round, exactly $B$ players must sit out.

**Ideal Rotation Model:**

In a perfectly fair rotation, we want to distribute bench time evenly. Consider a continuous model where players cycle through bench duty:

1. **Bench frequency:** Each player should bench once every $\frac{N}{B}$ rounds on average
2. **Games between benches:** If a player benches in round $r$, their next bench should be around round $r + \frac{N}{B}$
3. **Maximum consecutive games:** Between two bench periods, a player plays $\frac{N}{B} - 1$ games

**Formula:**
$$\text{Theoretical Max Games} = \frac{N}{N - 4C} - 1 = \frac{4C}{N - 4C}$$

Or equivalently:
$$\text{Theoretical Max} = \frac{S}{B} = \frac{\text{Playing Spots}}{\text{Bench Spots}}$$

**Examples with 4 courts (16 playing spots):**

| Players (N) | Benched (B) | Theoretical Max | Interpretation |
|-------------|-------------|-----------------|----------------|
| 17 | 1 | 16.0 | 1 player benches, plays 16 games between |
| 18 | 2 | 8.0 | 2 players bench, each plays ~8 games between |
| 19 | 3 | 5.33 | 3 players bench, each plays ~5 games between |
| 20 | 4 | 4.0 | 4 players bench, each plays ~4 games between |

**Note:** The theoretical max is a continuous ideal. In practice:
- With 17 players, only 1 benches per round, so they could theoretically play 16 consecutive games
- With 20 players, 4 bench per round, creating more frequent rotation

**Why This Matters:**

The algorithm should aim to approach this theoretical maximum. If the observed average is significantly lower, it means players are being benched more frequently than necessary, reducing their playing time unfairly.
    """)

    mo.accordion({"Theoretical Maximum: Games Between Bench Periods": _content})
    return


@app.cell
def _(config):
    # Calculate theoretical max for each player count
    def calc_theoretical_max(num_players: int, num_courts: int) -> float:
        playing_spots = num_courts * 4
        bench_spots = num_players - playing_spots
        if bench_spots <= 0:
            return float('inf')
        return playing_spots / bench_spots

    theoretical_values = {
        n: calc_theoretical_max(n, config["numCourts"])
        for n in range(config["minPlayers"], config["maxPlayers"] + 1)
    }
    return (theoretical_values,)


@app.cell(hide_code=True)
def _(config, theoretical_values):
    _rows = []
    for n in range(config["minPlayers"], config["maxPlayers"] + 1):
        bench_spots = n - 16
        _rows.append(f"| {n} | {bench_spots} | **{theoretical_values[n]:.2f}** |")

    _table = "\n".join(_rows)

    return


@app.cell(hide_code=True)
def _():
    return


@app.cell
def _(has_data, mo, summaries):
    mo.stop(not has_data)
    print("[DEBUG] algo_stats cell - creating algo_stats")

    # Data is already aggregated with theoreticalMax column
    algo_stats = summaries.sort("numPlayers")
    print(f"[DEBUG] algo_stats created with {len(algo_stats)} rows")
    return (algo_stats,)


@app.cell(hide_code=True)
def _(has_data, mo):
    mo.stop(not has_data)

    return


@app.cell
def _(has_data, mo):
    mo.stop(not has_data)

    return


@app.cell
def _(algo_stats, has_data, io, mo, np, plt):
    mo.stop(not has_data)
    print("[DEBUG] Chart cell 1 - starting")

    _fig, _ax = plt.subplots(figsize=(10, 6))

    _players = algo_stats.get_column("numPlayers").to_list()
    _mean_gaps = algo_stats.get_column("mean_avg_gap").to_list()
    _std_gaps = algo_stats.get_column("std_avg_gap").to_list()
    _theoretical = algo_stats.get_column("theoreticalMax").to_list()

    _x = np.arange(len(_players))
    _width = 0.35

    # Algorithm bars with error bars
    _bars1 = _ax.bar(_x - _width/2, _mean_gaps, _width, 
                     label="Algorithm (avg)", color="#4C78A8", alpha=0.8)
    _ax.errorbar(_x - _width/2, _mean_gaps, yerr=_std_gaps, 
                 fmt='none', color='#333', capsize=3)

    # Theoretical max bars
    _bars2 = _ax.bar(_x + _width/2, _theoretical, _width,
                     label="Theoretical Max", color="#54A24B", alpha=0.8)

    _ax.set_xlabel("Number of Players")
    _ax.set_ylabel("Games Between Benches")
    _ax.set_title("Algorithm vs Theoretical Maximum: Games Between Bench Periods")
    _ax.set_xticks(_x)
    _ax.set_xticklabels(_players)
    _ax.legend()
    _ax.grid(axis='y', alpha=0.3)

    # Add value labels
    for _bar in _bars1:
        _ax.text(_bar.get_x() + _bar.get_width()/2, _bar.get_height() + 0.1,
                 f'{_bar.get_height():.2f}', ha='center', va='bottom', fontsize=9)
    for _bar in _bars2:
        _ax.text(_bar.get_x() + _bar.get_width()/2, _bar.get_height() + 0.1,
                 f'{_bar.get_height():.2f}', ha='center', va='bottom', fontsize=9)

    _fig.tight_layout()
    _buffer = io.BytesIO()
    _fig.savefig(_buffer, format="png", dpi=150, bbox_inches="tight")
    _buffer.seek(0)
    plt.close(_fig)

    print(f"[DEBUG] Chart cell 1 - chart generated, size: {len(_buffer.getvalue())} bytes")
    mo.image(_buffer.getvalue())
    return


@app.cell(hide_code=True)
def _(algo_stats, has_data, mo):
    mo.stop(not has_data)

    # Calculate efficiency (how close to theoretical max)
    _stats = algo_stats.to_dicts()

    _analysis = []
    for _row in _stats:
        _efficiency = (_row["mean_avg_gap"] / _row["theoreticalMax"]) * 100 if _row["theoreticalMax"] > 0 else 0
        _gap_from_ideal = _row["theoreticalMax"] - _row["mean_avg_gap"]
        _analysis.append({
            "players": _row["numPlayers"],
            "algo_avg": _row["mean_avg_gap"],
            "theoretical": _row["theoreticalMax"],
            "efficiency": _efficiency,
            "gap": _gap_from_ideal,
        })

    _best = max(_analysis, key=lambda x: x["efficiency"])
    _worst = min(_analysis, key=lambda x: x["efficiency"])

    mo.md(f"""
    ### Efficiency Analysis

    The algorithm's **efficiency** measures how close it gets to the theoretical maximum:

    | Players | Algo Avg | Theoretical | Efficiency | Gap from Ideal |
    |---------|----------|-------------|------------|----------------|
    """ + "\n".join([
        f"| {a['players']} | {a['algo_avg']:.2f} | {a['theoretical']:.2f} | **{a['efficiency']:.1f}%** | {a['gap']:.2f} |"
        for a in _analysis
    ]) + f"""

    **Key Findings:**
    - **Best efficiency**: {_best['players']} players at **{_best['efficiency']:.1f}%** of theoretical max
    - **Worst efficiency**: {_worst['players']} players at **{_worst['efficiency']:.1f}%** of theoretical max
    - Average efficiency across all configs: **{sum(a['efficiency'] for a in _analysis) / len(_analysis):.1f}%**
    """)
    return


@app.cell(hide_code=True)
def _():
    return


@app.cell
def _(config, has_data, mo, np, pl, random):
    mo.stop(not has_data)

    def simulate_random_baseline(num_players: int, num_courts: int, num_rounds: int, num_sims: int = 1000):
        """Simulate random player selection to establish baseline bench gaps."""
        all_gaps = []

        playing_spots = num_courts * 4

        for _ in range(num_sims):
            # Track last bench round for each player
            last_bench = {f"P{i+1}": 0 for i in range(num_players)}
            gaps = []

            for round_num in range(1, num_rounds + 1):
                # Randomly select players to play
                all_players = list(last_bench.keys())
                playing = set(random.sample(all_players, min(playing_spots, len(all_players))))

                # Record bench events
                for player in all_players:
                    if player not in playing:
                        if last_bench[player] > 0:
                            gap = round_num - last_bench[player] - 1
                            gaps.append(gap)
                        last_bench[player] = round_num

            if gaps:
                all_gaps.append(np.mean(gaps))

        return np.mean(all_gaps) if all_gaps else 0, np.std(all_gaps) if all_gaps else 0

    # Calculate baseline for each player count
    baseline_stats = []
    for _np in range(config["minPlayers"], config["maxPlayers"] + 1):
        _mean_gap, _std_gap = simulate_random_baseline(
            _np, config["numCourts"], config["rounds"], num_sims=500
        )
        baseline_stats.append({
            "numPlayers": _np,
            "baseline_mean": _mean_gap,
            "baseline_std": _std_gap,
        })

    baseline_df = pl.DataFrame(baseline_stats)
    return (baseline_df,)


@app.cell
def _(algo_stats, baseline_df, has_data, io, mo, np, plt, theoretical_values):
    mo.stop(not has_data)

    _fig, _ax = plt.subplots(figsize=(12, 6))

    _players = algo_stats.get_column("numPlayers").to_list()
    _algo_means = algo_stats.get_column("mean_avg_gap").to_list()
    _algo_stds = algo_stats.get_column("std_avg_gap").to_list()
    _baseline_means = baseline_df.get_column("baseline_mean").to_list()
    _baseline_stds = baseline_df.get_column("baseline_std").to_list()
    _theoretical = [theoretical_values[p] for p in _players]

    _x = np.arange(len(_players))
    _width = 0.25

    # Baseline bars
    _bars1 = _ax.bar(_x - _width, _baseline_means, _width,
                     label="Random Baseline", color="#E45756", alpha=0.8)
    _ax.errorbar(_x - _width, _baseline_means, yerr=_baseline_stds,
                 fmt='none', color='#333', capsize=3)

    # Algorithm bars
    _bars2 = _ax.bar(_x, _algo_means, _width,
                     label="Algorithm", color="#4C78A8", alpha=0.8)
    _ax.errorbar(_x, _algo_means, yerr=_algo_stds,
                 fmt='none', color='#333', capsize=3)

    # Theoretical max bars
    _bars3 = _ax.bar(_x + _width, _theoretical, _width,
                     label="Theoretical Max", color="#54A24B", alpha=0.8)

    _ax.set_xlabel("Number of Players")
    _ax.set_ylabel("Average Games Between Benches")
    _ax.set_title("Bench Gap Analysis: Algorithm vs Random Baseline vs Theoretical Maximum")
    _ax.set_xticks(_x)
    _ax.set_xticklabels(_players)
    _ax.legend()
    _ax.grid(axis='y', alpha=0.3)

    _fig.tight_layout()
    _buffer = io.BytesIO()
    _fig.savefig(_buffer, format="png", dpi=150, bbox_inches="tight")
    _buffer.seek(0)
    plt.close(_fig)

    mo.image(_buffer.getvalue())
    return


@app.cell(hide_code=True)
def _(algo_stats, baseline_df, has_data, mo, theoretical_values):
    mo.stop(not has_data)

    _algo = algo_stats.to_dicts()
    _baseline = baseline_df.to_dicts()

    _comparison = []
    for _i, _row in enumerate(_algo):
        _np = _row["numPlayers"]
        _algo_mean = _row["mean_avg_gap"]
        _baseline_mean = _baseline[_i]["baseline_mean"]
        _theoretical = theoretical_values[_np]

        # Improvement over baseline
        _improvement = ((_algo_mean - _baseline_mean) / _baseline_mean * 100) if _baseline_mean > 0 else 0

        # Distance from theoretical (normalized)
        _algo_efficiency = (_algo_mean / _theoretical * 100) if _theoretical > 0 else 0
        _baseline_efficiency = (_baseline_mean / _theoretical * 100) if _theoretical > 0 else 0

        _comparison.append({
            "players": _np,
            "baseline": _baseline_mean,
            "algorithm": _algo_mean,
            "theoretical": _theoretical,
            "improvement": _improvement,
            "algo_eff": _algo_efficiency,
            "baseline_eff": _baseline_efficiency,
        })

    _avg_improvement = sum(c["improvement"] for c in _comparison) / len(_comparison)
    _avg_algo_eff = sum(c["algo_eff"] for c in _comparison) / len(_comparison)
    _avg_baseline_eff = sum(c["baseline_eff"] for c in _comparison) / len(_comparison)

    mo.md(f"""
    ### Algorithm vs Baseline Comparison

    | Players | Baseline | Algorithm | Theoretical | Improvement | Algo Eff. | Baseline Eff. |
    |---------|----------|-----------|-------------|-------------|-----------|---------------|
    """ + "\n".join([
        f"| {c['players']} | {c['baseline']:.2f} | {c['algorithm']:.2f} | {c['theoretical']:.2f} | **{c['improvement']:+.1f}%** | {c['algo_eff']:.1f}% | {c['baseline_eff']:.1f}% |"
        for c in _comparison
    ]) + f"""

    **Summary:**
    - **Average improvement over baseline**: {_avg_improvement:+.1f}%
    - **Algorithm efficiency** (% of theoretical max): {_avg_algo_eff:.1f}%
    - **Baseline efficiency** (% of theoretical max): {_avg_baseline_eff:.1f}%

    {'**The algorithm provides meaningful improvement** over random selection!' if _avg_improvement > 5 else '**The algorithm shows minimal improvement** over random selection.' if _avg_improvement > 0 else '**The algorithm performs worse** than random selection!'}
    """)
    return


@app.cell(hide_code=True)
def _():
    return


@app.cell
def _(events_summary, gap_distributions, has_data, io, mo, np, pl, plt):
    mo.stop(not has_data)

    # Get distribution of gaps for each player count from pre-aggregated histogram data
    _fig, _axes = plt.subplots(2, 2, figsize=(12, 10))
    _axes = _axes.flatten()

    _player_counts = gap_distributions.get_column("numPlayers").unique().sort().to_list()

    for _idx, _np in enumerate(_player_counts[:4]):
        _ax = _axes[_idx]

        # Get histogram data for this player count
        _hist_data = gap_distributions.filter(pl.col("numPlayers") == _np).sort("gamesSinceLastBench")
        _gaps = _hist_data.get_column("gamesSinceLastBench").to_list()
        _counts = _hist_data.get_column("count").to_list()

        if _gaps:
            _ax.bar(_gaps, _counts, color="#4C78A8", alpha=0.7, edgecolor='white', width=0.8)
            
            # Get mean from events_summary
            _mean_gap = events_summary.filter(pl.col("numPlayers") == _np).get_column("mean_gap")[0]
            _ax.axvline(_mean_gap, color='#E45756', linestyle='--', 
                        linewidth=2, label=f'Mean: {_mean_gap:.2f}')

            # Add theoretical max line
            _theoretical = 16 / (_np - 16)
            _ax.axvline(_theoretical, color='#54A24B', linestyle='-', 
                        linewidth=2, label=f'Theoretical: {_theoretical:.2f}')

            _ax.set_xlabel("Games Between Benches")
            _ax.set_ylabel("Frequency")
            _ax.set_title(f"{_np} Players")
            _ax.legend()
            _ax.grid(axis='y', alpha=0.3)

    _fig.suptitle("Distribution of Games Between Bench Periods", fontsize=14, fontweight='bold')
    _fig.tight_layout()

    _buffer = io.BytesIO()
    _fig.savefig(_buffer, format="png", dpi=150, bbox_inches="tight")
    _buffer.seek(0)
    plt.close(_fig)

    mo.image(_buffer.getvalue())
    return


@app.cell(hide_code=True)
def _():
    return


@app.cell(hide_code=True)
def _(mo):
    _proof=mo.md(r"""
**Claim:** With perfect scheduling, zero double benches is theoretically achievable for 17-20 players on 4 courts.

**Proof:**

Let:
- $n$ = number of players (17, 18, 19, or 20)
- $s$ = playing spots = 4 courts × 4 players = 16
- $b$ = players benched per round = $n - s = n - 16$

**Key Insight:** To avoid a double bench, we need to ensure that no player who benched in round $k$ also benches in round $k+1$.

**Analysis:**
- In round $k$, exactly $b$ players are benched
- In round $k+1$, we need to choose $b$ players to bench
- Available players who did NOT bench in round $k$ = $n - b = 16$

**Condition for zero double benches:**
We can avoid double benching if the number of "safe" players (who didn't bench last round) ≥ number we need to bench:

$n - b \geq b$, which simplifies to $16 \geq b$

**Verification for each case:**

| Players (n) | Benched/round (b) | Safe players (n-b) | b ≤ 16? |
|-------------|-------------------|-------------------|---------|
| 17 | 1 | 16 | Yes |
| 18 | 2 | 16 | Yes |
| 19 | 3 | 16 | Yes |
| 20 | 4 | 16 | Yes |

**Conclusion:** Since $b \leq 16$ for all cases (17-20 players), we can always select $b$ players to bench from the 16 players who played in the previous round. Therefore, **zero double benches is achievable** with optimal scheduling.

**Note:** This is an upper bound - the actual algorithm may not achieve zero due to other constraints (partner variety, opponent balance, etc.).
    """)
    mo.accordion({"Mathematical Proof: Zero Double Benches is Achievable": _proof}, lazy=True)
    return


@app.cell
def _(config, events_summary, has_data, io, mo, np, pl, plt, random):
    mo.stop(not has_data)

    # Get double bench rate from pre-aggregated data
    _algo_double_bench = {}
    for _np in range(config["minPlayers"], config["maxPlayers"] + 1):
        _row = events_summary.filter(pl.col("numPlayers") == _np)
        if _row.height > 0:
            _total = _row.get_column("total_bench_events")[0]
            _double = _row.get_column("double_bench_count")[0]
            _algo_double_bench[_np] = (_double / _total * 100) if _total > 0 else 0

    # Simulate random baseline double bench rate
    def _simulate_baseline_double_bench(num_players: int, num_courts: int, num_rounds: int, num_sims: int = 500):
        playing_spots = num_courts * 4
        total_double = 0
        total_benches = 0

        for _ in range(num_sims):
            last_bench = {f"P{i+1}": 0 for i in range(num_players)}

            for round_num in range(1, num_rounds + 1):
                all_players = list(last_bench.keys())
                playing = set(random.sample(all_players, min(playing_spots, len(all_players))))

                for player in all_players:
                    if player not in playing:
                        if last_bench[player] > 0:
                            total_benches += 1
                            if round_num - last_bench[player] == 1:
                                total_double += 1
                        last_bench[player] = round_num

        return (total_double / total_benches * 100) if total_benches > 0 else 0

    _baseline_double_bench = {}
    for _np in range(config["minPlayers"], config["maxPlayers"] + 1):
        _baseline_double_bench[_np] = _simulate_baseline_double_bench(
            _np, config["numCourts"], config["rounds"], num_sims=500
        )

    # Create comparison chart
    _fig, _ax = plt.subplots(figsize=(10, 6))

    _players = list(_algo_double_bench.keys())
    _algo_rates = [_algo_double_bench[p] for p in _players]
    _baseline_rates = [_baseline_double_bench[p] for p in _players]

    _x = np.arange(len(_players))
    _width = 0.35

    _bars1 = _ax.bar(_x - _width/2, _baseline_rates, _width,
                     label="Random Baseline", color="#E45756", alpha=0.8)
    _bars2 = _ax.bar(_x + _width/2, _algo_rates, _width,
                     label="Algorithm", color="#4C78A8", alpha=0.8)

    _ax.set_xlabel("Number of Players")
    _ax.set_ylabel("Double Bench Rate (%)")
    _ax.set_title("Double Bench Frequency: Algorithm vs Random Baseline\n(Lower is better, theoretical ideal is 0%)")
    _ax.set_xticks(_x)
    _ax.set_xticklabels(_players)
    _ax.legend()
    _ax.grid(axis='y', alpha=0.3)

    # Add value labels
    for _bar in _bars1:
        _ax.text(_bar.get_x() + _bar.get_width()/2, _bar.get_height() + 0.3,
                 f'{_bar.get_height():.1f}%', ha='center', va='bottom', fontsize=9)
    for _bar in _bars2:
        _ax.text(_bar.get_x() + _bar.get_width()/2, _bar.get_height() + 0.3,
                 f'{_bar.get_height():.1f}%', ha='center', va='bottom', fontsize=9)

    _fig.tight_layout()
    _buffer = io.BytesIO()
    _fig.savefig(_buffer, format="png", dpi=150, bbox_inches="tight")
    _buffer.seek(0)
    plt.close(_fig)

    mo.image(_buffer.getvalue())
    return


@app.cell(hide_code=True)
def _(config, events_summary, has_data, mo, pl, random):
    mo.stop(not has_data)

    # Get algorithm data from pre-aggregated events_summary
    _algo_data = {}
    for _np in range(config["minPlayers"], config["maxPlayers"] + 1):
        _row = events_summary.filter(pl.col("numPlayers") == _np)
        if _row.height > 0:
            _total = _row.get_column("total_bench_events")[0]
            _double = _row.get_column("double_bench_count")[0]
            _algo_data[_np] = {"total": _total, "double": _double, "rate": (_double / _total * 100) if _total > 0 else 0}

    def _sim_baseline(num_players, num_courts, num_rounds, num_sims=500):
        playing_spots = num_courts * 4
        total_double = 0
        total_benches = 0
        for _ in range(num_sims):
            last_bench = {f"P{i+1}": 0 for i in range(num_players)}
            for round_num in range(1, num_rounds + 1):
                playing = set(random.sample(list(last_bench.keys()), min(playing_spots, num_players)))
                for player in last_bench:
                    if player not in playing:
                        if last_bench[player] > 0:
                            total_benches += 1
                            if round_num - last_bench[player] == 1:
                                total_double += 1
                        last_bench[player] = round_num
        return (total_double / total_benches * 100) if total_benches > 0 else 0

    _baseline_data = {_np: _sim_baseline(_np, config["numCourts"], config["rounds"]) 
                      for _np in range(config["minPlayers"], config["maxPlayers"] + 1)}

    _rows = []
    for _np in sorted(_algo_data.keys()):
        _algo_rate = _algo_data[_np]["rate"]
        _base_rate = _baseline_data[_np]
        _reduction = ((_base_rate - _algo_rate) / _base_rate * 100) if _base_rate > 0 else 0
        _rows.append(f"| {_np} | {_base_rate:.2f}% | {_algo_rate:.2f}% | **{_reduction:+.1f}%** |")

    mo.md(f"""
    ### Double Bench Summary

    | Players | Baseline Rate | Algorithm Rate | Reduction |
    |---------|--------------|----------------|-----------|
    {chr(10).join(_rows)}

    **Interpretation:** The algorithm significantly reduces the occurrence of consecutive benching compared to random selection.
    """)
    return


@app.cell(hide_code=True)
def _(events_summary, has_data, mo, pl):
    mo.stop(not has_data)

    # Analyze variability using aggregated stats
    _rows = events_summary.sort("numPlayers").to_dicts()

    mo.md(f"""
    ### Distribution Analysis: Bench Gap Variability

    The **standard deviation** measures how much bench gaps vary from the mean.
    Lower values indicate more consistent player experience.

    | Players | Mean Gap | Std Gap | CV (%) | Total Bench Events |
    |---------|----------|---------|--------|-------------------|
    """ + "\n".join([
        f"| {r['numPlayers']} | {r['mean_gap']:.2f} | {r['std_gap']:.2f} | {(r['std_gap'] / r['mean_gap'] * 100):.1f}% | {r['total_bench_events']:,} |"
        for r in _rows
    ]) + f"""

    **Note:** CV (Coefficient of Variation) = std / mean × 100%. This measures relative variability.
    """)
    return


@app.cell(hide_code=True)
def _(algo_stats, baseline_df, has_data, mo, theoretical_values):
    mo.stop(not has_data)

    _algo = algo_stats.to_dicts()
    _baseline = baseline_df.to_dicts()

    _overall_algo_eff = sum(
        r["mean_avg_gap"] / theoretical_values[r["numPlayers"]] * 100 
        for r in _algo
    ) / len(_algo)

    _overall_baseline_eff = sum(
        r["baseline_mean"] / theoretical_values[r["numPlayers"]] * 100 
        for r in _baseline
    ) / len(_baseline)

    _improvement = _overall_algo_eff - _overall_baseline_eff

    mo.md(f"""
    ## Conclusions

    ### Key Findings

    1. **Algorithm Efficiency**: The algorithm achieves **{_overall_algo_eff:.1f}%** of the theoretical maximum games between benches.

    2. **Baseline Comparison**: Random selection achieves **{_overall_baseline_eff:.1f}%** efficiency, meaning the algorithm provides a **{_improvement:+.1f} percentage point** improvement.

    3. **Scaling Behavior**: 
       - With fewer bench spots (17 players), the algorithm has more room to optimize
       - With more bench spots (20 players), the theoretical max is lower but the algorithm maintains good efficiency

    ### Recommendations

    {'**The algorithm is working well** - it significantly outperforms random selection and approaches the theoretical optimum.' if _improvement > 10 else '**The algorithm could be improved** - while it beats random selection, there is room for optimization.' if _improvement > 0 else '**The algorithm needs attention** - it is not effectively optimizing bench distribution.'}

    **For best player experience:**
    - With 17 players: Players can expect ~{_algo[0]['mean_avg_gap']:.1f} games between benches (theoretical max: {theoretical_values[17]:.1f})
    - With 20 players: Players can expect ~{_algo[3]['mean_avg_gap']:.1f} games between benches (theoretical max: {theoretical_values[20]:.1f})
    """)
    return


if __name__ == "__main__":
    app.run()
