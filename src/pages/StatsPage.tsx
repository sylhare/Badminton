import React, { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';

import { useAppState } from '../providers/AppStateProvider';
import TeammateGraph from '../components/graphs/TeammateGraph';
import SinglesGraph from '../components/graphs/SinglesGraph';
import BenchGraph from '../components/graphs/BenchGraph';
import PairsGraph from '../components/graphs/PairsGraph';
import LevelHistoryGraph from '../components/graphs/LevelHistoryGraph';
import Footer from '../components/Footer';

import { computeDiagnostics, getChipClass, getFairnessClass, hasEntries } from './statsDiagnostics';
import './StatsPage.css';

const analysisUrl = 'https://github.com/sylhare/Badminton/tree/main/analysis';

function StatsPage(): React.ReactElement {
  const { players, isSmartEngineEnabled: isSmartEngine, engineState, engineName, engineDescription } = useAppState();

  const {
    benchCountMap = {},
    teammateCountMap = {},
    opponentCountMap = {},
    singleCountMap = {},
    levelHistory = {},
  } = engineState ?? {};

  const playerGenderMap = useMemo(
    () => Object.fromEntries(players.flatMap(p => (p.gender ? [[p.id, p.gender]] : []))),
    [players],
  );

  const diagnostics = useMemo(() => computeDiagnostics(engineState, players), [engineState, players]);
  const hasData = diagnostics !== null;

  const playerNameMap = useMemo(() => new Map(players.map(p => [p.id, p.name])), [players]);
  const resolvePlayerName = useCallback(
    (playerId: string) => playerNameMap.get(playerId) || 'removed',
    [playerNameMap],
  );

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

                {diagnostics.benchPlayers.length > 0 && (
                  <details className="collapsible-section">
                    <summary>View bench counts per player ({diagnostics.benchPlayers.length})</summary>
                    <div style={{ padding: '16px' }}>
                      <BenchGraph
                        benchData={benchCountMap}
                        getPlayerName={resolvePlayerName}
                      />
                      <div className="player-chips" style={{ marginTop: '16px' }}>
                        {diagnostics.benchPlayers.map(({ player, count }) => (
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
                {hasEntries(teammateCountMap) ? (
                  <>
                    <TeammateGraph
                      teammateData={teammateCountMap}
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
                {hasEntries(opponentCountMap) ? (
                  <>
                    <TeammateGraph
                      teammateData={opponentCountMap}
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
                {hasEntries(singleCountMap) ? (
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
                      singlesData={singleCountMap}
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
              {isSmartEngine && hasEntries(levelHistory) && (
                <div className="diagnostic-section">
                  <h3>📈 Level Progression</h3>
                  <LevelHistoryGraph
                    levelHistory={levelHistory}
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

        <section className="analysis-links">
          <h2>📊 GitHub Analysis</h2>
          <div className="analysis-grid">
            <a
              href={analysisUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="analysis-card"
              data-testid="algorithm-link"
            >
              <div className="analysis-icon">📐</div>
              <div className="analysis-content">
                <h3>Algorithm Documentation</h3>
                <p>
                  Mathematical foundations and proofs for Monte Carlo, Simulated Annealing,
                  and Conflict Graph algorithms with convergence analysis.
                </p>
              </div>
              <span className="analysis-arrow">→</span>
            </a>

            <a
              href={analysisUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="analysis-card"
              data-testid="engine-link"
            >
              <div className="analysis-icon">⚙️</div>
              <div className="analysis-content">
                <h3>Engine Comparison</h3>
                <p>
                  Comprehensive comparison of court assignment engines including
                  performance benchmarks, fairness metrics, and quality analysis.
                </p>
              </div>
              <span className="analysis-arrow">→</span>
            </a>

            <a
              href={analysisUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="analysis-card"
              data-testid="level-tracker-link"
            >
              <div className="analysis-icon">📊</div>
              <div className="analysis-content">
                <h3>Level Tracker Analysis</h3>
                <p>
                  Elo-style rating system simulation with K-factor curves, team balance
                  factors, and level progression visualizations.
                </p>
              </div>
              <span className="analysis-arrow">→</span>
            </a>
          </div>
        </section>

        <Footer showStatsLink={false} />
      </div>
    </div>
  );
}

export default StatsPage;
