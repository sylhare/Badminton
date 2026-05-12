import marimo

__generated_with = "0.19.5"
app = marimo.App(width="medium")


@app.cell
def _():
    import math

    import importlib.util
    import sys
    from pathlib import Path

    import marimo as mo

    _utils_path = Path(__file__).parent / "utils" / "plotting.py"
    _spec = importlib.util.spec_from_file_location("_plotting", _utils_path)
    _mod = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_mod)
    setup_matplotlib = _mod.setup_matplotlib
    fig_to_image = _mod.fig_to_image

    setup_matplotlib(__file__)
    return fig_to_image, math, mo


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    # Tournament Bracket Analysis

    Mapping out **single-elimination with consolation bracket** for `n` players.

    **Glossary:**
    - **WB** = Winner Bracket (the main single-elimination bracket)
    - **CB** = Consolation Bracket (second-chance bracket for first-round losers)
    - **Semi-final** = the round just before the final
    - **Bye** = when a player has no opponent in a round and advances automatically

    **Assumptions for this analysis:**
    - Winner bracket (WB): standard single-elimination, bracket size = next power of 2
    - Consolation bracket (CB): first-round losers get a second chance
    - Team1 (higher seed / left side) **always wins** for deterministic tracing
    
    **Goal**: identify who should be **1st, 2nd, 3rd** for every player count and find the general pattern

    ## What is a Round?

    A **round** is a stage of the tournament where all scheduled matches play simultaneously
    (or in sequence on available courts). Once every match in a round is complete, the next round begins.

    Throughout this analysis, rounds are referred to as **R1**, **R2**, **R3**, etc.

    The WB defines the round structure for the entire tournament. The CB can only start after R1
    (it needs the first-round losers as seeds), so CB matches begin at **R2**. In all diagrams below,
    CB rounds are labeled to match tournament rounds (R2, R3, ...). Any 3rd-place matches
    must also fit within this round structure.
    """)
    return


@app.cell
def _(fig_to_image, mo, plt):
    _fig, _ax = plt.subplots(figsize=(10, 3))
    _fig.suptitle("Example: n=4 players (bracket=4, 2 rounds)", fontsize=13, fontstyle="italic")

    _box_w = 1.8
    _box_h = 0.6
    _row_wb = 2.0
    _row_cb = 1.0

    for _rr, _label in [(1, "R1 (Semi-final)"), (2, "R2 (Final)")]:
        _x = _rr * 2.5
        _ax.text(_x, 2.8, _label, ha="center", va="center", fontsize=10, fontweight="bold")

    _ax.add_patch(plt.Rectangle((2.5 - _box_w / 2, _row_wb - _box_h / 2), _box_w, _box_h,
        facecolor="#c8e6c9", edgecolor="#2e7d32", linewidth=1.5, zorder=2))
    _ax.text(2.5, _row_wb, "WB: 2 matches", ha="center", va="center", fontsize=9, zorder=3)

    _ax.add_patch(plt.Rectangle((5.0 - _box_w / 2, _row_wb - _box_h / 2), _box_w, _box_h,
        facecolor="#c8e6c9", edgecolor="#2e7d32", linewidth=1.5, zorder=2))
    _ax.text(5.0, _row_wb, "WB: 1 match", ha="center", va="center", fontsize=9, zorder=3)

    _ax.add_patch(plt.Rectangle((5.0 - _box_w / 2, _row_cb - _box_h / 2), _box_w, _box_h,
        facecolor="#bbdefb", edgecolor="#1565c0", linewidth=1.5, zorder=2))
    _ax.text(5.0, _row_cb, "CB: 1 match", ha="center", va="center", fontsize=9, zorder=3)

    _ax.set_xlim(1, 7)
    _ax.set_ylim(0.2, 3.3)
    _ax.set_yticks([_row_cb, _row_wb])
    _ax.set_yticklabels(["Consolation", "Winners"], fontsize=10)
    _ax.set_xticks([])
    _ax.spines["top"].set_visible(False)
    _ax.spines["right"].set_visible(False)
    _ax.spines["bottom"].set_visible(False)
    plt.tight_layout()
    mo.image(fig_to_image(_fig))
    return


@app.cell
def _(math):
    def next_power_of_2(n):
        p = 1
        while p < n:
            p *= 2
        return p

    def simulate_tournament(n):
        """Simulate a tournament with n players, team1 (lower seed) always wins."""
        bracket_size = next_power_of_2(n)
        total_rounds = int(math.log2(bracket_size))
        seeds = list(range(1, n + 1))

        wb_matches = []
        r1_losers = []
        positions = {1: [None] * (bracket_size // 2)}

        for pos in range(bracket_size // 2):
            s1 = seeds[2 * pos] if 2 * pos < n else None
            s2 = seeds[2 * pos + 1] if 2 * pos + 1 < n else None
            if s1 and s2:
                wb_matches.append((1, s1, s2))
                r1_losers.append(s2)
                positions[1][pos] = s1
            elif s1:
                positions[1][pos] = s1

        wb_sf_losers = []
        for r in range(2, total_rounds + 1):
            n_pos = bracket_size // (2 ** r)
            positions[r] = [None] * n_pos
            for pos in range(n_pos):
                a = positions[r - 1][2 * pos]
                b = positions[r - 1][2 * pos + 1]
                if a is not None and b is not None:
                    wb_matches.append((r, a, b))
                    positions[r][pos] = a
                    if r == total_rounds - 1:
                        wb_sf_losers.append(b)
                elif a is not None:
                    positions[r][pos] = a
                elif b is not None:
                    positions[r][pos] = b

        wb_final_match = [m for m in wb_matches if m[0] == total_rounds]
        wb_final_loser = wb_final_match[0][2] if wb_final_match else None
        wb_final_winner = positions[total_rounds][0]

        cb_matches = []
        cb_seeds = r1_losers[:]
        if len(cb_seeds) >= 2:
            cb_r1_paired = set()
            cb_r1_winners = []
            for i in range(len(cb_seeds) // 2):
                cb_matches.append((1, cb_seeds[2 * i], cb_seeds[2 * i + 1]))
                cb_r1_winners.append(cb_seeds[2 * i])
                cb_r1_paired.update([cb_seeds[2 * i], cb_seeds[2 * i + 1]])
            cb_unpaired = [s for s in cb_seeds if s not in cb_r1_paired]
            advancers = cb_r1_winners + cb_unpaired
            cb_round = 2
            while len(advancers) >= 2:
                rm = []
                for i in range(len(advancers) // 2):
                    rm.append((cb_round, advancers[2 * i], advancers[2 * i + 1]))
                cb_matches.extend(rm)
                advancers = [m[1] for m in rm]
                cb_round += 1

        cb_final = (
            [m for m in cb_matches if m[0] == max(m2[0] for m2 in cb_matches)]
            if cb_matches
            else []
        )
        cb_final_winner = cb_final[0][1] if cb_final else None

        return {
            "n": n,
            "bracket_size": bracket_size,
            "wb_rounds": total_rounds,
            "wb_matches": wb_matches,
            "cb_matches": cb_matches,
            "wb_final_winner": wb_final_winner,
            "wb_final_loser": wb_final_loser,
            "cb_final_winner": cb_final_winner,
            "wb_sf_losers": wb_sf_losers,
            "r1_losers": r1_losers,
            "positions": positions,
        }

    _r = simulate_tournament(6)
    print(f"n=6: WB final: S{_r['wb_final_winner']} > S{_r['wb_final_loser']}")
    print(f"     CB final winner: S{_r['cb_final_winner']}")
    print(f"     WB semi-final losers: {['S'+str(s) for s in _r['wb_sf_losers']]}")
    print(f"     WB matches: {[f'R{m[0]}: S{m[1]}>S{m[2]}' for m in _r['wb_matches']]}")
    print(f"     CB matches: {[f'R{m[0]}: S{m[1]}>S{m[2]}' for m in _r['cb_matches']]}")
    return next_power_of_2, simulate_tournament



@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## Tournament Configuration (4-8 players)
    """)
    return

@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ### Unfolding per configuration
    Each diagram shows the *Winner Bracket* (left) and *Consolation Bracket* (right).
    Team1 (lower seed) always wins. Byes shown as `bye`.

    Based on those special cases, we want to be able to determine who should be third.
    """)
    return


@app.cell
def _(fig_to_image, next_power_of_2, simulate_tournament):
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches

    def draw_bracket(n):
        """Draw winner + consolation bracket for n players, return PNG bytes."""
        _r = simulate_tournament(n)
        _bracket_size = _r["bracket_size"]
        _total_rounds = _r["wb_rounds"]
        _positions = _r["positions"]
        _cb_matches = _r["cb_matches"]
        _wb_sf_losers = _r["wb_sf_losers"]
        _seeds = list(range(1, n + 1))
        _cb_seeds = _r["r1_losers"]

        _sf_count = len(_wb_sf_losers)
        if _bracket_size == 4:
            _case = "Round 1 = Semi-final"
        elif _sf_count == 1 and len(_r["r1_losers"]) == 2:
            _case = "1 semi-final loser, consolation bracket with bye on round 1"
        elif _sf_count == 1:
            _case = "1 semi-final loser, consolation bracket with bye"
        elif _sf_count == 2:
            _case = "2 semi-final losers"
        else:
            _case = "Trivial"

        fig, axes = plt.subplots(
            1, 2,
            figsize=(14, max(3, _bracket_size * 0.6)),
            gridspec_kw={"width_ratios": [3, 2]},
        )
        fig.suptitle(f"n = {n}, (bracket = {_bracket_size}) {_case}", fontsize=14, fontstyle="italic")

        _box_w = 0.7
        _box_h = 0.35

        def _draw_match_box(ax, x, y, s1, s2, is_bye=False):
            color = "#e8f5e9" if not is_bye else "#fff3e0"
            box = mpatches.FancyBboxPatch(
                (x - _box_w / 2, y - _box_h), _box_w, _box_h * 2,
                boxstyle="round,pad=0.05", facecolor=color, edgecolor="#333",
            )
            ax.add_patch(box)
            if is_bye:
                ax.text(x, y, f"S{s1} bye", ha="center", va="center", fontsize=9, style="italic")
            else:
                ax.text(x, y - _box_h / 2, f"S{s1} W", ha="center", va="center", fontsize=9, fontweight="bold", color="#2e7d32")
                ax.text(x, y + _box_h / 2, f"S{s2} L", ha="center", va="center", fontsize=9, color="#c62828")

        ax = axes[0]
        ax.set_title("Winner Bracket (WB)", fontsize=12)
        ax.set_xlim(-0.5, _total_rounds + 0.5)
        ax.set_ylim(-0.5, _bracket_size // 2 + 0.5)
        ax.set_xticks(range(1, _total_rounds + 1))
        ax.set_xticklabels([f"R{rr}" for rr in range(1, _total_rounds + 1)])
        ax.set_yticks([])
        ax.invert_yaxis()

        _wb_pos = {}
        for rr in range(1, _total_rounds + 1):
            _n_slots = _bracket_size // (2 ** rr)
            _spacing = (_bracket_size // 2) / _n_slots
            for pos in range(_n_slots):
                y = _spacing * (pos + 0.5)
                if rr == 1:
                    s1 = _seeds[2 * pos] if 2 * pos < n else None
                    s2 = _seeds[2 * pos + 1] if 2 * pos + 1 < n else None
                    if s1 and s2:
                        _draw_match_box(ax, rr, y, s1, s2)
                        _wb_pos[(rr, pos)] = (rr, y)
                    elif s1:
                        _draw_match_box(ax, rr, y, s1, None, is_bye=True)
                        _wb_pos[(rr, pos)] = (rr, y)
                else:
                    _a = _positions[rr - 1][2 * pos] if 2 * pos < len(_positions[rr - 1]) else None
                    _b = _positions[rr - 1][2 * pos + 1] if 2 * pos + 1 < len(_positions[rr - 1]) else None
                    if _a is not None and _b is not None:
                        _draw_match_box(ax, rr, y, _a, _b)
                        _wb_pos[(rr, pos)] = (rr, y)
                    elif _a is not None:
                        _draw_match_box(ax, rr, y, _a, None, is_bye=True)
                        _wb_pos[(rr, pos)] = (rr, y)
                    elif _b is not None:
                        _draw_match_box(ax, rr, y, _b, None, is_bye=True)
                        _wb_pos[(rr, pos)] = (rr, y)

        for rr in range(2, _total_rounds + 1):
            _n_slots = _bracket_size // (2 ** rr)
            for pos in range(_n_slots):
                _target = _wb_pos.get((rr, pos))
                for _sk in [(rr - 1, 2 * pos), (rr - 1, 2 * pos + 1)]:
                    _src = _wb_pos.get(_sk)
                    if _target and _src:
                        ax.plot([_src[0] + _box_w / 2, _target[0] - _box_w / 2], [_src[1], _target[1]], color="#666", linewidth=1, zorder=0)
        ax.set_aspect("auto")

        ax2 = axes[1]
        ax2.set_title("Consolation Bracket (CB)", fontsize=12)
        if not _cb_matches:
            ax2.text(0.5, 0.5, "No consolation\n(< 2 first-round losers)", ha="center", va="center", transform=ax2.transAxes, fontsize=11, color="#999")
            ax2.set_xticks([])
            ax2.set_yticks([])
        else:
            _max_cb_round = max(m[0] for m in _cb_matches)
            _cb_bs = next_power_of_2(len(_cb_seeds))
            ax2.set_xlim(0.5, _max_cb_round + 1 + 0.5)
            ax2.set_ylim(-0.5, max(_cb_bs // 2, 1) + 0.5)
            ax2.set_xticks(range(2, _max_cb_round + 2))
            ax2.set_xticklabels([f"R{rr}" for rr in range(2, _max_cb_round + 2)])
            ax2.set_yticks([])
            ax2.invert_yaxis()

            _cb_r1_paired = set()
            for m in _cb_matches:
                if m[0] == 1:
                    _cb_r1_paired.update([m[1], m[2]])
            _cb_byes = [s for s in _cb_seeds if s not in _cb_r1_paired]
            _cb_r1_total = len([m for m in _cb_matches if m[0] == 1]) + len(_cb_byes)

            _cb_pos = {}
            for rr in range(1, _max_cb_round + 1):
                _rm = [m for m in _cb_matches if m[0] == rr]
                _x = rr + 1
                if rr == 1:
                    _sp = max(_cb_bs // 2, 1) / max(_cb_r1_total, 1)
                    _slot = 0
                    for idx, (_, t1, t2) in enumerate(_rm):
                        y = _sp * (_slot + 0.5)
                        _draw_match_box(ax2, _x, y, t1, t2)
                        _cb_pos[(rr, _slot)] = (_x, y)
                        _slot += 1
                    for _bye_s in _cb_byes:
                        y = _sp * (_slot + 0.5)
                        _draw_match_box(ax2, _x, y, _bye_s, None, is_bye=True)
                        _cb_pos[(rr, _slot)] = (_x, y)
                        _slot += 1
                else:
                    _sp = max(_cb_bs // 2, 1) / max(len(_rm), 1)
                    for idx, (_, t1, t2) in enumerate(_rm):
                        y = _sp * (idx + 0.5)
                        _draw_match_box(ax2, _x, y, t1, t2)
                        _cb_pos[(rr, idx)] = (_x, y)

            for rr in range(2, _max_cb_round + 1):
                _rm = [m for m in _cb_matches if m[0] == rr]
                for idx in range(len(_rm)):
                    _target = _cb_pos.get((rr, idx))
                    _prev_total = _cb_r1_total if rr == 2 else len([m for m in _cb_matches if m[0] == rr - 1])
                    for _sk in [(rr - 1, 2 * idx), (rr - 1, 2 * idx + 1)]:
                        if _sk[1] < _prev_total:
                            _src = _cb_pos.get(_sk)
                            if _target and _src:
                                ax2.plot([_src[0] + _box_w / 2, _target[0] - _box_w / 2], [_src[1], _target[1]], color="#666", linewidth=1, zorder=0)
            ax2.set_aspect("auto")

        plt.tight_layout()
        plt.subplots_adjust(bottom=0.08)
        return fig_to_image(fig)

    return draw_bracket, mpatches, plt


@app.cell
def _(draw_bracket, mo):
    _cases = {
        4: ("**Case B**",
            "- Who is 3rd, the CB winner?",
            "**n=4:** All 4 players fit in a bracket of 4. Round 1 *is* the semi-final. "
            "The two round-1 losers go straight into the CB."),
        5: ("**Case D**",
            "- Who is 3rd, the semi-final loser or the CB winner?",
            "**n=5:** Bracket jumps to 8. Only 2 round-1 matches, one player gets a bye. "
            "There are only 2 round-1 losers feeding the CB, and one semi-final loser."),
        6: ("**Case E**",
            "- Who is 3rd, the semi-final loser or the CB winner?",
            "**n=6:** Bracket = 8. Three round-1 matches produce 3 losers that fill the CB. "
            "The semi-final loser has no path into the CB."),
        7: ("**Case F**",
            "- Who is 3rd, one of the two semi-final losers or the CB winner?",
            "**n=7:** Bracket = 8. Three round-1 matches + 1 bye. Both semi-final slots have real matches, "
            "producing two semi-final losers. Neither has a path into the CB."),
        8: ("**Case F**",
            "- Who is 3rd, one of the two semi-final losers or the CB winner?",
            "**n=8:** Full bracket of 8. Four round-1 matches, 4 round-1 losers fill the CB completely. "
            "Two semi-final losers have no path into the CB. Same structure as n=7."),
    }
    _items = []
    for _n in range(4, 9):
        _title, _question, _desc = _cases[_n]
        _items.append(mo.md(_title))
        _items.append(mo.md(_question))
        _items.append(mo.image(draw_bracket(_n)))
        _items.append(mo.md(_desc))
    mo.vstack(_items)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## Extending to More Players

    The bracket size doubles at each power of 2: `4 -> 8 -> 16 -> 32 -> ...`

    Within each bracket size, the number of round-1 matches, byes, and unplaced semi-final losers follows a pattern.
    Let's extend the analysis to `n = 3..32` to see how these cases evolve and whether the structure repeats.
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ### Round constraint
    """)
    return


@app.cell
def _(math, mo, next_power_of_2, simulate_tournament):
    _rows = []
    _rows.append("| n | BS | WB rounds | CB rounds | CB plays in | Fits? | 3rd-place match plays in |")
    _rows.append("|---|----|-----------|-----------|-------------|-------|-------------------------|")
    for _n in range(3, 17):
        _r = simulate_tournament(_n)
        _bs = _r["bracket_size"]
        _total = int(math.log2(_bs))
        _cb_internal = max((m[0] for m in _r["cb_matches"]), default=0)
        _cb_last = _cb_internal + 1 if _cb_internal > 0 else 0
        _available = _total - 1
        _fits = _cb_internal <= _available
        _sf = len(_r["wb_sf_losers"])
        if _sf == 0:
            _match_in = "N/A (CB winner = 3rd)"
        elif _sf == 1:
            _match_in = f"R{_total} (after CB final)"
        else:
            _match_in = f"R{_total} (alongside WB/CB finals)"
        _cb_range = f"R2..R{_cb_last}" if _cb_internal > 0 else "N/A"
        _rows.append(f"| {_n} | {_bs} | {_total} | {_cb_internal} | {_cb_range} | {'yes' if _fits else 'NO'} | {_match_in} |")
    return

@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    The 3rd-place match always fits within the final round of the tournament. No extra round is needed.

    **1 semi-final loser (Cases D, E):** The semi-final loser waits for the CB final to finish,
    then plays the CB winner. Both happen within the final round.

    **2 semi-final losers (Case F):** The two semi-final losers play each other alongside
    the WB final and CB final. The semi-final losers went further in the WB than any CB participant,
    so the 3rd-place match winner is **3rd** and the loser is **4th**.
    """)
    return

@app.cell
def _(math, next_power_of_2):
    def analyze_tournament(n):
        """Return key structural facts about a tournament with n players."""
        bracket_size = next_power_of_2(n)
        total_rounds = int(math.log2(bracket_size))
        seeds = list(range(1, n + 1))

        r1_matches = 0
        r1_byes = 0
        r1_empties = 0
        r1_losers = []
        positions = {1: [None] * (bracket_size // 2)}

        for pos in range(bracket_size // 2):
            s1 = seeds[2 * pos] if 2 * pos < n else None
            s2 = seeds[2 * pos + 1] if 2 * pos + 1 < n else None
            if s1 and s2:
                r1_matches += 1
                r1_losers.append(s2)
                positions[1][pos] = s1
            elif s1:
                r1_byes += 1
                positions[1][pos] = s1
            else:
                r1_empties += 1

        wb_sf_losers = []
        for r in range(2, total_rounds + 1):
            n_pos = bracket_size // (2 ** r)
            positions[r] = [None] * n_pos
            for pos in range(n_pos):
                a = positions[r - 1][2 * pos]
                b = positions[r - 1][2 * pos + 1]
                if a is not None and b is not None:
                    positions[r][pos] = a
                    if r == total_rounds - 1:
                        wb_sf_losers.append(b)
                elif a is not None:
                    positions[r][pos] = a
                elif b is not None:
                    positions[r][pos] = b

        cb_seeds = r1_losers[:]
        return {
            "n": n, "bracket_size": bracket_size, "wb_rounds": total_rounds,
            "r1_matches": r1_matches, "r1_byes": r1_byes, "r1_empties": r1_empties,
            "r1_losers_count": len(r1_losers), "cb_r1_matches": len(cb_seeds) // 2,
            "cb_odd_loser": len(cb_seeds) % 2 == 1,
            "wb_sf_losers": wb_sf_losers, "wb_sf_losers_count": len(wb_sf_losers),
            "wb_final_loser": None,
        }

    _lines = []
    _lines.append(f"{'n':>3} | {'BS':>3} | {'Rnds':>4} | {'R1 M':>4} | {'R1 B':>4} | {'R1 E':>4} | {'R1 L':>4} | {'CB R1':>5} | {'CB odd':>6} | {'Semi L':>6} | {'Case':>20}")
    _lines.append("-" * 100)
    for _n in range(3, 33):
        _a = analyze_tournament(_n)
        _bs = _a["bracket_size"]
        _half = _bs // 2
        if _n == _bs:
            _case = "FULL (power of 2)"
        elif _n == _half + 1:
            _case = f"MIN+1 ({_half}+1)"
        elif _n == _bs - 1:
            _case = f"FULL-1 ({_bs}-1)"
        else:
            _case = f"partial ({_n}/{_bs})"
        _sf_str = ",".join(f"S{s}" for s in _a["wb_sf_losers"]) if _a["wb_sf_losers"] else "-"
        _lines.append(f"{_a['n']:>3} | {_a['bracket_size']:>3} |    {_a['wb_rounds']:>1} |    {_a['r1_matches']:>1} |    {_a['r1_byes']:>1} |    {_a['r1_empties']:>1} |    {_a['r1_losers_count']:>1} |     {_a['cb_r1_matches']:>1} | {'yes' if _a['cb_odd_loser'] else 'no':>6} | {_sf_str:>6} | {_case:>20}")
    print("\n".join(_lines))
    return (analyze_tournament,)


@app.cell
def _(analyze_tournament, next_power_of_2):
    def classify_case(n):
        """Classify the 3rd-place case for n players."""
        bs = next_power_of_2(n)
        a = analyze_tournament(n)
        sf_count = a["wb_sf_losers_count"]
        r1_losers = a["r1_losers_count"]
        if n <= 2:
            return "TRIVIAL", f"n={n}, no elimination needed"
        elif bs == 4:
            return "B", "Round 1 = semi-final, CB winner = 3rd"
        elif sf_count == 1 and r1_losers == 2:
            return "D", "1 semi-final loser, CB has room for them"
        elif sf_count == 1:
            return "E", "1 semi-final loser, CB full, needs 3rd-place match"
        elif sf_count == 2:
            return "F", "2 semi-final losers, CB full, need 3rd-place matches"
        return "?", "Unknown"

    _prev_bs = 0
    _cls_lines = [f"{'n':>3} | {'BS':>3} | {'Semi':>4} | {'R1L':>3} | {'Case':>6} | Description", "=" * 80]
    for _n in range(3, 33):
        _bs = next_power_of_2(_n)
        if _bs != _prev_bs:
            _cls_lines.append(f"{'---':>3}-+-{'---':>3}-+-{'----':>4}-+-{'---':>3}-+-{'-'*6}-+-{'-'*45}")
            _prev_bs = _bs
        _a = analyze_tournament(_n)
        _cn, _cd = classify_case(_n)
        _cls_lines.append(f"{_n:>3} | {_bs:>3} | {_a['wb_sf_losers_count']:>4} | {_a['r1_losers_count']:>3} | {_cn:>6} | {_cd}")
    print("\n".join(_cls_lines))
    return (classify_case,)


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ### Observations and Case Classification

    From the extended table above, two key structural facts emerge:

    **A. Round-1 losers** = `floor(n/2)`. These are the players who enter the consolation bracket.

    **B. Semi-final losers** = teams eliminated one round before the WB final.
    The number of semi-final losers depends on how many players fill the bracket:
    - **0 semi-final losers** when `bracket_size = 4` (round 1 *is* the semi-final) **(Case B)**
    - **1 semi-final loser** when `n <= 3/4 x bracket_size` (one semi-final match + one bye-advance) **(Cases D, E)**
    - **2 semi-final losers** when `n > 3/4 x bracket_size` (both semi-final positions have real matches) **(Case F)**

    The consolation bracket only contains round-1 losers. Semi-final losers are eliminated later
    in the WB and have no automatic path into the CB. For n=5 they happen to fit, but for all
    other n >= 6, they are left unranked relative to the CB participants. This means a team that
    reached the WB semi-final can end up ranked below teams that were eliminated in the very first round.

    This gives us **4 distinct cases**, labeled B, D, E, F:

    | Case | When | Semi-final losers | Situation |
    |------|------|-------------------|-----------|
    | **B** (n=3,4) | `bracket = 4` | 0 (round 1 = semi-final) | All losers go through CB, CB winner = 3rd |
    | **D** (n=5) | `n = 2^(k-1)+1`, bracket = 8 | 1 | Few CB entrants, semi-final loser can join CB |
    | **E** (n=6, 9-12, 17-24) | `2^(k-1)+1 < n <= 3*2^(k-2)` | 1 | CB full with round-1 losers, semi-final loser stranded |
    | **F** (n=7-8, 13-16, 25-32) | `3*2^(k-2) < n <= 2^k` | 2 | CB full, both semi-final losers stranded |

    **Case D** only occurs for n=5. For n >= 9 (bracket >= 16), even the minimum player count
    produces enough round-1 losers to fill the CB.
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## Consolidated Scenario for 3rd Place

    For any `n` players:
    - the bracket size is the next power of 2 after n (5 players -> a bracket of 8)
    - the number of rounds is the exponent of the bracket's power of 2 (8 = 2^3 -> 3 rounds)
    - the semi-final losers are the teams that lose in the round before the final of the winners bracket

    Ignoring the trivial case where the first round is also the semi-final (where the two initial losers battle it for 3rd),
    we can identify 2 scenario and define how the third place should be attributed.

    """)
    return


@app.cell
def _(analyze_tournament, classify_case, fig_to_image, next_power_of_2, plt):
    def draw_proposed_3rd_place(n):
        """Visualize the proposed 3rd-place match flow for n players."""
        a = analyze_tournament(n)
        bs = a["bracket_size"]
        total_rounds = a["wb_rounds"]
        sf_losers = a["wb_sf_losers"]
        seeds = list(range(1, n + 1))

        positions = {1: [None] * (bs // 2)}
        r1_losers = []
        for pos in range(bs // 2):
            s1 = seeds[2 * pos] if 2 * pos < n else None
            s2 = seeds[2 * pos + 1] if 2 * pos + 1 < n else None
            if s1 and s2:
                r1_losers.append(s2)
                positions[1][pos] = s1
            elif s1:
                positions[1][pos] = s1
        for r in range(2, total_rounds + 1):
            n_pos = bs // (2 ** r)
            positions[r] = [None] * n_pos
            for pos in range(n_pos):
                aa = positions[r - 1][2 * pos]
                bb = positions[r - 1][2 * pos + 1]
                if aa is not None and bb is not None:
                    positions[r][pos] = aa
                elif aa is not None:
                    positions[r][pos] = aa
                elif bb is not None:
                    positions[r][pos] = bb

        wb_winner = positions[total_rounds][0]
        wb_loser = None
        if total_rounds >= 2 and len(positions.get(total_rounds - 1, [])) > 1:
            wb_loser = positions[total_rounds - 1][1]

        cb_seeds = r1_losers[:]
        cb_winner = None
        if len(cb_seeds) >= 2:
            paired = [cb_seeds[2 * i] for i in range(len(cb_seeds) // 2)]
            unpaired = cb_seeds[len(cb_seeds) // 2 * 2:] if len(cb_seeds) % 2 else []
            advancers = paired + unpaired
            while len(advancers) >= 2:
                advancers = [advancers[2 * i] for i in range(len(advancers) // 2)]
            cb_winner = advancers[0] if advancers else None
        elif len(cb_seeds) == 1:
            cb_winner = cb_seeds[0]

        case_name, _ = classify_case(n)
        return {"n": n, "bs": bs, "case": case_name, "wb_winner": wb_winner, "wb_loser": wb_loser, "sf_losers": sf_losers, "cb_winner": cb_winner}

    def _draw_case_flow(ax, info):
        """Draw a single case flow diagram on the given axes."""
        _box_blue = dict(boxstyle="round,pad=0.2", facecolor="#e3f2fd", edgecolor="#1565c0")
        _box_gold = dict(boxstyle="round,pad=0.2", facecolor="#fff8e1", edgecolor="#f57f17")
        _box_gray = dict(boxstyle="round,pad=0.2", facecolor="#f5f5f5", edgecolor="#666")

        _sf = info["sf_losers"]
        _cb = info["cb_winner"]
        _has_cb_row = len(_sf) == 2

        ax.set_xlim(0, 10)
        ax.set_ylim(0.3, 4.2 if _has_cb_row else 3.5)
        ax.set_xticks([])
        ax.set_yticks([])
        ax.text(1.5, 3.4, "WB Final", fontsize=8, ha="center", color="#666")
        ax.text(1.5, 3.0, f"S{info['wb_winner']} (1st)", fontsize=10, ha="center", fontweight="bold", bbox=dict(boxstyle="round,pad=0.2", facecolor="#c8e6c9", edgecolor="#2e7d32"))
        ax.text(1.5, 2.3, f"S{info['wb_loser']} (2nd)", fontsize=10, ha="center", bbox=dict(boxstyle="round,pad=0.2", facecolor="#ffcdd2", edgecolor="#c62828"))
        if len(_sf) == 1:
            ax.text(4, 3.4, "WB Semi-final Loser", fontsize=8, ha="center", color="#666")
            ax.text(4, 3.0, f"S{_sf[0]}", fontsize=10, ha="center", bbox=_box_blue)
            ax.text(4, 1.6, "CB Winner", fontsize=8, ha="center", color="#666")
            ax.text(4, 1.2, f"S{_cb}", fontsize=10, ha="center", bbox=_box_blue)
            ax.annotate("", xy=(6.5, 2.2), xytext=(4.8, 3.0), arrowprops=dict(arrowstyle="->", color="#1565c0", lw=1.5))
            ax.annotate("", xy=(6.5, 2.2), xytext=(4.8, 1.2), arrowprops=dict(arrowstyle="->", color="#1565c0", lw=1.5))
            ax.text(7, 2.2, "3rd place\nmatch", fontsize=9, ha="center", bbox=_box_gold)
            ax.text(8.8, 3.0, "= 3rd", fontsize=9, ha="center", color="#2e7d32", fontweight="bold")
            ax.text(8.8, 1.2, "= 4th", fontsize=9, ha="center", color="#c62828")
        elif len(_sf) == 2:
            ax.text(3, 3.4, "WB Semi-final Losers", fontsize=8, ha="center", color="#666")
            ax.text(3, 3.0, f"S{_sf[0]}", fontsize=10, ha="center", bbox=_box_blue)
            ax.text(3, 2.3, f"S{_sf[1]}", fontsize=10, ha="center", bbox=_box_blue)
            ax.annotate("", xy=(5.5, 2.65), xytext=(3.8, 3.0), arrowprops=dict(arrowstyle="->", color="#666", lw=1))
            ax.annotate("", xy=(5.5, 2.65), xytext=(3.8, 2.3), arrowprops=dict(arrowstyle="->", color="#666", lw=1))
            ax.text(6, 2.65, "3rd place\nmatch", fontsize=8, ha="center", bbox=_box_gold)
            ax.annotate("", xy=(8, 3.0), xytext=(6.8, 2.8), arrowprops=dict(arrowstyle="->", color="#2e7d32", lw=1.5))
            ax.annotate("", xy=(8, 2.1), xytext=(6.8, 2.5), arrowprops=dict(arrowstyle="->", color="#c62828", lw=1.5))
            ax.text(8.8, 3.0, "= 3rd", fontsize=9, ha="center", color="#2e7d32", fontweight="bold")
            ax.text(8.8, 2.1, "= 4th", fontsize=9, ha="center", color="#c62828")
            ax.text(6, 1.1, "CB Winner", fontsize=8, ha="center", color="#666")
            ax.text(6, 0.7, f"S{_cb}", fontsize=10, ha="center", bbox=_box_gray)
            ax.text(8.8, 0.7, "= 5th", fontsize=9, ha="center", color="#999")

    def draw_case_diagram(n):
        """Draw a single flow diagram for n players and return PNG bytes."""
        info = draw_proposed_3rd_place(n)
        _h = 2.8 if len(info["sf_losers"]) == 2 else 2.2
        fig, ax = plt.subplots(figsize=(7, _h))
        _draw_case_flow(ax, info)
        for spine in ax.spines.values():
            spine.set_visible(False)
        plt.tight_layout()
        return fig_to_image(fig)

    return draw_case_diagram, draw_proposed_3rd_place


@app.cell
def _(draw_case_diagram, mo):
    mo.vstack([
        mo.md(r"""
### Rule for 1 semi-final match

*Applies to Cases D and E (n=5-6, 9-12, 17-24, ...).*

When the number of players is in between two powers of 2 with not enough to fill the two brackets.
        """),
        mo.image(draw_case_diagram(6)),
        mo.md(r"""
When there is exactly **1 semi-final loser**, it means one team is a "bye" and advance to the final,
while the other teams compete in a single semi-final.

So the battle for third place becomes a match between the consolation bracket latest winner and the winner bracket's semi-final loser.
This match can happen during the winner bracket finale.
        """),
    ])
    return


@app.cell
def _(draw_case_diagram, mo):
    mo.vstack([
        mo.md(r"""
### Rule for 2 semi-final matches

*Applies to Case F (n=7-8, 13-16, 25-32, ...).*

When the number of players is close but below the next power of 2.
        """),
        mo.image(draw_case_diagram(8)),
        mo.md(r"""
When there are **2 semi-final losers**, they play each other for third place,
while the consolation bracket finale is a battle for 5th place.
All matches can happen during the winner bracket finale.
        """),
    ])
    return

@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## Conclusion

    A single-elimination tournament for `n` players uses a bracket of size `B = 2^k`,
    where `B` is the smallest power of 2 greater than or equal to `n`. The tournament
    has `k = log2(B)` rounds. When `n < B`, some first-round slots are byes (automatic advances).

    **Winners Bracket (WB):** Standard single-elimination. Each round halves the field.
    The semi-final is round `k-1` (the penultimate round). The final is round `k`.

    **Consolation Bracket (CB):** Seeded exclusively by first-round losers from the WB.
    There are `floor(n/2)` first-round losers. The CB begins at round 2 of the tournament
    (since round-1 results are needed to determine its seeds). If the number of CB seeds
    is odd, one seed receives a bye in the CB's first round.

    **Semi-final losers** are teams eliminated in the WB semi-final (round `k-1`).
    Their count depends on how many players fill the bracket:

    - **0 semi-final losers** when `B = 4` (round 1 is the semi-final).
    - **1 semi-final loser** when `n <= 3/4 * B` (one semi-final slot is a bye-advance).
    - **2 semi-final losers** when `n > 3/4 * B` (both semi-final slots have real matches).

    **3rd-place determination:**

    | Semi-final losers | Rule | Standings |
    |-------------------|------|-----------|
    | 0 | CB winner is 3rd | 1st: WB winner, 2nd: WB final loser, 3rd: CB winner |
    | 1 | Semi-final loser plays CB winner for 3rd | Winner of that match is 3rd, loser is 4th |
    | 2 | Two semi-final losers play each other for 3rd | Winner is 3rd, loser is 4th, CB winner is 5th |

    All 3rd-place matches occur during the final round (round `k`), alongside the WB final
    and CB final. No additional round beyond the WB final is required.
    """)
    return


if __name__ == "__main__":
    app.run()
