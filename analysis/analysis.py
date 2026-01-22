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
    summary = pl.read_csv(data_dir / "summary.csv")
    pair_events = pl.read_csv(data_dir / "pair_events.csv")
    config = json.loads((data_dir / "config.json").read_text())
    return config, pair_events, summary


@app.cell(hide_code=True)
def _(config, mo):
    mo.md(f"""
    # Court Assignment Repeat Analysis

    **Configuration**
    - Runs: {config['runs']} (independent simulations)
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
    BASELINE_RUNS = 2000

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

    summaries = []
    for _ in range(BASELINE_RUNS):
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
                if opponent_from == opponent_to:
                    repeat_same += 1
                else:
                    repeat_diff += 1

        summaries.append(
            {
                "repeatAnyPair": repeat_pair_count > 0,
                "repeatPairDifferentOpponents": repeat_diff > 0,
                "repeatPairSameOpponents": repeat_same > 0,
                "repeatPairCount": repeat_pair_count,
                "repeatPairDifferentOpponentsCount": repeat_diff,
                "repeatPairSameOpponentsCount": repeat_same,
            }
        )

    baseline = pl.DataFrame(summaries)
    return (baseline,)


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

    _axes[0].bar(
        diff_distribution["repeatPairDifferentOpponentsCount"].to_list(),
        diff_distribution["runs"].to_list(),
        color="#4C78A8",
    )
    _axes[0].set_title("Algorithm: repeat pairs w/ different opponents")
    _axes[0].set_xlabel("Repeat pairs per run")
    _axes[0].set_ylabel("Runs")

    _axes[1].bar(
        baseline_diff_distribution["repeatPairDifferentOpponentsCount"].to_list(),
        baseline_diff_distribution["runs"].to_list(),
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
def _(config, io, mo, np, pair_events, pl, plt):
    # Build a matrix of repeat counts between all player pairs
    _num_players = config["numPlayers"]
    _players = [f"P{i + 1}" for i in range(_num_players)]

    # Create a frequency matrix
    _matrix = np.zeros((_num_players, _num_players))

    # Aggregate repeat events by pairId
    _pair_counts = (
        pair_events.group_by("pairId")
        .agg(pl.len().alias("count"))
        .to_dicts()
    )

    for _row in _pair_counts:
        _pair_id = _row["pairId"]
        _count = _row["count"]
        _parts = _pair_id.split("|")
        _p1_idx = int(_parts[0][1:]) - 1  # "P1" -> 0
        _p2_idx = int(_parts[1][1:]) - 1  # "P2" -> 1
        _matrix[_p1_idx, _p2_idx] = _count
        _matrix[_p2_idx, _p1_idx] = _count  # symmetric

    # Create the heatmap
    _fig, _ax = plt.subplots(figsize=(10, 8))

    # Use a diverging colormap with white for zero
    _cmap = plt.cm.YlOrRd
    _cmap.set_under("white")

    _im = _ax.imshow(_matrix, cmap=_cmap, vmin=0.1, aspect="equal")

    # Add colorbar
    _cbar = _fig.colorbar(_im, ax=_ax, shrink=0.8)
    _cbar.set_label("Repeat events", rotation=270, labelpad=15)

    # Set ticks and labels
    _ax.set_xticks(range(_num_players))
    _ax.set_yticks(range(_num_players))
    _ax.set_xticklabels(_players, rotation=45, ha="right", fontsize=9)
    _ax.set_yticklabels(_players, fontsize=9)

    _ax.set_xlabel("Player")
    _ax.set_ylabel("Player")
    _ax.set_title("Repeat Pair Heatmap: Player Correlation Hot Spots")

    # Add grid lines
    _ax.set_xticks(np.arange(-0.5, _num_players, 1), minor=True)
    _ax.set_yticks(np.arange(-0.5, _num_players, 1), minor=True)
    _ax.grid(which="minor", color="white", linestyle="-", linewidth=0.5)
    _ax.tick_params(which="minor", size=0)

    _fig.tight_layout()
    _buffer = io.BytesIO()
    _fig.savefig(_buffer, format="png", dpi=150, bbox_inches="tight")
    _buffer.seek(0)
    mo.image(_buffer.getvalue())
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

    _output = None
    if not _algo or not _baseline_row:
        _output = mo.md("Missing stats rows; rerun the stats cell to render the delta plot.")
    else:
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
        _output = mo.image(_buffer.getvalue())

    _output
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


if __name__ == "__main__":
    app.run()
