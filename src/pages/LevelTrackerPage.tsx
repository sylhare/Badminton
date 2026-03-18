import React from 'react';

import NotebookPage from './NotebookPage';

function LevelTrackerPage(): React.ReactElement {
  const basePath = import.meta.env.BASE_URL || '/';
  const notebookUrl = `${basePath}analysis/level_tracker_analysis.html`;

  return <NotebookPage notebookUrl={notebookUrl} title="Level Tracker Analysis" />;
}

export default LevelTrackerPage;
