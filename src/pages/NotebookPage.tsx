import React, { useState, useEffect } from 'react';
import './NotebookPage.css';

interface NotebookPageProps {
    notebookUrl: string;
    title: string;
}

function NotebookPage({ notebookUrl, title }: NotebookPageProps): React.ReactElement {
    const [isLoading, setIsLoading] = useState(true);
    const [isAvailable, setIsAvailable] = useState(false);

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
                <a href={`${import.meta.env.BASE_URL || '/'}stats`} className="back-link" data-testid="back-to-stats">
                    ← Back to Stats
                </a>
                <h1 style={{ marginLeft: 'auto' }}>{title}</h1>
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
                    <p>The notebook has not been generated yet.</p>
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
                    title={title}
                    onLoad={handleIframeLoad}
                    data-testid="notebook-iframe"
                />
            )}
        </div>
    );
}

export default NotebookPage;