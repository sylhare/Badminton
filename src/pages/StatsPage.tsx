import React, { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';

import { useAppState } from '../providers/AppStateProvider';
import TeammateGraph from '../components/graphs/TeammateGraph';
import SinglesGraph from '../components/graphs/SinglesGraph';
import BenchGraph from '../components/graphs/BenchGraph';
import PairsGraph from '../components/graphs/PairsGraph';
import LevelHistoryGraph from '../components/graphs/LevelHistoryGraph';
import Footer from '../components/Footer';
import { useTranslation } from '../i18n';
import type { Translate } from '../i18n';

import { computeDiagnostics, getChipClass, getFairnessClass, hasEntries } from './statsDiagnostics';
import type { DiagnosticWarning } from './statsDiagnostics';
import './StatsPage.css';

const analysisUrl = 'https://github.com/sylhare/Badminton/tree/main/analysis';

/** Phrase a diagnostic warning in the active language. */
function formatWarning(warning: DiagnosticWarning, t: Translate): string {
  switch (warning.code) {
    case 'benchImbalance':
      return t('stats.warnBenchImbalance', {
        spread: warning.spread,
        expected: warning.expected,
        rounds: warning.rounds,
      });
    case 'singlesOverplay':
      return t('stats.warnSingles', {
        count: warning.count,
        threshold: warning.threshold,
        expected: warning.expected,
      });
    case 'repeatedPairs':
      return t('stats.warnPairs', {
        count: warning.count,
        label: warning.relation === 'teamedUp'
          ? t('stats.labelTeamedUp')
          : t('stats.labelFacedEachOther'),
        threshold: warning.threshold,
        avg: warning.average,
      });
  }
}

function StatsPage(): React.ReactElement {
  const {
    players, isSmartEngineEnabled: isSmartEngine, engineState, engineName,
    engineDescription, engineDescriptionKey, engineDescriptionParams,
  } = useAppState();
  const { t } = useTranslation();

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
    (playerId: string) => playerNameMap.get(playerId) || t('common.removedPlayer'),
    [playerNameMap, t],
  );

  const description = engineDescriptionKey
    ? t(engineDescriptionKey, engineDescriptionParams)
    : engineDescription;

  return (
    <div className="stats-page">
      <nav className="stats-banner" data-testid="stats-banner">
        <Link to="/" className="stats-banner-link" data-testid="back-to-app">
          {t('stats.backToApp')}
        </Link>
      </nav>
      <div className="stats-container">
        <header className="stats-header">
          <h1>{t('stats.title', { engine: engineName })}</h1>
          <p className="stats-subtitle">
            {description}
          </p>
        </header>

        {/* Warnings Section */}
        {hasData && diagnostics.warnings.length > 0 && (
          <section className="warnings-section">
            <h2>{t('stats.warnings')}</h2>
            <div className="warnings-list">
              {diagnostics.warnings.map((warning, idx) => (
                <div key={idx} className="warning-item">
                  {formatWarning(warning, t)}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="session-stats">
          <h2>{t('stats.currentSession')}</h2>
          {hasData ? (
            <>
              {/* Overview Stats */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{diagnostics.totalPlayers}</div>
                  <div className="stat-label">{t('stats.totalPlayers')}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{diagnostics.totalRounds}</div>
                  <div className="stat-label">{t('stats.roundsPlayed')}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{diagnostics.repeatedTeammates.length}</div>
                  <div className="stat-label">{t('stats.repeatedPairs')}</div>
                </div>
                <div className="stat-card highlight-warning" data-warning={diagnostics.warnings.length > 0}>
                  <div className="stat-value">{diagnostics.warnings.length}</div>
                  <div className="stat-label">{t('stats.warningsLabel')}</div>
                </div>
              </div>

              {/* Bench Distribution */}
              <div className="diagnostic-section">
                <h3>{t('stats.benchDistribution')}</h3>
                <div className="bench-summary">
                  <div className="bench-stat">
                    <span className="bench-label">{t('stats.neverBenched')}</span>
                    <span className="bench-value good">{diagnostics.neverBenched}</span>
                  </div>
                  <div className="bench-stat">
                    <span className="bench-label">{t('stats.benchedOnce')}</span>
                    <span className="bench-value neutral">{diagnostics.benchedOnce}</span>
                  </div>
                  <div className="bench-stat">
                    <span className="bench-label">{t('stats.benchedMultiple')}</span>
                    <span className="bench-value warning">{diagnostics.benchedMultiple}</span>
                  </div>
                  <div className="bench-stat">
                    <span className="bench-label">{t('stats.minMaxBench')}</span>
                    <span className="bench-value">{diagnostics.minBenchCount} / {diagnostics.maxBenchCount}</span>
                  </div>
                  <div className="bench-stat">
                    <span className="bench-label">{t('stats.fairnessScore')}</span>
                    <span className={`bench-value ${getFairnessClass(diagnostics.benchFairnessScore)}`}>
                      {diagnostics.benchFairnessScore} <small>{t('stats.lowerIsBetter')}</small>
                    </span>
                  </div>
                </div>

                {diagnostics.benchPlayers.length > 0 && (
                  <details className="collapsible-section">
                    <summary>
                      {t('stats.viewBenchCounts', { count: diagnostics.benchPlayers.length })}
                    </summary>
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
                <h3>{t('stats.teammateConnections')}</h3>
                {hasEntries(teammateCountMap) ? (
                  <>
                    <TeammateGraph
                      teammateData={teammateCountMap}
                      getPlayerName={resolvePlayerName}
                      playerGender={isSmartEngine ? playerGenderMap : undefined}
                    />
                    {diagnostics.repeatedTeammates.length > 0 && (
                      <details className="collapsible-section">
                        <summary>
                          {t('stats.viewRepeatedPairs', { count: diagnostics.repeatedTeammates.length })}
                        </summary>
                        <div style={{ padding: '16px' }}>
                          <PairsGraph pairsData={diagnostics.repeatedTeammates} />
                        </div>
                      </details>
                    )}
                  </>
                ) : (
                  <p className="no-issues">{t('stats.noTeammatePairings')}</p>
                )}
              </div>

              {/* Repeated Opponents */}
              <div className="diagnostic-section">
                <h3>{t('stats.opponentMatchups')}</h3>
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
                        <summary>
                          {t('stats.viewRepeatedMatchups', { count: diagnostics.repeatedOpponents.length })}
                        </summary>
                        <div style={{ padding: '16px' }}>
                          <PairsGraph pairsData={diagnostics.repeatedOpponents} />
                        </div>
                      </details>
                    )}
                  </>
                ) : (
                  <p className="no-issues">{t('stats.noOpponentMatchups')}</p>
                )}
              </div>

              {/* Singles Distribution */}
              <div className="diagnostic-section">
                <h3>{t('stats.singlesMatches')}</h3>
                {hasEntries(singleCountMap) ? (
                  <>
                    <div className="singles-summary">
                      <span>{t('stats.singlesSummary', { count: diagnostics.singlesPlayers.length })}</span>
                      {diagnostics.playersWithMultipleSingles > 0 && (
                        <span className="warning-text">
                          {t('stats.singlesWithMultiple', { count: diagnostics.playersWithMultipleSingles })}
                        </span>
                      )}
                    </div>
                    <SinglesGraph
                      singlesData={singleCountMap}
                      getPlayerName={resolvePlayerName}
                    />
                    <details className="collapsible-section">
                      <summary>{t('stats.viewSinglesList', { count: diagnostics.singlesPlayers.length })}</summary>
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
                  <p className="no-issues">{t('stats.noSingles')}</p>
                )}
              </div>
              {/* Level Progression - Smart Engine only */}
              {isSmartEngine && hasEntries(levelHistory) && (
                <div className="diagnostic-section">
                  <h3>{t('stats.levelProgression')}</h3>
                  <LevelHistoryGraph
                    levelHistory={levelHistory}
                    getPlayerName={resolvePlayerName}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="no-data">
              <p>{t('stats.noData')}</p>
              <Link to="/" className="start-link">
                {t('stats.startGame')}
              </Link>
            </div>
          )}
        </section>

        <section className="analysis-links">
          <h2>{t('stats.githubAnalysis')}</h2>
          <div className="analysis-grid">
            <a
              href={analysisUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="analysis-card"
              data-testid="analysis-link"
            >
              <div className="analysis-icon">📊</div>
              <div className="analysis-content">
                <h3>{t('stats.exploreAnalysis')}</h3>
                <p>
                  {t('stats.analysisBody')}
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
