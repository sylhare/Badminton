"""Common utilities for marimo analysis notebooks."""

from .plotting import setup_matplotlib, fig_to_image
from .stats import proportion_ci
from .bench import calc_theoretical_max, simulate_random_baseline, simulate_baseline_double_bench
from .config_metrics import (
    ALGO_NAMES,
    ALGO_NAMES_SHORT,
    ALGO_COLORS,
    get_time_per_round,
    get_engine_win_diff,
    get_balance_pct,
    get_bench_fairness,
    get_singles_fairness,
    get_bias_score,
    build_configs_by_label,
)
from .analysis import (
    compute_summary_metrics,
    is_adjacent_pair,
    analyze_adjacency_bias,
    compute_teammate_diversity,
    build_repeat_matrix,
    aggregate_bench_stats,
    aggregate_by_player_count,
    compute_balance_metrics,
)

__all__ = [
    # Plotting
    "setup_matplotlib",
    "fig_to_image",
    # Stats
    "proportion_ci",
    # Bench utilities
    "calc_theoretical_max",
    "simulate_random_baseline",
    "simulate_baseline_double_bench",
    # Config metrics
    "ALGO_NAMES",
    "ALGO_NAMES_SHORT",
    "ALGO_COLORS",
    "get_time_per_round",
    "get_engine_win_diff",
    "get_balance_pct",
    "get_bench_fairness",
    "get_singles_fairness",
    "get_bias_score",
    "build_configs_by_label",
    # Analysis
    "compute_summary_metrics",
    "is_adjacent_pair",
    "analyze_adjacency_bias",
    "compute_teammate_diversity",
    "build_repeat_matrix",
    "aggregate_bench_stats",
    "aggregate_by_player_count",
    "compute_balance_metrics",
]
