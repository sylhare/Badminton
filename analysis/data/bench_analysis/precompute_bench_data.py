#!/usr/bin/env python3
"""
Pre-compute all data needed for bench_analysis.py visualization.
This script generates a single bench_data.json file containing all pre-rendered
data so the notebook doesn't need to run any Monte Carlo simulations.

Run with: python precompute_bench_data.py
"""

import json
import random
from pathlib import Path

import numpy as np

# Configuration
CONFIG = {
    "runs": 1000,
    "rounds": 50,
    "minPlayers": 17,
    "maxPlayers": 20,
    "numCourts": 4,
}


def calc_theoretical_max(num_players: int, num_courts: int) -> float:
    """Calculate theoretical maximum games between bench periods."""
    playing_spots = num_courts * 4
    bench_spots = num_players - playing_spots
    if bench_spots <= 0:
        return float("inf")
    return playing_spots / bench_spots


def simulate_random_baseline(
    num_players: int, num_courts: int, num_rounds: int, num_sims: int = 1000
) -> tuple[float, float]:
    """Simulate random player selection to establish baseline bench gaps."""
    all_gaps = []
    playing_spots = num_courts * 4
    player_names = [f"P{i+1}" for i in range(num_players)]

    for _ in range(num_sims):
        last_bench = {p: 0 for p in player_names}
        gaps = []

        for round_num in range(1, num_rounds + 1):
            playing = set(random.sample(player_names, min(playing_spots, len(player_names))))

            for player in player_names:
                if player not in playing:
                    if last_bench[player] > 0:
                        gap = round_num - last_bench[player] - 1
                        gaps.append(gap)
                    last_bench[player] = round_num

        if gaps:
            all_gaps.append(np.mean(gaps))

    return float(np.mean(all_gaps)) if all_gaps else 0.0, float(np.std(all_gaps)) if all_gaps else 0.0


def simulate_baseline_double_bench(
    num_players: int, num_courts: int, num_rounds: int, num_sims: int = 1000
) -> float:
    """Simulate random baseline double bench rate."""
    playing_spots = num_courts * 4
    player_names = [f"P{i+1}" for i in range(num_players)]
    total_double = 0
    total_benches = 0

    for _ in range(num_sims):
        last_bench = {p: 0 for p in player_names}

        for round_num in range(1, num_rounds + 1):
            playing = set(random.sample(player_names, min(playing_spots, len(player_names))))

            for player in player_names:
                if player not in playing:
                    if last_bench[player] > 0:
                        total_benches += 1
                        if round_num - last_bench[player] == 1:
                            total_double += 1
                    last_bench[player] = round_num

    return (total_double / total_benches * 100) if total_benches > 0 else 0.0


def load_existing_data(data_dir: Path) -> dict:
    """Load existing algorithm data from CSV files."""
    data = {"algorithm": {}, "events": {}, "distributions": {}}

    for num_players in range(CONFIG["minPlayers"], CONFIG["maxPlayers"] + 1):
        # Load summary
        summary_file = data_dir / f"summary_{num_players}p.csv"
        if summary_file.exists():
            lines = summary_file.read_text().strip().split("\n")
            if len(lines) >= 2:
                headers = lines[0].split(",")
                values = lines[1].split(",")
                row = dict(zip(headers, values))
                data["algorithm"][num_players] = {
                    "mean_avg_gap": float(row["mean_avg_gap"]),
                    "std_avg_gap": float(row["std_avg_gap"]),
                    "theoreticalMax": float(row["theoreticalMax"]),
                }

        # Load events summary
        events_file = data_dir / f"events_summary_{num_players}p.csv"
        if events_file.exists():
            lines = events_file.read_text().strip().split("\n")
            if len(lines) >= 2:
                headers = lines[0].split(",")
                values = lines[1].split(",")
                row = dict(zip(headers, values))
                data["events"][num_players] = {
                    "mean_gap": float(row["mean_gap"]),
                    "std_gap": float(row["std_gap"]),
                    "double_bench_count": int(row["double_bench_count"]),
                    "total_bench_events": int(row["total_bench_events"]),
                }

        # Load gap distribution
        dist_file = data_dir / f"gap_distribution_{num_players}p.csv"
        if dist_file.exists():
            lines = dist_file.read_text().strip().split("\n")
            if len(lines) >= 2:
                distribution = []
                for line in lines[1:]:
                    parts = line.split(",")
                    distribution.append({
                        "gap": int(parts[0]),
                        "count": int(parts[1]),
                    })
                data["distributions"][num_players] = distribution

    return data


def main():
    script_dir = Path(__file__).parent
    data_dir = script_dir / "data" / "bench_analysis"

    print("Loading existing algorithm data...")
    existing_data = load_existing_data(data_dir)

    print("Computing baseline statistics (this takes ~30 seconds)...")
    baseline_data = {}
    for num_players in range(CONFIG["minPlayers"], CONFIG["maxPlayers"] + 1):
        print(f"  Simulating {num_players} players...")
        mean_gap, std_gap = simulate_random_baseline(
            num_players, CONFIG["numCourts"], CONFIG["rounds"], num_sims=1000
        )
        double_bench_rate = simulate_baseline_double_bench(
            num_players, CONFIG["numCourts"], CONFIG["rounds"], num_sims=1000
        )
        baseline_data[num_players] = {
            "mean_gap": mean_gap,
            "std_gap": std_gap,
            "double_bench_rate": double_bench_rate,
        }

    # Combine into final data structure
    final_data = {
        "config": CONFIG,
        "players": [],
    }

    for num_players in range(CONFIG["minPlayers"], CONFIG["maxPlayers"] + 1):
        algo = existing_data["algorithm"].get(num_players, {})
        events = existing_data["events"].get(num_players, {})
        dist = existing_data["distributions"].get(num_players, [])
        baseline = baseline_data.get(num_players, {})
        theoretical = calc_theoretical_max(num_players, CONFIG["numCourts"])

        player_data = {
            "numPlayers": num_players,
            "theoreticalMax": theoretical,
            # Algorithm performance
            "algo_mean_gap": algo.get("mean_avg_gap", 0),
            "algo_std_gap": algo.get("std_avg_gap", 0),
            # Baseline performance
            "baseline_mean_gap": baseline.get("mean_gap", 0),
            "baseline_std_gap": baseline.get("std_gap", 0),
            "baseline_double_bench_rate": baseline.get("double_bench_rate", 0),
            # Events data
            "events_mean_gap": events.get("mean_gap", 0),
            "events_std_gap": events.get("std_gap", 0),
            "double_bench_count": events.get("double_bench_count", 0),
            "total_bench_events": events.get("total_bench_events", 0),
            # Distribution histogram (just counts array, gaps are 0..N)
            "distribution": [d["count"] for d in dist] if dist else [],
        }
        final_data["players"].append(player_data)

    # Write output
    output_file = data_dir / "bench_data.json"
    output_file.write_text(json.dumps(final_data, indent=2))
    print(f"\nWrote {output_file}")

    # Show size comparison
    old_size = sum(f.stat().st_size for f in data_dir.glob("*.csv")) + (data_dir / "config.json").stat().st_size
    new_size = output_file.stat().st_size
    print(f"Old CSV files total: {old_size:,} bytes")
    print(f"New JSON file: {new_size:,} bytes")


if __name__ == "__main__":
    main()
