"""Common utilities for marimo analysis notebooks."""

from .plotting import setup_matplotlib, fig_to_image
from .stats import proportion_ci
from .bench import calc_theoretical_max, simulate_random_baseline, simulate_baseline_double_bench

__all__ = [
    "setup_matplotlib",
    "fig_to_image",
    "proportion_ci",
    "calc_theoretical_max",
    "simulate_random_baseline",
    "simulate_baseline_double_bench",
]
