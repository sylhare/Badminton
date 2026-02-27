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
    gl_dir = data_dir / "gl_algo"

    sa_match = pl.read_csv(sa_dir / "match_events.csv")
    gl_match = pl.read_csv(gl_dir / "match_events.csv")
    sa_pairs = pl.read_csv(sa_dir / "match_pair_summary.csv")
    gl_pairs = pl.read_csv(gl_dir / "match_pair_summary.csv")
    sa_summary = pl.read_csv(sa_dir / "summary.csv")
    gl_summary = pl.read_csv(gl_dir / "summary.csv")
    sa_config = json.loads((sa_dir / "config.json").read_text())
    gl_config = json.loads((gl_dir / "config.json").read_text())

    return (
        gl_config,
        gl_match,
        gl_pairs,
        gl_summary,
        sa_config,
        sa_match,
        sa_pairs,
        sa_summary,
    )


@app.cell(hide_code=True)
def _(mo, sa_config):
    _runs = sa_config.get("runs", 50)
    _rounds = sa_config.get("rounds", 16)
    _counts = ", ".join(str(c) for c in sa_config.get("playerCounts", []))
    mo.md(
        f"""
    # Smart Matching (GL) vs Simulated Annealing (SA)

    Comparing the standard SA engine against the Gender/Level-aware GL engine across
    **{_runs} simulations × {_rounds} rounds** for player counts [{_counts}].

    Players are assigned a **sex** (60% M / 40% F) and a **skill level** (1–5 → 20–100).
    The GL engine uses these to avoid gender-homogeneous courts and minimise level gaps between teams.

    ---
    """
    )
    return


@app.cell(hide_code=True)
def _(gl_config, mo, sa_config):
    _sa_zero = sa_config["aggregateStats"]["zeroRepeatRate"]
    _gl_zero = gl_config["aggregateStats"]["zeroRepeatRate"]
    _sa_diff = sa_config["levelBasedBalance"]["avgStrengthDifferential"]
    _gl_diff = gl_config["levelBasedBalance"]["avgStrengthDifferential"]
    _sa_win = sa_config["levelBasedBalance"]["strongerTeamWinRate"]
    _gl_win = gl_config["levelBasedBalance"]["strongerTeamWinRate"]
    mo.md(
        f"""
    | Metric | SA | GL |
    |:-------|---:|---:|
    | Zero-repeat rate | {_sa_zero:.1f}% | {_gl_zero:.1f}% |
    | Avg strength differential | {_sa_diff:.2f} | {_gl_diff:.2f} |
    | Stronger-team win rate | {_sa_win:.1f}% | {_gl_win:.1f}% |
    """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("## Repeats")
    return


@app.cell(hide_code=True)
def _(gl_summary, go, make_subplots, mo, pl, sa_summary):
    _n = sa_summary.height
    _sa_zero_pct = sa_summary.filter(pl.col("repeatPairCount") == 0).height / _n * 100
    _gl_zero_pct = gl_summary.filter(pl.col("repeatPairCount") == 0).height / _n * 100

    _fig = make_subplots(
        rows=1,
        cols=2,
        subplot_titles=("Zero-Repeat Rate (%)", "Repeat Count per Run"),
    )

    _fig.add_trace(
        go.Bar(
            x=["SA", "GL"],
            y=[round(_sa_zero_pct, 1), round(_gl_zero_pct, 1)],
            marker_color=["#54A24B", "#4C78A8"],
            text=[f"{_sa_zero_pct:.1f}%", f"{_gl_zero_pct:.1f}%"],
            textposition="outside",
            showlegend=False,
        ),
        row=1,
        col=1,
    )
    _max_repeats = max(
        sa_summary["repeatPairCount"].max(),
        gl_summary["repeatPairCount"].max(),
    )
    _buckets = list(range(0, _max_repeats + 1))
    _sa_counts = sa_summary["repeatPairCount"].value_counts().sort("repeatPairCount")
    _gl_counts = gl_summary["repeatPairCount"].value_counts().sort("repeatPairCount")
    _sa_map = dict(zip(_sa_counts["repeatPairCount"].to_list(), _sa_counts["count"].to_list()))
    _gl_map = dict(zip(_gl_counts["repeatPairCount"].to_list(), _gl_counts["count"].to_list()))

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
            y=[_gl_map.get(b, 0) for b in _buckets],
            name="GL",
            marker_color="#4C78A8",
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
    Both engines avoid repeat pairings well. GL shows a slightly higher repeat rate because
    its level/gender constraints narrow the valid partner pool, occasionally forcing the same
    pair together again.
    """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("## Pair Likelihood & Diversity")
    return


@app.cell(hide_code=True)
def _(gl_pairs, go, make_subplots, mo, pl, sa_pairs):
    _sa = sa_pairs.with_columns(
        (pl.col("asTeammate") / pl.col("totalMatches")).alias("teammate_ratio")
    )
    _gl = gl_pairs.with_columns(
        (pl.col("asTeammate") / pl.col("totalMatches")).alias("teammate_ratio")
    )
    _sa_ratio = _sa["teammate_ratio"].to_list()
    _gl_ratio = _gl["teammate_ratio"].to_list()

    _fig = make_subplots(
        rows=1,
        cols=2,
        subplot_titles=(
            "Teammate Rate per Pair (fraction of shared courts)",
            "Distribution Spread (Box Plot)",
        ),
    )

    # SA: solid fill — tight spike around 0.33
    _fig.add_trace(
        go.Histogram(
            x=_sa_ratio,
            name="SA",
            marker_color="#54A24B",
            opacity=0.85,
            xbins=dict(start=0, end=1, size=0.025),
        ),
        row=1,
        col=1,
    )
    # GL: outline only — wide spread showing level clustering
    _fig.add_trace(
        go.Histogram(
            x=_gl_ratio,
            name="GL",
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
        go.Box(y=_sa_ratio, name="SA", marker_color="#54A24B", showlegend=False),
        row=1,
        col=2,
    )
    _fig.add_trace(
        go.Box(y=_gl_ratio, name="GL", marker_color="#4C78A8", showlegend=False),
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
    **SA** assigns all pairs an almost identical teammate probability (~33%, std = 0.016) —
    every pair is equally likely to be teammates or opponents regardless of skill.

    **GL** polarises pairs by level: compatible-level pairs end up as teammates far more often
    (ratio up to 0.87), while cross-level pairs are rarely teammates (ratio as low as 0.05).
    The spread of the teammate rate is **10× wider** for GL (std = 0.16 vs 0.016).
    """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("## Match Level Spread")
    return


@app.cell(hide_code=True)
def _(gl_match, go, make_subplots, mo, sa_match):
    _sa_lvl = sa_match["matchAvgLevel"].to_list()
    _gl_lvl = gl_match["matchAvgLevel"].to_list()
    _sa_std = sa_match["matchAvgLevel"].std()
    _gl_std = gl_match["matchAvgLevel"].std()
    _sa_mean = sa_match["matchAvgLevel"].mean()
    _gl_mean = gl_match["matchAvgLevel"].mean()

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
            opacity=0.7,
            marker_color="#54A24B",
            xbins=dict(start=15, size=5),
        ),
        row=1,
        col=1,
    )
    _fig.add_trace(
        go.Histogram(
            x=_gl_lvl,
            name=f"GL (σ={_gl_std:.1f})",
            opacity=0.7,
            marker_color="#4C78A8",
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
        go.Box(y=_gl_lvl, name="GL", marker_color="#4C78A8", showlegend=False),
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
def _(gl_match, mo, sa_match):
    _sa_std = sa_match["matchAvgLevel"].std()
    _gl_std = gl_match["matchAvgLevel"].std()
    mo.md(
        f"""
    GL's histogram **pulsates** — peaks at the natural skill tiers (20, 40, 60, 80, 100)
    with valleys in between. This is expected: GL actively groups same-level players on the
    same court, so most courts end up at a pure tier average rather than a blend.
    The larger σ (**{_gl_std:.1f}** vs **{_sa_std:.1f}** for SA) reflects this tier
    segregation — some courts are all-beginners, others all-advanced.
    SA mixes levels randomly, filling in the gaps between tiers and producing a smoother,
    narrower distribution centred near the population mean (~44).
    """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("## Level Balance (Strength Differential)")
    return


@app.cell(hide_code=True)
def _(gl_match, go, make_subplots, mo, sa_match):
    _sa_diff = sa_match["strengthDifferential"].to_list()
    _gl_diff = gl_match["strengthDifferential"].to_list()
    _sa_mean = sa_match["strengthDifferential"].mean()
    _gl_mean = gl_match["strengthDifferential"].mean()

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
    _gl_pct = _buckets(_gl_diff)

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
        go.Bar(x=_labels, y=_gl_pct, name="GL", marker_color="#4C78A8", opacity=0.85),
        row=1,
        col=1,
    )
    _fig.add_trace(
        go.Histogram(
            x=_sa_diff,
            name=f"SA (μ={_sa_mean:.2f})",
            opacity=0.75,
            marker_color="#54A24B",
            xbins=dict(start=-0.5, size=1),
            showlegend=False,
        ),
        row=1,
        col=2,
    )
    _fig.add_trace(
        go.Histogram(
            x=_gl_diff,
            name=f"GL (μ={_gl_mean:.2f})",
            opacity=0.75,
            marker_color="#4C78A8",
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
def _(gl_match, mo, pl, sa_match):
    _sa_mean = sa_match["strengthDifferential"].mean()
    _gl_mean = gl_match["strengthDifferential"].mean()
    _sa_zero_pct = (
        sa_match.filter(pl.col("strengthDifferential") == 0).height
        / sa_match.height
        * 100
    )
    _gl_zero_pct = (
        gl_match.filter(pl.col("strengthDifferential") == 0).height
        / gl_match.height
        * 100
    )
    _ratio = _sa_mean / _gl_mean
    mo.md(
        f"""
    This is the biggest win for GL. **{_gl_zero_pct:.0f}%** of GL matches have perfectly
    balanced teams (diff = 0) vs **{_sa_zero_pct:.0f}%** for SA. The average strength
    differential drops from **{_sa_mean:.2f}** (SA) to **{_gl_mean:.2f}** (GL) —
    a **{_ratio:.1f}×** improvement. The GL engine explicitly minimises the skill gap
    between opposing teams, making games far more competitive.
    """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("## Partner Imbalance")
    return


@app.cell
def _(gl_match, pl, sa_match):
    # Use actual jittered levels stored per-match (team1IntraGap, team1AvgLevel, etc.)
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
    gl_teams = _team_stats(gl_match)
    return gl_teams, sa_teams


@app.cell(hide_code=True)
def _(gl_teams, go, make_subplots, mo, pl, sa_teams):
    # danger zone: ANY of:
    #   - large intra-team gap (partners mismatched internally), OR
    #   - much stronger opponents (opp_advantage >= threshold), OR
    #   - much weaker opponents (opp_advantage <= -threshold, bad for them)
    # 100+0  vs 100+100 → intra_gap=100, opp_advantage=+50 → bad (gap + strong opp)
    # 100+0  vs  10+ 10 → intra_gap=100, opp_advantage=-40 → bad (gap + weak opp)
    #  60+20 vs  50+100 → intra_gap= 40, opp_advantage=+35 → bad (slight gap + strong opp)
    #  40+40 vs  90+ 90 → intra_gap=  0, opp_advantage=+50 → bad (balanced pair, but hopelessly outmatched)
    # 100+0  vs  50+ 50 → intra_gap=100, opp_advantage=  0 → still bad (big gap, even if overall balanced)
    _GAP = 40
    _ADV = 20

    def _danger_pct(teams):
        _bad = teams.filter(
            (pl.col("intra_gap") >= _GAP) | (pl.col("opp_advantage").abs() >= _ADV)
        )
        return _bad.height / teams.height * 100

    _sa_d = _danger_pct(sa_teams)
    _gl_d = _danger_pct(gl_teams)

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
            opacity=0.85,
            xbins=dict(start=0, size=10),
        ),
        row=1,
        col=1,
    )
    _fig.add_trace(
        go.Histogram(
            x=gl_teams["intra_gap"].to_list(),
            name="GL",
            marker=dict(color="rgba(0,0,0,0)", line=dict(color="#4C78A8", width=2)),
            xbins=dict(start=0, size=10),
        ),
        row=1,
        col=1,
    )
    _fig.add_trace(
        go.Bar(
            x=["SA", "GL"],
            y=[round(_sa_d, 2), round(_gl_d, 2)],
            marker_color=["#54A24B", "#4C78A8"],
            text=[f"{_sa_d:.2f}%", f"{_gl_d:.2f}%"],
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
    GL's level-pair bias pairs similar-level players together, so most teammates
    are within 20 points. SA assigns partners randomly — mismatched pairs (60+ gap)
    are much more common.

    **Danger Zone**: share of team slots that fall outside the safe zone — flagged when ANY of:
    a large internal pair gap (≥ 40), facing much stronger opponents (advantage ≥ 20), or
    facing much weaker opponents (advantage ≤ -20). Even a balanced pair in a hopelessly
    uneven match counts. GL produces significantly fewer such slots than SA.
    """
    )
    return


@app.cell(hide_code=True)
def _(gl_teams, go, make_subplots, mo, pl, sa_teams):
    # 9×9 heatmap: team avg level vs opponent avg level
    # Balanced matches sit on the diagonal; off-diagonal = mismatch
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
    _gl_mat = _heat_matrix(gl_teams)

    _fig = make_subplots(
        rows=1,
        cols=2,
        subplot_titles=(
            "SA — Team vs Opponent avg level",
            "GL — Team vs Opponent avg level",
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
            z=_gl_mat,
            x=_labels,
            y=_labels,
            colorscale="Blues",
            showscale=False,
            name="GL",
        ),
        row=1,
        col=2,
    )
    _fig.update_layout(
        height=460,
        xaxis_title="My team avg level",
        yaxis_title="Opponent avg level",
        xaxis2_title="My team avg level",
        yaxis2_title="Opponent avg level",
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

    GL clusters tightly on the diagonal — teams almost always face opponents of
    the same average level. SA spreads off-diagonal, producing many unequal matchups
    where one team is systematically stronger.
    """
    )
    return


@app.cell(hide_code=True)
def _(gl_teams, go, mo, sa_teams):
    import random as _rnd

    # Scatter: intra_gap (x) vs opp_advantage (y)
    # Top-right danger zone: big teammate mismatch AND facing stronger opponents
    _sa_s = sa_teams.sample(min(3000, sa_teams.height), seed=42)
    _gl_s = gl_teams.sample(min(3000, gl_teams.height), seed=99)

    _rnd.seed(42)
    _jitter = lambda vals, s=1.2: [v + _rnd.gauss(0, s) for v in vals]

    _fig = go.Figure()

    # Danger zones (OR condition — any one is enough):
    #   top strip    : opp_advantage >= +20 (facing much stronger opponents, any pair balance)
    #   bottom strip : opp_advantage <= -20 (facing much weaker opponents, any pair balance)
    #   right strip  : intra_gap >= 40     (large internal gap, any match balance)
    _dz_fill = "rgba(220,50,50,0.07)"
    _dz_line = dict(color="rgba(220,50,50,0.5)", width=1, dash="dash")
    _fig.add_shape(type="rect", x0=0,  y0= 20, x1=82, y1= 82, fillcolor=_dz_fill, line=_dz_line)  # top strip
    _fig.add_shape(type="rect", x0=0,  y0=-82, x1=82, y1=-20, fillcolor=_dz_fill, line=_dz_line)  # bottom strip
    _fig.add_shape(type="rect", x0=40, y0=-20, x1=82, y1= 20, fillcolor=_dz_fill, line=_dz_line)  # right middle strip
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
        x=_jitter(_gl_s["intra_gap"].to_list()),
        y=_jitter(_gl_s["opp_advantage"].to_list()),
        mode="markers",
        name="GL",
        marker=dict(color="#4C78A8", opacity=0.25, size=5, symbol="diamond"),
    ))

    # Reference lines
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

    The **red danger zones** flag any of three independent problems (OR condition):
    - **Top strip** (y ≥ 20): facing much stronger opponents regardless of pair balance — e.g. 40+40 vs 90+90
    - **Bottom strip** (y ≤ -20): facing much weaker opponents regardless of pair balance — unfair for them
    - **Right strip** (x ≥ 40): large internal gap regardless of match balance — e.g. 100+0 vs 50+50

    The **safe zone** is the centre rectangle: balanced pair *and* a fair match.
    GL keeps far more team slots in that safe zone than SA.
    """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("## Gender Balance")


@app.cell(hide_code=True)
def _(go, mo, pl, sa_match, gl_match):
    # Sex pattern matches simulation/utils.ts SEX_PATTERN = ['M', 'M', 'F', 'M', 'F']
    _SEX = ['M', 'M', 'F', 'M', 'F']

    def _player_sex(pid: str) -> str:
        idx = int(pid[1:]) - 1  # "P3" → 2
        return _SEX[idx % len(_SEX)]

    def _team_type(ids: list[str]) -> str:
        """Classify a team ignoring Unknown players."""
        sexes = [_player_sex(p) for p in ids]
        known = [s for s in sexes if s in ('M', 'F')]
        if len(known) < 2:
            return 'U'   # one or both unknown
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
            # U-type teams (unknown sex) are ignored — not present in simulation
        total = sum(counts.values())
        return {k: v / total * 100 for k, v in counts.items()}

    _sa_pct = _matchup_stats(sa_match)
    _gl_pct = _matchup_stats(gl_match)

    _labels = ['MF vs MF', 'MF vs MM', 'MF vs FF', 'MM vs MM', 'FF vs FF', 'MM vs FF']
    _colors = ['#54A24B', '#7fb3d3', '#b3d9b3', '#aaaacc', '#f5c1a5', '#e45756']  # red for bad

    _fig = go.Figure()
    for _lbl, _col in zip(_labels, _colors):
        _fig.add_trace(go.Bar(
            name=_lbl,
            x=['SA', 'GL'],
            y=[_sa_pct[_lbl], _gl_pct[_lbl]],
            marker_color=_col,
            text=[f"{_sa_pct[_lbl]:.1f}%", f"{_gl_pct[_lbl]:.1f}%"],
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
    bad case — one all-male team against one all-female team.

    **MF vs MF** is the ideal — both teams are mixed gender.
    **MF vs MM** and **MF vs FF** are fine — at least one team has a balanced mix.
    **MM vs MM** and **FF vs FF** are neutral same-gender mirrors, neither good nor bad.

    GL's `GENDER_MISMATCH_PENALTY` strongly suppresses MM vs FF matchups.
    SA has no gender awareness, so they occur naturally from the player sex distribution.
    """
    )
    return


if __name__ == "__main__":
    app.run()
