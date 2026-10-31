'use client';

import React from 'react';
import { Download, Edit3, Trash2 } from 'lucide-react';
import { VaultItem } from '@/lib/vault-logic';
import { shareVaultItem } from '@/lib/share';
import { WhatsAppIcon } from '@/components/whatsapp-icon';
import { cn } from '@/lib/utils';

/**
 * Shared per-item action cluster: open / quick-edit / WhatsApp / download /
 * delete. size="sm" fits photo cards (w-10), size="md" fits rows (w-11).
 */
interface ItemActionsProps {
  item: VaultItem;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  openLabel: string;
  size?: 'sm' | 'md';
}

export function ItemActions({
  item,
  onOpen,
  onEdit,
  onDelete,
  openLabel,
  size = 'md',
}: ItemActionsProps) {
  const iconBtn = cn(
    'flex items-center justify-center rounded-xl glass transition cursor-pointer',
    size === 'sm' ? 'w-10 h-10' : 'w-11 h-11'
  );

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="min-h-10 px-4 py-2 rounded-xl glass text-sm font-bold text-slate-800 hover:bg-slate-900/5 active:scale-95 transition cursor-pointer"
      >
        {openLabel}
      </button>

      <button
        type="button"
        onClick={onEdit}
        aria-label={`עריכת ${item.title}`}
        className={cn(
          iconBtn,
          'text-slate-500 hover:text-mint-700 hover:border-mint-500/30 hover:bg-mint-500/10'
        )}
      >
        <Edit3 className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => void shareVaultItem(item)}
        aria-label={`שיתוף ${item.title} בוואטסאפ`}
        className={cn(
          iconBtn,
          'text-slate-500 hover:border-[#25D366]/40 hover:bg-[#25D366]/10'
        )}
      >
        <WhatsAppIcon className="w-[18px] h-[18px]" />
      </button>

      {item.dataUrl && (
        <a
          href={item.dataUrl}
          download={item.fileName}
          aria-label={`הורדת ${item.title}`}
          className={cn(
            iconBtn,
            'text-slate-500 hover:text-slate-900 hover:bg-slate-900/5'
          )}
        >
          <Download className="w-4 h-4" />
        </a>
      )}

      <button
        type="button"
        onClick={onDelete}
        aria-label={`מחיקת ${item.title}`}
        className={cn(
          iconBtn,
          'text-slate-400 hover:text-red-600 hover:border-red-500/30 hover:bg-red-500/10'
        )}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </>
  );
}
