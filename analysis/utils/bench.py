"""Bench analysis utility functions for simulating baselines and computing metrics."""

import random

import numpy as np


def calc_theoretical_max(num_players: int, num_courts: int = 4) -> float:
    """Calculate theoretical maximum games between bench periods.
    
    Args:
        num_players: Total number of players
        num_courts: Number of courts (default 4)
        
    Returns:
        Theoretical maximum games a player can play between bench periods
    """
    playing_spots = num_courts * 4
    bench_spots = num_players - playing_spots
    if bench_spots <= 0:
        return float("inf")
    return playing_spots / bench_spots


def simulate_random_baseline(
    num_players: int,
    num_courts: int,
    num_rounds: int,
    num_sims: int = 1000,
) -> tuple[float, float]:
    """Simulate random player selection to establish baseline bench gaps.
    
    Args:
        num_players: Total number of players
        num_courts: Number of courts
        num_rounds: Number of rounds per simulation
        num_sims: Number of simulations to run
        
    Returns:
        Tuple of (mean_gap, std_gap) across all simulations
    """
    all_gaps = []
    playing_spots = num_courts * 4
    player_names = [f"P{i+1}" for i in range(num_players)]

    for _ in range(num_sims):
        last_bench: dict[str, int] = {p: 0 for p in player_names}
        gaps: list[int] = []

        for round_num in range(1, num_rounds + 1):
            playing = set(random.sample(player_names, min(playing_spots, len(player_names))))

            for player in player_names:
                if player not in playing:
                    if last_bench[player] > 0:
                        gap = round_num - last_bench[player] - 1
                        gaps.append(gap)
                    last_bench[player] = round_num

        if gaps:
            all_gaps.append(float(np.mean(gaps)))

    return (
        float(np.mean(all_gaps)) if all_gaps else 0.0,
        float(np.std(all_gaps)) if all_gaps else 0.0,
    )


def simulate_baseline_double_bench(
    num_players: int,
    num_courts: int,
    num_rounds: int,
    num_sims: int = 1000,
) -> float:
    """Simulate random baseline double bench rate.
    
    Args:
        num_players: Total number of players
        num_courts: Number of courts
        num_rounds: Number of rounds per simulation
        num_sims: Number of simulations to run
        
    Returns:
        Double bench rate as a percentage (0-100)
    """
    playing_spots = num_courts * 4
    player_names = [f"P{i+1}" for i in range(num_players)]
    total_double = 0
    total_benches = 0

    for _ in range(num_sims):
        last_bench: dict[str, int] = {p: 0 for p in player_names}

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
