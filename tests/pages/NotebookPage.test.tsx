import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import NotebookPage from '../../src/pages/NotebookPage';

describe('NotebookPage Component', () => {
  const mockNotebookUrlAvailable = `/analysis/engine_analysis.html`;
  const mockNotebookUrlUnavailable = `/analysis/nonexistent_notebook.html`;
  let fetchSpy: vi.SpyInstance;

  beforeEach(() => {
    vi.restoreAllMocks();
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.clearAllMocks();
    fetchSpy.mockRestore();
  });

  it('renders the page header with the correct title', () => {
    render(<NotebookPage notebookUrl={mockNotebookUrlAvailable} title="Engine Comparison" />);

    expect(screen.getByText('Engine Comparison')).toBeInTheDocument();
    expect(screen.getByTestId('back-to-stats')).toHaveAttribute('href', `/stats`);
  });

  it('renders unavailable message when fetch fails', async () => {
    vi.mocked(fetchSpy).mockRejectedValueOnce(new Error('Network error'));

    render(<NotebookPage notebookUrl={mockNotebookUrlUnavailable} title="Engine Comparison" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading notebook...')).not.toBeInTheDocument();
      expect(screen.getByText('Notebook Not Generated')).toBeInTheDocument();
    });
  });

  it('calls fetch with the correct URL', async () => {
    vi.mocked(fetchSpy).mockResolvedValueOnce(new Response(null, { status: 200 }));

    render(<NotebookPage notebookUrl={mockNotebookUrlAvailable} title="Engine Comparison" />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(mockNotebookUrlAvailable, { method: 'HEAD' });
      expect(screen.getByTestId('notebook-iframe')).toBeInTheDocument();
    });
  });

  it('renders instructions when notebook is not available', async () => {
    vi.mocked(fetchSpy).mockResolvedValueOnce(new Response(null, { status: 404 }));

    render(<NotebookPage notebookUrl={mockNotebookUrlUnavailable} title="Engine Comparison" />);

    await waitFor(() => {
      expect(screen.getByText('To generate it, run the following commands:')).toBeInTheDocument();
      expect(screen.getByTestId('notebook-unavailable')).toHaveAttribute(
        'data-testid',
        'notebook-unavailable',
      );
    });
  });
});