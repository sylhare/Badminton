"""Unit tests for analysis, stats, and plotting utilities."""

import math
import tempfile
import unittest
from pathlib import Path

import numpy as np
import polars as pl

from utils.analysis import (
    theoretical_min_repeat_pairs,
    aggregate_bench_stats,
    aggregate_by_player_count,
    analyze_adjacency_bias,
    build_level_heat_matrix,
    build_repeat_matrix,
    compute_balance_metrics,
    compute_court_cooccurrences,
    compute_court_freshness_scores,
    compute_court_rematches_per_session,
    compute_danger_zone_pct,
    compute_differential_buckets,
    compute_gender_matchup_distribution,
    compute_match_session_frequency,
    compute_partnership_rate_buckets,
    compute_repeat_counts,
    compute_summary_metrics,
    compute_teammate_diversity,
    compute_team_stats,
    compute_variety_distribution,
    compute_zero_repeat_pct,
    extract_max_player_count,
    is_adjacent_pair,
    player_id_to_index,
    player_labels,
)
from utils.plotting import add_jitter, create_radar_chart, fig_to_image, setup_matplotlib
from utils.stats import gini_coefficient, proportion_ci


class TestStatsUtils(unittest.TestCase):
    """Tests for statistical calculation functions."""

    def test_proportion_ci_standard(self):
        series = pl.Series("x", [1, 1, 0, 0, 1, 0, 1, 1, 0, 1])
        p, low, high = proportion_ci(series)
        self.assertAlmostEqual(p, 0.6)
        self.assertLess(low, p)
        self.assertGreater(high, p)

    def test_proportion_ci_list_input(self):
        p, low, high = proportion_ci([1, 1, 1, 1])
        self.assertAlmostEqual(p, 1.0)
        self.assertAlmostEqual(low, 1.0)
        self.assertAlmostEqual(high, 1.0)

    def test_proportion_ci_empty(self):
        p, low, high = proportion_ci(pl.Series("x", []))
        self.assertEqual((p, low, high), (0.0, 0.0, 0.0))

    def test_gini_coefficient_equal(self):
        self.assertAlmostEqual(gini_coefficient([10, 10, 10, 10]), 0.0)

    def test_gini_coefficient_empty_or_zero(self):
        self.assertEqual(gini_coefficient([]), 0.0)
        self.assertEqual(gini_coefficient([0, 0, 0]), 0.0)

    def test_gini_coefficient_unequal(self):
        gini = gini_coefficient([0, 0, 0, 100])
        self.assertGreater(gini, 0.5)


class TestPairAndPlayerHelpers(unittest.TestCase):
    """Tests for player indexing and pair helper utilities."""

    def test_player_id_to_index(self):
        self.assertEqual(player_id_to_index("P1"), 0)
        self.assertEqual(player_id_to_index("P16"), 15)

    def test_player_labels(self):
        self.assertEqual(player_labels(3), ["P1", "P2", "P3"])
        self.assertEqual(player_labels(0), [])

    def test_is_adjacent_pair(self):
        self.assertTrue(is_adjacent_pair("P1|P2"))
        self.assertTrue(is_adjacent_pair("P5|P4"))
        self.assertFalse(is_adjacent_pair("P1|P3"))

    def test_extract_max_player_count(self):
        df1 = pl.DataFrame({"pairId": ["P1|P2", "P3|P4"]})
        df2 = pl.DataFrame({"pairId": ["P2|P8"]})
        self.assertEqual(extract_max_player_count([df1, df2]), 8)
        self.assertEqual(extract_max_player_count([]), 0)


class TestSummaryMetrics(unittest.TestCase):
    """Tests for summary metric and repeat frequency computations."""

    def test_compute_summary_metrics_standard(self):
        df = pl.DataFrame({
            "repeatAnyPair": [1, 0, 1, 0],
            "repeatPairCount": [2, 0, 1, 0],
        })
        res = compute_summary_metrics(df, "SA")
        self.assertEqual(res["label"], "SA")
        self.assertEqual(res["runs"], 4)
        self.assertAlmostEqual(res["p_any_repeat"], 0.5)
        self.assertAlmostEqual(res["avg_repeat_pairs"], 0.75)
        self.assertAlmostEqual(res["zero_repeat_pct"], 0.5)

    def test_compute_summary_metrics_different_opponents_fallback(self):
        df = pl.DataFrame({
            "repeatAnyPair": [0, 0],
            "repeatPairDifferentOpponentsCount": [0, 0],
        })
        res = compute_summary_metrics(df, "MC")
        self.assertEqual(res["zero_repeat_pct"], 1.0)
        self.assertEqual(res["avg_repeat_pairs"], 0.0)

    def test_compute_summary_metrics_empty(self):
        df = pl.DataFrame({"repeatAnyPair": [], "repeatPairCount": []})
        res = compute_summary_metrics(df, "Empty")
        self.assertEqual(res, {"label": "Empty", "runs": 0})

    def test_compute_zero_repeat_pct(self):
        df = pl.DataFrame({"repeatPairCount": [0, 0, 1, 2]})
        self.assertAlmostEqual(compute_zero_repeat_pct(df), 50.0)
        self.assertEqual(compute_zero_repeat_pct(pl.DataFrame()), 0.0)

    def test_compute_repeat_counts(self):
        df = pl.DataFrame({"repeatPairCount": [0, 0, 1, 3, 3, 3]})
        counts = compute_repeat_counts(df)
        self.assertEqual(counts, {0: 2, 1: 1, 3: 3})
        self.assertEqual(compute_repeat_counts(pl.DataFrame()), {})


class TestRepeatMatrix(unittest.TestCase):
    """Tests for symmetric repeat and partner matrix generation."""

    def test_build_repeat_matrix_from_events(self):
        events_df = pl.DataFrame({"pairId": ["P1|P2", "P1|P2", "P2|P3"]})
        mat = build_repeat_matrix(events_df, 3)
        self.assertEqual(mat.shape, (3, 3))
        self.assertEqual(mat[0, 1], 2)
        self.assertEqual(mat[1, 0], 2)
        self.assertEqual(mat[1, 2], 1)
        self.assertEqual(mat[2, 1], 1)
        self.assertEqual(mat[0, 2], 0)
        self.assertEqual(mat[0, 0], 0)

    def test_build_repeat_matrix_from_summary(self):
        summary_df = pl.DataFrame({
            "pairId": ["P1|P3", "P2|P4"],
            "asTeammate": [5, 9],
        })
        mat = build_repeat_matrix(summary_df, 4)
        self.assertEqual(mat[0, 2], 5)
        self.assertEqual(mat[2, 0], 5)
        self.assertEqual(mat[1, 3], 9)
        self.assertEqual(mat[3, 1], 9)

    def test_build_repeat_matrix_empty(self):
        mat = build_repeat_matrix(pl.DataFrame(), 3)
        self.assertTrue(np.all(mat == 0))


class TestCourtFreshnessAndVariety(unittest.TestCase):
    """Tests for court group freshness and match variety distribution."""

    def setUp(self):
        self.match_df = pl.DataFrame({
            "simulationId": ["s1", "s1", "s1", "s1"],
            "roundIndex": [0, 0, 1, 1],
            "team1Players": ["P1|P2", "P5|P6", "P1|P5", "P2|P7"],
            "team2Players": ["P3|P4", "P7|P8", "P3|P6", "P4|P8"],
        })

    def test_compute_court_freshness_scores(self):
        scores = compute_court_freshness_scores(self.match_df)
        self.assertIsInstance(scores, list)
        self.assertGreater(len(scores), 0)
        for score in scores:
            self.assertTrue(0 <= score <= 3)

    def test_compute_variety_distribution(self):
        pcts, avg = compute_variety_distribution(self.match_df)
        self.assertEqual(len(pcts), 4)
        self.assertAlmostEqual(sum(pcts), 100.0)
        self.assertTrue(0.0 <= avg <= 3.0)

    def test_compute_court_freshness_empty(self):
        empty_df = pl.DataFrame({
            "simulationId": [],
            "roundIndex": [],
            "team1Players": [],
            "team2Players": [],
        })
        self.assertEqual(compute_court_freshness_scores(empty_df), [])
        pcts, avg = compute_variety_distribution(empty_df)
        self.assertEqual(pcts, [0.0, 0.0, 0.0, 0.0])
        self.assertEqual(avg, 0.0)

    def test_compute_court_cooccurrences(self):
        cooc = compute_court_cooccurrences(self.match_df)
        self.assertIsInstance(cooc, list)
        self.assertGreater(len(cooc), 0)
        self.assertEqual(compute_court_cooccurrences(pl.DataFrame()), [])


class TestTeamAndMatchupAnalysis(unittest.TestCase):
    """Tests for balance, danger zone, differential and gender breakdown."""

    def setUp(self):
        self.match_df = pl.DataFrame({
            "team1IntraGap": [10, 45],
            "team2IntraGap": [20, 15],
            "team1AvgLevel": [50.0, 80.0],
            "team2AvgLevel": [55.0, 50.0],
            "strengthDifferential": [5, 30],
            "strongerTeamWon": [1, 1],
            "team1Players": ["P1|P2", "P1|P3"],
            "team2Players": ["P3|P4", "P2|P4"],
        })

    def test_compute_team_stats(self):
        teams = compute_team_stats(self.match_df)
        self.assertEqual(teams.height, 4)
        self.assertIn("intra_gap", teams.columns)
        self.assertIn("opp_advantage", teams.columns)

    def test_compute_danger_zone_pct(self):
        teams = compute_team_stats(self.match_df)
        pct = compute_danger_zone_pct(teams, gap_threshold=40.0, adv_threshold=20.0)
        self.assertGreater(pct, 0.0)
        self.assertLessEqual(pct, 100.0)
        self.assertEqual(compute_danger_zone_pct(pl.DataFrame()), 0.0)

    def test_build_level_heat_matrix(self):
        teams = compute_team_stats(self.match_df)
        levels = [50, 55, 80]
        mat = build_level_heat_matrix(teams, levels)
        self.assertEqual(len(mat), 3)
        self.assertEqual(len(mat[0]), 3)

    def test_compute_differential_buckets(self):
        labels, pcts = compute_differential_buckets([0, 1, 2, 4, 5])
        self.assertEqual(labels, ["diff = 0", "diff = 1", "diff = 2", "diff ≥ 3"])
        self.assertAlmostEqual(pcts[0], 20.0)
        self.assertAlmostEqual(pcts[1], 20.0)
        self.assertAlmostEqual(pcts[2], 20.0)
        self.assertAlmostEqual(pcts[3], 40.0)

    def test_compute_partnership_rate_buckets(self):
        pairs_df = pl.DataFrame({"asTeammate": [10, 30, 60, 80, 120]})
        labels, pcts = compute_partnership_rate_buckets(pairs_df, total_sims=100)
        self.assertEqual(len(labels), 5)
        self.assertAlmostEqual(sum(pcts), 100.0)

    def test_compute_gender_matchup_distribution(self):
        match_df = pl.DataFrame({
            "team1Players": ["P1|P2", "P1|P3"],
            "team2Players": ["P3|P5", "P2|P4"],
        })
        dist = compute_gender_matchup_distribution(match_df)
        self.assertIn("MM vs FF", dist)
        self.assertIn("MF vs MF", dist)
        self.assertAlmostEqual(sum(dist.values()), 100.0)


class TestAdjacencyAndBenchAnalysis(unittest.TestCase):
    """Tests for adjacency bias and bench summary calculations."""

    def test_analyze_adjacency_bias(self):
        events_df = pl.DataFrame({"pairId": ["P1|P2", "P1|P3", "P1|P2"]})
        bias = analyze_adjacency_bias(events_df, "SA")
        self.assertEqual(bias["algorithm"], "SA")
        self.assertEqual(bias["adjacent_events"], 2)
        self.assertEqual(bias["nonadjacent_events"], 1)
        self.assertEqual(bias["bias_ratio"], 2.0)

    def test_analyze_adjacency_bias_empty(self):
        bias = analyze_adjacency_bias(pl.DataFrame(), "Empty")
        self.assertEqual(bias["bias_ratio"], 0)

    def test_compute_teammate_diversity(self):
        match_df = pl.DataFrame({
            "simulationId": ["sim1"],
            "team1Players": ["P1|P2"],
            "team2Players": ["P3|P4"],
        })
        div = compute_teammate_diversity(match_df)
        self.assertEqual(div["avg"], 1.0)
        self.assertEqual(div["min"], 1.0)
        self.assertEqual(div["max"], 1.0)

    def test_compute_court_rematches_per_session(self):
        match_df = pl.DataFrame({
            "simulationId": ["sim1", "sim1", "sim1", "sim1", "sim2", "sim2"],
            "team1Players": ["P1|P2", "P1|P3", "P1|P4", "P5|P6", "P1|P2", "P5|P6"],
            "team2Players": ["P3|P4", "P2|P4", "P2|P3", "P7|P8", "P3|P4", "P7|P8"],
        })
        rematches = compute_court_rematches_per_session(match_df)
        self.assertEqual(rematches, [2, 0])

    def test_compute_court_rematches_per_session_separates_player_counts(self):
        match_df = pl.DataFrame({
            "simulationId": [1, 1],
            "numPlayers": [15, 16],
            "team1Players": ["P1|P2", "P1|P2"],
            "team2Players": ["P3|P4", "P3|P4"],
        })
        self.assertEqual(compute_court_rematches_per_session(match_df), [0, 0])

    def test_compute_court_cooccurrences_separates_player_counts(self):
        match_df = pl.DataFrame({
            "simulationId": [1, 1],
            "numPlayers": [15, 16],
            "team1Players": ["P1|P2", "P1|P2"],
            "team2Players": ["P3|P4", "P3|P4"],
        })
        self.assertEqual(compute_court_cooccurrences(match_df), [1] * 12)

    def test_theoretical_min_repeat_pairs(self):
        self.assertEqual(theoretical_min_repeat_pairs(16, 4, 17), 16)
        self.assertEqual(theoretical_min_repeat_pairs(15, 4, 17), 0)
        self.assertEqual(theoretical_min_repeat_pairs(17, 4, 17), 0)
        self.assertEqual(theoretical_min_repeat_pairs(18, 4, 17), 0)

    def test_compute_court_rematches_per_session_empty_and_singles(self):
        self.assertEqual(compute_court_rematches_per_session(pl.DataFrame()), [])
        singles_df = pl.DataFrame({
            "simulationId": ["s1", "s1"],
            "team1Players": ["P1", "P1"],
            "team2Players": ["P2", "P2"],
        })
        self.assertEqual(compute_court_rematches_per_session(singles_df), [0])

    def test_compute_match_session_frequency(self):
        match_df = pl.DataFrame({
            "simulationId": ["s1", "s2"],
            "team1Players": ["P1|P2", "P1|P2"],
            "team2Players": ["P3|P4", "P3|P4"],
        })
        freq = compute_match_session_frequency(match_df)
        self.assertEqual(freq["total_unique_matches"], 1)
        self.assertEqual(freq["repeat_pct"], 100.0)

    def test_aggregate_bench_stats(self):
        df = pl.DataFrame({
            "meanGap": [3.5, 4.5],
            "doubleBenchCount": [2, 3],
            "totalGapEvents": [10, 15],
        })
        stats = aggregate_bench_stats(df)
        self.assertAlmostEqual(stats["mean_gap"], 4.0)
        self.assertEqual(stats["double_bench_count"], 5)
        self.assertAlmostEqual(stats["double_bench_rate"], 20.0)

    def test_aggregate_by_player_count(self):
        df = pl.DataFrame({
            "numPlayers": [16, 16, 20],
            "meanGap": [3.0, 4.0, 5.0],
            "doubleBenchCount": [1, 1, 0],
            "totalGapEvents": [10, 10, 20],
        })
        grouped = aggregate_by_player_count(df)
        self.assertIn(16, grouped)
        self.assertIn(20, grouped)
        self.assertAlmostEqual(grouped[16]["mean_gap"], 3.5)
        self.assertAlmostEqual(grouped[20]["mean_gap"], 5.0)


class TestPlottingUtilities(unittest.TestCase):
    """Tests for matplotlib and jitter plotting helpers."""

    def test_setup_matplotlib(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            script_path = Path(tmp_dir) / "dummy.py"
            setup_matplotlib(script_path)
            self.assertTrue((Path(tmp_dir) / ".mplconfig").exists())
            self.assertTrue((Path(tmp_dir) / ".cache").exists())

    def test_fig_to_image(self):
        import matplotlib.pyplot as plt
        fig, ax = plt.subplots()
        ax.plot([1, 2], [3, 4])
        data = fig_to_image(fig, close=True)
        self.assertTrue(data.startswith(b"\x89PNG\r\n\x1a\n"))

    def test_add_jitter(self):
        vals = [10.0, 10.0, 10.0]
        jittered = add_jitter(vals, scale=1.0, seed=42)
        self.assertEqual(len(jittered), 3)
        self.assertNotEqual(jittered[0], 10.0)

    def test_create_radar_chart(self):
        import matplotlib.pyplot as plt
        categories = ["A", "B", "C"]
        series_data = [("Algo1", [80.0, 90.0, 70.0], "#ff0000")]
        fig, ax = create_radar_chart(categories, series_data)
        self.assertIsNotNone(fig)
        self.assertIsNotNone(ax)
        plt.close(fig)


if __name__ == "__main__":
    unittest.main()
