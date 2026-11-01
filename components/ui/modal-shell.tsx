'use client';

import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Shared modal shell — overlay, bottom-sheet-on-mobile panel, drag handle
 * and a header with title + close button. Unifies the four modals' look,
 * z-index and animation language. Body scrolls; footer sticks.
 */
interface ModalShellProps {
  titleId: string;
  title: string;
  closeLabel?: string;
  maxWidth?: 'max-w-md' | 'max-w-lg' | 'max-w-2xl';
  /** Extra content rendered under the title (hints, notices). */
  headerExtra?: React.ReactNode;
  /** Scrollable body. */
  children: React.ReactNode;
  /** Sticky footer (action buttons). */
  footer?: React.ReactNode;
  onClose: () => void;
}

export function ModalShell({
  titleId,
  title,
  closeLabel = 'סגירה',
  maxWidth = 'max-w-lg',
  headerExtra,
  children,
  footer,
  onClose,
}: ModalShellProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4"
    >
      <div
        className={cn(
          'w-full rounded-t-4xl sm:rounded-4xl glass-strong shadow-2xl overflow-hidden max-h-[92vh] flex flex-col',
          maxWidth
        )}
      >
        {/* Sheet handle (mobile affordance) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1" aria-hidden="true">
          <div className="sheet-handle" />
        </div>

        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-900/[0.08]">
          <h2
            id={titleId}
            className="text-lg font-bold tracking-tight text-slate-900 truncate"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="w-11 h-11 flex items-center justify-center rounded-2xl glass text-slate-500 hover:text-slate-900 hover:bg-slate-900/5 active:scale-95 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {headerExtra && (
          <div className="px-5 sm:px-6 pt-3 space-y-2">{headerExtra}</div>
        )}

        <div className="p-5 sm:p-6 overflow-y-auto flex-1">{children}</div>

        {footer && (
          <div className="px-5 sm:px-6 py-4 border-t border-slate-900/[0.08] pb-safe bg-white/40 dark:bg-white/[0.04]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
