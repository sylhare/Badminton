import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import type { Layout } from './demoData';
import { DEMO_PLAYERS, buildLayout } from './demoData';
import ClickSwapEditor from './ClickSwapEditor';
import DragDropEditor from './DragDropEditor';
import './demo.css';

type EditMode = 'click' | 'drag';

const NUMBER_OF_COURTS = 3;

/**
 * Sandbox page (route: /demo) for comparing two ways to hand-edit generated
 * teams — click-to-swap vs drag-and-drop. Uses mock data only; nothing here
 * persists or touches the engine.
 */
const TeamEditDemoPage: React.FC = () => {
  const [mode, setMode] = useState<EditMode>('drag');
  const [layout, setLayout] = useState<Layout>(() => buildLayout(DEMO_PLAYERS, NUMBER_OF_COURTS));

  const Editor = useMemo(() => (mode === 'click' ? ClickSwapEditor : DragDropEditor), [mode]);

  return (
    <div className="app" data-loaded="true">
      <nav className="tournament-banner">
        <Link to="/" className="banner-nav-link">← Court Manager</Link>
        <span className="banner-nav-link" aria-disabled>Team-Editing Demo</span>
      </nav>

      <div className="container main-container">
        <h1><span className="title-emoji">🧪 </span>Team-Editing Demo</h1>
        <p className="demo-intro">
          Two interaction styles for moving players between generated teams. This is a sandbox
          with mock players — edits don&apos;t persist.
        </p>

        <div className="demo-mode-toggle" role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'click'}
            className={`demo-mode-pill${mode === 'click' ? ' demo-mode-pill-active' : ''}`}
            onClick={() => setMode('click')}
          >
            👆 Click-to-swap
          </button>
          <button
            role="tab"
            aria-selected={mode === 'drag'}
            className={`demo-mode-pill${mode === 'drag' ? ' demo-mode-pill-active' : ''}`}
            onClick={() => setMode('drag')}
          >
            ✋ Drag & drop
          </button>
        </div>

        <Editor layout={layout} onChange={setLayout} />
      </div>
    </div>
  );
};

export default TeamEditDemoPage;
