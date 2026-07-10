import React, { useState } from 'react';

import type { Layout, SlotAddr } from './demoData';
import { sameSlot, swapSlots } from './demoData';
import EditableCourts from './EditableCourts';

interface ClickSwapEditorProps {
  layout: Layout;
  onChange: (layout: Layout) => void;
}

/**
 * Tap one player to select it, tap a second to swap the two. Tapping the
 * selected player again cancels. Works identically for court and bench slots,
 * so subbing a benched player in is just a swap. Reuses the TournamentSetup
 * click-to-swap pattern.
 */
const ClickSwapEditor: React.FC<ClickSwapEditorProps> = ({ layout, onChange }) => {
  const [selected, setSelected] = useState<SlotAddr | null>(null);

  const handleClick = (addr: SlotAddr) => {
    if (!selected) {
      setSelected(addr);
      return;
    }
    if (sameSlot(selected, addr)) {
      setSelected(null);
      return;
    }
    onChange(swapSlots(layout, selected, addr));
    setSelected(null);
  };

  return (
    <div>
      <p className="demo-hint">
        {selected
          ? '👉 Now tap another player (on any court or the bench) to swap them.'
          : '👉 Tap a player to pick them up, then tap another to swap positions.'}
      </p>
      <EditableCourts
        layout={layout}
        slotClass={addr => (selected && sameSlot(selected, addr) ? 'demo-selected' : '')}
        slotProps={addr => ({
          onClick: () => handleClick(addr),
          role: 'button',
          tabIndex: 0,
        })}
      />
    </div>
  );
};

export default ClickSwapEditor;
