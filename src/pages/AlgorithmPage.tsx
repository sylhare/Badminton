import React, { useState, useEffect } from 'react';
import './NotebookPage.css';

function AlgorithmPage(): React.ReactElement {
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);

  const basePath = import.meta.env.BASE_URL || '/';
  const notebookUrl = `${basePath}analysis/algorithm_docs.html`;

  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const response = await fetch(notebookUrl, { method: 'HEAD' });
        setIsAvailable(response.ok);
      } catch {
        setIsAvailable(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAvailability();
  }, [notebookUrl]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  return (
    <div className="notebook-page">
      <header className="notebook-header">
        <a href={`${basePath}stats`} className="back-link" data-testid="back-to-stats">
          ← Back to Stats
        </a>
        <h1>📐 Algorithm Documentation</h1>
      </header>

      {isLoading && (
        <div className="notebook-loading" data-testid="notebook-loading">
          <div className="loading-spinner"></div>
          <p>Loading notebook...</p>
        </div>
      )}

      {!isLoading && !isAvailable && (
        <div className="notebook-unavailable" data-testid="notebook-unavailable">
          <div className="unavailable-icon">📓</div>
          <h2>Notebook Not Generated</h2>
          <p>The algorithm documentation notebook has not been generated yet.</p>
          <div className="instructions">
            <p>To generate it, run the following commands:</p>
            <ol>
              <li>
                <code>cd analysis && uv run export-html</code>
              </li>
              <li>
                <code>npm run prerender-notebooks</code>
              </li>
            </ol>
          </div>
          <a
            href="https://github.com/sylhare/Badminton/tree/main/analysis"
            target="_blank"
            rel="noopener noreferrer"
            className="docs-link"
          >
            View Setup Instructions →
          </a>
        </div>
      )}

      {isAvailable && (
        <iframe
          src={notebookUrl}
          className="notebook-iframe"
          title="Algorithm Documentation"
          onLoad={handleIframeLoad}
          data-testid="notebook-iframe"
        />
      )}
    </div>
  );
}

export default AlgorithmPage;
