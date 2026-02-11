import React from 'react';

import NotebookPage from './NotebookPage';

function AlgorithmPage(): React.ReactElement {
  const basePath = import.meta.env.BASE_URL || '/';
  const notebookUrl = `${basePath}analysis/algorithm_docs.html`;

  return <NotebookPage notebookUrl={notebookUrl} title="Algorithm Documentation" />;
}

export default AlgorithmPage;