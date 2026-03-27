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
    from utils.config_metrics import (
        ALGO_NAMES,
        ALGO_COLORS,
        get_time_per_round,
        get_balance_pct,
        get_bench_fairness,
        get_singles_fairness,
        get_bias_score,
        build_configs_by_label,
    )
    from utils.analysis import (
        compute_summary_metrics,
        analyze_adjacency_bias,
        compute_teammate_diversity,
        compute_match_session_frequency,
        build_repeat_matrix,
        aggregate_bench_stats,
        aggregate_by_player_count,
        compute_balance_metrics,
    )
    return (
        Path, fig_to_image, json, math, mo, pl, setup_matplotlib,
        ALGO_NAMES, ALGO_COLORS,
        get_time_per_round, get_balance_pct, get_bench_fairness,
        get_singles_fairness, get_bias_score, build_configs_by_label,
        compute_summary_metrics, analyze_adjacency_bias, compute_teammate_diversity,
        compute_match_session_frequency,
        build_repeat_matrix, aggregate_bench_stats, aggregate_by_player_count,
        compute_balance_metrics,
    )

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

    sl_dir = data_dir / "sl_algo"
    sl_summary = pl.read_csv(sl_dir / "summary.csv")
    sl_pair_events = pl.read_csv(sl_dir / "pair_events.csv")
    sl_config = json.loads((sl_dir / "config.json").read_text())

    shared_config = json.loads((data_dir / "config.json").read_text())
    config = mc_config
    return (
        cg_config, cg_dir, cg_pair_events, cg_summary,
        config, data_dir,
        mc_config, mc_dir, mc_pair_events, mc_summary,
        sa_config, sa_dir, sa_pair_events, sa_summary,
        shared_config,
        sl_config, sl_dir, sl_pair_events, sl_summary,
    )

@app.cell(hide_code=True)
def _(config, mo, random_config):
    _rand_double_bench = random_config.get("benchFairness", {}).get("doubleBenchRate", 31)
    mo.md(f"""
    # Badminton Engine Analysis


    **Comparing Five Algorithms:**
    - **Monte Carlo (MC)**: Random sampling with greedy cost evaluation (300 candidates per round)
    - **Simulated Annealing (SA)**: Iterative improvement with temperature schedule
    - **Conflict Graph (CG)**: Greedy construction avoiding known teammate conflicts
    - **Smart Matching (SL)**: Simulated Annealing extended with gender/level-aware cost functions
    - **Random Baseline**: No optimization (pure random pairing)

    **Configuration**
    - Runs: {config.get('runs', 2000)} per batch (5 batches each)
    - Rounds: {config.get('rounds', 10)} (consecutive assignments per run)
    - Players: {', '.join(map(str, config.get('playerCounts', [20])))} per batch (variable)
    - Courts: 4 (Available courts for the players)

    > **Note**: We reduced the number of runs to speed up the notebook and analysis.
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
    random_config = json.loads((baseline_dir / "config.json").read_text())
    
    def pair_key(a: str, b: str) -> str:
        return f"{a}|{b}" if a < b else f"{b}|{a}"
    
    return baseline_pair_events, baseline_summary, pair_key, random_config

@app.cell
def _(baseline_summary, cg_summary, compute_summary_metrics, mc_summary, pl, sa_summary, sl_summary):
    mc_metrics = compute_summary_metrics(mc_summary, "Monte Carlo")
    sa_metrics = compute_summary_metrics(sa_summary, "Simulated Annealing")
    cg_metrics = compute_summary_metrics(cg_summary, "Conflict Graph")
    sl_metrics = compute_summary_metrics(sl_summary, "Smart Matching")
    baseline_metrics = compute_summary_metrics(baseline_summary, "Random Baseline")

    all_metrics = pl.DataFrame([mc_metrics, sa_metrics, cg_metrics, sl_metrics, baseline_metrics])
    return all_metrics, baseline_metrics, cg_metrics, mc_metrics, sa_metrics, sl_metrics

@app.cell
def _(
    ALGO_NAMES,
    adjacency_bias_data,
    all_metrics,
    build_configs_by_label,
    cg_config,
    cg_diversity,
    cooc_by_algo,
    freshness_by_algo,
    get_balance_pct,
    get_bench_fairness,
    get_bias_score,
    get_singles_fairness,
    get_time_per_round,
    mc_config,
    mc_diversity,
    np,
    random_config,
    random_diversity,
    sa_config,
    sa_diversity,
    shared_config,
    sl_config,
    sl_diversity,
):
    """Single source of truth for all per-algorithm metric scores."""
    _configs_by_label = build_configs_by_label(mc_config, sa_config, cg_config, sl_config, random_config)
    _bias_by_label = {d["algorithm"]: d for d in adjacency_bias_data}
    _div_by_label = {
        "Monte Carlo": mc_diversity,
        "Simulated Annealing": sa_diversity,
        "Conflict Graph": cg_diversity,
        "Smart Matching": sl_diversity,
        "Random Baseline": random_diversity,
    }
    _base = {m["label"]: m for m in all_metrics.to_dicts()}

    _rounds = shared_config.get("rounds", 10)
    _player_counts = shared_config.get("playerCounts", [10])
    # Theoretical max: at most 1 new partner per round, capped by number of other players
    _theoretical_max = np.mean([min(_rounds, p - 1) for p in _player_counts])

    algo_metrics = []
    for _name in ALGO_NAMES:
        _cfg = _configs_by_label[_name]
        _m = _base.get(_name, {})
        _bias_ratio = _bias_by_label.get(_name, {}).get("bias_ratio", 1.0)
        _bias_score = get_bias_score(_bias_ratio)
        _div = _div_by_label[_name]
        # Raw diversity: fraction of theoretical max unique partners achieved
        _raw_diversity = min(100, _div["avg"] / _theoretical_max * 100) if _theoretical_max > 0 else 0
        # Weight by adjacent bias: penalise algorithms that concentrate pairings unfairly
        _diversity_score = _raw_diversity * (_bias_score / 100)

        algo_metrics.append({
            "label": _name,
            "avg_repeat_pairs": _m.get("avg_repeat_pairs", 0),
            "zero_repeat_pct": _m.get("zero_repeat_pct", 0),
            "time_per_round": get_time_per_round(_cfg),
            "balance_pct": _cfg.get("engineTrackedBalance", {}).get("perfectlyBalancedRate", 0),
            "bench_fairness": get_bench_fairness(_cfg),
            "adjacent_bias": _bias_ratio,
            "bias_score": _bias_score,
            "singles_fairness": get_singles_fairness(_cfg),
            "diversity_score": _diversity_score,
        })

    return (algo_metrics,)

@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Algorithm Performance Summary
    
    Key metrics comparing all four algorithms:
    """)
    return

@app.cell
def _(algo_metrics, mo, pl):
    _sorted = sorted(algo_metrics, key=lambda m: m["zero_repeat_pct"], reverse=True)
    _has_singles = any(m["singles_fairness"] is not None for m in _sorted)

    _table_data = {
        "Rank": ["1st", "2nd", "3rd", "4th", "5th"],
        "Algorithm": [m["label"] for m in _sorted],
        "Zero-Repeat": [f"{m['zero_repeat_pct']:.1%}" for m in _sorted],
        "Repeats/Run": [round(m["avg_repeat_pairs"], 2) for m in _sorted],
        "Time/Round (ms)": [round(m["time_per_round"], 2) for m in _sorted],
        "Win Parity": [f"{m['balance_pct']:.0f}%" for m in _sorted],
        "Bench Fairness": [f"{m['bench_fairness']:.0f}%" for m in _sorted],
    }
    if _has_singles:
        _table_data["Singles Fair"] = [
            f"{m['singles_fairness']:.0f}%" if m["singles_fairness"] is not None else "-"
            for m in _sorted
        ]

    _rankings_df = pl.DataFrame(_table_data)
    _footer = "*Zero-Repeat: % of runs with no repeated pairs. Win Parity: % of games where both teams had exactly equal cumulative wins at match time. Bench Fairness: Compound of no back-to-back benches + fair distribution."
    if _has_singles:
        _footer += " Singles Fair: Compound of no back-to-back singles + no repeat opponents."
    _footer += "*"

    mo.vstack([
        mo.ui.table(_rankings_df),
        mo.md(_footer),
    ])
    return

@app.cell
def _(ALGO_COLORS, algo_metrics, fig_to_image, mo, np, plt):
    # Relative metrics: normalised across algorithms
    _avg_repeats = [m["avg_repeat_pairs"] for m in algo_metrics]
    _max_repeats = max(_avg_repeats) if max(_avg_repeats) > 0 else 1
    _repeat_score = [100 * (1 - r / _max_repeats) for r in _avg_repeats]

    _times = [m["time_per_round"] for m in algo_metrics]
    _max_time = max(_times)
    _speed = [100 * (1 - t / _max_time) if _max_time > 0 else 100 for t in _times]
    _random_idx = next(i for i, m in enumerate(algo_metrics) if m["label"] == "Random Baseline")
    _speed[_random_idx] = 100  # Random is instant

    _has_singles = any(m["singles_fairness"] is not None for m in algo_metrics)
    if _has_singles:
        _categories = ["Low\nRepeats", "Speed", "Bench\nFairness", "Win\nParity", "Singles\nFairness", "Diversity"]
    else:
        _categories = ["Low\nRepeats", "Speed", "Bench\nFairness", "Win\nParity", "Diversity"]
    _n_cats = len(_categories)
    _angles = [n / float(_n_cats) * 2 * np.pi for n in range(_n_cats)]
    _angles += _angles[:1]

    _fig, _ax = plt.subplots(figsize=(5, 5), subplot_kw=dict(projection='polar'))

    for _i, (_m, _color) in enumerate(zip(algo_metrics, ALGO_COLORS)):
        if _has_singles:
            _values = [_repeat_score[_i], _speed[_i], _m["bench_fairness"], _m["balance_pct"], _m["singles_fairness"] or 0, _m["diversity_score"]]
        else:
            _values = [_repeat_score[_i], _speed[_i], _m["bench_fairness"], _m["balance_pct"], _m["diversity_score"]]
        _values += _values[:1]

        _ax.plot(_angles, _values, '-', linewidth=1.5, label=_m["label"], color=_color)
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
    mo.vstack([
        mo.hstack([mo.image(fig_to_image(_fig))], justify="center"),
        mo.md("<center><i>Figure 1: Radar chart comparing algorithm performance across six dimensions. Higher values indicate better performance. Simulated Annealing excels at repeat avoidance while Random Baseline serves as the performance floor.</i></center>"),
    ])
    return

@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ---
    
    ## Repeat Analysis
    
    This section analyzes how well each algorithm avoids **teammate repeats** — situations where 
    the same two players are paired together multiple times within a session.
    
    How often do repeats occur? When repeats happen, how are they distributed across pairs? Are certain pairs more likely to repeat? How uniformly are partners distributed?
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
def _(ALGO_COLORS, all_metrics, fig_to_image, mo, np, plt):
    _metrics = all_metrics.to_dicts()
    _labels = [m["label"] for m in _metrics]
    
    _fig, (_ax1, _ax2) = plt.subplots(1, 2, figsize=(14, 5))
    
    _any_rates = [m["p_any_repeat"] for m in _metrics]
    _x = np.arange(len(_labels))
    _bars1 = _ax1.bar(_x, _any_rates, color=ALGO_COLORS, alpha=0.85, width=0.6)
    
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
    _bars2 = _ax2.bar(_x, _avg_repeats, color=ALGO_COLORS, alpha=0.85, width=0.6)
    
    _ax2.set_xticks(_x)
    _ax2.set_xticklabels(_labels, rotation=15, ha="right", fontsize=10)
    _ax2.set_ylabel("Average Repeats per Run", fontsize=11)
    _ax2.set_title("Repeat Severity\n(lower is better)", fontsize=12, fontweight="bold")
    
    for _bar in _bars2:
        _h = _bar.get_height()
        _ax2.text(_bar.get_x() + _bar.get_width()/2, _h + 0.3,
                  f"{_h:.1f}", ha="center", va="bottom", fontsize=10, fontweight="bold")
    
    _fig.tight_layout()
    mo.vstack([
        mo.image(fig_to_image(_fig)),
        mo.md("<center><i>Figure 2: Repeat rate metrics across algorithms. Left: probability of any repeat occurring in a session. Right: average number of repeated pairs when repeats do occur.</i></center>"),
    ])
    return

@app.cell(hide_code=True)
def _(mo):
    mo.md("""
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

    _optimized = [_by_label[n] for n in ["Monte Carlo", "Simulated Annealing", "Conflict Graph", "Smart Matching"]]
    _winner = min(_optimized, key=lambda m: m["p_any_repeat"])["label"]

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
def _(ALGO_COLORS, ALGO_NAMES, baseline_summary, cg_summary, fig_to_image, mc_summary, mo, np, plt, sa_summary, sl_summary):
    _fig, _axes = plt.subplots(2, 3, figsize=(18, 10))
    _axes = _axes.flatten()
    _axes[-1].set_visible(False)

    _datasets = list(zip(
        [mc_summary, sa_summary, cg_summary, sl_summary, baseline_summary],
        ALGO_NAMES,
        ALGO_COLORS,
    ))
    
    _max_x = max(
        _data_df.get_column("repeatPairDifferentOpponentsCount").max()
        for _data_df, _, _ in _datasets
    )
    
    for _ax, (_df, _name, _color) in zip(_axes, _datasets):
        _counts = _df.get_column("repeatPairDifferentOpponentsCount")
        _counts_arr = _counts.to_numpy()
        _values, _freqs = np.unique(_counts_arr, return_counts=True)
        _pcts = _freqs / _freqs.sum() * 100
        
        _ax.bar(_values, _pcts, color=_color, alpha=0.8, width=0.8)
        _ax.set_xlabel("Repeat pairs per run")
        _ax.set_ylabel("Percentage of runs (%)")
        _ax.set_title(_name, fontweight="bold")
        _ax.set_xlim(-0.5, _max_x + 0.5)
        
        _zero_pct = (_counts == 0).sum() / len(_counts) * 100
        _ax.annotate(f"Zero repeats: {_zero_pct:.1f}%", 
                     xy=(0.95, 0.95), xycoords="axes fraction",
                     ha="right", va="top", fontsize=10,
                     bbox=dict(boxstyle="round", facecolor="white", alpha=0.8))
    
    _fig.tight_layout()
    mo.vstack([
        mo.image(fig_to_image(_fig)),
        mo.md("<center><i>Figure 3: Distribution of repeat pair counts per simulation run. Each histogram shows what percentage of runs had 0, 1, 2, etc. repeated pairs. Algorithms concentrated at 0 repeats are more effective.</i></center>"),
    ])
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
def _(
    ALGO_NAMES,
    baseline_pair_events,
    build_repeat_matrix,
    cg_pair_events,
    config,
    fig_to_image,
    mc_pair_events,
    mo,
    np,
    plt,
    sa_pair_events,
    sl_pair_events,
):
    from matplotlib.gridspec import GridSpec
    from matplotlib.colors import PowerNorm

    _player_counts = config.get("playerCounts", [20])
    _num_players = max(_player_counts)
    _players = [f"P{i + 1}" for i in range(_num_players)]

    _mc_matrix = build_repeat_matrix(mc_pair_events, _num_players)
    _sa_matrix = build_repeat_matrix(sa_pair_events, _num_players)
    _cg_matrix = build_repeat_matrix(cg_pair_events, _num_players)
    _sl_matrix = build_repeat_matrix(sl_pair_events, _num_players)
    _baseline_matrix = build_repeat_matrix(baseline_pair_events, _num_players)

    _global_vmax = max(_mc_matrix.max(), _sa_matrix.max(), _cg_matrix.max(), _sl_matrix.max(), _baseline_matrix.max())
    if _global_vmax == 0:
        _global_vmax = 1

    _norm = PowerNorm(gamma=0.4, vmin=0, vmax=_global_vmax)

    _fig = plt.figure(figsize=(15, 18))
    _gs = GridSpec(3, 3, figure=_fig, width_ratios=[1, 1, 0.05], wspace=0.3, hspace=0.3)

    _axes = [
        _fig.add_subplot(_gs[0, 0]),
        _fig.add_subplot(_gs[0, 1]),
        _fig.add_subplot(_gs[1, 0]),
        _fig.add_subplot(_gs[1, 1]),
        _fig.add_subplot(_gs[2, 0]),
    ]
    _cbar_ax = _fig.add_subplot(_gs[:, 2])

    _datasets = [
        (_mc_matrix, "Monte Carlo"),
        (_sa_matrix, "Simulated Annealing"),
        (_cg_matrix, "Conflict Graph"),
        (_sl_matrix, "Smart Matching"),
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
    
    mo.vstack([
        mo.image(fig_to_image(_fig)),
        mo.md("<center><i>Figure 4: Heatmaps showing which player pairs repeated most often across all simulations. Darker cells indicate more repeat events. A uniform color indicates no algorithmic bias toward specific pairs.</i></center>"),
    ])
    return

@app.cell(hide_code=True)
def _(mo, sa_pair_events):
    _sa_total = sa_pair_events.height
    _sa_note = ""
    if _sa_total == 0:
        _sa_note = """- **0** consecutive repeats for **Simulated Annealing** means that in every single session of 10 rounds, 
no player ever has the same partner twice in a row."""
    
    mo.md(f"""
    Each heatmap shows a the repeat event counts, we a pair played more than one time in a 10 games session.
    {_sa_note}

    We limit the hotspot effects for the algorithms with a better shuffling mechanism before the engine makes the final assignment.
    """)
    return

@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ### Pair Bias Analysis
    
    When repeats occur, are they distributed evenly or concentrated on specific pairs?
    We analyze the bias towards adjacent pairs (e.g. P1|P2) and non-adjacent pairs (e.g. P1|P3).
    """)
    return

@app.cell
def _(
    ALGO_COLORS,
    ALGO_NAMES,
    analyze_adjacency_bias,
    baseline_pair_events,
    cg_pair_events,
    fig_to_image,
    mc_pair_events,
    mo,
    np,
    plt,
    sa_pair_events,
    sl_pair_events,
):
    _mc_bias = analyze_adjacency_bias(mc_pair_events, "Monte Carlo")
    _sa_bias = analyze_adjacency_bias(sa_pair_events, "Simulated Annealing")
    _cg_bias = analyze_adjacency_bias(cg_pair_events, "Conflict Graph")
    _sl_bias = analyze_adjacency_bias(sl_pair_events, "Smart Matching")
    _bl_bias = analyze_adjacency_bias(baseline_pair_events, "Random Baseline")

    adjacency_bias_data = [_mc_bias, _sa_bias, _cg_bias, _sl_bias, _bl_bias]
    
    _fig, (_ax1, _ax2) = plt.subplots(1, 2, figsize=(14, 5))
    
    _x = np.arange(len(ALGO_NAMES))
    _width = 0.35
    
    _adj_avgs = [d["adj_avg"] for d in adjacency_bias_data]
    _nonadj_avgs = [d["nonadj_avg"] for d in adjacency_bias_data]
    
    _bars1 = _ax1.bar(_x - _width/2, _adj_avgs, _width, label="Adjacent pairs (P1|P2, etc.)", color="#FF6B6B", alpha=0.8)
    _bars2 = _ax1.bar(_x + _width/2, _nonadj_avgs, _width, label="Non-adjacent pairs", color="#4ECDC4", alpha=0.8)
    
    _ax1.set_xticks(_x)
    _ax1.set_xticklabels(ALGO_NAMES, rotation=15, ha="right", fontsize=10)
    _ax1.set_ylabel("Avg Repeat Events per Pair", fontsize=11)
    _ax1.set_title("Adjacent ID Bias: Frequency Comparison", fontsize=11, fontweight="bold")
    _ax1.legend(loc="upper right")
    
    _bias_ratios = [d["bias_ratio"] for d in adjacency_bias_data]
    _bias_pcts = [(_r - 1) * 100 if _r > 0 else 0 for _r in _bias_ratios]
    _ax2.bar(_x, _bias_pcts, color=ALGO_COLORS, alpha=0.85, width=0.6)
    _ax2.set_xticks(_x)
    _ax2.set_xticklabels(ALGO_NAMES, rotation=15, ha="right", fontsize=10)
    _ax2.set_ylabel("Adjacent Pair Bias (%)", fontsize=11)
    _ax2.set_title("Adjacent ID Bias: Percentage", fontsize=11, fontweight="bold")
    
    for _i, _pct in enumerate(_bias_pcts):
        _ax2.text(_i, _pct + 1, f"{_pct:.0f}%", ha="center", va="bottom", fontsize=10, fontweight="bold")
    
    _fig.tight_layout()
    mo.vstack([
        mo.image(fig_to_image(_fig)),
        mo.md("<center><i>Figure 5: Analysis of bias toward adjacent player IDs. Left: average repeats per pair type. Right: percentage bias toward adjacent pairs compared to uniform distribution.</i></center>"),
    ])
    return (adjacency_bias_data,)

@app.cell(hide_code=True)
def _(adjacency_bias_data, mo):
    _cg = next(d for d in adjacency_bias_data if d["algorithm"] == "Conflict Graph")
    _bl = next(d for d in adjacency_bias_data if d["algorithm"] == "Random Baseline")
    _mc = next(d for d in adjacency_bias_data if d["algorithm"] == "Monte Carlo")
    _sa = next(d for d in adjacency_bias_data if d["algorithm"] == "Simulated Annealing")
    
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
def _(compute_teammate_diversity, data_dir, pl):
    random_match_events_div = pl.read_csv(data_dir / "random_baseline" / "match_events.csv")
    mc_match_events_div = pl.read_csv(data_dir / "mc_algo" / "match_events.csv")
    sa_match_events_div = pl.read_csv(data_dir / "sa_algo" / "match_events.csv")
    cg_match_events_div = pl.read_csv(data_dir / "cg_algo" / "match_events.csv")
    sl_match_events_div = pl.read_csv(data_dir / "sl_algo" / "match_events.csv")

    random_diversity = compute_teammate_diversity(random_match_events_div)
    mc_diversity = compute_teammate_diversity(mc_match_events_div)
    sa_diversity = compute_teammate_diversity(sa_match_events_div)
    cg_diversity = compute_teammate_diversity(cg_match_events_div)
    sl_diversity = compute_teammate_diversity(sl_match_events_div)
    return (
        random_match_events_div, mc_match_events_div, sa_match_events_div, cg_match_events_div, sl_match_events_div,
        random_diversity, mc_diversity, sa_diversity, cg_diversity, sl_diversity,
    )

@app.cell
def _(cg_match_events_div, mc_match_events_div, pl, random_match_events_div, sa_match_events_div, sl_match_events_div):
    """Shared computation of court-group freshness and co-occurrence distributions.
    Results are consumed by both the chart cells and algo_metrics to avoid duplication."""
    def _court_freshness_fn(match_df):
        scores = []
        groups = (
            match_df.select(["simulationId", "numPlayers"])
            .unique()
            .sort(["simulationId", "numPlayers"])
            .iter_rows()
        )
        for sid, npl in groups:
            sim = match_df.filter(
                (pl.col("simulationId") == sid) & (pl.col("numPlayers") == npl)
            )
            hist: dict = {}
            for row in sim.iter_rows(named=True):
                court = set(row["team1Players"].split("|") + row["team2Players"].split("|"))
                for p in court:
                    hist.setdefault(p, []).append((row["roundIndex"], frozenset(court - {p})))
            for rounds in hist.values():
                rounds.sort(key=lambda x: x[0])
                for i in range(1, len(rounds)):
                    scores.append(len(rounds[i][1] - rounds[i - 1][1]))
        return scores

    def _cooccurrence_fn(match_df):
        all_counts = []
        groups = (
            match_df.select(["simulationId", "numPlayers"])
            .unique()
            .sort(["simulationId", "numPlayers"])
            .iter_rows()
        )
        for sid, npl in groups:
            sim = match_df.filter(
                (pl.col("simulationId") == sid) & (pl.col("numPlayers") == npl)
            )
            pair_counts: dict = {}
            for row in sim.iter_rows(named=True):
                court = sorted(set(row["team1Players"].split("|") + row["team2Players"].split("|")))
                for i in range(len(court)):
                    for j in range(i + 1, len(court)):
                        key = f"{court[i]}|{court[j]}"
                        pair_counts[key] = pair_counts.get(key, 0) + 1
            all_counts.extend(pair_counts.values())
        return all_counts

    freshness_by_algo = {
        "Random Baseline": _court_freshness_fn(random_match_events_div),
        "Monte Carlo": _court_freshness_fn(mc_match_events_div),
        "Simulated Annealing": _court_freshness_fn(sa_match_events_div),
        "Conflict Graph": _court_freshness_fn(cg_match_events_div),
        "Smart Matching": _court_freshness_fn(sl_match_events_div),
    }
    cooc_by_algo = {
        "Random Baseline": _cooccurrence_fn(random_match_events_div),
        "Monte Carlo": _cooccurrence_fn(mc_match_events_div),
        "Simulated Annealing": _cooccurrence_fn(sa_match_events_div),
        "Conflict Graph": _cooccurrence_fn(cg_match_events_div),
        "Smart Matching": _cooccurrence_fn(sl_match_events_div),
    }
    return freshness_by_algo, cooc_by_algo

@app.cell
def _(ALGO_COLORS, cg_diversity, fig_to_image, mc_diversity, mo, np, plt, random_diversity, sa_diversity, sl_diversity):
    _algo_names = ["Random\nBaseline", "Monte\nCarlo", "Simulated\nAnnealing", "Conflict\nGraph", "Smart\nMatching"]
    _colors = [ALGO_COLORS[4], ALGO_COLORS[0], ALGO_COLORS[1], ALGO_COLORS[2], ALGO_COLORS[3]]
    _diversities = [random_diversity, mc_diversity, sa_diversity, cg_diversity, sl_diversity]

    _fig, (_ax1, _ax2) = plt.subplots(1, 2, figsize=(14, 5))

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
    
    _data = [d["all_player_counts"] for d in _diversities]
    _bp = _ax2.boxplot(_data, labels=_algo_names, patch_artist=True)
    for _patch, _color in zip(_bp['boxes'], _colors):
        _patch.set_facecolor(_color)
        _patch.set_alpha(0.7)
    _ax2.set_ylabel("Unique Teammates per Player", fontsize=11)
    _ax2.set_title("Distribution of Partner Variety\n(Higher & Tighter = Better)", fontsize=12, fontweight="bold")
    _ax2.grid(True, alpha=0.3, axis='y')
    
    _means = [np.mean(d["all_player_counts"]) for d in _diversities]
    for _i, _mean in enumerate(_means, 1):
        _ax2.scatter(_i, _mean, color='red', s=50, zorder=5, marker='D', label='Mean' if _i == 1 else '')
    _ax2.legend(loc='lower right')
    
    _fig.suptitle("Teammate Diversity: Unique Partners per 10-Round Session", fontsize=13, fontweight="bold", y=1.02)
    plt.tight_layout()
    
    mo.vstack([
        mo.image(fig_to_image(_fig)),
        mo.md("<center><i>Figure 6: Teammate diversity metrics. Left: average number of unique partners per player. Right: boxplot showing distribution of diversity across all players.</i></center>"),
    ])
    return

@app.cell(hide_code=True)
def _(mo):
    mo.md(f"""
They actively avoid repeating teammate pairs, which naturally maximizes unique combinations and partner variety.

The tight distribution (narrow box) shows consistent variety for ALL players, not just some.
Players assigned to singles courts have no teammate that round, which slightly reduces their unique teammate count compared to players who only play doubles.

*Note: The circles below the boxes in the distribution chart are **outliers** — data points that fall outside 1.5× the interquartile range (IQR) from the quartiles.*
    """)
    return

@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ### Match Repeat Likelihood

    Given a specific match from one session (e.g., A+B vs C+D), how likely is the **exact same matchup**
    to occur in another session?

    This looks at each unique match configuration across all simulation runs and measures how many sessions
    it appears in. A high concentration at "1 session" means the algorithm generates fresh matchups every time,
    while a spread toward higher session counts reveals that certain pairings tend to recur.
    """)
    return

@app.cell
def _(compute_match_session_frequency, data_dir, pl):
    random_match_events_mrf = pl.read_csv(data_dir / "random_baseline" / "match_events.csv")
    mc_match_events_mrf = pl.read_csv(data_dir / "mc_algo" / "match_events.csv")
    sa_match_events_mrf = pl.read_csv(data_dir / "sa_algo" / "match_events.csv")
    cg_match_events_mrf = pl.read_csv(data_dir / "cg_algo" / "match_events.csv")
    sl_match_events_mrf = pl.read_csv(data_dir / "sl_algo" / "match_events.csv")

    random_mrf = compute_match_session_frequency(random_match_events_mrf)
    mc_mrf = compute_match_session_frequency(mc_match_events_mrf)
    sa_mrf = compute_match_session_frequency(sa_match_events_mrf)
    cg_mrf = compute_match_session_frequency(cg_match_events_mrf)
    sl_mrf = compute_match_session_frequency(sl_match_events_mrf)
    return (
        random_match_events_mrf, mc_match_events_mrf, sa_match_events_mrf,
        cg_match_events_mrf, sl_match_events_mrf,
        random_mrf, mc_mrf, sa_mrf, cg_mrf, sl_mrf,
    )

@app.cell
def _(ALGO_COLORS, cg_mrf, fig_to_image, mc_mrf, mo, np, plt, random_mrf, sa_mrf, sl_mrf):
    _display_order_mrf = ["Random Baseline", "Monte Carlo", "Simulated Annealing", "Conflict Graph", "Smart Matching"]
    _algo_names_mrf = ["Random\nBaseline", "Monte\nCarlo", "Simulated\nAnnealing", "Conflict\nGraph", "Smart\nMatching"]
    _colors_mrf = [ALGO_COLORS[4], ALGO_COLORS[0], ALGO_COLORS[1], ALGO_COLORS[2], ALGO_COLORS[3]]
    _mrfs = [random_mrf, mc_mrf, sa_mrf, cg_mrf, sl_mrf]

    _fig_mrf, (_ax_mrf1, _ax_mrf2) = plt.subplots(1, 2, figsize=(14, 5))

    # Left: % of match configurations that appear in exactly 1 session
    _unique_pcts = [m["unique_only_pct"] for m in _mrfs]
    _x_mrf = np.arange(len(_algo_names_mrf))
    _bars_mrf = _ax_mrf1.bar(_x_mrf, _unique_pcts, color=_colors_mrf, alpha=0.85, edgecolor='black', linewidth=1.5)
    _ax_mrf1.set_xticks(_x_mrf)
    _ax_mrf1.set_xticklabels(_algo_names_mrf, fontsize=10)
    _ax_mrf1.set_ylabel("% of unique match configurations", fontsize=11)
    _ax_mrf1.set_title("Matches Seen in Exactly 1 Session\n(Higher = More Session-Unique Matchups)", fontsize=12, fontweight="bold")
    _ax_mrf1.set_ylim(0, 105)
    _ax_mrf1.grid(True, alpha=0.3, axis='y')
    for _bar in _bars_mrf:
        _h = _bar.get_height()
        _ax_mrf1.text(_bar.get_x() + _bar.get_width() / 2, _h + 1, f"{_h:.1f}%",
                      ha="center", va="bottom", fontsize=11, fontweight="bold")

    # Right: distribution line chart — X = # sessions a match appears in, Y = % of unique matches
    _max_s = max(m["max_sessions"] for m in _mrfs)
    _xs_mrf = list(range(1, min(_max_s + 1, 16)))  # cap at 15 for readability
    _line_styles_mrf = ["-o", "-s", "-^", "-D", "-v"]
    for _mrf, _name, _col, _ls in zip(_mrfs, _algo_names_mrf, _colors_mrf, _line_styles_mrf):
        _total = _mrf["total_unique_matches"] or 1
        _ys_mrf = [sum(1 for c in _mrf["counts"] if c == k) / _total * 100 for k in _xs_mrf]
        _ax_mrf2.plot(_xs_mrf, _ys_mrf, _ls, color=_col, label=_name.replace("\n", " "),
                      linewidth=2, markersize=6, alpha=0.9)

    _ax_mrf2.set_xlabel("Number of sessions containing the same match", fontsize=11)
    _ax_mrf2.set_ylabel("% of unique match configurations", fontsize=11)
    _ax_mrf2.set_xticks(_xs_mrf)
    _ax_mrf2.set_title("Match Repeat Frequency Distribution\n(Ideal: tall spike at 1, rapid decay)", fontsize=12, fontweight="bold")
    _ax_mrf2.legend(fontsize=9, title="Algorithm", title_fontsize=9)
    _ax_mrf2.grid(True, alpha=0.3)

    _fig_mrf.suptitle("Match Repeat Likelihood: How Often Does the Same Matchup Recur Across Sessions?",
                       fontsize=13, fontweight="bold", y=1.02)
    plt.tight_layout()

    mo.vstack([
        mo.image(fig_to_image(_fig_mrf)),
        mo.md("<center><i>Left: % of match configurations seen in only 1 session. Right: distribution of how many sessions each unique matchup appears in.</i></center>"),
    ])
    return

@app.cell(hide_code=True)
def _(mo):
    mo.md("""
A higher percentage of session-unique match configurations (e.g. A+B vs C+D) is better — it means the algorithm
rarely produces the same matchup twice. Ideally, the distribution peaks at 1 session with as few repeats as possible,
showing that most matchups are one-off occurrences across all runs.
    """)
    return

@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ### Court Group Freshness

    For each player, between consecutive rounds they played, how many of the other 3 court-mates changed?

    - **3 new** = completely fresh group (ideal)
    - **0 new** = same 4 players on the same court again (no variety)
    """)
    return

@app.cell
def _(ALGO_COLORS, fig_to_image, freshness_by_algo, mo, np, plt):
    _display_order_v = ["Random Baseline", "Monte Carlo", "Simulated Annealing", "Conflict Graph", "Smart Matching"]
    _algo_names_v = ["Random\nBaseline", "Monte\nCarlo", "Simulated\nAnnealing", "Conflict\nGraph", "Smart\nMatching"]
    _colors_v = [ALGO_COLORS[4], ALGO_COLORS[0], ALGO_COLORS[1], ALGO_COLORS[2], ALGO_COLORS[3]]
    _freshness_data = [freshness_by_algo[name] for name in _display_order_v]

    # 100% stacked bar: one bar per algorithm, 4 colour bands for 0/1/2/3 new court-mates
    _stack_colors = ["#d73027", "#fc8d59", "#91cf60", "#1a9850"]  # red → orange → light-green → dark-green
    _stack_labels = ["0 new (worst)", "1 new", "2 new", "3 new (best)"]

    _pcts_v = []
    for _d in _freshness_data:
        _total = len(_d) or 1
        _pcts_v.append([sum(1 for v in _d if v == k) / _total * 100 for k in range(4)])

    _fig_v, _ax_v = plt.subplots(figsize=(11, 6))
    _x_v = np.arange(len(_algo_names_v))
    _bottoms_v = np.zeros(len(_algo_names_v))
    for _k in range(4):
        _heights_v = [_pcts_v[i][_k] for i in range(len(_algo_names_v))]
        _bars_v = _ax_v.bar(_x_v, _heights_v, bottom=_bottoms_v,
                            color=_stack_colors[_k], label=_stack_labels[_k],
                            edgecolor="white", linewidth=0.8)
        for _bar, _h, _bot in zip(_bars_v, _heights_v, _bottoms_v):
            if _h >= 5:
                _ax_v.text(_bar.get_x() + _bar.get_width() / 2, _bot + _h / 2,
                           f"{_h:.0f}%", ha="center", va="center", fontsize=9,
                           fontweight="bold", color="white")
        _bottoms_v = _bottoms_v + np.array(_heights_v)

    _ax_v.set_xticks(_x_v)
    _ax_v.set_xticklabels(_algo_names_v, fontsize=11)
    _ax_v.set_ylabel("% of round transitions", fontsize=11)
    _ax_v.set_ylim(0, 102)
    _ax_v.legend(loc="upper right", fontsize=10, title="New court-mates", title_fontsize=10)
    _ax_v.set_title("Court Group Freshness — Distribution of New Court-Mates per Round Transition",
                    fontsize=12, fontweight="bold")
    plt.tight_layout()
    mo.vstack([
        mo.image(fig_to_image(_fig_v)),
        mo.md("<center><i>Each bar = one algorithm. Colour bands show % of round-to-round transitions where the player gained 0 / 1 / 2 / 3 new court-mates. Ideal engine: tall green top, thin red bottom. Note that optimising for partner variety (who you team with) is a different objective from court-group freshness (who you share a court with at all) — an algorithm may do well on one metric while scoring lower on the other.</i></center>"),
    ])
    return

@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ### Co-occurrence Across Rounds

    Within a single session, how many rounds does any player pair share a court (as teammates *or* opponents)?

    - **1 shared round** — they met once and moved on (ideal variety)
    - **3+ shared rounds** — they kept appearing on the same court each session (low variety)

    Even if two players are never on the same *team*, being opponents on the same court repeatedly
    still reduces the freshness of the experience.
    """)
    return

@app.cell
def _(ALGO_COLORS, cooc_by_algo, fig_to_image, mo, plt):
    _display_order_c = ["Random Baseline", "Monte Carlo", "Simulated Annealing", "Conflict Graph", "Smart Matching"]
    _algo_names_c = ["Random\nBaseline", "Monte\nCarlo", "Simulated\nAnnealing", "Conflict\nGraph", "Smart\nMatching"]
    _colors_c = [ALGO_COLORS[4], ALGO_COLORS[0], ALGO_COLORS[1], ALGO_COLORS[2], ALGO_COLORS[3]]
    _cooc_data = [cooc_by_algo[name] for name in _display_order_c]

    # Overlapping line chart: X = rounds sharing a court (1, 2, 3 …), Y = % of pair-sessions
    _max_rounds_c = max((max(d) for d in _cooc_data if d), default=10)
    _xs_c = list(range(1, _max_rounds_c + 1))

    _fig_c, _ax_c = plt.subplots(figsize=(11, 6))
    _line_styles = ["-o", "-s", "-^", "-D", "-v"]
    for _i, (_d, _name, _col, _ls) in enumerate(zip(_cooc_data, _algo_names_c, _colors_c, _line_styles)):
        _total = len(_d) or 1
        _ys_c = [sum(1 for v in _d if v == k) / _total * 100 for k in _xs_c]
        _ax_c.plot(_xs_c, _ys_c, _ls, color=_col, label=_name.replace("\n", " "),
                   linewidth=2, markersize=7, alpha=0.9)

    _ax_c.set_xlabel("Rounds sharing a court per pair per session", fontsize=11)
    _ax_c.set_ylabel("% of all pair-sessions", fontsize=11)
    _ax_c.set_xticks(_xs_c)
    _ax_c.set_title("Co-occurrence Distribution — How Often Do Pairs Share a Court?",
                    fontsize=12, fontweight="bold")
    _ax_c.legend(fontsize=10, title="Algorithm", title_fontsize=10)
    _ax_c.axvline(x=1, color="gray", linestyle="--", linewidth=1, alpha=0.5, label="_ideal")
    plt.tight_layout()
    mo.vstack([
        mo.image(fig_to_image(_fig_c)),
        mo.md("<center><i>Each line = one algorithm. X = how many rounds two players share a court in a single session. Ideal: spike at 1, short tail. A flat or wide distribution means certain pairs keep meeting.</i></center>"),
    ])
    return

@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Fairness & Balance
    
    Beyond avoiding teammate repetitions, does the algorithm setup fair matches, does everyone get equal playing time?

    ### Win Parity Matches

    The algorithm should setup matches where the teams have win parity, it does so by looking at the cumulative wins of the players.
    """)
    return

@app.cell
def _(ALGO_COLORS, cg_config, fig_to_image, mc_config, mo, np, plt, random_config, sa_config, sl_config):
    _algo_names = ["Random\nBaseline", "Monte\nCarlo", "Simulated\nAnnealing", "Conflict\nGraph", "Smart\nMatching"]
    _configs = [random_config, mc_config, sa_config, cg_config, sl_config]
    _colors = [ALGO_COLORS[4], ALGO_COLORS[0], ALGO_COLORS[1], ALGO_COLORS[2], ALGO_COLORS[3]]
    
    _balanced_rates = [cfg.get("engineTrackedBalance", {}).get("perfectlyBalancedRate", 0) for cfg in _configs]
    
    _fig, (_ax1, _ax2) = plt.subplots(1, 2, figsize=(14, 5), gridspec_kw={'width_ratios': [2, 1]})
    
    _x = np.arange(len(_algo_names))
    _bars = _ax1.bar(_x, _balanced_rates, color=_colors, alpha=0.85, edgecolor='black', linewidth=1.5)
    _ax1.set_xticks(_x)
    _ax1.set_xticklabels(_algo_names, fontsize=11)
    _ax1.set_ylabel("Win Parity Match Rate (%)", fontsize=12)
    _ax1.set_title("Win Parity Match Rate", fontsize=13, fontweight="bold")
    _ax1.set_ylim(0, 100)
    _ax1.grid(True, alpha=0.3, axis='y')
    
    for _bar, _rate in zip(_bars, _balanced_rates):
        _ax1.text(_bar.get_x() + _bar.get_width()/2, _rate + 2, f"{_rate:.0f}%", 
                  ha="center", va="bottom", fontsize=13, fontweight="bold")
    
    _ax2.set_xlim(0, 10)
    _ax2.set_ylim(0, 10)
    _ax2.axis('off')
    _ax2.set_title("What is 'Win Parity'?", fontsize=11, fontweight="bold")
    
    _ax2.add_patch(plt.Rectangle((0.5, 6.5), 4, 2.5, facecolor='#d4edda', edgecolor='#28a745', linewidth=2))
    _ax2.text(2.5, 8.3, "EVEN", ha='center', va='center', fontsize=10, fontweight='bold', color='#155724')
    _ax2.text(1.2, 7.3, "Team A", ha='center', va='center', fontsize=9)
    _ax2.text(1.2, 6.9, "5 wins", ha='center', va='center', fontsize=8, color='gray')
    _ax2.text(3.8, 7.3, "Team B", ha='center', va='center', fontsize=9)
    _ax2.text(3.8, 6.9, "5 wins", ha='center', va='center', fontsize=8, color='gray')
    _ax2.text(2.5, 7.1, "vs", ha='center', va='center', fontsize=9)
    
    _ax2.add_patch(plt.Rectangle((0.5, 3), 4, 2.5, facecolor='#f8d7da', edgecolor='#dc3545', linewidth=2))
    _ax2.text(2.5, 4.8, "UNEVEN", ha='center', va='center', fontsize=10, fontweight='bold', color='#721c24')
    _ax2.text(1.2, 3.8, "Team A", ha='center', va='center', fontsize=9)
    _ax2.text(1.2, 3.4, "8 wins", ha='center', va='center', fontsize=8, color='gray')
    _ax2.text(3.8, 3.8, "Team B", ha='center', va='center', fontsize=9)
    _ax2.text(3.8, 3.4, "2 wins", ha='center', va='center', fontsize=8, color='gray')
    _ax2.text(2.5, 3.6, "vs", ha='center', va='center', fontsize=9)
    
    _ax2.text(2.5, 1.5, "Based on cumulative\nwins in session", ha='center', va='center', fontsize=9, style='italic', color='gray')
    
    _fig.tight_layout()
    mo.vstack([
        mo.image(fig_to_image(_fig)),
        mo.md("<center><i>Figure 7: Percentage of win parity matches where teams had exactly equal cumulative wins at match time. Right panel illustrates the difference between win parity (equal wins) and uneven (lopsided) team compositions.</i></center>"),
        mo.md("> **Note — Smart Matching goes beyond wins:** Unlike other algorithms that rely solely on cumulative wins to balance teams, Smart Matching also factors in player **skill level** and **gender** when forming match-ups. This allows it to create more intense, competitive games from the start of a session — before wins have accumulated — by pairing players of similar ability across teams regardless of their current win count."),
    ])
    return

@app.cell
def _(compute_balance_metrics, data_dir, mc_config, np, pl, random_config, sa_config, cg_config, sl_config, shared_config):
    random_match_events = pl.read_csv(data_dir / "random_baseline" / "match_events.csv")
    mc_match_events = pl.read_csv(data_dir / "mc_algo" / "match_events.csv")
    sa_match_events = pl.read_csv(data_dir / "sa_algo" / "match_events.csv")
    cg_match_events = pl.read_csv(data_dir / "cg_algo" / "match_events.csv")
    sl_match_events = pl.read_csv(data_dir / "sl_algo" / "match_events.csv")

    random_player_stats = pl.read_csv(data_dir / "random_baseline" / "player_stats.csv")
    mc_player_stats = pl.read_csv(data_dir / "mc_algo" / "player_stats.csv")
    sa_player_stats = pl.read_csv(data_dir / "sa_algo" / "player_stats.csv")
    cg_player_stats = pl.read_csv(data_dir / "cg_algo" / "player_stats.csv")
    sl_player_stats = pl.read_csv(data_dir / "sl_algo" / "player_stats.csv")

    player_profiles = shared_config.get("playerProfiles", {})

    balance_results = {
        "Random Baseline": compute_balance_metrics(random_match_events, random_player_stats, random_config, "Random Baseline", player_profiles),
        "Monte Carlo": compute_balance_metrics(mc_match_events, mc_player_stats, mc_config, "Monte Carlo", player_profiles),
        "Simulated Annealing": compute_balance_metrics(sa_match_events, sa_player_stats, sa_config, "Simulated Annealing", player_profiles),
        "Conflict Graph": compute_balance_metrics(cg_match_events, cg_player_stats, cg_config, "Conflict Graph", player_profiles),
        "Smart Matching": compute_balance_metrics(sl_match_events, sl_player_stats, sl_config, "Smart Matching", player_profiles),
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
        mc_match_events,
        mc_player_stats,
        player_profiles,
        random_match_events,
        random_player_stats,
        sa_match_events,
        sa_player_stats,
        sl_match_events,
        sl_player_stats,
    )

@app.cell
def _():
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
def _(aggregate_bench_stats, aggregate_by_player_count, data_dir, pl):
    random_bench_stats = pl.read_csv(data_dir / "random_baseline" / "bench_stats.csv", infer_schema_length=10000)
    mc_bench_stats = pl.read_csv(data_dir / "mc_algo" / "bench_stats.csv", infer_schema_length=10000)
    sa_bench_stats = pl.read_csv(data_dir / "sa_algo" / "bench_stats.csv", infer_schema_length=10000)
    cg_bench_stats = pl.read_csv(data_dir / "cg_algo" / "bench_stats.csv", infer_schema_length=10000)
    sl_bench_stats = pl.read_csv(data_dir / "sl_algo" / "bench_stats.csv", infer_schema_length=10000)

    bench_gap_stats = {
        "Random": aggregate_bench_stats(random_bench_stats),
        "MC": aggregate_bench_stats(mc_bench_stats),
        "SA": aggregate_bench_stats(sa_bench_stats),
        "CG": aggregate_bench_stats(cg_bench_stats),
        "SL": aggregate_bench_stats(sl_bench_stats),
    }

    bench_by_players = {
        "Random": aggregate_by_player_count(random_bench_stats),
        "MC": aggregate_by_player_count(mc_bench_stats),
        "SA": aggregate_by_player_count(sa_bench_stats),
        "CG": aggregate_by_player_count(cg_bench_stats),
        "SL": aggregate_by_player_count(sl_bench_stats),
    }
    return (
        bench_gap_stats, bench_by_players,
        random_bench_stats, mc_bench_stats, sa_bench_stats, cg_bench_stats, sl_bench_stats,
    )

@app.cell
def _(ALGO_COLORS, bench_by_players, cg_bench_stats, fig_to_image, mc_bench_stats, mo, np, plt, random_bench_stats, sa_bench_stats, sl_bench_stats):
    _algo_names = ["Random", "MC", "SA", "CG", "SL"]
    _colors = [ALGO_COLORS[4], ALGO_COLORS[0], ALGO_COLORS[1], ALGO_COLORS[2], ALGO_COLORS[3]]
    _bench_dfs = [random_bench_stats, mc_bench_stats, sa_bench_stats, cg_bench_stats, sl_bench_stats]
    
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
    
    _x1 = np.arange(len(_player_counts))
    _width1 = 0.12
    _offsets1 = [-2, -1, 0, 1, 2]
    
    for _i, (_algo, _color) in enumerate(zip(_algo_names, _colors)):
        _gaps = []
        for _j, _pc in enumerate(_player_counts):
            _data = bench_by_players[_algo].get(_pc, {})
            _mean_gap = _data.get("mean_gap", 0)
            _total_events = _data.get("total_events", 0)
            
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
    
    _range_counts = {}
    for _algo, _df in zip(_algo_names, _bench_dfs):
        if "benchRange" in _df.columns:
            _ranges = _df.get_column("benchRange").to_numpy()
            _unique, _counts = np.unique(_ranges, return_counts=True)
            _range_counts[_algo] = dict(zip(_unique, _counts / len(_ranges) * 100))
    
    _all_ranges = sorted(set(r for d in _range_counts.values() for r in d.keys()))
    _width2 = 0.15
    _offsets2 = [-2, -1, 0, 1, 2]
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
        mo.md("<center><i>Figure 8: Bench fairness metrics. Left: average games played between bench periods for different player counts. Right: distribution of bench count differences within sessions.</i></center>"),
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
def _(config, math, mc_config, mo, sa_config, sl_config):
    _player_counts = config.get("playerCounts", [20])
    _n = max(_player_counts)
    _c = 4
    _r = config.get("rounds", 10)
    _playing_per_round = _c * 4
    _mc_samples = mc_config.get("algorithmParams", {}).get("samplesPerRound", 300)
    _sa_iterations = sa_config.get("algorithmParams", {}).get("iterations", 5000)
    _sa_initial_temp = sa_config.get("algorithmParams", {}).get("initialTemperature", 2000)
    _sa_cooling_rate = sa_config.get("algorithmParams", {}).get("coolingRate", 0.9995)
    _sl_iterations = sl_config.get("algorithmParams", {}).get("iterations", 5000)
    _pairs_per_round = _c * 2
    _total_possible_pairs = _n * (_n - 1) // 2
    
    _collision_approx = 1 - math.exp(-(_pairs_per_round ** 2) / (2 * _total_possible_pairs))
    
    _max_leaving = _n - _playing_per_round
    _min_forbidden = _pairs_per_round - _max_leaving
    _max_forbidden = _pairs_per_round - (_max_leaving // 2)
    _num_matchings = _playing_per_round - 1
    _transitions = _r - 1
    
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

#### Win Parity Percentage

Derived from the average engine-tracked win differential:

$$\\text{{Win Parity \\%}} = \\max\\left(0,\\; 100 \\times \\left(1 - \\frac{{\\text{{avgWinDifferential}}}}{{2.0}}\\right)\\right)$$

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
- Monte Carlo's {_mc_samples} samples covers {_mc_samples/_configs_per_round * 100:.2e}% of the space
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

| Property | Random | Monte Carlo | Simulated Annealing | Conflict Graph | Smart Matching |
|----------|--------|-------------|---------------------|----------------|----------------|
| Memory of past rounds | No | Yes (cost function) | Yes (cost function) | Yes (conflict weights) | Yes (cost function) |
| Search method | Single random | Sample {_mc_samples}, pick best | Iterative refinement | Greedy construction | Iterative refinement |
| Can escape local minima | N/A | Limited | Yes (via temperature) | No | Yes (via temperature) |
| Gender/level aware | No | No | No | No | Yes |
| Iterations per round | 1 | {_mc_samples} | {_sa_iterations} | 1 | {_sl_iterations} |

**Monte Carlo:**
Generates $k$ random candidates and selects the one with lowest cost. Probability of finding a perfect solution:

$$P(\\text{{find perfect}}) = 1 - (1 - p)^k$$

where $p$ is the probability a single random sample is perfect.

**Simulated Annealing:**
Uses Metropolis acceptance criterion. For a cost change $\\Delta C$ at temperature $T$:
- Accept if $\\Delta C < 0$ (improvement)
- Accept with probability $e^{{-\\Delta C / T}}$ if $\\Delta C \\geq 0$

Temperature decreases as $T(t) = T_0 \\cdot \\alpha^t$ where $T_0 = {_sa_initial_temp}$ and $\\alpha = {_sa_cooling_rate}$.

**Conflict Graph:**
Greedily selects pairs with lowest conflict score:

$$\\text{{score}}(i, j) = w_1 \\cdot \\text{{history}}(i,j) + w_2 \\cdot \\text{{recent}}(i,j)$$

Fast ($O(n^2 \\log n)$) but may miss optimal solutions due to early greedy commitments.
        """),
        
        "Win Parity: Evenly Matched Calculation": mo.md(f"""
### Win Parity Matches

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
