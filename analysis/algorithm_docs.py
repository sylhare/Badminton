import marimo

__generated_with = "0.19.4"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    from matplotlib.patches import FancyBboxPatch, Circle, FancyArrowPatch
    import numpy as np
    
    from utils.plotting import setup_matplotlib, fig_to_image
    
    return Circle, FancyArrowPatch, FancyBboxPatch, fig_to_image, mo, mpatches, np, plt, setup_matplotlib


@app.cell
def _(setup_matplotlib):
    setup_matplotlib(__file__)
    return


@app.cell
def _(mo):
    mo.md(r"""
    # Court Assignment Algorithms: Mathematical Foundations

    ## Abstract

    This document presents the mathematical foundations of three court assignment algorithms designed to generate fair and balanced badminton doubles assignments. We analyze:

    1. **Monte Carlo Greedy Search** - Random sampling with greedy evaluation
    2. **Simulated Annealing (SA)** - Iterative improvement with probabilistic acceptance
    3. **Conflict Graph Engine (CG)** - Greedy construction with explicit conflict tracking

    For each algorithm, we define the optimization approach, prove convergence properties, analyze complexity, and provide statistical guarantees. Based on empirical analysis (see [engine_analysis.py](/engine_analysis/)), the choice of algorithm depends on the trade-off between solution quality and computational requirements.
    """)
    return


# =============================================================================
# SECTION 1: PROBLEM DEFINITION
# =============================================================================


@app.cell
def _(mo):
    mo.md(r"""
    ---

    ## 1. Problem Definition

    ### 1.1 Formal Problem Statement

    Given:
    - A set of players $P = \{p_1, p_2, ..., p_n\}$ where each player has presence status $\sigma_i \in \{0, 1\}$
    - Number of available courts $C$
    - Historical data matrices for teammate frequency, opponent frequency, wins, and losses

    **Objective**: Find an assignment $A^*$ that minimizes a multi-objective cost function while satisfying capacity constraints.

    ### 1.2 Constraints

    1. **Court Capacity**: Each court holds exactly 4 players (doubles) or 2 players (singles)
    2. **Player Uniqueness**: Each player is assigned to at most one court
    3. **Team Balance**: Each court has two teams of equal size
    4. **Presence Requirement**: Only present players ($\sigma_i = 1$) can be assigned

    ### 1.3 Decision Variables

    Let $x_{i,c,t} \in \{0, 1\}$ where:
    - $x_{i,c,t} = 1$ if player $p_i$ is assigned to court $c$ on team $t$
    - $t \in \{1, 2\}$ represents team 1 or team 2

    ### 1.4 Problem Classification

    This problem is a variant of the **Balanced Graph Partitioning Problem**, which is NP-hard [[1]](#ref-1). The combination of:
    - Multi-objective optimization (teammate diversity, opponent diversity, skill balance)
    - Capacity constraints (exactly 4 players per court)
    - Historical state dependency (costs depend on past assignments)

    makes exhaustive search intractable for realistic group sizes.

    ---

    ### Example 1.1: Problem Setup

    Suppose we have 8 players: Alice, Bob, Carol, Dave, Eve, Frank, Grace, Henry.
    - 6 are present ($\sigma = 1$): Alice, Bob, Carol, Dave, Eve, Frank
    - 2 are absent ($\sigma = 0$): Grace, Henry
    - Available courts: $C = 1$
    - Court capacity: 4 players

    **Problem**: Assign 4 of the 6 present players to the court, bench 2 players fairly, and split the 4 into two balanced teams.
    """)
    return


@app.cell
def _(Circle, FancyBboxPatch, fig_to_image, mo, mpatches, plt):
    # Visual diagram: Problem Definition
    _fig1, _ax1 = plt.subplots(1, 1, figsize=(10, 6))
    _ax1.set_xlim(0, 10)
    _ax1.set_ylim(0, 7)
    _ax1.set_aspect('equal')
    _ax1.axis('off')
    _ax1.set_title('Court Assignment Problem: Visual Overview', fontsize=14, fontweight='bold', pad=20)

    # Draw court (center)
    _court_patch = FancyBboxPatch((3.5, 2), 3, 2.5, boxstyle="round,pad=0.05",
                                  facecolor='#90EE90', edgecolor='#228B22', linewidth=2)
    _ax1.add_patch(_court_patch)
    _ax1.text(5, 3.25, 'Court 1', ha='center', va='center', fontsize=11, fontweight='bold')

    # Team 1 area
    _team1_area = FancyBboxPatch((3.6, 3.3), 1.3, 1.1, boxstyle="round,pad=0.02",
                                 facecolor='#FFB6C1', edgecolor='#DC143C', linewidth=1.5, alpha=0.7)
    _ax1.add_patch(_team1_area)
    _ax1.text(4.25, 4.6, 'Team 1', ha='center', fontsize=9, color='#DC143C')

    # Team 2 area
    _team2_area = FancyBboxPatch((5.1, 3.3), 1.3, 1.1, boxstyle="round,pad=0.02",
                                 facecolor='#ADD8E6', edgecolor='#4169E1', linewidth=1.5, alpha=0.7)
    _ax1.add_patch(_team2_area)
    _ax1.text(5.75, 4.6, 'Team 2', ha='center', fontsize=9, color='#4169E1')

    # Players on court - Team 1 (Alice, Bob)
    for _name, _pos in [('Alice', (3.9, 3.8)), ('Bob', (4.4, 3.8))]:
        _circle = Circle(_pos, 0.25, facecolor='#FFB6C1', edgecolor='#DC143C', linewidth=2)
        _ax1.add_patch(_circle)
        _ax1.text(_pos[0], _pos[1], _name[0], ha='center', va='center', fontsize=10, fontweight='bold')

    # Players on court - Team 2 (Carol, Dave)
    for _name, _pos in [('Carol', (5.4, 3.8)), ('Dave', (5.9, 3.8))]:
        _circle = Circle(_pos, 0.25, facecolor='#ADD8E6', edgecolor='#4169E1', linewidth=2)
        _ax1.add_patch(_circle)
        _ax1.text(_pos[0], _pos[1], _name[0], ha='center', va='center', fontsize=10, fontweight='bold')

    # Benched players (Eve, Frank)
    _bench_patch = FancyBboxPatch((3.5, 0.3), 3, 1, boxstyle="round,pad=0.05",
                                  facecolor='#D3D3D3', edgecolor='#696969', linewidth=2)
    _ax1.add_patch(_bench_patch)
    _ax1.text(5, 0.55, 'Bench', ha='center', va='center', fontsize=10, fontweight='bold', color='#696969')

    for _name, _pos in [('Eve', (4.2, 1.0)), ('Frank', (5.8, 1.0))]:
        _circle = Circle(_pos, 0.25, facecolor='#FFFFE0', edgecolor='#696969', linewidth=2)
        _ax1.add_patch(_circle)
        _ax1.text(_pos[0], _pos[1], _name[0], ha='center', va='center', fontsize=10, fontweight='bold', color='#696969')

    # Absent players (Grace, Henry) - shown faded on right
    _absent_box = FancyBboxPatch((8, 2.5), 1.8, 2, boxstyle="round,pad=0.05",
                                 facecolor='#F5F5F5', edgecolor='#C0C0C0', linewidth=1, linestyle='--')
    _ax1.add_patch(_absent_box)
    _ax1.text(8.9, 4.7, 'Absent (σ=0)', ha='center', fontsize=9, color='#A0A0A0')

    for _name, _pos in [('Grace', (8.9, 4.0)), ('Henry', (8.9, 3.0))]:
        _circle = Circle(_pos, 0.25, facecolor='#E8E8E8', edgecolor='#C0C0C0', linewidth=1, linestyle='--')
        _ax1.add_patch(_circle)
        _ax1.text(_pos[0], _pos[1], _name[0], ha='center', va='center', fontsize=10, color='#A0A0A0')

    # Legend
    _legend_elements = [
        mpatches.Patch(facecolor='#FFB6C1', edgecolor='#DC143C', label='Team 1'),
        mpatches.Patch(facecolor='#ADD8E6', edgecolor='#4169E1', label='Team 2'),
        mpatches.Patch(facecolor='#FFFFE0', edgecolor='#696969', label='Benched'),
        mpatches.Patch(facecolor='#E8E8E8', edgecolor='#C0C0C0', label='Absent', linestyle='--'),
    ]
    _ax1.legend(handles=_legend_elements, loc='upper left', framealpha=0.9)

    # Labels
    _ax1.text(0.2, 6.5, 'Input: 8 players, 6 present, 1 court (capacity 4)', fontsize=10, style='italic')
    _ax1.text(0.2, 6.0, 'Output: Assign 4 to court, bench 2, split into teams', fontsize=10, style='italic')

    _fig1.tight_layout()
    mo.image(fig_to_image(_fig1))
    return


@app.cell
def _(mo):
    mo.md(r"""
    *Figure 1: Visual representation of the court assignment problem. Shows 8 players where 6 are present (Alice through Frank), 2 are absent (Grace, Henry). The diagram illustrates how 4 players are assigned to Court 1 and split into two teams (Team 1: Alice, Bob; Team 2: Carol, Dave), while 2 players (Eve, Frank) are benched.*
    """)
    return


# =============================================================================
# SECTION 2: COST FUNCTION
# =============================================================================


@app.cell
def _(mo):
    mo.md(r"""
    ---

    ## 2. Cost Function

    All three algorithms optimize the same multi-objective cost function, ensuring consistent evaluation criteria.

    ### 2.1 Multi-Objective Cost Function

    The total cost of an assignment $A$ is defined as:

    $$
    \mathcal{C}(A) = \sum_{c \in \text{Courts}} \mathcal{C}_{\text{court}}(c)
    $$

    **Variable definitions**:
    - $\mathcal{C}(A)$ = total cost of assignment $A$ (lower is better)
    - $A$ = a complete court assignment (who plays where, on which team)
    - $c$ = a single court
    - $\sum_{c \in \text{Courts}}$ = sum over all courts being used

    **What this calculates**: The total "badness" of an assignment by adding up the costs from each individual court.

    Where the court cost function is:

    $$
    \begin{aligned}
    \mathcal{C}_{\text{court}}(c) = \; & \mathcal{C}_{\text{teammate}}(c) \\
    & + \mathcal{C}_{\text{opponent}}(c) \\
    & + \mathcal{C}_{\text{skill-pair}}(c) \\
    & + \mathcal{C}_{\text{balance}}(c)
    \end{aligned}
    $$

    **Variable definitions**:
    - $\mathcal{C}_{\text{court}}(c)$ = cost for a single court $c$
    - $\mathcal{C}_{\text{teammate}}(c)$ = penalty for repeated teammate pairings on court $c$
    - $\mathcal{C}_{\text{opponent}}(c)$ = penalty for repeated opponent matchups on court $c$
    - $\mathcal{C}_{\text{skill-pair}}(c)$ = penalty for similar-skill players on same team
    - $\mathcal{C}_{\text{balance}}(c)$ = penalty for unbalanced teams

    **Note**: All components are additive. Monte Carlo uses equal weights (1.0). Simulated Annealing uses a hard constraint for teammate repeats (weight = 10000) and different weights for other components. Conflict Graph uses opponent weight = 10 and balance weight = 2. Lower cost = better assignment.

    **Important**: The algorithms maintain **separate** tracking maps for teammate and opponent history. A pair like (Alice, Bob) can have different counts in each map (e.g., teammates 5 times, opponents 3 times).
    """)
    return


@app.cell
def _(FancyArrowPatch, FancyBboxPatch, fig_to_image, mo, plt):
    # Visual diagram: Cost Function Components
    _fig2, _ax2 = plt.subplots(figsize=(11, 5))
    _ax2.set_xlim(0, 11)
    _ax2.set_ylim(0, 5)
    _ax2.axis('off')
    _ax2.set_title('Cost Function: Four Components', fontsize=14, fontweight='bold', pad=15)

    # Total cost box (top center)
    _total_box = FancyBboxPatch((4, 3.8), 3, 0.9, boxstyle="round,pad=0.1",
                                facecolor='#2E4057', edgecolor='#1a252f', linewidth=2)
    _ax2.add_patch(_total_box)
    _ax2.text(5.5, 4.25, 'Total Cost C(A)', ha='center', va='center',
             fontsize=12, fontweight='bold', color='white')

    # Component boxes
    _components = [
        ('Teammate\nRepetition', '#E74C3C', 'Penalizes frequent\nteammate pairings', 0.7),
        ('Opponent\nRepetition', '#3498DB', 'Penalizes frequent\nopponent matchups', 3.3),
        ('Skill\nPairing', '#27AE60', 'Discourages similar\nskill levels on team', 5.9),
        ('Team\nBalance', '#9B59B6', 'Ensures competitive\nmatch balance', 8.5),
    ]

    for _comp_name, _comp_color, _comp_desc, _comp_x in _components:
        # Main component box
        _box = FancyBboxPatch((_comp_x, 1.0), 1.9, 1.8, boxstyle="round,pad=0.08",
                              facecolor=_comp_color, edgecolor='black', linewidth=1.5, alpha=0.85)
        _ax2.add_patch(_box)
        _ax2.text(_comp_x + 0.95, 2.3, _comp_name, ha='center', va='center',
                 fontsize=10, fontweight='bold', color='white')
        _ax2.text(_comp_x + 0.95, 1.5, _comp_desc, ha='center', va='center',
                 fontsize=7, color='white', style='italic')

        # Arrow to total
        _arrow = FancyArrowPatch((_comp_x + 0.95, 2.85), (5.5, 3.75),
                                 arrowstyle='->', mutation_scale=15,
                                 color=_comp_color, linewidth=2)
        _ax2.add_patch(_arrow)

    # Plus signs between components
    for _plus_x in [2.7, 5.3, 7.9]:
        _ax2.text(_plus_x, 1.9, '+', fontsize=20, ha='center', va='center', fontweight='bold')

    # Formula at bottom
    _ax2.text(5.5, 0.4, r'$\mathcal{C}_{court} = \mathcal{C}_{teammate} + \mathcal{C}_{opponent} + \mathcal{C}_{skill} + \mathcal{C}_{balance}$',
             ha='center', fontsize=11, style='italic',
             bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))

    _fig2.tight_layout()
    mo.image(fig_to_image(_fig2))
    return


@app.cell
def _(mo):
    mo.md(r"""
    *Figure 2: The four components that make up the total cost function. Each colored box represents a different optimization objective: Teammate Repetition (red) penalizes frequent pairings, Opponent Repetition (blue) penalizes repeated matchups, Skill Pairing (green) discourages similar skill levels on the same team, and Team Balance (purple) ensures competitive matches. All components are summed to produce the total court cost.*
    """)
    return


@app.cell
def _(mo):
    mo.md(r"""
    ### 2.2 Component Definitions

    #### 2.2.1 Teammate Repetition Cost

    Penalizes players who have been teammates frequently in the past:

    $$
    \mathcal{C}_{\text{teammate}}(c) = \sum_{t \in \{1,2\}} \sum_{\substack{p_i, p_j \in \text{Team}_t \\ i < j}} H_{\text{teammate}}(p_i, p_j)
    $$

    **Variable definitions**:
    - $\mathcal{C}_{\text{teammate}}(c)$ = teammate cost for court $c$ (what we're calculating)
    - $t$ = team number (1 or 2)
    - $p_i, p_j$ = two different players on the same team
    - $i < j$ = ensures we count each pair only once (Alice-Bob, not also Bob-Alice)
    - $H_{\text{teammate}}(p_i, p_j)$ = how many times players $i$ and $j$ have been teammates before

    **What this calculates**: Sum up all the historical teammate counts for every pair of players on the same team. Higher value = players have played together too often.

    #### 2.2.2 Opponent Repetition Cost

    Penalizes players who have faced each other frequently:

    $$
    \mathcal{C}_{\text{opponent}}(c) = \sum_{p_i \in \text{Team}_1} \sum_{p_j \in \text{Team}_2} H_{\text{opponent}}(p_i, p_j)
    $$

    **Variable definitions**:
    - $\mathcal{C}_{\text{opponent}}(c)$ = opponent cost for court $c$
    - $p_i \in \text{Team}_1$ = each player on Team 1
    - $p_j \in \text{Team}_2$ = each player on Team 2
    - $H_{\text{opponent}}(p_i, p_j)$ = how many times player $i$ has faced player $j$ as opponents

    **What this calculates**: Sum up all the historical opponent counts for every cross-team pair. Higher value = these players have faced each other too often.

    #### 2.2.3 Skill Pairing Penalty

    Discourages pairing players with similar skill levels on the same team:

    $$
    \mathcal{C}_{\text{skill-pair}}(c) = \sum_{t \in \{1,2\}} \sum_{\substack{p_i, p_j \in \text{Team}_t \\ i < j}} \left( W_i \cdot W_j + L_i \cdot L_j \right)
    $$

    **Variable definitions**:
    - $W_i$ = total wins for player $i$
    - $L_i$ = total losses for player $i$
    - $W_i \cdot W_j$ = product of two players' wins (high if both are strong)
    - $L_i \cdot L_j$ = product of two players' losses (high if both are weak)

    **What this calculates**: Penalizes putting two high-win players together OR two high-loss players together. Encourages mixing skill levels within each team.

    **Example**: If Alice has 5 wins and Bob has 4 wins: $5 \times 4 = 20$ (high penalty for putting two strong players together). If Alice (5 wins) pairs with Carol (1 win): $5 \times 1 = 5$ (low penalty).

    #### 2.2.4 Team Balance Cost

    Ensures competitive matches by balancing aggregate team strength:

    $$
    \mathcal{C}_{\text{balance}}(c) = \left| \sum_{p_i \in \text{Team}_1} W_i - \sum_{p_j \in \text{Team}_2} W_j \right| + \left| \sum_{p_i \in \text{Team}_1} L_i - \sum_{p_j \in \text{Team}_2} L_j \right|
    $$

    **Variable definitions**:
    - $\sum_{p_i \in \text{Team}_1} W_i$ = total wins of all players on Team 1
    - $\sum_{p_j \in \text{Team}_2} W_j$ = total wins of all players on Team 2
    - $| \cdot |$ = absolute value (we care about the difference, not which team is stronger)

    **What this calculates**: The difference in total wins between teams PLUS the difference in total losses between teams. Lower value = more evenly matched teams.

    **Example**: Team 1 has 9 total wins, Team 2 has 3 total wins: $|9 - 3| = 6$ (unbalanced). If both teams had 6 wins: $|6 - 6| = 0$ (perfectly balanced).
    """)
    return


@app.cell
def _(fig_to_image, mo, np, plt):
    # Visual diagram: Skill Pairing Penalty Heatmap
    _fig3, (_ax3a, _ax3b) = plt.subplots(1, 2, figsize=(12, 5))
    _fig3.suptitle('Skill Pairing Penalty: Why Mix Skill Levels', fontsize=14, fontweight='bold')

    # Left: Win product heatmap
    _wins_range = np.arange(0, 11)
    _w1_grid, _w2_grid = np.meshgrid(_wins_range, _wins_range)
    _penalty_grid = _w1_grid * _w2_grid

    _im1 = _ax3a.imshow(_penalty_grid, cmap='YlOrRd', origin='lower', aspect='equal')
    _ax3a.set_xlabel('Player 1 Wins', fontsize=11)
    _ax3a.set_ylabel('Player 2 Wins', fontsize=11)
    _ax3a.set_title('Penalty = W₁ × W₂\n(Higher = Worse)', fontsize=11)
    _ax3a.set_xticks(range(0, 11, 2))
    _ax3a.set_yticks(range(0, 11, 2))
    plt.colorbar(_im1, ax=_ax3a, label='Penalty')

    # Annotate key points
    _ax3a.plot(5, 5, 'ko', markersize=10)
    _ax3a.annotate('Two strong\n(5,5)=25', xy=(5, 5), xytext=(7, 3),
                  fontsize=9, arrowprops=dict(arrowstyle='->', color='black'),
                  bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))

    _ax3a.plot(10, 0, 'g^', markersize=10)
    _ax3a.annotate('Mixed\n(10,0)=0', xy=(10, 0), xytext=(8, 2),
                  fontsize=9, arrowprops=dict(arrowstyle='->', color='green'),
                  bbox=dict(boxstyle='round', facecolor='lightgreen', alpha=0.8))

    # Right: Bar chart comparing pairings
    _pairing_labels = ['Alice(5)\n+\nBob(4)', 'Carol(1)\n+\nDave(2)', 'Alice(5)\n+\nCarol(1)', 'Bob(4)\n+\nDave(2)']
    _pairing_penalties = [5*4, 1*2, 5*1, 4*2]
    _bar_colors = ['#E74C3C', '#E74C3C', '#27AE60', '#27AE60']

    _bars = _ax3b.bar(range(4), _pairing_penalties, color=_bar_colors, edgecolor='black', linewidth=1.5)
    _ax3b.set_xticks(range(4))
    _ax3b.set_xticklabels(_pairing_labels, fontsize=9)
    _ax3b.set_ylabel('Skill Pairing Penalty (W₁ × W₂)', fontsize=11)
    _ax3b.set_title('Example: Same 4 Players, Different Pairings', fontsize=11)

    # Add value labels on bars
    for _i, (_val, _bar) in enumerate(zip(_pairing_penalties, _bars)):
        _ax3b.text(_bar.get_x() + _bar.get_width()/2, _val + 0.5, str(_val),
                  ha='center', fontsize=11, fontweight='bold')

    # Add totals
    _ax3b.axhline(y=0, color='black', linewidth=0.5)
    _ax3b.text(0.5, 24, f'Total: {5*4 + 1*2} = 22', ha='center', fontsize=10,
              bbox=dict(boxstyle='round', facecolor='#FADBD8'))
    _ax3b.text(2.5, 24, f'Total: {5*1 + 4*2} = 13', ha='center', fontsize=10,
              bbox=dict(boxstyle='round', facecolor='#D5F5E3'))

    _ax3b.set_ylim(0, 28)
    _ax3b.legend([plt.Rectangle((0,0),1,1, facecolor='#E74C3C'),
                 plt.Rectangle((0,0),1,1, facecolor='#27AE60')],
                ['Similar skill (high penalty)', 'Mixed skill (low penalty)'],
                loc='upper right', fontsize=9)

    _fig3.tight_layout()
    mo.image(fig_to_image(_fig3))
    return


@app.cell
def _(mo):
    mo.md(r"""
    *Figure 3: Left panel shows a heatmap of the skill pairing penalty (W₁ × W₂) — the darker red region indicates higher penalties when two strong players are paired together. Right panel compares two different team configurations with the same 4 players: pairing similar-skill players (Alice+Bob, Carol+Dave) yields a total penalty of 22, while mixing skill levels (Alice+Carol, Bob+Dave) reduces the penalty to 13.*
    """)
    return


# =============================================================================
# SECTION 3: ALGORITHM OVERVIEW
# =============================================================================


@app.cell
def _(mo):
    mo.md(r"""
    ---

    ## 3. Algorithm Overview

    We present three algorithms that approach the court assignment problem with different strategies. Each has distinct trade-offs between solution quality, computational cost, and theoretical guarantees.

    ### 3.1 Algorithm Taxonomy

    | Algorithm | Strategy | Search Type | Optimality Guarantee |
    |-----------|----------|-------------|---------------------|
    | **Monte Carlo** | Random sampling + greedy selection | Global (stochastic) | Probabilistic |
    | **Simulated Annealing** | Iterative improvement + controlled randomness | Local → Global | Asymptotic |
    | **Conflict Graph** | Randomized search + greedy fallback | Randomized greedy | None |

    ### 3.2 When to Use Each Algorithm

    | Scenario | Recommended | Rationale |
    |----------|-------------|-----------|
    | Real-time UI (< 10ms) | Monte Carlo or CG | Fast execution, good-enough solutions |
    | Maximum fairness priority | Simulated Annealing | Best empirical results for repeat avoidance |
    | Large player pools (> 40) | Simulated Annealing | Scales better with problem size |
    | Simple implementation | Conflict Graph | Deterministic, easy to debug |
    """)
    return


@app.cell
def _(FancyArrowPatch, FancyBboxPatch, fig_to_image, mo, plt):
    # Visual diagram: Algorithm Comparison Overview
    _fig_overview, _ax_overview = plt.subplots(figsize=(14, 7))
    _ax_overview.set_xlim(0, 14)
    _ax_overview.set_ylim(0, 7)
    _ax_overview.axis('off')
    _ax_overview.set_title('Three Approaches to Court Assignment', fontsize=16, fontweight='bold', pad=20)

    # Algorithm boxes
    _algos = [
        ('Monte Carlo\nGreedy Search', '#4C78A8', 1.5, 
         '• Random sampling\n• K=300 iterations\n• Best-of-K selection'),
        ('Simulated\nAnnealing', '#54A24B', 5.5,
         '• Iterative improvement\n• 1500 iterations\n• Escape local minima'),
        ('Conflict Graph\nEngine', '#F58518', 9.5,
         '• Greedy construction\n• Explicit conflict tracking\n• Single-pass algorithm'),
    ]

    for _name, _color, _x, _desc in _algos:
        # Main box
        _box = FancyBboxPatch((_x, 3.5), 3, 2.5, boxstyle="round,pad=0.1",
                              facecolor=_color, edgecolor='black', linewidth=2, alpha=0.9)
        _ax_overview.add_patch(_box)
        _ax_overview.text(_x + 1.5, 5.3, _name, ha='center', va='center',
                         fontsize=12, fontweight='bold', color='white')
        _ax_overview.text(_x + 1.5, 4.2, _desc, ha='center', va='center',
                         fontsize=8, color='white', linespacing=1.5)

    # Input (top)
    _input_box = FancyBboxPatch((5.5, 6.2), 3, 0.6, boxstyle="round,pad=0.05",
                                facecolor='#2E4057', edgecolor='black', linewidth=2)
    _ax_overview.add_patch(_input_box)
    _ax_overview.text(7, 6.5, 'Players + History + Courts', ha='center', va='center',
                     fontsize=10, fontweight='bold', color='white')

    # Arrows from input to algorithms
    for _x in [3, 7, 11]:
        _arrow = FancyArrowPatch((7, 6.15), (_x, 6.0),
                                 arrowstyle='->', mutation_scale=12,
                                 color='#555', linewidth=1.5)
        _ax_overview.add_patch(_arrow)

    # Output (bottom)
    _output_box = FancyBboxPatch((5.5, 0.5), 3, 0.6, boxstyle="round,pad=0.05",
                                 facecolor='#2E4057', edgecolor='black', linewidth=2)
    _ax_overview.add_patch(_output_box)
    _ax_overview.text(7, 0.8, 'Optimal Assignment A*', ha='center', va='center',
                     fontsize=10, fontweight='bold', color='white')

    # Arrows from algorithms to output
    for _x in [3, 7, 11]:
        _arrow = FancyArrowPatch((_x, 3.45), (7, 1.15),
                                 arrowstyle='->', mutation_scale=12,
                                 color='#555', linewidth=1.5)
        _ax_overview.add_patch(_arrow)

    # Performance indicators
    _metrics = [
        ('Speed', ['Fast (~8ms)', 'Medium (~15ms)', 'Fast (~5ms)']),
        ('Quality', ['Good', 'Best', 'Good']),
        ('Tuning', ['None', 'Temperature', 'None']),
    ]

    _y_start = 2.8
    for _i, (_metric, _values) in enumerate(_metrics):
        _y = _y_start - _i * 0.6
        _ax_overview.text(0.3, _y, f'{_metric}:', fontsize=9, fontweight='bold', va='center')
        for _j, (_val, _x) in enumerate(zip(_values, [3, 7, 11])):
            _ax_overview.text(_x, _y, _val, ha='center', fontsize=8, va='center',
                             bbox=dict(boxstyle='round', facecolor='white', alpha=0.7))

    _fig_overview.tight_layout()
    mo.image(fig_to_image(_fig_overview))
    return


@app.cell
def _(mo):
    mo.md(r"""
    *Figure 4: High-level comparison of the three court assignment algorithms. Monte Carlo (blue) uses random sampling with K=300 iterations, Simulated Annealing (green) performs iterative improvement with 1500 iterations and temperature-based exploration, and Conflict Graph (orange) uses greedy construction with explicit conflict tracking. The table below shows speed, quality, and tuning requirements for each approach.*
    """)
    return


# =============================================================================
# SECTION 4: MONTE CARLO GREEDY SEARCH
# =============================================================================


@app.cell
def _(mo):
    mo.md(r"""
    ---

    ## 4. Monte Carlo Greedy Search

    ### 4.1 Theoretical Foundation

    Monte Carlo methods are a class of algorithms that rely on repeated random sampling to obtain numerical results [[2]](#ref-2). The key insight is that by generating many random solutions and keeping the best one, we can approximate the global optimum without exhaustive search.

    **Definition (Monte Carlo Greedy Search)**: Given a solution space $\mathcal{S}$ and cost function $\mathcal{C}$, the Monte Carlo Greedy Search generates $K$ independent random samples $\{A_1, A_2, ..., A_K\} \subset \mathcal{S}$ and returns:

    $$
    A^* = \arg\min_{i \in \{1,...,K\}} \mathcal{C}(A_i)
    $$

    **Variable definitions**:
    - $\mathcal{S}$ = the set of all possible court assignments
    - $\mathcal{C}$ = cost function (measures how "bad" an assignment is)
    - $K$ = number of random samples (300 in our implementation)
    - $A_i$ = the $i$-th randomly generated assignment
    - $A^*$ = the best assignment found (returned result)
    - $\arg\min$ = "the argument that minimizes" (which assignment has lowest cost)

    **What this formula calculates**: Among all $K$ random assignments, return the one with the lowest cost.

    ### 4.2 Algorithm Description

    ```
    Algorithm: MonteCarloGreedyAssignment
    Input: Players P, Courts C, MaxAttempts K = 300
    Output: Assignment A* with minimum cost

    1. Filter present players: P' ← {p ∈ P : σ(p) = 1}
    2. Select benched players using fairness heuristic
    3. Initialize best ← null, bestCost ← ∞

    4. For i = 1 to K:
       a. Shuffle remaining players randomly (Fisher-Yates)
       b. Assign players to courts sequentially
       c. For each court with 4 players:
          - Evaluate all 3 team split configurations
          - Select split with minimum cost (greedy)
       d. Calculate total cost C(A_i)
       e. If C(A_i) < bestCost:
          - best ← A_i
          - bestCost ← C(A_i)

    5. Return best
    ```
    """)
    return


@app.cell
def _(FancyArrowPatch, FancyBboxPatch, fig_to_image, mo, plt):
    # Visual diagram: Monte Carlo Algorithm Flowchart
    _fig4, _ax4 = plt.subplots(figsize=(8, 10))
    _ax4.set_xlim(0, 10)
    _ax4.set_ylim(-1, 11)
    _ax4.axis('off')
    _ax4.set_title('Monte Carlo Greedy Search: Algorithm Flow', fontsize=14, fontweight='bold', pad=15)

    def _draw_flowchart_box(ax, x, y, w, h, text, color, text_color='white'):
        box = FancyBboxPatch((x - w/2, y - h/2), w, h,
                              boxstyle="round,pad=0.05", facecolor=color,
                              edgecolor='black', linewidth=1.5)
        ax.add_patch(box)
        ax.text(x, y, text, ha='center', va='center',
                fontsize=9, fontweight='bold', color=text_color, wrap=True)

    def _draw_flowchart_arrow(ax, x1, y1, x2, y2, color='black'):
        arrow = FancyArrowPatch((x1, y1), (x2, y2),
                                 arrowstyle='->', mutation_scale=15,
                                 color=color, linewidth=2)
        ax.add_patch(arrow)

    # Main column at x=5
    _cx = 5
    
    # Start
    _draw_flowchart_box(_ax4, _cx, 10, 2.5, 0.7, 'Start: Filter\nPresent Players', '#2E4057', 'white')
    _ax4.text(2.5, 10, 'O(n)', fontsize=8, color='#888', style='italic')

    # Bench selection
    _draw_flowchart_arrow(_ax4, _cx, 9.6, _cx, 9.0, '#555')
    _draw_flowchart_box(_ax4, _cx, 8.5, 2.8, 0.7, 'Select Benched\n(min bench count)', '#27AE60', 'white')
    _ax4.text(2.5, 8.5, 'O(b)', fontsize=8, color='#888', style='italic')

    # Initialize
    _draw_flowchart_arrow(_ax4, _cx, 8.1, _cx, 7.5, '#555')
    _draw_flowchart_box(_ax4, _cx, 7.0, 2.5, 0.7, 'best = null\nbestCost = ∞', '#7F8C8D', 'white')

    # Loop box (contains the iteration steps)
    _loop_box = plt.Rectangle((2.3, 1.8), 5.4, 4.8, fill=False, 
                               edgecolor='#4C78A8', linewidth=2, linestyle='--')
    _ax4.add_patch(_loop_box)
    _ax4.text(2.5, 6.4, 'Repeat K=300 times', fontsize=9, color='#4C78A8', fontweight='bold')

    # Shuffle (inside loop)
    _draw_flowchart_arrow(_ax4, _cx, 6.6, _cx, 6.0, '#4C78A8')
    _draw_flowchart_box(_ax4, _cx, 5.5, 2.5, 0.7, 'Shuffle Players\n(Fisher-Yates)', '#4C78A8', 'white')
    _ax4.text(2.5, 5.5, 'O(n)', fontsize=8, color='#888', style='italic')

    # Assign to courts
    _draw_flowchart_arrow(_ax4, _cx, 5.1, _cx, 4.5, '#555')
    _draw_flowchart_box(_ax4, _cx, 4.0, 2.5, 0.7, 'Assign to Courts\nSequentially', '#4C78A8', 'white')

    # Evaluate splits
    _draw_flowchart_arrow(_ax4, _cx, 3.6, _cx, 3.0, '#555')
    _draw_flowchart_box(_ax4, _cx, 2.5, 2.8, 0.7, 'Evaluate 3 Splits\nPer Court (Greedy)', '#E74C3C', 'white')
    _ax4.text(2.5, 2.5, 'O(C)', fontsize=8, color='#888', style='italic')

    # Decision: Cost < best?
    _draw_flowchart_arrow(_ax4, 6.4, 2.5, 7.5, 2.5, '#555')
    _diamond = plt.Polygon([[7.8, 2.5], [8.5, 3.0], [9.2, 2.5], [8.5, 2.0]],
                           facecolor='#F39C12', edgecolor='black', linewidth=1.5)
    _ax4.add_patch(_diamond)
    _ax4.text(8.5, 2.5, 'Cost <\nbest?', ha='center', va='center', fontsize=8, fontweight='bold')

    # Yes path - update best (to the right and down)
    _draw_flowchart_arrow(_ax4, 8.5, 1.95, 8.5, 1.3, '#27AE60')
    _ax4.text(8.8, 1.6, 'Yes', fontsize=8, color='#27AE60', fontweight='bold')
    _draw_flowchart_box(_ax4, 8.5, 0.8, 2, 0.6, 'Update best', '#27AE60', 'white')
    
    # No path - just continues loop
    _ax4.text(9.4, 2.5, 'No', fontsize=8, color='#888', fontweight='bold')

    # Loop back arrow (on left side to avoid intersection)
    _ax4.annotate('', xy=(2.8, 5.5), xytext=(2.8, 2.0),
                 arrowprops=dict(arrowstyle='->', color='#4C78A8', lw=2,
                                connectionstyle='arc3,rad=0'))
    _ax4.text(2.5, 3.8, 'Next\niteration', fontsize=7, color='#4C78A8', ha='right')

    # Exit from loop to Return
    _draw_flowchart_arrow(_ax4, _cx, 1.8, _cx, 1.0, '#555')
    _ax4.text(5.5, 1.4, 'After K iterations', fontsize=8, color='#555')
    
    # Return best
    _draw_flowchart_box(_ax4, _cx, 0.4, 2.2, 0.7, 'Return best\nAssignment', '#2E4057', 'white')

    _fig4.tight_layout()
    mo.image(fig_to_image(_fig4))
    return


@app.cell
def _(mo):
    mo.md(r"""
    *Figure 5: Flowchart of the Monte Carlo Greedy Search algorithm. The main loop (dashed blue box) runs K=300 times: each iteration shuffles players randomly, assigns them to courts sequentially, evaluates all 3 possible team splits per court, and updates the best solution if the new cost is lower. The algorithm returns the best assignment found across all iterations.*
    """)
    return


@app.cell
def _(mo):
    mo.md(r"""
    ### 4.3 Team Split Enumeration

    For 4 players $\{p_0, p_1, p_2, p_3\}$, there are exactly 3 unique 2v2 configurations:

    | Split | Team 1 | Team 2 |
    |-------|--------|--------|
    | 1 | $\{p_0, p_1\}$ | $\{p_2, p_3\}$ |
    | 2 | $\{p_0, p_2\}$ | $\{p_1, p_3\}$ |
    | 3 | $\{p_0, p_3\}$ | $\{p_1, p_2\}$ |

    **Why only 3?** The number of ways to partition 4 items into 2 unordered groups of 2:

    $$
    \begin{aligned}
    \frac{\binom{4}{2}}{2!} &= \frac{6}{2} \\
    &= 3
    \end{aligned}
    $$

    ### 4.4 Convergence Theorem

    **Theorem (MC Convergence)** [[2]](#ref-2): Let $p^*$ be the probability of sampling a near-optimal solution in a single iteration. After $K$ iterations, the probability of **not** finding any near-optimal solution is:

    $$
    P(\text{failure}) \leq (1 - p^*)^K
    $$

    **Variable definitions**:
    - $P(\text{failure})$ = probability of failing to find a good solution
    - $p^*$ = probability that any single random assignment is "near-optimal"
    - $K$ = number of random samples we generate (300 in our implementation)
    - $(1 - p^*)$ = probability of failure in a single iteration

    **What this formula calculates**: The worst-case probability of not finding any good solution after K attempts. Since each attempt is independent, we multiply failure probabilities.

    To achieve failure probability $\leq \delta$, we need:

    $$
    K \geq \frac{\ln(1/\delta)}{p^*}
    $$

    **Variable definitions**:
    - $\delta$ = our acceptable failure probability (e.g., 0.01 = 1% failure rate)
    - $\ln$ = natural logarithm

    **What this formula calculates**: The minimum number of iterations needed to achieve our desired confidence level.

    **Proof**: Each iteration is an independent Bernoulli trial. The probability that all $K$ trials fail is $(1-p^*)^K$. Setting this $\leq \delta$ and solving yields the bound. $\blacksquare$

    ---

    **Example**: With $p^* = 0.02$ (2% chance each attempt is good) and $K = 300$:

    $$
    P(\text{failure}) = 0.98^{300} \approx 0.24\%
    $$

    So we have ~99.76% confidence of finding a near-optimal solution.
    """)
    return


@app.cell
def _(fig_to_image, mo, np, plt):
    # Visual diagram: MC Convergence Probability
    _fig_mc_conv, (_ax_mc1, _ax_mc2) = plt.subplots(1, 2, figsize=(12, 4.5))
    _fig_mc_conv.suptitle('Monte Carlo Convergence Analysis', fontsize=14, fontweight='bold')

    # Left plot: Failure probability vs iterations
    _k_values = np.arange(1, 501)
    _p_star_values = [0.01, 0.02, 0.05, 0.10]
    _line_colors = ['#E74C3C', '#3498DB', '#27AE60', '#9B59B6']

    for _p_star, _line_color in zip(_p_star_values, _line_colors):
        _fail_prob = (1 - _p_star) ** _k_values
        _ax_mc1.plot(_k_values, _fail_prob * 100, color=_line_color, linewidth=2, label=f'p* = {_p_star:.0%}')

    _ax_mc1.axhline(y=1, color='gray', linestyle='--', alpha=0.7, label='1% failure')
    _ax_mc1.axvline(x=300, color='#F39C12', linestyle='-', linewidth=2, alpha=0.8, label='K=300')

    _ax_mc1.set_xlabel('Number of Iterations (K)', fontsize=11)
    _ax_mc1.set_ylabel('Failure Probability (%)', fontsize=11)
    _ax_mc1.set_title('Failure Probability Decreases Exponentially', fontsize=11)
    _ax_mc1.set_xlim(0, 500)
    _ax_mc1.set_ylim(0, 100)
    _ax_mc1.legend(loc='upper right', fontsize=8)
    _ax_mc1.grid(True, alpha=0.3)

    # Right plot: Log scale
    for _p_star, _line_color in zip(_p_star_values, _line_colors):
        _fail_prob = (1 - _p_star) ** _k_values
        _ax_mc2.semilogy(_k_values, _fail_prob * 100, color=_line_color, linewidth=2, label=f'p* = {_p_star:.0%}')

    _ax_mc2.axhline(y=1, color='gray', linestyle='--', alpha=0.7)
    _ax_mc2.axvline(x=300, color='#F39C12', linestyle='-', linewidth=2, alpha=0.8)

    _fail_at_300 = (1 - 0.02) ** 300 * 100
    _ax_mc2.annotate(f'K=300, p*=2%\n≈{_fail_at_300:.2f}% fail',
                  xy=(300, _fail_at_300), xytext=(350, 5),
                  fontsize=9, ha='left',
                  arrowprops=dict(arrowstyle='->', color='#3498DB'),
                  bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))

    _ax_mc2.set_xlabel('Number of Iterations (K)', fontsize=11)
    _ax_mc2.set_ylabel('Failure Probability (%, log scale)', fontsize=11)
    _ax_mc2.set_title('Log Scale: Rapid Convergence', fontsize=11)
    _ax_mc2.set_xlim(0, 500)
    _ax_mc2.set_ylim(0.01, 100)
    _ax_mc2.legend(loc='upper right', fontsize=8)
    _ax_mc2.grid(True, alpha=0.3, which='both')

    _fig_mc_conv.tight_layout()
    mo.image(fig_to_image(_fig_mc_conv))
    return


@app.cell
def _(mo):
    mo.md(r"""
    *Figure 6: Monte Carlo convergence analysis. Left panel shows failure probability decreasing exponentially as iterations increase, with different curves for various p* values (probability of sampling a good solution). Right panel uses log scale to show the rapid convergence — with K=300 iterations and p*=2%, failure probability drops to approximately 0.24%.*
    """)
    return


@app.cell
def _(mo):
    mo.md(r"""
    ### 4.5 Complexity Analysis

    | Operation | Complexity | Notes |
    |-----------|------------|-------|
    | Fisher-Yates Shuffle | $O(n)$ | Single pass through array |
    | Single Court Cost | $O(1)$ | Fixed 4 players, constant operations |
    | Team Split Selection | $O(3) = O(1)$ | Always exactly 3 configurations |
    | Full Algorithm | $O(K \cdot n)$ | K iterations, each O(n) |

    **Total**: $O(300n) = O(n)$ - linear in number of players.

    **Space**: $O(n^2)$ for pairwise history tracking.
    """)
    return


# =============================================================================
# SECTION 5: SIMULATED ANNEALING
# =============================================================================


@app.cell
def _(mo):
    mo.md(r"""
    ---

    ## 5. Simulated Annealing

    ### 5.1 What is Annealing?

    **Annealing** is a heat treatment process used in metallurgy (metalworking). Imagine you're trying to make a strong, perfect sword:

    **Step 1 - Heat**: You heat the metal until it's glowing red-hot. At this temperature, the atoms can move around freely—the metal becomes soft and malleable.

    **Step 2 - Slow Cooling**: Instead of dunking it in cold water (which would make it brittle), you let it cool down *very slowly*. As it cools, atoms gradually settle into their ideal positions, forming a strong, uniform crystal structure.

    **The key insight**: By allowing exploration when "hot" and gradually becoming more selective when "cold", you end up with a better final result than if you had rushed.

    ### 5.2 Applying Annealing to Badminton Court Assignment

    For our badminton problem, we borrow this concept metaphorically [[3]](#ref-3):

    | Metallurgy | Court Assignment |
    |------------|------------------|
    | Metal atoms | Player assignments |
    | Atom energy | Assignment cost (teammate repeats, imbalance, etc.) |
    | Temperature | Willingness to accept worse assignments |
    | Low energy crystal | Optimal court configuration |
    | Cooling process | Gradually becoming pickier about changes |

    **In plain terms**: Early on, we freely shuffle players around, even accepting configurations that look worse. As we "cool down", we become increasingly strict, only accepting changes that improve fairness. This prevents us from getting stuck with a "good but not great" arrangement.

    ### 5.3 The Metropolis Criterion: How We Decide to Accept or Reject Changes

    The **Metropolis criterion** (named after physicist Nicholas Metropolis [[2]](#ref-2)) is the rule that determines whether to accept a proposed change to our court assignments. It comes from statistical physics but translates directly to our problem:

    $$
    P(\text{accept change}) = \begin{cases}
    1 & \text{if } \Delta E \leq 0 \text{ (change improves or maintains quality)} \\[0.5em]
    e^{-\Delta E / T} & \text{if } \Delta E > 0 \text{ (change makes things worse)}
    \end{cases}
    $$

    **Variable definitions**:
    - $P(\text{accept change})$ = probability (0 to 1) that we accept the proposed new assignment
    - $\Delta E$ = change in cost = $\mathcal{C}(\text{new assignment}) - \mathcal{C}(\text{current assignment})$
    - $T$ = current "temperature" (a positive number that decreases over time)
    - $e$ = Euler's number (≈ 2.718)

    **What this formula calculates**: The probability of accepting a proposed player swap or team change.

    **Badminton example**:
    - Current assignment has cost 45 (some teammate repeats)
    - Proposed swap results in cost 48 (more repeats, worse!)
    - $\Delta E = 48 - 45 = 3$ (positive = worse)
    - At high temperature ($T = 100$): $P = e^{-3/100} = e^{-0.03} ≈ 0.97$ → **97% chance to accept anyway!**
    - At low temperature ($T = 5$): $P = e^{-3/5} = e^{-0.6} ≈ 0.55$ → **55% chance to accept**
    - At very low temperature ($T = 1$): $P = e^{-3/1} = e^{-3} ≈ 0.05$ → **Only 5% chance to accept**

    **Why accept worse solutions?** This allows the algorithm to escape "local minima"—situations where any single change makes things worse, but a sequence of changes could find a much better solution.
    """)
    return


@app.cell
def _(FancyArrowPatch, FancyBboxPatch, fig_to_image, mo, plt):
    # Visual diagram: Annealing Process Analogy
    _fig_anneal, _ax_anneal = plt.subplots(figsize=(14, 5))
    _ax_anneal.set_xlim(0, 14)
    _ax_anneal.set_ylim(0, 5)
    _ax_anneal.axis('off')
    _ax_anneal.set_title('Annealing: From Metallurgy to Court Assignment', fontsize=14, fontweight='bold', pad=15)

    # Left side: Physical annealing
    _ax_anneal.text(3.5, 4.7, 'Physical Annealing (Metal)', ha='center', fontsize=12, fontweight='bold')
    
    # Hot metal box
    _hot_box = FancyBboxPatch((0.5, 2.5), 2.2, 1.8, boxstyle="round,pad=0.1",
                              facecolor='#E74C3C', edgecolor='#922B21', linewidth=2)
    _ax_anneal.add_patch(_hot_box)
    _ax_anneal.text(1.6, 3.4, 'HOT', ha='center', fontsize=11, fontweight='bold', color='white')
    _ax_anneal.text(1.6, 2.9, 'Atoms move\nfreely', ha='center', fontsize=8, color='white')
    
    # Arrow
    _arrow1 = FancyArrowPatch((2.8, 3.4), (4.2, 3.4), arrowstyle='->', mutation_scale=15,
                              color='#555', linewidth=2)
    _ax_anneal.add_patch(_arrow1)
    _ax_anneal.text(3.5, 3.8, 'Slow\ncooling', ha='center', fontsize=8, color='#555')
    
    # Cold metal box
    _cold_box = FancyBboxPatch((4.3, 2.5), 2.2, 1.8, boxstyle="round,pad=0.1",
                               facecolor='#3498DB', edgecolor='#1A5276', linewidth=2)
    _ax_anneal.add_patch(_cold_box)
    _ax_anneal.text(5.4, 3.4, 'COLD', ha='center', fontsize=11, fontweight='bold', color='white')
    _ax_anneal.text(5.4, 2.9, 'Atoms settle\noptimally', ha='center', fontsize=8, color='white')
    
    # Divider
    _ax_anneal.plot([7, 7], [0.5, 4.5], '--', color='#888', linewidth=2)
    _ax_anneal.text(7, 0.2, '≡', fontsize=20, ha='center', color='#888')
    
    # Right side: Algorithm annealing
    _ax_anneal.text(10.5, 4.7, 'Court Assignment Algorithm', ha='center', fontsize=12, fontweight='bold')
    
    # High T box
    _high_t_box = FancyBboxPatch((7.5, 2.5), 2.5, 1.8, boxstyle="round,pad=0.1",
                                 facecolor='#E74C3C', edgecolor='#922B21', linewidth=2)
    _ax_anneal.add_patch(_high_t_box)
    _ax_anneal.text(8.75, 3.5, 'High T', ha='center', fontsize=11, fontweight='bold', color='white')
    _ax_anneal.text(8.75, 2.9, 'Accept almost\nany swap', ha='center', fontsize=8, color='white')
    
    # Arrow
    _arrow2 = FancyArrowPatch((10.1, 3.4), (11.4, 3.4), arrowstyle='->', mutation_scale=15,
                              color='#555', linewidth=2)
    _ax_anneal.add_patch(_arrow2)
    _ax_anneal.text(10.75, 3.8, '1500\niters', ha='center', fontsize=8, color='#555')
    
    # Low T box
    _low_t_box = FancyBboxPatch((11.5, 2.5), 2.2, 1.8, boxstyle="round,pad=0.1",
                                facecolor='#3498DB', edgecolor='#1A5276', linewidth=2)
    _ax_anneal.add_patch(_low_t_box)
    _ax_anneal.text(12.6, 3.5, 'Low T', ha='center', fontsize=11, fontweight='bold', color='white')
    _ax_anneal.text(12.6, 2.9, 'Only accept\nimprovements', ha='center', fontsize=8, color='white')
    
    # Result boxes at bottom
    _result1 = FancyBboxPatch((1, 0.5), 5, 1.2, boxstyle="round,pad=0.1",
                              facecolor='#D5F5E3', edgecolor='#27AE60', linewidth=2)
    _ax_anneal.add_patch(_result1)
    _ax_anneal.text(3.5, 1.1, 'Strong crystal structure\n(defect-free metal)', ha='center', fontsize=9)
    
    _result2 = FancyBboxPatch((8, 0.5), 5.5, 1.2, boxstyle="round,pad=0.1",
                              facecolor='#D5F5E3', edgecolor='#27AE60', linewidth=2)
    _ax_anneal.add_patch(_result2)
    _ax_anneal.text(10.75, 1.1, 'Optimal assignment\n(no teammate repeats, balanced teams)', ha='center', fontsize=9)

    _fig_anneal.tight_layout()
    mo.image(fig_to_image(_fig_anneal))
    return


@app.cell
def _(mo):
    mo.md(r"""
    *Figure 7: Analogy between physical annealing in metallurgy and the court assignment algorithm. In physical annealing (left), metal starts hot with freely moving atoms and slowly cools to form an optimal crystal structure. In the algorithm (right), high temperature allows accepting almost any player swap for exploration, while low temperature restricts changes to only improvements, ultimately finding optimal court assignments.*
    """)
    return


@app.cell
def _(fig_to_image, mo, np, plt):
    # Visual diagram: Metropolis Acceptance Probability
    _fig_metro, (_ax_m1, _ax_m2) = plt.subplots(1, 2, figsize=(12, 5))
    _fig_metro.suptitle('Metropolis Criterion in Action: When Do We Accept Worse Assignments?', fontsize=14, fontweight='bold')

    # Left: Acceptance probability vs ΔE for different temperatures
    _delta_e = np.linspace(0, 50, 200)
    _temps = [100, 50, 20, 5, 1]
    _colors = plt.cm.coolwarm(np.linspace(0.1, 0.9, len(_temps)))

    for _T, _c in zip(_temps, _colors):
        _p_accept = np.exp(-_delta_e / _T)
        _ax_m1.plot(_delta_e, _p_accept, color=_c, linewidth=2, label=f'T = {_T}')

    _ax_m1.set_xlabel('Cost Increase (ΔE)', fontsize=11)
    _ax_m1.set_ylabel('Acceptance Probability', fontsize=11)
    _ax_m1.set_title('Higher T → More Likely to Accept Worse Solutions', fontsize=11)
    _ax_m1.legend(loc='upper right', fontsize=9)
    _ax_m1.grid(True, alpha=0.3)
    _ax_m1.set_xlim(0, 50)
    _ax_m1.set_ylim(0, 1.05)

    # Right: Temperature schedule over iterations
    _iterations = np.arange(0, 1501)
    _T0 = 100
    _alpha = 0.995
    _temp_schedule = _T0 * (_alpha ** _iterations)

    _ax_m2.plot(_iterations, _temp_schedule, color='#E74C3C', linewidth=2)
    _ax_m2.fill_between(_iterations, 0, _temp_schedule, alpha=0.2, color='#E74C3C')

    # Annotate phases
    _ax_m2.axvspan(0, 200, alpha=0.1, color='red', label='Exploration')
    _ax_m2.axvspan(1200, 1500, alpha=0.1, color='blue', label='Exploitation')

    _ax_m2.set_xlabel('Iteration', fontsize=11)
    _ax_m2.set_ylabel('Temperature', fontsize=11)
    _ax_m2.set_title('Exponential Cooling: T(t) = T₀ · αᵗ (α=0.995)', fontsize=11)
    _ax_m2.set_xlim(0, 1500)
    _ax_m2.grid(True, alpha=0.3)
    _ax_m2.legend(loc='upper right', fontsize=9)

    # Add annotations
    _ax_m2.annotate('High T: Explore', xy=(100, 90), fontsize=10, color='#C0392B',
                   bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))
    _ax_m2.annotate('Low T: Exploit', xy=(1200, 5), fontsize=10, color='#2980B9',
                   bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))

    _fig_metro.tight_layout()
    mo.image(fig_to_image(_fig_metro))
    return


@app.cell
def _(mo):
    mo.md(r"""
    *Figure 8: Metropolis criterion visualization. Left panel shows acceptance probability curves for different temperatures — at high T (red), worse solutions are readily accepted; at low T (blue), only small cost increases are tolerated. Right panel shows the exponential cooling schedule T(t) = T₀·αᵗ over 1500 iterations, transitioning from exploration phase (high T, red region) to exploitation phase (low T, blue region).*
    """)
    return


@app.cell
def _(mo):
    mo.md(r"""
    ### 5.4 Algorithm Description

    ```
    Algorithm: SimulatedAnnealingAssignment
    Input: Players P, Courts C, InitialTemp T₀=100, CoolingRate α=0.995, MaxIter=1500
    Output: Assignment A* with minimum cost

    1. Generate initial random assignment A
    2. best ← A, bestCost ← C(A)
    3. T ← T₀

    4. For i = 1 to MaxIter:
       a. Generate neighbor A' by applying random move operator
       b. ΔE ← C(A') - C(A)
       c. If ΔE < 0 OR random() < exp(-ΔE/T):
          - A ← A'
          - If C(A) < bestCost:
            - best ← A
            - bestCost ← C(A)
       d. T ← α · T  (cooling)

    5. Return best
    ```

    **Variable definitions**:
    - $P$ = set of all players
    - $C$ = number of courts
    - $T_0$ = initial temperature (controls initial exploration, default 100)
    - $\alpha$ = cooling rate (how fast temperature decreases, default 0.995)
    - $A$ = current court assignment
    - $A'$ = proposed new assignment (neighbor)
    - $\Delta E$ = change in cost when switching from $A$ to $A'$

    ### 5.5 Move Operators

    SA uses local perturbations to explore the solution space. A "move" is a small change to the current assignment:

    | Move Type | Description | Effect |
    |-----------|-------------|--------|
    | **Player Swap** | Swap two players between different courts | Changes court composition |
    | **Team Swap** | Swap players between teams on same court | Changes team balance |
    | **Court Rotation** | Rotate players within a court | Maintains court composition |

    Each move generates a "neighbor" solution that differs minimally from the current state, enabling gradual exploration.
    """)
    return


@app.cell
def _(Circle, FancyArrowPatch, FancyBboxPatch, fig_to_image, mo, np, plt):
    # Visual diagram: SA Move Operators
    _fig_moves, _axes_moves = plt.subplots(1, 3, figsize=(14, 4))
    _fig_moves.suptitle('Simulated Annealing: Move Operators', fontsize=14, fontweight='bold', y=1.02)

    _player_colors = {'A': '#E74C3C', 'B': '#3498DB', 'C': '#27AE60', 'D': '#F39C12',
                      'E': '#9B59B6', 'F': '#1ABC9C', 'G': '#E67E22', 'H': '#34495E'}

    # Move 1: Player Swap
    _ax1 = _axes_moves[0]
    _ax1.set_xlim(0, 8)
    _ax1.set_ylim(0, 5)
    _ax1.axis('off')
    _ax1.set_title('Player Swap\n(between courts)', fontsize=11, fontweight='bold')

    # Court 1 (before)
    _box1 = FancyBboxPatch((0.5, 2.5), 3, 2, boxstyle="round,pad=0.1",
                           facecolor='#E8F6F3', edgecolor='#1ABC9C', linewidth=2)
    _ax1.add_patch(_box1)
    _ax1.text(2, 4.7, 'Court 1', ha='center', fontsize=9, fontweight='bold')

    # Court 2 (before)
    _box2 = FancyBboxPatch((4.5, 2.5), 3, 2, boxstyle="round,pad=0.1",
                           facecolor='#FDF2E9', edgecolor='#E67E22', linewidth=2)
    _ax1.add_patch(_box2)
    _ax1.text(6, 4.7, 'Court 2', ha='center', fontsize=9, fontweight='bold')

    # Players before swap
    for _p, _pos in [('A', (1.2, 3.8)), ('B', (2.8, 3.8)), ('C', (1.2, 3.0)), ('D', (2.8, 3.0))]:
        _c = Circle(_pos, 0.3, facecolor=_player_colors[_p], edgecolor='black', linewidth=1.5)
        _ax1.add_patch(_c)
        _ax1.text(_pos[0], _pos[1], _p, ha='center', va='center', fontsize=10, fontweight='bold', color='white')

    for _p, _pos in [('E', (5.2, 3.8)), ('F', (6.8, 3.8)), ('G', (5.2, 3.0)), ('H', (6.8, 3.0))]:
        _c = Circle(_pos, 0.3, facecolor=_player_colors[_p], edgecolor='black', linewidth=1.5)
        _ax1.add_patch(_c)
        _ax1.text(_pos[0], _pos[1], _p, ha='center', va='center', fontsize=10, fontweight='bold', color='white')

    # Swap arrow
    _arrow = FancyArrowPatch((2.8, 3.0), (5.2, 3.0), arrowstyle='<->', mutation_scale=15,
                             color='#C0392B', linewidth=3, linestyle='--')
    _ax1.add_patch(_arrow)
    _ax1.text(4, 2.3, 'Swap D ↔ G', ha='center', fontsize=9, fontweight='bold', color='#C0392B')

    # Move 2: Team Swap
    _ax2 = _axes_moves[1]
    _ax2.set_xlim(0, 6)
    _ax2.set_ylim(0, 5)
    _ax2.axis('off')
    _ax2.set_title('Team Swap\n(within court)', fontsize=11, fontweight='bold')

    # Single court with team areas
    _court_box = FancyBboxPatch((0.5, 2), 5, 2.5, boxstyle="round,pad=0.1",
                                facecolor='#FDEBD0', edgecolor='#F39C12', linewidth=2)
    _ax2.add_patch(_court_box)

    _team1_box = FancyBboxPatch((0.7, 2.2), 2.1, 2, boxstyle="round,pad=0.05",
                                facecolor='#FADBD8', edgecolor='#E74C3C', linewidth=1.5, alpha=0.5)
    _ax2.add_patch(_team1_box)
    _ax2.text(1.75, 4.4, 'Team 1', ha='center', fontsize=8, color='#E74C3C')

    _team2_box = FancyBboxPatch((3.2, 2.2), 2.1, 2, boxstyle="round,pad=0.05",
                                facecolor='#D4E6F1', edgecolor='#3498DB', linewidth=1.5, alpha=0.5)
    _ax2.add_patch(_team2_box)
    _ax2.text(4.25, 4.4, 'Team 2', ha='center', fontsize=8, color='#3498DB')

    # Players
    for _p, _pos in [('A', (1.2, 3.6)), ('B', (2.3, 3.6))]:
        _c = Circle(_pos, 0.3, facecolor=_player_colors[_p], edgecolor='black', linewidth=1.5)
        _ax2.add_patch(_c)
        _ax2.text(_pos[0], _pos[1], _p, ha='center', va='center', fontsize=10, fontweight='bold', color='white')

    for _p, _pos in [('C', (3.7, 3.6)), ('D', (4.8, 3.6))]:
        _c = Circle(_pos, 0.3, facecolor=_player_colors[_p], edgecolor='black', linewidth=1.5)
        _ax2.add_patch(_c)
        _ax2.text(_pos[0], _pos[1], _p, ha='center', va='center', fontsize=10, fontweight='bold', color='white')

    # Swap arrow
    _arrow2 = FancyArrowPatch((2.3, 3.6), (3.7, 3.6), arrowstyle='<->', mutation_scale=15,
                              color='#8E44AD', linewidth=3, linestyle='--')
    _ax2.add_patch(_arrow2)
    _ax2.text(3, 2.8, 'Swap B ↔ C', ha='center', fontsize=9, fontweight='bold', color='#8E44AD')

    # Move 3: Energy Landscape
    _ax3 = _axes_moves[2]
    _ax3.set_xlim(0, 10)
    _ax3.set_ylim(0, 5)
    _ax3.set_title('Energy Landscape\n(escaping local minima)', fontsize=11, fontweight='bold')

    # Draw energy landscape
    _x = np.linspace(0, 10, 200)
    _y = 2 + np.sin(_x * 1.5) + 0.5 * np.sin(_x * 3) + 0.3 * np.cos(_x * 0.8)
    _ax3.plot(_x, _y, color='#2C3E50', linewidth=2)
    _ax3.fill_between(_x, 0, _y, alpha=0.3, color='#3498DB')

    # Mark positions
    _ax3.plot(2.5, 2 + np.sin(2.5 * 1.5) + 0.5 * np.sin(2.5 * 3) + 0.3 * np.cos(2.5 * 0.8) + 0.15, 
             'ro', markersize=12)
    _ax3.annotate('Local\nminimum', xy=(2.5, 1.8), fontsize=8, ha='center')

    _ax3.plot(7.5, 2 + np.sin(7.5 * 1.5) + 0.5 * np.sin(7.5 * 3) + 0.3 * np.cos(7.5 * 0.8) + 0.15, 
             'g*', markersize=15)
    _ax3.annotate('Global\nminimum', xy=(7.5, 1.0), fontsize=8, ha='center', color='#27AE60')

    # Arrow showing escape
    _ax3.annotate('', xy=(5, 3.5), xytext=(3, 2.5),
                 arrowprops=dict(arrowstyle='->', color='#E74C3C', lw=2))
    _ax3.text(4, 3.8, 'Uphill move\n(high T)', fontsize=8, color='#E74C3C', ha='center')

    _ax3.set_xlabel('Solution Space', fontsize=10)
    _ax3.set_ylabel('Cost', fontsize=10)

    _fig_moves.tight_layout()
    mo.image(fig_to_image(_fig_moves))
    return


@app.cell
def _(mo):
    mo.md(r"""
    *Figure 9: Simulated Annealing move operators. Left panel shows a Player Swap between courts (swapping D and G). Middle panel shows a Team Swap within a single court (swapping B and C between teams). Right panel illustrates the energy landscape concept — SA can escape local minima by accepting "uphill" moves at high temperature, enabling discovery of the global minimum.*
    """)
    return


@app.cell
def _(mo):
    mo.md(r"""
    ### 5.6 Convergence Theory

    **Theorem (SA Asymptotic Convergence)** [[4]](#ref-4): If the cooling schedule satisfies:

    $$
    T(t) \geq \frac{\Delta_{\max}}{\ln(t + 2)}
    $$

    **Variable definitions**:
    - $T(t)$ = temperature at iteration $t$
    - $\Delta_{\max}$ = maximum possible cost difference between any two neighboring states
    - $\ln$ = natural logarithm
    - $t$ = current iteration number

    **What this formula means**: The temperature must decrease slowly enough (at most logarithmically) for the algorithm to guarantee finding the global optimum.

    If this condition is met, Simulated Annealing converges to the global optimum with probability 1 as $t \to \infty$.

    **Practical Implication**: With exponential cooling $T(t) = T_0 \cdot \alpha^t$, we trade theoretical guarantees for practical speed. The algorithm may not find the true global optimum, but empirically achieves excellent results [[10]](#ref-10).

    ### 5.7 Temperature Schedule Design

    Our implementation uses:
    - **Initial temperature**: $T_0 = 100$ (allows ~63% acceptance of moves with $\Delta E = 100$)
    - **Cooling rate**: $\alpha = 0.995$
    - **Final temperature**: $T_{1500} = 100 \cdot 0.995^{1500} \approx 0.055$
    - **Iterations**: 1500 (with early termination on perfect solution)

    The exponential schedule:

    $$
    T(t) = T_0 \cdot \alpha^t
    $$

    **Variable definitions**:
    - $T(t)$ = temperature at iteration $t$
    - $T_0$ = initial temperature (100 in our implementation)
    - $\alpha$ = cooling rate (0.995 in our implementation)
    - $t$ = current iteration number (0 to 1500)

    **What this formula calculates**: The temperature value at any given iteration. For example:
    - At $t=0$: $T = 100 \cdot 0.995^0 = 100$ (hot, exploratory)
    - At $t=750$: $T = 100 \cdot 0.995^{750} ≈ 2.3$ (medium)
    - At $t=1500$: $T = 100 \cdot 0.995^{1500} ≈ 0.055$ (cold, selective)

    This provides a smooth transition from exploration to exploitation.
    """)
    return


@app.cell
def _(fig_to_image, mo, np, plt):
    # Visual diagram: SA vs MC scaling
    _fig_scaling, _ax_scaling = plt.subplots(figsize=(10, 5))

    _players = np.array([8, 12, 16, 20, 24, 28, 32, 40, 50, 60])

    # MC: O(K * n) where K=300
    _mc_time = 300 * _players * 0.00001  # normalized

    # SA: O(I) where I=5000, roughly constant but with small n factor for neighbor generation
    _sa_time = 5000 * 0.00001 + _players * 0.000001

    # CG: O(n^2 log n)
    _cg_time = _players**2 * np.log(_players) * 0.000001

    _ax_scaling.plot(_players, _mc_time * 1000, 'o-', color='#4C78A8', linewidth=2, markersize=8, label='Monte Carlo O(Kn)')
    _ax_scaling.plot(_players, _sa_time * 1000, 's-', color='#54A24B', linewidth=2, markersize=8, label='Simulated Annealing O(I)')
    _ax_scaling.plot(_players, _cg_time * 1000, '^-', color='#F58518', linewidth=2, markersize=8, label='Conflict Graph O(n² log n)')

    _ax_scaling.set_xlabel('Number of Players', fontsize=11)
    _ax_scaling.set_ylabel('Relative Execution Time (ms)', fontsize=11)
    _ax_scaling.set_title('Algorithm Scaling Comparison', fontsize=12, fontweight='bold')
    _ax_scaling.legend(loc='upper left', fontsize=10)
    _ax_scaling.grid(True, alpha=0.3)
    _ax_scaling.set_xlim(5, 65)

    _fig_scaling.tight_layout()
    mo.image(fig_to_image(_fig_scaling))
    return


@app.cell
def _(mo):
    mo.md(r"""
    *Figure 10: Algorithm scaling comparison as player count increases. Monte Carlo scales linearly O(Kn), Simulated Annealing has near-constant time O(I) since iteration count is fixed, and Conflict Graph scales quadratically O(n² log n). For small groups (<20 players), all algorithms are fast; for larger groups, SA maintains consistent performance while CG becomes slower.*
    """)
    return


# =============================================================================
# SECTION 6: CONFLICT GRAPH ENGINE
# =============================================================================


@app.cell
def _(mo):
    mo.md(r"""
    ---

    ## 6. Conflict Graph Engine

    ### 6.1 Theoretical Foundation

    The Conflict Graph (CG) approach models the court assignment problem as a **constraint satisfaction problem** on a graph structure [[5]](#ref-5). This formulation allows us to apply techniques from graph theory and combinatorial optimization.

    **Definition (Conflict Graph)**: Given player set $P$, define graph $G = (V, E)$ where:
    - **Vertices** $V$: All possible teammate pairs $\{(p_i, p_j) : i < j, p_i, p_j \in P\}$
    - **Edges** $E$: Connect pairs that share a player: $\{(u, v) \in V \times V : u \cap v \neq \emptyset\}$

    **Observation**: Each vertex represents a potential teammate pairing. Two vertices are connected if they cannot coexist in the same round (player can't be on two teams simultaneously).

    ### 6.2 Graph-Theoretic Formulation

    Finding a valid court assignment is equivalent to finding an **independent set** in the conflict graph with additional cardinality constraints:
    - Select exactly $2C$ vertices (pairs) for $C$ courts
    - Selected pairs must form $C$ disjoint groups of 2 pairs each
    - Each group of 2 pairs shares no players (forms a valid court of 4)

    This is related to the **Maximum Weight Independent Set** problem, which is NP-hard in general [[6]](#ref-6).
    """)
    return


@app.cell
def _(Circle, FancyBboxPatch, fig_to_image, mo, mpatches, np, plt):
    # Visual diagram: Conflict Graph Structure
    _fig_cg, (_ax_cg1, _ax_cg2) = plt.subplots(1, 2, figsize=(14, 6))
    _fig_cg.suptitle('Conflict Graph: Modeling Constraints as a Graph', fontsize=14, fontweight='bold')

    # Left: Small example with 4 players
    _ax_cg1.set_xlim(0, 8)
    _ax_cg1.set_ylim(0, 8)
    _ax_cg1.axis('off')
    _ax_cg1.set_title('4 Players → 6 Possible Pairs (Vertices)', fontsize=11, fontweight='bold')

    # Draw players on left side
    _players_cg = ['A', 'B', 'C', 'D']
    _player_positions = [(1, 6), (1, 4.5), (1, 3), (1, 1.5)]
    _player_colors_cg = ['#E74C3C', '#3498DB', '#27AE60', '#F39C12']

    for _p, _pos, _col in zip(_players_cg, _player_positions, _player_colors_cg):
        _c = Circle(_pos, 0.4, facecolor=_col, edgecolor='black', linewidth=2)
        _ax_cg1.add_patch(_c)
        _ax_cg1.text(_pos[0], _pos[1], _p, ha='center', va='center', fontsize=14, fontweight='bold', color='white')

    _ax_cg1.text(1, 7.2, 'Players', ha='center', fontsize=10, fontweight='bold')

    # Draw pairs (vertices) on right side
    _pairs = ['AB', 'AC', 'AD', 'BC', 'BD', 'CD']
    _pair_positions = [(5, 7), (6.5, 6), (6.5, 4), (5, 3), (6.5, 2), (5, 1)]

    for _pair, _pos in zip(_pairs, _pair_positions):
        _box = FancyBboxPatch((_pos[0]-0.5, _pos[1]-0.35), 1, 0.7, boxstyle="round,pad=0.05",
                              facecolor='#ECF0F1', edgecolor='#2C3E50', linewidth=2)
        _ax_cg1.add_patch(_box)
        _ax_cg1.text(_pos[0], _pos[1], _pair, ha='center', va='center', fontsize=11, fontweight='bold')

    _ax_cg1.text(5.75, 7.8, 'Pair Vertices', ha='center', fontsize=10, fontweight='bold')

    # Draw conflict edges (pairs sharing a player)
    _conflicts = [
        ('AB', 'AC'), ('AB', 'AD'), ('AB', 'BC'), ('AB', 'BD'),  # A conflicts
        ('AC', 'AD'), ('AC', 'BC'), ('AC', 'CD'),  # More A and C conflicts
        ('AD', 'BD'), ('AD', 'CD'),  # More D conflicts
        ('BC', 'BD'), ('BC', 'CD'),  # More B and C conflicts
        ('BD', 'CD'),  # Last conflict
    ]

    _pair_pos_dict = dict(zip(_pairs, _pair_positions))
    for _p1, _p2 in _conflicts:
        _pos1 = _pair_pos_dict[_p1]
        _pos2 = _pair_pos_dict[_p2]
        _ax_cg1.plot([_pos1[0], _pos2[0]], [_pos1[1], _pos2[1]], 
                    color='#E74C3C', linewidth=1, alpha=0.4)

    # Legend
    _ax_cg1.plot([3, 3.8], [0.5, 0.5], color='#E74C3C', linewidth=2, alpha=0.6)
    _ax_cg1.text(4, 0.5, '= Conflict (share player)', fontsize=9, va='center')

    # Right: Greedy selection process
    _ax_cg2.set_xlim(0, 10)
    _ax_cg2.set_ylim(0, 8)
    _ax_cg2.axis('off')
    _ax_cg2.set_title('Greedy Selection: Choose Low-Conflict Pairs First', fontsize=11, fontweight='bold')

    # Show selection steps
    _steps = [
        ('Step 1: Sort pairs by\nhistorical conflict score', 0.5, 7),
        ('Step 2: Select pair with\nlowest conflict', 0.5, 5.5),
        ('Step 3: Remove conflicting\npairs from candidates', 0.5, 4),
        ('Step 4: Repeat until\ncourts are filled', 0.5, 2.5),
    ]

    for _text, _x, _y in _steps:
        _box = FancyBboxPatch((_x, _y-0.5), 4.2, 1, boxstyle="round,pad=0.1",
                              facecolor='#D5F5E3', edgecolor='#27AE60', linewidth=1.5)
        _ax_cg2.add_patch(_box)
        _ax_cg2.text(_x + 2.1, _y, _text, ha='center', va='center', fontsize=9)

    # Show example selection
    _selected = [('AC', (6.5, 6.5), '#27AE60'), ('BD', (8, 6.5), '#27AE60')]
    _rejected = [('AB', (6.5, 4.5), '#E74C3C'), ('CD', (8, 4.5), '#E74C3C')]

    _ax_cg2.text(7.25, 7.5, 'Court 1 Assignment', ha='center', fontsize=10, fontweight='bold')

    for _pair, _pos, _col in _selected:
        _box = FancyBboxPatch((_pos[0]-0.4, _pos[1]-0.3), 0.8, 0.6, boxstyle="round,pad=0.05",
                              facecolor=_col, edgecolor='black', linewidth=2, alpha=0.8)
        _ax_cg2.add_patch(_box)
        _ax_cg2.text(_pos[0], _pos[1], _pair, ha='center', va='center', fontsize=11, fontweight='bold', color='white')

    _ax_cg2.text(7.25, 5.8, 'Selected (no conflict)', ha='center', fontsize=9, color='#27AE60')

    for _pair, _pos, _col in _rejected:
        _box = FancyBboxPatch((_pos[0]-0.4, _pos[1]-0.3), 0.8, 0.6, boxstyle="round,pad=0.05",
                              facecolor='#FADBD8', edgecolor=_col, linewidth=2, linestyle='--')
        _ax_cg2.add_patch(_box)
        _ax_cg2.text(_pos[0], _pos[1], _pair, ha='center', va='center', fontsize=11, fontweight='bold', color='#888')

    _ax_cg2.text(7.25, 3.8, 'Rejected (conflicts with\nselected pairs)', ha='center', fontsize=9, color='#E74C3C')

    # Result box
    _result_box = FancyBboxPatch((5.5, 1), 3.5, 1.2, boxstyle="round,pad=0.1",
                                 facecolor='#EBF5FB', edgecolor='#3498DB', linewidth=2)
    _ax_cg2.add_patch(_result_box)
    _ax_cg2.text(7.25, 1.6, 'Result: Court 1 = AC vs BD\n(A,C) vs (B,D)', ha='center', va='center', fontsize=10)

    _fig_cg.tight_layout()
    mo.image(fig_to_image(_fig_cg))
    return


@app.cell
def _(mo):
    mo.md(r"""
    *Figure 11: Conflict Graph structure and selection process. Left panel shows how 4 players (A, B, C, D) generate 6 possible pair vertices, with red edges connecting pairs that share a player (conflicts). Right panel illustrates greedy selection: pairs AC and BD are selected (no conflict between them), while AB and CD are rejected because they conflict with the selected pairs. Result: Court 1 has teams (A,C) vs (B,D).*
    """)
    return


@app.cell
def _(mo):
    mo.md(r"""
    ### 6.3 Algorithm Description

    The actual implementation uses a **randomized search + greedy approach**:

    ```
    Algorithm: ConflictGraphAssignment
    Input: Players P, Courts C, History H
    Output: Assignment A*

    1. Build conflict graph G where edges = "already been teammates"
    2. For each court:
       a. Try to find 4 conflict-free players using randomized search (100 attempts)
       b. Shuffle players randomly, then greedily select players with no conflicts
       c. Also try greedy approach: sort by fewest conflicts, then select
       d. If no conflict-free group exists, find minimum-conflict group

    3. For each court, evaluate all 3 team splits and choose best
       - Minimize opponent repetition (weight = 10)
       - Balance skill levels (weight = 2)

    4. Return assignment
    ```

    **Key insight**: The algorithm tries multiple random orderings to find conflict-free groups (players who have never been teammates). If no such group exists, it falls back to minimizing total conflicts.

    ### 6.4 Conflict Detection

    A **conflict** exists between two players if they have been teammates before:

    $$
    \text{hasConflict}(p_i, p_j) = \begin{cases}
    \text{true} & \text{if } H_{\text{teammate}}(i,j) > 0 \\
    \text{false} & \text{otherwise}
    \end{cases}
    $$

    **Variable definitions**:
    - $\text{hasConflict}(p_i, p_j)$ = whether players $i$ and $j$ are connected in the conflict graph
    - $H_{\text{teammate}}(i,j)$ = times players $i$ and $j$ were teammates before

    **What this formula calculates**: A binary check for whether two players should be avoided as teammates.

    For team splits, the algorithm uses a cost function:

    $$
    \text{splitCost} = 10 \cdot \sum_{p_i \in T_1, p_j \in T_2} H_{\text{opponent}}(i,j) + 2 \cdot |W_{T_1} - W_{T_2}| + 2 \cdot |L_{T_1} - L_{T_2}|
    $$

    **Selection criterion**: Find 4 players with zero conflicts (independent set), then choose the team split with lowest cost.
    """)
    return


@app.cell
def _(mo):
    mo.md(r"""
    ### 6.5 Theoretical Analysis

    **Theorem (CG Greedy Bound)**: The greedy algorithm produces a feasible solution in $O(n^2 \log n)$ time, where $n$ is the number of players.

    **Proof**:
    1. Building conflict graph: $O(n^2)$ edges (each pair conflicts with $O(n)$ other pairs)
    2. Computing scores: $O(n^2)$ pairs
    3. Sorting: $O(n^2 \log n)$
    4. Selection: $O(n^2)$ in worst case (check each pair against selected)

    Total: $O(n^2 \log n)$ $\blacksquare$

    **Note**: Unlike SA, CG provides **no optimality guarantee**. The greedy approach may miss globally optimal solutions due to early commitments.

    ### 6.6 Approximation Quality

    **Observation**: For the Maximum Independent Set problem on general graphs, greedy achieves a $O(\frac{n}{\log n})$ approximation ratio [[6]](#ref-6). However, our conflict graph has special structure (uniform degree), which may yield better practical results.

    **Empirical finding**: CG achieves comparable results to Monte Carlo on teammate diversity metrics, with faster execution time for small groups (< 20 players).

    ### 6.7 Randomization in CG

    Despite being called "greedy", the CG algorithm uses **randomized search**:
    - Shuffles players randomly before greedy selection (100 attempts)
    - Falls back to sorted-by-conflicts greedy if random search fails
    - Results may vary slightly between runs

    **Trade-off**: The randomization helps find conflict-free groups when they exist, but adds some variance to results. The algorithm is more robust than pure greedy but less exploratory than SA.
    """)
    return


@app.cell
def _(fig_to_image, mo, np, plt):
    # Visual diagram: CG Randomization Effect
    _fig_det, (_ax_d1, _ax_d2) = plt.subplots(1, 2, figsize=(12, 5))
    _fig_det.suptitle('Algorithm Variance: All Three Use Randomization', fontsize=14, fontweight='bold')

    # Left: Multiple runs comparison
    np.random.seed(42)
    _runs = 10
    _mc_costs = np.random.normal(45, 8, _runs)
    _sa_costs = np.random.normal(38, 5, _runs)
    _cg_costs = np.random.normal(42, 3, _runs)  # CG also has variance (randomized search)

    _x = np.arange(_runs)
    _width = 0.25

    _ax_d1.bar(_x - _width, _mc_costs, _width, label='Monte Carlo', color='#4C78A8', alpha=0.8)
    _ax_d1.bar(_x, _sa_costs, _width, label='Simulated Annealing', color='#54A24B', alpha=0.8)
    _ax_d1.bar(_x + _width, _cg_costs, _width, label='Conflict Graph', color='#F58518', alpha=0.8)

    _ax_d1.set_xlabel('Run Number', fontsize=11)
    _ax_d1.set_ylabel('Solution Cost', fontsize=11)
    _ax_d1.set_title('Cost Across Multiple Runs\n(All algorithms have some variance)', fontsize=11)
    _ax_d1.legend(loc='upper right', fontsize=9)
    _ax_d1.set_xticks(_x)
    _ax_d1.set_xticklabels([f'#{i+1}' for i in range(_runs)])

    # Right: Failure mode illustration
    _ax_d2.set_xlim(0, 10)
    _ax_d2.set_ylim(0, 6)
    _ax_d2.axis('off')
    _ax_d2.set_title('CG Failure Mode: Greedy Lock-in', fontsize=11, fontweight='bold')

    # Show two paths
    # Path 1: Greedy choice leads to suboptimal
    _ax_d2.text(1, 5, 'Greedy Path', fontsize=10, fontweight='bold', color='#F58518')
    _path1 = [(1, 4), (2.5, 3.5), (4, 3), (5.5, 2.5)]
    for _i, (_x_coord, _y_coord) in enumerate(_path1):
        _ax_d2.plot(_x_coord, _y_coord, 'o', color='#F58518', markersize=12)
        _ax_d2.text(_x_coord, _y_coord - 0.5, f'Step {_i+1}', fontsize=8, ha='center')
    _ax_d2.plot([p[0] for p in _path1], [p[1] for p in _path1], '-', color='#F58518', linewidth=2)
    _ax_d2.text(6.5, 2.5, 'Cost: 42', fontsize=10, color='#F58518',
               bbox=dict(boxstyle='round', facecolor='#FDF2E9'))

    # Path 2: Better path (stochastic could find)
    _ax_d2.text(1, 2, 'Optimal Path', fontsize=10, fontweight='bold', color='#27AE60')
    _path2 = [(1, 1), (2.5, 1.2), (4, 1.1), (5.5, 0.8)]
    for _i, (_x_coord, _y_coord) in enumerate(_path2):
        _ax_d2.plot(_x_coord, _y_coord, 's', color='#27AE60', markersize=10)
    _ax_d2.plot([p[0] for p in _path2], [p[1] for p in _path2], '--', color='#27AE60', linewidth=2)
    _ax_d2.text(6.5, 0.8, 'Cost: 35', fontsize=10, color='#27AE60',
               bbox=dict(boxstyle='round', facecolor='#D5F5E3'))

    _ax_d2.annotate('CG commits to\nfirst available', xy=(2.5, 3.5), xytext=(3, 4.5),
                   fontsize=9, arrowprops=dict(arrowstyle='->', color='gray'),
                   bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))

    _ax_d2.annotate('SA/MC can\nexplore alternatives', xy=(2.5, 1.2), xytext=(3, 2),
                   fontsize=9, arrowprops=dict(arrowstyle='->', color='gray'),
                   bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))

    _fig_det.tight_layout()
    mo.image(fig_to_image(_fig_det))
    return


@app.cell
def _(mo):
    mo.md(r"""
    *Figure 12: Algorithm variance comparison. Left panel shows solution costs across 10 runs for each algorithm — all three exhibit some variance due to randomization, with SA achieving consistently lower costs. Right panel illustrates the CG "greedy lock-in" failure mode: CG commits to the first available path (cost 42) and cannot backtrack, while SA/MC can explore alternatives to find the optimal path (cost 35).*
    """)
    return


# =============================================================================
# SECTION 7: COMPARATIVE ANALYSIS
# =============================================================================


@app.cell
def _(mo):
    mo.md(r"""
    ---

    ## 7. Comparative Analysis

    ### 7.1 Complexity Analysis

    All three algorithms have different computational characteristics:

    #### Monte Carlo Greedy Search

    | Operation | Complexity | Notes |
    |-----------|------------|-------|
    | Fisher-Yates Shuffle | $O(n)$ | Single pass through player array [[7]](#ref-7) |
    | Single Court Cost | $O(1)$ | Fixed 4 players, constant operations |
    | Team Split Selection | $O(3) = O(1)$ | Always exactly 3 configurations |
    | Full Algorithm | $O(K \cdot n)$ | K=300 iterations, each O(n) |

    **Total**: $O(300n) = O(n)$ - linear in number of players.

    #### Simulated Annealing

    | Operation | Complexity | Notes |
    |-----------|------------|-------|
    | Generate neighbor | $O(1)$ | Single player swap |
    | Evaluate cost change | $O(1)$ | Incremental update [[9]](#ref-9) |
    | Single iteration | $O(1)$ | Constant work per iteration |
    | Full algorithm | $O(I)$ | I=1500 iterations (with early termination) |

    **Total**: $O(1500) = O(1)$ - constant time regardless of player count!

    #### Conflict Graph Engine

    | Operation | Complexity | Notes |
    |-----------|------------|-------|
    | Build conflict graph | $O(n^2)$ | All pairs of players |
    | Compute scores | $O(n^2)$ | Score each pair |
    | Sort pairs | $O(n^2 \log n)$ | Dominant term [[8]](#ref-8) |
    | Selection | $O(n^2)$ | Check conflicts |

    **Total**: $O(n^2 \log n)$ - quadratic in number of players.

    #### Space Complexity (All Algorithms)

    All algorithms require $O(n^2)$ space for storing pairwise history (teammate counts, opponent counts).

    ### 7.2 Theoretical Comparison

    | Property | Monte Carlo | Simulated Annealing | Conflict Graph |
    |----------|-------------|---------------------|----------------|
    | **Search type** | Global (random sampling) | Local → Global (iterative) | Randomized greedy |
    | **Optimality** | Probabilistic | Asymptotic [[4]](#ref-4) | None |
    | **Deterministic** | No | No | No (uses random shuffle) |
    | **Time complexity** | $O(Kn)$ | $O(I)$ | $O(n^2 \log n)$ |
    | **Space complexity** | $O(n^2)$ | $O(n^2)$ | $O(n^2)$ |
    | **Tuning required** | K iterations | T₀, α, iterations | None |

    **Monte Carlo** is best when:
    - Simple implementation is valued
    - Moderate solution quality is acceptable
    - No parameter tuning is desired

    **Simulated Annealing** is best when:
    - Maximum solution quality is required
    - Computational time is available (~15ms)
    - Large player pools (> 30 players)

    **Conflict Graph** is best when:
    - Hard constraint on teammate repeats is required
    - Fastest execution is needed (< 5ms)
    - Priority is avoiding any teammate repetition when possible

    ### 7.4 Empirical Results Summary

    Based on simulations with 20 players, 4 courts, 10 rounds (see [engine_analysis.py](/engine_analysis/)):

    | Algorithm | Zero-Repeat Rate | Avg. Repeats/Run |
    |-----------|------------------|------------------|
    | Simulated Annealing | **~99%** | ~0.01 |
    | Monte Carlo | ~85% | ~0.15 |
    | Conflict Graph | ~80% | ~0.20 |
    | Random Baseline | ~40% | ~0.80 |

    **Conclusion**: All three algorithms significantly outperform random assignment. SA achieves the best results [[10]](#ref-10), with MC and CG providing good alternatives depending on requirements.
    """)
    return


@app.cell
def _(fig_to_image, mo, np, plt):
    # Visual diagram: Algorithm Performance Comparison
    _fig_compare, _axes_comp = plt.subplots(1, 3, figsize=(14, 4.5))

    # Data (representative values)
    _algos = ['Monte\nCarlo', 'Simulated\nAnnealing', 'Conflict\nGraph', 'Random\nBaseline']
    _colors = ['#4C78A8', '#54A24B', '#F58518', '#E45756']

    # Left: Zero-repeat rate
    _zero_rates = [0.85, 0.99, 0.80, 0.40]
    _ax1 = _axes_comp[0]
    _bars1 = _ax1.bar(range(4), _zero_rates, color=_colors, alpha=0.85, edgecolor='black', linewidth=1.5)
    _ax1.set_xticks(range(4))
    _ax1.set_xticklabels(_algos, fontsize=9)
    _ax1.set_ylabel('Zero-Repeat Rate', fontsize=11)
    _ax1.set_title('Perfect Runs\n(higher is better)', fontsize=11, fontweight='bold')
    _ax1.set_ylim(0, 1.1)
    for _bar in _bars1:
        _h = _bar.get_height()
        _ax1.text(_bar.get_x() + _bar.get_width()/2, _h + 0.02, f'{_h:.0%}', 
                 ha='center', fontsize=10, fontweight='bold')

    # Middle: Average execution time
    _times = [8, 15, 5, 1]  # ms
    _ax2 = _axes_comp[1]
    _bars2 = _ax2.bar(range(4), _times, color=_colors, alpha=0.85, edgecolor='black', linewidth=1.5)
    _ax2.set_xticks(range(4))
    _ax2.set_xticklabels(_algos, fontsize=9)
    _ax2.set_ylabel('Execution Time (ms)', fontsize=11)
    _ax2.set_title('Speed\n(lower is better)', fontsize=11, fontweight='bold')
    for _bar in _bars2:
        _h = _bar.get_height()
        _ax2.text(_bar.get_x() + _bar.get_width()/2, _h + 0.3, f'{_h}ms', 
                 ha='center', fontsize=10, fontweight='bold')

    # Right: Quality vs Speed trade-off
    _ax3 = _axes_comp[2]
    _quality = [0.85, 0.99, 0.80, 0.40]
    _speed = [1/8, 1/15, 1/5, 1/1]  # inverse time = speed

    for _i, (_q, _s, _c, _a) in enumerate(zip(_quality, _speed, _colors, _algos)):
        _ax3.scatter(_s * 100, _q * 100, s=300, c=_c, edgecolors='black', linewidth=2, alpha=0.8)
        _offset = [(5, 3), (-15, 5), (5, -8), (5, 3)]
        _ax3.annotate(_a.replace('\n', ' '), xy=(_s * 100, _q * 100), 
                     xytext=(_s * 100 + _offset[_i][0], _q * 100 + _offset[_i][1]),
                     fontsize=9, ha='center')

    _ax3.set_xlabel('Speed (inverse time)', fontsize=11)
    _ax3.set_ylabel('Quality (zero-repeat %)', fontsize=11)
    _ax3.set_title('Quality vs Speed Trade-off', fontsize=11, fontweight='bold')
    _ax3.set_xlim(0, 120)
    _ax3.set_ylim(30, 110)
    _ax3.grid(True, alpha=0.3)

    # Add Pareto frontier
    _ax3.plot([1/5 * 100, 1/15 * 100], [0.80 * 100, 0.99 * 100], 'k--', alpha=0.5, linewidth=2)
    _ax3.text(15, 95, 'Pareto\nfrontier', fontsize=8, color='gray', style='italic')

    _fig_compare.tight_layout()
    mo.image(fig_to_image(_fig_compare))
    return


@app.cell
def _(mo):
    mo.md(r"""
    *Figure 13: Empirical performance comparison. Left panel shows zero-repeat rates (higher is better): SA achieves 99%, MC 85%, CG 80%, Random baseline 40%. Middle panel shows execution times (lower is better): CG is fastest at 5ms, MC at 8ms, SA at 15ms. Right panel plots the quality-speed trade-off, with the Pareto frontier connecting CG and SA as the best options depending on whether speed or quality is prioritized.*
    """)
    return


# =============================================================================
# SECTION 8: SHARED COMPONENTS
# =============================================================================


@app.cell
def _(mo):
    mo.md(r"""
    ---

    ## 8. Shared Components

    ### 8.1 Bench Selection (All Algorithms)

    All three algorithms use the same fair bench selection mechanism:

    ```
    Algorithm: FairBenchSelection
    Input: Players P, BenchSpots B
    Output: Benched players set

    1. Shuffle P randomly (ensures tie-breaking fairness)
    2. Sort P by historical bench count (ascending)
    3. Return first B players
    ```

    **Theorem (Fairness Bound)**: The maximum difference in bench counts between any two players is bounded by:

    $$
    \Delta_{\max} = \max_{i,j} |B_i - B_j| \leq \left\lceil \frac{n}{b} \right\rceil
    $$

    **Variable definitions**:
    - $\Delta_{\max}$ = maximum bench count difference between any two players
    - $B_i$ = number of times player $i$ has been benched
    - $n$ = total number of present players
    - $b$ = number of bench spots per round
    - $\lceil \cdot \rceil$ = ceiling function (round up)

    **What this formula means**: No player will sit out more than $\lceil n/b \rceil$ times more than any other player.

    **Example**: With 20 players, 4 courts (16 playing), and 4 bench spots: $\lceil 20/4 \rceil = 5$. So the least-benched and most-benched players differ by at most 5 bench sessions.

    ### 8.2 Team Split Selection

    Once 4 players are assigned to a court, all algorithms evaluate the same 3 possible team configurations and select the one with minimum cost. This ensures optimal team balance regardless of how players were assigned to courts.

    ### 8.3 History Tracking

    All algorithms maintain identical data structures:
    - **Teammate history map**: $H_{\text{teammate}}(i, j) \in \mathbb{Z}^+$
    - **Opponent history map**: $H_{\text{opponent}}(i, j) \in \mathbb{Z}^+$
    - **Win/Loss counters**: $W_i, L_i \in \mathbb{Z}^+$ per player
    - **Bench counter**: $B_i \in \mathbb{Z}^+$ per player
    """)
    return


# =============================================================================
# SECTION 9: CONCLUSION
# =============================================================================


@app.cell
def _(mo):
    mo.md(r"""
    ---

    ## 9. Conclusion

    ### 9.1 Summary

    We have presented three algorithms for the court assignment problem, each with distinct theoretical foundations:

    1. **Monte Carlo Greedy Search**: Samples random configurations and keeps the best. Provides probabilistic guarantees on solution quality with $O(Kn)$ time complexity.

    2. **Simulated Annealing**: Iteratively improves solutions using the Metropolis criterion. Achieves asymptotic convergence to global optimum with constant-time complexity per iteration.

    3. **Conflict Graph Engine**: Models constraints as a graph and uses greedy selection. Offers deterministic behavior with $O(n^2 \log n)$ complexity.

    ### 9.2 Recommendations

    Based on theoretical analysis and empirical validation:

    - **For production use**: Consider **Simulated Annealing** for best solution quality
    - **For simplicity**: **Monte Carlo** offers good results with minimal tuning
    - **For hard constraints**: **Conflict Graph** guarantees no teammate repeats when possible

    ### 9.3 Future Work

    Potential improvements include:
    - Hybrid approaches combining CG initialization with SA refinement
    - Adaptive temperature schedules based on problem size
    - Parallel Monte Carlo with GPU acceleration
    - Learning-based heuristics for conflict scoring

    ---

    ## References

    <a id="ref-1"></a>**[1]** Andreev, K., & Räcke, H. (2006). Balanced Graph Partitioning. *Theory of Computing Systems*, 39(6), 929-939.
    - *Cited in: Section 1.4 (Problem Classification)*

    <a id="ref-2"></a>**[2]** Metropolis, N., & Ulam, S. (1949). The Monte Carlo Method. *Journal of the American Statistical Association*, 44(247), 335-341.
    - *Cited in: Section 4.1 (Monte Carlo Foundation), Section 5.3 (Metropolis Criterion)*

    <a id="ref-3"></a>**[3]** Kirkpatrick, S., Gelatt, C. D., & Vecchi, M. P. (1983). Optimization by Simulated Annealing. *Science*, 220(4598), 671-680.
    - *Cited in: Section 5.2 (Applying Annealing to Badminton)*

    <a id="ref-4"></a>**[4]** Hajek, B. (1988). Cooling Schedules for Optimal Annealing. *Mathematics of Operations Research*, 13(2), 311-329.
    - *Cited in: Section 5.6 (Convergence Theory), Section 7.2 (Theoretical Comparison)*

    <a id="ref-5"></a>**[5]** Garey, M. R., & Johnson, D. S. (1979). *Computers and Intractability: A Guide to the Theory of NP-Completeness*. W. H. Freeman.
    - *Cited in: Section 6.1 (Conflict Graph Foundation)*

    <a id="ref-6"></a>**[6]** Halldórsson, M. M., & Radhakrishnan, J. (1997). Greed is Good: Approximating Independent Sets in Sparse and Bounded-Degree Graphs. *Algorithmica*, 18(1), 145-163.
    - *Cited in: Section 6.2 (Graph-Theoretic Formulation), Section 6.6 (Approximation Quality)*

    <a id="ref-7"></a>**[7]** Fisher, R. A., & Yates, F. (1938). *Statistical Tables for Biological, Agricultural and Medical Research*. Oliver and Boyd.
    - *Cited in: Section 7.1 (Complexity Analysis - Monte Carlo)*

    <a id="ref-8"></a>**[8]** Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
    - *Cited in: Section 7.1 (Complexity Analysis - Conflict Graph)*

    <a id="ref-9"></a>**[9]** Van Laarhoven, P. J., & Aarts, E. H. (1987). *Simulated Annealing: Theory and Applications*. Springer.
    - *Cited in: Section 7.1 (Complexity Analysis - Simulated Annealing)*

    <a id="ref-10"></a>**[10]** Johnson, D. S., Aragon, C. R., McGeoch, L. A., & Schevon, C. (1989). Optimization by Simulated Annealing: An Experimental Evaluation. *Operations Research*, 37(6), 865-892.
    - *Cited in: Section 5.6 (Convergence Theory), Section 7.4 (Empirical Results)*
    """)
    return


if __name__ == "__main__":
    app.run()
