"""Matplotlib utilities for marimo notebooks."""

import io
import os
from pathlib import Path


def setup_matplotlib(script_path: str | Path) -> None:
    """
    Configure matplotlib directories for reliable rendering in marimo.
    
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


def fig_to_image(fig, dpi: int = 150, close: bool = True) -> bytes:
    """
    Convert a matplotlib figure to PNG bytes for display in marimo.
    
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
