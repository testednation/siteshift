import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  title?: string;
  content: string;
  tip?: string;
  label?: string;
  side?: 'top' | 'bottom';
  className?: string;
}

/**
 * Accessible, viewport-safe info tooltip for beginner guidance.
 * Uses a fixed-position portal so tooltips never clip inside overflow-hidden containers.
 * Opens on hover, keyboard focus, or click/tap; closes on Escape or outside click.
 */
export function InfoTooltip({
  title,
  content,
  tip,
  label,
  side = 'top',
  className = '',
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placement: 'top' | 'bottom' }>({
    top: 0,
    left: 0,
    placement: side,
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const tooltipWidth = 288;
    const estimatedHeight = tip ? 132 : 96;
    const margin = 12;

    let placement: 'top' | 'bottom' = side;
    if (side === 'top' && rect.top - estimatedHeight - margin < 8) {
      placement = 'bottom';
    } else if (side === 'bottom' && rect.bottom + estimatedHeight + margin > window.innerHeight - 8) {
      placement = 'top';
    }

    const centeredLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
    const clampedLeft = Math.max(
      margin,
      Math.min(centeredLeft, window.innerWidth - tooltipWidth - margin),
    );
    const top = placement === 'top' ? rect.top - 8 : rect.bottom + 8;

    setCoords({ top, left: clampedLeft, placement });
  }, [side, tip]);

  useEffect(() => {
    if (!open) return;
    updatePosition();

    const handleScrollOrResize = () => updatePosition();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setPinned(false);
      }
    };
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setOpen(false);
        setPinned(false);
      }
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open, updatePosition]);

  return (
    <span className={`inline-flex items-center align-middle ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label || (title ? `About ${title}` : 'More information')}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => {
          if (!pinned) setOpen(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          if (!pinned) setOpen(false);
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPinned((prev) => {
            const next = !prev;
            setOpen(next);
            return next;
          });
        }}
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
          open
            ? 'bg-blue-50 text-blue-700'
            : 'text-slate-400 hover:bg-slate-100 hover:text-blue-700'
        }`}
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            id={tooltipId}
            role="tooltip"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => {
              if (!pinned) setOpen(false);
            }}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: 288,
              transform: coords.placement === 'top' ? 'translateY(-100%)' : 'none',
            }}
            className="z-50 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-left text-xs leading-relaxed text-slate-100 shadow-lg"
          >
            {title && (
              <div className="mb-1 font-display text-xs font-semibold text-white">{title}</div>
            )}
            <p className="text-slate-200">{content}</p>
            {tip && (
              <p className="mt-1.5 border-t border-slate-700/80 pt-1.5 text-[11px] text-blue-200">
                <strong className="font-semibold text-white">Tip:</strong> {tip}
              </p>
            )}
          </div>,
          document.body,
        )}
    </span>
  );
}
