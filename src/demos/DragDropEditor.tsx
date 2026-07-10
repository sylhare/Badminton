import React, { useState } from 'react';

import type { Layout, SlotAddr } from './demoData';
import { sameSlot, swapSlots } from './demoData';
import EditableCourts from './EditableCourts';

interface DragDropEditorProps {
  layout: Layout;
  onChange: (layout: Layout) => void;
}

/**
 * Drag a player chip onto another player to swap their positions. Uses the
 * native HTML5 drag-and-drop API — fluid on desktop, though it has no touch
 * fallback (a real integration would want a pointer-based lib for mobile).
 */
const DragDropEditor: React.FC<DragDropEditorProps> = ({ layout, onChange }) => {
  const [dragging, setDragging] = useState<SlotAddr | null>(null);
  const [dragOver, setDragOver] = useState<SlotAddr | null>(null);

  const handleDrop = (target: SlotAddr) => {
    if (dragging && !sameSlot(dragging, target)) {
      onChange(swapSlots(layout, dragging, target));
    }
    setDragging(null);
    setDragOver(null);
  };

  return (
    <div>
      <p className="demo-hint">👉 Drag any player onto another to swap their spots — across teams, courts, or the bench.</p>
      <EditableCourts
        layout={layout}
        slotClass={addr => {
          const classes: string[] = [];
          if (dragging && sameSlot(dragging, addr)) classes.push('demo-dragging');
          if (dragOver && sameSlot(dragOver, addr)) classes.push('demo-drag-over');
          return classes.join(' ');
        }}
        slotProps={addr => ({
          draggable: true,
          onDragStart: () => setDragging(addr),
          onDragEnd: () => { setDragging(null); setDragOver(null); },
          onDragEnter: () => setDragOver(addr),
          onDragOver: (e: React.DragEvent) => e.preventDefault(),
          onDrop: (e: React.DragEvent) => { e.preventDefault(); handleDrop(addr); },
        })}
      />
    </div>
  );
};

export default DragDropEditor;
