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
    _data_dir = Path(__file__).parent / "data"
    _raw_data = json.loads((_data_dir / "disparity_comparison.json").read_text())
    metadata = _raw_data.get("metadata", {})

    df_all = pl.read_csv(_data_dir / "disparity_summary.csv")
    df_comparison = df_all.filter(pl.col("configName") == "default")
    df_sweeps = df_all.filter(pl.col("configName") != "default")

    profile_labels = {
        "lot_strong_lot_weak": "Heavy Disparity (Many Strong, Many Weak)",
        "few_strong_few_weak": "Moderate Disparity (Few Strong, Few Weak)",
        "lot_strong": "Top-Heavy (Many Strong, Rest Medium)",
        "few_weak": "Bottom-Heavy (Few Weak, Rest Medium)",
        "lot_weak_few_strong": "Asymmetric (Many Weak, Few Strong)",
    }

    sweep_configs_info = {
        "sl2_baseline": {
            "label": "Baseline (Level=150, Var=800, Mix=200, Str=300)",
            "levelWeight": 150,
            "varietyWeight": 800,
            "mixedDoublesWeight": 200,
            "winStreakWeight": 300,
        },
        "sl2_low_level": {
            "label": "Low Level Weight (Level=50)",
            "levelWeight": 50,
            "varietyWeight": 800,
            "mixedDoublesWeight": 200,
            "winStreakWeight": 300,
        },
        "sl2_high_level": {
            "label": "High Level Weight (Level=300)",
            "levelWeight": 300,
            "varietyWeight": 800,
            "mixedDoublesWeight": 200,
            "winStreakWeight": 300,
        },
        "sl2_low_variety": {
            "label": "Low Variety Weight (Var=400)",
            "levelWeight": 150,
            "varietyWeight": 400,
            "mixedDoublesWeight": 200,
            "winStreakWeight": 300,
        },
        "sl2_high_variety": {
            "label": "High Variety Weight (Var=1200)",
            "levelWeight": 150,
            "varietyWeight": 1200,
            "mixedDoublesWeight": 200,
            "winStreakWeight": 300,
        },
        "sl2_low_mixed": {
            "label": "Low Mixed Doubles (Mix=50)",
            "levelWeight": 150,
            "varietyWeight": 800,
            "mixedDoublesWeight": 50,
            "winStreakWeight": 300,
        },
        "sl2_high_mixed": {
            "label": "High Mixed Doubles (Mix=400)",
            "levelWeight": 150,
            "varietyWeight": 800,
            "mixedDoublesWeight": 400,
            "winStreakWeight": 300,
        },
        "sl2_low_streak": {
            "label": "Low Win Streak Momentum (Str=100)",
            "levelWeight": 150,
            "varietyWeight": 800,
            "mixedDoublesWeight": 200,
            "winStreakWeight": 100,
        },
        "sl2_high_streak": {
            "label": "High Win Streak Momentum (Str=500)",
            "levelWeight": 150,
            "varietyWeight": 800,
            "mixedDoublesWeight": 200,
            "winStreakWeight": 500,
        },
    }

    color_sl = "#4C78A8"
    color_sl2 = "#F58518"
    color_sweep = "#54A24B"

    return (
        color_sl,
        color_sl2,
        color_sweep,
        df_all,
        df_comparison,
        df_sweeps,
        metadata,
        profile_labels,
        sweep_configs_info,
    )


@app.cell(hide_code=True)
def _(metadata, mo):
    _runs_count = metadata.get("runs", 25)
    _rounds_count = metadata.get("rounds", 12)
    _player_counts_str = ", ".join(str(c) for c in metadata.get("playerCounts", [16, 18, 20]))

    _header_text = (
        f"# Smart2 Matching Engine — Disparity & Weight Analysis\n\n"
        f"Empirical evaluation of **Smart2 Matching (SL2)** compared against the original **Smart Matching (SL)** "
        f"under severe skill disparity conditions across **{_runs_count} runs × {_rounds_count} rounds** "
        f"for player pools of **[{_player_counts_str}]**.\n\n"
        "---\n\n"
    )

    _body_text = r"""
## 1. The Pod Lock-In Problem in Smart Matching (SL)

Smart Matching (SL) optimizes doubles match fairness using Simulated Annealing with two dominant level-based penalty functions:
1. **Teammate Level Bias** (`LEVEL_PAIR_BIAS = 120`): Penalizes skill gaps between partners $|L_1 - L_2| \times 120$.
2. **Team Level Balance** (`LEVEL_BALANCE_PENALTY = 250`): Penalizes differential between opposing teams $|\overline{L}_{\text{team1}} - \overline{L}_{\text{team2}}| \times 250$.

### Why Rounds 1–3 Trap Strong Players
When a session contains 4 strong players (levels 85–95) and several weaker players (levels 20–30):
- Pairing a strong player with a weaker partner incurs an immediate partner penalty of $|90 - 25| \times 120 = 7,800$.
- Because 7,800 is immense (on par with the 8,000 gender mismatch penalty), the optimizer strongly rejects cross-tier pairings.
- Instead, it puts all 4 strong players on **Court 1**, where both teams have equal average skill and partner level gap is zero.
- Four players on a court have exactly $\frac{1}{2} \binom{4}{2} = 3$ unique doubles pairings ($AB \text{ vs } CD$, $AC \text{ vs } BD$, $AD \text{ vs } BC$).
- In rounds 1, 2, and 3, the engine rotates through these 3 permutations.
- **By round 4, every unique pairing within the 4-player pod is exhausted.** Because SL has no pod repeat penalty and only a nominal opponent repeat penalty (50), the optimizer keeps the exact same 4 players isolated together on Court 1 for the rest of the session.
- Under heavy disparity (`lot_strong_lot_weak`), Smart (SL) exhibits an early lock-in rate approaching **50%** and maximum rematch frequencies of **7 to 9 times** in 12 rounds.

---

## 2. Smart2 (SL2) Sliding Window Architecture

Smart2 solves pod lock-in through a complete architectural overhaul:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Smart2 Matching Engine                          │
│                                                                        │
│   1. Sliding Window Spread: max(0, maxLevel - minLevel - 25) * W_level  │
│   2. Pod Repeat Suppression: repeatCount >= 3 => count * W_variety     │
│   3. Dynamic Win Momentum: effectiveLevel = base + (W - L) * (W_str/100)│
│   4. Mixed Doubles Preference: -W_mixed (MF vs MF) / +W_mixed (FF vs MM)│
└────────────────────────────────────────────────────────────────────────┘
```

- **Sliding Window Level Grouping**: Eliminates rigid teammate level bias. Instead, it enforces a court-wide sliding window with `windowTolerance = 25`, penalizing only excess spread beyond the window tolerance:
  $$\text{Cost}_{\text{spread}} = \max(0, \max(L) - \min(L) - \text{windowTolerance}) \times W_{\text{level}}$$
  This allows adjacent skill tiers to naturally pair up and play without incurring prohibitive penalties.
- **Pod Repeat Penalty**: Evaluates co-occurrence across all $\binom{4}{2} = 6$ pairs on a court. When 3 or more pairs have previously played together (as partners or opponents), a heavy penalty is applied:
  $$\text{Cost}_{\text{pod}} = \text{repeatCount} \times W_{\text{variety}} \quad (\text{when } \text{repeatCount} \ge 3)$$
  This guarantees that 4-player clusters are shattered and circulated across the venue.
- **Dynamic Win Streak Momentum**: Modulates player effective levels dynamically based on match outcomes:
  $$L_{\text{eff}} = \text{clamp}_{0}^{100}\left(L_{\text{base}} + (\text{wins} - \text{losses}) \times \frac{W_{\text{streak}}}{100}\right)$$
  Winning players drift upward into stronger sliding windows while struggling players shift downward, continuously shuffling courts.
- **Soft Mixed Doubles Optimization**: Rewards mixed doubles ($MF \text{ vs } MF$) with a bonus of $-W_{\text{mixed}}$ while penalizing homogeneous gender mismatches ($FF \text{ vs } MM$) with $+W_{\text{mixed}}$.

---

## 3. The 4 Core Hyperparameters

| Parameter | Default | Role & Effect |
|:---|:---:|:---|
| **Level Weight** ($W_{\text{level}}$) | `150` | Balances team skill parity and enforces sliding window boundaries. |
| **Variety Weight** ($W_{\text{variety}}$) | `800` | Suppresses repeated opponents and shatters recurring 4-player pods. |
| **Mixed Doubles Weight** ($W_{\text{mixed}}$) | `200` | Incentivizes mixed doubles pairings without degrading match balance. |
| **Win Streak Weight** ($W_{\text{streak}}$) | `300` | Scales win/loss rating drift to circulate players between court tiers. |

---
"""
    return mo.md(_header_text + _body_text)


@app.cell
def _(mo, profile_labels, sweep_configs_info):
    profile_select = mo.ui.dropdown(
        options=profile_labels,
        value="lot_strong_lot_weak",
        label="Disparity Profile",
    )

    player_count_select = mo.ui.radio(
        options=["16", "18", "20"],
        value="18",
        label="Player Count (N)",
    )

    sweep_preset_select = mo.ui.dropdown(
        options={k: v["label"] for k, v in sweep_configs_info.items()},
        value="sl2_baseline",
        label="SL2 Parameter Sweep Variant",
    )

    level_weight_slider = mo.ui.slider(
        start=50,
        stop=300,
        step=25,
        value=150,
        label="Level Weight (W_level)",
        show_value=True,
    )

    variety_weight_slider = mo.ui.slider(
        start=400,
        stop=1200,
        step=100,
        value=800,
        label="Variety Weight (W_variety)",
        show_value=True,
    )

    mixed_weight_slider = mo.ui.slider(
        start=50,
        stop=400,
        step=50,
        value=200,
        label="Mixed Doubles Weight (W_mixed)",
        show_value=True,
    )

    streak_weight_slider = mo.ui.slider(
        start=100,
        stop=500,
        step=50,
        value=300,
        label="Win Streak Weight (W_streak)",
        show_value=True,
    )

    return (
        level_weight_slider,
        mixed_weight_slider,
        player_count_select,
        profile_select,
        streak_weight_slider,
        sweep_preset_select,
        variety_weight_slider,
    )


@app.cell(hide_code=True)
def _(
    df_comparison,
    df_sweeps,
    level_weight_slider,
    mixed_weight_slider,
    mo,
    player_count_select,
    profile_select,
    streak_weight_slider,
    sweep_preset_select,
    variety_weight_slider,
):
    _selected_prof = profile_select.value
    _selected_pc = int(player_count_select.value)
    _selected_sweep = sweep_preset_select.value

    _sl_sub = df_comparison.filter(
        (df_comparison["profile"] == _selected_prof)
        & (df_comparison["numPlayers"] == _selected_pc)
        & (df_comparison["engine"] == "sl")
    )
    _sl2_sub = df_comparison.filter(
        (df_comparison["profile"] == _selected_prof)
        & (df_comparison["numPlayers"] == _selected_pc)
        & (df_comparison["engine"] == "sl2")
    )

    _sweep_sub = df_sweeps.filter(
        (df_sweeps["configName"] == _selected_sweep)
        & (df_sweeps["profile"] == _selected_prof)
        & (df_sweeps["numPlayers"] == _selected_pc)
    )

    _sl_row = _sl_sub.to_dicts()[0] if _sl_sub.height > 0 else {}
    _sl2_row = _sl2_sub.to_dicts()[0] if _sl2_sub.height > 0 else {}
    _sweep_row = _sweep_sub.to_dicts()[0] if _sweep_sub.height > 0 else None

    _sl_pod = _sl_row.get("podLockInCount", 0.0)
    _sl2_pod = _sl2_row.get("podLockInCount", 0.0)
    _pod_delta = ((_sl2_pod - _sl_pod) / _sl_pod * 100) if _sl_pod > 0 else 0.0

    _sl_early = _sl_row.get("earlyLockInPercentage", 0.0)
    _sl2_early = _sl2_row.get("earlyLockInPercentage", 0.0)

    _sl_div = _sl_row.get("oppDiversityOverall", 0.0)
    _sl2_div = _sl2_row.get("oppDiversityOverall", 0.0)

    _sl_max_opp = _sl_row.get("maxOpponentFacing", 0.0)
    _sl2_max_opp = _sl2_row.get("maxOpponentFacing", 0.0)

    _sl_mix = _sl_row.get("mixedDoublesRate", 0.0)
    _sl2_mix = _sl2_row.get("mixedDoublesRate", 0.0)

    _sweep_badge = ""
    if _sweep_row:
        _sw_pod = _sweep_row.get("podLockInCount", 0.0)
        _sw_div = _sweep_row.get("oppDiversityOverall", 0.0)
        _sw_mix = _sweep_row.get("mixedDoublesRate", 0.0)
        _sweep_badge = f"""
        <div style="background: #e8f5e9; border: 1px solid #a5d6a7; border-radius: 8px; padding: 10px 16px; margin-top: 10px; font-size: 0.9rem;">
          <b>Sweep Variant ({_selected_sweep}) for N={_selected_pc}:</b>
          Pod Lock-In: <b>{_sw_pod:.2f}</b> | Opponent Diversity: <b>{_sw_div:.2f}</b> | Mixed Doubles Rate: <b>{_sw_mix:.1f}%</b>
        </div>
        """

    _kpi_card_html = f"""
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 15px 0;">
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; text-align: center;">
        <div style="color: #64748b; font-size: 0.8rem; text-transform: uppercase; font-weight: bold;">Pod Lock-In Count</div>
        <div style="font-size: 1.5rem; font-weight: bold; margin: 4px 0; color: #0f172a;">{_sl2_pod:.2f} <span style="font-size: 0.9rem; color: #16a34a;">({_pod_delta:+.1f}%)</span></div>
        <div style="font-size: 0.8rem; color: #64748b;">SL baseline: {_sl_pod:.2f}</div>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; text-align: center;">
        <div style="color: #64748b; font-size: 0.8rem; text-transform: uppercase; font-weight: bold;">Early Lock-In (R1-R3)</div>
        <div style="font-size: 1.5rem; font-weight: bold; margin: 4px 0; color: #0f172a;">{_sl2_early:.1f}%</div>
        <div style="font-size: 0.8rem; color: #64748b;">SL baseline: {_sl_early:.1f}%</div>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; text-align: center;">
        <div style="color: #64748b; font-size: 0.8rem; text-transform: uppercase; font-weight: bold;">Opponent Diversity</div>
        <div style="font-size: 1.5rem; font-weight: bold; margin: 4px 0; color: #0f172a;">{_sl2_div:.2f}</div>
        <div style="font-size: 0.8rem; color: #64748b;">SL baseline: {_sl_div:.2f}</div>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; text-align: center;">
        <div style="color: #64748b; font-size: 0.8rem; text-transform: uppercase; font-weight: bold;">Max Rematch Count</div>
        <div style="font-size: 1.5rem; font-weight: bold; margin: 4px 0; color: #0f172a;">{_sl2_max_opp:.2f}</div>
        <div style="font-size: 0.8rem; color: #64748b;">SL baseline: {_sl_max_opp:.2f}</div>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; text-align: center;">
        <div style="color: #64748b; font-size: 0.8rem; text-transform: uppercase; font-weight: bold;">Mixed Doubles Rate</div>
        <div style="font-size: 1.5rem; font-weight: bold; margin: 4px 0; color: #0f172a;">{_sl2_mix:.1f}%</div>
        <div style="font-size: 0.8rem; color: #64748b;">SL baseline: {_sl_mix:.1f}%</div>
      </div>
    </div>
    {_sweep_badge}
    """

    return mo.vstack([
        mo.md("### Interactive Scenario & Weight Explorer"),
        mo.hstack([profile_select, player_count_select, sweep_preset_select], justify="start", gap=2),
        mo.accordion({
            "Fine-Grained Weight Tuning Sliders": mo.vstack([
                mo.md("*Adjust individual parameters to observe weight sensitivity:*"),
                mo.hstack([level_weight_slider, variety_weight_slider], justify="start", gap=2),
                mo.hstack([mixed_weight_slider, streak_weight_slider], justify="start", gap=2),
            ])
        }),
        mo.Html(_kpi_card_html),
    ])


@app.cell(hide_code=True)
def _(
    color_sl,
    color_sl2,
    color_sweep,
    df_comparison,
    df_sweeps,
    go,
    make_subplots,
    mo,
    player_count_select,
    profile_labels,
    sweep_preset_select,
):
    _selected_pc = int(player_count_select.value)
    _selected_sweep = sweep_preset_select.value

    _comp_pc = df_comparison.filter(df_comparison["numPlayers"] == _selected_pc)
    _profiles_ordered = list(profile_labels.keys())

    _sl_pods = []
    _sl2_pods = []
    _sl_earlies = []
    _sl2_earlies = []
    _labels = []

    for _prof in _profiles_ordered:
        _sl_sub = _comp_pc.filter((_comp_pc["profile"] == _prof) & (_comp_pc["engine"] == "sl"))
        _sl2_sub = _comp_pc.filter((_comp_pc["profile"] == _prof) & (_comp_pc["engine"] == "sl2"))
        if _sl_sub.height > 0 and _sl2_sub.height > 0:
            _labels.append(_prof.replace("_", " ").title())
            _sl_pods.append(_sl_sub["podLockInCount"][0])
            _sl2_pods.append(_sl2_sub["podLockInCount"][0])
            _sl_earlies.append(_sl_sub["earlyLockInPercentage"][0])
            _sl2_earlies.append(_sl2_sub["earlyLockInPercentage"][0])

    _fig = make_subplots(
        rows=1,
        cols=2,
        subplot_titles=(
            f"Pod Lock-In Count per Session (N={_selected_pc})",
            f"Early Round Lock-In Rate R1-R3 (%) (N={_selected_pc})",
        ),
    )

    _fig.add_trace(
        go.Bar(
            name="Smart (SL)",
            x=_labels,
            y=_sl_pods,
            marker_color=color_sl,
            text=[f"{v:.2f}" for v in _sl_pods],
            textposition="outside",
        ),
        row=1,
        col=1,
    )
    _fig.add_trace(
        go.Bar(
            name="Smart2 (SL2)",
            x=_labels,
            y=_sl2_pods,
            marker_color=color_sl2,
            text=[f"{v:.2f}" for v in _sl2_pods],
            textposition="outside",
        ),
        row=1,
        col=1,
    )

    _sweep_sub = df_sweeps.filter(
        (df_sweeps["configName"] == _selected_sweep)
        & (df_sweeps["numPlayers"] == _selected_pc)
    )
    _sweep_labels = [p.replace("_", " ").title() for p in _sweep_sub["profile"]] if _sweep_sub.height > 0 else []
    if _sweep_sub.height > 0:
        _fig.add_trace(
            go.Scatter(
                name=f"Sweep ({_selected_sweep})",
                x=_sweep_labels,
                y=_sweep_sub["podLockInCount"].to_list(),
                mode="markers+lines",
                marker=dict(color=color_sweep, size=11, symbol="diamond"),
            ),
            row=1,
            col=1,
        )

    _fig.add_trace(
        go.Bar(
            name="Smart (SL)",
            x=_labels,
            y=_sl_earlies,
            marker_color=color_sl,
            text=[f"{v:.1f}%" for v in _sl_earlies],
            textposition="outside",
            showlegend=False,
        ),
        row=1,
        col=2,
    )
    _fig.add_trace(
        go.Bar(
            name="Smart2 (SL2)",
            x=_labels,
            y=_sl2_earlies,
            marker_color=color_sl2,
            text=[f"{v:.1f}%" for v in _sl2_earlies],
            textposition="outside",
            showlegend=False,
        ),
        row=1,
        col=2,
    )

    if _sweep_sub.height > 0:
        _fig.add_trace(
            go.Scatter(
                name=f"Sweep ({_selected_sweep})",
                x=_sweep_labels,
                y=_sweep_sub["earlyLockInPercentage"].to_list(),
                mode="markers+lines",
                marker=dict(color=color_sweep, size=11, symbol="diamond"),
                showlegend=False,
            ),
            row=1,
            col=2,
        )

    _fig.update_layout(
        barmode="group",
        height=420,
        margin=dict(l=40, r=40, t=60, b=80),
        legend=dict(orientation="h", yanchor="bottom", y=1.05, xanchor="center", x=0.5),
    )
    _fig.update_xaxes(tickangle=-25)
    _fig.update_yaxes(title_text="Avg Pod Repeats", row=1, col=1)
    _fig.update_yaxes(title_text="Courts with 4 Strong/Weak (%)", row=1, col=2)

    return mo.vstack([
        mo.md("### Visual Comparison 1: Pod Lock-In & Early Round Lock-In (R1–R3)"),
        mo.md(
            "SL traps 4 strong players onto Court 1 early on (up to **49.7%** in rounds 1–3), "
            "exhausting unique matchups by round 3 and causing repeated pod repeats. "
            "SL2 introduces sliding window tolerance (`25`) and pod repeat penalties (`varietyWeight * repeats`), "
            "reducing lock-ins by **70–100%**."
        ),
        mo.ui.plotly(_fig),
    ])


@app.cell(hide_code=True)
def _(
    color_sl,
    color_sl2,
    color_sweep,
    df_comparison,
    df_sweeps,
    go,
    mo,
    player_count_select,
    profile_labels,
    profile_select,
    sweep_preset_select,
):
    _selected_prof = profile_select.value
    _selected_pc = int(player_count_select.value)
    _selected_sweep = sweep_preset_select.value

    _sl_sub = df_comparison.filter(
        (df_comparison["profile"] == _selected_prof)
        & (df_comparison["numPlayers"] == _selected_pc)
        & (df_comparison["engine"] == "sl")
    )
    _sl2_sub = df_comparison.filter(
        (df_comparison["profile"] == _selected_prof)
        & (df_comparison["numPlayers"] == _selected_pc)
        & (df_comparison["engine"] == "sl2")
    )
    _sweep_sub = df_sweeps.filter(
        (df_sweeps["configName"] == _selected_sweep)
        & (df_sweeps["profile"] == _selected_prof)
        & (df_sweeps["numPlayers"] == _selected_pc)
    )

    _sl_row = _sl_sub.to_dicts()[0] if _sl_sub.height > 0 else {}
    _sl2_row = _sl2_sub.to_dicts()[0] if _sl2_sub.height > 0 else {}
    _sweep_row = _sweep_sub.to_dicts()[0] if _sweep_sub.height > 0 else None

    _tier_categories = ["Strong Tier", "Medium Tier", "Weak Tier", "Overall Average"]
    _sl_vals = [
        _sl_row.get("oppDiversityStrong", 0.0),
        _sl_row.get("oppDiversityMedium", 0.0),
        _sl_row.get("oppDiversityWeak", 0.0),
        _sl_row.get("oppDiversityOverall", 0.0),
    ]
    _sl2_vals = [
        _sl2_row.get("oppDiversityStrong", 0.0),
        _sl2_row.get("oppDiversityMedium", 0.0),
        _sl2_row.get("oppDiversityWeak", 0.0),
        _sl2_row.get("oppDiversityOverall", 0.0),
    ]

    _fig = go.Figure()
    _fig.add_trace(
        go.Bar(
            name="Smart (SL)",
            x=_tier_categories,
            y=_sl_vals,
            marker_color=color_sl,
            text=[f"{v:.2f}" for v in _sl_vals],
            textposition="outside",
        )
    )
    _fig.add_trace(
        go.Bar(
            name="Smart2 (SL2)",
            x=_tier_categories,
            y=_sl2_vals,
            marker_color=color_sl2,
            text=[f"{v:.2f}" for v in _sl2_vals],
            textposition="outside",
        )
    )

    if _sweep_row:
        _sw_vals = [
            _sweep_row.get("oppDiversityStrong", 0.0),
            _sweep_row.get("oppDiversityMedium", 0.0),
            _sweep_row.get("oppDiversityWeak", 0.0),
            _sweep_row.get("oppDiversityOverall", 0.0),
        ]
        _fig.add_trace(
            go.Bar(
                name=f"Sweep ({_selected_sweep})",
                x=_tier_categories,
                y=_sw_vals,
                marker_color=color_sweep,
                text=[f"{v:.2f}" for v in _sw_vals],
                textposition="outside",
            )
        )

    _fig.update_layout(
        title=f"Opponent Diversity by Player Skill Tier ({profile_labels.get(_selected_prof, _selected_prof)}, N={_selected_pc})",
        yaxis_title="Unique Opponents Faced (out of N-1)",
        barmode="group",
        height=380,
        margin=dict(l=40, r=40, t=50, b=40),
        legend=dict(orientation="h", yanchor="bottom", y=1.05, xanchor="center", x=0.5),
    )

    return mo.vstack([
        mo.md("### Visual Comparison 2: Opponent Diversity Across Player Tiers"),
        mo.md(
            "In SL, strong and weak players are sequestered into separate tiers, meaning a strong player "
            "only ever encounters **10.5–10.8** unique opponents across 12 rounds. "
            "Smart2's sliding window unlocks opponent diversity across all player levels, expanding strong tier "
            "opponent variety to **12.6–14.0** unique players."
        ),
        mo.ui.plotly(_fig),
    ])


@app.cell(hide_code=True)
def _(
    color_sl,
    color_sl2,
    color_sweep,
    df_comparison,
    df_sweeps,
    go,
    mo,
    player_count_select,
    profile_labels,
    sweep_preset_select,
):
    _selected_pc = int(player_count_select.value)
    _selected_sweep = sweep_preset_select.value

    _comp_pc = df_comparison.filter(df_comparison["numPlayers"] == _selected_pc)
    _profiles_ordered = list(profile_labels.keys())

    _sl_rematches = []
    _sl2_rematches = []
    _labels = []

    for _prof in _profiles_ordered:
        _sl_sub = _comp_pc.filter((_comp_pc["profile"] == _prof) & (_comp_pc["engine"] == "sl"))
        _sl2_sub = _comp_pc.filter((_comp_pc["profile"] == _prof) & (_comp_pc["engine"] == "sl2"))
        if _sl_sub.height > 0 and _sl2_sub.height > 0:
            _labels.append(_prof.replace("_", " ").title())
            _sl_rematches.append(_sl_sub["maxOpponentFacing"][0])
            _sl2_rematches.append(_sl2_sub["maxOpponentFacing"][0])

    _fig = go.Figure()
    _fig.add_trace(
        go.Bar(
            name="Smart (SL)",
            x=_labels,
            y=_sl_rematches,
            marker_color=color_sl,
            text=[f"{v:.2f}" for v in _sl_rematches],
            textposition="outside",
        )
    )
    _fig.add_trace(
        go.Bar(
            name="Smart2 (SL2)",
            x=_labels,
            y=_sl2_rematches,
            marker_color=color_sl2,
            text=[f"{v:.2f}" for v in _sl2_rematches],
            textposition="outside",
        )
    )

    _sweep_sub = df_sweeps.filter(
        (df_sweeps["configName"] == _selected_sweep)
        & (df_sweeps["numPlayers"] == _selected_pc)
    )
    if _sweep_sub.height > 0:
        _sweep_labels = [p.replace("_", " ").title() for p in _sweep_sub["profile"]]
        _fig.add_trace(
            go.Scatter(
                name=f"Sweep ({_selected_sweep})",
                x=_sweep_labels,
                y=_sweep_sub["maxOpponentFacing"].to_list(),
                mode="markers+lines",
                marker=dict(color=color_sweep, size=11, symbol="diamond"),
            )
        )

    _fig.update_layout(
        title=f"Max Opponent Rematch Frequency per Session (Worst-Case Facing Count, N={_selected_pc})",
        yaxis_title="Max Rematches Against Same Opponent",
        barmode="group",
        height=380,
        margin=dict(l=40, r=40, t=50, b=80),
        legend=dict(orientation="h", yanchor="bottom", y=1.05, xanchor="center", x=0.5),
    )
    _fig.update_xaxes(tickangle=-25)

    return mo.vstack([
        mo.md("### Visual Comparison 3: Maximum Opponent Rematch Frequency"),
        mo.md(
            "When players are locked in pods under SL, the worst-case rematch frequency escalates to **7.5–9.3** face-offs "
            "against the exact same rival in a 12-round session. "
            "SL2 caps opponent repeats down to **3.7–5.2**, eliminating repetitive and fatigue-inducing rematches."
        ),
        mo.ui.plotly(_fig),
    ])


@app.cell(hide_code=True)
def _(
    color_sl,
    color_sl2,
    df_comparison,
    go,
    make_subplots,
    mo,
    player_count_select,
    profile_labels,
):
    _selected_pc = int(player_count_select.value)
    _comp_pc = df_comparison.filter(df_comparison["numPlayers"] == _selected_pc)
    _profiles_ordered = list(profile_labels.keys())

    _labels = []
    _sl_mix = []
    _sl2_mix = []
    _sl_spread = []
    _sl2_spread = []

    for _prof in _profiles_ordered:
        _sl_sub = _comp_pc.filter((_comp_pc["profile"] == _prof) & (_comp_pc["engine"] == "sl"))
        _sl2_sub = _comp_pc.filter((_comp_pc["profile"] == _prof) & (_comp_pc["engine"] == "sl2"))
        if _sl_sub.height > 0 and _sl2_sub.height > 0:
            _labels.append(_prof.replace("_", " ").title())
            _sl_mix.append(_sl_sub["mixedDoublesRate"][0])
            _sl2_mix.append(_sl2_sub["mixedDoublesRate"][0])
            _sl_spread.append(_sl_sub["avgCourtSpread"][0])
            _sl2_spread.append(_sl2_sub["avgCourtSpread"][0])

    _fig = make_subplots(
        rows=1,
        cols=2,
        subplot_titles=(
            f"Mixed Doubles Match Rate (%) (N={_selected_pc})",
            f"Average Court Level Spread (Max - Min Level) (N={_selected_pc})",
        ),
    )

    _fig.add_trace(
        go.Bar(
            name="Smart (SL)",
            x=_labels,
            y=_sl_mix,
            marker_color=color_sl,
            text=[f"{v:.1f}%" for v in _sl_mix],
            textposition="outside",
        ),
        row=1,
        col=1,
    )
    _fig.add_trace(
        go.Bar(
            name="Smart2 (SL2)",
            x=_labels,
            y=_sl2_mix,
            marker_color=color_sl2,
            text=[f"{v:.1f}%" for v in _sl2_mix],
            textposition="outside",
        ),
        row=1,
        col=1,
    )

    _fig.add_trace(
        go.Bar(
            name="Smart (SL)",
            x=_labels,
            y=_sl_spread,
            marker_color=color_sl,
            text=[f"{v:.1f}" for v in _sl_spread],
            textposition="outside",
            showlegend=False,
        ),
        row=1,
        col=2,
    )
    _fig.add_trace(
        go.Bar(
            name="Smart2 (SL2)",
            x=_labels,
            y=_sl2_spread,
            marker_color=color_sl2,
            text=[f"{v:.1f}" for v in _sl2_spread],
            textposition="outside",
            showlegend=False,
        ),
        row=1,
        col=2,
    )

    _fig.update_layout(
        barmode="group",
        height=400,
        margin=dict(l=40, r=40, t=50, b=80),
        legend=dict(orientation="h", yanchor="bottom", y=1.05, xanchor="center", x=0.5),
    )
    _fig.update_xaxes(tickangle=-25)
    _fig.update_yaxes(title_text="Mixed Doubles Matches (%)", row=1, col=1)
    _fig.update_yaxes(title_text="Avg Skill Spread per Court", row=1, col=2)

    return mo.vstack([
        mo.md("### Visual Comparison 4: Mixed Doubles Rate vs Court Spread"),
        mo.md(
            "SL2 introduces a dedicated mixed doubles incentive (`mixedDoublesWeight = 200`), boosting the rate "
            "of mixed doubles matches from **22–29%** in SL up to **29–35%** in SL2. "
            "Simultaneously, the sliding window constraint keeps the average court spread comfortably controlled."
        ),
        mo.ui.plotly(_fig),
    ])


@app.cell(hide_code=True)
def _(df_sweeps, go, make_subplots, mo):
    _sweep_df = df_sweeps.filter(df_sweeps["profile"] == "lot_strong_lot_weak")

    _configs = [
        ("Level Weight Sensitivity", ["sl2_low_level", "sl2_baseline", "sl2_high_level"], ["Low (50)", "Baseline (150)", "High (300)"]),
        ("Variety Weight Sensitivity", ["sl2_low_variety", "sl2_baseline", "sl2_high_variety"], ["Low (400)", "Baseline (800)", "High (1200)"]),
        ("Mixed Doubles Weight Sensitivity", ["sl2_low_mixed", "sl2_baseline", "sl2_high_mixed"], ["Low (50)", "Baseline (200)", "High (400)"]),
        ("Win Streak Momentum Sensitivity", ["sl2_low_streak", "sl2_baseline", "sl2_high_streak"], ["Low (100)", "Baseline (300)", "High (500)"]),
    ]

    _fig = make_subplots(
        rows=2,
        cols=2,
        subplot_titles=[c[0] for c in _configs],
        vertical_spacing=0.22,
        horizontal_spacing=0.12,
    )

    _coords = [(1, 1), (1, 2), (2, 1), (2, 2)]

    for _idx, (_title, _cfg_keys, _x_labels) in enumerate(_configs):
        _r, _c = _coords[_idx]
        _pod_vals = []
        _div_vals = []
        _mix_vals = []

        for _key in _cfg_keys:
            _matched = _sweep_df.filter(_sweep_df["configName"] == _key)
            if _matched.height > 0:
                _pod_vals.append(_matched["podLockInCount"][0])
                _div_vals.append(_matched["oppDiversityOverall"][0])
                _mix_vals.append(_matched["mixedDoublesRate"][0])
            else:
                _pod_vals.append(0.0)
                _div_vals.append(0.0)
                _mix_vals.append(0.0)

        _show_leg = _idx == 0
        _fig.add_trace(
            go.Bar(
                name="Pod Lock-In",
                x=_x_labels,
                y=_pod_vals,
                marker_color="#E45756",
                showlegend=_show_leg,
            ),
            row=_r,
            col=_c,
        )
        _fig.add_trace(
            go.Bar(
                name="Opponent Diversity",
                x=_x_labels,
                y=_div_vals,
                marker_color="#4C78A8",
                showlegend=_show_leg,
            ),
            row=_r,
            col=_c,
        )
        _fig.add_trace(
            go.Bar(
                name="Mixed Doubles (%)",
                x=_x_labels,
                y=_mix_vals,
                marker_color="#54A24B",
                showlegend=_show_leg,
            ),
            row=_r,
            col=_c,
        )

    _fig.update_layout(
        barmode="group",
        height=560,
        margin=dict(l=40, r=40, t=60, b=40),
        legend=dict(orientation="h", yanchor="bottom", y=1.04, xanchor="center", x=0.5),
    )

    return mo.vstack([
        mo.md("### Visual Comparison 5: Parameter Sweeps Sensitivity Analysis"),
        mo.md(
            "Exploring the effects of the 4 key weights on the Heavy Disparity profile (`lot_strong_lot_weak`, N=18):\n"
            "- **Level Weight**: Lower weight relaxes level balance and boosts diversity; higher weight suppresses strength differential but increases lock-in risk.\n"
            "- **Variety Weight**: Higher variety weight strongly suppresses repeat pods and pushes opponent diversity to peak levels.\n"
            "- **Mixed Doubles Weight**: Increases mixed doubles frequency up to **36.1%** without penalizing balance.\n"
            "- **Win Streak Momentum**: Modulates dynamic drift; higher momentum ensures players circulate dynamically through win/loss streaks."
        ),
        mo.ui.plotly(_fig),
    ])


@app.cell(hide_code=True)
def _(df_comparison, mo, pl, profile_labels):
    _profiles_ordered = list(profile_labels.keys())
    _player_counts = [16, 18, 20]

    _rows = []
    for _prof in _profiles_ordered:
        for _pc in _player_counts:
            _sl = df_comparison.filter(
                (df_comparison["profile"] == _prof)
                & (df_comparison["numPlayers"] == _pc)
                & (df_comparison["engine"] == "sl")
            )
            _sl2 = df_comparison.filter(
                (df_comparison["profile"] == _prof)
                & (df_comparison["numPlayers"] == _pc)
                & (df_comparison["engine"] == "sl2")
            )
            if _sl.height > 0 and _sl2.height > 0:
                _rows.append({
                    "Profile": profile_labels.get(_prof, _prof),
                    "N": _pc,
                    "SL PodLock": _sl["podLockInCount"][0],
                    "SL2 PodLock": _sl2["podLockInCount"][0],
                    "SL EarlyLk%": f"{_sl['earlyLockInPercentage'][0]:.1f}%",
                    "SL2 EarlyLk%": f"{_sl2['earlyLockInPercentage'][0]:.1f}%",
                    "SL OppDiv": _sl["oppDiversityOverall"][0],
                    "SL2 OppDiv": _sl2["oppDiversityOverall"][0],
                    "SL MaxOpp": _sl["maxOpponentFacing"][0],
                    "SL2 MaxOpp": _sl2["maxOpponentFacing"][0],
                    "SL MixDbl%": f"{_sl['mixedDoublesRate'][0]:.1f}%",
                    "SL2 MixDbl%": f"{_sl2['mixedDoublesRate'][0]:.1f}%",
                    "SL Diff": _sl["avgStrengthDiff"][0],
                    "SL2 Diff": _sl2["avgStrengthDiff"][0],
                })

    _summary_df = pl.DataFrame(_rows)

    return mo.vstack([
        mo.md("### Comprehensive Benchmark Table: Smart (SL) vs Smart2 (SL2)"),
        mo.md(
            "Comparing performance across all 5 disparity profiles and 3 player pool sizes (16, 18, 20). "
            "Across every single profile and player count, SL2 achieves drastically lower pod lock-in and "
            "superior opponent diversity."
        ),
        mo.ui.table(_summary_df),
    ])


@app.cell(hide_code=True)
def _(df_sweeps, mo, pl, profile_labels, sweep_configs_info):
    _rows = []
    for _row in df_sweeps.to_dicts():
        _cfg = _row.get("configName", "")
        _cfg_info = sweep_configs_info.get(_cfg, {})
        _rows.append({
            "Config Name": _cfg,
            "Description": _cfg_info.get("label", _cfg),
            "Profile": profile_labels.get(_row.get("profile", ""), _row.get("profile", "")),
            "N": _row.get("numPlayers", 18),
            "Pod Lock-In": _row.get("podLockInCount", 0.0),
            "Early Lock-In (%)": f"{_row.get('earlyLockInPercentage', 0.0):.1f}%",
            "Opponent Diversity": _row.get("oppDiversityOverall", 0.0),
            "Max Rematches": _row.get("maxOpponentFacing", 0.0),
            "Mixed Doubles (%)": f"{_row.get('mixedDoublesRate', 0.0):.1f}%",
            "Avg Strength Diff": _row.get("avgStrengthDiff", 0.0),
        })

    _sweep_table_df = pl.DataFrame(_rows)

    return mo.vstack([
        mo.md("### SL2 Parameter Sweeps Summary Table"),
        mo.md(
            "Full empirical results across all 9 sweep configurations for N=18 under heavy and moderate disparity profiles:"
        ),
        mo.ui.table(_sweep_table_df),
    ])


if __name__ == "__main__":
    app.run()
