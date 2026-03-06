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
          deuce / winner ≠ 21  → 3
          loser 18–20 (diff ≤ 3) → 4
          loser 15–17 (diff 4–6) → 8
          loser 11–14 (diff 7–10) → 10
          loser  6–10 (diff 11–15) → 12
          loser   < 6 (diff > 15) → 15
        Returns 3 when no score is available (same as deuce).
        """
        if score is None or winner is None:
            return 3
        w = score["team1"] if winner == 1 else score["team2"]
        lo = score["team2"] if winner == 1 else score["team1"]
        if w != 21:
            return 3
        diff = 21 - lo
        if diff <= 3:  return 4
        if diff <= 6:  return 8
        if diff <= 10: return 10
        if diff <= 15: return 12
        return 15

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
        """Elo expected win probability for team A vs B (divisor = 400).

        A 50-point gap → ~56% expected win probability for the stronger team.
        """
        return 1.0 / (1.0 + 10.0 ** ((avg_b - avg_a) / 400.0))

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
# Elo Rating System — Background
# =============================================================================

@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        ---
        ## Elo Rating System

        The **Elo system** was invented by Arpad Elo, a Hungarian-American physics professor and
        chess master, and adopted by FIDE (the World Chess Federation) in 1970. The core idea is
        simple: after every game, the winner takes points from the loser — but the number of points
        transferred depends on how *surprising* the result was. Beating a much stronger opponent
        earns you a large gain; beating a weaker one barely moves the needle.

        The formula asks two questions before each game:
        1. **How likely is each side to win?** — derived from the difference in ratings via a
           logistic curve (the Elo win-probability formula).
        2. **How surprising was the actual result?** — the difference between what happened and
           what was expected, scaled by a sensitivity parameter K.

        This implementation extends the classical model with two additions suited to badminton:

        - **Score-margin K-factor** (§ 2) — K grows with the winning margin, rewarding dominant
          performances more than narrow ones.
        - **Balance factor** (§ 3) — K is reduced when two doubles partners have very different
          levels, dampening the signal when the team composition itself is uneven.

        The player level scale runs from **0 to 100** (instead of the chess range of ~100–3000).
        The divisor is kept at **400** — the standard chess value — which, over a 100-point scale,
        keeps the win-probability curve deliberately flat: even the largest possible level gap only
        shifts the expected win probability to about 64 %, ensuring upsets remain possible.

        Sections 1–4 examine each component of the formula in isolation before section 5 shows
        how average scores are tracked and section 6 runs end-to-end convergence simulations.
        """
    )
    return


# =============================================================================
# 1 · ELO Divisor Impact
# =============================================================================

@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        ---
        ## 1 · ELO Divisor

        The **divisor** $D$ is a single number that controls how sensitive the win-probability
        formula is to differences in player levels. A small $D$ makes the curve very steep —
        even a modest level gap produces a near-certain outcome. A large $D$ flattens the curve,
        giving underdogs a much fairer chance.

        $$E_A = \frac{1}{1 + 10^{(\bar{L}_B - \bar{L}_A)\,/\,D}}$$

        where $\bar{L}_A$ and $\bar{L}_B$ are the average levels of teams A and B respectively.

        | Divisor $D$ | 50-point gap → $E_A$ | Effect |
        |-------------|----------------------|--------|
        | 50          | ~91 %                | Very steep — small gaps dominate |
        | 100         | ~76 %                | Steep |
        | 200         | ~64 %                | Moderate |
        | **400**     | **~57 %**            | **Gentle — chosen value (chess standard)** |

        With $D = 50$, a 100-point gap (the maximum possible) gives $E_A \approx 99\,\%$ — the
        result is nearly certain before the game even starts. With $D = 400$, the same gap gives
        only $E_A \approx 64\,\%$, so upsets remain plausible and the system stays responsive to
        unexpected results.

        A larger $D$ also caps the maximum rating swing: since $|\text{actual} - E|$ is at most
        $\approx 0.64$ with $D = 400$, even the largest $K = 15$ can move a rating by at most
        $15 \times 0.64 = 9.6$ points — **guaranteed below 10 per game**.
        """
    )
    return


@app.cell(hide_code=True)
def _(go, make_subplots, math, mo):
    _divisors = [50, 100, 200, 400]
    _div_colors = ["#E45756", "#F58518", "#54A24B", "#4C78A8"]
    _diffs = list(range(-100, 101))

    _fig_div = make_subplots(
        rows=1, cols=2,
        subplot_titles=(
            "Expected win probability vs level difference",
            "Max level delta (K=15) vs level difference",
        ),
    )

    for _D, _col in zip(_divisors, _div_colors):
        _probs = [1.0 / (1.0 + 10.0 ** (d / _D)) for d in _diffs]
        _deltas = [15 * abs(p - (0 if p > 0.5 else 1)) for p in _probs]
        _fig_div.add_trace(
            go.Scatter(
                x=_diffs, y=_probs,
                mode="lines", name=f"D={_D}",
                line=dict(color=_col, width=2),
            ),
            row=1, col=1,
        )
        _fig_div.add_trace(
            go.Scatter(
                x=_diffs, y=_deltas,
                mode="lines", name=f"D={_D}",
                line=dict(color=_col, width=2),
                showlegend=False,
            ),
            row=1, col=2,
        )

    _fig_div.add_hline(y=0.5, line_dash="dot", line_color="#aaa", row=1, col=1)
    _fig_div.add_hline(y=10, line_dash="dash", line_color="#B71C1C",
                       annotation_text="10-pt ceiling", annotation_position="top right",
                       row=1, col=2)

    _fig_div.update_layout(
        height=400,
        plot_bgcolor="white", paper_bgcolor="white",
        legend=dict(x=0.02, y=0.98, bgcolor="rgba(255,255,255,0.8)", bordercolor="#ccc", borderwidth=1),
        xaxis=dict(title="Level difference (avgA − avgB)", gridcolor="#eee"),
        yaxis=dict(range=[0, 1], title="Expected win probability", gridcolor="#eee"),
        xaxis2=dict(title="Level difference (avgA − avgB)", gridcolor="#eee"),
        yaxis2=dict(range=[0, 15], title="Max Δ level (K=15)", gridcolor="#eee"),
        margin=dict(t=50, b=50),
    )
    mo.ui.plotly(_fig_div)
    return


# =============================================================================
# 2 · K-Factor by Score Margin
# =============================================================================

@app.cell(hide_code=True)
def _(mo):
    mo.md("---\n## 2 · K-Factor by Score Margin")
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        The K-factor controls how much a single game result affects a player's level.
        It is derived from the score margin (winner score must be exactly 21):

        | Condition | K |
        |---|---|
        | No score entered | 3 |
        | Winner score > 21 (deuce) | 3 |
        | Winner score = 21, loser 18–20 (diff ≤ 3) | 4 |
        | Winner score = 21, loser 15–17 (diff 4–6) | 8 |
        | Winner score = 21, loser 11–14 (diff 7–10) | 10 |
        | Winner score = 21, loser 6–10 (diff 11–15) | 12 |
        | Winner score = 21, loser < 6 (diff > 15) | 15 |
        """
    )
    return


@app.cell(hide_code=True)
def _(get_k_raw, go, make_subplots, mo, win_prob):
    _K_COLOR = {
        3:  "#90CAF9",  # light blue  – deuce / no score
        4:  "#A5D6A7",  # light green – close win
        8:  "#FFF176",  # yellow
        10: "#FFCC80",  # orange
        12: "#EF9A9A",  # light red
        15: "#B71C1C",  # dark red    – dominant win
    }
    _K_LABEL = {
        3:  "K=3 (deuce/no score)",
        4:  "K=4 (18–20)",
        8:  "K=8 (15–17)",
        10: "K=10 (11–14)",
        12: "K=12 (6–10)",
        15: "K=15 (0–5, dominant)",
    }

    # Left: win Δ vs opponent average level (player fixed at 50).
    # Shows that equal opponents (x=50) give K/2, beating a stronger opponent gives MORE,
    # beating a weaker one gives LESS — the surprise factor drives the delta.
    _opp_levels = list(range(0, 101))
    _k_lines = [3, 4, 8, 10, 12, 15]

    # Right: K-factor summary by score band
    _band_x = ["< 6", "6–10", "11–14", "15–17", "18–20", "deuce", "no score"]
    _band_k = [15, 12, 10, 8, 4, 3, 3]
    _band_c = [_K_COLOR[k] for k in _band_k]

    _fig = make_subplots(
        rows=1, cols=2,
        subplot_titles=(
            "Win Δ vs opponent level (player fixed at 50)",
            "K-factor by score band",
        ),
        column_widths=[0.65, 0.35],
    )

    # Left: one line per K value
    for _k in _k_lines:
        _deltas = [round(_k * (1 - win_prob(50, opp)), 3) for opp in _opp_levels]
        _fig.add_trace(
            go.Scatter(
                x=_opp_levels, y=_deltas,
                mode="lines", name=_K_LABEL[_k],
                line=dict(color=_K_COLOR[_k], width=2.5),
            ),
            row=1, col=1,
        )

    # Reference line at opponent level = 50 (equal opponent, Δ = K/2)
    _fig.add_vline(
        x=50, line_dash="dash", line_color="#666", line_width=1.5,
        annotation_text="equal opponent", annotation_position="top left",
        row=1, col=1,
    )

    # Right: K by score band
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
        height=420,
        plot_bgcolor="white", paper_bgcolor="white",
        legend=dict(x=0.02, y=0.98, bgcolor="rgba(255,255,255,0.8)", bordercolor="#ccc", borderwidth=1),
        yaxis=dict(range=[0, 10], title="Win Δ (level points gained)", gridcolor="#eee"),
        yaxis2=dict(range=[0, 18], gridcolor="#eee"),
        xaxis=dict(title="Opponent average level", gridcolor="#eee", range=[0, 100]),
        xaxis2=dict(title="Loser score range", gridcolor="#eee"),
        margin=dict(t=50, b=50),
    )
    mo.ui.plotly(_fig)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        The left chart shows win Δ for a player at level 50, as a function of the opponent's
        level. Three things stand out:

        - **Beating a stronger opponent earns more** — the win was more surprising, so the Elo
          update is larger. At the right edge (opponent level 100) every K line reaches its
          maximum.
        - **At the equal-opponent reference line (x = 50)** every K gives exactly $K/2$ — the
          mid-point of its possible range, not a special maximum.
        - **Beating a weaker opponent earns less** — left of the reference line each curve drops,
          because the win was expected and carries little information.

        The right chart shows which K bracket each score band maps to.
        A **deuce win** (22–20) uses $K = 3$ (smallest swing); a **dominant 21–0** uses $K = 15$
        (largest swing). No score recorded also defaults to $K = 3$.
        """
    )
    return


# =============================================================================
# 3 · Balance Factor
# =============================================================================

@app.cell(hide_code=True)
def _(mo):
    mo.md("---\n## 3 · Balance Factor")
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        Imagine a level-100 expert forced to partner with a level-0 beginner. If they lose,
        it says very little about the expert's individual skill — the outcome was mostly decided
        by the partner mismatch, not by how well the expert played. Penalising the expert the
        full amount would be unfair and would distort their rating.

        To handle this, the effective K is scaled down by a **balance factor**
        $\beta \in [0.5, 1.0]$ whenever a team's two players have very different levels. The
        more mismatched the teammates, the less the match result tells us about individual
        ability — so the smaller the rating change for everyone on that team.

        **Step 1 — team standard deviation** (how spread out the team's levels are):

        $$\sigma = \sqrt{\frac{1}{n}\sum_{i=1}^{n}(L_i - \bar{L})^2}
          \qquad \text{for 2 players:}\quad \sigma = \tfrac{|L_1 - L_2|}{2}$$

        **Step 2 — imbalance factor** (normalised to $[0, 1]$, where 0 = perfectly balanced):

        $$\text{imbalance} = \min\!\left(\frac{\sigma}{50},\; 1\right)$$

        **Step 3 — balance factor** (how much of the raw K to keep):

        $$\beta = 1 - 0.5 \times \text{imbalance} \qquad \in [0.5,\; 1.0]$$

        **Step 4 — effective K** (the K actually applied to each player's rating):

        $$K_{\text{eff}} = K_{\text{raw}} \times \beta$$

        | Team          | $\sigma$ | imbalance | $\beta$ | $K_{\text{eff}}$ (raw $K = 8$) |
        |---------------|----------|-----------|---------|--------------------------------|
        | [50, 50]      | 0        | 0.00      | 1.00    | 8.0                            |
        | [50, 60]      | 5        | 0.10      | 0.95    | 7.6                            |
        | [40, 80]      | 20       | 0.40      | 0.80    | 6.4                            |
        | [0, 100]      | 50       | 1.00      | 0.50    | 4.0                            |
        | singles [80]  | 0        | 0.00      | 1.00    | 8.0                            |

        Singles (1-player teams) are always unaffected ($\beta = 1.0$). Each team gets its own
        balance-adjusted K independently — a lopsided team 1 does not affect team 2's K.
        """
    )
    return


@app.cell(hide_code=True)
def _(balance_factor, go, make_subplots, mo):
    # For a 2-player team [50−s/2, 50+s/2], spread = s, stdDev = s/2
    _spreads = list(range(0, 101))
    _bfs     = [balance_factor([50 - s / 2, 50 + s / 2]) for s in _spreads]

    _RAW_KS  = [4, 8, 10, 12, 15]
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
        yaxis2=dict(range=[0, 18], title="Effective K", gridcolor="#eee"),
        margin=dict(t=50),
    )
    mo.ui.plotly(_fig)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        """
        **Left chart — balance factor curve.** The x-axis is the absolute level difference
        between the two teammates ($|L_1 - L_2|$). At spread = 0 both players are identical
        ($\beta = 1.0$, no reduction). At spread = 100 — one player at 0, the other at 100 —
        the factor bottoms out at $\beta = 0.5$, halving every rating change for that team.
        Anything in between scales smoothly.

        **Right chart — effective K per raw K.** Each coloured line is one K tier. The
        reduction is proportional across all tiers: a dominant-win $K = 15$ drops to 7.5 for a
        maximally unbalanced team, and a close-win $K = 4$ drops to 2. Both players on the
        unbalanced team are affected equally — the strong player is not penalised more than
        the weak one.
        """
    )
    return


# =============================================================================
# 4 · Elo Delta Simulations
# =============================================================================

@app.cell(hide_code=True)
def _(mo):
    mo.md("""---
## 4 · Elo Delta Simulations

The **Elo system** assigns each player a numeric level (0–100). After every game the winner
gains points and the loser loses the same amount. The size of the swing — the **Elo delta** —
is governed by two factors studied in the previous sections:

- **K-factor** (§ 2): larger for more dominant wins, smaller for close games (K = 3 when no
  score is recorded, same as deuce).
- **Balance factor** (§ 3): scales K down when a team's two players have very different levels,
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

        Before each game, the system estimates how likely each team is to win based on their
        average player levels. Equal teams each get 50 %. The formula uses a divisor of 400
        (see § 1), which keeps the curve gentle — only a very large level gap pushes the
        probability close to certain:

        $$\bar{L}_\text{team} = \frac{1}{n}\sum_{i=1}^{n} L_i
          \qquad \text{(unknown level} \to 50\text{)}$$

        $$E_A = \frac{1}{1 + 10^{(\bar{L}_B - \bar{L}_A)\,/\,400}}, \qquad E_B = 1 - E_A$$

        A 50-point level gap gives only $E_A \approx 56\,\%$ — barely more than a coin flip.

        ### Level Delta

        After the game, every player on the winning team gains points and every player on the
        losing team loses the same number. The size of the swing grows with how surprising the
        result was: a massive upset earns far more than a comfortable expected win.

        $$\text{actual} = \begin{cases} 1 & \text{(team won)} \\ 0 & \text{(team lost)} \end{cases}
          \qquad \Delta = K_{\text{eff}} \times (\text{actual} - E)$$

        $$L_{\text{new}} = \operatorname{clamp}(L + \Delta,\; 0,\; 100) \quad \text{rounded to 1 d.p.}$$

        **Worked example — dominant win (21-5)**

        Team A (avg level 70) beats Team B (avg level 30) convincingly. The score diff is 16,
        so $K = 15$ (most dominant bracket). Team A was already the favourite at $E_A = 0.557$,
        so their gain is modest despite the large K:

        | | Team A (avg 70) | Team B (avg 30) |
        |---|---|---|
        | $K$ (diff = 16) | 15 | 15 |
        | $E$ | 0.557 | 0.443 |
        | actual | 1 (won) | 0 (lost) |
        | $\Delta$ | $+15 \times (1 - 0.557) = \mathbf{+6.6}$ | $+15 \times (0 - 0.443) = \mathbf{-6.6}$ |

        **Worked example — upset (21-19, weak beats strong)**

        Team A (avg 30) shocks Team B (avg 70) in a tight game. The score diff is only 2,
        so $K = 4$ (close-win bracket). The swing is small: the low K limits the reward, and
        the gentle divisor means the "surprise" factor is moderate rather than extreme:

        | | Team A (avg 30) | Team B (avg 70) |
        |---|---|---|
        | $K$ (diff = 2) | 4 | 4 |
        | $E$ | 0.443 | 0.557 |
        | actual | 1 (won) | 0 (lost) |
        | $\Delta$ | $+4 \times (1 - 0.443) = \mathbf{+2.2}$ | $+4 \times (0 - 0.557) = \mathbf{-2.2}$ |

        **Worked example — expected win (21-15, strong beats weak)**

        A level-80 player beats a level-60 opponent with a comfortable margin. The score diff
        is 6, so $K = 8$. Because the win was expected ($E_{80} = 0.529$), the reward is modest.
        The table also shows what would happen if the stronger player unexpectedly lost:

        | | Level-80 player | Level-60 opponent |
        |---|---|---|
        | $K$ (diff = 6) | 8 | 8 |
        | $E$ | 0.529 | 0.471 |
        | **Win** (actual = 1) | $\mathbf{+3.8}$ → 83.8 | $\mathbf{-3.8}$ → 56.2 |
        | **Lose** (actual = 0) | $\mathbf{-4.2}$ → 75.8 | $\mathbf{+4.2}$ → 64.2 |

        An unexpected loss drops the stronger player slightly more than a win raises them —
        a direct consequence of $E > 0.5$ making $|0 - E| > |1 - E|$.
        """
    )
    return


@app.cell(hide_code=True)
def _(avg_level, balance_factor, go, k_factor, make_subplots, mo, win_prob):
    # --- Heatmap: expected win probability for team 1 ---
    # Shows the raw input to the Elo formula across all level combinations.
    # With D=400, the curve is deliberately flat: the full 0–100 range only moves
    # probability from ~0.36 to ~0.64 — barely more than a coin flip at either extreme.
    _avgs = list(range(0, 101, 5))
    _prob_grid = []
    for _a1 in _avgs:
        _row = []
        for _a2 in _avgs:
            _row.append(round(win_prob(_a1, _a2), 3))
        _prob_grid.append(_row)

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
        _kwo = 3.0                              # without (raw K=3, balanced)
        _sc_win_with.append(round(_kw * (1.0 - _ep), 2))
        _sc_win_without.append(round(_kwo * (1.0 - _ep), 2))

    _fig = make_subplots(
        rows=2, cols=2,
        subplot_titles=(
            "Expected win probability for team 1 (D=400)",
            "Δ vs spread — team1=[50±s] vs team2=[50,50]",
            "Win Δ with vs without balance factor (K=3, team1 wins)",
            "Balance factor for each scenario",
        ),
        vertical_spacing=0.18,
    )

    # Top-left: win probability heatmap
    _fig.add_trace(
        go.Heatmap(
            x=_avgs, y=_avgs, z=_prob_grid,
            colorscale="RdYlGn",
            colorbar=dict(title="P(team 1 wins)", x=0.46, len=0.45, y=0.78, tickformat=".0%"),
            zmin=0.3, zmax=0.7,
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
        yaxis=dict(title="Team 1 avg level", gridcolor="#eee", autorange="reversed"),
        xaxis2=dict(title="Spread s (team1 = [50−s, 50+s])", gridcolor="#eee"),
        yaxis2=dict(title="Δ level per player", gridcolor="#eee"),
        xaxis3=dict(tickangle=-15),
        yaxis3=dict(range=[0, 4], title="Win Δ", gridcolor="#eee"),
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
**Figure 1 — Expected win probability heatmap (D = 400).**
Each cell is the probability that team 1 wins, computed from the Elo formula before any game
is played. The diagonal (equal-strength teams) is always 50 % — shown in yellow. Moving
up-left (team 1 much stronger) pushes probability toward green (~64 %); moving down-right
(team 1 much weaker) pushes it toward red (~36 %). The key insight: **with D = 400 the full
range is only 36 %–64 %** — the heatmap looks muted by design. A divisor of 50 would
stretch the same grid from near 1 % to near 99 %, making it almost entirely red or green.
This probability is the direct input to every delta calculation in the section below.

**Figure 2 — Spread impact on delta.**
Team 1 always averages 50 but its internal spread grows from 0 (both players at 50) to ±50
(one at 0, one at 100). As spread increases, the balance factor lowers K, shrinking both the
win reward and the loss penalty. A maximally uneven team [0, 100] ends up with roughly half
the delta of a perfectly balanced team.

**Figure 3 — Win delta: with vs without balance factor.**
Five representative matchups compare the raw delta (K = 3, no balance factor, light blue)
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
# 5 · Average Score Tracking
# =============================================================================

@app.cell(hide_code=True)
def _(mo):
    mo.md("---\n## 5 · Average Score Tracking")
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        When a score is entered for a game, each player's running average score is updated.
        This tracks how many points a player's team tends to score per game — a proxy for
        offensive contribution that is entirely separate from the Elo level rating.

        The score is first capped to remove the effect of deuce extensions (a 22-point winner
        game still counts as 21):

        $$s_{\text{capped}} = \min(s_{\text{team}},\; 21)$$

        Then the per-player running average is updated with a standard cumulative mean:

        $$n_{\text{new}} = n + 1, \qquad
          \bar{s}_{\text{new}} = \frac{\bar{s} \cdot n + s_{\text{capped}}}{n_{\text{new}}}$$

        Both `averageScore` and `scoredGames` are stored on the `Player` object and persisted
        to localStorage.

        **Level-rating example — [0, 100] vs [50, 60], no score ($K_{\text{raw}} = 3$, $E \approx 0.5$):**

        The unbalanced team [0, 100] has $\beta = 0.5$, so $K_{\text{eff}} = 1.5$.
        The balanced team [50, 60] has $\beta = 0.95$, so $K_{\text{eff}} = 2.85$.

        |           | Team 1 ([0, 100], $K_{\text{eff}} = 1.5$) | Team 2 ([50, 60], $K_{\text{eff}} = 2.85$) |
        |-----------|-------------------------------------------|---------------------------------------------|
        | Lose / Win  | $-0.75$ pts each                        | $+1.4$ pts each                             |
        | Win / Lose  | $+0.75$ pts each                        | $-1.4$ pts each                             |

        The unbalanced team is penalised half as much as the balanced team — the outcome is
        less informative about individual skill when partners are so mismatched.
        """
    )
    return


# =============================================================================
# 6 · Level Convergence
# =============================================================================

@app.cell(hide_code=True)
def _(mo):
    mo.md("---\n## 6 · Level Convergence")
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
    _N_det = 25  # deterministic converges in ~15-20 games; cap early to avoid flat plateau

    _s_det_a, _s_det_b = _simulate_singles(70, 30, _N_det, stochastic=False)
    _s_sto_a, _s_sto_b = _simulate_singles(50, 50, _N, seed=7, stochastic=True)
    _init_4 = [10, 40, 60, 90]
    _hist_4  = _simulate_doubles(_init_4, _N, seed=42, stochastic=True)
    _init_6  = [10, 20, 50, 50, 80, 90]
    _hist_6  = _simulate_doubles(_init_6, _N, seed=13, stochastic=True)

    _games_det = list(range(_N_det + 1))
    _games     = list(range(_N + 1))
    _P4_COLS = ["#4C78A8", "#54A24B", "#F58518", "#E45756"]
    _P6_COLS = ["#4C78A8", "#72B7B2", "#54A24B", "#EECA3B", "#F58518", "#E45756"]

    _SHARED_LAYOUT = dict(
        height=380, plot_bgcolor="white", paper_bgcolor="white",
        margin=dict(t=50, b=45, l=50, r=20),
        legend=dict(bgcolor="rgba(255,255,255,0.85)", bordercolor="#ccc", borderwidth=1),
    )
    _YAXIS = dict(title="Level", range=[0, 100], gridcolor="#eee")

    # --- Singles: deterministic (col 1) vs stochastic (col 2) ---
    _fig_singles = make_subplots(
        rows=1, cols=2,
        subplot_titles=("Singles — deterministic", "Singles — stochastic"),
        column_widths=[0.5, 0.5],
    )
    for _lbl, _hist, _col in [("A (start=70)", _s_det_a, "#E45756"), ("B (start=30)", _s_det_b, "#4C78A8")]:
        _fig_singles.add_trace(
            go.Scatter(x=_games_det, y=_hist, mode="lines", name=_lbl,
                       line=dict(color=_col, width=2.5), legendgroup=_lbl),
            row=1, col=1,
        )
    for _lbl, _hist, _col in [("A (start=50)", _s_sto_a, "#E45756"), ("B (start=50)", _s_sto_b, "#4C78A8")]:
        _fig_singles.add_trace(
            go.Scatter(x=_games, y=_hist, mode="lines", name=_lbl,
                       line=dict(color=_col, width=2.5), legendgroup=_lbl, showlegend=False),
            row=1, col=2,
        )
    _fig_singles.update_layout(
        **_SHARED_LAYOUT,
        yaxis=_YAXIS, yaxis2=_YAXIS,
        xaxis=dict(title="Game", gridcolor="#eee"),
        xaxis2=dict(title="Game", gridcolor="#eee"),
    )

    # --- Doubles: 4 players (col 1) vs 6 players (col 2) ---
    _fig_doubles = make_subplots(
        rows=1, cols=2,
        subplot_titles=(
            f"Doubles — {len(_init_4)} players {_init_4}",
            f"Doubles — {len(_init_6)} players {_init_6}",
        ),
        column_widths=[0.5, 0.5],
    )
    for _i, (_col, _init) in enumerate(zip(_P4_COLS, _init_4)):
        _fig_doubles.add_trace(
            go.Scatter(x=_games, y=[h[_i] for h in _hist_4], mode="lines",
                       name=f"P{_i+1} (start={_init})", line=dict(color=_col, width=2),
                       legendgroup="4p", legendgrouptitle_text="4 players"),
            row=1, col=1,
        )
    for _i, (_col, _init) in enumerate(zip(_P6_COLS, _init_6)):
        _fig_doubles.add_trace(
            go.Scatter(x=_games, y=[h[_i] for h in _hist_6], mode="lines",
                       name=f"P{_i+1} (start={_init})", line=dict(color=_col, width=2),
                       legendgroup="6p", legendgrouptitle_text="6 players"),
            row=1, col=2,
        )
    _fig_doubles.update_layout(
        **_SHARED_LAYOUT,
        yaxis=_YAXIS, yaxis2=_YAXIS,
        xaxis=dict(title="Round", gridcolor="#eee"),
        xaxis2=dict(title="Round", gridcolor="#eee"),
    )

    mo.vstack([
        mo.ui.plotly(_fig_singles),
        mo.hstack([
            mo.md("""
**Deterministic (A=70, B=30):** the stronger player always wins every game. With a divisor
of 400 over a 0–100 scale, the win probability only ranges ~36–64%, so the Elo update stays
around 1.2 pts/game throughout — levels diverge steadily to 100/0 with no equilibrium or
self-correction. The chart is capped at 25 games to show the full divergence before the
plateau.
            """),
            mo.md("""
**Stochastic (A=50, B=50):** the winner is drawn from the Elo win probability, introducing noise
even between equal players. Random winning streaks push one player ahead until larger K swings
pull them back. The result is a noisy but mean-reverting oscillation around level 50.
            """),
        ]),
        mo.ui.plotly(_fig_doubles),
        mo.hstack([
            mo.md(f"""
**{len(_init_4)} players {_init_4}:** with four players spanning the full range, the balance
factor kicks in whenever a strong player is paired with a weak one — reducing K for that team
and dampening the swing. Levels gradually separate to reflect individual skill rather than lucky
pairings.
            """),
            mo.md(f"""
**{len(_init_6)} players {_init_6}:** a more realistic session size with two mid-range players
already near level 50. The middle players (P3/P4) remain stable — their Elo is already near
equilibrium. The extremes (P1 at 10 and P6 at 90) converge more slowly because the wider
initial spread triggers a heavier balance-factor penalty on uneven pairings.
            """),
        ]),
    ])
    return


if __name__ == "__main__":
    app.run()
