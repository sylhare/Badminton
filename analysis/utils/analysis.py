"""Data analysis utilities for badminton simulation results."""

import math
from typing import Any

import numpy as np

try:
    import polars as pl
except ImportError:
    pl = None


def compute_summary_metrics(df: "pl.DataFrame", label: str) -> dict[str, Any]:
    """Compute summary metrics for an algorithm from its summary DataFrame.
    
    Args:
        df: Summary DataFrame with repeatAnyPair and repeatPairDifferentOpponentsCount columns
        label: Algorithm label for the result dict
        
    Returns:
        Dict with metrics: label, runs, p_any_repeat, ci_any_low, ci_any_high,
        avg_repeat_pairs, zero_repeat_pct
    """
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


def is_adjacent_pair(pair_id: str) -> bool:
    """Check if a pair has consecutive player IDs.
    
    Args:
        pair_id: Pair ID in format "P1|P2"
        
    Returns:
        True if player IDs are consecutive (e.g., P1|P2, P5|P6)
    """
    parts = pair_id.split("|")
    p1_num = int(parts[0][1:])
    p2_num = int(parts[1][1:])
    return abs(p1_num - p2_num) == 1


def analyze_adjacency_bias(events_df: "pl.DataFrame", label: str) -> dict[str, Any]:
    """Analyze adjacent vs non-adjacent pair repeat frequencies.
    
    Args:
        events_df: DataFrame with pairId column
        label: Algorithm label
        
    Returns:
        Dict with adjacency bias metrics
    """
    if events_df.height == 0:
        return {
            "algorithm": label,
            "adjacent_events": 0,
            "nonadjacent_events": 0,
            "adjacent_pairs": 0,
            "nonadjacent_pairs": 0,
            "adj_avg": 0,
            "nonadj_avg": 0,
            "bias_ratio": 0,
        }
    
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


def compute_teammate_diversity(match_events_df: "pl.DataFrame") -> dict[str, Any]:
    """Compute unique teammate counts per player per session.
    
    Args:
        match_events_df: DataFrame with simulationId, team1Players, team2Players columns
        
    Returns:
        Dict with diversity metrics: avg, min, max, all_player_counts, session_avgs
    """
    session_teammates: dict[Any, dict[str, set[str]]] = {}
    
    for row in match_events_df.iter_rows(named=True):
        session_key = row["simulationId"]
        if session_key not in session_teammates:
            session_teammates[session_key] = {}
        
        player_map = session_teammates[session_key]
        
        team1 = row["team1Players"].split("|")
        team2 = row["team2Players"].split("|")
        
        # Process team1 (only doubles - 2 players are teammates)
        if len(team1) == 2:
            p1, p2 = team1
            player_map.setdefault(p1, set()).add(p2)
            player_map.setdefault(p2, set()).add(p1)
        
        # Process team2 (only doubles)
        if len(team2) == 2:
            p1, p2 = team2
            player_map.setdefault(p1, set()).add(p2)
            player_map.setdefault(p2, set()).add(p1)
    
    session_diversity = []
    for sim_id, player_teammates in session_teammates.items():
        if player_teammates:
            unique_counts = [len(teammates) for teammates in player_teammates.values()]
            session_diversity.append({
                "simulationId": sim_id,
                "avg_unique_teammates": np.mean(unique_counts),
                "min_unique_teammates": min(unique_counts),
                "max_unique_teammates": max(unique_counts),
                "all_unique_counts": unique_counts,
            })
    
    if not session_diversity:
        return {"avg": 0, "min": 0, "max": 0, "all_player_counts": [], "session_avgs": []}
    
    all_player_counts = [c for s in session_diversity for c in s["all_unique_counts"]]
    return {
        "avg": np.mean([s["avg_unique_teammates"] for s in session_diversity]),
        "min": np.mean([s["min_unique_teammates"] for s in session_diversity]),
        "max": np.mean([s["max_unique_teammates"] for s in session_diversity]),
        "all_player_counts": all_player_counts,
        "session_avgs": [s["avg_unique_teammates"] for s in session_diversity],
    }


def build_repeat_matrix(events_df: "pl.DataFrame", player_count: int) -> np.ndarray:
    """Build matrix showing repeat counts per pair.
    
    Args:
        events_df: DataFrame with pairId column
        player_count: Number of players (matrix dimension)
        
    Returns:
        Symmetric matrix where [i,j] = repeat count for pair Pi+1, Pj+1
    """
    matrix = np.zeros((player_count, player_count))
    if events_df.height == 0:
        return matrix
    
    pair_counts = events_df.group_by("pairId").len().to_dicts()
    for row in pair_counts:
        pair_id = row["pairId"]
        count = row["len"]
        parts = pair_id.split("|")
        p1_idx = int(parts[0][1:]) - 1
        p2_idx = int(parts[1][1:]) - 1
        matrix[p1_idx, p2_idx] = count
        matrix[p2_idx, p1_idx] = count
    return matrix


def aggregate_bench_stats(df: "pl.DataFrame") -> dict[str, Any]:
    """Aggregate pre-computed bench gap statistics.
    
    Args:
        df: Bench stats DataFrame with meanGap, doubleBenchCount, totalGapEvents columns
        
    Returns:
        Dict with mean_gap, double_bench_count, total_bench_events, double_bench_rate
    """
    if "meanGap" in df.columns:
        total_double = df.get_column("doubleBenchCount").sum()
        total_events = df.get_column("totalGapEvents").sum()
        mean_gap = df.get_column("meanGap").mean()
        return {
            "mean_gap": mean_gap,
            "double_bench_count": total_double,
            "total_bench_events": total_events,
            "double_bench_rate": (total_double / total_events * 100) if total_events > 0 else 0,
        }
    return {"mean_gap": 4.0, "double_bench_count": 0, "total_bench_events": 1, "double_bench_rate": 0}


def aggregate_by_player_count(df: "pl.DataFrame") -> dict[int, dict[str, Any]]:
    """Aggregate bench stats grouped by player count.
    
    Args:
        df: Bench stats DataFrame with numPlayers column
        
    Returns:
        Dict mapping player count to stats dict with mean_gap, double_bench_rate, total_events
    """
    if "numPlayers" not in df.columns:
        return {}
    result = {}
    for num_players in df.get_column("numPlayers").unique().sort().to_list():
        subset = df.filter(pl.col("numPlayers") == num_players)
        total_events = subset.get_column("totalGapEvents").sum()
        total_double = subset.get_column("doubleBenchCount").sum()
        with_events = subset.filter(pl.col("totalGapEvents") > 0)
        mean_gap = with_events.get_column("meanGap").mean() if with_events.height > 0 else 0
        result[num_players] = {
            "mean_gap": mean_gap if mean_gap else 0,
            "double_bench_rate": (total_double / total_events * 100) if total_events > 0 else 0,
            "total_events": total_events,
        }
    return result


def compute_balance_metrics(
    match_df: "pl.DataFrame",
    player_df: "pl.DataFrame",
    config: dict,
    label: str,
    player_profiles: dict | None = None,
) -> dict[str, Any]:
    """Compute balance metrics from simulation data.
    
    Args:
        match_df: Match events DataFrame
        player_df: Player stats DataFrame
        config: Algorithm config dict
        label: Algorithm label
        player_profiles: Optional player profile dict for skill calculation
        
    Returns:
        Dict with balance metrics
    """
    balance_stats = config.get("balanceStats", {})
    player_profiles = player_profiles or config.get("playerProfiles", {})
    
    strength_diffs = match_df.get_column("strengthDifferential").to_numpy()
    stronger_won = match_df.get_column("strongerTeamWon").cast(pl.Int8).to_numpy()
    
    win_counts = dict(zip(
        player_df.get_column("playerId").to_list(),
        player_df.get_column("totalWins").to_list()
    ))
    loss_counts = dict(zip(
        player_df.get_column("playerId").to_list(),
        player_df.get_column("totalLosses").to_list()
    ))
    
    # Calculate Gini coefficient for win distribution
    wins_array = np.array(list(win_counts.values()))
    wins_sorted = np.sort(wins_array)
    n = len(wins_sorted)
    total_wins = np.sum(wins_sorted)
    if total_wins > 0:
        gini = (2 * np.sum((np.arange(1, n + 1)) * wins_sorted) - (n + 1) * total_wins) / (n * total_wins)
    else:
        gini = 0
    
    # Calculate skill pairing cost from match events
    pairing_costs = []
    for row in match_df.iter_rows(named=True):
        t1_players = row["team1Players"].split("|")
        t2_players = row["team2Players"].split("|")
        
        if len(t1_players) >= 2:
            t1_cost = (
                player_profiles.get(t1_players[0], {}).get("level", 3) *
                player_profiles.get(t1_players[1], {}).get("level", 3)
            )
        else:
            t1_cost = player_profiles.get(t1_players[0], {}).get("level", 3) ** 2
            
        if len(t2_players) >= 2:
            t2_cost = (
                player_profiles.get(t2_players[0], {}).get("level", 3) *
                player_profiles.get(t2_players[1], {}).get("level", 3)
            )
        else:
            t2_cost = player_profiles.get(t2_players[0], {}).get("level", 3) ** 2
        pairing_costs.append(t1_cost + t2_cost)
    
    return {
        "algorithm": label,
        "avg_skill_differential": balance_stats.get("avgStrengthDifferential", np.mean(strength_diffs)),
        "std_skill_differential": np.std(strength_diffs),
        "avg_pairing_cost": np.mean(pairing_costs) if pairing_costs else 0,
        "stronger_team_win_rate": balance_stats.get("strongerTeamWinRate", np.mean(stronger_won) * 100) / 100,
        "perfectly_balanced_rate": balance_stats.get("perfectlyBalancedRate", 0) / 100,
        "gini_coefficient": gini,
        "win_distribution": win_counts,
        "loss_distribution": loss_counts,
        "skill_differentials": strength_diffs.tolist(),
        "pairing_costs": pairing_costs,
        "total_matches": balance_stats.get("totalMatches", len(match_df)),
    }
