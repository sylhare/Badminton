import marimo

__generated_with = "0.19.4"
app = marimo.App(width="medium")


@app.cell
def _():
    import math
    import random
    import marimo as mo
    import plotly.graph_objects as go
    from plotly.subplots import make_subplots
    return go, make_subplots, math, mo, random


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        # Level Tracker — Simulation & Analysis

        Python reimplementation of `src/engines/LevelTracker.ts` to visualise and simulate
        how the Elo-style rating system behaves across different scenarios.

        Player levels are automatically adjusted after each round of games using an Elo-style
        algorithm. When new court assignments are generated, the app looks at any courts where
        a winner was recorded in the previous round and updates every player's level accordingly.
        Scores per court are **optional** — if no score is entered, a close victory is assumed
        (smallest rating change).

        Level and average-score updates occur **only when new assignments are generated** (the
        "Regenerate Assignments" button is clicked). The update sequence is:

        1. Record win history for the engine (`recordCurrentWins`)
        2. Collect all courts that have a winner → apply level deltas via `updatePlayersLevels`
        3. Save updated players to state (and localStorage via the existing save effect)
        4. Generate new assignments using the freshly updated player levels

        | Section | What it shows |
        |---|---|
        | **1 · K-Factor** | How score margin maps to rating magnitude |
        | **2 · Balance Factor** | How within-team level spread scales down effective K |
        | **3 · Elo Delta** | Per-team rating changes across matchup combinations |
        | **4 · Average Score** | Per-player running score average tracking |
        | **5 · Convergence** | How player levels stabilise over repeated games |
        """
    )
    return


# =============================================================================
# LevelTracker — Python implementation
# =============================================================================

@app.cell
def _(math, random):
    def get_k_raw(score=None, winner=None):
        """Raw K-factor from score margin only (no balance adjustment).

        K-factor scale (winner score must be exactly 21):
          deuce / winner ≠ 21  → 6
          loser 18–20 (diff ≤ 3) → 8
          loser 15–17 (diff 4–6) → 12
          loser 11–14 (diff 7–10) → 16
          loser  6–10 (diff 11–15) → 20
          loser   < 6 (diff > 15) → 24
        Returns 6 when no score is available (same as deuce).
        """
        if score is None or winner is None:
            return 6
        w = score["team1"] if winner == 1 else score["team2"]
        lo = score["team2"] if winner == 1 else score["team1"]
        if w != 21:
            return 6
        diff = 21 - lo
        if diff <= 3:  return 8
        if diff <= 6:  return 12
        if diff <= 10: return 16
        if diff <= 15: return 20
        return 24

    def balance_factor(levels):
        """Balance factor in [0.5, 1.0].

        1.0 = perfectly balanced team or singles (no reduction).
        0.5 = maximally unbalanced team [0, 100] (K halved).

        Formula:
          avg      = mean(levels)
          variance = mean((lv - avg)^2)
          bf       = 1 - 0.5 * clamp(sqrt(variance) / 50, 0, 1)
        """
        if not levels or len(levels) <= 1:
            return 1.0
        avg = sum(levels) / len(levels)
        variance = sum((lv - avg) ** 2 for lv in levels) / len(levels)
        return 1.0 - 0.5 * min(1.0, math.sqrt(variance) / 50.0)

    def k_factor(score=None, winner=None, team_levels=None):
        """Effective K = raw_K × balance_factor(team)."""
        return get_k_raw(score, winner) * balance_factor(team_levels or [])

    def avg_level(levels):
        """Average level, defaulting None → 50."""
        if not levels:
            return 50.0
        return sum(lv if lv is not None else 50 for lv in levels) / len(levels)

    def win_prob(avg_a, avg_b):
        """Elo expected win probability for team A vs B (scale = 50).

        A 50-point gap → ~91% expected win probability for the stronger team.
        """
        return 1.0 / (1.0 + 10.0 ** ((avg_b - avg_a) / 50.0))

    def play_game(t1, t2, score=None, stochastic=False, rng=None):
        """Simulate one game between t1 and t2 (lists of player levels).

        Returns (new_t1, new_t2, winner).
        stochastic=True  → winner drawn from Elo probability.
        stochastic=False → stronger team always wins (deterministic).
        """
        avg1, avg2 = avg_level(t1), avg_level(t2)
        prob1 = win_prob(avg1, avg2)
        if stochastic:
            winner = 1 if (rng or random).random() < prob1 else 2
        else:
            winner = 1 if avg1 >= avg2 else 2
        exp1, exp2 = prob1, 1.0 - prob1
        act1 = 1.0 if winner == 1 else 0.0
        act2 = 1.0 - act1
        k1 = k_factor(score, winner, t1)
        k2 = k_factor(score, winner, t2)
        d1 = k1 * (act1 - exp1)
        d2 = k2 * (act2 - exp2)
        new_t1 = [round(max(0.0, min(100.0, lv + d1)) * 10) / 10 for lv in t1]
        new_t2 = [round(max(0.0, min(100.0, lv + d2)) * 10) / 10 for lv in t2]
        return new_t1, new_t2, winner

    return avg_level, balance_factor, get_k_raw, k_factor, play_game, win_prob


# =============================================================================
# 1 · K-Factor by Score Margin
# =============================================================================

@app.cell(hide_code=True)
def _(mo):
    mo.md("---\n## 1 · K-Factor by Score Margin")
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        The K-factor controls how much a single game result affects a player's level.
        It is derived from the score margin (winner score must be exactly 21):

        | Condition | K |
        |---|---|
        | No score entered | 8 |
        | Winner score > 21 (deuce) | 6 |
        | Winner score = 21, loser 18–20 (diff ≤ 3) | 8 |
        | Winner score = 21, loser 15–17 (diff 4–6) | 12 |
        | Winner score = 21, loser 11–14 (diff 7–10) | 16 |
        | Winner score = 21, loser 6–10 (diff 11–15) | 20 |
        | Winner score = 21, loser < 6 (diff > 15) | 24 |
        """
    )
    return


@app.cell(hide_code=True)
def _(get_k_raw, go, make_subplots, mo):
    _K_COLOR = {
        6:  "#90CAF9",  # light blue  – deuce, closest win
        8:  "#A5D6A7",  # light green – close win
        12: "#FFF176",  # yellow
        16: "#FFCC80",  # orange
        20: "#EF9A9A",  # light red
        24: "#B71C1C",  # dark red    – dominant win
    }

    # Left: one bar per scenario (loser score 0-20, deuce, no score)
    _loser_scores = list(range(0, 21))
    _ks_main = [get_k_raw({"team1": 21, "team2": ls}, 1) for ls in _loser_scores]
    _k_deuce = get_k_raw({"team1": 22, "team2": 20}, 1)
    _k_none  = get_k_raw()
    _all_x   = [str(ls) for ls in _loser_scores] + ["deuce", "—"]
    _all_k   = _ks_main + [_k_deuce, _k_none]
    _colors  = [_K_COLOR[k] for k in _all_k]

    # Right: grouped summary by score band
    _band_x  = ["< 6", "6–10", "11–14", "15–17", "18–20", "deuce", "no score"]
    _band_k  = [24, 20, 16, 12, 8, 6, 6]
    _band_c  = [_K_COLOR[k] for k in _band_k]

    _fig = make_subplots(
        rows=1, cols=2,
        subplot_titles=("K-factor per loser score (winner = 21)", "K-factor by score band"),
        column_widths=[0.65, 0.35],
    )
    _fig.add_trace(
        go.Bar(
            x=_all_x, y=_all_k,
            marker_color=_colors,
            text=[str(k) for k in _all_k], textposition="outside",
            showlegend=False,
        ),
        row=1, col=1,
    )
    _fig.add_trace(
        go.Bar(
            x=_band_x, y=_band_k,
            marker_color=_band_c,
            text=[str(k) for k in _band_k], textposition="outside",
            showlegend=False,
        ),
        row=1, col=2,
    )
    _fig.update_layout(
        height=380,
        plot_bgcolor="white", paper_bgcolor="white",
        yaxis=dict(range=[0, 28], title="K-factor", gridcolor="#eee"),
        yaxis2=dict(range=[0, 28], gridcolor="#eee"),
        xaxis_title="Loser score",
        xaxis2_title="Loser score range",
        margin=dict(t=50, b=50),
    )
    mo.ui.plotly(_fig)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        """
        A **deuce win** (e.g. 22–20) scores the lowest K = 6 — even lower than a tight 21–18 —
        because it is the closest possible victory in badminton.
        A **dominant win** (21–0) scores K = 24, triggering the largest rating swing.
        When **no score** is recorded, K defaults to 6 (same as deuce).
        """
    )
    return


# =============================================================================
# 2 · Balance Factor
# =============================================================================

@app.cell(hide_code=True)
def _(mo):
    mo.md("---\n## 2 · Balance Factor")
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        When a team is level-unbalanced (e.g. [0, 100]), the match result is driven largely
        by partner variance rather than individual skill. Applying the full K-factor would
        over-punish strong players dragged down by a weak partner, and over-reward weak players
        carried by a strong one. To address this, the effective K-factor is scaled down based
        on the team's level spread:

        ```
        stdDev(team)    = sqrt(mean of squared distances from team avg)
                          For 2 players [a, b]: stdDev = |a − b| / 2

        imbalanceFactor = clamp(stdDev / 50, 0, 1)
                          0 = perfectly balanced, 1 = maximally unbalanced [0, 100]

        balanceFactor   = 1 − 0.5 × imbalanceFactor
                          Range: 1.0 (balanced) → 0.5 (max imbalance)

        effectiveK      = K × balanceFactor
        ```

        | Team        | stdDev | imbalanceFactor | balanceFactor | effectiveK (K=8) |
        |-------------|--------|-----------------|---------------|------------------|
        | [50, 50]    | 0      | 0.0             | 1.00          | 8.0              |
        | [50, 60]    | 5      | 0.1             | 0.95          | 7.6              |
        | [40, 80]    | 20     | 0.4             | 0.80          | 6.4              |
        | [0, 100]    | 50     | 1.0             | 0.50          | 4.0              |
        | singles [80]| 0      | 0.0             | 1.00          | 8.0              |

        Singles (1-player team) are unaffected (balanceFactor = 1.0). Each team gets its own
        balance-adjusted K independently.
        """
    )
    return


@app.cell(hide_code=True)
def _(balance_factor, go, make_subplots, mo):
    # For a 2-player team [50−s/2, 50+s/2], spread = s, stdDev = s/2
    _spreads = list(range(0, 101))
    _bfs     = [balance_factor([50 - s / 2, 50 + s / 2]) for s in _spreads]

    _RAW_KS  = [8, 12, 16, 20, 24]
    _EFF_COLORS = ["#A5D6A7", "#FFF176", "#FFCC80", "#EF9A9A", "#B71C1C"]

    _KEY_POINTS = [
        (0,   "[50, 50]"),
        (10,  "[45, 55]"),
        (40,  "[30, 70]"),
        (100, "[0, 100]"),
    ]

    _fig = make_subplots(
        rows=1, cols=2,
        subplot_titles=(
            "Balance factor vs team spread",
            "Effective K vs team spread (per raw K)",
        ),
    )

    # Left: balance factor curve
    _fig.add_trace(
        go.Scatter(
            x=_spreads, y=_bfs,
            mode="lines",
            line=dict(color="#4C78A8", width=2.5),
            fill="tozeroy", fillcolor="rgba(76,120,168,0.1)",
            showlegend=False,
        ),
        row=1, col=1,
    )
    for _s, _lbl in _KEY_POINTS:
        _bf = balance_factor([50 - _s / 2, 50 + _s / 2])
        _fig.add_annotation(
            x=_s, y=_bf,
            text=f"<b>{_lbl}</b><br>bf={_bf:.2f}",
            showarrow=True, arrowhead=2, arrowsize=0.8,
            ax=30, ay=-30,
            font=dict(size=10),
            row=1, col=1,
        )

    # Right: effective K for each raw K
    for _rk, _col in zip(_RAW_KS, _EFF_COLORS):
        _fig.add_trace(
            go.Scatter(
                x=_spreads,
                y=[_rk * bf for bf in _bfs],
                mode="lines",
                name=f"raw K = {_rk}",
                line=dict(color=_col, width=2),
            ),
            row=1, col=2,
        )

    _fig.update_layout(
        height=420,
        plot_bgcolor="white", paper_bgcolor="white",
        legend=dict(x=0.56, y=0.98, bgcolor="rgba(255,255,255,0.8)", bordercolor="#ccc", borderwidth=1),
        xaxis=dict(title="Team level spread |L₁ − L₂|", gridcolor="#eee"),
        yaxis=dict(range=[0.45, 1.05], title="Balance factor", gridcolor="#eee"),
        xaxis2=dict(title="Team level spread |L₁ − L₂|", gridcolor="#eee"),
        yaxis2=dict(range=[0, 28], title="Effective K", gridcolor="#eee"),
        margin=dict(t=50),
    )
    mo.ui.plotly(_fig)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        """
        A balanced team [50, 50] has spread = 0 → **balance factor = 1.0** (no reduction).
        An extreme team [0, 100] has spread = 100 → **balance factor = 0.5** (K is halved).

        The right chart shows how all K tiers are equally scaled down — the reduction is
        proportional, so a dominant-win K = 24 drops to 12, and a close-win K = 8 drops to 4,
        for a maximally unbalanced team.
        """
    )
    return


# =============================================================================
# 3 · Elo Delta Simulations
# =============================================================================

@app.cell(hide_code=True)
def _(mo):
    mo.md("""---
## 3 · Elo Delta Simulations

The **Elo system** assigns each player a numeric level (0–100). After every game the winner
gains points and the loser loses the same amount. The size of the swing — the **Elo delta** —
is governed by two factors studied in the previous sections:

- **K-factor** (§ 1): larger for close games, smaller for dominant wins (K = 6 when no score
  is recorded, same as deuce).
- **Balance factor** (§ 2): scales K down when a team's two players have very different levels,
  reducing rating volatility for uneven pairings.

This section visualises the resulting Elo delta across the full range of team averages, within-team
spread, and balance-factor scenarios — **before** any real game sequence is run.
""")
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        ### Expected Win Probability

        Uses the standard Elo formula adapted for teams, with a scale factor of 50
        (instead of the chess standard of 400):

        ```
        teamAvg       = average level of team members  (undefined level → 50)
        expected(A)   = 1 / (1 + 10^((avgB − avgA) / 50))
        expected(B)   = 1 − expected(A)
        ```

        A scale factor of 50 makes the curve steeper than chess Elo — a 50-point level gap
        already translates to ~91% expected win probability for the stronger side.

        ### Level Delta

        ```
        actual   = 1  (won)  or  0  (lost)
        Δ        = K × (actual − expected)
        newLevel = clamp(currentLevel + Δ, 0, 100)   // rounded to 1 decimal
        ```

        **Worked example — dominant win (21-5)**

        | | Team A (avg level 70) | Team B (avg level 30) |
        |---|---|---|
        | K-factor (diff=16) | 20 | 20 |
        | Expected | 0.91 | 0.09 |
        | Actual | 1 (won) | 0 (lost) |
        | Δ | +20 × (1 − 0.91) = **+1.8** | +20 × (0 − 0.09) = **−1.8** |

        **Worked example — upset (21-19, weak beats strong)**

        | | Team A (avg level 30) | Team B (avg level 70) |
        |---|---|---|
        | K-factor (diff=2) | 8 | 8 |
        | Expected | 0.09 | 0.91 |
        | Actual | 1 (won) | 0 (lost) |
        | Δ | +8 × (1 − 0.09) = **+7.3** | +8 × (0 − 0.91) = **−7.3** |

        An upset causes a much larger level swing — the strong team that lost drops
        significantly, while the weak team that won gains significantly.

        **Worked example — expected win (21-15, strong beats weak)**

        | | Level-80 player | Level-60 opponent |
        |---|---|---|
        | K-factor (loser got 15, diff=6) | 12 | 12 |
        | Team avg | 80 | 60 |
        | Expected | 0.715 | 0.285 |
        | **Win** (actual=1) | **+3.4** → 83.4 | **−3.4** → 56.6 |
        | **Lose** (actual=0) | **−8.6** → 71.4 | **+8.6** → 68.6 |

        Note the asymmetry: an unexpected loss drops the stronger player far more than a win
        raises them.
        """
    )
    return


@app.cell(hide_code=True)
def _(avg_level, balance_factor, go, k_factor, make_subplots, mo, win_prob):
    # --- Heatmap: Δ(team1 wins) as function of both team averages (balanced, no score) ---
    _avgs = list(range(0, 101, 5))
    _delta_grid = []
    for _a1 in _avgs:
        _row = []
        for _a2 in _avgs:
            _exp1 = win_prob(_a1, _a2)
            _row.append(round(6.0 * (1.0 - _exp1), 2))  # K=6, balanced → bf=1
        _delta_grid.append(_row)

    # --- Line chart: team1=[50-s, 50+s] vs team2=[50,50], no score ---
    # Shows how spread reduces win/loss delta even when avg levels are equal
    _spreads_line = list(range(0, 51))
    _win_d, _loss_d = [], []
    for _s in _spreads_line:
        _t1 = [50.0 - _s, 50.0 + _s]
        _t2 = [50.0, 50.0]
        _e1 = win_prob(avg_level(_t1), avg_level(_t2))
        _k1 = k_factor(None, None, _t1)
        _win_d.append(round(_k1 * (1.0 - _e1), 3))
        _loss_d.append(round(_k1 * (0.0 - _e1), 3))

    # --- Bar: before/after balance factor — 5 key scenarios ---
    _scenarios = [
        ("[50,50] vs [50,50]",   [50, 50],   [50, 50]),
        ("[40,80] vs [50,50]",   [40, 80],   [50, 50]),
        ("[0,100] vs [50,50]",   [0, 100],   [50, 50]),
        ("[0,100] vs [0,100]",   [0, 100],   [0, 100]),
        ("[0,100] vs [40,60]",   [0, 100],   [40, 60]),
    ]
    _sc_labels = [s[0] for s in _scenarios]
    _sc_win_with = []
    _sc_win_without = []
    for _, _t1s, _t2s in _scenarios:
        _a1, _a2 = avg_level(_t1s), avg_level(_t2s)
        _ep = win_prob(_a1, _a2)
        _kw  = k_factor(None, None, _t1s)     # with balance factor
        _kwo = 6.0                              # without (raw K=6, balanced)
        _sc_win_with.append(round(_kw * (1.0 - _ep), 2))
        _sc_win_without.append(round(_kwo * (1.0 - _ep), 2))

    _fig = make_subplots(
        rows=2, cols=2,
        subplot_titles=(
            "Δ(team1 wins) — balanced teams, no score",
            "Δ vs spread — team1=[50±s] vs team2=[50,50]",
            "Win Δ with vs without balance factor (K=6, team1 wins)",
            "Balance factor for each scenario",
        ),
        vertical_spacing=0.18,
    )

    # Top-left: heatmap
    _fig.add_trace(
        go.Heatmap(
            x=_avgs, y=_avgs, z=_delta_grid,
            colorscale="RdYlGn",
            colorbar=dict(title="Δ level", x=0.46, len=0.45, y=0.78),
            zmin=-8, zmax=8,
        ),
        row=1, col=1,
    )

    # Top-right: spread impact line chart
    _fig.add_trace(
        go.Scatter(
            x=_spreads_line, y=_win_d,
            mode="lines", name="win Δ",
            line=dict(color="#2ca02c", width=2.5),
        ),
        row=1, col=2,
    )
    _fig.add_trace(
        go.Scatter(
            x=_spreads_line, y=_loss_d,
            mode="lines", name="loss Δ",
            line=dict(color="#d62728", width=2.5),
        ),
        row=1, col=2,
    )
    _fig.add_hline(y=0, line_dash="dot", line_color="#aaa", row=1, col=2)

    # Bottom-left: grouped bar — before vs after balance factor
    _fig.add_trace(
        go.Bar(
            x=_sc_labels, y=_sc_win_without,
            name="without bf", marker_color="#aec7e8",
            text=[str(v) for v in _sc_win_without], textposition="outside",
        ),
        row=2, col=1,
    )
    _fig.add_trace(
        go.Bar(
            x=_sc_labels, y=_sc_win_with,
            name="with bf", marker_color="#1f77b4",
            text=[str(v) for v in _sc_win_with], textposition="outside",
        ),
        row=2, col=1,
    )

    # Bottom-right: balance factors for each scenario
    _sc_bfs = [balance_factor(_t1s) for _, _t1s, _ in _scenarios]
    _fig.add_trace(
        go.Bar(
            x=_sc_labels, y=_sc_bfs,
            marker_color=["#4C78A8" if bf == 1.0 else "#E45756" for bf in _sc_bfs],
            text=[f"{bf:.2f}" for bf in _sc_bfs], textposition="outside",
            showlegend=False,
        ),
        row=2, col=2,
    )
    _fig.add_hline(y=1.0, line_dash="dot", line_color="#aaa", row=2, col=2)

    _fig.update_layout(
        height=750,
        barmode="group",
        plot_bgcolor="white", paper_bgcolor="white",
        legend=dict(x=0.56, y=0.98, bgcolor="rgba(255,255,255,0.8)", bordercolor="#ccc", borderwidth=1),
        xaxis=dict(title="Team 2 avg level", gridcolor="#eee"),
        yaxis=dict(title="Team 1 avg level", gridcolor="#eee"),
        xaxis2=dict(title="Spread s (team1 = [50−s, 50+s])", gridcolor="#eee"),
        yaxis2=dict(title="Δ level per player", gridcolor="#eee"),
        xaxis3=dict(tickangle=-15),
        yaxis3=dict(range=[0, 5], title="Win Δ", gridcolor="#eee"),
        xaxis4=dict(tickangle=-15),
        yaxis4=dict(range=[0, 1.1], title="Balance factor", gridcolor="#eee"),
        margin=dict(t=50, b=80),
    )
    mo.ui.plotly(_fig)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        """
**Figure 1 — Elo delta heatmap (balanced teams, no score).**
Each cell shows how many level points team 1's players gain when they win (K = 6, no score —
same as deuce). On the diagonal — equal-strength opponents — the delta is ~4.
An upset (bottom-right: weak team beats strong) yields the maximum gain (~8). A comfortable
expected win (top-left: strong team beats weak) yields near-zero gain because the outcome
was already anticipated.

**Figure 2 — Spread impact on delta.**
Team 1 always averages 50 but its internal spread grows from 0 (both players at 50) to ±50
(one at 0, one at 100). As spread increases, the balance factor lowers K, shrinking both the
win reward and the loss penalty. A maximally uneven team [0, 100] ends up with roughly half
the delta of a perfectly balanced team.

**Figure 3 — Win delta: with vs without balance factor.**
Five representative matchups compare the raw delta (K = 6, no balance factor, light blue)
against the adjusted delta (with balance factor, dark blue). Balanced teams ([50, 50] vs
[50, 50]) are unaffected (balance factor = 1). The more uneven team 1 is, the larger the
reduction — a [0, 100] pairing is cut by ~50 % regardless of the opponent.

**Figure 4 — Balance factor by scenario.**
The balance factor value for each matchup. Balanced teams score 1.0 (no reduction). A
[40, 80] pairing scores ~0.87. A [0, 100] pairing hits the 0.5 floor — rating changes are
halved, regardless of the result or the opponent's composition.
        """
    )
    return


# =============================================================================
# 4 · Average Score Tracking
# =============================================================================

@app.cell(hide_code=True)
def _(mo):
    mo.md("---\n## 4 · Average Score Tracking")
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        When a score is entered for a game, each player's running average score is updated:

        ```
        cappedScore     = min(playerTeamScore, 21)
        newScoredGames  = scoredGames + 1
        newAverageScore = (averageScore × scoredGames + cappedScore) / newScoredGames
        ```

        The score is capped at 21 to exclude deuce extensions from inflating averages. This
        stat is stored on the `Player` object (`averageScore`, `scoredGames`) and persisted
        to localStorage.

        This metric reflects how many points a player tends to score per game — a proxy for
        their offensive contribution. It is separate from the level rating, which tracks win/loss
        outcomes relative to expected performance.

        **Before/after example — [0, 100] vs [50, 60], K=8, evenly matched (expected ≈ 0.5 each):**

        |           | Team 1 ([0, 100], effectiveK=4.0) | Team 2 ([50, 60], effectiveK=7.6) |
        |-----------|-----------------------------------|-----------------------------------|
        | Lose/Win  | −2.0 pts each                     | +3.8 pts each                     |
        | Win/Lose  | +2.0 pts each                     | −3.8 pts each                     |

        Before: ±4.0 pts for everyone. The level-100 player's loss penalty drops from −4.0 to
        −2.0, reflecting the high uncertainty introduced by the unbalanced partnership.
        """
    )
    return


# =============================================================================
# 5 · Level Convergence
# =============================================================================

@app.cell(hide_code=True)
def _(mo):
    mo.md("---\n## 5 · Level Convergence")
    return


@app.cell(hide_code=True)
def _(go, mo, play_game, random):
    def _simulate_doubles(initial_levels, n_rounds, seed=42, stochastic=True):
        """Randomly pair players into 2 doubles teams each round, simulate, track levels."""
        _rng = random.Random(seed)
        _players = list(initial_levels)
        _history = [list(_players)]
        for _ in range(n_rounds):
            _idx = list(range(len(_players)))
            _rng.shuffle(_idx)
            # Always 2v2 doubles: first 4 play, rest bench (their levels don't change this round)
            _t1_idx, _t2_idx = _idx[:2], _idx[2:4]
            _t1 = [_players[i] for i in _t1_idx]
            _t2 = [_players[i] for i in _t2_idx]
            _new_t1, _new_t2, _ = play_game(_t1, _t2, stochastic=stochastic, rng=_rng)
            for i, lv in zip(_t1_idx, _new_t1):
                _players[i] = lv
            for i, lv in zip(_t2_idx, _new_t2):
                _players[i] = lv
            _history.append(list(_players))
        return _history

    def _simulate_singles(level_a, level_b, n_games, seed=42, stochastic=True):
        """Two players playing 1v1 repeatedly."""
        _rng = random.Random(seed)
        _a, _b = level_a, level_b
        _hist_a, _hist_b = [_a], [_b]
        for _ in range(n_games):
            (_new_a,), (_new_b,), _ = play_game([_a], [_b], stochastic=stochastic, rng=_rng)
            _a, _b = _new_a, _new_b
            _hist_a.append(_a)
            _hist_b.append(_b)
        return _hist_a, _hist_b

    _N = 80

    _s_det_a, _s_det_b = _simulate_singles(80, 20, _N, stochastic=False)
    _s_sto_a, _s_sto_b = _simulate_singles(80, 20, _N, seed=7, stochastic=True)
    _init_4 = [10, 40, 60, 90]
    _hist_4  = _simulate_doubles(_init_4, _N, seed=42, stochastic=True)
    _init_6  = [10, 20, 50, 50, 80, 90]
    _hist_6  = _simulate_doubles(_init_6, _N, seed=13, stochastic=True)

    _games   = list(range(_N + 1))
    _P4_COLS = ["#4C78A8", "#54A24B", "#F58518", "#E45756"]
    _P6_COLS = ["#4C78A8", "#72B7B2", "#54A24B", "#EECA3B", "#F58518", "#E45756"]

    _LEGEND = dict(x=0.98, y=0.98, xanchor="right", yanchor="top",
                   bgcolor="rgba(255,255,255,0.85)", bordercolor="#ccc", borderwidth=1)
    _BASE = dict(height=340, plot_bgcolor="white", paper_bgcolor="white",
                 margin=dict(t=40, b=45, l=50, r=10))
    _YAXIS = dict(title="Level", range=[0, 100], gridcolor="#eee")

    # --- Fig 1: Singles — deterministic ---
    _f1 = go.Figure()
    _f1.update_layout(**_BASE, legend=_LEGEND, title="Singles — deterministic (stronger always wins)",
                      xaxis=dict(title="Game", gridcolor="#eee"), yaxis=_YAXIS)
    for _lbl, _hist, _col in [("A (start=80)", _s_det_a, "#E45756"), ("B (start=20)", _s_det_b, "#4C78A8")]:
        _f1.add_trace(go.Scatter(x=_games, y=_hist, mode="lines", name=_lbl, line=dict(color=_col, width=2.5)))

    # --- Fig 2: Singles — stochastic ---
    _f2 = go.Figure()
    _f2.update_layout(**_BASE, legend=_LEGEND, title="Singles — stochastic (winner drawn from win probability)",
                      xaxis=dict(title="Game", gridcolor="#eee"), yaxis=_YAXIS)
    for _lbl, _hist, _col in [("A (start=80)", _s_sto_a, "#E45756"), ("B (start=20)", _s_sto_b, "#4C78A8")]:
        _f2.add_trace(go.Scatter(x=_games, y=_hist, mode="lines", name=_lbl, line=dict(color=_col, width=2.5)))

    # --- Fig 3: Doubles — 4 players ---
    _f3 = go.Figure()
    _f3.update_layout(**_BASE, legend=_LEGEND, title="Doubles — 4 players [10, 40, 60, 90] — stochastic",
                      xaxis=dict(title="Round", gridcolor="#eee"), yaxis=_YAXIS)
    for _i, (_col, _init) in enumerate(zip(_P4_COLS, _init_4)):
        _f3.add_trace(go.Scatter(
            x=_games, y=[h[_i] for h in _hist_4],
            mode="lines", name=f"P{_i+1} (start={_init})", line=dict(color=_col, width=2),
        ))

    # --- Fig 4: Doubles — 6 players ---
    _f4 = go.Figure()
    _f4.update_layout(**_BASE, legend=_LEGEND, title="Doubles — 6 players [10, 20, 50, 50, 80, 90] — stochastic",
                      xaxis=dict(title="Round", gridcolor="#eee"), yaxis=_YAXIS)
    for _i, (_col, _init) in enumerate(zip(_P6_COLS, _init_6)):
        _f4.add_trace(go.Scatter(
            x=_games, y=[h[_i] for h in _hist_6],
            mode="lines", name=f"P{_i+1} (start={_init})", line=dict(color=_col, width=2),
        ))

    mo.vstack([
        mo.ui.plotly(_f1),
        mo.md("""
**Deterministic convergence.** The stronger player (A, red) always wins — expected wins
yield only a small gain (K × surprise factor ≈ 0), so A climbs slowly while B drops
steadily toward 0. There is no equilibrium: levels diverge toward the caps (100 / 0).
Compare with the stochastic chart where occasional upsets pull both levels toward 50.
        """),
        mo.ui.plotly(_f2),
        mo.md("""
**Stochastic convergence.** The winner is drawn from the Elo win probability each game,
so the weaker player occasionally upsets. Upsets cause large rating swings (high K ×
large surprise factor), which pulls both levels toward the centre faster — but with
noise around the equilibrium. Notice A's level oscillates more than in the deterministic case.
        """),
        mo.ui.plotly(_f3),
        mo.md("""
**Four-player doubles.** Players are randomly re-paired into two teams each round.
Strong players paired with a much weaker partner receive a reduced K (balance factor),
dampening their rating swing when the team is uneven. Levels gradually spread apart
to reflect each player's individual skill rather than lucky or unlucky pairings.
        """),
        mo.ui.plotly(_f4),
        mo.md("""
**Six-player doubles.** A more realistic session size with two mid-range players at 50.
The wider initial spread (10 → 90) converges more slowly. The two mid-range players
(P3/P4, green/yellow) stay relatively stable since they win and lose roughly as often as
expected regardless of who they are paired with — they are already near their equilibrium.
        """),
    ])
    return


if __name__ == "__main__":
    app.run()
