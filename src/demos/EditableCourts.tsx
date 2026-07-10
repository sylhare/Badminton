import React from 'react';

import type { Layout, SlotAddr } from './demoData';

interface EditableCourtsProps {
  layout: Layout;
  /** Extra CSS classes for a slot (e.g. selection / drag-over affordances). */
  slotClass?: (addr: SlotAddr) => string;
  /** Handlers/attributes spread onto each player slot (onClick, draggable, drag events…). */
  slotProps?: (addr: SlotAddr) => React.HTMLAttributes<HTMLDivElement> & {
    draggable?: boolean;
  };
}

/**
 * Renders a demo layout using the app's real court/team CSS classes, but with
 * every player exposed as an individually-addressable, interactive slot. The
 * two editors share this layout and only differ in the handlers they inject.
 */
const EditableCourts: React.FC<EditableCourtsProps> = ({ layout, slotClass, slotProps }) => {
  const renderSlot = (addr: SlotAddr, name: string, base: string) => (
    <div
      className={`${base} demo-slot ${slotClass?.(addr) ?? ''}`.trim()}
      {...slotProps?.(addr)}
    >
      {name}
    </div>
  );

  return (
    <>
      <div className="courts-grid">
        {layout.courts.map((court, courtIdx) => (
          <div key={court.courtNumber} className="court-card">
            <div className="court-header">
              <h3>🏸 Court {court.courtNumber}</h3>
            </div>
            <div className="teams">
              <div className="team">
                <div className="team-label">Team 1</div>
                <div className="team-players">
                  {court.team1.map((p, playerIdx) =>
                    <React.Fragment key={p.id}>
                      {renderSlot({ kind: 'court', courtIdx, team: 1, playerIdx }, p.name, 'team-player')}
                    </React.Fragment>,
                  )}
                </div>
              </div>
              <div className="vs-divider">VS</div>
              <div className="team">
                <div className="team-label">Team 2</div>
                <div className="team-players">
                  {court.team2.map((p, playerIdx) =>
                    <React.Fragment key={p.id}>
                      {renderSlot({ kind: 'court', courtIdx, team: 2, playerIdx }, p.name, 'team-player')}
                    </React.Fragment>,
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bench-section">
        <div className="bench-header">
          🪑 Bench ({layout.bench.length} player{layout.bench.length !== 1 ? 's' : ''})
        </div>
        <div className="bench-players">
          {layout.bench.length === 0 && <span className="demo-bench-empty">No one benched</span>}
          {layout.bench.map((p, playerIdx) =>
            <React.Fragment key={p.id}>
              {renderSlot({ kind: 'bench', playerIdx }, p.name, 'bench-player')}
            </React.Fragment>,
          )}
        </div>
      </div>
    </>
  );
};

export default EditableCourts;
