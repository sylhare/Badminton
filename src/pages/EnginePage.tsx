import React from 'react';

import NotebookPage from './NotebookPage';

function EnginePage(): React.ReactElement {
  const basePath = import.meta.env.BASE_URL || '/';
  const notebookUrl = `${basePath}analysis/engine_analysis.html`;

  return <NotebookPage notebookUrl={notebookUrl} title="Engine Comparison" />;
}

export default EnginePage;