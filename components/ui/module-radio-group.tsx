'use client';

import React from 'react';
import { FileText, Image as ImageIcon, Mic } from 'lucide-react';
import { ModuleType, MODULE_META } from '@/lib/vault-logic';
import { cn } from '@/lib/utils';

const MODULE_ICONS: Record<ModuleType, React.ComponentType<{ className?: string }>> = {
  photos: ImageIcon,
  documents: FileText,
  recordings: Mic,
};

const ORDER: ModuleType[] = ['photos', 'documents', 'recordings'];

/**
 * Shared three-module radio chooser.
 * variant="large"  — upload flow step (tall tiles, role=radio).
 * variant="compact" — preview-modal edit form (slim buttons, aria-pressed).
 */
interface ModuleRadioGroupProps {
  value: ModuleType | null;
  onChange: (module: ModuleType) => void;
  variant?: 'large' | 'compact';
  ariaLabel?: string;
}

export function ModuleRadioGroup({
  value,
  onChange,
  variant = 'large',
  ariaLabel = 'לאן להכניס',
}: ModuleRadioGroupProps) {
  const large = variant === 'large';

  return (
    <div
      className={cn('grid grid-cols-3 gap-2.5', !large && 'gap-2')}
      role={large ? 'radiogroup' : undefined}
      aria-label={large ? ariaLabel : undefined}
    >
      {ORDER.map((moduleId) => {
        const Icon = MODULE_ICONS[moduleId];
        const active = value === moduleId;
        return (
          <button
            key={moduleId}
            type="button"
            role={large ? 'radio' : undefined}
            aria-checked={large ? active : undefined}
            aria-pressed={large ? undefined : active}
            onClick={() => onChange(moduleId)}
            className={cn(
              'rounded-2xl border flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 font-bold',
              large
                ? 'min-h-20 p-3 flex-col gap-2 text-sm'
                : 'min-h-11 p-2 text-xs font-semibold',
              active
                ? large
                  ? 'bg-gradient-to-br from-mint-500/20 to-teal-500/10 border-mint-500/50 text-slate-900 shadow-glow'
                  : 'chip-selected'
                : 'glass text-slate-600 hover:bg-slate-900/5'
            )}
          >
            <Icon
              className={cn(
                large ? 'w-6 h-6' : 'w-3.5 h-3.5',
                active ? 'text-mint-600' : 'text-slate-400'
              )}
            />
            <span className={cn(!large && 'truncate')}>
              {MODULE_META[moduleId].shortLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
