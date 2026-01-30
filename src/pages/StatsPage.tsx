import React, { useState, useEffect } from 'react';
import { CourtAssignmentEngine } from '../utils/CourtAssignmentEngine';
import type { CourtEngineState } from '../types';
import './StatsPage.css';

function StatsPage(): React.ReactElement {
  const [engineState, setEngineState] = useState<CourtEngineState | null>(null);

  useEffect(() => {
    CourtAssignmentEngine.loadState();
    setEngineState(CourtAssignmentEngine.prepareStateForSaving());

    const unsubscribe = CourtAssignmentEngine.onStateChange(() => {
      setEngineState(CourtAssignmentEngine.prepareStateForSaving());
    });

    return unsubscribe;
  }, []);

  const basePath = import.meta.env.BASE_URL || '/';

  // Calculate summary statistics
  const getStats = () => {
    if (!engineState) return null;

    const players = Object.keys(engineState.winCountMap || {});
    const totalRounds = Object.values(engineState.teammateCountMap || {}).reduce((a, b) => a + b, 0) / 2;
    const totalMatches = Object.values(engineState.winCountMap || {}).reduce((a, b) => a + b, 0);
    const uniquePairs = Object.keys(engineState.teammateCountMap || {}).length;

    return {
      playerCount: players.length,
      totalRounds: Math.round(totalRounds),
      totalMatches,
      uniquePairs,
    };
  };

  const stats = getStats();
  const hasData = stats && stats.playerCount > 0;

  return (
    <div className="stats-page">
      <div className="stats-container">
        <header className="stats-header">
          <a href={basePath} className="back-link" data-testid="back-to-app">
            ← Back to App
          </a>
          <h1>📊 Statistics & Analysis</h1>
          <p className="stats-subtitle">
            Explore the algorithms and view your session statistics
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

        <section className="session-stats">
          <h2>🎮 Current Session</h2>
          {hasData ? (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.playerCount}</div>
                <div className="stat-label">Players Tracked</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.totalMatches}</div>
                <div className="stat-label">Total Matches</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.uniquePairs}</div>
                <div className="stat-label">Unique Pairings</div>
              </div>
            </div>
          ) : (
            <div className="no-data">
              <p>No session data yet. Start playing to see your statistics!</p>
              <a href={basePath} className="start-link">
                Start a Game →
              </a>
            </div>
          )}

          {hasData && (
            <div className="detailed-stats">
              <h3>Player Win/Loss Records</h3>
              <div className="player-table-wrapper">
                <table className="player-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Wins</th>
                      <th>Losses</th>
                      <th>Benched</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(engineState?.winCountMap || {})
                      .sort((a, b) => {
                        const winsA = engineState?.winCountMap?.[a] || 0;
                        const winsB = engineState?.winCountMap?.[b] || 0;
                        return winsB - winsA;
                      })
                      .map((playerId) => (
                        <tr key={playerId}>
                          <td>{playerId}</td>
                          <td className="wins">{engineState?.winCountMap?.[playerId] || 0}</td>
                          <td className="losses">{engineState?.lossCountMap?.[playerId] || 0}</td>
                          <td className="benched">{engineState?.benchCountMap?.[playerId] || 0}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
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
