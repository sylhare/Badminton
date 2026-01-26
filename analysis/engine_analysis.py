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
    
    # Load Monte Carlo data
    mc_dir = data_dir / "mc_algo"
    mc_summary = pl.read_csv(mc_dir / "summary.csv")
    mc_pair_events = pl.read_csv(mc_dir / "pair_events.csv")
    mc_config = json.loads((mc_dir / "config.json").read_text())
    
    # Load Simulated Annealing data
    sa_dir = data_dir / "sa_algo"
    sa_summary = pl.read_csv(sa_dir / "summary.csv")
    sa_pair_events = pl.read_csv(sa_dir / "pair_events.csv")
    sa_config = json.loads((sa_dir / "config.json").read_text())
    
    # Load Conflict Graph data
    cg_dir = data_dir / "cg_algo"
    cg_summary = pl.read_csv(cg_dir / "summary.csv")
    cg_pair_events = pl.read_csv(cg_dir / "pair_events.csv")
    cg_config = json.loads((cg_dir / "config.json").read_text())
    
    # Use MC config as reference
    config = mc_config
    return (
        cg_config, cg_dir, cg_pair_events, cg_summary,
        config, data_dir,
        mc_config, mc_dir, mc_pair_events, mc_summary,
        sa_config, sa_dir, sa_pair_events, sa_summary,
    )


@app.cell(hide_code=True)
def _(config, mo):
    mo.md(f"""
    # Court Assignment Engine Comparison

    **Comparing Four Algorithms:**
    - **Monte Carlo (MC)**: Random sampling with greedy cost evaluation (300 iterations)
    - **Simulated Annealing (SA)**: Iterative improvement with temperature schedule (5000 iterations)
    - **Conflict Graph (CG)**: Greedy construction avoiding known teammate conflicts
    - **Random Baseline**: No optimization (pure random pairing)

    **Configuration** (same for all)
    - Runs: {config.get('runs', 5000)} per batch (5 batches each)
    - Rounds: {config.get('rounds', 10)} (consecutive assignments per run)
    - Players: {config.get('numPlayers', 20)} (total pool size)
    - Courts: {config.get('numCourts', 4)} (matches per round)
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


# =============================================================================
# RANDOM BASELINE SIMULATION
# =============================================================================


@app.cell
def _(config, pl):
    import random
    
    BASELINE_BATCHES = 5
    BASELINE_RUNS_PER_BATCH = config.get("runs", 5000)
    
    players = [f"P{i + 1}" for i in range(config.get("numPlayers", 20))]
    num_courts = config.get("numCourts", 4)
    num_rounds = config.get("rounds", 10)
    
    def pair_key(a: str, b: str) -> str:
        return f"{a}|{b}" if a < b else f"{b}|{a}"
    
    def random_round() -> dict[str, str]:
        selected = random.sample(players, num_courts * 4)
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
    
    for batch_id in range(1, BASELINE_BATCHES + 1):
        for sim_id in range(BASELINE_RUNS_PER_BATCH):
            rounds = [random_round() for _ in range(num_rounds)]
            repeat_pair_count = 0
            repeat_diff = 0
            repeat_same = 0
            
            for _i in range(len(rounds) - 1):
                current = rounds[_i]
                next_round = rounds[_i + 1]
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
                    all_pair_events_list.append({
                        "batch": batch_id,
                        "simulationId": sim_id,
                        "pairId": pair_id,
                        "opponentChanged": opponent_changed,
                    })
            
            all_summaries.append({
                "batch": batch_id,
                "simulationId": sim_id,
                "repeatAnyPair": repeat_pair_count > 0,
                "repeatPairDifferentOpponents": repeat_diff > 0,
                "repeatPairSameOpponents": repeat_same > 0,
                "repeatPairCount": repeat_pair_count,
                "repeatPairDifferentOpponentsCount": repeat_diff,
                "repeatPairSameOpponentsCount": repeat_same,
            })
    
    baseline_summary = pl.DataFrame(all_summaries)
    baseline_pair_events = pl.DataFrame(all_pair_events_list)
    return baseline_pair_events, baseline_summary, pair_key, random


# =============================================================================
# SUMMARY METRICS COMPUTATION
# =============================================================================


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
    # Compute metrics for all algorithms
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
def _(all_metrics, mo):
    mo.ui.table(all_metrics)
    return


# =============================================================================
# MAIN COMPARISON CHART
# =============================================================================


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Head-to-Head Comparison
    
    Visual comparison of repeat rates and zero-repeat percentages across all algorithms.
    """)
    return


@app.cell
def _(all_metrics, fig_to_image, mo, np, plt):
    _metrics = all_metrics.to_dicts()
    _labels = [m["label"] for m in _metrics]
    _colors = ["#4C78A8", "#54A24B", "#F58518", "#E45756"]  # MC, SA, CG, Baseline
    
    _fig, (_ax1, _ax2) = plt.subplots(1, 2, figsize=(14, 5))
    
    # Left: Any-repeat rate with confidence intervals
    _any_rates = [m["p_any_repeat"] for m in _metrics]
    _ci_low = [m["ci_any_low"] for m in _metrics]
    _ci_high = [m["ci_any_high"] for m in _metrics]
    _errors = [
        [_any_rates[i] - _ci_low[i] for i in range(len(_metrics))],
        [_ci_high[i] - _any_rates[i] for i in range(len(_metrics))]
    ]
    
    _x = np.arange(len(_labels))
    _bars1 = _ax1.bar(_x, _any_rates, color=_colors, alpha=0.85, width=0.6)
    _ax1.errorbar(_x, _any_rates, yerr=_errors, fmt="none", ecolor="#444444", capsize=4, capthick=2)
    
    _ax1.set_xticks(_x)
    _ax1.set_xticklabels(_labels, rotation=15, ha="right", fontsize=10)
    _ax1.set_ylabel("Probability of Any Repeat", fontsize=11)
    _ax1.set_title("Any-Repeat Rate (with 95% CI)\n(lower is better)", fontsize=12, fontweight="bold")
    _ax1.set_ylim(0, 1.1)
    
    for _bar in _bars1:
        _h = _bar.get_height()
        _ax1.text(_bar.get_x() + _bar.get_width()/2, _h + 0.04,
                  f"{_h:.1%}", ha="center", va="bottom", fontsize=10, fontweight="bold")
    
    # Right: Zero-repeat rate (compute CI for zero-repeat)
    _zero_rates = [m["zero_repeat_pct"] for m in _metrics]
    # Compute CI for zero-repeat rate using same formula
    _zero_ci_errors = []
    for m in _metrics:
        _n = m["runs"]
        _p = m["zero_repeat_pct"]
        _se = np.sqrt(_p * (1 - _p) / _n) if _p > 0 and _p < 1 else 0
        _zero_ci_errors.append(1.96 * _se)
    
    _bars2 = _ax2.bar(_x, _zero_rates, color=_colors, alpha=0.85, width=0.6)
    _ax2.errorbar(_x, _zero_rates, yerr=_zero_ci_errors, fmt="none", ecolor="#444444", capsize=4, capthick=2)
    
    _ax2.set_xticks(_x)
    _ax2.set_xticklabels(_labels, rotation=15, ha="right", fontsize=10)
    _ax2.set_ylabel("Zero-Repeat Rate", fontsize=11)
    _ax2.set_title("Perfect Runs (with 95% CI)\n(higher is better)", fontsize=12, fontweight="bold")
    _ax2.set_ylim(0, 1.1)
    
    for _i, _bar in enumerate(_bars2):
        _h = _bar.get_height()
        _ax2.text(_bar.get_x() + _bar.get_width()/2, _h + _zero_ci_errors[_i] + 0.02,
                  f"{_h:.1%}", ha="center", va="bottom", fontsize=10, fontweight="bold")
    
    _fig.tight_layout()
    mo.image(fig_to_image(_fig))
    return


@app.cell(hide_code=True)
def _(all_metrics, mo):
    _metrics = all_metrics.to_dicts()
    _by_label = {m["label"]: m for m in _metrics}
    
    _mc = _by_label["Monte Carlo"]
    _sa = _by_label["Simulated Annealing"]
    _cg = _by_label["Conflict Graph"]
    _bl = _by_label["Random Baseline"]
    
    # Calculate improvements
    _sa_vs_mc = (_mc["p_any_repeat"] - _sa["p_any_repeat"]) / _mc["p_any_repeat"] * 100 if _mc["p_any_repeat"] > 0 else 0
    _cg_vs_mc = (_mc["p_any_repeat"] - _cg["p_any_repeat"]) / _mc["p_any_repeat"] * 100 if _mc["p_any_repeat"] > 0 else 0
    _mc_vs_bl = (_bl["p_any_repeat"] - _mc["p_any_repeat"]) / _bl["p_any_repeat"] * 100
    _sa_vs_bl = (_bl["p_any_repeat"] - _sa["p_any_repeat"]) / _bl["p_any_repeat"] * 100
    _cg_vs_bl = (_bl["p_any_repeat"] - _cg["p_any_repeat"]) / _bl["p_any_repeat"] * 100
    
    _winner = "Simulated Annealing" if _sa["p_any_repeat"] <= _cg["p_any_repeat"] and _sa["p_any_repeat"] <= _mc["p_any_repeat"] else \
              "Conflict Graph" if _cg["p_any_repeat"] <= _mc["p_any_repeat"] else "Monte Carlo"
    
    mo.md(f"""
    ### Performance Summary
    
    | Algorithm | Any-Repeat Rate | Zero-Repeat Rate | vs Baseline | vs Monte Carlo |
    |-----------|-----------------|------------------|-------------|----------------|
    | **Monte Carlo** | {_mc['p_any_repeat']:.1%} | {_mc['zero_repeat_pct']:.1%} | {_mc_vs_bl:+.1f}% | - |
    | **Simulated Annealing** | {_sa['p_any_repeat']:.1%} | {_sa['zero_repeat_pct']:.1%} | {_sa_vs_bl:+.1f}% | {_sa_vs_mc:+.1f}% |
    | **Conflict Graph** | {_cg['p_any_repeat']:.1%} | {_cg['zero_repeat_pct']:.1%} | {_cg_vs_bl:+.1f}% | {_cg_vs_mc:+.1f}% |
    | **Random Baseline** | {_bl['p_any_repeat']:.1%} | {_bl['zero_repeat_pct']:.1%} | - | - |
    
    **Winner: {_winner}** with {_by_label[_winner]['zero_repeat_pct']:.1%} perfect runs!
    """)
    return


# =============================================================================
# REPEAT COUNT DISTRIBUTION
# =============================================================================


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Repeat-Count Distribution
    
    How many repeat teammate pairs occur per simulation run?
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
    
    # Find max x for consistent scaling
    _max_x = max(
        _data_df.get_column("repeatPairDifferentOpponentsCount").max()
        for _data_df, _, _ in _datasets
    )
    
    for _ax, (_df, _name, _color) in zip(_axes, _datasets):
        _counts = _df.get_column("repeatPairDifferentOpponentsCount")
        _values, _freqs = np.unique(_counts.to_numpy(), return_counts=True)
        _pcts = _freqs / _freqs.sum() * 100
        
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


# =============================================================================
# PAIR FREQUENCY HEATMAPS
# =============================================================================


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Pair Frequency Heatmaps
    
    Which player pairs repeat most often? Comparing distribution patterns across algorithms.
    """)
    return


@app.cell
def _(baseline_pair_events, cg_pair_events, config, fig_to_image, mc_pair_events, mo, np, plt, sa_pair_events):
    from matplotlib.gridspec import GridSpec
    
    _num_players = config.get("numPlayers", 20)
    _players = [f"P{i + 1}" for i in range(_num_players)]
    
    # Base matrix with 1 for all valid pairs (i != j) to show grid structure
    def make_base_matrix(player_count):
        _base = np.ones((player_count, player_count))
        np.fill_diagonal(_base, 0)  # No self-pairs
        return _base
    
    def build_matrix(events_df, player_count):
        # Start with base of 1 for all valid pairs
        _matrix = make_base_matrix(player_count)
        if events_df.height == 0:
            return _matrix
        
        _pair_counts = events_df.group_by("pairId").len().to_dicts()
        for _row in _pair_counts:
            _pair_id = _row["pairId"]
            _count = _row["len"]
            _parts = _pair_id.split("|")
            _p1_idx = int(_parts[0][1:]) - 1
            _p2_idx = int(_parts[1][1:]) - 1
            # Add actual count on top of base
            _matrix[_p1_idx, _p2_idx] += _count
            _matrix[_p2_idx, _p1_idx] += _count
        return _matrix
    
    _mc_matrix = build_matrix(mc_pair_events, _num_players)
    _sa_matrix = build_matrix(sa_pair_events, _num_players)
    _cg_matrix = build_matrix(cg_pair_events, _num_players)
    _baseline_matrix = build_matrix(baseline_pair_events, _num_players)
    
    # Normalize each to percentage of its own total
    def normalize(matrix):
        total = matrix.sum()
        return matrix / total * 100 if total > 0 else matrix
    
    _mc_norm = normalize(_mc_matrix)
    _sa_norm = normalize(_sa_matrix)
    _cg_norm = normalize(_cg_matrix)
    _baseline_norm = normalize(_baseline_matrix)
    
    # Find common scale
    _vmax = max(_mc_norm.max(), _sa_norm.max(), _cg_norm.max(), _baseline_norm.max())
    if _vmax == 0:
        _vmax = 1  # Fallback
    
    # Create figure with GridSpec: 2x2 for heatmaps + narrow column for colorbar
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
        (_mc_norm, "Monte Carlo"),
        (_sa_norm, "Simulated Annealing"),
        (_cg_norm, "Conflict Graph"),
        (_baseline_norm, "Random Baseline"),
    ]
    
    _cmap = plt.cm.YlOrRd
    
    for _ax, (_matrix, _name) in zip(_axes, _datasets):
        _im = _ax.imshow(_matrix, cmap=_cmap, vmin=0, vmax=_vmax, aspect="equal")
        _ax.set_xticks(range(_num_players))
        _ax.set_yticks(range(_num_players))
        _ax.set_xticklabels(_players, rotation=45, ha="right", fontsize=7)
        _ax.set_yticklabels(_players, fontsize=7)
        _ax.set_title(_name, fontweight="bold")
        
        # Add total events annotation (subtract base count to show actual repeats)
        _base_total = _num_players * (_num_players - 1)  # Number of valid pairs * 2
        _actual_repeats = _matrix.sum() - _base_total
        _ax.annotate(f"Repeats: {_actual_repeats/2:.0f}", 
                     xy=(0.02, 0.98), xycoords="axes fraction",
                     ha="left", va="top", fontsize=9,
                     bbox=dict(boxstyle="round", facecolor="white", alpha=0.8))
    
    # Colorbar on the side
    _fig.colorbar(_im, cax=_cbar_ax, label="% of total (base + repeats)")
    _fig.suptitle("Repeat Pair Frequency Distribution\n(base of 1 per pair + actual repeats, normalized)", 
                  fontsize=12, fontweight="bold", y=0.98)
    
    mo.image(fig_to_image(_fig))
    return


@app.cell(hide_code=True)
def _(baseline_pair_events, cg_pair_events, mc_pair_events, mo, sa_pair_events):
    _mc_total = mc_pair_events.height
    _sa_total = sa_pair_events.height
    _cg_total = cg_pair_events.height
    _bl_total = baseline_pair_events.height
    
    _sa_note = ""
    if _sa_total == 0:
        _sa_note = "**Simulated Annealing achieved ZERO repeat events** - the heatmap shows uniform coloring (only the base value of 1 per pair, no actual repeats)!"
    
    mo.md(f"""
    ### Heatmap Interpretation
    
    Each heatmap shows a base value of 1 for every valid pair plus actual repeat counts. This ensures all algorithms display a visible grid structure.
    
    {_sa_note}
    
    **Pattern Analysis:**
    
    - **Simulated Annealing**: Perfectly uniform (lightest) - no pair repeated above the baseline value of 1
    - **Monte Carlo**: Similar spread pattern to Random Baseline but with ~4× fewer total repeats ({_mc_total:,} vs {_bl_total:,} events). The distribution is fairly uniform because MC samples randomly.
    - **Conflict Graph**: Shows **concentrated hot spots** on specific pairs. This is due to its deterministic/greedy nature - when the algorithm fails to avoid repeats, it tends to fail on the same pairs repeatedly across runs. Despite having fewer total repeats ({_cg_total:,} events), the repeats cluster on certain pairs.
    - **Random Baseline**: Most spread out but darkest overall - repeats are distributed across all pairs with high total volume.
    
    **Key insight**: Lighter overall = fewer repeats. Concentrated spots = deterministic failure patterns. Uniform spread = stochastic behavior.
    """)
    return


# =============================================================================
# TOP REPEAT PAIRS ANALYSIS
# =============================================================================


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Top Repeat Pairs Analysis
    
    Which player pairs repeat most often? Identifying the "worst offenders" for each algorithm.
    """)
    return


@app.cell
def _(baseline_pair_events, cg_pair_events, mc_pair_events, mo, pl, sa_pair_events):
    def get_top_pairs(events_df, label, top_n=10):
        """Get top N most frequent repeat pairs for an algorithm."""
        if events_df.height == 0:
            return pl.DataFrame({"pairId": [], "events": [], "algorithm": []})
        return (
            events_df.group_by("pairId")
            .agg(pl.len().alias("events"))
            .sort("events", descending=True)
            .head(top_n)
            .with_columns(pl.lit(label).alias("algorithm"))
        )
    
    _mc_top = get_top_pairs(mc_pair_events, "Monte Carlo")
    _sa_top = get_top_pairs(sa_pair_events, "Simulated Annealing")
    _cg_top = get_top_pairs(cg_pair_events, "Conflict Graph")
    _bl_top = get_top_pairs(baseline_pair_events, "Random Baseline")
    
    top_pairs_data = {
        "Monte Carlo": _mc_top,
        "Simulated Annealing": _sa_top,
        "Conflict Graph": _cg_top,
        "Random Baseline": _bl_top,
    }
    
    # Display tables side by side
    _tables = []
    for _algo, _df in top_pairs_data.items():
        if _df.height > 0:
            _tables.append(mo.vstack([
                mo.md(f"**{_algo}**"),
                mo.ui.table(_df.select(["pairId", "events"]))
            ]))
        else:
            _tables.append(mo.vstack([
                mo.md(f"**{_algo}**"),
                mo.md("*No repeat pairs!*")
            ]))
    
    mo.hstack(_tables, justify="start", gap=2)
    return top_pairs_data,


# =============================================================================
# ADJACENT PLAYER BIAS ANALYSIS
# =============================================================================


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Adjacent Player Bias Analysis
    
    Do algorithms show bias toward pairing players with adjacent IDs (P1|P2, P2|P3, etc.)?
    This analysis explains the "hot spots" phenomenon in the Conflict Graph algorithm.
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
                    "adjacent_pairs": 0, "nonadjacent_pairs": 0, "bias_ratio": 0}
        
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
    
    # Create visualization
    _fig, (_ax1, _ax2) = plt.subplots(1, 2, figsize=(14, 5))
    
    _labels = ["Monte Carlo", "Simulated Annealing", "Conflict Graph", "Random Baseline"]
    _colors = ["#4C78A8", "#54A24B", "#F58518", "#E45756"]
    _x = np.arange(len(_labels))
    _width = 0.35
    
    # Left: Adjacent vs Non-adjacent average events
    _adj_avgs = [d["adj_avg"] for d in adjacency_bias_data]
    _nonadj_avgs = [d["nonadj_avg"] for d in adjacency_bias_data]
    
    _bars1 = _ax1.bar(_x - _width/2, _adj_avgs, _width, label="Adjacent pairs (P1|P2, etc.)", color="#FF6B6B", alpha=0.8)
    _bars2 = _ax1.bar(_x + _width/2, _nonadj_avgs, _width, label="Non-adjacent pairs", color="#4ECDC4", alpha=0.8)
    
    _ax1.set_xticks(_x)
    _ax1.set_xticklabels(_labels, rotation=15, ha="right", fontsize=10)
    _ax1.set_ylabel("Avg Events per Pair", fontsize=11)
    _ax1.set_title("Adjacent vs Non-Adjacent Pair Frequency\n(higher adjacent = more bias)", fontsize=12, fontweight="bold")
    _ax1.legend(loc="upper right")
    
    # Right: Bias ratio
    _bias_ratios = [d["bias_ratio"] for d in adjacency_bias_data]
    _bars3 = _ax1.bar(_x, _bias_ratios, color=_colors, alpha=0.0)  # Invisible, just for spacing
    
    _ax2.bar(_x, _bias_ratios, color=_colors, alpha=0.85, width=0.6)
    _ax2.axhline(y=1.0, color="gray", linestyle="--", alpha=0.7, label="No bias (ratio=1)")
    _ax2.set_xticks(_x)
    _ax2.set_xticklabels(_labels, rotation=15, ha="right", fontsize=10)
    _ax2.set_ylabel("Bias Ratio (Adjacent / Non-Adjacent)", fontsize=11)
    _ax2.set_title("Adjacent Pair Bias Ratio\n(>1 = favors adjacent, <1 = avoids adjacent)", fontsize=12, fontweight="bold")
    _ax2.legend(loc="upper right")
    
    for _i, _ratio in enumerate(_bias_ratios):
        if _ratio > 0:
            _ax2.text(_i, _ratio + 0.05, f"{_ratio:.2f}×", ha="center", va="bottom", fontsize=10, fontweight="bold")
    
    _fig.tight_layout()
    mo.image(fig_to_image(_fig))
    return adjacency_bias_data, is_adjacent_pair


@app.cell(hide_code=True)
def _(adjacency_bias_data, mo):
    _cg = next(d for d in adjacency_bias_data if d["algorithm"] == "Conflict Graph")
    _bl = next(d for d in adjacency_bias_data if d["algorithm"] == "Random Baseline")
    _mc = next(d for d in adjacency_bias_data if d["algorithm"] == "Monte Carlo")
    
    _cg_bias_pct = (_cg["bias_ratio"] - 1) * 100 if _cg["bias_ratio"] > 0 else 0
    _bl_bias_pct = (_bl["bias_ratio"] - 1) * 100 if _bl["bias_ratio"] > 0 else 0
    
    mo.md(f"""
    ### Adjacent Bias Interpretation
    
    | Algorithm | Adjacent Avg | Non-Adjacent Avg | Bias Ratio | Interpretation |
    |-----------|--------------|------------------|------------|----------------|
    | **Monte Carlo** | {_mc['adj_avg']:.1f} | {_mc['nonadj_avg']:.1f} | {_mc['bias_ratio']:.2f}× | {'Slight bias' if _mc['bias_ratio'] > 1.1 else 'Neutral'} |
    | **Simulated Annealing** | {adjacency_bias_data[1]['adj_avg']:.1f} | {adjacency_bias_data[1]['nonadj_avg']:.1f} | {adjacency_bias_data[1]['bias_ratio']:.2f}× | No repeats = no bias |
    | **Conflict Graph** | {_cg['adj_avg']:.1f} | {_cg['nonadj_avg']:.1f} | **{_cg['bias_ratio']:.2f}×** | **{_cg_bias_pct:.0f}% more likely** |
    | **Random Baseline** | {_bl['adj_avg']:.1f} | {_bl['nonadj_avg']:.1f} | {_bl['bias_ratio']:.2f}× | {'Slight bias' if _bl['bias_ratio'] > 1.1 else 'Expected uniform'} |
    
    **Key Finding**: The Conflict Graph algorithm shows a **{_cg['bias_ratio']:.1f}× bias** toward repeating adjacent player pairs.
    
    **Root Cause**: This bias likely stems from how the CG algorithm iterates through players in sorted order.
    When selecting players for courts, adjacent IDs are more likely to be grouped together during the greedy
    construction phase, creating systematic repeat patterns on pairs like P1|P2, P2|P3, P3|P4, etc.
    
    **Why This Matters**: Even though CG achieves ~50% zero-repeat rate overall, when it *does* fail,
    it fails on the same pairs repeatedly. This creates unfairness for specific player combinations.
    """)
    return


# =============================================================================
# CORRELATION ANALYSIS
# =============================================================================


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Pattern Correlation Analysis
    
    Do algorithms produce similar repeat patterns, or do they fail on different pairs?
    """)
    return


@app.cell
def _(baseline_pair_events, cg_pair_events, config, fig_to_image, mc_pair_events, mo, np, pl, plt, sa_pair_events):
    def build_pair_vector(events_df, all_pairs):
        """Build a frequency vector for all possible pairs."""
        if events_df.height == 0:
            return np.zeros(len(all_pairs))
        
        pair_counts = dict(
            events_df.group_by("pairId")
            .agg(pl.len().alias("count"))
            .iter_rows()
        )
        return np.array([pair_counts.get(p, 0) for p in all_pairs])
    
    # Generate all possible pairs
    _num_players = config.get("numPlayers", 20)
    _all_pairs = [f"P{i}|P{j}" for i in range(1, _num_players + 1) 
                  for j in range(i + 1, _num_players + 1)]
    
    # Build vectors for each algorithm
    _mc_vec = build_pair_vector(mc_pair_events, _all_pairs)
    _sa_vec = build_pair_vector(sa_pair_events, _all_pairs)
    _cg_vec = build_pair_vector(cg_pair_events, _all_pairs)
    _bl_vec = build_pair_vector(baseline_pair_events, _all_pairs)
    
    # Compute correlation matrix
    _vectors = np.array([_mc_vec, _sa_vec, _cg_vec, _bl_vec])
    _labels = ["Monte Carlo", "Simulated Annealing", "Conflict Graph", "Random Baseline"]
    
    # Handle SA case (all zeros)
    _corr_matrix = np.zeros((4, 4))
    for i in range(4):
        for j in range(4):
            if np.std(_vectors[i]) > 0 and np.std(_vectors[j]) > 0:
                _corr_matrix[i, j] = np.corrcoef(_vectors[i], _vectors[j])[0, 1]
            elif i == j:
                _corr_matrix[i, j] = 1.0
            else:
                _corr_matrix[i, j] = 0.0
    
    # Create heatmap
    _fig, _ax = plt.subplots(figsize=(8, 6))
    
    _im = _ax.imshow(_corr_matrix, cmap="RdYlGn", vmin=-1, vmax=1, aspect="equal")
    _ax.set_xticks(range(4))
    _ax.set_yticks(range(4))
    _ax.set_xticklabels(_labels, rotation=45, ha="right", fontsize=10)
    _ax.set_yticklabels(_labels, fontsize=10)
    
    # Add correlation values as text
    for i in range(4):
        for j in range(4):
            _text_color = "white" if abs(_corr_matrix[i, j]) > 0.5 else "black"
            _ax.text(j, i, f"{_corr_matrix[i, j]:.2f}", ha="center", va="center", 
                     fontsize=11, fontweight="bold", color=_text_color)
    
    _cbar = _fig.colorbar(_im, ax=_ax, shrink=0.8)
    _cbar.set_label("Pearson Correlation", rotation=270, labelpad=15)
    _ax.set_title("Repeat Pattern Correlation Between Algorithms\n(which algorithms fail on similar pairs?)", 
                  fontsize=12, fontweight="bold")
    
    _fig.tight_layout()
    
    correlation_matrix = _corr_matrix
    mo.image(fig_to_image(_fig))
    return correlation_matrix,


@app.cell(hide_code=True)
def _(correlation_matrix, mo):
    _mc_bl = correlation_matrix[0, 3]
    _cg_bl = correlation_matrix[2, 3]
    _mc_cg = correlation_matrix[0, 2]
    
    mo.md(f"""
    ### Correlation Interpretation
    
    | Comparison | Correlation | Meaning |
    |------------|-------------|---------|
    | **MC vs Baseline** | r = {_mc_bl:.2f} | {'Similar patterns' if _mc_bl > 0.5 else 'Different patterns'} - MC samples randomly like baseline |
    | **CG vs Baseline** | r = {_cg_bl:.2f} | {'Similar patterns' if _cg_bl > 0.5 else 'Different patterns'} - CG has its own systematic biases |
    | **MC vs CG** | r = {_mc_cg:.2f} | {'Similar patterns' if _mc_cg > 0.5 else 'Different patterns'} |
    | **SA vs All** | r ≈ 0.00 | SA has no repeats, so no correlation possible |
    
    **Key Insights:**
    
    1. **Monte Carlo ↔ Baseline**: {'High correlation suggests MC fails on similar pairs as random chance.' if _mc_bl > 0.5 else 'Low correlation suggests MC has different failure patterns than random.'}
    
    2. **Conflict Graph ↔ Baseline**: {'High correlation means CG fails on the same pairs that random would.' if _cg_bl > 0.5 else 'Low correlation confirms CG has unique, systematic failure patterns (the adjacent bias).'}
    
    3. **Simulated Annealing**: With zero repeat events, SA shows no correlation with any algorithm—it successfully avoids all problematic pairs.
    
    **Conclusion**: {'CG and MC fail on different pairs than each other, suggesting combining them could cover each other\'s weaknesses.' if _mc_cg < 0.3 else 'CG and MC have similar failure patterns, so combining them may not help much.'}
    """)
    return


# =============================================================================
# AVERAGE REPEATS COMPARISON
# =============================================================================


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Average Repeats Per Run
    
    Direct comparison of how many teammate pairs repeat on average in each simulation run.
    """)
    return


@app.cell
def _(all_metrics, fig_to_image, mo, np, plt):
    _metrics = all_metrics.to_dicts()
    _labels = [m["label"] for m in _metrics]
    _avg_repeats = [m["avg_repeat_pairs"] for m in _metrics]
    _colors = ["#4C78A8", "#54A24B", "#F58518", "#E45756"]
    
    _fig, _ax = plt.subplots(figsize=(10, 6))
    
    _x = np.arange(len(_labels))
    _bars = _ax.bar(_x, _avg_repeats, color=_colors, alpha=0.85, width=0.6)
    
    _ax.set_xticks(_x)
    _ax.set_xticklabels(_labels, rotation=15, ha="right", fontsize=11)
    _ax.set_ylabel("Average Repeat Pairs per Run", fontsize=12)
    _ax.set_title("Average Teammate Repetitions\n(lower is better)", fontsize=14, fontweight="bold")
    
    # Add value labels
    for _bar in _bars:
        _h = _bar.get_height()
        _ax.text(_bar.get_x() + _bar.get_width()/2, _h + 0.05,
                 f"{_h:.3f}", ha="center", va="bottom", fontsize=11, fontweight="bold")
    
    # Add baseline reference line
    _baseline_avg = _metrics[-1]["avg_repeat_pairs"]
    _ax.axhline(y=_baseline_avg, color="#E45756", linestyle="--", alpha=0.5, label="Baseline")
    
    _fig.tight_layout()
    mo.image(fig_to_image(_fig))
    return


# =============================================================================
# BATCH CONSISTENCY ANALYSIS
# =============================================================================


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Batch Consistency Analysis
    
    How consistent are the algorithms across different batches?
    """)
    return


@app.cell
def _(baseline_summary, cg_summary, fig_to_image, mc_summary, mo, np, plt, pl, sa_summary):
    def get_batch_stats(data_frame, label):
        if "batch" not in data_frame.columns:
            return []
        return (
            data_frame.group_by("batch")
            .agg([
                pl.col("repeatAnyPair").mean().alias("p_any_repeat"),
                pl.col("repeatPairDifferentOpponentsCount").mean().alias("avg_repeats"),
                (pl.col("repeatPairDifferentOpponentsCount") == 0).mean().alias("zero_pct"),
            ])
            .with_columns(pl.lit(label).alias("algorithm"))
            .to_dicts()
        )
    
    _mc_batch = get_batch_stats(mc_summary, "Monte Carlo")
    _sa_batch = get_batch_stats(sa_summary, "Simulated Annealing")
    _cg_batch = get_batch_stats(cg_summary, "Conflict Graph")
    _bl_batch = get_batch_stats(baseline_summary, "Random Baseline")
    
    _all_batch_stats = _mc_batch + _sa_batch + _cg_batch + _bl_batch
    
    if _all_batch_stats:
        _fig, _ax = plt.subplots(figsize=(12, 6))
        
        _algos = ["Monte Carlo", "Simulated Annealing", "Conflict Graph", "Random Baseline"]
        _colors = ["#4C78A8", "#54A24B", "#F58518", "#E45756"]
        _width = 0.2
        _x = np.arange(5)  # 5 batches
        
        for _i, (_algo, _color) in enumerate(zip(_algos, _colors)):
            _batch_data = [s for s in _all_batch_stats if s["algorithm"] == _algo]
            if _batch_data:
                _values = [s["zero_pct"] for s in sorted(_batch_data, key=lambda x: x["batch"])]
                _ax.bar(_x + _i * _width, _values, _width, label=_algo, color=_color, alpha=0.85)
        
        _ax.set_xticks(_x + _width * 1.5)
        _ax.set_xticklabels([f"Batch {i+1}" for i in range(5)])
        _ax.set_ylabel("Zero-Repeat Rate", fontsize=11)
        _ax.set_title("Consistency Across Batches\n(Zero-repeat rate per batch)", fontsize=12, fontweight="bold")
        _ax.legend(loc="upper right")
        _ax.set_ylim(0, 1.1)
        
        _fig.tight_layout()
        mo.output.replace(mo.image(fig_to_image(_fig)))
    else:
        mo.output.replace(mo.md("No batch data available for consistency analysis."))
    return


# =============================================================================
# BATCH TIMING ANALYSIS
# =============================================================================


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Batch Timing Analysis
    
    How fast are the algorithms? Comparison of execution time across all batches.
    """)
    return


@app.cell
def _(cg_config, fig_to_image, mc_config, mo, np, plt, sa_config):
    # Extract timing data from config files
    _mc_timings = mc_config.get("timing", {}).get("batchTimings", [])
    _sa_timings = sa_config.get("timing", {}).get("batchTimings", [])
    _cg_timings = cg_config.get("timing", {}).get("batchTimings", [])
    
    # Calculate averages (in seconds for readability)
    _mc_avg = mc_config.get("timing", {}).get("avgPerBatchMs", 0) / 1000
    _sa_avg = sa_config.get("timing", {}).get("avgPerBatchMs", 0) / 1000
    _cg_avg = cg_config.get("timing", {}).get("avgPerBatchMs", 0) / 1000
    
    _mc_total = mc_config.get("timing", {}).get("totalMs", 0) / 1000
    _sa_total = sa_config.get("timing", {}).get("totalMs", 0) / 1000
    _cg_total = cg_config.get("timing", {}).get("totalMs", 0) / 1000
    
    _fig, (_ax1, _ax2) = plt.subplots(1, 2, figsize=(14, 5))
    
    # Left: Average time per batch (bar chart)
    _labels = ["Monte Carlo", "Simulated Annealing", "Conflict Graph"]
    _colors = ["#4C78A8", "#54A24B", "#F58518"]
    _avgs = [_mc_avg, _sa_avg, _cg_avg]
    _x = np.arange(len(_labels))
    
    _bars = _ax1.bar(_x, _avgs, color=_colors, alpha=0.85, width=0.6)
    _ax1.set_xticks(_x)
    _ax1.set_xticklabels(_labels, rotation=15, ha="right", fontsize=10)
    _ax1.set_ylabel("Average Time per Batch (seconds)", fontsize=11)
    _ax1.set_title("Average Execution Time\n(lower is better)", fontsize=12, fontweight="bold")
    _ax1.set_yscale("log")  # Log scale due to large differences
    
    for _bar in _bars:
        _h = _bar.get_height()
        _ax1.text(_bar.get_x() + _bar.get_width()/2, _h * 1.1,
                  f"{_h:.1f}s", ha="center", va="bottom", fontsize=10, fontweight="bold")
    
    # Right: Per-batch timing line chart
    _batches = [1, 2, 3, 4, 5]
    _mc_times = [t["durationMs"] / 1000 for t in _mc_timings]
    _sa_times = [t["durationMs"] / 1000 for t in _sa_timings]
    _cg_times = [t["durationMs"] / 1000 for t in _cg_timings]
    
    _ax2.plot(_batches, _mc_times, marker="o", label="Monte Carlo", color="#4C78A8", linewidth=2)
    _ax2.plot(_batches, _sa_times, marker="s", label="Simulated Annealing", color="#54A24B", linewidth=2)
    _ax2.plot(_batches, _cg_times, marker="^", label="Conflict Graph", color="#F58518", linewidth=2)
    
    _ax2.set_xlabel("Batch Number", fontsize=11)
    _ax2.set_ylabel("Execution Time (seconds)", fontsize=11)
    _ax2.set_title("Timing per Batch\n(5 batches, 5000 runs each)", fontsize=12, fontweight="bold")
    _ax2.legend(loc="upper right")
    _ax2.set_yscale("log")  # Log scale due to large differences
    _ax2.set_xticks(_batches)
    _ax2.grid(True, alpha=0.3)
    
    _fig.tight_layout()
    mo.image(fig_to_image(_fig))
    return


@app.cell(hide_code=True)
def _(cg_config, mc_config, mo, sa_config):
    _mc_avg = mc_config.get("timing", {}).get("avgPerBatchMs", 0) / 1000
    _sa_avg = sa_config.get("timing", {}).get("avgPerBatchMs", 0) / 1000
    _cg_avg = cg_config.get("timing", {}).get("avgPerBatchMs", 0) / 1000
    
    _mc_total = mc_config.get("timing", {}).get("totalMs", 0) / 1000
    _sa_total = sa_config.get("timing", {}).get("totalMs", 0) / 1000
    _cg_total = cg_config.get("timing", {}).get("totalMs", 0) / 1000
    
    # Speedup calculations
    _cg_vs_mc = _mc_avg / _cg_avg if _cg_avg > 0 else 0
    _cg_vs_sa = _sa_avg / _cg_avg if _cg_avg > 0 else 0
    _mc_vs_sa = _sa_avg / _mc_avg if _mc_avg > 0 else 0
    
    # Find fastest
    _fastest = "Conflict Graph" if _cg_avg <= _mc_avg and _cg_avg <= _sa_avg else \
               "Monte Carlo" if _mc_avg <= _sa_avg else "Simulated Annealing"
    
    mo.md(f"""
    ### Timing Summary
    
    | Algorithm | Avg per Batch | Total (5 batches) | Speedup vs SA |
    |-----------|---------------|-------------------|---------------|
    | **Conflict Graph** | {_cg_avg:.2f}s | {_cg_total:.1f}s | **{_cg_vs_sa:.0f}×** faster |
    | **Monte Carlo** | {_mc_avg:.1f}s | {_mc_total:.1f}s | {_mc_vs_sa:.1f}× faster |
    | **Simulated Annealing** | {_sa_avg:.1f}s | {_sa_total:.1f}s | 1.0× (baseline) |
    
    **Fastest: {_fastest}** - Conflict Graph is ~{_cg_vs_sa:.0f}× faster than Simulated Annealing and ~{_cg_vs_mc:.0f}× faster than Monte Carlo!
    
    ### Trade-off Analysis
    
    - **Conflict Graph**: Blazing fast (~{_cg_avg:.1f}s per batch) but only achieves ~50% zero-repeat rate
    - **Monte Carlo**: Moderate speed (~{_mc_avg:.0f}s per batch) with ~45% zero-repeat rate  
    - **Simulated Annealing**: Slowest (~{_sa_avg:.0f}s per batch) but achieves **100% zero-repeat rate**
    
    The choice depends on your priorities: if perfect teammate variety is critical, SA is worth the wait. For real-time applications, CG provides good-enough results instantly.
    """)
    return


# =============================================================================
# FINAL CONCLUSIONS
# =============================================================================


@app.cell(hide_code=True)
def _(all_metrics, mo):
    _metrics = all_metrics.to_dicts()
    _by_label = {m["label"]: m for m in _metrics}
    
    _mc = _by_label["Monte Carlo"]
    _sa = _by_label["Simulated Annealing"]
    _cg = _by_label["Conflict Graph"]
    _bl = _by_label["Random Baseline"]
    
    # Determine rankings
    _sorted_by_zero = sorted(_metrics, key=lambda x: x["zero_repeat_pct"], reverse=True)
    _rankings = {m["label"]: i+1 for i, m in enumerate(_sorted_by_zero)}
    
    mo.md(f"""
    ---
    
    ## Final Conclusions
    
    ### Algorithm Rankings (by Zero-Repeat Rate)
    
    | Rank | Algorithm | Zero-Repeat Rate | Avg Repeats/Run |
    |------|-----------|------------------|-----------------|
    | 🥇 1st | {_sorted_by_zero[0]['label']} | **{_sorted_by_zero[0]['zero_repeat_pct']:.1%}** | {_sorted_by_zero[0]['avg_repeat_pairs']:.3f} |
    | 🥈 2nd | {_sorted_by_zero[1]['label']} | {_sorted_by_zero[1]['zero_repeat_pct']:.1%} | {_sorted_by_zero[1]['avg_repeat_pairs']:.3f} |
    | 🥉 3rd | {_sorted_by_zero[2]['label']} | {_sorted_by_zero[2]['zero_repeat_pct']:.1%} | {_sorted_by_zero[2]['avg_repeat_pairs']:.3f} |
    | 4th | {_sorted_by_zero[3]['label']} | {_sorted_by_zero[3]['zero_repeat_pct']:.1%} | {_sorted_by_zero[3]['avg_repeat_pairs']:.3f} |
    
    ### Key Insights
    
    1. **{_sorted_by_zero[0]['label']}** achieves the best performance with **{_sorted_by_zero[0]['zero_repeat_pct']:.1%}** of runs having zero repeated teammate pairs.
    
    2. **Improvement over baseline**:
       - Monte Carlo: {(_bl['p_any_repeat'] - _mc['p_any_repeat']) / _bl['p_any_repeat'] * 100:.0f}% reduction in repeat rate
       - Simulated Annealing: {(_bl['p_any_repeat'] - _sa['p_any_repeat']) / _bl['p_any_repeat'] * 100:.0f}% reduction in repeat rate
       - Conflict Graph: {(_bl['p_any_repeat'] - _cg['p_any_repeat']) / _bl['p_any_repeat'] * 100:.0f}% reduction in repeat rate
    
    3. **Conflict Graph hot spots**: Despite decent overall performance, CG exhibits **concentrated failure patterns** - when it fails to avoid repeats, it tends to fail on the same pairs repeatedly due to its deterministic/greedy nature.
    
    4. **Speed vs. Quality trade-off**: Conflict Graph is ~850× faster than Simulated Annealing (~1.3s vs ~1126s per batch), making it ideal for real-time applications. SA is worth the wait only when perfect teammate variety is critical.
    
    5. **Recommendation**: Use **{_sorted_by_zero[0]['label']}** for quality, or **Conflict Graph** when speed is the priority.
    """)
    return


# =============================================================================
# MATHEMATICAL DEEP DIVE
# =============================================================================


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
    # Calculate key values for the mathematical explanation
    _n = config.get("numPlayers", 20)
    _c = config.get("numCourts", 4)
    _r = config.get("rounds", 10)
    _playing_per_round = _c * 4
    _pairs_per_round = _c * 2  # Each court has 2 teammate pairs
    _total_possible_pairs = _n * (_n - 1) // 2
    
    # For birthday paradox approximation
    _collision_approx = 1 - math.exp(-(_pairs_per_round ** 2) / (2 * _total_possible_pairs))
    
    # For theoretical minimum proof
    _max_leaving = _n - _playing_per_round  # Players who can leave between rounds
    _min_forbidden = _pairs_per_round - _max_leaving  # Best case with optimal benching
    _max_forbidden = _pairs_per_round - (_max_leaving // 2)  # Worst case
    _num_matchings = _playing_per_round - 1  # K_n has (n-1) edge-disjoint perfect matchings
    _transitions = _r - 1  # Number of consecutive round pairs
    
    # For configuration space
    _select_players = math.comb(_n, _playing_per_round)
    _partition_courts = math.factorial(_playing_per_round) // (math.factorial(4) ** _c * math.factorial(_c))
    _pair_per_court = 3
    _pair_all_courts = _pair_per_court ** _c
    _configs_per_round = _select_players * _partition_courts * _pair_all_courts
    
    _math_accordion = mo.accordion({
        "Theoretical Minimum: Zero Repeats is Achievable": mo.md(f"""
### Proof That Zero Repeats is Achievable

$$\\boxed{{\\text{{Theoretical Minimum}} = 0}}$$

**Configuration:**
- N = {_n} total players
- C = {_c} courts per round
- P = {_playing_per_round} players per round (C × 4)
- T = {_pairs_per_round} teammate pairs per round (C × 2)
- R = {_r} rounds → {_transitions} consecutive transitions

**Step 1: Player Overlap (Pigeonhole Principle)**

Between consecutive rounds R and R+1:
- Round R uses {_playing_per_round} players, Round R+1 uses {_playing_per_round} players
- Maximum {_max_leaving} players can leave (and {_max_leaving} new ones join)
- Minimum overlap: $2P - N = 2 \\times {_playing_per_round} - {_n} = {2 * _playing_per_round - _n}$ players

**Step 2: Counting Forbidden Pairs**

A **repeat** occurs when two players who were teammates in Round R are teammates again in Round R+1.

- In Round R, {_pairs_per_round} teammate pairs are formed
- {_max_leaving} players will be benched (not in R+1)
- A pair **cannot** repeat if at least one player is benched

**Forbidden pairs** = pairs where BOTH players return to R+1:

| Benching Strategy | Pairs with ≥1 benched | Forbidden pairs |
|-------------------|----------------------|-----------------|
| **Best case** (1 per pair) | {_max_leaving} pairs | **{_min_forbidden}** |
| **Worst case** (complete pairs) | {_max_leaving // 2} pairs | **{_max_forbidden}** |

**Step 3: Graph Theory - Can We Always Avoid Forbidden Pairs?**

Model as graph: Players = vertices, potential teammate pairs = edges.

The complete graph $K_{{{_playing_per_round}}}$ on {_playing_per_round} players has:
- $\\binom{{{_playing_per_round}}}{{2}} = {_playing_per_round * (_playing_per_round - 1) // 2}$ total edges
- Can be decomposed into **{_num_matchings} edge-disjoint perfect matchings** (theorem for even $n$)

To avoid repeats, we need a perfect matching in $K_{{{_playing_per_round}}}$ that excludes all forbidden edges.

**Proof that this always exists (even in worst case):**
- Each edge appears in exactly ONE of the {_num_matchings} perfect matchings
- Removing a forbidden edge eliminates exactly 1 matching
- **Worst case**: {_max_forbidden} forbidden edges → at least {_num_matchings} - {_max_forbidden} = **{_num_matchings - _max_forbidden}** matchings remain
- Since {_num_matchings - _max_forbidden} > 0, a valid matching **always** exists

**Conclusion:** For each consecutive transition, we can **always** find a pairing that avoids all repeats.
Over {_transitions} transitions, the theoretical minimum is **0 total repeats**.

This proves that Simulated Annealing's 100% zero-repeat rate is not luck—it's achieving the theoretical optimum!
        """),
        
        "Configuration Space: Why Search is Hard": mo.md(f"""
### The Vast Configuration Space

**The Question**: How many *different ways* can we set up one round of badminton?

| Step | What It Means | Formula | How Many Ways |
|------|---------------|---------|---------------|
| **1. Pick who plays** | Choose {_playing_per_round} from {_n} | C({_n},{_playing_per_round}) | {_select_players:,} ways |
| **2. Assign to courts** | Split {_playing_per_round} into {_c} unordered groups of 4 | {_playing_per_round}! / (4!^{_c} × {_c}!) | {_partition_courts:,} ways |
| **3. Form teams** | Pair players on each court | 3^{_c} | {_pair_all_courts:,} ways |
| **Total** | All possible single-round setups | Step 1 × 2 × 3 | **{_configs_per_round:,}** |

**Symmetries Already Accounted For:**
- **Step 2**: Dividing by 4!^{_c} removes ordering within groups; dividing by {_c}! makes courts interchangeable
- **Step 3**: Only 3 distinct pairings per court: {{A,B}} vs {{C,D}}, {{A,C}} vs {{B,D}}, {{A,D}} vs {{B,C}}
  - (A,B) = (B,A) -- pair order doesn't matter
  - AB vs CD = CD vs AB -- team order doesn't matter

**Why This Matters:**
- With **~{_configs_per_round / 1e12:.0f} trillion** possible setups per round, even 5000 simulations explore only a tiny sample
- A **random** algorithm would pick configurations blindly
- Our **smart** algorithms try to pick configurations that minimize repeat teammate pairs
- The fact that SA achieves 100% zero-repeat proves it's navigating this vast space intelligently!

**Search Space Implications:**
- Random sampling has probability ~{1/_configs_per_round:.2e} of hitting any specific configuration
- Monte Carlo's 300 samples explore {300/_configs_per_round * 100:.2e}% of the space
- This is why intelligent search (SA, CG) dramatically outperforms random
        """),
        
        "What is a Perfect Run?": mo.md(f"""
### Definition of a Perfect Run

A **perfect run** occurs when, across all consecutive rounds in a session, **no teammate pair repeats**. 
This means that if players A and B were teammates in round $r$, they must not be teammates again in round $r+1$.

#### The Combinatorial Space

With **{_n} players**, the total number of possible unique teammate pairs is given by the binomial coefficient:

$$\\binom{{{_n}}}{{2}} = \\frac{{{_n}!}}{{2!({_n}-2)!}} = \\frac{{{_n} \\times {_n - 1}}}{{2}} = {_total_possible_pairs} \\text{{ possible pairs}}$$

Each round uses **{_c} courts** with 4 players each, forming **{_pairs_per_round} teammate pairs** per round (2 pairs per court).

#### The Constraint Challenge

For a perfect run across consecutive rounds, round $r+1$ must avoid all {_pairs_per_round} pairs from round $r$. 
This is a **constraint satisfaction problem** where we must select {_pairs_per_round} new pairs from the remaining pool of valid pairs.

The probability space grows dramatically: with {_total_possible_pairs} possible pairs and only {_pairs_per_round} "forbidden" pairs from the previous round, 
the search space has approximately:

$$\\binom{{{_total_possible_pairs} - {_pairs_per_round}}}{{{_pairs_per_round}}} \\approx 10^{{15}} \\text{{ valid configurations}}$$

This vast space makes random search inefficient, but also means **perfect solutions exist** if we search intelligently.
        """),
        
        "Random Baseline: The Birthday Paradox Effect": mo.md(f"""
### Why Random Selection Fails

The random baseline makes no attempt to avoid previous teammate pairs. It simply:
1. Randomly selects {_playing_per_round} players from the pool of {_n}
2. Randomly assigns them to courts
3. Randomly pairs players within each court

#### Birthday Paradox Analogy

The probability of a teammate repeat follows a pattern similar to the **birthday paradox**. 
Just as it's surprisingly likely for two people in a small group to share a birthday, 
it's surprisingly likely for a teammate pair to repeat.

With {_pairs_per_round} pairs generated per round and {_total_possible_pairs} possible pairs, 
the approximate probability of **at least one collision** in a single round transition is:

$$P(\\text{{collision}}) \\approx 1 - e^{{-\\frac{{k^2}}{{2n}}}}$$

where $k = {_pairs_per_round}$ (pairs per round) and $n = {_total_possible_pairs}$ (total possible pairs).

$$P(\\text{{collision}}) \\approx 1 - e^{{-\\frac{{{_pairs_per_round}^2}}{{2 \\times {_total_possible_pairs}}}}} \\approx {_collision_approx:.1%}$$

Over {_r - 1} round transitions, the cumulative probability of experiencing **at least one repeat** grows substantially.

#### The Baseline's Fatal Flaw

The baseline algorithm has **no memory** of previous rounds. Each round is generated independently, 
treating the constraint satisfaction problem as if it doesn't exist. This is why it performs so poorly 
compared to algorithms that explicitly track and avoid previous pairings.
        """),
        
        "Monte Carlo: Sampling the Solution Space": mo.md(f"""
### Monte Carlo Strategy

The Monte Carlo algorithm approaches the problem through **random sampling with evaluation**. 
Rather than blindly accepting any configuration, it generates multiple candidates and selects the best one.

#### The Algorithm

1. **Generate** 300 random candidate assignments
2. **Evaluate** each candidate using a cost function
3. **Select** the candidate with the lowest cost

#### The Cost Function

The cost function penalizes configurations that violate our constraints. For teammate pairs, the cost includes:

$$C_{{\\text{{teammate}}}} = \\sum_{{(i,j) \\in \\text{{pairs}}}} w_t \\cdot \\text{{count}}_{{\\text{{prev}}}}(i,j)$$

where $w_t$ is the teammate repeat penalty weight and $\\text{{count}}_{{\\text{{prev}}}}(i,j)$ is the number of times 
players $i$ and $j$ have been teammates in recent rounds.

#### Why It Works Better Than Random

By sampling 300 candidates and keeping the best, Monte Carlo effectively explores a larger portion of the solution space. 
The probability of finding a zero-cost (perfect) solution in $k$ samples is:

$$P(\\text{{find perfect}}) = 1 - (1 - p_{{\\text{{perfect}}}})^k$$

where $p_{{\\text{{perfect}}}}$ is the probability that a single random sample is perfect. 
Even if $p_{{\\text{{perfect}}}}$ is small, with $k = 300$ samples, the chances improve significantly.

#### Limitation: Local Optima

Monte Carlo samples are independent—it doesn't learn from previous samples. 
If the perfect solutions occupy a small region of the search space, random sampling may miss them entirely.
        """),
        
        "Simulated Annealing: Escaping Local Minima": mo.md(f"""
### Simulated Annealing Strategy

Simulated Annealing (SA) is inspired by the metallurgical process of annealing, 
where controlled cooling allows atoms to settle into a low-energy crystalline structure.

#### The Algorithm

1. **Start** with a random initial solution
2. **Perturb** the current solution (swap players between teams/courts)
3. **Evaluate** the change in cost: $\\Delta C = C_{{\\text{{new}}}} - C_{{\\text{{old}}}}$
4. **Accept** the new solution based on the Metropolis criterion:
   - If $\\Delta C < 0$ (improvement): always accept
   - If $\\Delta C \\geq 0$ (worsening): accept with probability $P = e^{{-\\Delta C / T}}$
5. **Cool** the temperature: $T_{{\\text{{new}}}} = \\alpha \\cdot T_{{\\text{{old}}}}$ where $\\alpha = 0.9995$
6. **Repeat** for 5000 iterations

#### The Temperature Schedule

The temperature $T$ controls exploration vs. exploitation:

- **High $T$ (early)**: Algorithm accepts worse solutions frequently, exploring broadly
- **Low $T$ (late)**: Algorithm becomes greedy, only accepting improvements

The cooling schedule follows:

$$T(t) = T_0 \\cdot \\alpha^t$$

where $T_0 = 100$ (initial temperature) and $\\alpha = 0.9995$ (cooling rate).

#### The Cost Function

SA uses **hard constraints** for teammate repeats:

$$C_{{\\text{{teammate repeat}}}} = 10000 \\cdot \\mathbb{{1}}[\\text{{pair repeated}}]$$

This massive penalty (10,000) effectively makes teammate repetition a **hard constraint**—
the algorithm will almost never accept a solution that repeats a pair.

#### Why SA Excels

The key advantage of SA is its ability to **escape local minima**. Unlike Monte Carlo which samples independently, 
SA builds on previous solutions. The probabilistic acceptance of worse solutions allows it to "climb out" of 
suboptimal regions and eventually find the global optimum.

The mathematical guarantee: as $T \\to 0$ with appropriate cooling, 
SA converges to the global optimum with probability 1 (given infinite time).
        """),
        
        "Conflict Graph: Deterministic Constraint Propagation": mo.md(f"""
### Conflict Graph Strategy

The Conflict Graph (CG) algorithm models the problem as a **graph coloring / constraint satisfaction problem** 
and uses greedy construction with explicit conflict tracking.

#### The Graph Model

The algorithm maintains a **conflict graph** $G = (V, E)$ where:
- **Vertices** $V$: All possible teammate pairs $(i, j)$ where $i < j$
- **Edges** $E$: Connect pairs that share a player (and thus cannot both be used simultaneously)

#### The Greedy Construction

1. **Initialize** conflict weights for all pairs based on history
2. **Sort** available pairs by conflict score (lowest first)
3. **Greedily select** pairs that don't conflict with already-selected pairs
4. **Update** conflict weights after each round

#### The Conflict Score

For each potential pair $(i, j)$, the conflict score combines multiple factors:

$$\\text{{score}}(i, j) = w_1 \\cdot \\text{{teammate\\_history}}(i,j) + w_2 \\cdot \\text{{recent\\_play}}(i,j) + w_3 \\cdot |\\text{{skill}}_i - \\text{{skill}}_j|$$

The algorithm prioritizes pairs with:
- Lower teammate history (haven't played together recently)
- Players who haven't played in recent rounds
- Similar skill levels (for balanced games)

#### Why CG is Fast but Sometimes Suboptimal

Greedy algorithms run in $O(n^2 \\log n)$ time—much faster than SA's $O(5000 \\cdot n)$ iterations. 
However, greedy choices made early can constrain later options. The algorithm finds **a** valid solution quickly, 
but it may not be **the best** solution.

The CG algorithm trades optimality for speed, making it suitable for real-time applications 
where a "good enough" solution immediately is better than the perfect solution later.
        """),
        
        "Comparing the Optimization Levers": mo.md(f"""
### Summary of Optimization Approaches

Each algorithm pulls different "levers" to achieve good solutions:

| Lever | Random | Monte Carlo | Simulated Annealing | Conflict Graph |
|-------|--------|-------------|---------------------|----------------|
| **Memory of past** | None | Yes, via cost function | Yes, via cost function | Yes, via conflict weights |
| **Search strategy** | Pure random | Sample & select best | Iterative improvement | Greedy construction |
| **Escape local minima** | N/A | Limited (independent samples) | Yes, via temperature | No, commits to greedy choices |
| **Hard constraints** | None | Soft penalties | Yes, very high penalties | Yes, explicit conflict check |
| **Iterations** | 1 | 300 | 5000 | 1 (greedy pass) |
| **Time complexity** | $O(n)$ | $O(300 \\cdot n \\log n)$ | $O(5000 \\cdot n)$ | $O(n^2 \\log n)$ |

#### The Mathematical Trade-offs

1. **Exploration vs. Exploitation**
   - More iterations (SA) = better exploration of solution space
   - Greedy (CG) = fast but may miss optimal regions

2. **Soft vs. Hard Constraints**
   - Soft penalties allow flexibility but may accept violations
   - Hard constraints guarantee validity but restrict search space

3. **Independence vs. Correlation**
   - Independent samples (MC) can explore diverse regions
   - Correlated search (SA) builds on good solutions but may get stuck

4. **Theoretical Guarantees**
   - SA: Converges to global optimum (with proper cooling)
   - MC: Finds optimum with probability $1 - (1-p)^k$ in $k$ samples
   - CG: No optimality guarantee, but guaranteed valid solution

The empirical results confirm these theoretical expectations: SA achieves the best performance 
by combining memory of constraints with the ability to escape local minima through controlled randomness.
        """),
    })
    
    _math_accordion
    return


if __name__ == "__main__":
    app.run()
