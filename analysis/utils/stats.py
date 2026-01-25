"""Statistical utilities for analysis notebooks."""

import math
from typing import Any

try:
    import polars as pl
except ImportError:
    pl = None


def proportion_ci(series: Any, z: float = 1.96) -> tuple[float, float, float]:
    """
    Calculate proportion and confidence interval for a binary series.
    
    Args:
        series: A polars Series of binary values (0/1 or bool)
        z: Z-score for confidence level (default 1.96 for 95% CI)
        
    Returns:
        Tuple of (proportion, ci_low, ci_high)
    """
    n = series.len()
    if n == 0:
        return 0.0, 0.0, 0.0
    p = series.mean()
    se = math.sqrt(p * (1 - p) / n)
    return p, max(0.0, p - z * se), min(1.0, p + z * se)
