"""Matplotlib utilities for marimo notebooks."""

from __future__ import annotations

import io
import os
import random
from pathlib import Path
from typing import Any, Union

import numpy as np


def setup_matplotlib(script_path: Union[str, Path]) -> None:
    """Configure matplotlib directories for reliable rendering in marimo.
    
    Args:
        script_path: Path to the calling script (typically __file__)
    """
    script_dir = Path(script_path).parent
    mpl_config_dir = script_dir / ".mplconfig"
    cache_dir = script_dir / ".cache"
    mpl_config_dir.mkdir(exist_ok=True)
    cache_dir.mkdir(exist_ok=True)
    os.environ.setdefault("MPLCONFIGDIR", str(mpl_config_dir))
    os.environ.setdefault("XDG_CACHE_HOME", str(cache_dir))


def fig_to_image(fig: Any, dpi: int = 150, close: bool = True) -> bytes:
    """Convert a matplotlib figure to PNG bytes for display in marimo.
    
    Args:
        fig: Matplotlib figure object
        dpi: Resolution for the output image
        close: Whether to close the figure after conversion
        
    Returns:
        PNG image as bytes
    """
    import matplotlib.pyplot as plt
    
    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", dpi=dpi, bbox_inches="tight", facecolor="white")
    buffer.seek(0)
    if close:
        plt.close(fig)
    return buffer.getvalue()


def add_jitter(values: list[float], scale: float = 1.2, seed: int | None = None) -> list[float]:
    """Add Gaussian jitter to 1D scatter data to prevent point occlusion.
    
    Args:
        values: List of numeric values
        scale: Standard deviation of Gaussian perturbation
        seed: Optional random seed for deterministic jitter
        
    Returns:
        Perturbed float values
    """
    rng = random.Random(seed) if seed is not None else random
    return [v + rng.gauss(0, scale) for v in values]


def create_radar_chart(
    categories: list[str],
    series_data: list[tuple[str, list[float], str]],
    title: str = "Algorithm Comparison",
    figsize: tuple[float, float] = (5.0, 5.0),
    max_val: float = 105.0,
) -> tuple[Any, Any]:
    """Build a multi-series radar chart figure and polar axis.
    
    Args:
        categories: Labels for radial axes
        series_data: List of (label, values, hex_color) tuples
        title: Chart title
        figsize: Matplotlib figure dimensions
        max_val: Radial axis maximum limit
        
    Returns:
        Tuple of (fig, ax)
    """
    import matplotlib.pyplot as plt

    n_cats = len(categories)
    angles = [n / float(n_cats) * 2 * np.pi for n in range(n_cats)]
    angles += angles[:1]

    fig, ax = plt.subplots(figsize=figsize, subplot_kw=dict(projection="polar"))

    for label, values, color in series_data:
        closed_values = values + values[:1]
        ax.plot(angles, closed_values, "-", linewidth=1.5, label=label, color=color)
        ax.fill(angles, closed_values, alpha=0.15, color=color)

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(categories, fontsize=8)
    ax.set_ylim(0, max_val)
    ax.set_yticks([20, 40, 60, 80, 100])
    ax.set_yticklabels(["20", "40", "60", "80", "100"], fontsize=6)
    ax.spines["polar"].set_visible(False)
    ax.set_title(title, fontsize=10, fontweight="bold", y=1.05)
    ax.legend(loc="upper left", bbox_to_anchor=(-0.3, 1.15), fontsize=7, frameon=False)

    return fig, ax

