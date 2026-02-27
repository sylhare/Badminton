import { useEffect, useRef, useState } from 'react';

const HOVER_DELAY_MS = 1500;

interface TooltipProps {
  text: string;
  testId: string;
}

export function Tooltip({ text, testId }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLSpanElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const computePos = (el: HTMLSpanElement) => {
    const rect = el.getBoundingClientRect();
    return { top: rect.bottom + 6, left: rect.left + rect.width / 2 };
  };

  const clearHoverTimer = () => {
    if (hoverTimerRef.current !== null) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  // Native click listener: stopPropagation() must run at the DOM level before
  // the event bubbles to any ancestor <label> — React synthetic handlers fire
  // at the React root, which is too late (the label has already activated).
  useEffect(() => {
    const el = iconRef.current;
    if (!el) return;
    const handleClick = (e: MouseEvent) => {
      e.stopPropagation();
      clearHoverTimer();
      setPos(computePos(el));
      setOpen(prev => !prev);
    };
    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, []);

  // Cleanup hover timer on unmount.
  useEffect(() => () => clearHoverTimer(), []);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (iconRef.current && !iconRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const handleMouseEnter = () => {
    const el = iconRef.current;
    if (!el) return;
    hoverTimerRef.current = setTimeout(() => {
      setPos(computePos(el));
      setOpen(true);
    }, HOVER_DELAY_MS);
  };

  const handleMouseLeave = () => {
    clearHoverTimer();
    setOpen(false);
  };

  return (
    <span
      className="tooltip-wrapper"
      ref={iconRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span
        className={`tooltip-icon${open ? ' active' : ''}`}
        data-testid={`${testId}-tooltip-icon`}
        role="button"
        tabIndex={0}
        aria-label="More information"
        aria-expanded={open}
      >
        ⓘ
      </span>
      {open && (
        <span
          className="tooltip-popup"
          data-testid={`${testId}-tooltip-popup`}
          role="tooltip"
          style={{ top: pos.top, left: pos.left }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
