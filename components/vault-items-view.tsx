'use client';

import React, { useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Mic,
  Download,
  Trash2,
  Plus,
  Folder,
  FolderPlus,
  Edit3,
} from 'lucide-react';
import {
  VaultItem,
  PhotoAlbum,
  FilterTab,
  MODULE_META,
} from '@/lib/vault-logic';
import { shareVaultItem } from '@/lib/share';
import { WhatsAppIcon } from '@/components/whatsapp-icon';

interface VaultItemsViewProps {
  items: VaultItem[];
  activeTab: FilterTab;
  albums: PhotoAlbum[];
  selectedAlbumId: string;
  albumPhotoCounts: Record<string, number>;
  totalPhotosCount: number;
  searchQuery: string;
  onSelectAlbum: (albumId: string) => void;
  onCreateAlbum: (name: string) => Promise<PhotoAlbum>;
  onDeleteAlbum: (albumId: string) => void;
  onSelectItem: (item: VaultItem) => void;
  onEditItem: (item: VaultItem) => void;
  onDeleteItem: (id: string) => void;
  onOpenUpload: (
    mode?: 'upload' | 'record' | 'simulate-share',
    targetAlbumId?: string
  ) => void;
}

export function VaultItemsView({
  items,
  activeTab,
  albums,
  selectedAlbumId,
  albumPhotoCounts,
  totalPhotosCount,
  searchQuery,
  onSelectAlbum,
  onCreateAlbum,
  onDeleteAlbum,
  onSelectItem,
  onEditItem,
  onDeleteItem,
  onOpenUpload,
}: VaultItemsViewProps) {
  const [showNewAlbumForm, setShowNewAlbumForm] = useState(false);
  const [newAlbumInput, setNewAlbumInput] = useState('');

  const handleCreateAlbumInline = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newAlbumInput.trim();
    if (!trimmed) return;
    const created = await onCreateAlbum(trimmed);
    setNewAlbumInput('');
    setShowNewAlbumForm(false);
    onSelectAlbum(created.id);
  };

  // Photo Albums Bar (only inside the Photos module)
  const renderPhotoAlbumsSection = () => {
    if (activeTab !== 'photos') return null;

    return (
      <div className="glass card-sheen rounded-3xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-mint-500/20 to-teal-500/10 text-mint-600">
              <Folder className="w-[18px] h-[18px]" />
            </span>
            <h2 className="text-base font-bold text-slate-900">האלבומים שלי</h2>
          </div>

          <button
            type="button"
            onClick={() => setShowNewAlbumForm((prev) => !prev)}
            className="min-h-10 px-4 py-2 rounded-xl glass text-sm font-bold text-mint-700 hover:bg-slate-900/5 active:scale-95 transition flex items-center gap-2 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            <span>אלבום חדש</span>
          </button>
        </div>

        {showNewAlbumForm && (
          <form
            onSubmit={handleCreateAlbumInline}
            className="flex flex-col sm:flex-row items-stretch gap-2"
          >
            <label htmlFor="new-album-inline" className="sr-only">
              שם אלבום חדש
            </label>
            <input
              id="new-album-inline"
              type="text"
              value={newAlbumInput}
              onChange={(e) => setNewAlbumInput(e.target.value)}
              placeholder="שם האלבום החדש (למשל: קבלות, משפחה, עבודה)..."
              className="flex-1 min-h-11 px-4 rounded-xl glass text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-mint-500/60"
            />
            <button
              type="submit"
              className="btn-accent min-h-11 px-5 rounded-xl text-sm font-bold cursor-pointer"
            >
              צור אלבום
            </button>
          </form>
        )}

        <div
          role="tablist"
          aria-label="אלבומי תמונות"
          className="flex flex-wrap items-center gap-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedAlbumId === 'all'}
            onClick={() => onSelectAlbum('all')}
            className={`min-h-11 px-4 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
              selectedAlbumId === 'all'
                ? 'bg-gradient-to-br from-mint-500/15 to-teal-500/10 border-mint-500/40 text-mint-700'
                : 'glass text-slate-600 hover:bg-slate-900/5'
            }`}
          >
            <span>כל התמונות</span>
            <span className="font-mono text-xs opacity-80">({totalPhotosCount})</span>
          </button>

          {albums.map((album) => {
            const isSelected = selectedAlbumId === album.id;
            const count = albumPhotoCounts[album.id] || 0;
            return (
              <div
                key={album.id}
                className={`min-h-11 rounded-xl border flex items-center transition ${
                  isSelected
                    ? 'bg-gradient-to-br from-mint-500/15 to-teal-500/10 border-mint-500/40'
                    : 'glass hover:bg-slate-900/5'
                }`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => onSelectAlbum(album.id)}
                  className={`px-4 py-2 text-sm font-bold flex items-center gap-2 cursor-pointer ${
                    isSelected ? 'text-mint-700' : 'text-slate-600'
                  }`}
                >
                  <Folder
                    className={`w-4 h-4 ${
                      isSelected ? 'text-mint-600' : 'text-slate-500'
                    }`}
                  />
                  <span>{album.name}</span>
                  <span className="font-mono text-xs opacity-75">({count})</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteAlbum(album.id)}
                  aria-label={`מחיקת אלבום ${album.name}`}
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

  if (items.length === 0) {
    const selectedAlbumObj = albums.find((a) => a.id === selectedAlbumId);

    return (
      <div>
        {renderPhotoAlbumsSection()}
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
                : activeTab === 'photos' && selectedAlbumObj
                ? `האלבום "${selectedAlbumObj.name}" ריק`
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
                  activeTab === 'photos' && selectedAlbumId !== 'all'
                    ? selectedAlbumId
                    : undefined
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
        {renderPhotoAlbumsSection()}
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
                  <div className="flex items-center gap-2 text-[11px] text-slate-200 mt-1">
                    {item.albumName && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-white/15 border border-white/20 px-1.5 py-0.5 font-semibold text-mint-200 truncate max-w-[10rem]">
                        <Folder className="w-3 h-3 shrink-0" />
                        <span className="truncate">{item.albumName}</span>
                      </span>
                    )}
                    <span dir="ltr" className="font-mono tabular-nums">
                      {item.formattedDate}
                    </span>
                  </div>
                </div>
              </button>

              <div className="px-3.5 py-3 flex items-center justify-between border-t border-slate-900/[0.06]">
                <button
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className="min-h-10 px-3.5 py-1.5 rounded-xl text-sm font-bold text-mint-700 hover:bg-mint-500/10 active:scale-95 transition cursor-pointer"
                >
                  פתיחת תמונה
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onEditItem(item)}
                    aria-label={`עריכת ${item.title}`}
                    className="w-10 h-10 flex items-center justify-center rounded-xl glass text-slate-500 hover:text-mint-700 hover:border-mint-500/30 hover:bg-mint-500/10 transition cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void shareVaultItem(item)}
                    aria-label={`שיתוף ${item.title} בוואטסאפ`}
                    className="w-10 h-10 flex items-center justify-center rounded-xl glass text-slate-500 hover:border-[#25D366]/40 hover:bg-[#25D366]/10 transition cursor-pointer"
                  >
                    <WhatsAppIcon className="w-[18px] h-[18px]" />
                  </button>
                  {item.dataUrl && (
                    <a
                      href={item.dataUrl}
                      download={item.fileName}
                      aria-label={`הורדת ${item.title}`}
                      className="w-10 h-10 flex items-center justify-center rounded-xl glass text-slate-500 hover:text-slate-900 hover:bg-slate-900/5 transition cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteItem(item.id)}
                    aria-label={`מחיקת ${item.title}`}
                    className="w-10 h-10 flex items-center justify-center rounded-xl glass text-slate-400 hover:text-red-600 hover:border-red-500/30 hover:bg-red-500/10 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  // Documents / Recordings — large readable rows
  return (
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
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer border transition-colors ${
                    isRecording
                      ? 'bg-gradient-to-br from-mint-500/20 to-teal-500/10 border-mint-500/25 text-mint-600'
                      : 'bg-slate-900/[0.04] border-slate-900/[0.08] text-slate-500'
                  }`}
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
                  {isPhoto && item.albumName && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-bold text-mint-700">
                        אלבום: {item.albumName}
                      </span>
                    </>
                  )}
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
              <button
                type="button"
                onClick={() => onSelectItem(item)}
                className="min-h-10 px-4 py-2 rounded-xl glass text-sm font-bold text-slate-800 hover:bg-slate-900/5 active:scale-95 transition cursor-pointer"
              >
                פתח
              </button>

              <button
                type="button"
                onClick={() => onEditItem(item)}
                aria-label={`עריכת ${item.title}`}
                className="w-11 h-11 flex items-center justify-center rounded-xl glass text-slate-500 hover:text-mint-700 hover:border-mint-500/30 hover:bg-mint-500/10 transition cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => void shareVaultItem(item)}
                aria-label={`שיתוף ${item.title} בוואטסאפ`}
                className="w-11 h-11 flex items-center justify-center rounded-xl glass text-slate-500 hover:border-[#25D366]/40 hover:bg-[#25D366]/10 transition cursor-pointer"
              >
                <WhatsAppIcon className="w-[18px] h-[18px]" />
              </button>

              {item.dataUrl && (
                <a
                  href={item.dataUrl}
                  download={item.fileName}
                  aria-label={`הורדת ${item.title}`}
                  className="w-11 h-11 flex items-center justify-center rounded-xl glass text-slate-500 hover:text-slate-900 hover:bg-slate-900/5 transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                </a>
              )}

              <button
                type="button"
                onClick={() => onDeleteItem(item.id)}
                aria-label={`מחיקת ${item.title}`}
                className="w-11 h-11 flex items-center justify-center rounded-xl glass text-slate-400 hover:text-red-600 hover:border-red-500/30 hover:bg-red-500/10 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
