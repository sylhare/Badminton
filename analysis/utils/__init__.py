"""Common utilities for marimo analysis notebooks."""

from .plotting import setup_matplotlib, fig_to_image
from .stats import proportion_ci

__all__ = [
    "setup_matplotlib",
    "fig_to_image",
    "proportion_ci",
]
