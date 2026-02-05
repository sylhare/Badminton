import marimo

__generated_with = "0.19.4"
app = marimo.App(width="medium")

@app.cell
def _():
    import json
    import math
    from pathlib import Path

    import marimo as mo
    import polars as pl

    from utils.plotting import setup_matplotlib, fig_to_image
    return Path, fig_to_image, json, math, mo, pl, setup_matplotlib

@app.cell
def _(Path, json, pl):
    data_dir = Path(__file__).parent / "data"
    
    mc_dir = data_dir / "mc_algo"
    mc_summary = pl.read_csv(mc_dir / "summary.csv")
    mc_pair_events = pl.read_csv(mc_dir / "pair_events.csv")
    mc_config = json.loads((mc_dir / "config.json").read_text())
    
    sa_dir = data_dir / "sa_algo"
    sa_summary = pl.read_csv(sa_dir / "summary.csv")
    sa_pair_events = pl.read_csv(sa_dir / "pair_events.csv")
    sa_config = json.loads((sa_dir / "config.json").read_text())
    
    cg_dir = data_dir / "cg_algo"
    cg_summary = pl.read_csv(cg_dir / "summary.csv")
    cg_pair_events = pl.read_csv(cg_dir / "pair_events.csv")
    cg_config = json.loads((cg_dir / "config.json").read_text())
    
    config = mc_config
    return (
        cg_config, cg_dir, cg_pair_events, cg_summary,
        config, data_dir,
        mc_config, mc_dir, mc_pair_events, mc_summary,
        sa_config, sa_dir, sa_pair_events, sa_summary,
    )

@app.cell(hide_code=True)
def _(config, mo, random_config):
    _rand_double_bench = random_config.get("benchFairness", {}).get("doubleBenchRate", 31)
    mo.md(f"""
    # Badminton Engine Analysis


    **Comparing Four Algorithms:**
    - **Monte Carlo (MC)**: Random sampling with greedy cost evaluation (300 candidates per round)
    - **Simulated Annealing (SA)**: Iterative improvement with temperature schedule (1500 optimization steps per round)
    - **Conflict Graph (CG)**: Greedy construction avoiding known teammate conflicts
    - **Random Baseline**: No optimization (pure random pairing)

    **Configuration** (same for all)
    - Runs: {config.get('runs', 2000)} per batch (5 batches each)
    - Rounds: {config.get('rounds', 10)} (consecutive assignments per run)
    - Players: {', '.join(map(str, config.get('playerCounts', [20])))} per batch (variable)
    - Courts: 4 (Available courts for the players)
    """)
    return

@app.cell(hide_code=True)
def _(mo):
    _output = None
    if mo.app_meta().mode != "run":
        _output = mo.md("""
    ## Plot Configuration
    Prepare matplotlib cache directories so charts render reliably inside marimo.
    """)
    _output
    return

@app.cell
def _(setup_matplotlib):
    setup_matplotlib(__file__)
    return

@app.cell
def _():
    import matplotlib.pyplot as plt
    import numpy as np
    return np, plt

@app.cell
def _(data_dir, json, pl):
    baseline_dir = data_dir / "random_baseline"
    baseline_summary = pl.read_csv(baseline_dir / "summary.csv")
    baseline_pair_events = pl.read_csv(baseline_dir / "pair_events.csv")
    def pair_key(a: str, b: str) -> str:
        return f"{a}|{b}" if a < b else f"{b}|{a}"
    
    return baseline_pair_events, baseline_summary, pair_key

@app.cell
def _(math, pl):
    def compute_metrics(df: pl.DataFrame, label: str) -> dict:
        """Compute summary metrics for an algorithm."""
        n = df.height
        if n == 0:
            return {"label": label, "runs": 0}
        
        any_repeat = df.get_column("repeatAnyPair").cast(pl.Int8)
        diff_count = df.get_column("repeatPairDifferentOpponentsCount")
        
        p_any = any_repeat.mean()
        se_any = math.sqrt(p_any * (1 - p_any) / n) if p_any > 0 else 0
        
        return {
            "label": label,
            "runs": n,
            "p_any_repeat": p_any,
            "ci_any_low": max(0, p_any - 1.96 * se_any),
            "ci_any_high": min(1, p_any + 1.96 * se_any),
            "avg_repeat_pairs": diff_count.mean(),
            "zero_repeat_pct": (diff_count == 0).sum() / n,
        }
    return (compute_metrics,)

@app.cell
def _(baseline_summary, cg_summary, compute_metrics, mc_summary, pl, sa_summary):
    mc_metrics = compute_metrics(mc_summary, "Monte Carlo")
    sa_metrics = compute_metrics(sa_summary, "Simulated Annealing")
    cg_metrics = compute_metrics(cg_summary, "Conflict Graph")
    baseline_metrics = compute_metrics(baseline_summary, "Random Baseline")
    
    all_metrics = pl.DataFrame([mc_metrics, sa_metrics, cg_metrics, baseline_metrics])
    return all_metrics, baseline_metrics, cg_metrics, mc_metrics, sa_metrics

@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Algorithm Performance Summary
    
    Key metrics comparing all four algorithms:
    """)
    return

@app.cell
def _(adjacency_bias_data, all_metrics, cg_config, mc_config, mo, pl, random_config, sa_config):
    _metrics = all_metrics.to_dicts()
    
    _sorted_by_zero = sorted(_metrics, key=lambda x: x["zero_repeat_pct"], reverse=True)
    
    _configs_by_label = {
        "Monte Carlo": mc_config,
        "Simulated Annealing": sa_config,
        "Conflict Graph": cg_config,
        "Random Baseline": random_config,
    }
    
    _bias_by_label = {d["algorithm"]: d for d in adjacency_bias_data}
    
    def get_time_per_round(cfg):
        total_ms = cfg.get("timing", {}).get("totalMs", 0)
        total_sims = cfg.get("totalSimulations", 1)
        rounds = cfg.get("rounds", 10)
        if total_ms == 0:
            return 0.01
        return total_ms / (total_sims * rounds)
    
    def get_engine_win_diff(cfg):
        return cfg.get("engineTrackedBalance", {}).get("avgEngineWinDifferential", 0)
    
    def get_balance_pct(cfg):
        """Convert win diff to balance percentage: 0 diff = 100%, 2.0 diff = 0%"""
        diff = cfg.get("engineTrackedBalance", {}).get("avgEngineWinDifferential", 0)
        # Use 2.0 as practical max (represents significant imbalance)
        # 0 diff = 100% balanced, 2.0 diff = 0% balanced
        max_diff = 2.0
        return max(0, 100 * (1 - diff / max_diff))
    
    def get_bench_fairness(cfg):
        """Compound bench fairness: 50% no double benches + 50% fair distribution"""
        bench = cfg.get("benchFairness", {})
        double_bench_rate = bench.get("doubleBenchRate", 0)
        avg_bench_range = bench.get("avgBenchRange", 0)
        
        # Component 1: No double benches (0% rate = 100 score)
        no_double_score = 100 - double_bench_rate
        
        # Component 2: Fair distribution (bench range 0 = 100, range 5+ = 0)
        # Lower bench range = more fair (everyone benched similar number of times)
        max_range = 5.0  # Practical max for normalization
        distribution_score = max(0, 100 * (1 - avg_bench_range / max_range))
        
        # Compound index: 50% each
        return (no_double_score + distribution_score) / 2
    
    def get_adjacent_bias(label):
        return _bias_by_label.get(label, {}).get("bias_ratio", 1.0)
    
    def get_singles_fairness(cfg):
        """Score singles fairness: 50% no back-to-back singles + 50% no repeat opponents."""
        singles = cfg.get("singlesFairness", {})
        if not singles or singles.get("totalSinglesMatches", 0) == 0:
            return None  # No singles matches in this simulation
        double_rate = singles.get("doubleSinglesRate", 0)
        repeat_rate = singles.get("repeatOpponentRate", 0)
        no_double_score = max(0, 100 - double_rate * 2.5)
        no_repeat_score = max(0, 100 - repeat_rate * 3.33)
        return (no_double_score + no_repeat_score) / 2
    
    for _m in _sorted_by_zero:
        _cfg = _configs_by_label[_m["label"]]
        _m["time_per_round"] = get_time_per_round(_cfg)
        _m["engine_win_diff"] = get_engine_win_diff(_cfg)
        _m["balance_pct"] = get_balance_pct(_cfg)
        _m["bench_fairness"] = get_bench_fairness(_cfg)
        _m["adjacent_bias"] = get_adjacent_bias(_m["label"])
        _m["singles_fairness"] = get_singles_fairness(_cfg)
    
    # Check if any algorithm has valid singles data
    _has_singles_data = any(m['singles_fairness'] is not None for m in _sorted_by_zero)
    
    _table_data = {
        "Rank": ["1st", "2nd", "3rd", "4th"],
        "Algorithm": [m["label"] for m in _sorted_by_zero],
        "Zero-Repeat": [f"{m['zero_repeat_pct']:.1%}" for m in _sorted_by_zero],
        "Repeats/Run": [round(m["avg_repeat_pairs"], 2) for m in _sorted_by_zero],
        "Time/Round (ms)": [round(m["time_per_round"], 2) for m in _sorted_by_zero],
        "Balance": [f"{m['balance_pct']:.0f}%" for m in _sorted_by_zero],
        "Bench Fairness": [f"{m['bench_fairness']:.0f}%" for m in _sorted_by_zero],
    }
    # Only add Singles Fair column when we have valid calculated values
    if _has_singles_data:
        _table_data["Singles Fair"] = [f"{m['singles_fairness']:.0f}%" if m['singles_fairness'] is not None else "-" for m in _sorted_by_zero]
    
    _rankings_df = pl.DataFrame(_table_data)
    
    _footer = "*Zero-Repeat: % of runs with no repeated pairs. Balance: Team win balance (100% = 0 differential). Bench Fairness: Compound of no back-to-back benches + fair distribution."
    if _has_singles_data:
        _footer += " Singles Fair: Compound of no back-to-back singles + no repeat opponents."
    _footer += "*"
    
    mo.vstack([
        mo.ui.table(_rankings_df),
        mo.md(_footer),
    ])
    return

@app.cell
def _(adjacency_bias_data, all_metrics, cg_config, fig_to_image, mc_config, mo, np, plt, sa_config, random_config):
    from matplotlib.patches import Patch
    
    _metrics = all_metrics.to_dicts()
    _algo_names = ["Monte Carlo", "Simulated Annealing", "Conflict Graph", "Random Baseline"]
    _colors = ["#4C78A8", "#54A24B", "#F58518", "#E45756"]
    _configs = [mc_config, sa_config, cg_config, random_config]
    
    _bias_by_label = {d["algorithm"]: d for d in adjacency_bias_data}
    
    _avg_repeats = [next(m["avg_repeat_pairs"] for m in _metrics if m["label"] == name) for name in _algo_names]
    _max_repeats = max(_avg_repeats) if max(_avg_repeats) > 0 else 1
    _repeat_score = [100 * (1 - r / _max_repeats) for r in _avg_repeats]
    
    def _get_time_per_round(cfg):
        total_ms = cfg.get("timing", {}).get("totalMs", 0)
        total_sims = cfg.get("totalSimulations", 1)
        rounds = cfg.get("rounds", 10)
        if total_ms == 0:
            return 0.01
        return total_ms / (total_sims * rounds)
    
    _times = [_get_time_per_round(cfg) for cfg in _configs]
    _max_time = max(_times)
    _speed = [100 * (1 - t / _max_time) if _max_time > 0 else 100 for t in _times]
    _speed[3] = 100  # Random is instant
    
    def _get_bench_fairness(cfg):
        bench = cfg.get("benchFairness", {})
        double_bench_rate = bench.get("doubleBenchRate", 0)
        avg_bench_range = bench.get("avgBenchRange", 0)
        no_double_score = 100 - double_bench_rate
        max_range = 5.0
        distribution_score = max(0, 100 * (1 - avg_bench_range / max_range))
        return (no_double_score + distribution_score) / 2
    
    _bench_fair = [_get_bench_fairness(cfg) for cfg in _configs]
    
    def _get_balance_pct(cfg):
        diff = cfg.get("engineTrackedBalance", {}).get("avgEngineWinDifferential", 0)
        max_diff = 2.0
        return max(0, 100 * (1 - diff / max_diff))
    
    _balance = [_get_balance_pct(cfg) for cfg in _configs]
    
    def _get_bias_score(name):
        bias = _bias_by_label.get(name, {}).get("bias_ratio", 1.0)
        if bias <= 0:  # SA has no repeats to measure
            return 100
        # bias of 1.0 = 100 (no bias), bias of 2.0 = 0 (100% extra bias)
        return max(0, 100 - (bias - 1) * 100)
    
    _adjacent_bias = [_get_bias_score(name) for name in _algo_names]
    
    def _get_singles_fairness(cfg):
        """Score singles fairness: 50% no back-to-back singles + 50% no repeat opponents."""
        singles = cfg.get("singlesFairness", {})
        if not singles or singles.get("totalSinglesMatches", 0) == 0:
            return None  # No valid data
        double_rate = singles.get("doubleSinglesRate", 0)
        repeat_rate = singles.get("repeatOpponentRate", 0)
        no_double_score = max(0, 100 - double_rate * 2.5)
        no_repeat_score = max(0, 100 - repeat_rate * 3.33)
        return (no_double_score + no_repeat_score) / 2
    
    _singles_fair = [_get_singles_fairness(cfg) for cfg in _configs]
    _has_singles_data = any(s is not None for s in _singles_fair)
    
    # Only include Singles Fairness when we have valid calculated values
    if _has_singles_data:
        _categories = ["Low\nRepeats", "Speed", "Bench\nFairness", "Balance", "Singles\nFairness", "No Adjacent\nBias"]
    else:
        _categories = ["Low\nRepeats", "Speed", "Bench\nFairness", "Balance", "No Adjacent\nBias"]
    _n_cats = len(_categories)
    _angles = [n / float(_n_cats) * 2 * np.pi for n in range(_n_cats)]
    _angles += _angles[:1]  # Close the polygon
    
    _fig, _ax = plt.subplots(figsize=(5, 5), subplot_kw=dict(projection='polar'))
    
    for _i, (_name, _color) in enumerate(zip(_algo_names, _colors)):
        if _has_singles_data:
            _values = [_repeat_score[_i], _speed[_i], _bench_fair[_i], _balance[_i], _singles_fair[_i] or 0, _adjacent_bias[_i]]
        else:
            _values = [_repeat_score[_i], _speed[_i], _bench_fair[_i], _balance[_i], _adjacent_bias[_i]]
        _values += _values[:1]  # Close the polygon
        
        _ax.plot(_angles, _values, '-', linewidth=1.5, label=_name, color=_color)
        _ax.fill(_angles, _values, alpha=0.15, color=_color)
    
    _ax.set_xticks(_angles[:-1])
    _ax.set_xticklabels(_categories, fontsize=8)
    _ax.set_ylim(0, 105)
    _ax.set_yticks([20, 40, 60, 80, 100])
    _ax.set_yticklabels(["20", "40", "60", "80", "100"], fontsize=6)
    _ax.spines['polar'].set_visible(False)
    _ax.set_title("Algorithm Comparison", fontsize=10, fontweight="bold", y=1.05)
    
    _ax.legend(loc='upper left', bbox_to_anchor=(-0.3, 1.15), fontsize=7, frameon=False)
    
    _fig.tight_layout()
    mo.hstack([mo.image(fig_to_image(_fig))], justify="center")
    return

@app.cell(hide_code=True)
def _(cg_config, mc_config, mo, sa_config):
    def _calc_bench_fairness(cfg):
        bench = cfg.get("benchFairness", {})
        double_bench_rate = bench.get("doubleBenchRate", 0)
        avg_bench_range = bench.get("avgBenchRange", 0)
        no_double_score = 100 - double_bench_rate
        distribution_score = max(0, 100 * (1 - avg_bench_range / 5.0))
        return (no_double_score + distribution_score) / 2
    
    _avg_bench_fairness = (_calc_bench_fairness(mc_config) + _calc_bench_fairness(sa_config) + _calc_bench_fairness(cg_config)) / 3
    
    mo.md(f"""    
    The optimized algorithms achieve **high bench fairness ({_avg_bench_fairness:.0f}%)** and similar team balance. 
    The key differentiator is **repeat avoidance vs speed**.
    """)
    return

@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ---
    
    ## Repeat Analysis
    
    This section analyzes how well each algorithm avoids **teammate repeats** — situations where 
    the same two players are paired together multiple times within a session. We examine:
    
    1. **Overall repeat rates** — How often do repeats occur?
    2. **Repeat distribution** — When repeats happen, how are they distributed across pairs?
    3. **Repeat patterns & bias** — Are certain pairs more likely to repeat?
    4. **Teammate diversity** — How uniformly are partners distributed?
    """)
    return

@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ### Repeat Metrics Overview
    
    Visual comparison of repeat rates and zero-repeat percentages across all algorithms.
    """)
    return

@app.cell
def _(all_metrics, fig_to_image, mo, np, plt):
    _metrics = all_metrics.to_dicts()
    _labels = [m["label"] for m in _metrics]
    _colors = ["#4C78A8", "#54A24B", "#F58518", "#E45756"]  # MC, SA, CG, Baseline
    
    _fig, (_ax1, _ax2) = plt.subplots(1, 2, figsize=(14, 5))
    
    _any_rates = [m["p_any_repeat"] for m in _metrics]
    
    _x = np.arange(len(_labels))
    _bars1 = _ax1.bar(_x, _any_rates, color=_colors, alpha=0.85, width=0.6)
    
    _ax1.set_xticks(_x)
    _ax1.set_xticklabels(_labels, rotation=15, ha="right", fontsize=10)
    _ax1.set_ylabel("Probability of Any Repeat", fontsize=11)
    _ax1.set_title("Any-Repeat Rate\n(lower is better)", fontsize=12, fontweight="bold")
    _ax1.set_ylim(0, 1.1)
    
    for _bar in _bars1:
        _h = _bar.get_height()
        _ax1.text(_bar.get_x() + _bar.get_width()/2, _h + 0.02,
                  f"{_h:.1%}", ha="center", va="bottom", fontsize=10, fontweight="bold")
    
    _avg_repeats = [m["avg_repeat_pairs"] for m in _metrics]
    
    _bars2 = _ax2.bar(_x, _avg_repeats, color=_colors, alpha=0.85, width=0.6)
    
    _ax2.set_xticks(_x)
    _ax2.set_xticklabels(_labels, rotation=15, ha="right", fontsize=10)
    _ax2.set_ylabel("Average Repeats per Run", fontsize=11)
    _ax2.set_title("Repeat Severity\n(lower is better)", fontsize=12, fontweight="bold")
    
    for _bar in _bars2:
        _h = _bar.get_height()
        _ax2.text(_bar.get_x() + _bar.get_width()/2, _h + 0.3,
                  f"{_h:.1f}", ha="center", va="bottom", fontsize=10, fontweight="bold")
    
    _fig.tight_layout()
    mo.image(fig_to_image(_fig))
    return

@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    **What these metrics mean:**
    
    - **Any-Repeat Rate**: The probability that a 10-round session has at least one repeated pair. 
      A repeated pair means two players who were teammates more than once in the same session.
    - **Repeat Severity**: When repeats do occur, how many on average? This measures the "damage" — 
      even if repeats happen, fewer is better. SA scores 0 on both metrics.
    """)
    return

@app.cell(hide_code=True)
def _(all_metrics, mo):
    _metrics = all_metrics.to_dicts()
    _by_label = {m["label"]: m for m in _metrics}
    
    _mc = _by_label["Monte Carlo"]
    _sa = _by_label["Simulated Annealing"]
    _cg = _by_label["Conflict Graph"]
    _bl = _by_label["Random Baseline"]
    
    _sa_vs_mc = (_mc["p_any_repeat"] - _sa["p_any_repeat"]) / _mc["p_any_repeat"] * 100 if _mc["p_any_repeat"] > 0 else 0
    _cg_vs_mc = (_mc["p_any_repeat"] - _cg["p_any_repeat"]) / _mc["p_any_repeat"] * 100 if _mc["p_any_repeat"] > 0 else 0
    _mc_vs_bl = (_bl["p_any_repeat"] - _mc["p_any_repeat"]) / _bl["p_any_repeat"] * 100
    _sa_vs_bl = (_bl["p_any_repeat"] - _sa["p_any_repeat"]) / _bl["p_any_repeat"] * 100
    _cg_vs_bl = (_bl["p_any_repeat"] - _cg["p_any_repeat"]) / _bl["p_any_repeat"] * 100
    
    _winner = "Simulated Annealing" if _sa["p_any_repeat"] <= _cg["p_any_repeat"] and _sa["p_any_repeat"] <= _mc["p_any_repeat"] else \
              "Conflict Graph" if _cg["p_any_repeat"] <= _mc["p_any_repeat"] else "Monte Carlo"
    
    mo.md(f"""
    **Best performer**: {_winner} with {_by_label[_winner]['zero_repeat_pct']:.1%} perfect runs.
    """)
    return

@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ### Repeat-Count Distribution
    
    Investigating repetiton within pairs during a simulation run.
    We consider repeats, when a same pair played more than one time in a 10 games session.

    > A pair is two players who are teammates in a match. Order doesn't matter (P1|P2 is the same as P2|P1).
    """)
    return

@app.cell
def _(baseline_summary, cg_summary, fig_to_image, mc_summary, mo, np, plt, sa_summary):
    _fig, _axes = plt.subplots(2, 2, figsize=(12, 10))
    _axes = _axes.flatten()
    
    _datasets = [
        (mc_summary, "Monte Carlo", "#4C78A8"),
        (sa_summary, "Simulated Annealing", "#54A24B"),
        (cg_summary, "Conflict Graph", "#F58518"),
        (baseline_summary, "Random Baseline", "#E45756"),
    ]
    
    _max_x = max(
        _data_df.get_column("repeatPairDifferentOpponentsCount").max()
        for _data_df, _, _ in _datasets
    )
    
    for _ax, (_df, _name, _color) in zip(_axes, _datasets):
        _counts = _df.get_column("repeatPairDifferentOpponentsCount")
        _counts_arr = _counts.to_numpy()
        _values, _freqs = np.unique(_counts_arr, return_counts=True)
        _pcts = _freqs / _freqs.sum() * 100
        
        # Bar chart for this algorithm
        _ax.bar(_values, _pcts, color=_color, alpha=0.8, width=0.8)
        
        _ax.set_xlabel("Repeat pairs per run")
        _ax.set_ylabel("Percentage of runs (%)")
        _ax.set_title(_name, fontweight="bold")
        _ax.set_xlim(-0.5, _max_x + 0.5)
        
        # Add zero-repeat annotation
        _zero_pct = (_counts == 0).sum() / len(_counts) * 100
        _ax.annotate(f"Zero repeats: {_zero_pct:.1f}%", 
                     xy=(0.95, 0.95), xycoords="axes fraction",
                     ha="right", va="top", fontsize=10,
                     bbox=dict(boxstyle="round", facecolor="white", alpha=0.8))
    
    _fig.tight_layout()
    mo.image(fig_to_image(_fig))
    return

@app.cell(hide_code=True)
def _(config, mo):
    _player_counts = config.get("playerCounts", [20])
    mo.md(f"""
    ### Pair Frequency Heatmaps
    
    These heatmaps show **repeat events** — which pairs repeated most often across all simulations.
    
    > **Note:** Simulations use variable player counts ({', '.join(map(str, _player_counts))} players per batch). 
    > Players P15-P20 only participate in larger batches, so they have fewer repeat opportunities overall.
    """)
    return

@app.cell
def _(baseline_pair_events, cg_pair_events, config, fig_to_image, mc_pair_events, mo, np, plt, sa_pair_events):
    from matplotlib.gridspec import GridSpec
    from matplotlib.colors import PowerNorm
    
    _player_counts = config.get("playerCounts", [20])
    _num_players = max(_player_counts)
    _players = [f"P{i + 1}" for i in range(_num_players)]
    
    def build_repeat_matrix(events_df, player_count):
        """Build matrix showing repeat counts only (0 = no repeats, higher = more repeats)."""
        _matrix = np.zeros((player_count, player_count))
        if events_df.height == 0:
            return _matrix
        
        _pair_counts = events_df.group_by("pairId").len().to_dicts()
        for _row in _pair_counts:
            _pair_id = _row["pairId"]
            _count = _row["len"]
            _parts = _pair_id.split("|")
            _p1_idx = int(_parts[0][1:]) - 1
            _p2_idx = int(_parts[1][1:]) - 1
            _matrix[_p1_idx, _p2_idx] = _count
            _matrix[_p2_idx, _p1_idx] = _count
        return _matrix
    
    _mc_matrix = build_repeat_matrix(mc_pair_events, _num_players)
    _sa_matrix = build_repeat_matrix(sa_pair_events, _num_players)
    _cg_matrix = build_repeat_matrix(cg_pair_events, _num_players)
    _baseline_matrix = build_repeat_matrix(baseline_pair_events, _num_players)
    
    _global_vmax = max(_mc_matrix.max(), _sa_matrix.max(), _cg_matrix.max(), _baseline_matrix.max())
    if _global_vmax == 0:
        _global_vmax = 1
    
    _norm = PowerNorm(gamma=0.4, vmin=0, vmax=_global_vmax)
    
    _fig = plt.figure(figsize=(15, 12))
    _gs = GridSpec(2, 3, figure=_fig, width_ratios=[1, 1, 0.05], wspace=0.3, hspace=0.3)
    
    _axes = [
        _fig.add_subplot(_gs[0, 0]),
        _fig.add_subplot(_gs[0, 1]),
        _fig.add_subplot(_gs[1, 0]),
        _fig.add_subplot(_gs[1, 1]),
    ]
    _cbar_ax = _fig.add_subplot(_gs[:, 2])
    
    _datasets = [
        (_mc_matrix, "Monte Carlo"),
        (_sa_matrix, "Simulated Annealing"),
        (_cg_matrix, "Conflict Graph"),
        (_baseline_matrix, "Random Baseline"),
    ]
    
    _cmap = plt.cm.YlOrRd
    
    for _ax, (_matrix, _name) in zip(_axes, _datasets):
        _im = _ax.imshow(_matrix, cmap=_cmap, norm=_norm, aspect="equal")
        _ax.set_xticks(range(_num_players))
        _ax.set_yticks(range(_num_players))
        _ax.set_xticklabels(_players, rotation=45, ha="right", fontsize=7)
        _ax.set_yticklabels(_players, fontsize=7)
        _ax.set_title(_name, fontweight="bold")
        
        # Annotation: total repeats and max for this engine
        _total_repeats = _matrix.sum() / 2
        _max_repeats = _matrix.max()
        _ax.annotate(f"Total: {_total_repeats:.0f}\nMax: {_max_repeats:.0f}", 
                     xy=(0.02, 0.98), xycoords="axes fraction",
                     ha="left", va="top", fontsize=9,
                     bbox=dict(boxstyle="round", facecolor="white", alpha=0.8))
    
    _cbar = _fig.colorbar(_im, cax=_cbar_ax, label="Repeat count (0=none, higher=worse)")
    _ticks = [0, 1, 2, 3, 5, 10, 25, 50, 100]
    _val = 250
    while _val < _global_vmax:
        _ticks.append(_val)
        _val *= 2
    _ticks.append(int(_global_vmax))
    _cbar.set_ticks([t for t in _ticks if t <= _global_vmax])
    _fig.suptitle("Teammate Repeat Frequency (red = multiple repeats)", 
                  fontsize=12, fontweight="bold", y=0.98)
    
    mo.image(fig_to_image(_fig))
    return

@app.cell(hide_code=True)
def _(baseline_pair_events, cg_pair_events, mc_pair_events, mo, pl, sa_pair_events):
    _mc_total = mc_pair_events.height
    _sa_total = sa_pair_events.height
    _cg_total = cg_pair_events.height
    _bl_total = baseline_pair_events.height
    
    _sa_note = ""
    if _sa_total == 0:
        _sa_note = """- **0** consecutive repeats for **Simulated Annealing** means that in every single session of 10 rounds, 
no player ever has the same partner twice in a row."""
    
    def count_region(df, low, high):
        if df.height == 0:
            return 0
        return df.filter(
            pl.col("pairId").str.split("|").list.eval(
                pl.element().str.slice(1).cast(pl.Int32).is_between(low, high)
            ).list.all()
        ).height
    
    _bl_p1_p5 = count_region(baseline_pair_events, 1, 5)
    _bl_p16_p20 = count_region(baseline_pair_events, 16, 20)
    _bl_ratio = _bl_p1_p5 / _bl_p16_p20 if _bl_p16_p20 > 0 else 0
    
    mo.md(f"""
    Each heatmap shows a the **repeat event counts**, we a pair played more than one time in a 10 games session:
    - **Lighter** = fewer repeat events for that pair
    - **Darker/Hotspots** = more repeat events (algorithm failed to avoid that pair repeating)
    {_sa_note}
    
    For algorithm with repeats, there is a gradient in the heatmaps, because sessions have a variable number of players (14-22).
    If a pair is a "hotspot" (redder square in the heatmap), it means that the algorithm has a bias pairing those players across the sessions.

    We limit the hotspot effects for the algorithms with a better shuffling mechanism before the engine makes the final assignment.
    """)
    return

@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ### Pair Bias Analysis
    
    When repeats occur, are they distributed evenly or concentrated on specific pairs?
    We analyze the bias towards adjacent pairs (P1|P2, P2|P3, P3|P4, etc.) and non-adjacent pairs (P1|P3, P1|P4, P2|P4, etc.).
    """)
    return

@app.cell
def _(baseline_pair_events, cg_pair_events, config, fig_to_image, mc_pair_events, mo, np, pl, plt, sa_pair_events):
    def is_adjacent_pair(pair_id):
        """Check if a pair has consecutive player IDs."""
        parts = pair_id.split("|")
        p1_num = int(parts[0][1:])
        p2_num = int(parts[1][1:])
        return abs(p1_num - p2_num) == 1
    
    def analyze_adjacency_bias(events_df, label):
        """Analyze adjacent vs non-adjacent pair frequencies."""
        if events_df.height == 0:
            return {"algorithm": label, "adjacent_events": 0, "nonadjacent_events": 0, 
                    "adjacent_pairs": 0, "nonadjacent_pairs": 0, "adj_avg": 0, "nonadj_avg": 0, "bias_ratio": 0}
        
        pair_counts = (
            events_df.group_by("pairId")
            .agg(pl.len().alias("events"))
            .to_dicts()
        )
        
        adjacent_events = 0
        nonadjacent_events = 0
        adjacent_pairs = 0
        nonadjacent_pairs = 0
        
        for row in pair_counts:
            if is_adjacent_pair(row["pairId"]):
                adjacent_events += row["events"]
                adjacent_pairs += 1
            else:
                nonadjacent_events += row["events"]
                nonadjacent_pairs += 1
        
        # Calculate average events per pair type
        adj_avg = adjacent_events / adjacent_pairs if adjacent_pairs > 0 else 0
        nonadj_avg = nonadjacent_events / nonadjacent_pairs if nonadjacent_pairs > 0 else 0
        bias_ratio = adj_avg / nonadj_avg if nonadj_avg > 0 else 0
        
        return {
            "algorithm": label,
            "adjacent_events": adjacent_events,
            "nonadjacent_events": nonadjacent_events,
            "adjacent_pairs": adjacent_pairs,
            "nonadjacent_pairs": nonadjacent_pairs,
            "adj_avg": adj_avg,
            "nonadj_avg": nonadj_avg,
            "bias_ratio": bias_ratio,
        }
    
    _mc_bias = analyze_adjacency_bias(mc_pair_events, "Monte Carlo")
    _sa_bias = analyze_adjacency_bias(sa_pair_events, "Simulated Annealing")
    _cg_bias = analyze_adjacency_bias(cg_pair_events, "Conflict Graph")
    _bl_bias = analyze_adjacency_bias(baseline_pair_events, "Random Baseline")
    
    adjacency_bias_data = [_mc_bias, _sa_bias, _cg_bias, _bl_bias]
    
    _fig, (_ax1, _ax2) = plt.subplots(1, 2, figsize=(14, 5))
    
    _labels = ["Monte Carlo", "Simulated Annealing", "Conflict Graph", "Random Baseline"]
    _colors = ["#4C78A8", "#54A24B", "#F58518", "#E45756"]
    _x = np.arange(len(_labels))
    _width = 0.35
    
    _adj_avgs = [d["adj_avg"] for d in adjacency_bias_data]
    _nonadj_avgs = [d["nonadj_avg"] for d in adjacency_bias_data]
    
    _bars1 = _ax1.bar(_x - _width/2, _adj_avgs, _width, label="Adjacent pairs (P1|P2, etc.)", color="#FF6B6B", alpha=0.8)
    _bars2 = _ax1.bar(_x + _width/2, _nonadj_avgs, _width, label="Non-adjacent pairs", color="#4ECDC4", alpha=0.8)
    
    _ax1.set_xticks(_x)
    _ax1.set_xticklabels(_labels, rotation=15, ha="right", fontsize=10)
    _ax1.set_ylabel("Avg Repeat Events per Pair", fontsize=11)
    _ax1.set_title("Adjacent ID Bias: Frequency Comparison", fontsize=11, fontweight="bold")
    _ax1.legend(loc="upper right")
    
    _bias_ratios = [d["bias_ratio"] for d in adjacency_bias_data]
    _bars3 = _ax1.bar(_x, _bias_ratios, color=_colors, alpha=0.0)  # Invisible, just for spacing
    
    _bias_pcts = [(_r - 1) * 100 if _r > 0 else 0 for _r in _bias_ratios]
    _ax2.bar(_x, _bias_pcts, color=_colors, alpha=0.85, width=0.6)
    _ax2.set_xticks(_x)
    _ax2.set_xticklabels(_labels, rotation=15, ha="right", fontsize=10)
    _ax2.set_ylabel("Adjacent Pair Bias (%)", fontsize=11)
    _ax2.set_title("Adjacent ID Bias: Percentage", fontsize=11, fontweight="bold")
    
    for _i, _pct in enumerate(_bias_pcts):
        _ax2.text(_i, _pct + 1, f"{_pct:.0f}%", ha="center", va="bottom", fontsize=10, fontweight="bold")
    
    _fig.tight_layout()
    mo.output.replace(mo.image(fig_to_image(_fig)))
    return adjacency_bias_data, is_adjacent_pair

@app.cell(hide_code=True)
def _(adjacency_bias_data, mo):
    _cg = next(d for d in adjacency_bias_data if d["algorithm"] == "Conflict Graph")
    _bl = next(d for d in adjacency_bias_data if d["algorithm"] == "Random Baseline")
    _mc = next(d for d in adjacency_bias_data if d["algorithm"] == "Monte Carlo")
    _sa = next(d for d in adjacency_bias_data if d["algorithm"] == "Simulated Annealing")
    
    _cg_bias_pct = (_cg["bias_ratio"] - 1) * 100 if _cg["bias_ratio"] > 0 else 0
    _mc_bias_pct = (_mc["bias_ratio"] - 1) * 100 if _mc["bias_ratio"] > 0 else 0
    _bl_bias_pct = (_bl["bias_ratio"] - 1) * 100 if _bl["bias_ratio"] > 0 else 0
    _sa_bias_pct = (_sa["bias_ratio"] - 1) * 100 if _sa["bias_ratio"] > 0 else 0
    
    mo.md(f"""
- **Left chart (Frequency Comparison)**: If the red bars (adjacent pairs) are taller than the teal bars (non-adjacent pairs), it means adjacent pairs have more repeats on average.
- **Right chart (Percentage)**: A positive percentage (e.g., +45%) means adjacent pairs are repeated 45% more often than would be expected from a uniform distribution.

    """)
    return

@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ### Teammate Diversity
    
    How many **different** teammates does each player get to play with in a single 10-round session?
    More unique teammates = more variety and social mixing. This metric captures the diversity of 
    partner assignments within a single session.
    """)
    return


@app.cell
def _(data_dir, pl):
    # Load match events for all algorithms
    random_match_events_div = pl.read_csv(data_dir / "random_baseline" / "match_events.csv")
    mc_match_events_div = pl.read_csv(data_dir / "mc_algo" / "match_events.csv")
    sa_match_events_div = pl.read_csv(data_dir / "sa_algo" / "match_events.csv")
    cg_match_events_div = pl.read_csv(data_dir / "cg_algo" / "match_events.csv")
    return random_match_events_div, mc_match_events_div, sa_match_events_div, cg_match_events_div

@app.cell
def _(np):
    def compute_teammate_diversity(match_events_df) -> dict:
        """Compute unique teammate counts per player per session."""
        # Build a dict: simId -> {player: set of teammates}
        session_teammates = {}
        
        # Single pass through all rows
        for row in match_events_df.iter_rows(named=True):
            session_key = row["simulationId"]
            if session_key not in session_teammates:
                session_teammates[session_key] = {}
            
            player_map = session_teammates[session_key]
            
            team1 = row["team1Players"].split("|")
            team2 = row["team2Players"].split("|")
            
            # Process team1 (only doubles - 2 players are teammates)
            if len(team1) == 2:
                p1, p2 = team1
                player_map.setdefault(p1, set()).add(p2)
                player_map.setdefault(p2, set()).add(p1)
            
            # Process team2 (only doubles)
            if len(team2) == 2:
                p1, p2 = team2
                player_map.setdefault(p1, set()).add(p2)
                player_map.setdefault(p2, set()).add(p1)
        
        # Calculate diversity metrics per session
        session_diversity = []
        for sim_id, player_teammates in session_teammates.items():
            if player_teammates:
                unique_counts = [len(teammates) for teammates in player_teammates.values()]
                session_diversity.append({
                    "simulationId": sim_id,
                    "avg_unique_teammates": np.mean(unique_counts),
                    "min_unique_teammates": min(unique_counts),
                    "max_unique_teammates": max(unique_counts),
                    "all_unique_counts": unique_counts,
                })
        
        # Aggregate across all sessions
        if not session_diversity:
            return {"avg": 0, "min": 0, "max": 0, "all_player_counts": []}
        
        all_player_counts = [c for s in session_diversity for c in s["all_unique_counts"]]
        return {
            "avg": np.mean([s["avg_unique_teammates"] for s in session_diversity]),
            "min": np.mean([s["min_unique_teammates"] for s in session_diversity]),
            "max": np.mean([s["max_unique_teammates"] for s in session_diversity]),
            "all_player_counts": all_player_counts,
            "session_avgs": [s["avg_unique_teammates"] for s in session_diversity],
        }
    return (compute_teammate_diversity,)

@app.cell
def _(cg_match_events_div, compute_teammate_diversity, mc_match_events_div, random_match_events_div, sa_match_events_div):
    random_diversity = compute_teammate_diversity(random_match_events_div)
    mc_diversity = compute_teammate_diversity(mc_match_events_div)
    sa_diversity = compute_teammate_diversity(sa_match_events_div)
    cg_diversity = compute_teammate_diversity(cg_match_events_div)
    return random_diversity, mc_diversity, sa_diversity, cg_diversity

@app.cell
def _(cg_diversity, fig_to_image, mc_diversity, mo, np, plt, random_diversity, sa_diversity):
    _algo_names = ["Random\nBaseline", "Monte\nCarlo", "Simulated\nAnnealing", "Conflict\nGraph"]
    _colors = ["#E45756", "#4C78A8", "#54A24B", "#F58518"]
    _diversities = [random_diversity, mc_diversity, sa_diversity, cg_diversity]
    
    _fig, (_ax1, _ax2) = plt.subplots(1, 2, figsize=(14, 5))
    
    # Left: Average unique teammates per player per session
    _avgs = [d["avg"] for d in _diversities]
    _x = np.arange(len(_algo_names))
    _bars = _ax1.bar(_x, _avgs, color=_colors, alpha=0.85, edgecolor='black', linewidth=1.5)
    _ax1.set_xticks(_x)
    _ax1.set_xticklabels(_algo_names, fontsize=10)
    _ax1.set_ylabel("Avg Unique Teammates per Player", fontsize=11)
    _ax1.set_title("Partner Variety per Session\n(Higher = More Diverse)", fontsize=12, fontweight="bold")
    _ax1.set_ylim(0, max(_avgs) * 1.2)
    
    for _bar in _bars:
        _h = _bar.get_height()
        _ax1.text(_bar.get_x() + _bar.get_width()/2, _h + 0.1, f"{_h:.2f}", 
                  ha="center", va="bottom", fontsize=11, fontweight="bold")
    
    # Add theoretical maximum line (depends on rounds played and team size)
    # In 10 rounds, max unique teammates = 10 (one per round if no repeats)
    _ax1.axhline(y=10, color='green', linestyle='--', alpha=0.7, linewidth=2, label="Max (10 rounds)")
    _ax1.legend(loc="upper right")
    
    # Right: Distribution of unique teammate counts across all players/sessions
    _data = [d["all_player_counts"] for d in _diversities]
    _bp = _ax2.boxplot(_data, tick_labels=_algo_names, patch_artist=True)
    for _patch, _color in zip(_bp['boxes'], _colors):
        _patch.set_facecolor(_color)
        _patch.set_alpha(0.7)
    _ax2.set_ylabel("Unique Teammates per Player", fontsize=11)
    _ax2.set_title("Distribution of Partner Variety\n(Higher & Tighter = Better)", fontsize=12, fontweight="bold")
    _ax2.grid(True, alpha=0.3, axis='y')
    
    # Mark means
    _means = [np.mean(d["all_player_counts"]) for d in _diversities]
    for _i, _mean in enumerate(_means, 1):
        _ax2.scatter(_i, _mean, color='red', s=50, zorder=5, marker='D', label='Mean' if _i == 1 else '')
    _ax2.legend(loc='lower right')
    
    _fig.suptitle("Teammate Diversity: Unique Partners per 10-Round Session", fontsize=13, fontweight="bold", y=1.02)
    plt.tight_layout()
    
    mo.output.replace(mo.image(fig_to_image(_fig)))
    return

@app.cell(hide_code=True)
def _(cg_diversity, mc_diversity, mo, random_diversity, sa_diversity):
    _rand_avg = random_diversity["avg"]
    _mc_avg = mc_diversity["avg"]
    _sa_avg = sa_diversity["avg"]
    _cg_avg = cg_diversity["avg"]
    
    _best = max(_mc_avg, _sa_avg, _cg_avg)
    _best_name = "SA" if _sa_avg == _best else ("MC" if _mc_avg == _best else "CG")
    _improvement = ((_best - _rand_avg) / _rand_avg * 100) if _rand_avg > 0 else 0
    
    mo.md(f"""
They actively avoid repeating teammate pairs, which naturally maximizes unique combinations and partner variety.The tight distribution (narrow box) shows consistent variety for ALL players, not just some
Players assigned to singles courts have no teammate that round, which slightly reduces their unique teammate count compared to players who only play doubles.

*Note: The circles below the boxes in the distribution chart are **outliers** — data points that fall outside 1.5× the interquartile range (IQR) from the quartiles.*
    """)
    return

@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Fairness & Balance
    
    Beyond avoiding teammate repetitions, does the algorithm setup fair matches, does everyone get equal playing time?

    ### Evenly Matched Games

    The algorithm should setup matches where the teams are evenly matched, it does so by looking at the cumulative wins of the players.
    """)
    return

@app.cell
def _(cg_config, fig_to_image, mc_config, mo, np, plt, random_config, sa_config):
    _algo_names = ["Random\nBaseline", "Monte\nCarlo", "Simulated\nAnnealing", "Conflict\nGraph"]
    _configs = [random_config, mc_config, sa_config, cg_config]
    _colors = ["#E45756", "#4C78A8", "#54A24B", "#F58518"]
    
    # Get perfectly balanced rates
    _balanced_rates = [cfg.get("engineTrackedBalance", {}).get("perfectlyBalancedRate", 0) for cfg in _configs]
    
    _fig, (_ax1, _ax2) = plt.subplots(1, 2, figsize=(14, 5), gridspec_kw={'width_ratios': [2, 1]})
    
    # Left: Main bar chart
    _x = np.arange(len(_algo_names))
    _bars = _ax1.bar(_x, _balanced_rates, color=_colors, alpha=0.85, edgecolor='black', linewidth=1.5)
    _ax1.set_xticks(_x)
    _ax1.set_xticklabels(_algo_names, fontsize=11)
    _ax1.set_ylabel("Evenly Matched Games (%)", fontsize=12)
    _ax1.set_title("Percentage of Evenly Matched Games", fontsize=13, fontweight="bold")
    _ax1.set_ylim(0, 100)
    _ax1.grid(True, alpha=0.3, axis='y')
    
    for _bar, _rate in zip(_bars, _balanced_rates):
        _ax1.text(_bar.get_x() + _bar.get_width()/2, _rate + 2, f"{_rate:.0f}%", 
                  ha="center", va="bottom", fontsize=13, fontweight="bold")
    
    # Right: Visual explanation of "evenly matched"
    _ax2.set_xlim(0, 10)
    _ax2.set_ylim(0, 10)
    _ax2.axis('off')
    _ax2.set_title("What is 'Evenly Matched'?", fontsize=11, fontweight="bold")
    
    # Example 1: Evenly matched (green)
    _ax2.add_patch(plt.Rectangle((0.5, 6.5), 4, 2.5, facecolor='#d4edda', edgecolor='#28a745', linewidth=2))
    _ax2.text(2.5, 8.3, "EVEN", ha='center', va='center', fontsize=10, fontweight='bold', color='#155724')
    _ax2.text(1.2, 7.3, "Team A", ha='center', va='center', fontsize=9)
    _ax2.text(1.2, 6.9, "5 wins", ha='center', va='center', fontsize=8, color='gray')
    _ax2.text(3.8, 7.3, "Team B", ha='center', va='center', fontsize=9)
    _ax2.text(3.8, 6.9, "5 wins", ha='center', va='center', fontsize=8, color='gray')
    _ax2.text(2.5, 7.1, "vs", ha='center', va='center', fontsize=9)
    
    # Example 2: Uneven (red)
    _ax2.add_patch(plt.Rectangle((0.5, 3), 4, 2.5, facecolor='#f8d7da', edgecolor='#dc3545', linewidth=2))
    _ax2.text(2.5, 4.8, "UNEVEN", ha='center', va='center', fontsize=10, fontweight='bold', color='#721c24')
    _ax2.text(1.2, 3.8, "Team A", ha='center', va='center', fontsize=9)
    _ax2.text(1.2, 3.4, "8 wins", ha='center', va='center', fontsize=8, color='gray')
    _ax2.text(3.8, 3.8, "Team B", ha='center', va='center', fontsize=9)
    _ax2.text(3.8, 3.4, "2 wins", ha='center', va='center', fontsize=8, color='gray')
    _ax2.text(2.5, 3.6, "vs", ha='center', va='center', fontsize=9)
    
    # Explanation text
    _ax2.text(2.5, 1.5, "Based on cumulative\nwins in session", ha='center', va='center', fontsize=9, style='italic', color='gray')
    
    _fig.tight_layout()
    mo.image(fig_to_image(_fig))
    return

@app.cell
def _(data_dir, json, pl):
    with open(data_dir / "random_baseline" / "config.json") as f:
        random_config = json.load(f)
    return (random_config,)

@app.cell
def _(cg_config, data_dir, mc_config, np, pl, random_config, sa_config):
    random_match_events = pl.read_csv(data_dir / "random_baseline" / "match_events.csv")
    mc_match_events = pl.read_csv(data_dir / "mc_algo" / "match_events.csv")
    sa_match_events = pl.read_csv(data_dir / "sa_algo" / "match_events.csv")
    cg_match_events = pl.read_csv(data_dir / "cg_algo" / "match_events.csv")
    
    random_player_stats = pl.read_csv(data_dir / "random_baseline" / "player_stats.csv")
    mc_player_stats = pl.read_csv(data_dir / "mc_algo" / "player_stats.csv")
    sa_player_stats = pl.read_csv(data_dir / "sa_algo" / "player_stats.csv")
    cg_player_stats = pl.read_csv(data_dir / "cg_algo" / "player_stats.csv")
    
    player_profiles = mc_config.get("playerProfiles", {})
    
    def compute_balance_metrics(match_df: pl.DataFrame, player_df: pl.DataFrame, config: dict, label: str) -> dict:
        """Compute balance metrics from real simulation data."""
        balance_stats = config.get("balanceStats", {})
        
        # Get strength differentials from match events
        strength_diffs = match_df.get_column("strengthDifferential").to_numpy()
        stronger_won = match_df.get_column("strongerTeamWon").cast(pl.Int8).to_numpy()
        
        # Get win/loss distribution from player stats
        win_counts = dict(zip(
            player_df.get_column("playerId").to_list(),
            player_df.get_column("totalWins").to_list()
        ))
        loss_counts = dict(zip(
            player_df.get_column("playerId").to_list(),
            player_df.get_column("totalLosses").to_list()
        ))
        
        # Calculate Gini coefficient for win distribution
        wins_array = np.array(list(win_counts.values()))
        wins_sorted = np.sort(wins_array)
        n = len(wins_sorted)
        gini = (2 * np.sum((np.arange(1, n+1)) * wins_sorted) - (n + 1) * np.sum(wins_sorted)) / (n * np.sum(wins_sorted)) if np.sum(wins_sorted) > 0 else 0
        
        # Calculate skill pairing cost from match events
        # For each match, compute product of teammate levels (singles have 1 player per team)
        pairing_costs = []
        for row in match_df.iter_rows(named=True):
            t1_players = row["team1Players"].split("|")
            t2_players = row["team2Players"].split("|")
            # Handle singles (1 player per team) vs doubles (2 players per team)
            if len(t1_players) >= 2:
                t1_cost = player_profiles.get(t1_players[0], {}).get("level", 3) * player_profiles.get(t1_players[1], {}).get("level", 3)
            else:
                t1_cost = player_profiles.get(t1_players[0], {}).get("level", 3) ** 2  # Single player
            if len(t2_players) >= 2:
                t2_cost = player_profiles.get(t2_players[0], {}).get("level", 3) * player_profiles.get(t2_players[1], {}).get("level", 3)
            else:
                t2_cost = player_profiles.get(t2_players[0], {}).get("level", 3) ** 2  # Single player
            pairing_costs.append(t1_cost + t2_cost)
        
        return {
            "algorithm": label,
            "avg_skill_differential": balance_stats.get("avgStrengthDifferential", np.mean(strength_diffs)),
            "std_skill_differential": np.std(strength_diffs),
            "avg_pairing_cost": np.mean(pairing_costs) if pairing_costs else 0,
            "stronger_team_win_rate": balance_stats.get("strongerTeamWinRate", np.mean(stronger_won) * 100) / 100,
            "perfectly_balanced_rate": balance_stats.get("perfectlyBalancedRate", 0) / 100,
            "gini_coefficient": gini,
            "win_distribution": win_counts,
            "loss_distribution": loss_counts,
            "skill_differentials": strength_diffs.tolist(),
            "pairing_costs": pairing_costs,
            "total_matches": balance_stats.get("totalMatches", len(match_df)),
        }
    
    balance_results = {
        "Random Baseline": compute_balance_metrics(random_match_events, random_player_stats, random_config, "Random Baseline"),
        "Monte Carlo": compute_balance_metrics(mc_match_events, mc_player_stats, mc_config, "Monte Carlo"),
        "Simulated Annealing": compute_balance_metrics(sa_match_events, sa_player_stats, sa_config, "Simulated Annealing"),
        "Conflict Graph": compute_balance_metrics(cg_match_events, cg_player_stats, cg_config, "Conflict Graph"),
    }
    
    balance_summary = pl.DataFrame([
        {
            "algorithm": name,
            "avg_skill_diff": r["avg_skill_differential"],
            "std_skill_diff": r["std_skill_differential"],
            "stronger_wins": r["stronger_team_win_rate"],
            "perfectly_balanced": r["perfectly_balanced_rate"],
            "gini_coeff": r["gini_coefficient"],
            "total_matches": r["total_matches"],
        }
        for name, r in balance_results.items()
    ])
    return (
        balance_results,
        balance_summary,
        cg_match_events,
        cg_player_stats,
        compute_balance_metrics,
        mc_match_events,
        mc_player_stats,
        player_profiles,
        random_match_events,
        random_player_stats,
        sa_match_events,
        sa_player_stats,
    )

@app.cell
def _():
    # Singles data is not generated by the current simulation
    # Set has_singles_data to False to skip singles-related visualizations
    has_singles_data = False
    return (has_singles_data,)


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ### Bench Fairness
    
    When there are more players than court spots, some must sit out ("bench") each round.
    **Bench fairness** measures how many games a player gets to play between bench periods.
    
    The algorithms (MC, SA, CG) **prioritize preventing double benches** over avoiding teammate repeats.
    When forced to choose, they allow a repeat rather than bench someone twice in a row.
    """)
    return

@app.cell
def _(data_dir, np, pl):
    random_bench_stats = pl.read_csv(data_dir / "random_baseline" / "bench_stats.csv", infer_schema_length=10000)
    mc_bench_stats = pl.read_csv(data_dir / "mc_algo" / "bench_stats.csv", infer_schema_length=10000)
    sa_bench_stats = pl.read_csv(data_dir / "sa_algo" / "bench_stats.csv", infer_schema_length=10000)
    cg_bench_stats = pl.read_csv(data_dir / "cg_algo" / "bench_stats.csv", infer_schema_length=10000)
    
    def aggregate_bench_stats(df: pl.DataFrame) -> dict:
        """Aggregate pre-computed bench gap statistics."""
        if "meanGap" in df.columns:
            total_double = df.get_column("doubleBenchCount").sum()
            total_events = df.get_column("totalGapEvents").sum()
            mean_gap = df.get_column("meanGap").mean()
            return {
                "mean_gap": mean_gap,
                "double_bench_count": total_double,
                "total_bench_events": total_events,
                "double_bench_rate": (total_double / total_events * 100) if total_events > 0 else 0,
            }
        else:
            return {"mean_gap": 4.0, "double_bench_count": 0, "total_bench_events": 1, "double_bench_rate": 0}
    
    def aggregate_by_player_count(df: pl.DataFrame) -> dict:
        """Aggregate stats grouped by player count."""
        if "numPlayers" not in df.columns:
            return {}
        result = {}
        for num_players in df.get_column("numPlayers").unique().sort().to_list():
            subset = df.filter(pl.col("numPlayers") == num_players)
            total_events = subset.get_column("totalGapEvents").sum()
            total_double = subset.get_column("doubleBenchCount").sum()
            # Filter out rows with 0 events for mean calculation
            with_events = subset.filter(pl.col("totalGapEvents") > 0)
            mean_gap = with_events.get_column("meanGap").mean() if with_events.height > 0 else 0
            result[num_players] = {
                "mean_gap": mean_gap if mean_gap else 0,
                "double_bench_rate": (total_double / total_events * 100) if total_events > 0 else 0,
                "total_events": total_events,
            }
        return result
    
    bench_gap_stats = {
        "Random": aggregate_bench_stats(random_bench_stats),
        "MC": aggregate_bench_stats(mc_bench_stats),
        "SA": aggregate_bench_stats(sa_bench_stats),
        "CG": aggregate_bench_stats(cg_bench_stats),
    }
    
    bench_by_players = {
        "Random": aggregate_by_player_count(random_bench_stats),
        "MC": aggregate_by_player_count(mc_bench_stats),
        "SA": aggregate_by_player_count(sa_bench_stats),
        "CG": aggregate_by_player_count(cg_bench_stats),
    }
    return bench_gap_stats, bench_by_players, random_bench_stats, mc_bench_stats, sa_bench_stats, cg_bench_stats

@app.cell
def _(bench_by_players, cg_bench_stats, fig_to_image, mc_bench_stats, mo, np, plt, random_bench_stats, sa_bench_stats):
    _algo_names = ["Random", "MC", "SA", "CG"]
    _colors = ["#E45756", "#4C78A8", "#54A24B", "#F58518"]
    _bench_dfs = [random_bench_stats, mc_bench_stats, sa_bench_stats, cg_bench_stats]
    
    # Get player counts from actual data
    _all_player_counts = set()
    for _algo in _algo_names:
        _all_player_counts.update(bench_by_players[_algo].keys())
    _player_counts = sorted(_all_player_counts) if _all_player_counts else [20]
    
    def get_court_spots(num_players):
        num_courts = min(4, num_players // 4)
        return num_courts * 4
    
    _theoretical_max = []
    _benched_per_round_list = []
    for _pc in _player_counts:
        _court_spots = get_court_spots(_pc)
        _benched_per_round = _pc - _court_spots
        _benched_per_round_list.append(_benched_per_round)
        if _benched_per_round > 0:
            _theoretical_max.append(_pc / _benched_per_round - 1)
        else:
            _theoretical_max.append(0)
    
    _fig, (_ax1, _ax2) = plt.subplots(1, 2, figsize=(15, 5))
    
    # Left chart: Average Gap Between Benches by Player Count
    _x1 = np.arange(len(_player_counts))
    _width1 = 0.15
    _offsets1 = [-1.5, -0.5, 0.5, 1.5]
    
    for _i, (_algo, _color) in enumerate(zip(_algo_names, _colors)):
        _gaps = []
        for _j, _pc in enumerate(_player_counts):
            _data = bench_by_players[_algo].get(_pc, {})
            _mean_gap = _data.get("mean_gap", 0)
            _total_events = _data.get("total_events", 0)
            
            # If no gap events recorded (no one benched twice), that's the ideal = theoretical max
            if _mean_gap == 0 and _total_events == 0 and _theoretical_max[_j] > 0:
                _gaps.append(_theoretical_max[_j])
            else:
                _gaps.append(_mean_gap)
        _ax1.bar(_x1 + _offsets1[_i] * _width1, _gaps, _width1, label=_algo, color=_color, alpha=0.85)
    
    _ax1.plot(_x1, _theoretical_max, color='green', linestyle='--', linewidth=2, marker='o', 
              markersize=8, label='Theoretical Max', zorder=5)
    
    _ax1.set_xticks(_x1)
    _ax1.set_xticklabels([f"{pc}p\n({b}b)" for pc, b in zip(_player_counts, _benched_per_round_list)], fontsize=9)
    _ax1.set_xlabel("Player Count (benched per round)", fontsize=10)
    _ax1.set_ylabel("Mean Gap (games between benches)", fontsize=10)
    _ax1.set_title("Average Gap Between Benches\n(Higher = Better)", fontsize=11, fontweight="bold")
    _ax1.legend(loc="upper right", fontsize=8)
    _ax1.set_ylim(0, max(_theoretical_max) + 1)
    
    # Right chart: Bench Range Distribution
    _range_counts = {}
    for _algo, _df in zip(_algo_names, _bench_dfs):
        if "benchRange" in _df.columns:
            _ranges = _df.get_column("benchRange").to_numpy()
            _unique, _counts = np.unique(_ranges, return_counts=True)
            _range_counts[_algo] = dict(zip(_unique, _counts / len(_ranges) * 100))
    
    _all_ranges = sorted(set(r for d in _range_counts.values() for r in d.keys()))
    _width2 = 0.2
    _offsets2 = [-1.5, -0.5, 0.5, 1.5]
    _x2 = np.arange(len(_all_ranges))
    
    for _i, (_algo, _color) in enumerate(zip(_algo_names, _colors)):
        _pcts = [_range_counts.get(_algo, {}).get(r, 0) for r in _all_ranges]
        _ax2.bar(_x2 + _offsets2[_i] * _width2, _pcts, _width2, label=_algo, color=_color, alpha=0.85)
    
    _ax2.set_xticks(_x2)
    _ax2.set_xticklabels([str(int(r)) for r in _all_ranges], fontsize=10)
    _ax2.set_xlabel("Bench Range (max - min benches per session)", fontsize=10)
    _ax2.set_ylabel("% of Sessions", fontsize=10)
    _ax2.set_title("Bench Range Distribution\n(Higher % at 0-1 = Better)", fontsize=11, fontweight="bold")
    _ax2.legend(loc="upper right", fontsize=8)
    
    _fig.tight_layout()
    mo.vstack([
        mo.image(fig_to_image(_fig)),
        mo.md(f"""
- **Average Gap (Left):** Mean games between bench periods per player count. Green line = theoretical maximum ($N/B - 1$).
Optimized algorithms achieve close to theoretical max; Random baseline falls significantly short.
- **Bench Range (Right):** Distribution of max-min bench count difference per session. Range 0 = perfectly fair (everyone benched equally).
Optimized algorithms concentrate at 0-1; Random spreads across higher ranges.
        """)
    ])
    return

@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ---
    
    ## Mathematical Deep Dive
    
    Expand the sections below to understand the mathematical foundations behind each algorithm and what makes a "perfect run" achievable.
    """)
    return

@app.cell(hide_code=True)
def _(config, math, mo):
    _player_counts = config.get("playerCounts", [20])
    _n = max(_player_counts)  # Use max player count for math explanation
    _c = 4  # Default courts
    _r = config.get("rounds", 10)
    _playing_per_round = _c * 4
    _pairs_per_round = _c * 2  # Each court has 2 teammate pairs
    _total_possible_pairs = _n * (_n - 1) // 2
    
    _collision_approx = 1 - math.exp(-(_pairs_per_round ** 2) / (2 * _total_possible_pairs))
    
    _max_leaving = _n - _playing_per_round  # Players who can leave between rounds
    _min_forbidden = _pairs_per_round - _max_leaving  # Best case with optimal benching
    _max_forbidden = _pairs_per_round - (_max_leaving // 2)  # Worst case
    _num_matchings = _playing_per_round - 1  # K_n has (n-1) edge-disjoint perfect matchings
    _transitions = _r - 1  # Number of consecutive round pairs
    
    _select_players = math.comb(_n, _playing_per_round)
    _partition_courts = math.factorial(_playing_per_round) // (math.factorial(4) ** _c * math.factorial(_c))
    _pair_per_court = 3
    _pair_all_courts = _pair_per_court ** _c
    _configs_per_round = _select_players * _partition_courts * _pair_all_courts
    
    _math_accordion = mo.accordion({
        "Metrics Calculation: How Scores Are Computed": mo.md(f"""
### Summary Table Metrics

The summary table displays several compound metrics. Here is how each is calculated:

#### Zero-Repeat Percentage

$$\\text{{Zero-Repeat \\%}} = \\frac{{\\text{{runs with repeatPairDifferentOpponentsCount}} = 0}}{{\\text{{total runs}}}} \\times 100$$

A run has zero repeats when no teammate pair appears more than once across the {_r} rounds.

#### Balance Percentage

Derived from the average engine-tracked win differential:

$$\\text{{Balance \\%}} = \\max\\left(0,\\; 100 \\times \\left(1 - \\frac{{\\text{{avgWinDifferential}}}}{{2.0}}\\right)\\right)$$

Where win differential measures the difference in cumulative wins between teams. A differential of 0 yields 100% balance; a differential of 2.0 or higher yields 0%.

#### Bench Fairness (Compound Index)

Combines two components equally weighted:

$$\\text{{Bench Fairness}} = \\frac{{\\text{{No Double Score}} + \\text{{Distribution Score}}}}{{2}}$$

Where:
- **No Double Score** = $100 - \\text{{doubleBenchRate}}$
  - doubleBenchRate = percentage of bench events where a player sits out consecutive rounds
- **Distribution Score** = $\\max\\left(0,\\; 100 \\times \\left(1 - \\frac{{\\text{{avgBenchRange}}}}{{5.0}}\\right)\\right)$
  - avgBenchRange = average difference between max and min bench counts per session

#### Adjacent Pair Bias

Measures whether pairs with consecutive player IDs (P1|P2, P2|P3, etc.) repeat more often than expected:

$$\\text{{Bias Ratio}} = \\frac{{\\text{{avg repeats per adjacent pair}}}}{{\\text{{avg repeats per non-adjacent pair}}}}$$

$$\\text{{Bias \\%}} = (\\text{{Bias Ratio}} - 1) \\times 100$$

A bias of 0% means adjacent and non-adjacent pairs repeat at equal rates. Positive values indicate adjacent pairs are over-represented in repeats.
        """),

        "Theoretical Minimum: Zero Repeats is Achievable": mo.md(f"""
### Proof That Zero Repeats is Achievable

$$\\boxed{{\\text{{Theoretical Minimum}} = 0}}$$

**Configuration:**
- N = {_n} total players
- C = {_c} courts per round
- P = {_playing_per_round} players per round (C × 4)
- T = {_pairs_per_round} teammate pairs per round (C × 2)
- R = {_r} rounds

**Step 1: Player Overlap Between Rounds**

Between consecutive rounds:
- {_playing_per_round} players participate in each round
- Maximum {_max_leaving} players can be swapped out (benched)
- Minimum overlap: $2P - N = 2 \\times {_playing_per_round} - {_n} = {2 * _playing_per_round - _n}$ players

**Step 2: Counting Forbidden Pairs**

A repeat occurs when two players who were teammates in any previous round are teammates again.

- Each round forms {_pairs_per_round} teammate pairs
- A pair cannot repeat if at least one player is benched between rounds

| Benching Strategy | Forbidden Pairs Remaining |
|-------------------|---------------------------|
| Best case (split pairs) | {_min_forbidden} |
| Worst case (keep pairs) | {_max_forbidden} |

**Step 3: Graph Theory Guarantee**

The complete graph $K_{{{_playing_per_round}}}$ on {_playing_per_round} players has:
- $\\binom{{{_playing_per_round}}}{{2}} = {_playing_per_round * (_playing_per_round - 1) // 2}$ total edges
- {_num_matchings} edge-disjoint perfect matchings (standard result for even n)

With at most {_max_forbidden} forbidden pairs per transition, at least {_num_matchings - _max_forbidden} valid matchings remain.

Since {_num_matchings - _max_forbidden} > 0, a valid pairing always exists for each round.
        """),
        
        "Configuration Space: Search Complexity": mo.md(f"""
### Configuration Space Size

How many distinct ways can one round be configured?

| Step | Description | Formula | Count |
|------|-------------|---------|-------|
| 1. Select players | Choose {_playing_per_round} from {_n} | $C({_n},{_playing_per_round})$ | {_select_players:,} |
| 2. Assign to courts | Partition into {_c} groups of 4 | ${_playing_per_round}! / (4!^{_c} \\times {_c}!)$ | {_partition_courts:,} |
| 3. Form teams | Pair players per court | $3^{_c}$ | {_pair_all_courts} |
| **Total** | | Step 1 × 2 × 3 | **{_configs_per_round:,}** |

**Symmetries accounted for:**
- Step 2 divides by $4!^{_c}$ (order within groups) and ${_c}!$ (court labels interchangeable)
- Step 3 counts only 3 distinct pairings per court: AB vs CD, AC vs BD, AD vs BC

**Implication for search:**
- Random sampling hits any specific configuration with probability ~{1/_configs_per_round:.2e}
- Monte Carlo's 300 samples covers {300/_configs_per_round * 100:.2e}% of the space
- Intelligent search (SA, CG) is necessary to find good configurations reliably
        """),
        
        "Repeat Probability: Birthday Paradox": mo.md(f"""
### Why Random Selection Produces Repeats

The probability of a teammate repeat follows a pattern similar to the birthday paradox.

With {_pairs_per_round} pairs per round and {_total_possible_pairs} possible pairs, the probability of at least one collision in a single round transition is approximately:

$$P(\\text{{collision}}) \\approx 1 - e^{{-k^2 / (2n)}}$$

where $k = {_pairs_per_round}$ and $n = {_total_possible_pairs}$.

$$P(\\text{{collision}}) \\approx 1 - e^{{-{_pairs_per_round}^2 / (2 \\times {_total_possible_pairs})}} \\approx {_collision_approx * 100:.1f}\\%$$

Over {_transitions} round transitions, the cumulative probability of at least one repeat increases substantially.

The random baseline has no memory of previous rounds. Each round is generated independently, which is why it performs poorly compared to algorithms that track and avoid previous pairings.
        """),
        
        "Bench Gap: Theoretical Maximum": mo.md(f"""
### Bench Gap Calculation

When there are more players than court spots, some must sit out each round.

**Definitions:**
- Court spots per round: $C \\times 4 = {_playing_per_round}$
- Benched per round: $N - {_playing_per_round}$ (varies with player count)

**Theoretical maximum gap** (games between benches):

$$\\text{{Max Gap}} = \\frac{{N}}{{\\text{{benched per round}}}} - 1$$

For example, with 20 players and 16 court spots:
- 4 players benched per round
- Maximum gap = $20/4 - 1 = 4$ games between benches

**Mean gap** reported in charts is the average across all bench-to-bench intervals within a session. Higher values indicate more playing time between rest periods.
        """),
        
        "Algorithm Comparison: Optimization Strategies": mo.md(f"""
### How Each Algorithm Searches

| Property | Random | Monte Carlo | Simulated Annealing | Conflict Graph |
|----------|--------|-------------|---------------------|----------------|
| Memory of past rounds | No | Yes (cost function) | Yes (cost function) | Yes (conflict weights) |
| Search method | Single random | Sample 300, pick best | Iterative refinement | Greedy construction |
| Can escape local minima | N/A | Limited | Yes (via temperature) | No |
| Iterations per round | 1 | 300 | 1500 | 1 |

**Monte Carlo:**
Generates $k$ random candidates and selects the one with lowest cost. Probability of finding a perfect solution:

$$P(\\text{{find perfect}}) = 1 - (1 - p)^k$$

where $p$ is the probability a single random sample is perfect.

**Simulated Annealing:**
Uses Metropolis acceptance criterion. For a cost change $\\Delta C$ at temperature $T$:
- Accept if $\\Delta C < 0$ (improvement)
- Accept with probability $e^{{-\\Delta C / T}}$ if $\\Delta C \\geq 0$

Temperature decreases as $T(t) = T_0 \\cdot \\alpha^t$ where $\\alpha = 0.995$.

**Conflict Graph:**
Greedily selects pairs with lowest conflict score:

$$\\text{{score}}(i, j) = w_1 \\cdot \\text{{history}}(i,j) + w_2 \\cdot \\text{{recent}}(i,j)$$

Fast ($O(n^2 \\log n)$) but may miss optimal solutions due to early greedy commitments.
        """),
        
        "Team Balance: Evenly Matched Calculation": mo.md(f"""
### Evenly Matched Games

A game is considered **evenly matched** when both teams have equal cumulative wins at the time of the match.

$$\\text{{Evenly Matched \\%}} = \\frac{{\\text{{games where Team1 wins}} = \\text{{Team2 wins}}}}{{\\text{{total games}}}} \\times 100$$

The algorithms use cumulative session wins as a proxy for current skill level. The cost function penalizes skill imbalance:

$$C_{{\\text{{balance}}}} = \\left| \\sum_{{p \\in \\text{{Team}}_1}} W_p - \\sum_{{p \\in \\text{{Team}}_2}} W_p \\right|$$

where $W_p$ is player $p$'s win count in the current session.

**Skill pairing penalty** discourages putting similarly-skilled players on the same team:

$$C_{{\\text{{pair}}}} = \\sum_{{\\text{{teammates}} \\; i,j}} W_i \\cdot W_j$$

This encourages mixing high-win and low-win players to balance teams.
        """),
    })
    
    _math_accordion
    return

if __name__ == "__main__":
    app.run()
