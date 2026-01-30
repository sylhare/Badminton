import React, { useState, useEffect } from 'react';
import './AnalysisPage.css';

interface NotebookInfo {
  id: string;
  title: string;
  description: string;
  filename: string;
  icon: string;
}

const NOTEBOOKS: NotebookInfo[] = [
  {
    id: 'analysis',
    title: 'Court Assignment Repeat Analysis',
    description: 'Compares three algorithms (Old, Random, New) for player pairing. Analyzes how often players get paired with the same teammate across multiple rounds to ensure fair rotation.',
    filename: 'analysis.html',
    icon: '📊',
  },
  {
    id: 'algorithm_docs',
    title: 'Algorithm Mathematical Foundations',
    description: 'Mathematical proofs and foundations for the court assignment algorithms. Covers Monte Carlo Greedy Search, Simulated Annealing, and Conflict Graph Engine approaches with convergence analysis.',
    filename: 'algorithm_docs.html',
    icon: '📐',
  },
  {
    id: 'bench_analysis',
    title: 'Bench Analysis',
    description: 'Analyzes how players rotate on and off the bench when there are more players than court spots. Studies fairness in sitting-out patterns across different player counts.',
    filename: 'bench_analysis.html',
    icon: '🪑',
  },
  {
    id: 'engine_analysis',
    title: 'Engine Comparison',
    description: 'Comprehensive comparison of four court assignment engines: Monte Carlo, Simulated Annealing, Conflict Graph, and baseline. Includes performance benchmarks and quality metrics.',
    filename: 'engine_analysis.html',
    icon: '⚙️',
  },
];

function AnalysisPage(): React.ReactElement {
  const [availableNotebooks, setAvailableNotebooks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkNotebookAvailability = async () => {
      const available = new Set<string>();

      await Promise.all(
        NOTEBOOKS.map(async (notebook) => {
          try {
            const basePath = import.meta.env.BASE_URL || '/';
            const response = await fetch(`${basePath}analysis/${notebook.filename}`, { method: 'HEAD' });
            if (response.ok) {
              available.add(notebook.id);
            }
          } catch {
            // File not available
          }
        }),
      );

      setAvailableNotebooks(available);
      setLoading(false);
    };

    checkNotebookAvailability();
  }, []);

  const getNotebookUrl = (filename: string): string => {
    const basePath = import.meta.env.BASE_URL || '/';
    return `${basePath}analysis/${filename}`;
  };

  return (
    <div className="analysis-page">
      <div className="analysis-container">
        <header className="analysis-header">
          <a href={import.meta.env.BASE_URL || '/'} className="back-link" data-testid="back-to-app">
            ← Back to App
          </a>
          <h1>📓 Analysis Notebooks</h1>
          <p className="analysis-subtitle">
            Deep-dive into the algorithms and statistics behind the court assignment system.
            These interactive notebooks are generated from Marimo Python notebooks.
          </p>
        </header>

        {loading ? (
          <div className="analysis-loading" data-testid="analysis-loading">
            <div className="loading-spinner"></div>
            <p>Checking available notebooks...</p>
          </div>
        ) : (
          <div className="notebooks-grid" data-testid="notebooks-grid">
            {NOTEBOOKS.map((notebook) => {
              const isAvailable = availableNotebooks.has(notebook.id);

              return (
                <article
                  key={notebook.id}
                  className={`notebook-card ${isAvailable ? 'available' : 'unavailable'}`}
                  data-testid={`notebook-${notebook.id}`}
                >
                  <div className="notebook-icon">{notebook.icon}</div>
                  <div className="notebook-content">
                    <h2>{notebook.title}</h2>
                    <p>{notebook.description}</p>
                  </div>
                  <div className="notebook-action">
                    {isAvailable ? (
                      <a
                        href={getNotebookUrl(notebook.filename)}
                        className="notebook-link"
                        data-testid={`notebook-link-${notebook.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open Notebook →
                      </a>
                    ) : (
                      <span className="notebook-unavailable" data-testid={`notebook-unavailable-${notebook.id}`}>
                        Not yet generated
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <section className="analysis-info">
          <h3>🛠️ How to Generate Notebooks</h3>
          <p>
            If notebooks are not available, you can generate them by running:
          </p>
          <ol>
            <li>
              <code>cd analysis && uv run export-html</code> – Export notebooks to HTML
            </li>
            <li>
              <code>npm run prerender-notebooks</code> – Pre-render for static hosting
            </li>
          </ol>
          <p className="info-note">
            See the <a href="https://github.com/sylhare/Badminton/tree/main/analysis" target="_blank" rel="noopener noreferrer">analysis README</a> for detailed setup instructions.
          </p>
        </section>

        <footer className="analysis-footer">
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

export default AnalysisPage;
