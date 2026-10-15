"""Data analysis utilities for badminton simulation results."""

from typing import Any

import numpy as np

try:
    import polars as pl
except ImportError:
    pl = None

from .stats import gini_coefficient, proportion_ci


def compute_summary_metrics(df: "pl.DataFrame", label: str) -> dict[str, Any]:
    """Compute summary metrics for an algorithm from its summary DataFrame.
    
    Args:
        df: Summary DataFrame with repeatAnyPair and repeatPairCount columns
        label: Algorithm label for the result dict
        
    Returns:
        Dict with metrics: label, runs, p_any_repeat, ci_any_low, ci_any_high,
        avg_repeat_pairs, zero_repeat_pct
    """
    n = df.height
    if n == 0:
        return {"label": label, "runs": 0}

    any_repeat = df.get_column("repeatAnyPair").cast(pl.Int8)
    repeat_count = (
        df.get_column("repeatPairCount")
        if "repeatPairCount" in df.columns
        else df.get_column("repeatPairDifferentOpponentsCount")
    )

    p_any, ci_low, ci_high = proportion_ci(any_repeat)

    return {
        "label": label,
        "runs": n,
        "p_any_repeat": p_any,
        "ci_any_low": ci_low,
        "ci_any_high": ci_high,
        "avg_repeat_pairs": float(repeat_count.mean()),
        "zero_repeat_pct": float((repeat_count == 0).sum() / n),
    }


def compute_zero_repeat_pct(
    summary_df: "pl.DataFrame",
    col_name: str | None = None,
) -> float:
    """Compute percentage of runs with zero repeats.
    
    Args:
        summary_df: Summary DataFrame
        col_name: Column to check for zero repeats
        
    Returns:
        Percentage of zero-repeat runs (0.0 to 100.0)
    """
    if summary_df.height == 0:
        return 0.0
    target_col = col_name
    if target_col is None:
        target_col = (
            "repeatPairCount"
            if "repeatPairCount" in summary_df.columns
            else "repeatPairDifferentOpponentsCount"
        )
    if target_col not in summary_df.columns:
        return 0.0
    s = summary_df.get_column(target_col)
    return float((s == 0).sum() / summary_df.height * 100)


def compute_repeat_counts(
    summary_df: "pl.DataFrame",
    col_name: str | None = None,
) -> dict[int, int]:
    """Compute frequency mapping of repeat pair counts from summary DataFrame.
    
    Args:
        summary_df: Summary DataFrame
        col_name: Column to aggregate
        
    Returns:
        Dict mapping repeat count to number of sessions
    """
    if summary_df.height == 0:
        return {}

    target_col = col_name
    if target_col is None:
        target_col = (
            "repeatPairCount"
            if "repeatPairCount" in summary_df.columns
            else "repeatPairDifferentOpponentsCount"
        )

    if target_col not in summary_df.columns:
        return {}

    vc = summary_df.get_column(target_col).value_counts().sort(target_col)
    count_col = "count" if "count" in vc.columns else vc.columns[1]
    return dict(zip(vc.get_column(target_col).to_list(), vc.get_column(count_col).to_list()))


def player_id_to_index(player_id: str) -> int:
    """Extract zero-based integer index from player ID string (e.g. 'P1' -> 0)."""
    return int(player_id[1:]) - 1


def player_labels(player_count: int) -> list[str]:
    """Generate display labels for player count (e.g. ['P1', 'P2', ...])."""
    return [f"P{i + 1}" for i in range(player_count)]


def extract_max_player_count(
    dfs: list["pl.DataFrame"],
    pair_col: str = "pairId",
) -> int:
    """Determine highest player count from pair IDs across multiple DataFrames."""
    max_idx = -1
    for df in dfs:
        if df.height == 0 or pair_col not in df.columns:
            continue
        for row in df.select(pair_col).iter_rows():
            parts = row[0].split("|")
            for part in parts:
                if part.startswith("P") and part[1:].isdigit():
                    max_idx = max(max_idx, player_id_to_index(part))
    return max_idx + 1 if max_idx >= 0 else 0


def is_adjacent_pair(pair_id: str) -> bool:
    """Check if a pair has consecutive player IDs.
    
    Args:
        pair_id: Pair ID in format 'P1|P2'
        
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

        if len(team1) == 2:
            p1, p2 = team1
            player_map.setdefault(p1, set()).add(p2)
            player_map.setdefault(p2, set()).add(p1)

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
                "avg_unique_teammates": float(np.mean(unique_counts)),
                "min_unique_teammates": min(unique_counts),
                "max_unique_teammates": max(unique_counts),
                "all_unique_counts": unique_counts,
            })

    if not session_diversity:
        return {"avg": 0, "min": 0, "max": 0, "all_player_counts": [], "session_avgs": []}

    all_player_counts = [c for s in session_diversity for c in s["all_unique_counts"]]
    return {
        "avg": float(np.mean([s["avg_unique_teammates"] for s in session_diversity])),
        "min": float(np.mean([s["min_unique_teammates"] for s in session_diversity])),
        "max": float(np.mean([s["max_unique_teammates"] for s in session_diversity])),
        "all_player_counts": all_player_counts,
        "session_avgs": [s["avg_unique_teammates"] for s in session_diversity],
    }


def _canonical_match_key(team1_players: str, team2_players: str) -> str:
    """Return a canonical string key for a match regardless of team or player order."""
    t1 = tuple(sorted(team1_players.split("|")))
    t2 = tuple(sorted(team2_players.split("|")))
    if t1 > t2:
        t1, t2 = t2, t1
    return f"{','.join(t1)}|{','.join(t2)}"


def compute_match_session_frequency(match_events_df: "pl.DataFrame") -> dict[str, Any]:
    """Compute how often the same match configuration repeats across sessions.
    
    Args:
        match_events_df: DataFrame with simulationId, team1Players, team2Players columns
        
    Returns:
        Dict with keys: counts, total_unique_matches, total_sessions,
        unique_only_pct, repeat_pct, max_sessions
    """
    session_matches: dict[Any, set[str]] = {}

    for row in match_events_df.iter_rows(named=True):
        session_key = row["simulationId"]
        key = _canonical_match_key(row["team1Players"], row["team2Players"])
        session_matches.setdefault(session_key, set()).add(key)

    match_session_counts: dict[str, int] = {}
    for matches in session_matches.values():
        for match_key in matches:
            match_session_counts[match_key] = match_session_counts.get(match_key, 0) + 1

    counts = list(match_session_counts.values())
    total = len(counts) or 1

    return {
        "counts": counts,
        "total_unique_matches": len(counts),
        "total_sessions": len(session_matches),
        "unique_only_pct": sum(1 for c in counts if c == 1) / total * 100,
        "repeat_pct": sum(1 for c in counts if c > 1) / total * 100,
        "max_sessions": max(counts) if counts else 0,
    }


def build_repeat_matrix(
    df: "pl.DataFrame",
    player_count: int,
    count_col: str | None = None,
) -> np.ndarray:
    """Build symmetric matrix showing repeat or partner counts per pair.
    
    Args:
        df: DataFrame with pairId column
        player_count: Number of players (matrix dimension)
        count_col: Specific column to read counts from (e.g. 'asTeammate').
                   If None and df is an unaggregated events DataFrame, rows
                   are grouped by pairId and counted.
        
    Returns:
        Symmetric matrix where [i,j] = count for pair Pi+1, Pj+1
    """
    matrix = np.zeros((player_count, player_count))
    if df.height == 0 or player_count == 0:
        return matrix

    col_to_use = count_col
    if col_to_use is None and "asTeammate" in df.columns:
        col_to_use = "asTeammate"

    if col_to_use and col_to_use in df.columns:
        for row in df.iter_rows(named=True):
            parts = row["pairId"].split("|")
            if len(parts) == 2:
                p1_idx = player_id_to_index(parts[0])
                p2_idx = player_id_to_index(parts[1])
                val = row[col_to_use]
                if p1_idx < player_count and p2_idx < player_count:
                    matrix[p1_idx, p2_idx] = val
                    matrix[p2_idx, p1_idx] = val
        return matrix

    pair_counts = df.group_by("pairId").len().to_dicts()
    for row in pair_counts:
        pair_id = row["pairId"]
        count = row["len"]
        parts = pair_id.split("|")
        if len(parts) == 2:
            p1_idx = player_id_to_index(parts[0])
            p2_idx = player_id_to_index(parts[1])
            if p1_idx < player_count and p2_idx < player_count:
                matrix[p1_idx, p2_idx] = count
                matrix[p2_idx, p1_idx] = count
    return matrix


def compute_court_freshness_scores(match_df: "pl.DataFrame") -> list[int]:
    """Compute number of new court-mates between consecutive rounds for each player.
    
    Args:
        match_df: DataFrame with simulationId, roundIndex, team1Players, team2Players
        
    Returns:
        List of integer scores (0 to 3) representing new court-mates per transition
    """
    scores: list[int] = []
    if match_df.height == 0:
        return scores

    sim_ids = match_df.get_column("simulationId").unique().sort().to_list()
    for sid in sim_ids:
        sim = match_df.filter(pl.col("simulationId") == sid)
        hist: dict[str, list[tuple[int, frozenset[str]]]] = {}
        for row in sim.iter_rows(named=True):
            court = set(row["team1Players"].split("|") + row["team2Players"].split("|"))
            r_idx = row["roundIndex"]
            for p in court:
                hist.setdefault(p, []).append((r_idx, frozenset(court - {p})))
        for rounds in hist.values():
            rounds.sort(key=lambda x: x[0])
            for i in range(1, len(rounds)):
                scores.append(len(rounds[i][1] - rounds[i - 1][1]))
    return scores


def compute_variety_distribution(
    match_df: "pl.DataFrame",
    max_score: int = 3,
) -> tuple[list[float], float]:
    """Compute percentage distribution and average of new court-mates.
    
    Args:
        match_df: Match events DataFrame
        max_score: Maximum score bucket to include (default 3)
        
    Returns:
        Tuple of (percentage list for 0..max_score, average score)
    """
    scores = compute_court_freshness_scores(match_df)
    n = len(scores)
    if n == 0:
        return [0.0] * (max_score + 1), 0.0

    counts: dict[int, int] = {}
    for s in scores:
        counts[s] = counts.get(s, 0) + 1

    limit = max(max_score, max(counts.keys()) if counts else 0)
    pcts = [counts.get(k, 0) / n * 100 for k in range(limit + 1)]
    avg = sum(scores) / n
    return pcts, avg


def compute_court_cooccurrences(match_df: "pl.DataFrame") -> list[int]:
    """Compute how many rounds player pairs share a court within each session.
    
    Args:
        match_df: DataFrame with simulationId, team1Players, team2Players
        
    Returns:
        List of session-level co-occurrence counts for all pairs
    """
    all_counts: list[int] = []
    if match_df.height == 0:
        return all_counts

    sim_ids = match_df.get_column("simulationId").unique().sort().to_list()
    for sid in sim_ids:
        sim = match_df.filter(pl.col("simulationId") == sid)
        pair_counts: dict[str, int] = {}
        for row in sim.iter_rows(named=True):
            court = sorted(set(row["team1Players"].split("|") + row["team2Players"].split("|")))
            for i in range(len(court)):
                for j in range(i + 1, len(court)):
                    key = f"{court[i]}|{court[j]}"
                    pair_counts[key] = pair_counts.get(key, 0) + 1
        all_counts.extend(pair_counts.values())
    return all_counts


def compute_partnership_rate_buckets(
    pairs_df: "pl.DataFrame",
    total_sims: int,
    count_col: str = "asTeammate",
) -> tuple[list[str], list[float]]:
    """Compute partnership rate buckets across simulations.
    
    Args:
        pairs_df: DataFrame with pair partnership records
        total_sims: Total number of simulated sessions
        count_col: Column with partnership count
        
    Returns:
        Tuple of (bucket_labels, percentages)
    """
    labels = ["< 0.25×", "0.25–0.50×", "0.50–0.75× (optimal)", "0.75–1.00×", "≥ 1.00×"]
    if pairs_df.height == 0 or total_sims <= 0 or count_col not in pairs_df.columns:
        return labels, [0.0] * len(labels)

    rates = [v / total_sims for v in pairs_df[count_col].to_list()]
    n = len(rates)
    if n == 0:
        return labels, [0.0] * len(labels)

    pcts = [
        sum(1 for r in rates if r < 0.25) / n * 100,
        sum(1 for r in rates if 0.25 <= r < 0.50) / n * 100,
        sum(1 for r in rates if 0.50 <= r < 0.75) / n * 100,
        sum(1 for r in rates if 0.75 <= r < 1.00) / n * 100,
        sum(1 for r in rates if r >= 1.00) / n * 100,
    ]
    return labels, pcts


def compute_differential_buckets(
    diffs: list[int | float] | "pl.Series",
) -> tuple[list[str], list[float]]:
    """Compute percentage distribution for strength differentials.
    
    Args:
        diffs: Sequence of differential values
        
    Returns:
        Tuple of (labels, percentages)
    """
    labels = ["diff = 0", "diff = 1", "diff = 2", "diff ≥ 3"]
    vals = diffs.to_list() if hasattr(diffs, "to_list") else list(diffs)
    n = len(vals)
    if n == 0:
        return labels, [0.0, 0.0, 0.0, 0.0]
    pcts = [
        vals.count(0) / n * 100,
        vals.count(1) / n * 100,
        vals.count(2) / n * 100,
        sum(1 for x in vals if x >= 3) / n * 100,
    ]
    return labels, pcts


def compute_team_stats(match_df: "pl.DataFrame") -> "pl.DataFrame":
    """Extract intra-team gap and opponent advantage for each team in match events.
    
    Args:
        match_df: DataFrame with team1IntraGap, team2IntraGap, team1AvgLevel, team2AvgLevel
        
    Returns:
        DataFrame with intra_gap, team_avg, opp_avg, opp_advantage
    """
    t1 = match_df.select([
        pl.col("team1IntraGap").alias("intra_gap"),
        pl.col("team1AvgLevel").alias("team_avg"),
        pl.col("team2AvgLevel").alias("opp_avg"),
        (pl.col("team2AvgLevel") - pl.col("team1AvgLevel")).alias("opp_advantage"),
    ])
    t2 = match_df.select([
        pl.col("team2IntraGap").alias("intra_gap"),
        pl.col("team2AvgLevel").alias("team_avg"),
        pl.col("team1AvgLevel").alias("opp_avg"),
        (pl.col("team1AvgLevel") - pl.col("team2AvgLevel")).alias("opp_advantage"),
    ])
    return pl.concat([t1, t2])


def compute_danger_zone_pct(
    teams_df: "pl.DataFrame",
    gap_threshold: float = 40.0,
    adv_threshold: float = 20.0,
) -> float:
    """Calculate percentage of team slots that fall in the danger zone.
    
    Args:
        teams_df: DataFrame with intra_gap and opp_advantage
        gap_threshold: Intra-team gap threshold
        adv_threshold: Opponent advantage threshold
        
    Returns:
        Percentage of team slots in danger zone (0.0 to 100.0)
    """
    if teams_df.height == 0:
        return 0.0
    bad = teams_df.filter(
        (pl.col("intra_gap") >= gap_threshold) | (pl.col("opp_advantage").abs() >= adv_threshold)
    )
    return float(bad.height / teams_df.height * 100)


def build_level_heat_matrix(
    teams_df: "pl.DataFrame",
    levels: list[int] | None = None,
) -> list[list[int]]:
    """Build a 2D matrix of team avg level vs opponent avg level match counts.
    
    Args:
        teams_df: DataFrame with team_avg and opp_avg
        levels: List of discrete level values to include
        
    Returns:
        2D list where [y][x] corresponds to counts for levels[x] vs levels[y]
    """
    avgs = levels if levels is not None else [20, 30, 40, 50, 60, 70, 80, 90, 100]
    m = len(avgs)
    mat = [[0] * m for _ in range(m)]
    if teams_df.height == 0:
        return mat

    df = teams_df.with_columns([
        pl.col("team_avg").cast(pl.Int32).alias("ta"),
        pl.col("opp_avg").cast(pl.Int32).alias("oa"),
    ])
    counts = df.group_by(["ta", "oa"]).agg(pl.len().alias("n"))
    for row in counts.iter_rows(named=True):
        if row["ta"] in avgs and row["oa"] in avgs:
            xi = avgs.index(row["ta"])
            yi = avgs.index(row["oa"])
            mat[yi][xi] = row["n"]
    return mat


def compute_gender_matchup_distribution(
    match_df: "pl.DataFrame",
    sex_pattern: list[str] | None = None,
) -> dict[str, float]:
    """Calculate percentage breakdown of match gender compositions.
    
    Args:
        match_df: DataFrame with team1Players and team2Players
        sex_pattern: Repeating sex sequence for player IDs
        
    Returns:
        Dict mapping matchup strings to percentage of matches
    """
    pattern = sex_pattern or ["M", "M", "F", "M", "F"]

    def player_sex(pid: str) -> str:
        idx = player_id_to_index(pid)
        return pattern[idx % len(pattern)]

    def team_type(ids: list[str]) -> str:
        sexes = [player_sex(p) for p in ids]
        known = [s for s in sexes if s in ("M", "F")]
        if len(known) < 2:
            return "U"
        if all(s == "M" for s in known):
            return "MM"
        if all(s == "F" for s in known):
            return "FF"
        return "MF"

    counts = {
        "MM vs FF": 0,
        "MF vs MF": 0,
        "MF vs MM": 0,
        "MF vs FF": 0,
        "MM vs MM": 0,
        "FF vs FF": 0,
    }
    if match_df.height == 0:
        return {k: 0.0 for k in counts}

    for row in match_df.iter_rows(named=True):
        t1 = team_type(row["team1Players"].split("|"))
        t2 = team_type(row["team2Players"].split("|"))
        pair = tuple(sorted([t1, t2]))
        if pair == ("FF", "MM"):
            counts["MM vs FF"] += 1
        elif pair == ("MF", "MF"):
            counts["MF vs MF"] += 1
        elif pair == ("MF", "MM"):
            counts["MF vs MM"] += 1
        elif pair == ("FF", "MF"):
            counts["MF vs FF"] += 1
        elif pair == ("MM", "MM"):
            counts["MM vs MM"] += 1
        elif pair == ("FF", "FF"):
            counts["FF vs FF"] += 1

    total = sum(counts.values()) or 1
    return {k: v / total * 100 for k, v in counts.items()}


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
    profiles = player_profiles or config.get("playerProfiles", {})

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

    gini = gini_coefficient(list(win_counts.values()))

    pairing_costs = []
    for row in match_df.iter_rows(named=True):
        t1_players = row["team1Players"].split("|")
        t2_players = row["team2Players"].split("|")

        if len(t1_players) >= 2:
            t1_cost = (
                profiles.get(t1_players[0], {}).get("level", 3) *
                profiles.get(t1_players[1], {}).get("level", 3)
            )
        else:
            t1_cost = profiles.get(t1_players[0], {}).get("level", 3) ** 2

        if len(t2_players) >= 2:
            t2_cost = (
                profiles.get(t2_players[0], {}).get("level", 3) *
                profiles.get(t2_players[1], {}).get("level", 3)
            )
        else:
            t2_cost = profiles.get(t2_players[0], {}).get("level", 3) ** 2
        pairing_costs.append(t1_cost + t2_cost)

    return {
        "algorithm": label,
        "avg_skill_differential": balance_stats.get("avgStrengthDifferential", float(np.mean(strength_diffs))),
        "std_skill_differential": float(np.std(strength_diffs)),
        "avg_pairing_cost": float(np.mean(pairing_costs)) if pairing_costs else 0.0,
        "stronger_team_win_rate": balance_stats.get("strongerTeamWinRate", float(np.mean(stronger_won) * 100)) / 100,
        "perfectly_balanced_rate": balance_stats.get("perfectlyBalancedRate", 0.0) / 100,
        "gini_coefficient": gini,
        "win_distribution": win_counts,
        "loss_distribution": loss_counts,
        "skill_differentials": strength_diffs.tolist(),
        "pairing_costs": pairing_costs,
        "total_matches": balance_stats.get("totalMatches", len(match_df)),
    }
