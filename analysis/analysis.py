import marimo

__generated_with = "0.19.4"
app = marimo.App(width="medium")


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
    return Path, io, json, math, mo, os, pl, random


@app.cell
def _(Path, json, pl):
    data_dir = Path(__file__).parent / "data"
    
    # Load OLD algorithm data (original)
    old_algo_dir = data_dir / "old_algo"
    summary = pl.read_csv(old_algo_dir / "summary.csv")
    pair_events = pl.read_csv(old_algo_dir / "pair_events.csv")
    config = json.loads((old_algo_dir / "config.json").read_text())
    
    # Load NEW algorithm data (updated shuffle)
    new_algo_dir = data_dir / "new_algo"
    new_algo_summary = pl.read_csv(new_algo_dir / "summary.csv")
    new_algo_pair_events = pl.read_csv(new_algo_dir / "pair_events.csv")
    new_algo_config = json.loads((new_algo_dir / "config.json").read_text())
    
    return config, new_algo_config, new_algo_pair_events, new_algo_summary, pair_events, summary


@app.cell(hide_code=True)
def _(config, mo):
    mo.md(f"""
    # Court Assignment Repeat Analysis

    **Comparing Three Algorithms:**
    - **Old Algorithm**: Original player pairing logic
    - **Random Baseline**: No optimization (random pairs)
    - **New Algorithm**: Updated shuffle for player pairs

    **Configuration** (same for all)
    - Runs: {config['runs']} per batch (5 batches each)
    - Rounds: {config['rounds']} (consecutive assignments per run)
    - Players: {config['numPlayers']} (total pool size)
    - Courts: {config['numCourts']} (matches per round)
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.stop(mo.app_meta().mode == "run")
    mo.md("""
    ## Plot Configuration
    Prepare matplotlib cache directories so charts render reliably inside marimo.
    """)
    return


@app.cell
def _(Path, os):
    _mpl_config_dir = Path(__file__).parent / ".mplconfig"
    _cache_dir = Path(__file__).parent / ".cache"
    _mpl_config_dir.mkdir(exist_ok=True)
    _cache_dir.mkdir(exist_ok=True)
    _ = os.environ.setdefault("MPLCONFIGDIR", str(_mpl_config_dir))
    _ = os.environ.setdefault("XDG_CACHE_HOME", str(_cache_dir))
    return


@app.cell
def _():
    import matplotlib.pyplot as plt
    import numpy as np
    return np, plt


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Algorithm Summary Metrics
    Compute overall rates of repeat teammates and opponent changes in the algorithm output.
    """)
    return


@app.cell
def _(pl, summary):
    summary_metrics = (
        summary.with_columns(
            pl.col("repeatAnyPair").cast(pl.Int8).alias("repeatAnyPairInt"),
            pl.col("repeatPairDifferentOpponents").cast(pl.Int8).alias("repeatPairDifferentOpponentsInt"),
            pl.col("repeatPairSameOpponents").cast(pl.Int8).alias("repeatPairSameOpponentsInt"),
        )
        .select(
            pl.len().alias("runs"),
            pl.mean("repeatAnyPairInt").alias("p_any_repeat"),
            pl.mean("repeatPairDifferentOpponentsInt").alias("p_repeat_diff_opponent"),
            pl.mean("repeatPairSameOpponentsInt").alias("p_repeat_same_opponent"),
            pl.mean("repeatPairCount").alias("avg_repeat_pairs"),
            pl.mean("repeatPairDifferentOpponentsCount").alias("avg_repeat_pairs_diff_opponent"),
            pl.mean("repeatPairSameOpponentsCount").alias("avg_repeat_pairs_same_opponent"),
        )
    )
    return (summary_metrics,)


@app.cell
def _(mo, summary_metrics):
    mo.ui.table(summary_metrics)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.stop(mo.app_meta().mode == "run")
    mo.md("""
    ## Statistical Helpers
    Build reusable functions for proportions and confidence intervals.
    """)
    return


@app.cell
def _(math, pl):
    def proportion_ci(series: pl.Series) -> tuple[float, float, float]:
        n = series.len()
        if n == 0:
            return 0.0, 0.0, 0.0
        p = series.mean()
        se = math.sqrt(p * (1 - p) / n)
        return p, max(0.0, p - 1.96 * se), min(1.0, p + 1.96 * se)

    def build_stats(df: pl.DataFrame, label: str) -> pl.DataFrame:
        any_repeat = df.get_column("repeatAnyPair").cast(pl.Int8)
        diff_opponent = df.get_column("repeatPairDifferentOpponents").cast(pl.Int8)
        same_opponent = df.get_column("repeatPairSameOpponents").cast(pl.Int8)

        any_p, any_low, any_high = proportion_ci(any_repeat)
        diff_p, diff_low, diff_high = proportion_ci(diff_opponent)
        same_p, same_low, same_high = proportion_ci(same_opponent)

        return pl.DataFrame(
            {
                "label": [label],
                "runs": [df.height],
                "p_any_repeat": [any_p],
                "ci_any_repeat_low": [any_low],
                "ci_any_repeat_high": [any_high],
                "p_repeat_diff_opponent": [diff_p],
                "ci_repeat_diff_opponent_low": [diff_low],
                "ci_repeat_diff_opponent_high": [diff_high],
                "p_repeat_same_opponent": [same_p],
                "ci_repeat_same_opponent_low": [same_low],
                "ci_repeat_same_opponent_high": [same_high],
                "avg_repeat_pairs": [df.get_column("repeatPairCount").mean()],
                "avg_repeat_pairs_diff_opponent": [
                    df.get_column("repeatPairDifferentOpponentsCount").mean()
                ],
                "avg_repeat_pairs_same_opponent": [
                    df.get_column("repeatPairSameOpponentsCount").mean()
                ],
            }
        )
    return (build_stats,)


@app.cell(hide_code=True)
def _(mo):
    mo.stop(mo.app_meta().mode == "run")
    mo.md("""
    ## Random Baseline
    Simulate a random scheduler under identical constraints for comparison.
    """)
    return


@app.cell
def _(config, pl, random):
    # Match the number of batches from algorithm simulation
    BASELINE_BATCHES = config.get("numBatches", 5)
    BASELINE_RUNS_PER_BATCH = config.get("runs", 1000)

    players = [f"P{i + 1}" for i in range(config["numPlayers"])]

    def pair_key(a: str, b: str) -> str:
        return f"{a}|{b}" if a < b else f"{b}|{a}"

    def random_round() -> dict[str, str]:
        selected = random.sample(players, config["numCourts"] * 4)
        random.shuffle(selected)

        pair_to_opponent: dict[str, str] = {}
        for i in range(0, len(selected), 4):
            group = selected[i : i + 4]
            pairings = [
                ((group[0], group[1]), (group[2], group[3])),
                ((group[0], group[2]), (group[1], group[3])),
                ((group[0], group[3]), (group[1], group[2])),
            ]
            team1, team2 = random.choice(pairings)
            team1_id = pair_key(*team1)
            team2_id = pair_key(*team2)
            pair_to_opponent[team1_id] = team2_id
            pair_to_opponent[team2_id] = team1_id
        return pair_to_opponent

    all_summaries = []
    all_pair_events_list = []
    baseline_batch_summaries = []  # Per-batch stats for multi-batch comparison

    for batch_id in range(1, BASELINE_BATCHES + 1):
        _batch_summaries = []

        for sim_id in range(BASELINE_RUNS_PER_BATCH):
            rounds = [random_round() for _ in range(config["rounds"])]
            repeat_pair_count = 0
            repeat_diff = 0
            repeat_same = 0

            for i in range(len(rounds) - 1):
                current = rounds[i]
                next_round = rounds[i + 1]
                for pair_id, opponent_from in current.items():
                    opponent_to = next_round.get(pair_id)
                    if not opponent_to:
                        continue
                    repeat_pair_count += 1
                    opponent_changed = opponent_from != opponent_to
                    if opponent_changed:
                        repeat_diff += 1
                    else:
                        repeat_same += 1
                    # Track the event with batch info
                    all_pair_events_list.append({
                        "batch": str(batch_id),
                        "simulationId": sim_id,
                        "pairId": pair_id,
                        "opponentChanged": opponent_changed,
                    })

            summary_row = {
                "batch": str(batch_id),
                "repeatAnyPair": repeat_pair_count > 0,
                "repeatPairDifferentOpponents": repeat_diff > 0,
                "repeatPairSameOpponents": repeat_same > 0,
                "repeatPairCount": repeat_pair_count,
                "repeatPairDifferentOpponentsCount": repeat_diff,
                "repeatPairSameOpponentsCount": repeat_same,
            }
            all_summaries.append(summary_row)
            _batch_summaries.append(summary_row)

        # Compute per-batch stats
        _batch_df = pl.DataFrame(_batch_summaries)
        baseline_batch_summaries.append({
            "batch": str(batch_id),
            "runs": len(_batch_summaries),
            "p_any_repeat": _batch_df.get_column("repeatAnyPair").sum() / len(_batch_summaries),
            "avg_repeat_pairs": _batch_df.get_column("repeatPairDifferentOpponentsCount").mean(),
            "zero_repeat_pct": (_batch_df.get_column("repeatPairDifferentOpponentsCount") == 0).sum() / len(_batch_summaries),
        })

    baseline = pl.DataFrame(all_summaries)
    baseline_pair_events = pl.DataFrame(all_pair_events_list)
    baseline_batch_stats = pl.DataFrame(baseline_batch_summaries)
    return baseline, baseline_batch_stats, baseline_pair_events


@app.cell
def _(baseline_pair_events, config, new_algo_pair_events, pair_events, pl):
    """
    Compute normalized pair frequencies for baseline and new algorithm.
    
    Both are scaled so their TOTAL events match the OLD algorithm's total,
    making comparisons about distribution patterns rather than total volume.
    """
    _runs_per_batch = config.get("runs", 5000)
    _num_batches = config.get("numBatches", 5)
    
    # Calculate OLD algorithm's average events per batch (reference)
    _old_algo_events_per_batch = (
        pair_events.group_by("batch" if "batch" in pair_events.columns else pl.lit("1"))
        .agg(pl.len().alias("events"))
        .get_column("events")
        .mean()
    ) if pair_events.height > 0 else 0
    
    # Calculate baseline's average events per batch (raw)
    _baseline_events_per_batch = (
        baseline_pair_events.group_by("batch")
        .agg(pl.len().alias("events"))
        .get_column("events")
        .mean()
    ) if baseline_pair_events.height > 0 else 1
    
    # Calculate NEW algorithm's average events per batch (raw)
    _new_algo_events_per_batch = (
        new_algo_pair_events.group_by("batch" if "batch" in new_algo_pair_events.columns else pl.lit("1"))
        .agg(pl.len().alias("events"))
        .get_column("events")
        .mean()
    ) if new_algo_pair_events.height > 0 else 1
    
    # Scaling factors to normalize to OLD algorithm's volume
    _baseline_scale = _old_algo_events_per_batch / _baseline_events_per_batch if _baseline_events_per_batch > 0 else 1
    _new_algo_scale = _old_algo_events_per_batch / _new_algo_events_per_batch if _new_algo_events_per_batch > 0 else 1
    
    # Calculate baseline pair frequencies (averaged across batches, then scaled)
    _baseline_pair_counts = (
        baseline_pair_events.group_by("pairId")
        .agg(pl.len().alias("raw_events"))
        .with_columns([
            (pl.col("raw_events") / _num_batches * _baseline_scale).alias("events")
        ])
        .to_dicts()
    )
    
    # Calculate NEW algorithm pair frequencies (averaged across batches, then scaled)
    _new_algo_pair_counts = (
        new_algo_pair_events.group_by("pairId")
        .agg(pl.len().alias("raw_events"))
        .with_columns([
            (pl.col("raw_events") / _num_batches * _new_algo_scale).alias("events")
        ])
        .to_dicts()
    )
    
    # Create normalized dictionaries (ready to use everywhere)
    normalized_baseline_pairs = {r["pairId"]: r["events"] for r in _baseline_pair_counts}
    normalized_new_algo_pairs = {r["pairId"]: r["events"] for r in _new_algo_pair_counts}
    baseline_scale_factor = _baseline_scale
    new_algo_scale_factor = _new_algo_scale
    
    return baseline_scale_factor, new_algo_scale_factor, normalized_baseline_pairs, normalized_new_algo_pairs


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Algorithm vs Random Summary
    Compare the algorithm against the baseline with confidence intervals.
    """)
    return


@app.cell
def _(baseline, build_stats, pl, summary):
    algorithm_stats = build_stats(summary, "algorithm")
    baseline_stats = build_stats(baseline, "random_baseline")
    stats = pl.concat([algorithm_stats, baseline_stats])
    return (stats,)


@app.cell(hide_code=True)
def _(mo, stats):
    mo.ui.table(stats)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Algorithm vs Baseline Plot
    Compare the probability of repeating the same pair with different opponents.
    """)
    return


@app.cell
def _(io, mo, plt, stats):
    _rows = stats.to_dicts()
    _by_label = {row["label"]: row for row in _rows}
    _algo = _by_label.get("algorithm")
    _baseline_row = _by_label.get("random_baseline")

    if not _algo or not _baseline_row:
        mo.md("Missing stats rows; rerun the stats cell to render the plot.")
    else:
        values = [
            _algo["p_repeat_diff_opponent"],
            _baseline_row["p_repeat_diff_opponent"],
        ]
        errors = [
            [
                values[0] - _algo["ci_repeat_diff_opponent_low"],
                values[1] - _baseline_row["ci_repeat_diff_opponent_low"],
            ],
            [
                _algo["ci_repeat_diff_opponent_high"] - values[0],
                _baseline_row["ci_repeat_diff_opponent_high"] - values[1],
            ],
        ]

        _fig, _ax = plt.subplots(figsize=(6, 4))
        _bars = _ax.bar(
            ["Algorithm", "Baseline"],
            values,
            color=["#4C78A8", "#F58518"],
        )
        _ax.errorbar(
            ["Algorithm", "Baseline"],
            values,
            yerr=errors,
            fmt="none",
            ecolor="#444444",
            capsize=4,
        )
        _ax.set_ylabel("Probability")
        _ax.set_ylim(0, max(values) * 1.4 if max(values) > 0 else 0.1)

        for _bar, _value in zip(_bars, values):
            _ax.text(
                _bar.get_x() + _bar.get_width() / 2,
                _bar.get_height(),
                f"{_value:.2%}",
                ha="center",
                va="bottom",
            )

        _fig.tight_layout()
        _buffer = io.BytesIO()
        _fig.savefig(_buffer, format="png", dpi=150, bbox_inches="tight")
        _buffer.seek(0)
        mo.image(_buffer.getvalue())
    return


@app.cell
def _(mo, stats):
    _rows = stats.to_dicts()
    _by_label = {row["label"]: row for row in _rows}
    _algo = _by_label.get("algorithm")
    _baseline_row = _by_label.get("random_baseline")

    if not _algo or not _baseline_row:
        mo.md("## Conclusion\nRun the stats cell to compute a conclusion.")
    else:
        algo_rate = _algo["p_repeat_diff_opponent"]
        base_rate = _baseline_row["p_repeat_diff_opponent"]
        delta = algo_rate - base_rate
        direction = (
            "lower" if delta < 0 else "higher" if delta > 0 else "the same as"
        )

        mo.md(
            f"""
    ## Conclusion

    The algorithm's repeat-with-different-opponents rate is **{algo_rate:.2%}**, which is **{abs(delta):.2%} {direction}** the random baseline (**{base_rate:.2%}**).
    If this rate is higher than the baseline, the algorithm is encouraging repeat pairs; if it is lower, it is successfully discouraging them.
    """
        )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Repetition Analysis: Algorithm vs Random Baseline

    This section analyzes **teammate repetition** across simulations, comparing the algorithm
    against a **random baseline** (a naive scheduler that randomly selects 16 players per round,
    shuffles them into groups of 4, and assigns pairings—with no optimization to avoid repeats).

    We examine two complementary metrics:
    - **Repeat-Count**: *How many* repeat teammate pairs occur per run (0, 1, 2, 3, ...)
    - **Any-Repeat**: *Did at least one* repeat occur? (binary yes/no)
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("### Repeat-Count Distribution")
    return


@app.cell
def _(pl, summary):
    diff_distribution = (
        summary.group_by("repeatPairDifferentOpponentsCount")
        .agg(pl.len().alias("runs"))
        .sort("repeatPairDifferentOpponentsCount")
    )
    return (diff_distribution,)


@app.cell
def _(baseline, pl):
    baseline_diff_distribution = (
        baseline.group_by("repeatPairDifferentOpponentsCount")
        .agg(pl.len().alias("runs"))
        .sort("repeatPairDifferentOpponentsCount")
    )
    return (baseline_diff_distribution,)


@app.cell
def _(baseline_diff_distribution, diff_distribution, io, mo, plt):
    _fig, _axes = plt.subplots(1, 2, figsize=(10, 4), sharey=True)
    _max_x = max(
        diff_distribution["repeatPairDifferentOpponentsCount"].max(),
        baseline_diff_distribution["repeatPairDifferentOpponentsCount"].max(),
    )

    # Normalize to percentages for fair comparison (different total runs)
    _algo_total = diff_distribution["runs"].sum()
    _baseline_total = baseline_diff_distribution["runs"].sum()

    _algo_pct = [r / _algo_total * 100 for r in diff_distribution["runs"].to_list()]
    _baseline_pct = [r / _baseline_total * 100 for r in baseline_diff_distribution["runs"].to_list()]

    _axes[0].bar(
        diff_distribution["repeatPairDifferentOpponentsCount"].to_list(),
        _algo_pct,
        color="#4C78A8",
    )
    _axes[0].set_title("Algorithm: repeat pairs w/ different opponents")
    _axes[0].set_xlabel("Repeat pairs per run")
    _axes[0].set_ylabel("Percentage of runs (%)")

    _axes[1].bar(
        baseline_diff_distribution["repeatPairDifferentOpponentsCount"].to_list(),
        _baseline_pct,
        color="#F58518",
    )
    _axes[1].set_title("Random baseline")
    _axes[1].set_xlabel("Repeat pairs per run")
    _axes[0].set_xlim(-0.5, _max_x + 0.5)
    _axes[1].set_xlim(-0.5, _max_x + 0.5)

    _fig.tight_layout()
    _buffer = io.BytesIO()
    _fig.savefig(_buffer, format="png", dpi=150, bbox_inches="tight")
    _buffer.seek(0)
    mo.image(_buffer.getvalue())
    return


@app.cell(hide_code=True)
def _(baseline, mo, summary):
    _algo_counts = summary.get_column("repeatPairDifferentOpponentsCount")
    _baseline_counts = baseline.get_column("repeatPairDifferentOpponentsCount")

    _algo_mean = _algo_counts.mean()
    _baseline_mean = _baseline_counts.mean()
    _algo_zero_pct = (_algo_counts == 0).sum() / _algo_counts.len() * 100
    _baseline_zero_pct = (_baseline_counts == 0).sum() / _baseline_counts.len() * 100

    mo.md(
        f"""
    ### Distribution Conclusion

    The algorithm achieves **{_algo_zero_pct:.1f}%** of runs with zero repeat teammate pairs,
    compared to only **{_baseline_zero_pct:.1f}%** for the random baseline. On average, the
    algorithm produces **{_algo_mean:.2f}** repeat pairs per run versus **{_baseline_mean:.2f}**
    for random selection—a **{((_baseline_mean - _algo_mean) / _baseline_mean * 100):.0f}% reduction**.

    The distribution chart shows the algorithm is heavily skewed toward zero repeats with a long
    tail, while the random baseline has a more spread-out distribution centered around higher values.
    This confirms the algorithm successfully minimizes teammate repetition across consecutive rounds.
    """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("### Any-Repeat Distribution")
    return


@app.cell
def _(pl, summary):
    repeat_any_distribution = (
        summary.group_by("repeatAnyPair")
        .agg(pl.len().alias("runs"))
        .with_columns((pl.col("runs") / pl.col("runs").sum()).alias("fraction"))
    )
    return (repeat_any_distribution,)


@app.cell
def _(mo, repeat_any_distribution):
    mo.ui.table(repeat_any_distribution)
    return


@app.cell(hide_code=True)
def _(baseline, mo, summary):
    _algo_any = summary.get_column("repeatAnyPair").sum() / summary.height * 100
    _baseline_any = baseline.get_column("repeatAnyPair").sum() / baseline.height * 100

    mo.md(
        f"""
    The algorithm produces **at least one repeat** in **{_algo_any:.1f}%** of runs, compared to
    **{_baseline_any:.1f}%** for the random baseline. While the random baseline almost always
    produces repeats ({_baseline_any:.0f}%+ of runs), the algorithm keeps nearly half of all
    runs completely repeat-free—a significant improvement in fairness and variety.
    """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Most Frequent Repeat Pairs
    List teammate pairs that reoccurred most often across simulations.
    """)
    return


@app.cell
def _(pair_events, pl):
    pair_frequency = (
        pair_events.group_by("pairId")
        .agg(pl.len().alias("repeat_events"))
        .sort("repeat_events", descending=True)
    )
    return (pair_frequency,)


@app.cell
def _(mo, pair_frequency):
    mo.ui.table(pair_frequency.head(20))
    return


@app.cell
def _(baseline_pair_events, config, io, mo, np, pair_events, pl, plt):
    # Build matrices for both algorithm and baseline
    _num_players = config["numPlayers"]
    _players = [f"P{i + 1}" for i in range(_num_players)]

    def build_matrix(events_df):
        _matrix = np.zeros((_num_players, _num_players))
        _pair_counts = (
            events_df.group_by("pairId")
            .agg(pl.len().alias("count"))
            .to_dicts()
        )
        for _row in _pair_counts:
            _pair_id = _row["pairId"]
            _count = _row["count"]
            _parts = _pair_id.split("|")
            _p1_idx = int(_parts[0][1:]) - 1
            _p2_idx = int(_parts[1][1:]) - 1
            _matrix[_p1_idx, _p2_idx] = _count
            _matrix[_p2_idx, _p1_idx] = _count
        return _matrix

    _algo_matrix = build_matrix(pair_events)
    _baseline_matrix = build_matrix(baseline_pair_events)

    # Normalize for comparison (different number of runs)
    # Note: simulationId is reused per batch, so we need to count batch+simulationId combinations
    _algo_runs = pair_events.select(pl.struct("simulationId")).n_unique()
    # For baseline, count unique (batch, simulationId) combinations
    _baseline_runs = baseline_pair_events.select(
        pl.struct("batch", "simulationId")
    ).n_unique()
    _algo_norm = _algo_matrix / _algo_runs * 1000  # per 1000 runs
    _baseline_norm = _baseline_matrix / _baseline_runs * 1000

    # Find common scale for both heatmaps
    _vmax = max(_algo_norm.max(), _baseline_norm.max())

    # Create side-by-side heatmaps with space for colorbar
    _fig, (_ax1, _ax2, _cax) = plt.subplots(1, 3, figsize=(18, 7),
                                             gridspec_kw={"width_ratios": [1, 1, 0.05]})

    _cmap = plt.cm.YlOrRd
    _cmap.set_under("white")

    # Algorithm heatmap
    _im1 = _ax1.imshow(_algo_norm, cmap=_cmap, vmin=0.1, vmax=_vmax, aspect="equal")
    _ax1.set_xticks(range(_num_players))
    _ax1.set_yticks(range(_num_players))
    _ax1.set_xticklabels(_players, rotation=45, ha="right", fontsize=8)
    _ax1.set_yticklabels(_players, fontsize=8)
    _ax1.set_xlabel("Player")
    _ax1.set_ylabel("Player")
    _ax1.set_title("Algorithm: Repeat Pair Hot Spots\n(per 1000 runs)")

    # Baseline heatmap
    _im2 = _ax2.imshow(_baseline_norm, cmap=_cmap, vmin=0.1, vmax=_vmax, aspect="equal")
    _ax2.set_xticks(range(_num_players))
    _ax2.set_yticks(range(_num_players))
    _ax2.set_xticklabels(_players, rotation=45, ha="right", fontsize=8)
    _ax2.set_yticklabels(_players, fontsize=8)
    _ax2.set_xlabel("Player")
    _ax2.set_ylabel("Player")
    _ax2.set_title("Random Baseline: Repeat Pair Hot Spots\n(per 1000 runs)")

    # Colorbar in dedicated axis (outside the heatmaps)
    _cbar = _fig.colorbar(_im2, cax=_cax)
    _cbar.set_label("Repeat events per 1000 runs", rotation=270, labelpad=20)

    _fig.tight_layout()
    _buffer = io.BytesIO()
    _fig.savefig(_buffer, format="png", dpi=150, bbox_inches="tight")
    _buffer.seek(0)
    plt.close(_fig)

    # Store matrices for later analysis
    algo_pair_matrix = _algo_norm
    baseline_pair_matrix = _baseline_norm
    mo.image(_buffer.getvalue())
    return algo_pair_matrix, baseline_pair_matrix


@app.cell(hide_code=True)
def _(algo_pair_matrix, baseline_pair_matrix, config, mo, np):
    # Compute statistics for conclusion
    _num_players = config["numPlayers"]

    # Get non-diagonal elements (actual pairs)
    _algo_upper = algo_pair_matrix[np.triu_indices(_num_players, k=1)]
    _baseline_upper = baseline_pair_matrix[np.triu_indices(_num_players, k=1)]

    # Correlation between algorithm and baseline patterns
    _correlation = np.corrcoef(_algo_upper, _baseline_upper)[0, 1]

    # Top N hot spots
    _algo_max = _algo_upper.max()
    _baseline_max = _baseline_upper.max()
    _algo_mean = _algo_upper[_algo_upper > 0].mean() if (_algo_upper > 0).any() else 0
    _baseline_mean = _baseline_upper[_baseline_upper > 0].mean() if (_baseline_upper > 0).any() else 0

    # Count active pairs
    _algo_active = (_algo_upper > 0).sum()
    _baseline_active = (_baseline_upper > 0).sum()
    _total_possible = len(_algo_upper)

    mo.md(
        f"""
    ### Heatmap Comparison: Algorithm vs Baseline

    | Metric | Algorithm | Baseline | Interpretation |
    |--------|-----------|----------|----------------|
    | Active pairs | {_algo_active}/{_total_possible} | {_baseline_active}/{_total_possible} | Baseline has more pairs with repeats |
    | Max intensity | {_algo_max:.1f} | {_baseline_max:.1f} | per 1000 runs |
    | Avg intensity (active) | {_algo_mean:.1f} | {_baseline_mean:.1f} | Algorithm is more concentrated |

    **Pattern correlation**: r = {_correlation:.3f}

    **Conclusions**:
    - The **algorithm** shows **concentrated hot spots** along the diagonal (P1|P2, P2|P3, etc.),
      suggesting a bias toward pairing adjacent player IDs.
    - The **baseline** shows a more **uniform distribution** across all pairs, as expected from
      random selection.
    - {'High' if _correlation > 0.5 else 'Low'} correlation ({_correlation:.2f}) indicates the algorithm
      {'shares similar pair patterns with' if _correlation > 0.5 else 'has different pair patterns from'} random chance.
    - The algorithm's **concentration** means fewer unique pairs repeat, but those that do repeat
      more frequently—a trade-off worth investigating.
    """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Algorithm vs Ideal (Delta)
    This diagram shows how the algorithm deviates from a statistical ideal (random baseline).
    Positive values mean the algorithm produces *more* of the event than random; negative values
    mean it produces *less*.
    """)
    return


@app.cell
def _(io, mo, np, plt, stats):
    _rows = stats.to_dicts()
    _by_label = {row["label"]: row for row in _rows}
    _algo = _by_label.get("algorithm")
    _baseline_row = _by_label.get("random_baseline")

    mo.stop(
        not _algo or not _baseline_row,
        mo.md("Missing stats rows; rerun the stats cell to render the delta plot.")
    )

    # Create a side-by-side comparison with improvement arrows
    _fig, (_ax1, _ax2) = plt.subplots(1, 2, figsize=(12, 5))

    # Left panel: Side-by-side bar chart
    _metrics = [
        ("p_any_repeat", "Any repeat\npairs"),
        ("p_repeat_diff_opponent", "Repeat w/\ndiff opponents"),
    ]
    _labels = [label for _, label in _metrics]
    _algo_values = [_algo[key] for key, _ in _metrics]
    _baseline_values = [_baseline_row[key] for key, _ in _metrics]

    _x = np.arange(len(_labels))
    _width = 0.35

    _bars1 = _ax1.bar(_x - _width / 2, _baseline_values, _width, label="Random Baseline", color="#E45756", alpha=0.8)
    _bars2 = _ax1.bar(_x + _width / 2, _algo_values, _width, label="Algorithm", color="#4C78A8", alpha=0.8)

    _ax1.set_ylabel("Probability", fontsize=11)
    _ax1.set_title("Algorithm vs Random Baseline", fontsize=12, fontweight="bold")
    _ax1.set_xticks(_x)
    _ax1.set_xticklabels(_labels, fontsize=10)
    _ax1.legend(loc="upper right")
    _ax1.set_ylim(0, 1.1)

    # Add value labels on bars
    for _bar in _bars1:
        _ax1.text(_bar.get_x() + _bar.get_width() / 2, _bar.get_height() + 0.02,
                  f"{_bar.get_height():.1%}", ha="center", va="bottom", fontsize=9, color="#E45756")
    for _bar in _bars2:
        _ax1.text(_bar.get_x() + _bar.get_width() / 2, _bar.get_height() + 0.02,
                  f"{_bar.get_height():.1%}", ha="center", va="bottom", fontsize=9, color="#4C78A8")

    # Right panel: Improvement waterfall
    _improvements = [
        (_baseline_values[i] - _algo_values[i]) / _baseline_values[i] * 100
        if _baseline_values[i] > 0 else 0
        for i in range(len(_metrics))
    ]
    _colors = ["#54A24B" if imp > 0 else "#E45756" for imp in _improvements]

    _bars3 = _ax2.barh(_labels, _improvements, color=_colors, alpha=0.8)
    _ax2.set_xlabel("Improvement (%)", fontsize=11)
    _ax2.set_title("Algorithm Improvement Over Random", fontsize=12, fontweight="bold")
    _ax2.axvline(0, color="#666666", linewidth=1)
    _ax2.set_xlim(-20, 60)

    for _i, (_bar, _imp) in enumerate(zip(_bars3, _improvements)):
        _ax2.text(_bar.get_width() + 2, _bar.get_y() + _bar.get_height() / 2,
                  f"{_imp:.1f}%", ha="left", va="center", fontsize=10, fontweight="bold")

    _fig.tight_layout()
    _buffer = io.BytesIO()
    _fig.savefig(_buffer, format="png", dpi=150, bbox_inches="tight")
    _buffer.seek(0)
    plt.close(_fig)
    mo.image(_buffer.getvalue())
    return


@app.cell(hide_code=True)
def _(mo, stats):
    _rows = stats.to_dicts()
    _by_label = {row["label"]: row for row in _rows}
    _algo = _by_label.get("algorithm")
    _baseline_row = _by_label.get("random_baseline")

    if not _algo or not _baseline_row:
        mo.md("## Final Conclusion\nRun the stats cell to compute a conclusion.")
    else:
        _algo_rate = _algo["p_repeat_diff_opponent"]
        _base_rate = _baseline_row["p_repeat_diff_opponent"]
    _delta = _algo_rate - _base_rate
    _direction = (
            "lower" if _delta < 0 else "higher" if _delta > 0 else "the same as"
    )

    mo.md(
            f"""
    ## Final Conclusion

    The algorithm's repeat‑with‑different‑opponents rate is **{_algo_rate:.2%}**, which is **{abs(_delta):.2%} {_direction}** than the statistical ideal (**{_base_rate:.2%}**).
    If this value is higher than the ideal, the algorithm is encouraging repeat pairs; if lower, it is successfully discouraging them.
    """
        )
    return


# =============================================================================
# MULTI-BATCH ANALYSIS SECTION
# =============================================================================


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ---

    # Multi-Batch Analysis

    This section analyzes **consistency and patterns** across multiple independent simulation batches.
    Each batch runs the same configuration but with different random seeds, allowing us to study:

    - **Divergence**: How much do metrics vary between batches?
    - **Pair Patterns**: Are the same player pairs consistently problematic?
    - **Ensemble Performance**: What's the average algorithm improvement across all batches?
    """)
    return


@app.cell
def _(Path, config, pl):
    # Load all batch data for OLD and NEW algorithms
    _data_dir = Path(__file__).parent / "data"
    _batch_ids = config.get("batchIds", [])

    # OLD algorithm batches
    batch_summaries = {}
    batch_pair_events = {}
    _old_dir = _data_dir / "old_algo"
    if _batch_ids and _old_dir.exists():
        for _bid in _batch_ids:
            _summary_file = _old_dir / f"summary_batch{_bid}.csv"
            _events_file = _old_dir / f"pair_events_batch{_bid}.csv"
            if _summary_file.exists():
                batch_summaries[_bid] = pl.read_csv(_summary_file)
            if _events_file.exists():
                batch_pair_events[_bid] = pl.read_csv(_events_file)

    # NEW algorithm batches
    new_algo_batch_summaries = {}
    new_algo_batch_pair_events = {}
    _new_dir = _data_dir / "new_algo"
    if _batch_ids and _new_dir.exists():
        for _bid in _batch_ids:
            _summary_file = _new_dir / f"summary_batch{_bid}.csv"
            _events_file = _new_dir / f"pair_events_batch{_bid}.csv"
            if _summary_file.exists():
                new_algo_batch_summaries[_bid] = pl.read_csv(_summary_file)
            if _events_file.exists():
                new_algo_batch_pair_events[_bid] = pl.read_csv(_events_file)

    has_batches = len(batch_summaries) > 1
    return batch_pair_events, batch_summaries, has_batches, new_algo_batch_pair_events, new_algo_batch_summaries


@app.cell(hide_code=True)
def _(has_batches, mo):
    mo.stop(not has_batches)
    mo.md("## Batch Performance Overview")
    return


@app.cell
def _(batch_summaries, has_batches, mo, new_algo_batch_summaries, pl):
    mo.stop(not has_batches)

    # Compute per-batch statistics for OLD algorithm
    _old_batch_stats = []
    for _bid, _df in batch_summaries.items():
        _any_repeat = _df.get_column("repeatAnyPair").sum() / _df.height
        _diff_opponent = _df.get_column("repeatPairDifferentOpponentsCount")
        _old_batch_stats.append({
            "batch": _bid,
            "runs": _df.height,
            "p_any_repeat": _any_repeat,
            "avg_repeat_pairs": _diff_opponent.mean(),
            "zero_repeat_pct": (_diff_opponent == 0).sum() / _diff_opponent.len(),
        })

    # Compute per-batch statistics for NEW algorithm
    _new_batch_stats = []
    for _bid, _df in new_algo_batch_summaries.items():
        _any_repeat = _df.get_column("repeatAnyPair").sum() / _df.height
        _diff_opponent = _df.get_column("repeatPairDifferentOpponentsCount")
        _new_batch_stats.append({
            "batch": _bid,
            "runs": _df.height,
            "p_any_repeat": _any_repeat,
            "avg_repeat_pairs": _diff_opponent.mean(),
            "zero_repeat_pct": (_diff_opponent == 0).sum() / _diff_opponent.len(),
        })

    batch_stats_df = pl.DataFrame(_old_batch_stats)
    new_algo_batch_stats_df = pl.DataFrame(_new_batch_stats)
    
    mo.md("**Old Algorithm Batch Stats:**")
    return batch_stats_df, new_algo_batch_stats_df


@app.cell(hide_code=True)
def _(batch_stats_df, has_batches, mo):
    mo.stop(not has_batches)

    _p_any = batch_stats_df.get_column("p_any_repeat")
    _avg_pairs = batch_stats_df.get_column("avg_repeat_pairs")
    _zero_pct = batch_stats_df.get_column("zero_repeat_pct")

    mo.md(
        f"""
    ### Batch Divergence Summary

    | Metric | Mean | Std Dev | Min | Max |
    |--------|------|---------|-----|-----|
    | Any-repeat rate | {_p_any.mean():.2%} | {_p_any.std():.2%} | {_p_any.min():.2%} | {_p_any.max():.2%} |
    | Avg repeat pairs | {_avg_pairs.mean():.2f} | {_avg_pairs.std():.2f} | {_avg_pairs.min():.2f} | {_avg_pairs.max():.2f} |
    | Zero-repeat rate | {_zero_pct.mean():.2%} | {_zero_pct.std():.2%} | {_zero_pct.min():.2%} | {_zero_pct.max():.2%} |

    **Interpretation**: Low standard deviation indicates the algorithm performs consistently across batches.
    """
    )
    return


@app.cell(hide_code=True)
def _(has_batches, mo):
    mo.stop(not has_batches)
    mo.md("## Repeat Pair Patterns Across Batches")
    return


@app.cell
def _(batch_pair_events, has_batches, mo, pl):
    mo.stop(not has_batches)

    # Aggregate pair frequencies across all batches
    _all_pairs = []
    for _bid, _df in batch_pair_events.items():
        _pair_counts = (
            _df.group_by("pairId")
            .agg(pl.len().alias("events"))
            .with_columns(pl.lit(_bid).alias("batch"))
        )
        _all_pairs.append(_pair_counts)

    all_pair_data = pl.concat(_all_pairs) if _all_pairs else pl.DataFrame()
    return (all_pair_data,)


@app.cell
def _(all_pair_data, has_batches, io, mo, normalized_baseline_pairs, normalized_new_algo_pairs, np, plt):
    mo.stop(not has_batches)

    # Pivot to get pair x batch matrix (OLD algorithm)
    _pivot = all_pair_data.pivot(
        values="events",
        index="pairId",
        on="batch",
        aggregate_function="first"
    ).fill_null(0)

    _pair_ids = _pivot.get_column("pairId").to_list()
    _batch_cols = [c for c in _pivot.columns if c != "pairId"]
    _matrix = _pivot.select(_batch_cols).to_numpy()

    # Calculate OLD algo average per pair
    _old_algo_avg = _matrix.mean(axis=1).reshape(-1, 1)
    
    # Get normalized baseline and new algo columns
    _baseline_col = np.array([normalized_baseline_pairs.get(pid, 0) for pid in _pair_ids]).reshape(-1, 1)
    _new_algo_col = np.array([normalized_new_algo_pairs.get(pid, 0) for pid in _pair_ids]).reshape(-1, 1)
    
    # Build matrix: [Old Algo Avg, Baseline, New Algo Avg]
    _comparison_matrix = np.hstack([_old_algo_avg, _baseline_col, _new_algo_col])

    # Sort by OLD algo average
    _totals = _old_algo_avg.flatten()
    _sorted_idx = np.argsort(_totals)[::-1][:20]  # Top 20 pairs

    _fig, _ax = plt.subplots(figsize=(10, 8))

    _top_matrix = _comparison_matrix[_sorted_idx]
    _top_pairs = [_pair_ids[i] for i in _sorted_idx]

    _im = _ax.imshow(_top_matrix, cmap="YlOrRd", aspect="auto")
    _cbar = _fig.colorbar(_im, ax=_ax, shrink=0.8)
    _cbar.set_label("Repeat events (avg per batch)", rotation=270, labelpad=15)

    _ax.set_yticks(range(len(_top_pairs)))
    _ax.set_yticklabels(_top_pairs, fontsize=9)
    _labels = ["Old Algo\n(avg)", "Baseline\n(norm)", "New Algo\n(avg)"]
    _ax.set_xticks(range(len(_labels)))
    _ax.set_xticklabels(_labels, fontsize=10)

    _ax.set_xlabel("Algorithm")
    _ax.set_ylabel("Player Pair")
    _ax.set_title("Top 20 Repeat Pairs: Old Algo vs Baseline vs New Algo\n(All normalized to same total events)")

    _fig.tight_layout()
    _buffer = io.BytesIO()
    _fig.savefig(_buffer, format="png", dpi=150, bbox_inches="tight")
    _buffer.seek(0)
    plt.close(_fig)

    # Store data for correlation analysis
    batch_pair_matrix = _matrix
    batch_pair_ids = _pair_ids
    mo.image(_buffer.getvalue())
    return batch_pair_ids, batch_pair_matrix


@app.cell
def _(all_pair_data, batch_pair_ids, batch_pair_matrix, has_batches, io, mo, normalized_baseline_pairs, normalized_new_algo_pairs, np, pl, plt):
    mo.stop(not has_batches)

    # Compute values for all three datasets
    _old_algo_avg = batch_pair_matrix.mean(axis=1)
    _baseline_vals = np.array([normalized_baseline_pairs.get(pid, 0) for pid in batch_pair_ids])
    _new_algo_vals = np.array([normalized_new_algo_pairs.get(pid, 0) for pid in batch_pair_ids])

    # Bar chart comparing top 10 pairs across all three algorithms
    _top10_idx = np.argsort(_old_algo_avg)[::-1][:10]
    _top10_pairs = [batch_pair_ids[i] for i in _top10_idx]
    _top10_old = _old_algo_avg[_top10_idx]
    _top10_baseline = _baseline_vals[_top10_idx]
    _top10_new = _new_algo_vals[_top10_idx]

    _fig, _ax = plt.subplots(figsize=(14, 6))

    _x = np.arange(len(_top10_pairs))
    _width = 0.25
    
    _ax.bar(_x - _width, _top10_old, _width, label="Old Algo", color="#4C78A8")
    _ax.bar(_x, _top10_baseline, _width, label="Baseline", color="#E45756")
    _ax.bar(_x + _width, _top10_new, _width, label="New Algo", color="#54A24B")
    
    _ax.set_xticks(_x)
    _ax.set_xticklabels(_top10_pairs, rotation=45, ha="right", fontsize=9)
    _ax.set_ylabel("Repeat events (avg per batch)")
    _ax.set_title("Top 10 Repeat Pairs: Old Algo vs Baseline vs New Algo")
    _ax.legend()

    _fig.tight_layout()
    _buffer = io.BytesIO()
    _fig.savefig(_buffer, format="png", dpi=150, bbox_inches="tight")
    _buffer.seek(0)
    plt.close(_fig)

    mo.image(_buffer.getvalue())
    return


@app.cell(hide_code=True)
def _(all_pair_data, batch_baseline_correlation, batch_pair_ids, batch_pair_matrix, has_batches, mo, normalized_baseline_pairs, np, pl):
    mo.stop(not has_batches)

    # Analyze consistency: which pairs appear in ALL batches vs only some?
    _pair_batch_counts = (
        all_pair_data.group_by("pairId")
        .agg([
            pl.n_unique("batch").alias("batches_appeared"),
            pl.col("events").sum().alias("total_events"),
            pl.col("events").mean().alias("avg_events_per_batch"),
            pl.col("events").std().alias("std_events"),
        ])
        .sort("total_events", descending=True)
    )

    _num_batches = all_pair_data.get_column("batch").n_unique()
    _consistent = (_pair_batch_counts.get_column("batches_appeared") == _num_batches).sum()
    _total_pairs = _pair_batch_counts.height

    # Check how many top algorithm pairs are also top baseline pairs
    _batch_avg = batch_pair_matrix.mean(axis=1)
    _baseline_vals = np.array([normalized_baseline_pairs.get(pid, 0) for pid in batch_pair_ids])

    _top20_batch_idx = np.argsort(_batch_avg)[::-1][:20]
    _top20_baseline_idx = np.argsort(_baseline_vals)[::-1][:20]
    _overlap = len(set(_top20_batch_idx) & set(_top20_baseline_idx))

    # Check if algorithm's hot pairs are also baseline hot pairs
    _algo_top_pairs = set(batch_pair_ids[i] for i in _top20_batch_idx)
    _baseline_top_pairs = set(batch_pair_ids[i] for i in _top20_baseline_idx)
    _shared_hot_pairs = _algo_top_pairs & _baseline_top_pairs

    # === ADJACENT PLAYER BIAS ANALYSIS ===
    # Detect pairs where player IDs are consecutive (P1|P2, P2|P3, etc.)
    def is_adjacent_pair(pair_id):
        parts = pair_id.split("|")
        p1_num = int(parts[0][1:])
        p2_num = int(parts[1][1:])
        return abs(p1_num - p2_num) == 1

    _top10_pairs = [batch_pair_ids[i] for i in np.argsort(_batch_avg)[::-1][:10]]
    _adjacent_in_top10 = sum(1 for p in _top10_pairs if is_adjacent_pair(p))

    # Calculate average events for adjacent vs non-adjacent pairs
    _adjacent_events = []
    _nonadjacent_events = []
    for _i, pid in enumerate(batch_pair_ids):
        avg_events = _batch_avg[_i]
        if avg_events > 0:
            if is_adjacent_pair(pid):
                _adjacent_events.append(avg_events)
            else:
                _nonadjacent_events.append(avg_events)

    _adjacent_mean = np.mean(_adjacent_events) if _adjacent_events else 0
    _nonadjacent_mean = np.mean(_nonadjacent_events) if _nonadjacent_events else 0
    _bias_ratio = _adjacent_mean / _nonadjacent_mean if _nonadjacent_mean > 0 else 0

    # List the adjacent pairs in top 10
    _adjacent_top_pairs = [p for p in _top10_pairs if is_adjacent_pair(p)]

    mo.md(
        f"""
    ### Pair Consistency & Baseline Correlation Analysis

    **Cross-Batch Consistency:**
    - **Total unique pairs with repeats**: {_total_pairs}
    - **Pairs appearing in ALL {_num_batches} batches**: {_consistent} ({_consistent/_total_pairs*100:.1f}%)
    - **Pairs appearing in only some batches**: {_total_pairs - _consistent} ({(_total_pairs - _consistent)/_total_pairs*100:.1f}%)

    **Baseline Correlation:**
    - **Correlation coefficient**: r = {batch_baseline_correlation:.3f}
    - **Top 20 pairs overlap**: {_overlap}/20 pairs are hot spots in both algorithm and baseline
    - **Shared hot spot pairs**: {len(_shared_hot_pairs)} pairs

    The algorithm shows a **strong bias toward pairing adjacent player IDs** (P1|P2, P2|P3, P3|P4, etc.):

    | Metric | Value | Interpretation |
    |--------|-------|----------------|
    | Adjacent pairs in Top 10 | **{_adjacent_in_top10}/10** | {_adjacent_in_top10*10}% of worst offenders are adjacent pairs |
    | Avg events (adjacent) | **{_adjacent_mean:.1f}** | Adjacent pairs repeat this often on average |
    | Avg events (non-adjacent) | **{_nonadjacent_mean:.1f}** | Non-adjacent pairs repeat this often |
    | Bias ratio | **{_bias_ratio:.1f}x** | Adjacent pairs repeat {_bias_ratio:.1f}x more than others |

    **Top adjacent offenders**: {', '.join(_adjacent_top_pairs) if _adjacent_top_pairs else 'None'}

    **Root Cause**: This bias likely stems from how the algorithm iterates through players in order.
    When selecting players for courts, adjacent IDs (sorted by name/ID) are more likely to be
    grouped together, creating systematic repeat patterns.

    **General Interpretation:**
    - {'**High correlation** (r > 0.5): The algorithm tends to repeat the same pairs that random chance would repeat.' if batch_baseline_correlation > 0.5 else '**Low correlation** (r ≤ 0.5): The algorithm produces different repeat patterns than random baseline, indicating it has its own structural biases.'}
    - {'**High overlap** in top pairs means the algorithm and baseline share similar problematic pairs.' if _overlap > 10 else '**Low overlap** in top pairs suggests the algorithm creates different hot spots than random chance.'}
    - {'The algorithm shows **consistent patterns** across batches (100% pairs appear in all batches), indicating deterministic behavior.' if _consistent == _total_pairs else f'**{_total_pairs - _consistent}** pairs vary across batches.'}
    """
    )
    return


@app.cell(hide_code=True)
def _(has_batches, mo):
    mo.stop(not has_batches)
    mo.md("""
    ## Ensemble Performance vs Baseline (Multi-Batch)

    Both the algorithm and baseline are now averaged across **multiple independent batches**,
    providing a more statistically robust comparison.
    """)
    return


@app.cell
def _(batch_stats_df, baseline_batch_stats, has_batches, io, mo, new_algo_batch_stats_df, np, plt):
    mo.stop(not has_batches)

    # Get OLD algorithm batch stats
    _old_any = batch_stats_df.get_column("p_any_repeat").to_list()
    _old_avg = batch_stats_df.get_column("avg_repeat_pairs").to_list()

    # Get baseline batch stats
    _baseline_any = baseline_batch_stats.get_column("p_any_repeat").to_list()
    _baseline_avg = baseline_batch_stats.get_column("avg_repeat_pairs").to_list()

    # Get NEW algorithm batch stats
    _new_any = new_algo_batch_stats_df.get_column("p_any_repeat").to_list()
    _new_avg = new_algo_batch_stats_df.get_column("avg_repeat_pairs").to_list()

    _fig, (_ax1, _ax2) = plt.subplots(1, 2, figsize=(14, 5))

    # Summary bar chart: Average across batches for all three
    _labels = ["Old Algo", "Baseline", "New Algo"]
    _x = np.arange(len(_labels))
    _width = 0.6

    # Left: Any-repeat rate comparison
    _any_vals = [np.mean(_old_any), np.mean(_baseline_any), np.mean(_new_any)]
    _colors = ["#4C78A8", "#E45756", "#54A24B"]
    _bars1 = _ax1.bar(_x, _any_vals, _width, color=_colors)
    _ax1.set_xticks(_x)
    _ax1.set_xticklabels(_labels)
    _ax1.set_ylabel("Any-repeat rate (avg across batches)")
    _ax1.set_title("Any-Repeat Rate: All Algorithms")
    _ax1.set_ylim(0, 1.1)

    for _bar in _bars1:
        _ax1.text(_bar.get_x() + _bar.get_width() / 2, _bar.get_height() + 0.02,
                  f"{_bar.get_height():.1%}", ha="center", va="bottom", fontsize=10, fontweight="bold")

    # Right: Avg repeat pairs comparison
    _avg_vals = [np.mean(_old_avg), np.mean(_baseline_avg), np.mean(_new_avg)]
    _bars2 = _ax2.bar(_x, _avg_vals, _width, color=_colors)
    _ax2.set_xticks(_x)
    _ax2.set_xticklabels(_labels)
    _ax2.set_ylabel("Avg repeat pairs per run")
    _ax2.set_title("Avg Repeat Pairs: All Algorithms")

    for _bar in _bars2:
        _ax2.text(_bar.get_x() + _bar.get_width() / 2, _bar.get_height() + 0.05,
                  f"{_bar.get_height():.2f}", ha="center", va="bottom", fontsize=10, fontweight="bold")

    _fig.tight_layout()
    _buffer = io.BytesIO()
    _fig.savefig(_buffer, format="png", dpi=150, bbox_inches="tight")
    _buffer.seek(0)
    plt.close(_fig)
    mo.image(_buffer.getvalue())
    return


@app.cell(hide_code=True)
def _(batch_stats_df, baseline_batch_stats, has_batches, mo, new_algo_batch_stats_df, np):
    mo.stop(not has_batches)

    # OLD algorithm stats
    _old_any_mean = batch_stats_df.get_column("p_any_repeat").mean()
    _old_avg_mean = batch_stats_df.get_column("avg_repeat_pairs").mean()
    _old_any_std = batch_stats_df.get_column("p_any_repeat").std()
    _old_avg_std = batch_stats_df.get_column("avg_repeat_pairs").std()

    # Baseline stats
    _baseline_any_mean = baseline_batch_stats.get_column("p_any_repeat").mean()
    _baseline_avg_mean = baseline_batch_stats.get_column("avg_repeat_pairs").mean()
    _baseline_any_std = baseline_batch_stats.get_column("p_any_repeat").std()
    _baseline_avg_std = baseline_batch_stats.get_column("avg_repeat_pairs").std()

    # NEW algorithm stats
    _new_any_mean = new_algo_batch_stats_df.get_column("p_any_repeat").mean()
    _new_avg_mean = new_algo_batch_stats_df.get_column("avg_repeat_pairs").mean()
    _new_any_std = new_algo_batch_stats_df.get_column("p_any_repeat").std()
    _new_avg_std = new_algo_batch_stats_df.get_column("avg_repeat_pairs").std()

    # Improvements vs baseline
    _old_improvement_any = (_baseline_any_mean - _old_any_mean) / _baseline_any_mean * 100
    _old_improvement_avg = (_baseline_avg_mean - _old_avg_mean) / _baseline_avg_mean * 100
    _new_improvement_any = (_baseline_any_mean - _new_any_mean) / _baseline_any_mean * 100
    _new_improvement_avg = (_baseline_avg_mean - _new_avg_mean) / _baseline_avg_mean * 100

    # New vs Old improvement
    _new_vs_old_any = (_old_any_mean - _new_any_mean) / _old_any_mean * 100 if _old_any_mean > 0 else 0
    _new_vs_old_avg = (_old_avg_mean - _new_avg_mean) / _old_avg_mean * 100 if _old_avg_mean > 0 else 0

    mo.md(
        f"""
    ### Ensemble Performance Summary (All Three Algorithms)

    All algorithms averaged across **{batch_stats_df.height} independent batches** each.

    | Metric | Old Algo | Baseline | New Algo | Old vs Base | New vs Base | New vs Old |
    |--------|----------|----------|----------|-------------|-------------|------------|
    | Any-repeat rate | {_old_any_mean:.1%} ± {_old_any_std:.1%} | {_baseline_any_mean:.1%} ± {_baseline_any_std:.1%} | {_new_any_mean:.1%} ± {_new_any_std:.1%} | **{_old_improvement_any:.1f}%** | **{_new_improvement_any:.1f}%** | {_new_vs_old_any:+.1f}% |
    | Avg repeat pairs | {_old_avg_mean:.2f} ± {_old_avg_std:.2f} | {_baseline_avg_mean:.2f} ± {_baseline_avg_std:.2f} | {_new_avg_mean:.2f} ± {_new_avg_std:.2f} | **{_old_improvement_avg:.1f}%** | **{_new_improvement_avg:.1f}%** | {_new_vs_old_avg:+.1f}% |

    **Conclusions:**

    1. **Old Algorithm vs Baseline**: {_old_improvement_avg:.0f}% reduction in repeat pairs
    2. **New Algorithm vs Baseline**: {_new_improvement_avg:.0f}% reduction in repeat pairs
    3. **New vs Old Algorithm**: {_new_vs_old_avg:+.1f}% change in repeat pairs

    {'✅ **New algorithm is BETTER** than old algorithm!' if _new_vs_old_avg > 0 else '⚠️ **New algorithm is WORSE** than old algorithm!' if _new_vs_old_avg < 0 else '↔️ **New algorithm is EQUAL** to old algorithm.'}
    """
    )
    return


if __name__ == "__main__":
    app.run()
