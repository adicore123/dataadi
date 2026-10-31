'use client';

import React, { useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Mic,
  Plus,
  Folder as FolderIcon,
  FolderPlus,
  Trash2,
  Tag,
} from 'lucide-react';
import {
  VaultItem,
  Folder,
  FilterTab,
  ModuleType,
  MODULE_META,
} from '@/lib/vault-logic';
import { UploadMode } from '@/components/upload-share-modal';
import { ItemActions } from '@/components/ui/item-actions';
import { cn } from '@/lib/utils';

interface VaultItemsViewProps {
  items: VaultItem[];
  activeTab: FilterTab;
  folders: Folder[];
  selectedFolderId: string;
  folderCounts: Record<string, number>;
  moduleCounts: Record<FilterTab, number>;
  searchQuery: string;
  onSelectFolder: (folderId: string) => void;
  onCreateFolder: (name: string, module: ModuleType) => Promise<Folder>;
  onDeleteFolder: (folderId: string) => void;
  onSelectItem: (item: VaultItem) => void;
  onEditItem: (item: VaultItem) => void;
  onDeleteItem: (id: string) => void;
  onOpenUpload: (mode?: UploadMode, targetFolderId?: string) => void;
}

export function VaultItemsView({
  items,
  activeTab,
  folders,
  selectedFolderId,
  folderCounts,
  moduleCounts,
  searchQuery,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onSelectItem,
  onEditItem,
  onDeleteItem,
  onOpenUpload,
}: VaultItemsViewProps) {
  const [showNewFolderForm, setShowNewFolderForm] = useState(false);
  const [newFolderInput, setNewFolderInput] = useState('');

  const activeModule: ModuleType | null = activeTab === 'all' ? null : activeTab;
  const moduleFolders = activeModule
    ? folders.filter((f) => f.module === activeModule)
    : [];

  const handleCreateFolderInline = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderInput.trim();
    if (!trimmed || !activeModule) return;
    const created = await onCreateFolder(trimmed, activeModule);
    setNewFolderInput('');
    setShowNewFolderForm(false);
    onSelectFolder(created.id);
  };

  /** Folder bar — inside each module (documents / photos / recordings). */
  const renderFoldersSection = () => {
    if (!activeModule) return null;

    return (
      <div className="glass card-sheen rounded-3xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-mint-500/20 to-teal-500/10 text-mint-600">
              <FolderIcon className="w-[18px] h-[18px]" />
            </span>
            <h2 className="text-base font-bold text-slate-900">
              התיקיות שלי · {MODULE_META[activeModule].shortLabel}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setShowNewFolderForm((prev) => !prev)}
            className="min-h-10 px-4 py-2 rounded-xl glass text-sm font-bold text-mint-700 hover:bg-slate-900/5 active:scale-95 transition flex items-center gap-2 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            <span>תיקייה חדשה</span>
          </button>
        </div>

        {showNewFolderForm && (
          <form
            onSubmit={handleCreateFolderInline}
            className="flex flex-col sm:flex-row items-stretch gap-2"
          >
            <label htmlFor="new-folder-inline" className="sr-only">
              שם תיקייה חדשה
            </label>
            <input
              id="new-folder-inline"
              type="text"
              value={newFolderInput}
              onChange={(e) => setNewFolderInput(e.target.value)}
              placeholder="שם התיקייה החדשה (למשל: קבלות, משפחה, עבודה)..."
              className="input-glass flex-1"
            />
            <button
              type="submit"
              className="btn-accent min-h-11 px-5 rounded-xl text-sm font-bold cursor-pointer"
            >
              צור תיקייה
            </button>
          </form>
        )}

        <div
          role="tablist"
          aria-label={`תיקיות ${MODULE_META[activeModule].shortLabel}`}
          className="flex flex-wrap items-center gap-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedFolderId === 'all'}
            onClick={() => onSelectFolder('all')}
            className={cn(
              'min-h-11 px-4 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 transition cursor-pointer',
              selectedFolderId === 'all'
                ? 'chip-selected'
                : 'glass text-slate-600 hover:bg-slate-900/5'
            )}
          >
            <span>הכל</span>
            <span className="font-mono text-xs opacity-80">
              ({moduleCounts[activeModule]})
            </span>
          </button>

          {moduleFolders.map((folder) => {
            const isSelected = selectedFolderId === folder.id;
            const count = folderCounts[folder.id] || 0;
            return (
              <div
                key={folder.id}
                className={cn(
                  'min-h-11 rounded-xl border flex items-center transition',
                  isSelected ? 'chip-selected' : 'glass hover:bg-slate-900/5'
                )}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => onSelectFolder(folder.id)}
                  className={cn(
                    'px-4 py-2 text-sm font-bold flex items-center gap-2 cursor-pointer',
                    isSelected ? 'text-mint-700' : 'text-slate-600'
                  )}
                >
                  <FolderIcon
                    className={cn(
                      'w-4 h-4',
                      isSelected ? 'text-mint-600' : 'text-slate-500'
                    )}
                  />
                  <span>{folder.name}</span>
                  <span className="font-mono text-xs opacity-75">({count})</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteFolder(folder.id)}
                  aria-label={`מחיקת תיקייה ${folder.name}`}
                  className="pl-3 pr-2 h-full min-w-11 flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /** Folder + tags chips shown on every item row/card. */
  const itemChips = (item: VaultItem, variant: 'scrim' | 'meta') => {
    if (variant === 'scrim') {
      return (
        <div className="flex items-center gap-2 text-[11px] text-slate-200 mt-1 flex-wrap">
          {item.folderName && (
            <span className="inline-flex items-center gap-1 rounded-md bg-white/15 border border-white/20 px-1.5 py-0.5 font-semibold text-mint-200 truncate max-w-[10rem]">
              <FolderIcon className="w-3 h-3 shrink-0" />
              <span className="truncate">{item.folderName}</span>
            </span>
          )}
          {(item.tags?.length || 0) > 0 &&
            item.tags!.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-md bg-white/10 border border-white/15 px-1.5 py-0.5 font-semibold text-slate-100 truncate max-w-[7rem]"
              >
                <Tag className="w-3 h-3 shrink-0" />
                <span className="truncate">{tag}</span>
              </span>
            ))}
          <span dir="ltr" className="font-mono tabular-nums">
            {item.formattedDate}
          </span>
        </div>
      );
    }

    return (
      <>
        {item.folderName && (
          <span className="font-bold text-mint-700 inline-flex items-center gap-1">
            <FolderIcon className="w-3 h-3" />
            {item.folderName}
          </span>
        )}
        {(item.tags?.length || 0) > 0 &&
          item.tags!.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md bg-teal-500/10 border border-teal-500/25 px-1.5 py-0.5 font-semibold text-teal-700"
            >
              <Tag className="w-3 h-3" />
              {tag}
            </span>
          ))}
      </>
    );
  };

  if (items.length === 0) {
    const selectedFolderObj = folders.find((f) => f.id === selectedFolderId);

    return (
      <div>
        {renderFoldersSection()}
        <div className="glass card-sheen rounded-4xl p-10 sm:p-14 text-center max-w-lg mx-auto my-4 relative overflow-hidden">
          {/* Ambient glow behind the icon */}
          <div
            aria-hidden="true"
            className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-mint-400/15 blur-3xl"
          />
          <div className="relative">
            <div className="w-20 h-20 rounded-4xl bg-gradient-to-br from-mint-500/20 to-teal-500/10 border border-mint-500/25 text-mint-600 flex items-center justify-center mx-auto mb-5 shadow-glow">
              {activeTab === 'photos' ? (
                <ImageIcon className="w-9 h-9" />
              ) : activeTab === 'recordings' ? (
                <Mic className="w-9 h-9" />
              ) : (
                <FileText className="w-9 h-9" />
              )}
            </div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              {searchQuery
                ? `לא נמצאו תוצאות עבור "${searchQuery}"`
                : selectedFolderObj
                ? `התיקייה "${selectedFolderObj.name}" ריקה`
                : 'אין עדיין קבצים כאן'}
            </h3>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              לחץ על הכפתור למטה כדי להעלות מסמך, תמונה או הקלטה.
            </p>
            <button
              type="button"
              onClick={() =>
                onOpenUpload(
                  'upload',
                  activeModule && selectedFolderId !== 'all' ? selectedFolderId : undefined
                )
              }
              className="btn-accent mt-7 h-13 px-7 rounded-2xl text-base font-bold inline-flex items-center gap-2.5 cursor-pointer"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
              <span>העלאת קובץ חדש</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Photo Grid inside the Photos module
  if (activeTab === 'photos') {
    return (
      <div>
        {renderFoldersSection()}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {items.map((item) => (
            <article
              key={item.id}
              className="glass card-sheen rounded-3xl overflow-hidden flex flex-col justify-between group hover:border-mint-500/30 hover:-translate-y-0.5 transition-all"
            >
              <button
                type="button"
                onClick={() => onSelectItem(item)}
                className="relative w-full aspect-[4/3] bg-vault-200 overflow-hidden block cursor-pointer"
              >
                {item.dataUrl ? (
                  <img
                    src={item.dataUrl}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <ImageIcon className="w-10 h-10" />
                  </div>
                )}
                {/* Gradient scrim with the title on top of the photo */}
                <div className="absolute inset-x-0 bottom-0 pt-14 pb-3.5 px-4 bg-gradient-to-t from-slate-950/85 via-slate-950/45 to-transparent text-right">
                  <h3 className="text-[15px] font-bold text-white truncate">
                    {item.title}
                  </h3>
                  {itemChips(item, 'scrim')}
                </div>
              </button>

              <div className="px-3.5 py-3 flex items-center justify-between border-t border-slate-900/[0.06]">
                <ItemActions
                  item={item}
                  size="sm"
                  openLabel="פתיחת תמונה"
                  onOpen={() => onSelectItem(item)}
                  onEdit={() => onEditItem(item)}
                  onDelete={() => onDeleteItem(item.id)}
                />
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  // Documents / Recordings — large readable rows
  return (
    <div className="space-y-4">
      {renderFoldersSection()}
      <div className="space-y-3">
        {items.map((item) => {
        const isPhoto = item.module === 'photos';
        const isRecording = item.module === 'recordings';

        return (
          <article
            key={item.id}
            className="glass card-sheen rounded-3xl hover:border-mint-500/30 hover:-translate-y-0.5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
          >
            <div className="flex items-center gap-4 min-w-0 flex-1 p-4 sm:p-5 sm:pb-5">
              {isPhoto && item.dataUrl ? (
                <button
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className="w-14 h-14 rounded-2xl overflow-hidden bg-vault-200 ring-1 ring-slate-900/10 shrink-0 cursor-pointer"
                >
                  <img
                    src={item.dataUrl}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer border transition-colors',
                    isRecording
                      ? 'bg-gradient-to-br from-mint-500/20 to-teal-500/10 border-mint-500/25 text-mint-600'
                      : 'bg-slate-900/[0.04] border-slate-900/[0.08] text-slate-500'
                  )}
                >
                  {isRecording ? (
                    <Mic className="w-6 h-6" />
                  ) : isPhoto ? (
                    <ImageIcon className="w-6 h-6" />
                  ) : (
                    <FileText className="w-6 h-6" />
                  )}
                </button>
              )}

              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className="text-right text-lg font-bold text-slate-900 hover:text-mint-700 truncate block w-full cursor-pointer transition-colors"
                >
                  {item.title}
                </button>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                  <span className="font-semibold text-slate-600">
                    {MODULE_META[item.module].singularLabel}
                  </span>
                  <span aria-hidden="true">·</span>
                  {itemChips(item, 'meta')}
                  <span aria-hidden="true">·</span>
                  <span dir="ltr" className="font-mono text-slate-400 tabular-nums">
                    {item.formattedDate} · {item.formattedTime}
                  </span>
                </div>

                {isRecording && item.dataUrl && (
                  <div className="mt-3 max-w-md">
                    <audio controls src={item.dataUrl} className="w-full h-9" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 shrink-0 px-4 sm:pl-5 pb-4 sm:pb-5">
              <ItemActions
                item={item}
                size="md"
                openLabel="פתח"
                onOpen={() => onSelectItem(item)}
                onEdit={() => onEditItem(item)}
                onDelete={() => onDeleteItem(item.id)}
              />
            </div>
          </article>
          );
        })}
      </div>
    </div>
  );
}
