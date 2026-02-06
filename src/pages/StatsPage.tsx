import React, { useState, useEffect } from 'react';

import { CourtAssignmentEngine } from '../utils/CourtAssignmentEngine';
import { loadAppState } from '../utils/storageUtils';
import TeammateGraph from '../components/TeammateGraph';
import SinglesGraph from '../components/SinglesGraph';
import BenchGraph from '../components/BenchGraph';
import PairsGraph from '../components/PairsGraph';
import type { CourtEngineState, Player } from '../types';
import './StatsPage.css';

/**
 * Diagnostic statistics for the current session.
 * Provides insights into algorithm fairness and player distribution.
 */
interface DiagnosticStats {
  totalPlayers: number;
  totalRounds: number;
  /** Number of players benched exactly once */
  benchedOnce: number;
  /** Number of players benched more than once */
  benchedMultiple: number;
  /** Number of players never benched */
  neverBenched: number;
  /** Maximum bench count among all players */
  maxBenchCount: number;
  /** Minimum bench count among all players */
  minBenchCount: number;
  /** Standard deviation of bench counts. Lower is better (0 = perfectly fair) */
  benchFairnessScore: number;
  /** Top 10 pairs who have teamed up more than once */
  repeatedTeammates: Array<{ pair: string; count: number }>;
  /** Top 10 pairs who have faced each other more than once */
  repeatedOpponents: Array<{ pair: string; count: number }>;
  /** Players who have played singles matches, sorted by count */
  singlesPlayers: Array<{ player: string; count: number }>;
  /** Number of players who played singles more than once */
  playersWithMultipleSingles: number;
  /** Context-aware warnings about algorithm fairness */
  warnings: string[];
}

function StatsPage(): React.ReactElement {
  const [engineState, setEngineState] = useState<CourtEngineState | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    CourtAssignmentEngine.loadState();
    setEngineState(CourtAssignmentEngine.prepareStateForSaving());

    const appState = loadAppState();
    if (appState.players) {
      setPlayers(appState.players);
    }

    const unsubscribe = CourtAssignmentEngine.onStateChange(() => {
      setEngineState(CourtAssignmentEngine.prepareStateForSaving());
    });

    return unsubscribe;
  }, []);

  const basePath = import.meta.env.BASE_URL || '/';

  /**
   * Resolves a player ID to their display name.
   * @param playerId - The unique identifier for the player
   * @returns The player's name, or the ID if not found
   */
  const getPlayerName = (playerId: string): string => {
    const player = players.find(p => p.id === playerId);
    return player?.name || playerId;
  };

  /**
   * Formats a pair key (e.g., "id1|id2") using player names.
   * @param pairKey - The pipe-separated pair of player IDs
   * @param separator - The separator to use between names (e.g., " & " or " vs ")
   * @returns Formatted string with player names
   */
  const formatPair = (pairKey: string, separator: string): string => {
    const [id1, id2] = pairKey.split('|');
    return `${getPlayerName(id1)}${separator}${getPlayerName(id2)}`;
  };

  /**
   * Returns the CSS class for fairness score styling.
   * @param score - The fairness score (standard deviation of bench counts)
   * @returns CSS class name: 'good' (<1), 'neutral' (<2), or 'warning'
   */
  const getFairnessClass = (score: number): string => {
    if (score < 1) return 'good';
    if (score < 2) return 'neutral';
    return 'warning';
  };

  /**
   * Returns the CSS class for bench count chip styling.
   * @param count - The number of times a player has been benched
   * @returns CSS class name based on severity: 'low', 'medium', 'medium-high', or 'high'
   */
  const getChipClass = (count: number): string => {
    if (count >= 4) return 'high';
    if (count === 3) return 'medium-high';
    if (count === 2) return 'medium';
    return 'low';
  };

  /**
   * Computes comprehensive diagnostic statistics from the engine state.
   * Analyzes bench distribution, teammate/opponent repetitions, singles matches,
   * and generates context-aware warnings when fairness thresholds are exceeded.
   * @returns DiagnosticStats object or null if no data available
   */
  const getDiagnostics = (): DiagnosticStats | null => {
    if (!engineState) return null;

    const benchMap = engineState.benchCountMap || {};
    const teammateMap = engineState.teammateCountMap || {};
    const opponentMap = engineState.opponentCountMap || {};
    const singleMap = engineState.singleCountMap || {};
    const winMap = engineState.winCountMap || {};
    const lossMap = engineState.lossCountMap || {};

    const playersFromTeammates = new Set<string>();
    Object.keys(teammateMap).forEach(pair => {
      const [id1, id2] = pair.split('|');
      playersFromTeammates.add(id1);
      playersFromTeammates.add(id2);
    });

    const allPlayers = new Set([
      ...playersFromTeammates,
      ...Object.keys(benchMap),
      ...Object.keys(winMap),
      ...Object.keys(lossMap),
      ...Object.keys(singleMap),
    ]);

    const totalPlayers = allPlayers.size;
    if (totalPlayers === 0) return null;

    const totalTeammatePairingsRecorded = Object.values(teammateMap).reduce((a, b) => a + b, 0);
    const totalSinglesMatches = Object.values(singleMap).reduce((a, b) => a + b, 0) / 2;
    const totalDoublesMatches = totalTeammatePairingsRecorded / 2;

    const maxBenchFromData = Object.values(benchMap).length > 0 ? Math.max(...Object.values(benchMap)) : 0;
    const totalMatchesEstimate = totalDoublesMatches + totalSinglesMatches;

    const playersPerRound = Math.max(4, totalPlayers - 1);
    const matchesPerRound = Math.max(1, Math.floor(playersPerRound / 4) + (playersPerRound % 4 >= 2 ? 1 : 0));
    const roundsFromMatches = matchesPerRound > 0 ? Math.ceil(totalMatchesEstimate / matchesPerRound) : 0;
    const totalRounds = Math.max(maxBenchFromData, roundsFromMatches, 1);

    const benchCounts = Object.values(benchMap);
    const benchedOnce = benchCounts.filter(c => c === 1).length;
    const benchedMultiple = benchCounts.filter(c => c > 1).length;
    const neverBenched = totalPlayers - Object.keys(benchMap).length;
    const maxBenchCount = benchCounts.length > 0 ? Math.max(...benchCounts) : 0;
    const minBenchCount = benchCounts.length > 0 ? Math.min(...benchCounts) : 0;

    const avgBench = benchCounts.length > 0
      ? benchCounts.reduce((a, b) => a + b, 0) / benchCounts.length
      : 0;
    const benchVariance = benchCounts.length > 0
      ? benchCounts.reduce((sum, c) => sum + Math.pow(c - avgBench, 2), 0) / benchCounts.length
      : 0;
    const benchFairnessScore = Math.round(Math.sqrt(benchVariance) * 100) / 100;

    const repeatedTeammates = Object.entries(teammateMap)
      .filter(([, count]) => count > 1)
      .map(([pair, count]) => ({ pair: formatPair(pair, ' & '), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const repeatedOpponents = Object.entries(opponentMap)
      .filter(([, count]) => count > 1)
      .map(([pair, count]) => ({ pair: formatPair(pair, ' vs '), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const singlesPlayers = Object.entries(singleMap)
      .map(([playerId, count]) => ({ player: getPlayerName(playerId), count }))
      .sort((a, b) => b.count - a.count);
    const playersWithMultipleSingles = singlesPlayers.filter(p => p.count > 1).length;

    const warnings: string[] = [];
    const possiblePairs = totalPlayers > 1 ? (totalPlayers * (totalPlayers - 1)) / 2 : 1;

    const actualTeammatePairings = Object.values(teammateMap).reduce((a, b) => a + b, 0);
    const expectedTeammateAvg = possiblePairs > 0 ? actualTeammatePairings / possiblePairs : 0;

    const actualOpponentPairings = Object.values(opponentMap).reduce((a, b) => a + b, 0);
    const expectedOpponentAvg = possiblePairs > 0 ? actualOpponentPairings / possiblePairs : 0;

    const totalSinglesPlayed = Object.values(singleMap).reduce((a, b) => a + b, 0);
    const expectedSinglesPerPlayer = totalPlayers > 0 ? totalSinglesPlayed / totalPlayers : 0;

    const expectedBenchSpread = Math.ceil(Math.sqrt(totalRounds)) + 1;
    if (maxBenchCount - minBenchCount > expectedBenchSpread + 2) {
      warnings.push(`Bench imbalance: spread of ${maxBenchCount - minBenchCount} (expected ~${expectedBenchSpread} for ${totalRounds} rounds)`);
    }

    const maxSingles = singlesPlayers.length > 0 ? singlesPlayers[0].count : 0;
    if (maxSingles > expectedSinglesPerPlayer + 1.5 && totalSinglesPlayed > 0) {
      const overPlayedSingles = singlesPlayers.filter(p => p.count > expectedSinglesPerPlayer + 1);
      if (overPlayedSingles.length > 0) {
        warnings.push(`${overPlayedSingles.length} player(s) played singles ${Math.round(expectedSinglesPerPlayer + 1.5)}+ times (expected ~${expectedSinglesPerPlayer.toFixed(1)} each)`);
      }
    }

    const maxTeammateRepeat = repeatedTeammates.length > 0 ? repeatedTeammates[0].count : 0;
    const teammateWarningThreshold = Math.max(4, Math.ceil(expectedTeammateAvg * 2), Math.ceil(expectedTeammateAvg) + 3);
    const highRepeatTeammates = repeatedTeammates.filter(t => t.count >= teammateWarningThreshold);
    if (highRepeatTeammates.length > 0 && maxTeammateRepeat >= teammateWarningThreshold) {
      warnings.push(`${highRepeatTeammates.length} pair(s) teamed up ${teammateWarningThreshold}+ times (avg is ${expectedTeammateAvg.toFixed(1)})`);
    }

    const maxOpponentRepeat = repeatedOpponents.length > 0 ? repeatedOpponents[0].count : 0;
    const opponentWarningThreshold = Math.max(4, Math.ceil(expectedOpponentAvg * 2), Math.ceil(expectedOpponentAvg) + 3);
    const highRepeatOpponents = repeatedOpponents.filter(o => o.count >= opponentWarningThreshold);
    if (highRepeatOpponents.length > 0 && maxOpponentRepeat >= opponentWarningThreshold) {
      warnings.push(`${highRepeatOpponents.length} pair(s) faced each other ${opponentWarningThreshold}+ times (avg is ${expectedOpponentAvg.toFixed(1)})`);
    }

    return {
      totalPlayers,
      totalRounds,
      benchedOnce,
      benchedMultiple,
      neverBenched,
      maxBenchCount,
      minBenchCount,
      benchFairnessScore,
      repeatedTeammates,
      repeatedOpponents,
      singlesPlayers,
      playersWithMultipleSingles,
      warnings,
    };
  };

  const diagnostics = getDiagnostics();
  const hasData = diagnostics !== null;

  /** Raw bench data sorted by count for the distribution table */
  const benchData = engineState?.benchCountMap
    ? Object.entries(engineState.benchCountMap)
        .map(([playerId, count]) => ({ player: getPlayerName(playerId), count }))
        .sort((a, b) => b.count - a.count)
    : [];

  return (
    <div className="stats-page">
      <div className="stats-container">
        <header className="stats-header">
          <a href={basePath} className="back-link" data-testid="back-to-app">
            ← Back to App
          </a>
          <h1>Engine Diagnostics</h1>
          <p className="stats-subtitle">
            Monitor algorithm behavior and detect unusual patterns
          </p>
        </header>

        <section className="notebook-links">
          <h2>📓 Analysis Notebooks</h2>
          <div className="notebooks-grid">
            <a
              href={`${basePath}algorithm`}
              className="notebook-card"
              data-testid="algorithm-link"
            >
              <div className="notebook-icon">📐</div>
              <div className="notebook-content">
                <h3>Algorithm Documentation</h3>
                <p>
                  Mathematical foundations and proofs for Monte Carlo, Simulated Annealing,
                  and Conflict Graph algorithms with convergence analysis.
                </p>
              </div>
              <span className="notebook-arrow">→</span>
            </a>

            <a
              href={`${basePath}analysis`}
              className="notebook-card"
              data-testid="analysis-link"
            >
              <div className="notebook-icon">⚙️</div>
              <div className="notebook-content">
                <h3>Engine Comparison</h3>
                <p>
                  Comprehensive comparison of court assignment engines including
                  performance benchmarks, fairness metrics, and quality analysis.
                </p>
              </div>
              <span className="notebook-arrow">→</span>
            </a>
          </div>
        </section>

        {/* Warnings Section */}
        {hasData && diagnostics.warnings.length > 0 && (
          <section className="warnings-section">
            <h2>⚠️ Warnings</h2>
            <div className="warnings-list">
              {diagnostics.warnings.map((warning, idx) => (
                <div key={idx} className="warning-item">
                  {warning}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="session-stats">
          <h2>🔍 Current Session Diagnostics</h2>
          {hasData ? (
            <>
              {/* Overview Stats */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{diagnostics.totalPlayers}</div>
                  <div className="stat-label">Total Players</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{diagnostics.totalRounds}</div>
                  <div className="stat-label">Rounds Played</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{diagnostics.repeatedTeammates.length}</div>
                  <div className="stat-label">Repeated Pairs</div>
                </div>
                <div className="stat-card highlight-warning" data-warning={diagnostics.warnings.length > 0}>
                  <div className="stat-value">{diagnostics.warnings.length}</div>
                  <div className="stat-label">Warnings</div>
                </div>
              </div>

              {/* Bench Distribution */}
              <div className="diagnostic-section">
                <h3>🪑 Bench Distribution</h3>
                <div className="bench-summary">
                  <div className="bench-stat">
                    <span className="bench-label">Never benched:</span>
                    <span className="bench-value good">{diagnostics.neverBenched}</span>
                  </div>
                  <div className="bench-stat">
                    <span className="bench-label">Benched once:</span>
                    <span className="bench-value neutral">{diagnostics.benchedOnce}</span>
                  </div>
                  <div className="bench-stat">
                    <span className="bench-label">Benched multiple times:</span>
                    <span className="bench-value warning">{diagnostics.benchedMultiple}</span>
                  </div>
                  <div className="bench-stat">
                    <span className="bench-label">Min/Max bench count:</span>
                    <span className="bench-value">{diagnostics.minBenchCount} / {diagnostics.maxBenchCount}</span>
                  </div>
                  <div className="bench-stat">
                    <span className="bench-label">Fairness score:</span>
                    <span className={`bench-value ${getFairnessClass(diagnostics.benchFairnessScore)}`}>
                      {diagnostics.benchFairnessScore} <small>(lower is better)</small>
                    </span>
                  </div>
                </div>

                {benchData.length > 0 && (
                  <details className="collapsible-section">
                    <summary>View bench counts per player ({benchData.length})</summary>
                    <div style={{ padding: '16px' }}>
                      <BenchGraph
                        benchData={engineState?.benchCountMap || {}}
                        getPlayerName={getPlayerName}
                      />
                      <div className="player-chips" style={{ marginTop: '16px' }}>
                        {benchData.map(({ player, count }) => (
                          <span key={player} className={`chip ${getChipClass(count)}`}>
                            {player}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  </details>
                )}
              </div>

              {/* Repeated Teammates */}
              <div className="diagnostic-section">
                <h3>👥 Teammate Connections</h3>
                {Object.keys(engineState?.teammateCountMap || {}).length > 0 ? (
                  <>
                    <TeammateGraph
                      teammateData={engineState?.teammateCountMap || {}}
                      getPlayerName={getPlayerName}
                    />
                    {diagnostics.repeatedTeammates.length > 0 && (
                      <details className="collapsible-section">
                        <summary>View repeated pairs ({diagnostics.repeatedTeammates.length})</summary>
                        <div style={{ padding: '16px' }}>
                          <PairsGraph pairsData={diagnostics.repeatedTeammates} />
                        </div>
                      </details>
                    )}
                  </>
                ) : (
                  <p className="no-issues">✓ No teammate pairings recorded yet</p>
                )}
              </div>

              {/* Repeated Opponents */}
              <div className="diagnostic-section">
                <h3>⚔️ Opponent Matchups</h3>
                {Object.keys(engineState?.opponentCountMap || {}).length > 0 ? (
                  <>
                    <TeammateGraph
                      teammateData={engineState?.opponentCountMap || {}}
                      getPlayerName={getPlayerName}
                      variant="opponent"
                    />
                    {diagnostics.repeatedOpponents.length > 0 && (
                      <details className="collapsible-section">
                        <summary>View repeated matchups ({diagnostics.repeatedOpponents.length})</summary>
                        <div style={{ padding: '16px' }}>
                          <PairsGraph pairsData={diagnostics.repeatedOpponents} />
                        </div>
                      </details>
                    )}
                  </>
                ) : (
                  <p className="no-issues">✓ No opponent matchups recorded yet</p>
                )}
              </div>

              {/* Singles Distribution */}
              <div className="diagnostic-section">
                <h3>🎯 Singles Matches</h3>
                {Object.keys(engineState?.singleCountMap || {}).length > 0 ? (
                  <>
                    <div className="singles-summary">
                      <span>{diagnostics.singlesPlayers.length} players have played singles</span>
                      {diagnostics.playersWithMultipleSingles > 0 && (
                        <span className="warning-text">
                          ({diagnostics.playersWithMultipleSingles} with multiple)
                        </span>
                      )}
                    </div>
                    <SinglesGraph
                      singlesData={engineState?.singleCountMap || {}}
                      getPlayerName={getPlayerName}
                    />
                    <details className="collapsible-section">
                      <summary>View singles list ({diagnostics.singlesPlayers.length})</summary>
                      <div className="player-chips">
                        {diagnostics.singlesPlayers.map(({ player, count }) => (
                          <span key={player} className={`chip ${count > 1 ? 'warning' : 'neutral'}`}>
                            {player}: {count}
                          </span>
                        ))}
                      </div>
                    </details>
                  </>
                ) : (
                  <p className="no-issues">No singles matches recorded</p>
                )}
              </div>
            </>
          ) : (
            <div className="no-data">
              <p>No session data yet. Start playing to see diagnostics!</p>
              <a href={basePath} className="start-link">
                Start a Game →
              </a>
            </div>
          )}
        </section>

        <footer className="stats-footer">
          <p>
            Have feedback? Found a bug or want to suggest a feature?
            {' '}
            <a
              href="https://github.com/sylhare/Badminton/issues/new/choose"
              target="_blank"
              rel="noopener noreferrer"
            >
              Let us know on GitHub
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}

export default StatsPage;
