import React, { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';

import { useAppState } from '../providers/AppStateProvider';
import TeammateGraph from '../components/graphs/TeammateGraph';
import SinglesGraph from '../components/graphs/SinglesGraph';
import BenchGraph from '../components/graphs/BenchGraph';
import PairsGraph from '../components/graphs/PairsGraph';
import LevelHistoryGraph from '../components/graphs/LevelHistoryGraph';
import Footer from '../components/Footer';

import { computeDiagnostics, getChipClass, getFairnessClass, getPlayerName, hasEntries } from './statsDiagnostics';
import './StatsPage.css';

function StatsPage(): React.ReactElement {
  const { players, isSmartEngineEnabled: isSmartEngine, engineState, engineName, engineDescription } = useAppState();

  const basePath = '/';

  const playerGenderMap = useMemo(
    () => Object.fromEntries(players.filter(p => p.gender).map(p => [p.id, p.gender!])),
    [players],
  );

  const diagnostics = useMemo(() => computeDiagnostics(engineState, players), [engineState, players]);
  const hasData = diagnostics !== null;

  const resolvePlayerName = useCallback((playerId: string) => getPlayerName(players, playerId), [players]);

  const benchData = useMemo(() => (
    engineState?.benchCountMap && hasEntries(engineState.benchCountMap)
      ? Object.entries(engineState.benchCountMap)
        .map(([playerId, count]) => ({ player: resolvePlayerName(playerId), count }))
        .sort((a, b) => b.count - a.count)
      : []
  ), [engineState?.benchCountMap, resolvePlayerName]);

  return (
    <div className="stats-page">
      <nav className="stats-banner" data-testid="stats-banner">
        <Link to="/" className="stats-banner-link" data-testid="back-to-app">
          ← Court Manager
        </Link>
      </nav>
      <div className="stats-container">
        <header className="stats-header">
          <h1>{engineName} Diagnostics</h1>
          <p className="stats-subtitle">
            {engineDescription}
          </p>
        </header>

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
                        getPlayerName={resolvePlayerName}
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
                {engineState?.teammateCountMap && hasEntries(engineState.teammateCountMap) ? (
                  <>
                    <TeammateGraph
                      teammateData={engineState.teammateCountMap}
                      getPlayerName={resolvePlayerName}
                      playerGender={isSmartEngine ? playerGenderMap : undefined}
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
                {engineState?.opponentCountMap && hasEntries(engineState.opponentCountMap) ? (
                  <>
                    <TeammateGraph
                      teammateData={engineState.opponentCountMap}
                      getPlayerName={resolvePlayerName}
                      variant="opponent"
                      playerGender={isSmartEngine ? playerGenderMap : undefined}
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
                {engineState?.singleCountMap && hasEntries(engineState.singleCountMap) ? (
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
                      singlesData={engineState.singleCountMap}
                      getPlayerName={resolvePlayerName}
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
              {/* Level Progression - Smart Engine only */}
              {isSmartEngine && engineState?.levelHistory && Object.keys(engineState.levelHistory).length > 0 && (
                <div className="diagnostic-section">
                  <h3>📈 Level Progression</h3>
                  <LevelHistoryGraph
                    levelHistory={engineState.levelHistory}
                    getPlayerName={resolvePlayerName}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="no-data">
              <p>No session data yet. Start playing to see diagnostics!</p>
              <Link to="/" className="start-link">
                Start a Game →
              </Link>
            </div>
          )}
        </section>

        <section className="notebook-links">
          <h2>📓 Analysis Notebooks</h2>
          <div className="notebooks-grid">
            <Link
              to={`${basePath}algorithm`}
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
            </Link>

            <Link
              to={`${basePath}engine`}
              className="notebook-card"
              data-testid="engine-link"
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
            </Link>

            <Link
              to={`${basePath}level-tracker`}
              className="notebook-card"
              data-testid="level-tracker-link"
            >
              <div className="notebook-icon">📊</div>
              <div className="notebook-content">
                <h3>Level Tracker Analysis</h3>
                <p>
                  Elo-style rating system simulation with K-factor curves, team balance
                  factors, and level progression visualizations.
                </p>
              </div>
              <span className="notebook-arrow">→</span>
            </Link>
          </div>
        </section>

        <Footer showStatsLink={false} />
      </div>
    </div>
  );
}

export default StatsPage;
