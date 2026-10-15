"""Statistical utilities for analysis notebooks."""

import math
from typing import Any

import numpy as np

try:
    import polars as pl
except ImportError:
    pl = None


def proportion_ci(series: Any, z: float = 1.96) -> tuple[float, float, float]:
    """Calculate proportion and confidence interval for a binary series.
    
    Args:
        series: A polars Series, list, or array of binary values (0/1 or bool)
        z: Z-score for confidence level (default 1.96 for 95% CI)
        
    Returns:
        Tuple of (proportion, ci_low, ci_high)
    """
    n = series.len() if hasattr(series, "len") else len(series)
    if n == 0:
        return 0.0, 0.0, 0.0
    p = float(series.mean()) if hasattr(series, "mean") else float(sum(series) / n)
    se = math.sqrt(p * (1.0 - p) / n) if p > 0 else 0.0
    return p, max(0.0, p - z * se), min(1.0, p + z * se)


def gini_coefficient(values: Any) -> float:
    """Calculate Gini coefficient for a distribution of values.
    
    Args:
        values: Sequence of numeric values (e.g. win counts)
        
    Returns:
        Gini coefficient between 0.0 (perfect equality) and 1.0 (maximum inequality)
    """
    arr = np.asarray(values, dtype=float)
    if arr.size == 0:
        return 0.0
    sorted_arr = np.sort(arr)
    n = len(sorted_arr)
    total = float(np.sum(sorted_arr))
    if total <= 0:
        return 0.0
    return float((2.0 * np.sum(np.arange(1, n + 1) * sorted_arr) - (n + 1) * total) / (n * total))

