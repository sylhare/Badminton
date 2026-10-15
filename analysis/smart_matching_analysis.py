import marimo

__generated_with = "0.19.4"
app = marimo.App(width="medium")


@app.cell
def _():
    import json
    from pathlib import Path

    import marimo as mo
    import plotly.graph_objects as go
    import polars as pl
    from plotly.subplots import make_subplots

    return Path, go, json, make_subplots, mo, pl


@app.cell
def _(Path, json, pl):
    data_dir = Path(__file__).parent / "data"
    sa_dir = data_dir / "sa_algo"
    sl_dir = data_dir / "sl_algo"
    sl2_dir = data_dir / "sl2_algo"

    sa_match = pl.read_csv(sa_dir / "match_events.csv")
    sl_match = pl.read_csv(sl_dir / "match_events.csv")
    sl2_match = pl.read_csv(sl2_dir / "match_events.csv")

    sa_pairs = pl.read_csv(sa_dir / "match_pair_summary.csv")
    sl_pairs = pl.read_csv(sl_dir / "match_pair_summary.csv")
    sl2_pairs = pl.read_csv(sl2_dir / "match_pair_summary.csv")

    sa_summary = pl.read_csv(sa_dir / "summary.csv")
    sl_summary = pl.read_csv(sl_dir / "summary.csv")
    sl2_summary = pl.read_csv(sl2_dir / "summary.csv")

    sa_config = json.loads((sa_dir / "config.json").read_text())
    sl_config = json.loads((sl_dir / "config.json").read_text())
    sl2_config = json.loads((sl2_dir / "config.json").read_text())

    return (
        sa_config,
        sa_match,
        sa_pairs,
        sa_summary,
        sl_config,
        sl_match,
        sl_pairs,
        sl_summary,
        sl2_config,
        sl2_match,
        sl2_pairs,
        sl2_summary,
    )


@app.cell(hide_code=True)
def _(mo, sa_config):
    _runs = sa_config.get("runs", 50)
    _rounds = sa_config.get("rounds", 10)
    _counts = ", ".join(str(c) for c in sa_config.get("playerCounts", []))
    mo.md(
        f"""
    # Smart Matching Analysis: SA vs Smart (SL) vs Smart2 (SL2)

    Comparing standard **Simulated Annealing (SA)** against **Smart Matching (SL)**
    and the new **Smart2 Matching (SL2)** engine across **{_runs} simulations × {_rounds} rounds**
    for player counts [{_counts}].

    - **SA (Simulated Annealing)**: Baseline stochastic search without skill or gender constraints.
    - **SL (Smart Matching)**: Balances team average levels, penalizes partner level gaps, and avoids gender-mismatched courts.
    - **SL2 (Smart2 Matching)**: Adds sliding-window court tolerance, pod repeat suppression, win streak momentum, and soft mixed doubles incentives.

    Players are assigned a **sex** (60% M / 40% F) and a **skill level** (1–5 → 20–100).

    ---
"""
    )
    return


@app.cell(hide_code=True)
def _(mo, sa_config, sl2_config, sl_config):
    _sa_zero = sa_config["aggregateStats"]["zeroRepeatRate"]
    _sl_zero = sl_config["aggregateStats"]["zeroRepeatRate"]
    _sl2_zero = sl2_config["aggregateStats"]["zeroRepeatRate"]
    _sa_diff = sa_config["levelBasedBalance"]["avgStrengthDifferential"]
    _sl_diff = sl_config["levelBasedBalance"]["avgStrengthDifferential"]
    _sl2_diff = sl2_config["levelBasedBalance"]["avgStrengthDifferential"]
    _sa_win = sa_config["levelBasedBalance"]["strongerTeamWinRate"]
    _sl_win = sl_config["levelBasedBalance"]["strongerTeamWinRate"]
    _sl2_win = sl2_config["levelBasedBalance"]["strongerTeamWinRate"]
    mo.md(
        f"""
    | Metric | SA | SL | SL2 |
    |:-------|---:|---:|----:|
    | Zero-repeat rate | {_sa_zero:.1f}% | {_sl_zero:.1f}% | {_sl2_zero:.1f}% |
    | Avg strength differential | {_sa_diff:.2f} | {_sl_diff:.2f} | {_sl2_diff:.2f} |
    | Stronger-team win rate | {_sa_win:.1f}% | {_sl_win:.1f}% | {_sl2_win:.1f}% |
    """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("## Repeats")
    return


@app.cell(hide_code=True)
def _(go, make_subplots, mo, pl, sa_summary, sl2_summary, sl_summary):
    _n_sa = sa_summary.height
    _n_sl = sl_summary.height
    _n_sl2 = sl2_summary.height
    _sa_zero_pct = sa_summary.filter(pl.col("repeatPairCount") == 0).height / _n_sa * 100
    _sl_zero_pct = sl_summary.filter(pl.col("repeatPairCount") == 0).height / _n_sl * 100
    _sl2_zero_pct = sl2_summary.filter(pl.col("repeatPairCount") == 0).height / _n_sl2 * 100

    _fig = make_subplots(
        rows=1,
        cols=2,
        subplot_titles=("Zero-Repeat Rate (%)", "Repeat Count per Run"),
    )

    _fig.add_trace(
        go.Bar(
            x=["SA", "SL", "SL2"],
            y=[round(_sa_zero_pct, 1), round(_sl_zero_pct, 1), round(_sl2_zero_pct, 1)],
            marker_color=["#54A24B", "#4C78A8", "#F58518"],
            text=[f"{_sa_zero_pct:.1f}%", f"{_sl_zero_pct:.1f}%", f"{_sl2_zero_pct:.1f}%"],
            textposition="outside",
            showlegend=False,
        ),
        row=1,
        col=1,
    )
    _max_repeats = max(
        sa_summary["repeatPairCount"].max(),
        sl_summary["repeatPairCount"].max(),
        sl2_summary["repeatPairCount"].max(),
    )
    _buckets = list(range(0, _max_repeats + 1))
    _sa_counts = sa_summary["repeatPairCount"].value_counts().sort("repeatPairCount")
    _sl_counts = sl_summary["repeatPairCount"].value_counts().sort("repeatPairCount")
    _sl2_counts = sl2_summary["repeatPairCount"].value_counts().sort("repeatPairCount")
    _sa_map = dict(zip(_sa_counts["repeatPairCount"].to_list(), _sa_counts["count"].to_list()))
    _sl_map = dict(zip(_sl_counts["repeatPairCount"].to_list(), _sl_counts["count"].to_list()))
    _sl2_map = dict(zip(_sl2_counts["repeatPairCount"].to_list(), _sl2_counts["count"].to_list()))

    _fig.add_trace(
        go.Bar(
            x=[str(b) for b in _buckets],
            y=[_sa_map.get(b, 0) for b in _buckets],
            name="SA",
            marker_color="#54A24B",
        ),
        row=1,
        col=2,
    )
    _fig.add_trace(
        go.Bar(
            x=[str(b) for b in _buckets],
            y=[_sl_map.get(b, 0) for b in _buckets],
            name="SL",
            marker_color="#4C78A8",
        ),
        row=1,
        col=2,
    )
    _fig.add_trace(
        go.Bar(
            x=[str(b) for b in _buckets],
            y=[_sl2_map.get(b, 0) for b in _buckets],
            name="SL2",
            marker_color="#F58518",
        ),
        row=1,
        col=2,
    )
    _fig.update_layout(
        height=420,
        barmode="group",
        legend=dict(orientation="h", y=-0.18),
        yaxis=dict(range=[0, 100], title="Runs (%)"),
        xaxis2_title="Repeated teammate pairs per run",
        yaxis2_title="Number of runs",
        plot_bgcolor="white",
        paper_bgcolor="white",
    )
    mo.ui.plotly(_fig)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        """
    Both engines avoid repeat pairings well. SL shows a higher repeat rate because
    its rigid level-pair constraints restrict valid partners. SL2 uses sliding-window
    tolerance and pod repeat suppression to substantially recover zero-repeat performance.
    """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("## Pair Likelihood & Diversity")
    return


@app.cell(hide_code=True)
def _(go, make_subplots, mo, pl, sa_pairs, sl2_pairs, sl_pairs):
    _sa = sa_pairs.with_columns(
        (pl.col("asTeammate") / pl.col("totalMatches")).alias("teammate_ratio")
    )
    _sl = sl_pairs.with_columns(
        (pl.col("asTeammate") / pl.col("totalMatches")).alias("teammate_ratio")
    )
    _sl2 = sl2_pairs.with_columns(
        (pl.col("asTeammate") / pl.col("totalMatches")).alias("teammate_ratio")
    )
    _sa_ratio = _sa["teammate_ratio"].to_list()
    _sl_ratio = _sl["teammate_ratio"].to_list()
    _sl2_ratio = _sl2["teammate_ratio"].to_list()

    _fig = make_subplots(
        rows=1,
        cols=2,
        subplot_titles=(
            "Teammate Rate per Pair (fraction of shared courts)",
            "Distribution Spread (Box Plot)",
        ),
    )

    _fig.add_trace(
        go.Histogram(
            x=_sa_ratio,
            name="SA",
            marker_color="#54A24B",
            opacity=0.6,
            xbins=dict(start=0, end=1, size=0.025),
        ),
        row=1,
        col=1,
    )
    _fig.add_trace(
        go.Histogram(
            x=_sl_ratio,
            name="SL",
            marker=dict(
                color="rgba(0,0,0,0)",
                line=dict(color="#4C78A8", width=2),
            ),
            xbins=dict(start=0, end=1, size=0.025),
        ),
        row=1,
        col=1,
    )
    _fig.add_trace(
        go.Histogram(
            x=_sl2_ratio,
            name="SL2",
            marker=dict(
                color="rgba(0,0,0,0)",
                line=dict(color="#F58518", width=2),
            ),
            xbins=dict(start=0, end=1, size=0.025),
        ),
        row=1,
        col=1,
    )

    _fig.add_trace(
        go.Box(y=_sa_ratio, name="SA", marker_color="#54A24B", showlegend=False),
        row=1,
        col=2,
    )
    _fig.add_trace(
        go.Box(y=_sl_ratio, name="SL", marker_color="#4C78A8", showlegend=False),
        row=1,
        col=2,
    )
    _fig.add_trace(
        go.Box(y=_sl2_ratio, name="SL2", marker_color="#F58518", showlegend=False),
        row=1,
        col=2,
    )

    _fig.update_layout(
        height=420,
        barmode="overlay",
        legend=dict(orientation="h", y=-0.18),
        xaxis1_title="Fraction of shared courts as teammates",
        yaxis1_title="Pair count",
        yaxis2_title="Teammate rate",
        plot_bgcolor="white",
        paper_bgcolor="white",
    )
    mo.ui.plotly(_fig)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        """
    **SA** assigns all pairs an almost identical teammate probability (~33%) regardless of skill.

    **SL** polarises pairs by level: compatible-level pairs end up as teammates far more often,
    while cross-level pairs are rarely teammates.

    **SL2** preserves level-aware balance through sliding windows while widening partner variety,
    moderating the extreme polarization seen in SL.
    """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("## Match Level Spread")
    return


@app.cell(hide_code=True)
def _(go, make_subplots, mo, sa_match, sl2_match, sl_match):
    _sa_lvl = sa_match["matchAvgLevel"].to_list()
    _sl_lvl = sl_match["matchAvgLevel"].to_list()
    _sl2_lvl = sl2_match["matchAvgLevel"].to_list()
    _sa_std = sa_match["matchAvgLevel"].std()
    _sl_std = sl_match["matchAvgLevel"].std()
    _sl2_std = sl2_match["matchAvgLevel"].std()

    _fig = make_subplots(
        rows=1,
        cols=2,
        subplot_titles=(
            "Avg Player Level per Match",
            "Level Spread (Box Plot)",
        ),
    )
    _fig.add_trace(
        go.Histogram(
            x=_sa_lvl,
            name=f"SA (σ={_sa_std:.1f})",
            opacity=0.5,
            marker_color="#54A24B",
            xbins=dict(start=15, size=5),
        ),
        row=1,
        col=1,
    )
    _fig.add_trace(
        go.Histogram(
            x=_sl_lvl,
            name=f"SL (σ={_sl_std:.1f})",
            opacity=0.5,
            marker_color="#4C78A8",
            xbins=dict(start=15, size=5),
        ),
        row=1,
        col=1,
    )
    _fig.add_trace(
        go.Histogram(
            x=_sl2_lvl,
            name=f"SL2 (σ={_sl2_std:.1f})",
            opacity=0.5,
            marker_color="#F58518",
            xbins=dict(start=15, size=5),
        ),
        row=1,
        col=1,
    )
    _fig.add_trace(
        go.Box(y=_sa_lvl, name="SA", marker_color="#54A24B", showlegend=False),
        row=1,
        col=2,
    )
    _fig.add_trace(
        go.Box(y=_sl_lvl, name="SL", marker_color="#4C78A8", showlegend=False),
        row=1,
        col=2,
    )
    _fig.add_trace(
        go.Box(y=_sl2_lvl, name="SL2", marker_color="#F58518", showlegend=False),
        row=1,
        col=2,
    )
    _fig.update_layout(
        height=420,
        barmode="overlay",
        legend=dict(orientation="h", y=-0.18),
        xaxis1_title="Avg level of all players on court (0–100 scale)",
        yaxis1_title="Match count",
        yaxis2_title="Avg level per match",
        plot_bgcolor="white",
        paper_bgcolor="white",
    )
    mo.ui.plotly(_fig)
    return


@app.cell(hide_code=True)
def _(mo, sa_match, sl2_match, sl_match):
    _sa_std = sa_match["matchAvgLevel"].std()
    _sl_std = sl_match["matchAvgLevel"].std()
    _sl2_std = sl2_match["matchAvgLevel"].std()
    mo.md(
        f"""
    SL's histogram peaks at discrete skill tiers (20, 40, 60, 80, 100) because of rigid tier segregation.
    SL2 smooths this transition using sliding windows, striking a balance between tier grouping and variety
    (σ: SA **{_sa_std:.1f}**, SL **{_sl_std:.1f}**, SL2 **{_sl2_std:.1f}**).
    """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("## Level Balance (Strength Differential)")
    return


@app.cell(hide_code=True)
def _(go, make_subplots, mo, sa_match, sl2_match, sl_match):
    _sa_diff = sa_match["strengthDifferential"].to_list()
    _sl_diff = sl_match["strengthDifferential"].to_list()
    _sl2_diff = sl2_match["strengthDifferential"].to_list()
    _sa_mean = sa_match["strengthDifferential"].mean()
    _sl_mean = sl_match["strengthDifferential"].mean()
    _sl2_mean = sl2_match["strengthDifferential"].mean()

    def _buckets(diff_list):
        n = len(diff_list)
        return [
            diff_list.count(0) / n * 100,
            diff_list.count(1) / n * 100,
            diff_list.count(2) / n * 100,
            sum(1 for x in diff_list if x >= 3) / n * 100,
        ]

    _labels = ["diff = 0", "diff = 1", "diff = 2", "diff ≥ 3"]
    _sa_pct = _buckets(_sa_diff)
    _sl_pct = _buckets(_sl_diff)
    _sl2_pct = _buckets(_sl2_diff)

    _fig = make_subplots(
        rows=1,
        cols=2,
        subplot_titles=(
            "Match Balance Breakdown (% of all matches)",
            "Strength Differential Distribution",
        ),
    )
    _fig.add_trace(
        go.Bar(x=_labels, y=_sa_pct, name="SA", marker_color="#54A24B", opacity=0.85),
        row=1,
        col=1,
    )
    _fig.add_trace(
        go.Bar(x=_labels, y=_sl_pct, name="SL", marker_color="#4C78A8", opacity=0.85),
        row=1,
        col=1,
    )
    _fig.add_trace(
        go.Bar(x=_labels, y=_sl2_pct, name="SL2", marker_color="#F58518", opacity=0.85),
        row=1,
        col=1,
    )
    _fig.add_trace(
        go.Histogram(
            x=_sa_diff,
            name=f"SA (μ={_sa_mean:.2f})",
            opacity=0.6,
            marker_color="#54A24B",
            xbins=dict(start=-0.5, size=1),
            showlegend=False,
        ),
        row=1,
        col=2,
    )
    _fig.add_trace(
        go.Histogram(
            x=_sl_diff,
            name=f"SL (μ={_sl_mean:.2f})",
            opacity=0.6,
            marker_color="#4C78A8",
            xbins=dict(start=-0.5, size=1),
            showlegend=False,
        ),
        row=1,
        col=2,
    )
    _fig.add_trace(
        go.Histogram(
            x=_sl2_diff,
            name=f"SL2 (μ={_sl2_mean:.2f})",
            opacity=0.6,
            marker_color="#F58518",
            xbins=dict(start=-0.5, size=1),
            showlegend=False,
        ),
        row=1,
        col=2,
    )
    _fig.update_layout(
        height=420,
        barmode="group",
        legend=dict(orientation="h", y=-0.18),
        xaxis1_title="Team strength gap (sum of skill levels)",
        yaxis1_title="% of all matches",
        xaxis2_title="Strength differential",
        yaxis2_title="Match count",
        plot_bgcolor="white",
        paper_bgcolor="white",
    )
    mo.ui.plotly(_fig)
    return


@app.cell(hide_code=True)
def _(mo, pl, sa_match, sl2_match, sl_match):
    _sa_mean = sa_match["strengthDifferential"].mean()
    _sl_mean = sl_match["strengthDifferential"].mean()
    _sl2_mean = sl2_match["strengthDifferential"].mean()
    _sa_zero_pct = (
        sa_match.filter(pl.col("strengthDifferential") == 0).height
        / sa_match.height
        * 100
    )
    _sl_zero_pct = (
        sl_match.filter(pl.col("strengthDifferential") == 0).height
        / sl_match.height
        * 100
    )
    _sl2_zero_pct = (
        sl2_match.filter(pl.col("strengthDifferential") == 0).height
        / sl2_match.height
        * 100
    )
    mo.md(
        f"""
    **{_sl_zero_pct:.0f}%** of SL matches and **{_sl2_zero_pct:.0f}%** of SL2 matches have perfectly
    balanced teams (diff = 0) vs **{_sa_zero_pct:.0f}%** for SA. The average strength
    differential is **{_sa_mean:.2f}** (SA), **{_sl_mean:.2f}** (SL), and **{_sl2_mean:.2f}** (SL2).
    Both smart engines explicitly minimize skill differentials between opposing teams compared to SA.
    """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("## Partner Imbalance")
    return


@app.cell
def _(pl, sa_match, sl2_match, sl_match):
    def _team_stats(match_df):
        _t1 = match_df.select([
            pl.col("team1IntraGap").alias("intra_gap"),
            pl.col("team1AvgLevel").alias("team_avg"),
            pl.col("team2AvgLevel").alias("opp_avg"),
            (pl.col("team2AvgLevel") - pl.col("team1AvgLevel")).alias("opp_advantage"),
        ])
        _t2 = match_df.select([
            pl.col("team2IntraGap").alias("intra_gap"),
            pl.col("team2AvgLevel").alias("team_avg"),
            pl.col("team1AvgLevel").alias("opp_avg"),
            (pl.col("team1AvgLevel") - pl.col("team2AvgLevel")).alias("opp_advantage"),
        ])
        return pl.concat([_t1, _t2])

    sa_teams = _team_stats(sa_match)
    sl_teams = _team_stats(sl_match)
    sl2_teams = _team_stats(sl2_match)
    return sa_teams, sl2_teams, sl_teams


@app.cell(hide_code=True)
def _(go, make_subplots, mo, pl, sa_teams, sl2_teams, sl_teams):
    _GAP = 40
    _ADV = 20

    def _danger_pct(teams):
        _bad = teams.filter(
            (pl.col("intra_gap") >= _GAP) | (pl.col("opp_advantage").abs() >= _ADV)
        )
        return _bad.height / teams.height * 100

    _sa_d = _danger_pct(sa_teams)
    _sl_d = _danger_pct(sl_teams)
    _sl2_d = _danger_pct(sl2_teams)

    _fig = make_subplots(
        rows=1,
        cols=2,
        subplot_titles=(
            "Partner Level Gap",
            "Danger Zone (%)",
        ),
    )
    _fig.add_trace(
        go.Histogram(
            x=sa_teams["intra_gap"].to_list(),
            name="SA",
            marker_color="#54A24B",
            opacity=0.6,
            xbins=dict(start=0, size=10),
        ),
        row=1,
        col=1,
    )
    _fig.add_trace(
        go.Histogram(
            x=sl_teams["intra_gap"].to_list(),
            name="SL",
            marker=dict(color="rgba(0,0,0,0)", line=dict(color="#4C78A8", width=2)),
            xbins=dict(start=0, size=10),
        ),
        row=1,
        col=1,
    )
    _fig.add_trace(
        go.Histogram(
            x=sl2_teams["intra_gap"].to_list(),
            name="SL2",
            marker=dict(color="rgba(0,0,0,0)", line=dict(color="#F58518", width=2)),
            xbins=dict(start=0, size=10),
        ),
        row=1,
        col=1,
    )
    _fig.add_trace(
        go.Bar(
            x=["SA", "SL", "SL2"],
            y=[round(_sa_d, 2), round(_sl_d, 2), round(_sl2_d, 2)],
            marker_color=["#54A24B", "#4C78A8", "#F58518"],
            text=[f"{_sa_d:.2f}%", f"{_sl_d:.2f}%", f"{_sl2_d:.2f}%"],
            textposition="outside",
            showlegend=False,
        ),
        row=1,
        col=2,
    )
    _fig.update_layout(
        height=420,
        barmode="overlay",
        legend=dict(orientation="h", y=-0.18),
        xaxis1_title="Level gap between teammates (0–100 scale)",
        yaxis1_title="Count",
        yaxis2=dict(title="% of all team slots"),
        plot_bgcolor="white",
        paper_bgcolor="white",
    )
    _fig.update_annotations(font_size=12)
    mo.ui.plotly(_fig)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        """
    **Partner Level Gap**: how far apart (in level) two teammates are.
    SL strictly penalizes teammate level gaps. SL2 allows controlled spreads within its window tolerance
    to enable court rotation while preventing severe mismatches.

    **Danger Zone**: share of team slots that fall outside the safe zone (internal gap ≥ 40 or opponent advantage ≥ 20).
    Both SL and SL2 produce dramatically fewer danger zone slots than SA.
    """
    )
    return


@app.cell(hide_code=True)
def _(go, make_subplots, mo, pl, sa_teams, sl2_teams, sl_teams):
    _avgs = [20, 30, 40, 50, 60, 70, 80, 90, 100]
    _labels = [str(a) for a in _avgs]

    def _heat_matrix(teams):
        _df = teams.with_columns([
            pl.col("team_avg").cast(pl.Int32).alias("ta"),
            pl.col("opp_avg").cast(pl.Int32).alias("oa"),
        ])
        _counts = _df.group_by(["ta", "oa"]).agg(pl.len().alias("n"))
        _mat = [[0] * 9 for _ in range(9)]
        for _row in _counts.iter_rows(named=True):
            if _row["ta"] in _avgs and _row["oa"] in _avgs:
                _xi = _avgs.index(_row["ta"])
                _yi = _avgs.index(_row["oa"])
                _mat[_yi][_xi] = _row["n"]
        return _mat

    _sa_mat = _heat_matrix(sa_teams)
    _sl_mat = _heat_matrix(sl_teams)
    _sl2_mat = _heat_matrix(sl2_teams)

    _fig = make_subplots(
        rows=1,
        cols=3,
        subplot_titles=(
            "SA — Team vs Opponent",
            "SL — Team vs Opponent",
            "SL2 — Team vs Opponent",
        ),
    )
    _fig.add_trace(
        go.Heatmap(
            z=_sa_mat,
            x=_labels,
            y=_labels,
            colorscale="Greens",
            showscale=False,
            name="SA",
        ),
        row=1,
        col=1,
    )
    _fig.add_trace(
        go.Heatmap(
            z=_sl_mat,
            x=_labels,
            y=_labels,
            colorscale="Blues",
            showscale=False,
            name="SL",
        ),
        row=1,
        col=2,
    )
    _fig.add_trace(
        go.Heatmap(
            z=_sl2_mat,
            x=_labels,
            y=_labels,
            colorscale="Oranges",
            showscale=False,
            name="SL2",
        ),
        row=1,
        col=3,
    )
    _fig.update_layout(
        height=460,
        xaxis_title="My team avg level",
        yaxis_title="Opponent avg level",
        xaxis2_title="My team avg level",
        yaxis2_title="Opponent avg level",
        xaxis3_title="My team avg level",
        yaxis3_title="Opponent avg level",
        plot_bgcolor="white",
        paper_bgcolor="white",
    )
    _fig.update_annotations(font_size=12)
    mo.ui.plotly(_fig)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        """
    Each cell is the number of team slots where **my team averaged X** and the
    **opponent averaged Y**. Balanced matches sit on the diagonal (X = Y).

    SL and SL2 cluster tightly along the diagonal — teams consistently face opponents of
    comparable average level. SA spreads widely off-diagonal, generating mismatched fixtures.
    """
    )
    return


@app.cell(hide_code=True)
def _(go, mo, sa_teams, sl2_teams, sl_teams):
    import random as _rnd

    _sa_s = sa_teams.sample(min(3000, sa_teams.height), seed=42)
    _sl_s = sl_teams.sample(min(3000, sl_teams.height), seed=99)
    _sl2_s = sl2_teams.sample(min(3000, sl2_teams.height), seed=123)

    _rnd.seed(42)
    _jitter = lambda vals, s=1.2: [v + _rnd.gauss(0, s) for v in vals]

    _fig = go.Figure()

    _dz_fill = "rgba(220,50,50,0.07)"
    _dz_line = dict(color="rgba(220,50,50,0.5)", width=1, dash="dash")
    _fig.add_shape(type="rect", x0=0,  y0= 20, x1=82, y1= 82, fillcolor=_dz_fill, line=_dz_line)
    _fig.add_shape(type="rect", x0=0,  y0=-82, x1=82, y1=-20, fillcolor=_dz_fill, line=_dz_line)
    _fig.add_shape(type="rect", x0=40, y0=-20, x1=82, y1= 20, fillcolor=_dz_fill, line=_dz_line)
    _fig.add_annotation(x=20, y=60, text="Opponents too strong", showarrow=False,
                        font=dict(color="rgba(180,30,30,0.85)", size=10))
    _fig.add_annotation(x=20, y=-60, text="Opponents too weak", showarrow=False,
                        font=dict(color="rgba(180,30,30,0.85)", size=10))
    _fig.add_annotation(x=61, y=15, text="Pair too mismatched", showarrow=False,
                        font=dict(color="rgba(180,30,30,0.9)", size=10),
                        bgcolor="rgba(255,255,255,0.75)", borderpad=3)

    _fig.add_trace(go.Scatter(
        x=_jitter(_sa_s["intra_gap"].to_list()),
        y=_jitter(_sa_s["opp_advantage"].to_list()),
        mode="markers",
        name="SA",
        marker=dict(color="#54A24B", opacity=0.25, size=4, symbol="circle"),
    ))
    _fig.add_trace(go.Scatter(
        x=_jitter(_sl_s["intra_gap"].to_list()),
        y=_jitter(_sl_s["opp_advantage"].to_list()),
        mode="markers",
        name="SL",
        marker=dict(color="#4C78A8", opacity=0.25, size=5, symbol="diamond"),
    ))
    _fig.add_trace(go.Scatter(
        x=_jitter(_sl2_s["intra_gap"].to_list()),
        y=_jitter(_sl2_s["opp_advantage"].to_list()),
        mode="markers",
        name="SL2",
        marker=dict(color="#F58518", opacity=0.25, size=5, symbol="triangle-up"),
    ))

    _fig.add_hline(y=0, line=dict(color="grey", width=1, dash="dot"))
    _fig.add_vline(x=40, line=dict(color="grey", width=1, dash="dot"))

    _fig.update_layout(
        height=500,
        xaxis_title="Intra-team gap (|my level − partner level|)",
        yaxis_title="Opponent advantage (opp avg − my team avg)",
        legend=dict(orientation="h", y=-0.12),
        plot_bgcolor="white",
        paper_bgcolor="white",
    )
    mo.ui.plotly(_fig)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        """
    **X-axis** — how mismatched the pair is internally (0 = identical level, ~80 = max gap).
    **Y-axis** — opponent advantage: positive = opponents are stronger, negative = you are stronger.

    The **red danger zones** flag any of three independent problems:
    - **Top strip** (y ≥ 20): facing much stronger opponents
    - **Bottom strip** (y ≤ -20): facing much weaker opponents
    - **Right strip** (x ≥ 40): large internal partner gap

    Both SL and SL2 keep the vast majority of match slots inside the central safe zone.
    """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("## Gender Balance")
    return


@app.cell(hide_code=True)
def _(go, mo, sa_match, sl2_match, sl_match):
    _SEX = ['M', 'M', 'F', 'M', 'F']

    def _player_sex(pid: str) -> str:
        idx = int(pid[1:]) - 1
        return _SEX[idx % len(_SEX)]

    def _team_type(ids: list[str]) -> str:
        sexes = [_player_sex(p) for p in ids]
        known = [s for s in sexes if s in ('M', 'F')]
        if len(known) < 2:
            return 'U'
        if all(s == 'M' for s in known):
            return 'MM'
        if all(s == 'F' for s in known):
            return 'FF'
        return 'MF'

    def _matchup_stats(match_df):
        counts = {'MM vs FF': 0, 'MF vs MF': 0, 'MF vs MM': 0, 'MF vs FF': 0, 'MM vs MM': 0, 'FF vs FF': 0}
        for row in match_df.iter_rows(named=True):
            t1 = _team_type(row['team1Players'].split('|'))
            t2 = _team_type(row['team2Players'].split('|'))
            pair = tuple(sorted([t1, t2]))
            if pair == ('FF', 'MM'):
                counts['MM vs FF'] += 1
            elif pair == ('MF', 'MF'):
                counts['MF vs MF'] += 1
            elif pair == ('MF', 'MM'):
                counts['MF vs MM'] += 1
            elif pair == ('FF', 'MF'):
                counts['MF vs FF'] += 1
            elif pair == ('MM', 'MM'):
                counts['MM vs MM'] += 1
            elif pair == ('FF', 'FF'):
                counts['FF vs FF'] += 1
        total = sum(counts.values())
        return {k: v / total * 100 for k, v in counts.items()}

    _sa_pct = _matchup_stats(sa_match)
    _sl_pct = _matchup_stats(sl_match)
    _sl2_pct = _matchup_stats(sl2_match)

    _labels = ['MF vs MF', 'MF vs MM', 'MF vs FF', 'MM vs MM', 'FF vs FF', 'MM vs FF']
    _colors = ['#54A24B', '#7fb3d3', '#b3d9b3', '#aaaacc', '#f5c1a5', '#e45756']

    _fig = go.Figure()
    for _lbl, _col in zip(_labels, _colors):
        _fig.add_trace(go.Bar(
            name=_lbl,
            x=['SA', 'SL', 'SL2'],
            y=[_sa_pct[_lbl], _sl_pct[_lbl], _sl2_pct[_lbl]],
            marker_color=_col,
            text=[f"{_sa_pct[_lbl]:.1f}%", f"{_sl_pct[_lbl]:.1f}%", f"{_sl2_pct[_lbl]:.1f}%"],
            textposition='inside',
        ))

    _fig.update_layout(
        barmode='stack',
        height=400,
        yaxis_title="% of matches",
        legend=dict(orientation='h', y=-0.2),
        plot_bgcolor='white',
        paper_bgcolor='white',
    )
    mo.ui.plotly(_fig)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        """
    Each bar shows the gender composition of matches. The red segment (**MM vs FF**) is the
    undesirable case — one all-male team against one all-female team.

    **MF vs MF** is ideal mixed doubles.
    Both SL and SL2 strongly suppress MM vs FF matchups. SL2 further rewards MF vs MF pairings.
    """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("## Doubles Partner Heatmap")
    return


@app.cell(hide_code=True)
def _(go, make_subplots, mo, sa_pairs, sl2_pairs, sl_pairs):
    def _pidx(pid: str) -> int:
        return int(pid[1:]) - 1

    _pids: set = set()
    for _r in sa_pairs.iter_rows(named=True):
        _pids.update(_r["pairId"].split("|"))
    for _r in sl2_pairs.iter_rows(named=True):
        _pids.update(_r["pairId"].split("|"))
    _n = max(_pidx(p) for p in _pids) + 1
    _lbls = [f"P{i + 1}" for i in range(_n)]

    def _pmat(pairs_df, n):
        mat = [[0] * n for _ in range(n)]
        for row in pairs_df.iter_rows(named=True):
            ps = row["pairId"].split("|")
            if len(ps) == 2:
                i, j = _pidx(ps[0]), _pidx(ps[1])
                if i < n and j < n:
                    mat[i][j] = row["asTeammate"]
                    mat[j][i] = row["asTeammate"]
        return mat

    _sa_mat = _pmat(sa_pairs, _n)
    _sl_mat = _pmat(sl_pairs, _n)
    _sl2_mat = _pmat(sl2_pairs, _n)

    _fig = make_subplots(
        rows=1,
        cols=3,
        subplot_titles=(
            "SA — Doubles Partner Frequency",
            "SL — Doubles Partner Frequency",
            "SL2 — Doubles Partner Frequency",
        ),
    )
    _fig.add_trace(
        go.Heatmap(
            z=_sa_mat,
            x=_lbls,
            y=_lbls,
            colorscale="Greens",
            showscale=False,
        ),
        row=1,
        col=1,
    )
    _fig.add_trace(
        go.Heatmap(
            z=_sl_mat,
            x=_lbls,
            y=_lbls,
            colorscale="Blues",
            showscale=False,
        ),
        row=1,
        col=2,
    )
    _fig.add_trace(
        go.Heatmap(
            z=_sl2_mat,
            x=_lbls,
            y=_lbls,
            colorscale="Oranges",
            colorbar=dict(title="Times"),
        ),
        row=1,
        col=3,
    )
    _fig.update_layout(
        height=520,
        xaxis_title="Player",
        yaxis_title="Player",
        xaxis2_title="Player",
        yaxis2_title="Player",
        xaxis3_title="Player",
        yaxis3_title="Player",
        plot_bgcolor="white",
        paper_bgcolor="white",
    )
    _fig.update_annotations(font_size=12)
    mo.ui.plotly(_fig)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        """
    Each cell shows how many times two players appeared as doubles partners **cumulatively across all 200 simulation sessions combined** (50 runs × 4 player cohorts).

    - **Heatmap values vs. within-session repeats**: A count of ~100–150 means the engine consistently selected those two players as partners across separate tournament runs (~0.6× per session). Within each individual 10-round tournament run, players almost never repeat (**99.5% zero-repeat rate for SL2**).
    - **SA** pairs across tiers to balance wins/losses.
    - **SL** concentrates pairings into rigid same-tier blocks along the diagonal, creating isolated skill pods.
    - **SL2** circulates players across adjacent skill tiers via sliding windows, diffusing the sharp isolation clusters of SL while preserving match balance.
    """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("## Partner Repeat Frequency")
    return


@app.cell(hide_code=True)
def _(go, mo, sa_config, sa_pairs, sl2_pairs, sl_pairs):
    _runs = sa_config.get("runs", 50)
    _n_counts = len(sa_config.get("playerCounts", [20]))
    _total_sims = _runs * _n_counts

    def _rate_buckets(pairs_df):
        rates = [v / _total_sims for v in pairs_df["asTeammate"].to_list()]
        n = len(rates)
        labels = ["< 0.25×", "0.25–0.50×", "0.50–0.75× (optimal)", "0.75–1.00×", "≥ 1.00×"]
        pcts = [
            sum(1 for r in rates if r < 0.25) / n * 100,
            sum(1 for r in rates if 0.25 <= r < 0.50) / n * 100,
            sum(1 for r in rates if 0.50 <= r < 0.75) / n * 100,
            sum(1 for r in rates if 0.75 <= r < 1.00) / n * 100,
            sum(1 for r in rates if r >= 1.00) / n * 100,
        ]
        return labels, pcts

    _labels, _sa_pcts = _rate_buckets(sa_pairs)
    _, _sl_pcts = _rate_buckets(sl_pairs)
    _, _sl2_pcts = _rate_buckets(sl2_pairs)

    _fig = go.Figure()
    _fig.add_trace(go.Bar(x=_labels, y=_sa_pcts, name="SA", marker_color="#54A24B", opacity=0.85))
    _fig.add_trace(go.Bar(x=_labels, y=_sl_pcts, name="SL", marker_color="#4C78A8", opacity=0.85))
    _fig.add_trace(go.Bar(x=_labels, y=_sl2_pcts, name="SL2", marker_color="#F58518", opacity=0.85))
    _fig.update_layout(
        height=380,
        barmode="group",
        legend=dict(orientation="h", y=-0.18),
        title_text="Average Partnerships per Session (across all player pairs)",
        xaxis_title="Times partnered per 10-round session (expected average = 0.67)",
        yaxis_title="% of all player pairs",
        plot_bgcolor="white",
        paper_bgcolor="white",
    )
    mo.ui.plotly(_fig)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        """
    In a 10-round session with 16 players across 4 courts, there are 80 partnership slots among 120 possible pairs,
    yielding a theoretical average of **~0.67 partnerships per session**.

    - **SA**: Spreads pairings broadly across 0.25–0.75× with no awareness of player levels.
    - **SL**: Polarized — many cross-level pairs rarely partner (< 0.50×), while same-level pairs partner frequently (≥ 0.75× and ≥ 1.00×).
    - **SL2**: Concentrates **over 55%** of all pairs in the ideal fair-pairing band (0.50–0.75×), ensuring everyone partners with everyone else at a balanced, predictable rate while avoiding within-session repeats.
    """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        """
## Team Variety

For each player, between consecutive rounds they both played, how many of the other 3 court-mates changed?

- **3 new** — completely fresh group (best variety)
- **2 new** — two new faces
- **1 new** — only one new player
- **0 new** — same 4 players on the same court again (no variety)

A good engine keeps the distribution concentrated at 2–3 so every round feels like a fresh experience.
"""
    )
    return


@app.cell(hide_code=True)
def _(go, mo, pl, sa_match, sl2_match, sl_match):
    def _variety_dist(match_df):
        from collections import Counter
        scores = []
        for sid in match_df["simulationId"].unique().sort().to_list():
            sim = match_df.filter(pl.col("simulationId") == sid)
            hist: dict = {}
            for row in sim.iter_rows(named=True):
                court = set(row["team1Players"].split("|") + row["team2Players"].split("|"))
                for p in court:
                    hist.setdefault(p, []).append((row["roundIndex"], frozenset(court - {p})))
            for rounds in hist.values():
                rounds.sort()
                for i in range(1, len(rounds)):
                    scores.append(len(rounds[i][1] - rounds[i - 1][1]))
        n = len(scores)
        cnt = Counter(scores)
        mk = max(cnt) if cnt else 0
        pcts = [cnt.get(k, 0) / n * 100 for k in range(mk + 1)]
        avg = sum(k * cnt.get(k, 0) for k in range(mk + 1)) / n if n else 0.0
        return pcts, avg

    _sa_p, _sa_avg = _variety_dist(sa_match)
    _sl_p, _sl_avg = _variety_dist(sl_match)
    _sl2_p, _sl2_avg = _variety_dist(sl2_match)

    _mb = max(len(_sa_p), len(_sl_p), len(_sl2_p)) - 1
    _sa_p += [0.0] * (_mb + 1 - len(_sa_p))
    _sl_p += [0.0] * (_mb + 1 - len(_sl_p))
    _sl2_p += [0.0] * (_mb + 1 - len(_sl2_p))
    _bkts = [str(i) for i in range(_mb + 1)]

    _fig = go.Figure()
    _fig.add_trace(
        go.Bar(
            x=_bkts,
            y=_sa_p,
            name=f"SA (avg {_sa_avg:.2f}/3)",
            marker_color="#54A24B",
            opacity=0.85,
        )
    )
    _fig.add_trace(
        go.Bar(
            x=_bkts,
            y=_sl_p,
            name=f"SL (avg {_sl_avg:.2f}/3)",
            marker_color="#4C78A8",
            opacity=0.85,
        )
    )
    _fig.add_trace(
        go.Bar(
            x=_bkts,
            y=_sl2_p,
            name=f"SL2 (avg {_sl2_avg:.2f}/3)",
            marker_color="#F58518",
            opacity=0.85,
        )
    )
    _fig.update_layout(
        height=400,
        barmode="group",
        legend=dict(orientation="h", y=-0.18),
        xaxis_title="New court-mates vs previous round (out of 3)",
        yaxis_title="% of consecutive match pairs",
        plot_bgcolor="white",
        paper_bgcolor="white",
    )
    mo.ui.plotly(_fig)
    return


if __name__ == "__main__":
    app.run()
