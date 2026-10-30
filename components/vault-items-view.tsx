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
} from 'lucide-react';
import {
  VaultItem,
  PhotoAlbum,
  FilterTab,
  MODULE_META,
} from '@/lib/vault-logic';

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

  // Simple Photo Albums Bar (only shown inside the Photos module)
  const renderPhotoAlbumsSection = () => {
    if (activeTab !== 'photos') return null;

    return (
      <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-900">האלבומים שלי</h2>
          </div>

          <button
            type="button"
            onClick={() => setShowNewAlbumForm((prev) => !prev)}
            className="h-10 px-4 rounded-xl bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 text-sm font-bold flex items-center gap-2 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-teal-600" />
            <span>+ אלבום חדש</span>
          </button>
        </div>

        {showNewAlbumForm && (
          <form
            onSubmit={handleCreateAlbumInline}
            className="flex items-center gap-2 pt-1"
          >
            <input
              type="text"
              value={newAlbumInput}
              onChange={(e) => setNewAlbumInput(e.target.value)}
              placeholder="שם האלבום החדש (למשל: קבלות, משפחה, עבודה)..."
              className="flex-1 h-11 px-4 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button
              type="submit"
              className="h-11 px-5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 cursor-pointer"
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
            className={`h-11 px-4 rounded-xl border text-sm font-bold flex items-center gap-2 cursor-pointer ${
              selectedAlbumId === 'all'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>כל התמונות</span>
            <span className="font-mono text-xs">({totalPhotosCount})</span>
          </button>

          {albums.map((album) => {
            const isSelected = selectedAlbumId === album.id;
            const count = albumPhotoCounts[album.id] || 0;
            return (
              <div
                key={album.id}
                className={`h-11 rounded-xl border flex items-center ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => onSelectAlbum(album.id)}
                  className="px-4 h-full text-sm font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Folder
                    className={`w-4 h-4 ${
                      isSelected ? 'text-teal-400' : 'text-teal-600'
                    }`}
                  />
                  <span>{album.name}</span>
                  <span className="font-mono text-xs opacity-75">({count})</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteAlbum(album.id)}
                  aria-label={`מחיקת אלבום ${album.name}`}
                  className="pl-3 pr-1 h-full text-slate-400 hover:text-red-500 cursor-pointer"
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
        <div className="p-10 sm:p-14 rounded-3xl border border-slate-200 bg-white text-center max-w-lg mx-auto my-4">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4">
            {activeTab === 'photos' ? (
              <ImageIcon className="w-8 h-8" />
            ) : activeTab === 'recordings' ? (
              <Mic className="w-8 h-8" />
            ) : (
              <FileText className="w-8 h-8" />
            )}
          </div>
          <h3 className="text-xl font-bold text-slate-900">
            {searchQuery
              ? `לא נמצאו תוצאות עבור "${searchQuery}"`
              : activeTab === 'photos' && selectedAlbumObj
              ? `האלבום "${selectedAlbumObj.name}" ריק`
              : 'אין עדיין קבצים כאן'}
          </h3>
          <p className="text-sm text-slate-500 mt-2">
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
            className="mt-6 h-13 px-7 rounded-2xl bg-slate-900 text-white text-base font-bold hover:bg-slate-800 inline-flex items-center gap-2.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-5 h-5 text-teal-400 stroke-[2.5]" />
            <span>העלאת קובץ חדש</span>
          </button>
        </div>
      </div>
    );
  }

  // Clean Photo Grid when in the Photos module
  if (activeTab === 'photos') {
    return (
      <div>
        {renderPhotoAlbumsSection()}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col justify-between hover:border-slate-300 transition-all"
            >
              <div>
                <button
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className="w-full h-52 bg-slate-900 overflow-hidden block cursor-pointer"
                >
                  {item.dataUrl ? (
                    <img
                      src={item.dataUrl}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <ImageIcon className="w-10 h-10" />
                    </div>
                  )}
                </button>

                <div className="p-4">
                  <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-2">
                    {item.albumName && (
                      <>
                        <span className="font-bold text-teal-700">
                          אלבום: {item.albumName}
                        </span>
                        <span>·</span>
                      </>
                    )}
                    <span dir="ltr" className="font-mono">
                      {item.formattedDate} · {item.formattedTime}
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className="text-sm font-bold text-teal-700 hover:underline cursor-pointer"
                >
                  פתיחת תמונה
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteItem(item.id)}
                  aria-label={`מחיקת ${item.title}`}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  // Simple, Large, Easy-to-Read File Rows
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isPhoto = item.module === 'photos';
        const isRecording = item.module === 'recordings';

        return (
          <article
            key={item.id}
            className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4 min-w-0 flex-1">
              {isPhoto && item.dataUrl ? (
                <button
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className="w-14 h-14 rounded-xl overflow-hidden bg-slate-900 shrink-0 cursor-pointer"
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
                  className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 cursor-pointer ${
                    isRecording
                      ? 'bg-teal-50 text-teal-700'
                      : 'bg-slate-100 text-slate-800'
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
                  className="text-right text-lg font-bold text-slate-900 hover:text-teal-700 truncate block w-full cursor-pointer"
                >
                  {item.title}
                </button>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                  <span className="font-semibold text-slate-700">
                    {MODULE_META[item.module].singularLabel}
                  </span>
                  {isPhoto && item.albumName && (
                    <>
                      <span>·</span>
                      <span className="font-bold text-teal-700">
                        אלבום: {item.albumName}
                      </span>
                    </>
                  )}
                  <span>·</span>
                  <span dir="ltr" className="font-mono text-slate-700">
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

            <div className="flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onSelectItem(item)}
                className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-900 cursor-pointer"
              >
                פתח
              </button>

              {item.dataUrl && (
                <a
                  href={item.dataUrl}
                  download={item.fileName}
                  aria-label={`הורדת ${item.title}`}
                  className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  <Download className="w-4 h-4" />
                </a>
              )}

              <button
                type="button"
                onClick={() => onDeleteItem(item.id)}
                aria-label={`מחיקת ${item.title}`}
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
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
