'use client';

import React from 'react';
import { Check, Folder, FolderPlus } from 'lucide-react';
import { PhotoAlbum } from '@/lib/vault-logic';
import { cn } from '@/lib/utils';

/**
 * Shared album/folder chooser — existing chips + on-the-fly creation.
 * The parent owns the state (it needs selectedId/newName at submit time);
 * this component only toggles between "pick existing" and "create new".
 */
interface AlbumPickerProps {
  albums: PhotoAlbum[];
  selectedAlbumId: string;
  newAlbumName: string;
  onSelectAlbum: (id: string) => void;
  onNewAlbumNameChange: (name: string) => void;
  /** Validate + create the album named by newAlbumName (parent handles). */
  onQuickCreate: () => void | Promise<void>;
  question: string;
  inputId: string;
  createLabel?: string;
  compact?: boolean;
}

export function AlbumPicker({
  albums,
  selectedAlbumId,
  newAlbumName,
  onSelectAlbum,
  onNewAlbumNameChange,
  onQuickCreate,
  question,
  inputId,
  createLabel = 'צור אלבום',
  compact = false,
}: AlbumPickerProps) {
  const [mode, setMode] = React.useState<'pick' | 'new'>(
    albums.length === 0 ? 'new' : 'pick'
  );

  return (
    <div className={cn('rounded-3xl glass space-y-3', compact ? 'p-3' : 'p-4')}>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'font-bold text-slate-900 flex items-center gap-2',
            compact ? 'text-xs' : 'text-sm'
          )}
        >
          <Folder className={cn('text-mint-600', compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
          <span>{question}</span>
        </span>
        {albums.length > 0 && (
          <button
            type="button"
            onClick={() => setMode((m) => (m === 'new' ? 'pick' : 'new'))}
            className="text-xs font-bold text-mint-700 hover:opacity-80 flex items-center gap-1 cursor-pointer shrink-0"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>{mode === 'new' ? 'אלבום קיים' : 'אלבום חדש'}</span>
          </button>
        )}
      </div>

      {mode === 'pick' && albums.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {albums.map((album) => {
            const isSelected = selectedAlbumId === album.id && !newAlbumName;
            return (
              <button
                key={album.id}
                type="button"
                onClick={() => {
                  onSelectAlbum(album.id);
                  onNewAlbumNameChange('');
                }}
                className={cn(
                  'px-4 rounded-xl border font-bold flex items-center gap-2 transition cursor-pointer',
                  compact ? 'min-h-10 py-1.5 text-xs' : 'min-h-10 py-2 text-sm',
                  isSelected
                    ? 'chip-selected'
                    : 'glass text-slate-600 hover:bg-slate-900/5'
                )}
              >
                <Folder
                  className={cn(
                    'w-4 h-4',
                    isSelected ? 'text-mint-600' : 'text-slate-500'
                  )}
                />
                <span>{album.name}</span>
                {isSelected && <Check className="w-4 h-4 text-mint-600" />}
              </button>
            );
          })}
        </div>
      )}

      {mode === 'new' && (
        <div className="flex flex-col sm:flex-row gap-2">
          <label htmlFor={inputId} className="sr-only">
            שם אלבום חדש
          </label>
          <input
            id={inputId}
            type="text"
            value={newAlbumName}
            onChange={(e) => onNewAlbumNameChange(e.target.value)}
            placeholder="כתוב שם לאלבום חדש (למשל: קבלות, משפחה, עבודה)..."
            className="input-glass flex-1"
          />
          <button
            type="button"
            onClick={() => void onQuickCreate()}
            className="btn-accent min-h-11 px-4 rounded-xl text-sm font-bold cursor-pointer whitespace-nowrap"
          >
            {createLabel}
          </button>
        </div>
      )}
    </div>
  );
}
