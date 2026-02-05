"""Algorithm constants and config metric extraction utilities."""

from typing import Any

# Standard algorithm display order and colors
ALGO_NAMES = ["Monte Carlo", "Simulated Annealing", "Conflict Graph", "Random Baseline"]
ALGO_NAMES_SHORT = ["MC", "SA", "CG", "Random"]
ALGO_COLORS = ["#4C78A8", "#54A24B", "#F58518", "#E45756"]


def get_time_per_round(cfg: dict[str, Any]) -> float:
    """Extract time per round in ms from config.
    
    Args:
        cfg: Algorithm config dict with timing info
        
    Returns:
        Milliseconds per round, minimum 0.01
    """
    total_ms = cfg.get("timing", {}).get("totalMs", 0)
    total_sims = cfg.get("totalSimulations", 1)
    rounds = cfg.get("rounds", 10)
    if total_ms == 0:
        return 0.01
    return total_ms / (total_sims * rounds)


def get_engine_win_diff(cfg: dict[str, Any]) -> float:
    """Extract average engine-tracked win differential from config."""
    return cfg.get("engineTrackedBalance", {}).get("avgEngineWinDifferential", 0)


def get_balance_pct(cfg: dict[str, Any]) -> float:
    """Convert win differential to balance percentage.
    
    Args:
        cfg: Algorithm config dict
        
    Returns:
        Balance percentage: 0 diff = 100%, 2.0 diff = 0%
    """
    diff = get_engine_win_diff(cfg)
    max_diff = 2.0
    return max(0, 100 * (1 - diff / max_diff))


def get_bench_fairness(cfg: dict[str, Any]) -> float:
    """Compute compound bench fairness score.
    
    Combines two components equally weighted:
    - No double benches (100 - doubleBenchRate)
    - Fair distribution (based on avgBenchRange)
    
    Args:
        cfg: Algorithm config dict
        
    Returns:
        Bench fairness score 0-100
    """
    bench = cfg.get("benchFairness", {})
    double_bench_rate = bench.get("doubleBenchRate", 0)
    avg_bench_range = bench.get("avgBenchRange", 0)
    
    # Component 1: No double benches (0% rate = 100 score)
    no_double_score = 100 - double_bench_rate
    
    # Component 2: Fair distribution (bench range 0 = 100, range 5+ = 0)
    max_range = 5.0
    distribution_score = max(0, 100 * (1 - avg_bench_range / max_range))
    
    return (no_double_score + distribution_score) / 2


def get_singles_fairness(cfg: dict[str, Any]) -> float | None:
    """Compute singles fairness score.
    
    Combines two components equally weighted:
    - No back-to-back singles (100 - doubleSinglesRate * 2.5)
    - No repeat opponents (100 - repeatOpponentRate * 3.33)
    
    Args:
        cfg: Algorithm config dict
        
    Returns:
        Singles fairness score 0-100, or None if no singles data
    """
    singles = cfg.get("singlesFairness", {})
    if not singles or singles.get("totalSinglesMatches", 0) == 0:
        return None
    double_rate = singles.get("doubleSinglesRate", 0)
    repeat_rate = singles.get("repeatOpponentRate", 0)
    no_double_score = max(0, 100 - double_rate * 2.5)
    no_repeat_score = max(0, 100 - repeat_rate * 3.33)
    return (no_double_score + no_repeat_score) / 2


def get_bias_score(bias_ratio: float) -> float:
    """Convert bias ratio to score (100 = no bias, 0 = 100% extra bias).
    
    Args:
        bias_ratio: Ratio of adjacent to non-adjacent pair repeats
        
    Returns:
        Bias score 0-100
    """
    if bias_ratio <= 0:
        return 100
    return max(0, 100 - (bias_ratio - 1) * 100)


def build_configs_by_label(
    mc_config: dict,
    sa_config: dict,
    cg_config: dict,
    random_config: dict,
) -> dict[str, dict]:
    """Build a mapping of algorithm label to config.
    
    Args:
        mc_config: Monte Carlo config
        sa_config: Simulated Annealing config
        cg_config: Conflict Graph config
        random_config: Random Baseline config
        
    Returns:
        Dict mapping algorithm name to config
    """
    return {
        "Monte Carlo": mc_config,
        "Simulated Annealing": sa_config,
        "Conflict Graph": cg_config,
        "Random Baseline": random_config,
    }
