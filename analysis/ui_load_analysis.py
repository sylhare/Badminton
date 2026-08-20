import marimo

__generated_with = "0.19.4"
app = marimo.App(width="medium")


@app.cell
def _():
    import json
    from pathlib import Path

    import marimo as mo
    import polars as pl

    from utils.plotting import setup_matplotlib, fig_to_image
    return Path, fig_to_image, json, mo, pl, setup_matplotlib


@app.cell
def _(setup_matplotlib):
    setup_matplotlib(__file__)
    return


@app.cell
def _():
    import matplotlib.pyplot as plt
    import numpy as np
    return np, plt


@app.cell
def _(Path):
    data_dir = Path(__file__).parent / "data" / "ui"

    ENGINE_COLORS = {"sa": "#4C72B0", "sl": "#DD8452"}
    ENGINE_LABELS = {"sa": "Simulated Annealing", "sl": "Smart Matching"}
    return ENGINE_COLORS, ENGINE_LABELS, data_dir


@app.cell
def _(Path, json, pl):
    def _read_csv(path: Path):
        return pl.read_csv(path) if path.exists() else None

    def load_ui_data(data_dir: Path):
        return {
            "sessions": _read_csv(data_dir / "sessions.csv"),
            "events": _read_csv(data_dir / "generate_events.csv"),
            "resources": _read_csv(data_dir / "resources.csv"),
            "summary": _read_csv(data_dir / "concurrency_summary.csv"),
            "players": _read_csv(data_dir / "player_stats.csv"),
            "matches": _read_csv(data_dir / "match_events.csv"),
            "config": json.loads((data_dir / "config.json").read_text())
            if (data_dir / "config.json").exists()
            else {},
        }

    return (load_ui_data,)


@app.cell
def _(data_dir, load_ui_data):
    ui = load_ui_data(data_dir)
    summary = ui["summary"]
    sessions = ui["sessions"]
    events = ui["events"]
    resources = ui["resources"]
    players = ui["players"]
    matches = ui["matches"]
    cfg = ui["config"]
    return cfg, events, matches, players, resources, sessions, summary


@app.cell(hide_code=True)
def _(cfg, mo, summary):
    if summary is None:
        _md = mo.md(
            """
    # UI Load-Test Analysis

    ⚠️ **No data found.** Run the harness first:

    ```bash
    cd analysis
    npx tsx ./ui_simulation/index.ts
    ```
    """
        )
    else:
        _engines = ", ".join(cfg.get("engines", []))
        _conc = ", ".join(map(str, cfg.get("concurrency", [])))
        _md = mo.md(
            f"""
    # UI Load-Test Analysis

    Every data point here comes from driving the **real app in a browser** (Playwright),
    not from calling the engine directly. Each session seeds players + levels into
    `localStorage`, then generates rounds, records a winner (score modal for Smart
    Matching), and regenerates — exactly as a user would.

    We sweep **concurrency** (how many browser sessions hammer the app at once) to see
    how generate latency, throughput, CPU and RAM scale under load.

    **Configuration**
    - Engines: {_engines}
    - Concurrency levels: {_conc}
    - Sessions per cell: {cfg.get("runs", "?")} × {cfg.get("rounds", "?")} rounds
    - Players: {cfg.get("playerCount", "?")} on {cfg.get("courts", "?")} courts
    """
        )
    _md
    return


@app.cell(hide_code=True)
def _(mo, summary):
    _out = mo.md("") if summary is None else mo.md(
        """
    ## Latency & Throughput vs Concurrency

    As more sessions run simultaneously, does each Generate stay fast, or does the
    single-threaded UI start queueing work?
    """
    )
    _out
    return


@app.cell
def _(ENGINE_COLORS, ENGINE_LABELS, fig_to_image, mo, plt, summary):
    if summary is None:
        _latency_out = mo.md("")
    else:
        _fig, (_ax1, _ax2) = plt.subplots(1, 2, figsize=(14, 5))
        for _eng in summary.get_column("engine").unique().sort().to_list():
            _sub = summary.filter(summary["engine"] == _eng).sort("concurrency")
            _x = _sub.get_column("concurrency").to_list()
            _color = ENGINE_COLORS.get(_eng, "#888")
            _label = ENGINE_LABELS.get(_eng, _eng)
            _ax1.plot(_x, _sub.get_column("p50GenerateMs").to_list(), "-o", color=_color, label=f"{_label} p50")
            _ax1.plot(_x, _sub.get_column("p95GenerateMs").to_list(), "--s", color=_color, alpha=0.6, label=f"{_label} p95")
            _ax2.plot(_x, _sub.get_column("roundsPerSec").to_list(), "-o", color=_color, label=_label)

        _ax1.set_xlabel("Concurrent sessions")
        _ax1.set_ylabel("Generate latency (ms)")
        _ax1.set_title("Generate Latency vs Concurrency\n(lower is better)", fontweight="bold")
        _ax1.legend(fontsize=8)
        _ax1.grid(True, alpha=0.3)

        _ax2.set_xlabel("Concurrent sessions")
        _ax2.set_ylabel("Rounds generated / sec")
        _ax2.set_title("Throughput vs Concurrency\n(higher is better)", fontweight="bold")
        _ax2.legend(fontsize=9)
        _ax2.grid(True, alpha=0.3)

        _fig.tight_layout()
        _latency_out = mo.vstack([
            mo.image(fig_to_image(_fig)),
            mo.md("<center><i>Left: per-Generate latency (p50 solid, p95 dashed). Right: total rounds generated per second across all concurrent sessions.</i></center>"),
        ])
    _latency_out
    return


@app.cell(hide_code=True)
def _(events, mo):
    _out = mo.md("") if events is None else mo.md(
        """
    ## Generate Latency Distribution

    Beyond the median, how does the **spread** of Generate latency widen as concurrency
    grows? Each box is one concurrency level: the box spans the interquartile range, the
    line is the median, and the whiskers/points show the slow tail a user would feel.
    """
    )
    _out
    return


@app.cell
def _(ENGINE_COLORS, ENGINE_LABELS, fig_to_image, mo, plt, events):
    if events is None:
        _dist_out = mo.md("")
    else:
        _engines = events.get_column("engine").unique().sort().to_list()
        _fig, _axes = plt.subplots(1, len(_engines), figsize=(7 * len(_engines), 5), squeeze=False)
        for _col_i, _eng in enumerate(_engines):
            _edf = events.filter(events["engine"] == _eng)
            _levels = _edf.get_column("concurrency").unique().sort().to_list()
            _data = [
                _edf.filter(_edf["concurrency"] == _c).get_column("latencyMs").to_list()
                for _c in _levels
            ]
            _ax = _axes[0][_col_i]
            _bp = _ax.boxplot(_data, tick_labels=[str(c) for c in _levels], patch_artist=True, showmeans=True)
            _color = ENGINE_COLORS.get(_eng, "#888")
            for _patch in _bp["boxes"]:
                _patch.set_facecolor(_color)
                _patch.set_alpha(0.55)
            for _median in _bp["medians"]:
                _median.set_color("black")
            _ax.set_xlabel("Concurrent sessions")
            _ax.set_ylabel("Generate latency (ms)")
            _ax.set_title(f"{ENGINE_LABELS.get(_eng, _eng)} — Latency Distribution", fontweight="bold")
            _ax.grid(True, alpha=0.3, axis="y")
        _fig.tight_layout()
        _dist_out = mo.vstack([
            mo.image(fig_to_image(_fig)),
            mo.md("<center><i>Box = interquartile range, line = median, triangle = mean, points = outliers. A box that stays low and tight means the UI keeps every Generate fast even under load; a growing tail signals queueing.</i></center>"),
        ])
    _dist_out
    return


@app.cell(hide_code=True)
def _(mo, resources):
    _out = mo.md("") if resources is None else mo.md(
        """
    ## CPU & RAM Over Time

    Resource usage of the whole browser process subtree, sampled while each
    concurrency level runs. Higher concurrency should raise the ceiling.
    """
    )
    _out
    return


@app.cell
def _(fig_to_image, mo, plt, resources):
    if resources is None:
        _res_out = mo.md("")
    else:
        _engines = resources.get_column("engine").unique().sort().to_list()
        _fig, _axes = plt.subplots(len(_engines), 2, figsize=(14, 4.5 * len(_engines)), squeeze=False)
        import matplotlib.cm as _cm
        for _row, _eng in enumerate(_engines):
            _edf = resources.filter(resources["engine"] == _eng)
            _levels = _edf.get_column("concurrency").unique().sort().to_list()
            _colors = _cm.viridis([i / max(1, len(_levels) - 1) for i in range(len(_levels))])
            for _c, _col in zip(_levels, _colors):
                _cd = _edf.filter(_edf["concurrency"] == _c).sort("tMs")
                _t = [v / 1000 for v in _cd.get_column("tMs").to_list()]
                _axes[_row][0].plot(_t, _cd.get_column("cpuPct").to_list(), color=_col, label=f"c={_c}")
                _axes[_row][1].plot(_t, _cd.get_column("rssMB").to_list(), color=_col, label=f"c={_c}")
            _axes[_row][0].set_title(f"{_eng.upper()} — CPU%", fontweight="bold")
            _axes[_row][0].set_xlabel("Time (s)")
            _axes[_row][0].set_ylabel("CPU % (subtree)")
            _axes[_row][0].legend(fontsize=8)
            _axes[_row][0].grid(True, alpha=0.3)
            _axes[_row][1].set_title(f"{_eng.upper()} — RSS (MB)", fontweight="bold")
            _axes[_row][1].set_xlabel("Time (s)")
            _axes[_row][1].set_ylabel("Resident memory (MB)")
            _axes[_row][1].legend(fontsize=8)
            _axes[_row][1].grid(True, alpha=0.3)
        _fig.tight_layout()
        _res_out = mo.vstack([
            mo.image(fig_to_image(_fig)),
            mo.md("<center><i>CPU% can exceed 100% (multiple cores/processes). Each line is one concurrency level; the run time shrinks as concurrency rises even as peak usage grows.</i></center>"),
        ])
    _res_out
    return


@app.cell
def _(ENGINE_COLORS, ENGINE_LABELS, fig_to_image, mo, np, plt, summary):
    if summary is None:
        _peak_out = mo.md("")
    else:
        _engines = summary.get_column("engine").unique().sort().to_list()
        _levels = summary.get_column("concurrency").unique().sort().to_list()
        _fig, (_ax1, _ax2) = plt.subplots(1, 2, figsize=(14, 5))
        _x = np.arange(len(_levels))
        _w = 0.8 / max(1, len(_engines))
        for _i, _eng in enumerate(_engines):
            _sub = summary.filter(summary["engine"] == _eng).sort("concurrency")
            _color = ENGINE_COLORS.get(_eng, "#888")
            _off = (_i - (len(_engines) - 1) / 2) * _w
            _ax1.bar(_x + _off, _sub.get_column("peakCpuPct").to_list(), _w, color=_color, label=ENGINE_LABELS.get(_eng, _eng))
            _ax2.bar(_x + _off, _sub.get_column("peakRssMB").to_list(), _w, color=_color, label=ENGINE_LABELS.get(_eng, _eng))
        for _ax, _title, _yl in ((_ax1, "Peak CPU% vs Concurrency", "Peak CPU %"), (_ax2, "Peak RSS vs Concurrency", "Peak RSS (MB)")):
            _ax.set_xticks(_x)
            _ax.set_xticklabels([str(c) for c in _levels])
            _ax.set_xlabel("Concurrent sessions")
            _ax.set_ylabel(_yl)
            _ax.set_title(_title, fontweight="bold")
            _ax.legend(fontsize=9)
            _ax.grid(True, alpha=0.3, axis="y")
        _fig.tight_layout()
        _peak_out = mo.vstack([
            mo.image(fig_to_image(_fig)),
            mo.md("<center><i>Peak CPU and memory reached at each concurrency level, per engine.</i></center>"),
        ])
    _peak_out
    return


@app.cell(hide_code=True)
def _(mo, sessions):
    _out = mo.md("") if sessions is None else mo.md(
        """
    ## Assignment Quality (from saved state)

    Extracted from the engine state the app persisted to `localStorage` after each
    session — teammate repeats, bench fairness, and win spread, averaged per engine.
    """
    )
    _out
    return


@app.cell
def _(ENGINE_LABELS, mo, pl, sessions):
    if sessions is None:
        _table_out = mo.md("")
    else:
        _agg = (
            sessions.group_by("engine")
            .agg([
                pl.len().alias("sessions"),
                pl.col("roundsPlayed").mean().round(1).alias("avg_rounds_played"),
                pl.col("repeatTeammatePairs").mean().round(2).alias("avg_repeat_pairs"),
                pl.col("benchRange").mean().round(2).alias("avg_bench_range"),
                pl.col("winSpread").mean().round(2).alias("avg_win_spread"),
                pl.col("avgGenerateMs").mean().round(1).alias("avg_generate_ms"),
            ])
            .sort("engine")
        )
        _rows = _agg.to_dicts()
        _display = pl.DataFrame({
            "Engine": [ENGINE_LABELS.get(r["engine"], r["engine"]) for r in _rows],
            "Sessions": [r["sessions"] for r in _rows],
            "Avg Rounds": [r["avg_rounds_played"] for r in _rows],
            "Repeat Pairs": [r["avg_repeat_pairs"] for r in _rows],
            "Bench Range": [r["avg_bench_range"] for r in _rows],
            "Win Spread": [r["avg_win_spread"] for r in _rows],
            "Gen ms": [r["avg_generate_ms"] for r in _rows],
        })
        _table_out = mo.vstack([
            mo.ui.table(_display),
            mo.md("*Repeat Pairs: distinct teammate pairs formed more than once. Bench Range / Win Spread: max−min across players (lower = fairer).*"),
        ])
    _table_out
    return


@app.cell(hide_code=True)
def _(matches, mo):
    _out = mo.md("") if matches is None else mo.md(
        """
    ---

    ## Game Stats from UI Play

    Every court now gets a realistic, strength-based outcome each round (not just court 1),
    so the saved per-player tallies carry signal. Does skill predict wins, and how balanced
    are the matchups the engine actually builds?
    """
    )
    _out
    return


@app.cell
def _(ENGINE_COLORS, ENGINE_LABELS, fig_to_image, mo, pl, players, plt):
    if players is None:
        _wl_out = mo.md("")
    else:
        _agg = (
            players.filter(players["games"] > 0)
            .group_by(["engine", "level"])
            .agg([
                (pl.col("win").sum() / pl.col("games").sum() * 100).alias("win_rate"),
                pl.col("games").sum().alias("games"),
            ])
            .sort(["engine", "level"])
        )
        _fig, _ax = plt.subplots(figsize=(9, 5))
        for _e in _agg.get_column("engine").unique().sort().to_list():
            _s = _agg.filter(_agg["engine"] == _e)
            _ax.plot(_s.get_column("level").to_list(), _s.get_column("win_rate").to_list(),
                     "-o", color=ENGINE_COLORS.get(_e, "#888"), label=ENGINE_LABELS.get(_e, _e))
        _ax.axhline(50, color="gray", ls="--", lw=1, alpha=0.7)
        _ax.set_xlabel("Player skill level")
        _ax.set_ylabel("Win rate (%)")
        _ax.set_title("Win Rate vs Skill Level", fontweight="bold")
        _ax.legend()
        _ax.grid(True, alpha=0.3)
        _fig.tight_layout()
        _wl_out = mo.vstack([
            mo.image(fig_to_image(_fig)),
            mo.md("<center><i>Each point: average win rate of players at that level, across all sessions. Dashed line = 50% (parity). A rising line means stronger players still win more even after the engine balances teams — expected, since balancing equalises <b>teams</b>, not individuals.</i></center>"),
        ])
    _wl_out
    return


@app.cell
def _(matches, pl):
    if matches is None:
        match_balance = None
        balance_rates = {}
    else:
        match_balance = matches.with_columns([
            (pl.col("strengthDiff") == 0).cast(pl.Int8).alias("_perf"),
            pl.col("strongerTeamWon").cast(pl.Utf8).str.to_lowercase().is_in(["true", "1"]).cast(pl.Int8).alias("_strong"),
        ])
        balance_rates = {
            r["engine"]: r
            for r in match_balance.group_by("engine").agg([
                (pl.col("_perf").mean() * 100).alias("perf"),
                (pl.col("_strong").mean() * 100).alias("strong"),
            ]).to_dicts()
        }
    return balance_rates, match_balance


@app.cell
def _(ENGINE_COLORS, ENGINE_LABELS, balance_rates, fig_to_image, match_balance, mo, np, plt):
    if match_balance is None:
        _mb_out = mo.md("")
    else:
        _engines = match_balance.get_column("engine").unique().sort().to_list()

        _fig, (_ax1, _ax2) = plt.subplots(1, 2, figsize=(14, 5))
        for _e in _engines:
            _d = match_balance.filter(match_balance["engine"] == _e).get_column("strengthDiff").to_list()
            _bins = range(0, int(max(_d)) + 20, 20) if _d else range(0, 20, 20)
            _ax1.hist(_d, bins=_bins, alpha=0.5, label=ENGINE_LABELS.get(_e, _e), color=ENGINE_COLORS.get(_e, "#888"))
        _ax1.set_xlabel("Team strength differential (summed levels)")
        _ax1.set_ylabel("Matches")
        _ax1.set_title("Matchup Balance\n(concentrated near 0 = fairer)", fontweight="bold")
        _ax1.legend()
        _ax1.grid(True, alpha=0.3, axis="y")

        _x = np.arange(len(_engines))
        _w = 0.35
        _ax2.bar(_x - _w / 2, [balance_rates[e]["perf"] for e in _engines], _w, label="Perfectly balanced (%)", color="#55A868")
        _ax2.bar(_x + _w / 2, [balance_rates[e]["strong"] for e in _engines], _w, label="Stronger team won (%)", color="#C44E52")
        _ax2.set_xticks(_x)
        _ax2.set_xticklabels([ENGINE_LABELS.get(e, e) for e in _engines])
        _ax2.set_ylim(0, 108)
        _ax2.axhline(50, color="gray", ls="--", lw=1, alpha=0.7)
        _ax2.set_title("Balance & Outcome Rates", fontweight="bold")
        _ax2.legend(fontsize=9)
        _ax2.grid(True, alpha=0.3, axis="y")
        _fig.tight_layout()
        _mb_out = mo.vstack([
            mo.image(fig_to_image(_fig)),
            mo.md("<center><i>Left: how equal the two teams' summed skill is in each match the engine created. Right: share of exactly-equal matchups, and how often the stronger side won (dashed 50% = a coin flip). High balance with stronger-team-wins near 50% means the matcher is levelling the field.</i></center>"),
        ])
    _mb_out
    return


@app.cell(hide_code=True)
def _(mo, summary):
    _out = mo.md("") if summary is None else mo.md(
        """
    ---

    ## Engine vs UI

    To make this a fair comparison, the engine side uses a **matched baseline**
    (`npx tsx ./ui_simulation/engine_baseline.ts`): the same engines the app ships,
    with the **same defaults, the same 16 players / 4 courts / 10 rounds**, and the
    **same teammate-repeat metric** as the UI — just called directly in Node with no
    browser. Any gap is therefore a browser/UI effect, not a config or player-mix
    difference.

    > This replaces the earlier mismatch: the `sa_algo`/`sl_algo` batch ran 15–18
    > players *with benching*, which made repeats trivially avoidable (100% zero-repeat)
    > and was not comparable to the UI's tighter 16/4 setup. UI repeat counts here come
    > from the rounds actually observed in the DOM (exactly 10), and UI latency is taken
    > at **concurrency 1** (no contention) to match the baseline's single-threaded loop.
    """
    )
    _out
    return


@app.cell
def _(data_dir, json):
    _baseline_path = data_dir / "engine_baseline.json"
    _baseline = json.loads(_baseline_path.read_text()) if _baseline_path.exists() else {}

    engine_cfgs = {}
    for _e in ("sa", "sl"):
        _b = _baseline.get(_e)
        if _b is not None:
            engine_cfgs[_e] = {
                "time_per_round": _b.get("timePerRoundMs", 0),
                "zero_repeat_pct": _b.get("zeroRepeatPct", 0),
                "avg_repeat_pairs": _b.get("avgRepeatPairs", 0),
                "perfect_balanced_pct": _b.get("perfectBalancedPct", 0),
                "stronger_win_pct": _b.get("strongerWinPct", 0),
            }
    return (engine_cfgs,)


@app.cell
def _(ENGINE_LABELS, engine_cfgs, fig_to_image, mo, np, plt, sessions, summary):
    if summary is None or sessions is None or not engine_cfgs:
        _cmp_out = mo.md("*(Run the engine simulation too — `npx tsx ./simulation/index.ts` — to populate this comparison.)*")
    else:
        _engines = [e for e in ["sa", "sl"] if e in engine_cfgs]

        def _ui_p50(e):
            _r = summary.filter((summary["engine"] == e) & (summary["concurrency"] == 1))
            return _r.get_column("p50GenerateMs")[0] if _r.height else float("nan")

        def _ui_zero(e):
            _s = sessions.filter(sessions["engine"] == e)
            return 100.0 * _s.filter(_s["repeatTeammatePairs"] == 0).height / _s.height if _s.height else 0.0

        _labels = [ENGINE_LABELS.get(e, e) for e in _engines]
        _x = np.arange(len(_engines))
        _w = 0.38

        _fig, (_ax1, _ax2) = plt.subplots(1, 2, figsize=(14, 5))

        _eng_speed = [engine_cfgs[e]["time_per_round"] for e in _engines]
        _ui_speed = [_ui_p50(e) for e in _engines]
        _b1 = _ax1.bar(_x - _w / 2, _eng_speed, _w, label="Engine (Node compute)", color="#55A868")
        _b2 = _ax1.bar(_x + _w / 2, _ui_speed, _w, label="UI (Generate p50 @ c=1)", color="#C44E52")
        _ax1.set_yscale("log")
        _ax1.set_xticks(_x)
        _ax1.set_xticklabels(_labels)
        _ax1.set_ylabel("ms per round (log scale)")
        _ax1.set_title("Speed: Engine compute vs UI Generate", fontweight="bold")
        _ax1.legend(fontsize=9)
        _ax1.grid(True, alpha=0.3, axis="y")
        for _b in list(_b1) + list(_b2):
            _h = _b.get_height()
            _ax1.text(_b.get_x() + _b.get_width() / 2, _h * 1.05, f"{_h:.1f}", ha="center", va="bottom", fontsize=9, fontweight="bold")

        _eng_zero = [engine_cfgs[e]["zero_repeat_pct"] for e in _engines]
        _ui_zero_v = [_ui_zero(e) for e in _engines]
        _ax2.bar(_x - _w / 2, _eng_zero, _w, label="Engine (matched)", color="#55A868")
        _ax2.bar(_x + _w / 2, _ui_zero_v, _w, label="UI observed", color="#C44E52")
        _ax2.set_xticks(_x)
        _ax2.set_xticklabels(_labels)
        _ax2.set_ylabel("Zero-repeat sessions (%)")
        _ax2.set_ylim(0, 108)
        _ax2.set_title("Quality: Zero teammate-repeat rate", fontweight="bold")
        _ax2.legend(fontsize=9)
        _ax2.grid(True, alpha=0.3, axis="y")
        for _i, (_ev, _uv) in enumerate(zip(_eng_zero, _ui_zero_v)):
            _ax2.text(_i - _w / 2, _ev + 1, f"{_ev:.0f}%", ha="center", va="bottom", fontsize=9, fontweight="bold")
            _ax2.text(_i + _w / 2, _uv + 1, f"{_uv:.0f}%", ha="center", va="bottom", fontsize=9, fontweight="bold")

        _fig.tight_layout()

        _overhead = ", ".join(
            f"{ENGINE_LABELS.get(e, e)} ≈{(_ui_p50(e) / engine_cfgs[e]['time_per_round']):.0f}×"
            for e in _engines if engine_cfgs[e]["time_per_round"] > 0
        )
        _cmp_out = mo.vstack([
            mo.image(fig_to_image(_fig)),
            mo.md(f"<center><i>Left (log scale): pure engine compute per round vs the full UI Generate (click → assign → render). Right: teammate zero-repeat rate — with matched params these should line up, confirming the UI reproduces the engine's avoidance (not the old 100% artifact). UI-over-engine latency overhead: {_overhead}.</i></center>"),
        ])
    _cmp_out
    return


@app.cell
def _(ENGINE_LABELS, balance_rates, engine_cfgs, fig_to_image, match_balance, mo, np, plt):
    if match_balance is None or not engine_cfgs:
        _bal_out = mo.md("")
    else:
        _engines = [e for e in ["sa", "sl"] if e in engine_cfgs and e in balance_rates]

        _fig, (_ax1, _ax2) = plt.subplots(1, 2, figsize=(14, 5))
        _x = np.arange(len(_engines))
        _w = 0.38
        _labels = [ENGINE_LABELS.get(e, e) for e in _engines]

        _ax1.bar(_x - _w / 2, [engine_cfgs[e]["perfect_balanced_pct"] for e in _engines], _w, label="Engine (matched)", color="#55A868")
        _ax1.bar(_x + _w / 2, [balance_rates[e]["perf"] for e in _engines], _w, label="UI observed", color="#C44E52")
        _ax1.set_xticks(_x)
        _ax1.set_xticklabels(_labels)
        _ax1.set_ylim(0, 108)
        _ax1.set_ylabel("Perfectly balanced matches (%)")
        _ax1.set_title("Team Balance: Engine vs UI", fontweight="bold")
        _ax1.legend(fontsize=9)
        _ax1.grid(True, alpha=0.3, axis="y")

        _ax2.bar(_x - _w / 2, [engine_cfgs[e]["stronger_win_pct"] for e in _engines], _w, label="Engine (matched)", color="#55A868")
        _ax2.bar(_x + _w / 2, [balance_rates[e]["strong"] for e in _engines], _w, label="UI observed", color="#C44E52")
        _ax2.axhline(50, color="gray", ls="--", lw=1, alpha=0.7)
        _ax2.set_xticks(_x)
        _ax2.set_xticklabels(_labels)
        _ax2.set_ylim(0, 108)
        _ax2.set_ylabel("Stronger team won (%)")
        _ax2.set_title("Outcome Skew: Engine vs UI", fontweight="bold")
        _ax2.legend(fontsize=9)
        _ax2.grid(True, alpha=0.3, axis="y")
        _fig.tight_layout()
        _bal_out = mo.vstack([
            mo.image(fig_to_image(_fig)),
            mo.md("<center><i>Both paths use the same engine defaults and the same logistic outcome model on summed team levels, so balance (left) and stronger-team-win rate (right) line up — confirming the UI reproduces the engine's match quality, not just its speed. Remaining gaps are run-to-run noise (baseline: 100 runs; UI: fewer, longer sessions).</i></center>"),
        ])
    _bal_out
    return


if __name__ == "__main__":
    app.run()
