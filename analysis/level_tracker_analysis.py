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
# Config — mirrors src/engines/levelTrackerConfig.ts
# Update here when the TypeScript config changes; all cells below auto-update.
# =============================================================================

@app.cell
def _():
    ELO_DIVISOR = 400   # LevelTrackerConfig.ELO_DIVISOR
    K_DEFAULT   = 0.6   # LevelTrackerConfig.K_DEFAULT  (deuce / no score)
    K_MAX       = 3.0   # LevelTrackerConfig.K_MAX       (dominant win, diff > 15)
    K_SCALE     = [     # LevelTrackerConfig.K_SCALE
        {"maxDiff":  3, "k": 0.8},
        {"maxDiff":  6, "k": 1.6},
        {"maxDiff": 10, "k": 2.0},
        {"maxDiff": 15, "k": 2.4},
    ]
    # Divisors explored in visualisations (ordered low → high)
    DIVISORS = [50, 100, 200, 400, 1000, 2000, 4000]
    DIV_COLORS = {
        50:   "#B71C1C",
        100:  "#E45756",
        200:  "#F58518",
        400:  "#EECA3B",
        1000: "#54A24B",
        2000: "#72B7B2",
        4000: "#4C78A8",
    }
    # K-tier colours (ordered by K value, low → high)
    _k_palette = ["#90CAF9", "#A5D6A7", "#FFF176", "#FFCC80", "#EF9A9A", "#B71C1C"]
    _all_k = sorted({b["k"] for b in K_SCALE} | {K_MAX, K_DEFAULT})
    K_COLORS = {k: _k_palette[i % len(_k_palette)] for i, k in enumerate(_all_k)}
    return DIV_COLORS, DIVISORS, ELO_DIVISOR, K_COLORS, K_DEFAULT, K_MAX, K_SCALE


# =============================================================================
# LevelTracker — Python implementation
# =============================================================================

@app.cell
def _(ELO_DIVISOR, K_DEFAULT, K_MAX, K_SCALE, math, random):
    def get_k_raw(score=None, winner=None):
        """Raw K-factor from score margin only (no balance adjustment).

        Uses K_DEFAULT when no score is available (same as deuce).
        Otherwise walks K_SCALE bands (winner score must be exactly 21),
        falling back to K_MAX for the most dominant wins.
        """
        if score is None or winner is None:
            return K_DEFAULT
        w = score["team1"] if winner == 1 else score["team2"]
        lo = score["team2"] if winner == 1 else score["team1"]
        if w != 21:
            return K_DEFAULT
        diff = 21 - lo
        for band in K_SCALE:
            if diff <= band["maxDiff"]:
                return band["k"]
        return K_MAX

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
        """Elo expected win probability for team A vs B."""
        return 1.0 / (1.0 + 10.0 ** ((avg_b - avg_a) / ELO_DIVISOR))

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
        The divisor is set to **4000** — ten times the standard chess value — making the
        win-probability curve nearly flat: even the largest possible level gap (100 points) shifts
        the expected win probability by less than 2 %, so the K-factor and score margin are the
        dominant drivers of rating change.

        Sections 1–4 examine each component of the formula in isolation before section 5 shows
        how average scores are tracked and section 6 runs end-to-end convergence simulations.
        """
    )
    return


# =============================================================================
# 1 · ELO Divisor Impact
# =============================================================================

@app.cell(hide_code=True)
def _(DIVISORS, ELO_DIVISOR, K_MAX, mo):
    def _ep(D, gap=50):
        return 1.0 / (1.0 + 10.0 ** (gap / D))

    _effects = {
        50:   "Very steep — chess-like",
        100:  "Steep",
        200:  "Moderate-steep",
        400:  "Moderate (chess standard)",
        1000: "Gentle",
        2000: "Very gentle",
        4000: "Nearly flat",
    }

    _rows = []
    for _D in DIVISORS:
        _prob = _ep(_D)
        _bold = _D == ELO_DIVISOR
        _pct = f"~{_prob*100:.0f} %"
        _eff = _effects.get(_D, "")
        if _bold:
            _rows.append(f"| **{_D}** | **{_pct}** | **{_eff}** |")
        else:
            _rows.append(f"| {_D} | {_pct} | {_eff} |")

    _ep_100_chess = _ep(400, gap=100)
    _ep_100_cfg   = _ep(ELO_DIVISOR, gap=100)
    _max_swing    = round(K_MAX * (1 - _ep(ELO_DIVISOR)), 2)

    mo.md(
        f"""
        ---
        ## 1 · ELO Divisor

        ### 1a · Win Probability Curve

        The **divisor** $D$ is a single number that controls how sensitive the win-probability
        formula is to differences in player levels. A small $D$ makes the curve very steep —
        even a modest level gap produces a near-certain outcome. A large $D$ flattens the curve,
        giving underdogs a much fairer chance.

        $$E_A = \\frac{{1}}{{1 + 10^{{(\\bar{{L}}_B - \\bar{{L}}_A)\\,/\\,D}}}}$$

        where $\\bar{{L}}_A$ and $\\bar{{L}}_B$ are the average levels of teams A and B respectively.

        | Divisor $D$ | 50-point gap → $E_A$ | Effect |
        |-------------|----------------------|--------|
        """ + "\n        ".join(_rows) + f"""

        With $D = 400$ (the chess standard), a 100-point gap gives $E_A \\approx {_ep_100_chess*100:.0f}\\,\\%$.
        With $D = {ELO_DIVISOR}$, the same gap gives only $E_A \\approx {_ep_100_cfg*100:.0f}\\,\\%$ — levels barely influence
        the expected win probability. Upsets are almost always possible and the rating changes
        are driven almost entirely by the K-factor and score margin.

        A larger $D$ also caps the maximum rating swing: since $|\\text{{actual}} - E|$ is at most
        $\\approx {1 - _ep(ELO_DIVISOR):.2f}$ with $D = {ELO_DIVISOR}$, even the largest $K = {K_MAX}$ can move a rating by at most
        ${K_MAX} \\times {1 - _ep(ELO_DIVISOR):.2f} = {_max_swing}$ points — **guaranteed below 1 per game**.
        """
    )
    return


@app.cell(hide_code=True)
def _(DIV_COLORS, DIVISORS, ELO_DIVISOR, K_DEFAULT, K_MAX, go, make_subplots, mo):
    _diffs = list(range(-100, 101))

    _fig_div = make_subplots(
        rows=1, cols=2,
        subplot_titles=(
            "Expected win probability vs level difference",
            f"Max level delta (K={K_MAX}) vs level difference",
        ),
    )

    for _D in DIVISORS:
        _col = DIV_COLORS[_D]
        _width = 2.5 if _D == ELO_DIVISOR else 1.5
        _probs = [1.0 / (1.0 + 10.0 ** (d / _D)) for d in _diffs]
        _deltas = [K_MAX * abs(p - (0 if p > 0.5 else 1)) for p in _probs]
        _fig_div.add_trace(
            go.Scatter(
                x=_diffs, y=_probs,
                mode="lines", name=f"D={_D}",
                line=dict(color=_col, width=_width),
            ),
            row=1, col=1,
        )
        _fig_div.add_trace(
            go.Scatter(
                x=_diffs, y=_deltas,
                mode="lines", name=f"D={_D}",
                line=dict(color=_col, width=_width),
                showlegend=False,
            ),
            row=1, col=2,
        )

    _fig_div.add_hline(y=0.5, line_dash="dot", line_color="#aaa", row=1, col=1)

    _fig_div.update_layout(
        height=400,
        plot_bgcolor="white", paper_bgcolor="white",
        legend=dict(x=0.02, y=0.98, bgcolor="rgba(255,255,255,0.8)", bordercolor="#ccc", borderwidth=1),
        xaxis=dict(title="Level difference (avgA − avgB)", gridcolor="#eee"),
        yaxis=dict(range=[0, 1], title="Expected win probability", gridcolor="#eee"),
        xaxis2=dict(title="Level difference (avgA − avgB)", gridcolor="#eee"),
        yaxis2=dict(range=[K_DEFAULT, K_MAX], title=f"Max Δ level (K={K_MAX})", gridcolor="#eee"),
        margin=dict(t=50, b=50),
    )
    mo.ui.plotly(_fig_div)
    return


# =============================================================================
# 1b · Divisor × K-Factor — Combined Impact
# =============================================================================

@app.cell(hide_code=True)
def _(DIVISORS, K_DEFAULT, K_MAX, mo):
    mo.md(
        f"""
        ---
        ## 1b · Divisor × K-Factor — Combined Impact

        The two parameters that most influence rating change are the **divisor $D$** and the
        **K-factor**. This section shows how they interact across the full historical range:
        divisors from {DIVISORS[0]} (very steep, chess-like) to {DIVISORS[-1]} (nearly flat), and
        all K tiers from the most dominant win ($K = {K_MAX}$) down to deuce/no-score ($K = {K_DEFAULT}$).

        For a fixed level difference, the maximum rating delta is:

        $$\\Delta_{{\\max}} = K \\times |1 - E_A| = K \\times \\frac{{10^{{\\Delta L / D}}}}{{1 + 10^{{\\Delta L / D}}}}$$

        where $\\Delta L$ is the level gap between the stronger and weaker team.
        """
    )
    return


@app.cell(hide_code=True)
def _(DIV_COLORS, DIVISORS, ELO_DIVISOR, K_COLORS, K_MAX, go, make_subplots, mo):
    _ALL_K     = sorted(K_COLORS)
    _diffs_ext = list(range(0, 101))
    _LAYOUT    = dict(
        height=380, plot_bgcolor="white", paper_bgcolor="white",
        margin=dict(t=50, b=45, l=50, r=160),
        legend=dict(x=1.01, y=1.0, bgcolor="rgba(255,255,255,0.9)", bordercolor="#ccc", borderwidth=1),
    )

    # --- Top row: divisor impact (left) + K-factor impact (right) ---
    _fig_top = make_subplots(
        rows=1, cols=2,
        subplot_titles=(
            f"Max Δ vs level gap — K={K_MAX}, all divisors (bold = D={ELO_DIVISOR})",
            f"Max Δ vs level gap — D={ELO_DIVISOR}, all K tiers",
        ),
    )
    for _D in DIVISORS:
        _is_cfg = _D == ELO_DIVISOR
        _fig_top.add_trace(go.Scatter(
            x=_diffs_ext,
            y=[round(K_MAX * (10 ** (d / _D) / (1 + 10 ** (d / _D))), 4) for d in _diffs_ext],
            mode="lines", name=f"D={_D}",
            line=dict(color=DIV_COLORS[_D], width=3 if _is_cfg else 1.5),
            legendgroup="div",
            legendgrouptitle_text="Divisor" if _D == DIVISORS[0] else None,
        ), row=1, col=1)
    for _k in _ALL_K:
        _fig_top.add_trace(go.Scatter(
            x=_diffs_ext,
            y=[round(_k * (10 ** (d / ELO_DIVISOR) / (1 + 10 ** (d / ELO_DIVISOR))), 4) for d in _diffs_ext],
            mode="lines", name=f"K={_k}",
            line=dict(color=K_COLORS[_k], width=2),
            legendgroup="kfac",
            legendgrouptitle_text="K-factor" if _k == _ALL_K[0] else None,
        ), row=1, col=2)
    _fig_top.update_layout(
        **_LAYOUT,
        xaxis=dict(title="Level gap (stronger − weaker)", gridcolor="#eee"),
        yaxis=dict(title=f"Max Δ level (K={K_MAX})", gridcolor="#eee"),
        xaxis2=dict(title="Level gap (stronger − weaker)", gridcolor="#eee"),
        yaxis2=dict(title=f"Max Δ level (D={ELO_DIVISOR})", gridcolor="#eee"),
    )

    # --- Bottom row: heatmap (left) + win probability (right) ---
    _fig_bot = make_subplots(
        rows=1, cols=2,
        subplot_titles=(
            "Max Δ heatmap at level gap = 50 (D × K)",
            f"Win probability vs level gap — all divisors (bold = D={ELO_DIVISOR})",
        ),
    )
    _hm_z = []
    for _k in _ALL_K:
        _hm_z.append([round(_k * (1.0 - 1.0 / (1.0 + 10.0 ** (50.0 / _D))), 4) for _D in DIVISORS])
    _fig_bot.add_trace(go.Heatmap(
        x=[str(d) for d in DIVISORS], y=[str(k) for k in _ALL_K], z=_hm_z,
        colorscale="Blues",
        colorbar=dict(title="Max Δ", x=0.46, len=0.9),
        text=[[f"{v:.3f}" for v in row] for row in _hm_z],
        texttemplate="%{text}", textfont=dict(size=10),
    ), row=1, col=1)
    for _D in DIVISORS:
        _is_cfg = _D == ELO_DIVISOR
        _fig_bot.add_trace(go.Scatter(
            x=_diffs_ext,
            y=[round(1.0 / (1.0 + 10.0 ** (d / _D)), 4) for d in _diffs_ext],
            mode="lines", name=f"D={_D}",
            line=dict(color=DIV_COLORS[_D], width=3 if _is_cfg else 1.5),
            showlegend=False,
        ), row=1, col=2)
    _fig_bot.add_hline(y=0.5, line_dash="dot", line_color="#aaa", row=1, col=2)
    _fig_bot.update_layout(
        **_LAYOUT,
        xaxis=dict(title="Divisor D", gridcolor="#eee"),
        yaxis=dict(title="K-factor", gridcolor="#eee"),
        xaxis2=dict(title="Level gap (stronger − weaker)", gridcolor="#eee"),
        yaxis2=dict(title="P(weaker team wins)", gridcolor="#eee"),
    )

    mo.vstack([
        mo.ui.plotly(_fig_top),
        mo.hstack([
            mo.md(f"""
**Left — divisor impact on max delta (K = {K_MAX}).**
At D={DIVISORS[0]} even a 10-point gap produces a large swing, and a 100-point gap pushes
the delta close to K = {K_MAX}. At D={ELO_DIVISOR} (bold line) the curve is almost flat —
the maximum delta stays near K/2 = {K_MAX / 2} regardless of the level gap.
            """),
            mo.md(f"""
**Right — K-factor impact at D = {ELO_DIVISOR}.**
With a fixed divisor of {ELO_DIVISOR}, each K tier produces a nearly horizontal band —
confirming that at this divisor the K-factor alone determines the size of the rating change,
with the level gap contributing less than 1 %.
            """),
        ], widths="equal"),
        mo.ui.plotly(_fig_bot),
        mo.hstack([
            mo.md(f"""
**Left — combined heatmap at level gap = 50.**
Each cell is the winner's rating gain when the stronger team leads by 50 points. Moving right
(larger D) rapidly flattens the effect. Moving up (larger K) scales it linearly.
The cell at D={ELO_DIVISOR}, K={K_MAX} sits in the bottom-right region of the heatmap.
            """),
            mo.md(f"""
**Right — win probability for each divisor.**
The weaker team's win probability as a function of level gap. At D={DIVISORS[0]} a 50-point
gap gives the weaker team only ~9 % chance. At D={ELO_DIVISOR} (bold) the same gap gives
~49 % — nearly a coin flip.
            """),
        ], widths="equal"),
    ])
    return


# =============================================================================
# 1c · K-Factor Recovery Time
# =============================================================================

@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        ---
        ## 1c · K-Factor Recovery Time

        A single high-K game — a dominant score that triggers $K_\text{max}$ — moves a rating
        further than a normal unscored game. If future games use $K_\text{default}$ (no score
        entered), how many does it take to return to the original level?

        The chart below uses equal-level opponents throughout (win probability = 0.5),
        so the only variable is the K-factor applied to each game. Each coloured line
        represents a different K tier for the anomalous loss; recovery always uses
        $K_\text{default}$.
        """
    )
    return


@app.cell(hide_code=True)
def _(K_COLORS, K_DEFAULT, K_MAX, K_SCALE, go, mo):
    _START_LEVEL = 50.0
    _K_TIERS = [b["k"] for b in K_SCALE] + [K_MAX]

    def _simulate_kt(start, k_anomalous, max_games=20):
        """Anomalous loss then recover via K_DEFAULT wins against equal-level opponents."""
        levels = [start]
        cur = round(start - k_anomalous * 0.5, 4)  # lose: actual=0, prob=0.5
        levels.append(cur)
        for _ in range(max_games):
            if cur >= start:
                break
            cur = round(cur + K_DEFAULT * 0.5, 4)
            levels.append(cur)
        return levels

    _fig_rec_k = go.Figure()
    for _k in _K_TIERS:
        _lvls = _simulate_kt(_START_LEVEL, _k)
        _fig_rec_k.add_trace(go.Scatter(
            x=list(range(len(_lvls))), y=_lvls,
            mode="lines+markers", name=f"K={_k}",
            line=dict(color=K_COLORS[_k], width=2),
        ))

    _fig_rec_k.add_hline(y=_START_LEVEL, line_dash="dot", line_color="#aaa")
    _fig_rec_k.update_layout(
        height=400,
        title="Bad loss recovery — K_DEFAULT wins needed to return to starting level",
        plot_bgcolor="white", paper_bgcolor="white",
        legend=dict(x=0.75, y=0.04, bgcolor="rgba(255,255,255,0.8)", bordercolor="#ccc", borderwidth=1),
        xaxis=dict(title="Game index (0 = start, 1 = anomalous loss, 2+ = recovery wins)", gridcolor="#eee", dtick=1),
        yaxis=dict(title="Player level", gridcolor="#eee"),
        margin=dict(t=50),
    )
    mo.ui.plotly(_fig_rec_k)
    return


@app.cell(hide_code=True)
def _(K_DEFAULT, K_MAX, mo):
    mo.md(f"""
The larger the margin of the anomalous loss, the higher the K-factor applied to that game —
and therefore the bigger the initial level drop. Since recovery relies on a series of
normal-K wins, a dominant-loss result (K = {K_MAX}) takes roughly twice as many games to
undo as a close-loss result (K = {K_DEFAULT}). In short: **the harder the fall, the longer
the climb back**.
""")
    return


# =============================================================================
# 2 · K-Factor by Score Margin
# =============================================================================

@app.cell(hide_code=True)
def _(mo):
    mo.md("---\n## 2 · K-Factor by Score Margin")
    return


@app.cell(hide_code=True)
def _(K_DEFAULT, K_MAX, K_SCALE, mo):
    _prev_max = 0
    _scale_rows = []
    for _band in K_SCALE:
        _lo = _prev_max + 1
        _hi = _band["maxDiff"]
        _loser_lo = 21 - _hi
        _loser_hi = 21 - _lo
        _scale_rows.append(
            f"| Winner score = 21, loser {_loser_lo}–{_loser_hi} (diff {_lo}–{_hi}) | {_band['k']} |"
        )
        _prev_max = _hi
    _dominant_loser = 21 - (_prev_max + 1)

    mo.md(
        f"""
        The K-factor controls how much a single game result affects a player's level.
        It is derived from the score margin (winner score must be exactly 21):

        | Condition | K |
        |---|---|
        | No score entered | {K_DEFAULT} |
        | Winner score > 21 (deuce) | {K_DEFAULT} |
        """ + "\n        ".join(_scale_rows) + f"""
        | Winner score = 21, loser < {_dominant_loser} (diff > {_prev_max}) | {K_MAX} |
        """
    )
    return


@app.cell(hide_code=True)
def _(K_COLORS, K_DEFAULT, K_MAX, K_SCALE, get_k_raw, go, make_subplots, mo, win_prob):
    _opp_levels = list(range(0, 101))

    # Right: K-factor summary by score band
    _band_x = ["< 6", "6–10", "11–14", "15–17", "18–20", "deuce", "no score"]
    _band_k = [K_MAX] + [b["k"] for b in reversed(K_SCALE)] + [K_DEFAULT, K_DEFAULT]
    _band_c = [K_COLORS[k] for k in _band_k]

    _fig = make_subplots(
        rows=1, cols=2,
        subplot_titles=(
            "Win Δ vs opponent level (player fixed at 50)",
            "K-factor by score band",
        ),
        column_widths=[0.65, 0.35],
    )

    # Left: one line per K value
    for _k in sorted(K_COLORS):
        _deltas = [round(_k * (1 - win_prob(50, opp)), 3) for opp in _opp_levels]
        _fig.add_trace(
            go.Scatter(
                x=_opp_levels, y=_deltas,
                mode="lines", name=f"K={_k}",
                line=dict(color=K_COLORS[_k], width=2.5),
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
        yaxis=dict(title="Win Δ (level points gained)", gridcolor="#eee"),
        yaxis2=dict(gridcolor="#eee"),
        xaxis=dict(title="Opponent average level", gridcolor="#eee", range=[0, 100]),
        xaxis2=dict(title="Loser score range", gridcolor="#eee"),
        margin=dict(t=50, b=50),
    )
    mo.ui.plotly(_fig)
    return


@app.cell(hide_code=True)
def _(K_DEFAULT, K_MAX, mo):
    mo.md(
        f"""
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
        A **deuce win** (22–20) uses $K = {K_DEFAULT}$ (smallest swing); a **dominant 21–0** uses $K = {K_MAX}$
        (largest swing). No score recorded also defaults to $K = {K_DEFAULT}$.
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
        """
    )
    return


@app.cell(hide_code=True)
def _(K_SCALE, balance_factor, mo):
    import math as _math
    _k_ex = K_SCALE[0]["k"]  # example K tier for the table
    _teams = [
        ("[50, 50]",     [50, 50]),
        ("[50, 60]",     [50, 60]),
        ("[40, 80]",     [40, 80]),
        ("[0, 100]",     [0, 100]),
        ("singles [80]", [80]),
    ]
    _rows = []
    for _label, _t in _teams:
        _bf = balance_factor(_t)
        _sigma = round((_math.sqrt(sum((x - sum(_t) / len(_t)) ** 2 for x in _t) / len(_t))), 0)
        _keff = round(_k_ex * _bf, 2)
        _rows.append(f"| {_label:<14} | {int(_sigma):<8} | {_bf:.2f}    | {_keff:.2f}                             |")
    _table = "\n".join(_rows)
    mo.md(
f"""
**Step 1 — team standard deviation** (how spread out the team's levels are):

$$\\sigma = \\sqrt{{\\frac{{1}}{{n}}\\sum_{{i=1}}^{{n}}(L_i - \\bar{{L}})^2}}
  \\qquad \\text{{for 2 players:}}\\quad \\sigma = \\tfrac{{|L_1 - L_2|}}{{2}}$$

**Step 2 — balance factor** (how much of the raw K to keep; clamps at 0.5 for a fully
mismatched team):

$$\\beta = 1 - 0.5 \\times \\min\\!\\left(\\frac{{\\sigma}}{{50}},\\; 1\\right) \\qquad \\in [0.5,\\; 1.0]$$

**Step 3 — effective K** (the K actually applied to each player's rating):

$$K_{{\\text{{eff}}}} = K_{{\\text{{raw}}}} \\times \\beta$$

| Team          | $\\sigma$ | $\\beta$ | $K_{{\\text{{eff}}}}$ (raw $K = {_k_ex}$) |
|---------------|----------|---------|----------------------------------|
{_table}

Singles (1-player teams) are always unaffected ($\\beta = 1.0$). Each team gets its own
balance-adjusted K independently — a lopsided team 1 does not affect team 2's K.
"""
    )
    return


@app.cell(hide_code=True)
def _(K_MAX, K_SCALE, balance_factor, go, make_subplots, mo):
    # For a 2-player team [50−s/2, 50+s/2], spread = s, stdDev = s/2
    _spreads = list(range(0, 101))
    _bfs     = [balance_factor([50 - s / 2, 50 + s / 2]) for s in _spreads]

    _RAW_KS  = [b["k"] for b in K_SCALE] + [K_MAX]
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
        yaxis=dict(title="Balance factor", gridcolor="#eee"),
        xaxis2=dict(title="Team level spread |L₁ − L₂|", gridcolor="#eee"),
        yaxis2=dict(title="Effective K", gridcolor="#eee"),
        margin=dict(t=50),
    )
    mo.vstack([
        mo.ui.plotly(_fig),
        mo.hstack([
            mo.md(f"""
**Left chart — balance factor curve.**
The x-axis is the absolute level difference between the two teammates ($|L_1 - L_2|$).
At spread = 0 both players are identical ($\\beta = 1.0$, no reduction). At spread = 100 —
one player at 0, the other at 100 — the factor bottoms out at $\\beta = 0.5$, halving every
rating change for that team. Anything in between scales smoothly.
            """),
            mo.md(f"""
**Right chart — effective K per raw K.**
Each coloured line is one K tier. The reduction is proportional across all tiers: a
dominant-win $K = {K_MAX}$ drops to {K_MAX * 0.5} for a maximally unbalanced team, and a
close-win $K = {K_SCALE[0]["k"]}$ drops to {K_SCALE[0]["k"] * 0.5}. Both players on the
unbalanced team are affected equally — the strong player is not penalised more than the weak one.
            """),
        ], widths="equal"),
    ])
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
        The balance factor reduces K uniformly for **both** players on an unbalanced team.
        Its effect is identical regardless of which player is strong or weak — the team is
        treated as a single entity. The charts below show the win and loss deltas for five
        representative team matchups, both with and without the balance factor applied, using
        $K_{\text{raw}} = K_{\text{default}}$ (no score entered).

        Key insight: a [0, 100] team and a [50, 50] team are treated as identical in terms of
        expected win probability (both average 50), but the unbalanced team gets **half the
        delta** due to $\beta = 0.5$. All players on the team — the expert and the beginner
        alike — receive the same reduced adjustment.
        """
    )
    return


@app.cell(hide_code=True)
def _(ELO_DIVISOR, K_DEFAULT, avg_level, balance_factor, go, mo, win_prob):
    _scenarios_bf = [
        ("[50,50] vs [50,50]",  [50, 50],   [50, 50]),
        ("[40,80] vs [50,50]",  [40, 80],   [50, 50]),
        ("[0,100] vs [50,50]",  [0, 100],   [50, 50]),
        ("[0,100] vs [0,100]",  [0, 100],   [0, 100]),
        ("[20,80] vs [40,60]",  [20, 80],   [40, 60]),
    ]

    _rows = []
    for _label, _t1, _t2 in _scenarios_bf:
        _a1, _a2 = avg_level(_t1), avg_level(_t2)
        _ep1 = win_prob(_a1, _a2)
        _ep2 = 1.0 - _ep1
        _bf1 = balance_factor(_t1)
        _bf2 = balance_factor(_t2)
        _k1  = K_DEFAULT * _bf1
        _k2  = K_DEFAULT * _bf2
        _rows.append({
            "label": _label,
            "win_with_bf":    round(_k1 * (1.0 - _ep1), 3),
            "win_without_bf": round(K_DEFAULT * (1.0 - _ep1), 3),
            "loss_with_bf":   round(_k1 * (0.0 - _ep1), 3),
            "loss_without_bf":round(K_DEFAULT * (0.0 - _ep1), 3),
            "bf1": round(_bf1, 2),
            "bf2": round(_bf2, 2),
        })

    _labels = [r["label"] for r in _rows]
    _fig_bf = go.Figure()
    _fig_bf.add_trace(go.Bar(
        name="win Δ — with bf",    x=_labels, y=[r["win_with_bf"]    for r in _rows],
        marker_color="#1f77b4", text=[str(r["win_with_bf"])    for r in _rows], textposition="outside",
    ))
    _fig_bf.add_trace(go.Bar(
        name="win Δ — without bf", x=_labels, y=[r["win_without_bf"] for r in _rows],
        marker_color="#aec7e8", text=[str(r["win_without_bf"]) for r in _rows], textposition="outside",
    ))
    _fig_bf.add_trace(go.Bar(
        name="loss Δ — with bf",    x=_labels, y=[r["loss_with_bf"]   for r in _rows],
        marker_color="#d62728", text=[str(r["loss_with_bf"])   for r in _rows], textposition="outside",
    ))
    _fig_bf.add_trace(go.Bar(
        name="loss Δ — without bf", x=_labels, y=[r["loss_without_bf"] for r in _rows],
        marker_color="#ffb09c", text=[str(r["loss_without_bf"]) for r in _rows], textposition="outside",
    ))
    _fig_bf.update_layout(
        barmode="group", height=420,
        title=f"Team 1 delta — K={K_DEFAULT}, D={ELO_DIVISOR} (with vs without balance factor)",
        plot_bgcolor="white", paper_bgcolor="white",
        legend=dict(x=0.01, y=0.99, bgcolor="rgba(255,255,255,0.8)", bordercolor="#ccc", borderwidth=1),
        xaxis=dict(title="Matchup", gridcolor="#eee"),
        yaxis=dict(title="Δ level", gridcolor="#eee"),
        margin=dict(t=50, b=60),
    )
    return mo.ui.plotly(_fig_bf)



# =============================================================================
# 4 · Elo Delta Simulations
# =============================================================================

@app.cell(hide_code=True)
def _(K_DEFAULT, K_MAX, mo):
    mo.md(f"""---
## 4 · Elo Delta Simulations

The **Elo system** assigns each player a numeric level (0–100). After every game the winner
gains points and the loser loses the same amount. The size of the swing — the **Elo delta** —
is governed by two factors studied in the previous sections:

- **K-factor** (§ 2): larger for more dominant wins, smaller for close games (K = {K_DEFAULT} when no
  score is recorded, same as deuce; K = {K_MAX} for the most dominant wins).
- **Balance factor** (§ 3): scales K down when a team's two players have very different levels,
  reducing rating volatility for uneven pairings.

This section visualises the resulting Elo delta across the full range of team averages, within-team
spread, and balance-factor scenarios — **before** any real game sequence is run.
""")
    return


@app.cell(hide_code=True)
def _(ELO_DIVISOR, K_DEFAULT, K_MAX, K_SCALE, mo, win_prob):
    def _k_for_diff(diff):
        for _b in K_SCALE:
            if diff <= _b["maxDiff"]:
                return _b["k"]
        return K_MAX

    # Example 1: dominant win (21-5, diff=16)
    _k1 = _k_for_diff(16)
    _e1a = round(win_prob(70, 30), 3)
    _e1b = round(1 - _e1a, 3)
    _d1a = round(_k1 * (1 - _e1a), 2)
    _d1b = round(_k1 * (0 - _e1b), 2)

    # Example 2: upset (21-19, diff=2)
    _k2 = _k_for_diff(2)
    _e2a = round(win_prob(30, 70), 3)
    _e2b = round(1 - _e2a, 3)
    _d2a = round(_k2 * (1 - _e2a), 2)
    _d2b = round(_k2 * (0 - _e2b), 2)

    # Example 3: expected win (21-15, diff=6)
    _k3 = _k_for_diff(6)
    _e3a = round(win_prob(80, 60), 3)
    _e3b = round(1 - _e3a, 3)
    _d3w_a = round(_k3 * (1 - _e3a), 2)
    _d3l_a = round(_k3 * (0 - _e3a), 2)
    _d3w_b = round(_k3 * (1 - _e3b), 2)
    _d3l_b = round(_k3 * (0 - _e3b), 2)

    # 50-pt gap example
    _e_gap = round(win_prob(75, 25) * 100, 1)

    mo.vstack([
        mo.md(f"""
### 4a · Expected Win Probability

Before each game, the system estimates how likely each team is to win based on their
average player levels. Equal teams each get 50 %. The formula uses a divisor of {ELO_DIVISOR}
(see § 1), which makes the curve flat — even a very large level gap barely
moves the probability away from 50 %:

$$\\bar{{L}}_\\text{{team}} = \\frac{{1}}{{n}}\\sum_{{i=1}}^{{n}} L_i
  \\qquad \\text{{(unknown level}} \\to 50\\text{{)}}$$

$$E_A = \\frac{{1}}{{1 + 10^{{(\\bar{{L}}_B - \\bar{{L}}_A)\\,/\\,D}}}}, \\qquad E_B = 1 - E_A$$

A 50-point level gap (level 75 vs level 25) gives $E_A \\approx {_e_gap}\\,\\%$ — close to a coin flip.

### 4b · Level Delta

After the game, every player on the winning team gains points and every player on the
losing team loses the same number. The size of the swing grows with how surprising the
result was: a massive upset earns far more than a comfortable expected win.

$$\\text{{actual}} = \\begin{{cases}} 1 & \\text{{(team won)}} \\\\ 0 & \\text{{(team lost)}} \\end{{cases}}
  \\qquad \\Delta = K_{{\\text{{eff}}}} \\times (\\text{{actual}} - E)$$

$$L_{{\\text{{new}}}} = \\operatorname{{clamp}}(L + \\Delta,\\; 0,\\; 100) \\quad \\text{{rounded to 1 d.p.}}$$
        """),
        mo.accordion({
            f"Worked example — dominant win (21-5)": mo.md(f"""
Team A (avg level 70) beats Team B (avg level 30) convincingly. The score diff is 16,
so $K = {_k1}$ (most dominant bracket). With $D = {ELO_DIVISOR}$:

| | Team A (avg 70) | Team B (avg 30) |
|---|---|---|
| $K$ (diff = 16) | {_k1} | {_k1} |
| $E$ | {_e1a} | {_e1b} |
| actual | 1 (won) | 0 (lost) |
| $\\Delta$ | $+{_k1} \\times (1 - {_e1a}) = \\mathbf{{+{_d1a}}}$ | $+{_k1} \\times (0 - {_e1b}) = \\mathbf{{{_d1b}}}$ |
            """),
            f"Worked example — upset (21-19, weak beats strong)": mo.md(f"""
Team A (avg 30) shocks Team B (avg 70) in a tight game. The score diff is only 2,
so $K = {_k2}$ (close-win bracket).

| | Team A (avg 30) | Team B (avg 70) |
|---|---|---|
| $K$ (diff = 2) | {_k2} | {_k2} |
| $E$ | {_e2a} | {_e2b} |
| actual | 1 (won) | 0 (lost) |
| $\\Delta$ | $+{_k2} \\times (1 - {_e2a}) = \\mathbf{{+{_d2a}}}$ | $+{_k2} \\times (0 - {_e2b}) = \\mathbf{{{_d2b}}}$ |
            """),
            f"Worked example — expected win (21-15, strong beats weak)": mo.md(f"""
A level-80 player beats a level-60 opponent with a comfortable margin. The score diff
is 6, so $K = {_k3}$. With $D = {ELO_DIVISOR}$:

| | Level-80 player | Level-60 opponent |
|---|---|---|
| $K$ (diff = 6) | {_k3} | {_k3} |
| $E$ | {_e3a} | {_e3b} |
| **Win** (actual = 1) | $\\mathbf{{+{_d3w_a}}}$ → {round(80 + _d3w_a, 1)} | $\\mathbf{{{_d3l_b}}}$ → {round(60 + _d3l_b, 1)} |
| **Lose** (actual = 0) | $\\mathbf{{{_d3l_a}}}$ → {round(80 + _d3l_a, 1)} | $\\mathbf{{+{_d3w_b}}}$ → {round(60 + _d3w_b, 1)} |
            """),
        }),
    ])
    return


@app.cell(hide_code=True)
def _(ELO_DIVISOR, K_MAX, avg_level, balance_factor, go, k_factor, make_subplots, mo, win_prob):
    _LAYOUT4 = dict(
        height=380, plot_bgcolor="white", paper_bgcolor="white",
        margin=dict(t=50, b=45, l=50, r=20),
    )
    _LEGEND = dict(bgcolor="rgba(255,255,255,0.85)", bordercolor="#ccc", borderwidth=1)

    # --- Fig 1: win probability heatmap + Fig 2: spread impact ---
    _avgs = list(range(0, 101, 5))
    _prob_grid = []
    for _a1 in _avgs:
        _prob_grid.append([round(win_prob(_a1, _a2), 3) for _a2 in _avgs])

    _spreads_line = list(range(0, 51))
    _win_d, _loss_d = [], []
    for _s in _spreads_line:
        _t1 = [50.0 - _s, 50.0 + _s]
        _e1 = win_prob(avg_level(_t1), avg_level([50.0, 50.0]))
        _k1 = k_factor(None, None, _t1)
        _win_d.append(round(_k1 * (1.0 - _e1), 3))
        _loss_d.append(round(_k1 * (0.0 - _e1), 3))

    _fig_top = make_subplots(
        rows=1, cols=2,
        subplot_titles=(
            f"Expected win probability for team 1 (D={ELO_DIVISOR})",
            "Δ vs spread — team1=[50±s] vs team2=[50,50]",
        ),
    )
    _fig_top.add_trace(go.Heatmap(
        x=_avgs, y=_avgs, z=_prob_grid,
        colorscale="RdYlGn",
        colorbar=dict(title="P(team 1 wins)", x=0.46, len=0.9, tickformat=".0%"),
        zmin=0.3, zmax=0.7,
    ), row=1, col=1)
    _fig_top.add_trace(go.Scatter(
        x=_spreads_line, y=_win_d, mode="lines", name="win Δ",
        line=dict(color="#2ca02c", width=2.5),
    ), row=1, col=2)
    _fig_top.add_trace(go.Scatter(
        x=_spreads_line, y=_loss_d, mode="lines", name="loss Δ",
        line=dict(color="#d62728", width=2.5),
    ), row=1, col=2)
    _fig_top.add_hline(y=0, line_dash="dot", line_color="#aaa", row=1, col=2)
    _fig_top.update_layout(
        **_LAYOUT4,
        legend=_LEGEND,
        xaxis=dict(title="Team 2 avg level", gridcolor="#eee"),
        yaxis=dict(title="Team 1 avg level", gridcolor="#eee", autorange="reversed"),
        xaxis2=dict(title="Spread s (team1 = [50−s, 50+s])", gridcolor="#eee"),
        yaxis2=dict(title="Δ level per player", gridcolor="#eee"),
    )

    # --- Fig 3: win delta with/without BF + Fig 4: balance factor per scenario ---
    _scenarios = [
        ("[50,50] vs [50,50]", [50, 50], [50, 50]),
        ("[40,80] vs [50,50]", [40, 80], [50, 50]),
        ("[0,100] vs [50,50]", [0, 100], [50, 50]),
        ("[0,100] vs [0,100]", [0, 100], [0, 100]),
        ("[0,100] vs [40,60]", [0, 100], [40, 60]),
    ]
    _sc_labels = [s[0] for s in _scenarios]
    _sc_win_with, _sc_win_without, _sc_bfs = [], [], []
    for _, _t1s, _t2s in _scenarios:
        _ep = win_prob(avg_level(_t1s), avg_level(_t2s))
        _sc_win_with.append(round(k_factor(None, None, _t1s) * (1.0 - _ep), 2))
        _sc_win_without.append(round(K_MAX * (1.0 - _ep), 2))
        _sc_bfs.append(balance_factor(_t1s))

    _fig_bot = make_subplots(
        rows=1, cols=2,
        subplot_titles=(
            f"Win Δ with vs without balance factor (K={K_MAX}, team1 wins)",
            "Balance factor for each scenario",
        ),
    )
    _fig_bot.add_trace(go.Bar(
        x=_sc_labels, y=_sc_win_without, name="without bf", marker_color="#aec7e8",
        text=[str(v) for v in _sc_win_without], textposition="outside",
    ), row=1, col=1)
    _fig_bot.add_trace(go.Bar(
        x=_sc_labels, y=_sc_win_with, name="with bf", marker_color="#1f77b4",
        text=[str(v) for v in _sc_win_with], textposition="outside",
    ), row=1, col=1)
    _fig_bot.add_trace(go.Bar(
        x=_sc_labels, y=_sc_bfs,
        marker_color=["#4C78A8" if bf == 1.0 else "#E45756" for bf in _sc_bfs],
        text=[f"{bf:.2f}" for bf in _sc_bfs], textposition="outside",
        showlegend=False,
    ), row=1, col=2)
    _fig_bot.add_hline(y=1.0, line_dash="dot", line_color="#aaa", row=1, col=2)
    _fig_bot.update_layout(
        **_LAYOUT4,
        barmode="group",
        legend=dict(x=0.02, y=0.98, **_LEGEND),
        xaxis=dict(tickangle=-15),
        yaxis=dict(range=[0, 4], title="Win Δ", gridcolor="#eee"),
        xaxis2=dict(tickangle=-15),
        yaxis2=dict(range=[0, 1.1], title="Balance factor", gridcolor="#eee"),
    )

    _lo = round(win_prob(0, 100) * 100, 0)
    _hi = round(win_prob(100, 0) * 100, 0)

    mo.vstack([
        mo.ui.plotly(_fig_top),
        mo.hstack([
            mo.md(f"""
**Figure 1 — Expected win probability heatmap (D = {ELO_DIVISOR}).**
Each cell is the probability that team 1 wins, computed from the Elo formula before any game
is played. The diagonal (equal-strength teams) is always 50 % — shown in yellow. Moving
up-left (team 1 much stronger) pushes probability toward green (~{_hi:.0f} %); moving down-right
(team 1 much weaker) pushes it toward red (~{_lo:.0f} %). Rating changes are therefore driven
primarily by the K-factor and score margin, not only by level differences.
This probability is the direct input to every delta calculation in the section below.
            """),
            mo.md("""
**Figure 2 — Spread impact on delta.**
Team 1 always averages 50 but its internal spread grows from 0 (both players at 50) to ±50
(one at 0, one at 100). As spread increases, the balance factor lowers K, shrinking both the
win reward and the loss penalty. A maximally uneven team [0, 100] ends up with roughly half
the delta of a perfectly balanced team.
            """),
        ], widths="equal"),
        mo.ui.plotly(_fig_bot),
        mo.hstack([
            mo.md(f"""
**Figure 3 — Win delta: with vs without balance factor.**
Five representative matchups compare the raw delta (K = {K_MAX}, no balance factor, light blue)
against the adjusted delta (with balance factor, dark blue). Balanced teams ([50, 50] vs
[50, 50]) are unaffected (balance factor = 1). The more uneven team 1 is, the larger the
reduction — a [0, 100] pairing is cut by ~50 % regardless of the opponent.
            """),
            mo.md("""
**Figure 4 — Balance factor by scenario.**
The balance factor value for each matchup. Balanced teams score 1.0 (no reduction). A
[40, 80] pairing scores ~0.87. A [0, 100] pairing hits the 0.5 floor — rating changes are
halved, regardless of the result or the opponent's composition.
            """),
        ], widths="equal"),
    ])
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

        **Level-rating example — [0, 100] vs [50, 60], no score ($K_{\text{raw}} = 0.3$, $E \approx 0.5$):**

        The unbalanced team [0, 100] has $\beta = 0.5$, so $K_{\text{eff}} = 0.15$.
        The balanced team [50, 60] has $\beta = 0.95$, so $K_{\text{eff}} = 0.285$.

        |           | Team 1 ([0, 100], $K_{\text{eff}} = 0.15$) | Team 2 ([50, 60], $K_{\text{eff}} = 0.285$) |
        |-----------|---------------------------------------------|----------------------------------------------|
        | Lose / Win  | $-0.075$ pts each                         | $+0.14$ pts each                             |
        | Win / Lose  | $+0.075$ pts each                         | $-0.14$ pts each                             |

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
def _(go, make_subplots, mo, play_game, random):
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

    _s_det_a, _s_det_b = _simulate_singles(50, 50, _N_det, stochastic=False)
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
    for _lbl, _hist, _col in [("A (start=50)", _s_det_a, "#E45756"), ("B (start=50)", _s_det_b, "#4C78A8")]:
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
**Deterministic (A=50, B=50):** both players start equal, but the deterministic rule
(stronger always wins, ties go to A) immediately breaks symmetry — A wins every game and
levels diverge steadily. The chart is capped at 25 games to show the divergence before the
plateau at 0/100.
            """),
            mo.md("""
**Stochastic (A=50, B=50):** the winner is drawn from the Elo win probability, introducing
noise even between equal players. Random winning streaks push one player ahead until the
rating update pulls them back. The result is a noisy, mean-reverting oscillation around 50.
            """),
        ], widths="equal"),
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
        ], widths="equal"),
    ])
    return


if __name__ == "__main__":
    app.run()
