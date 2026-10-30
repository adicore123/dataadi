'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Trash2,
  FileText,
  Image as ImageIcon,
  Mic,
  Check,
  Edit3,
  Folder,
  FolderPlus,
} from 'lucide-react';
import {
  VaultItem,
  PhotoAlbum,
  ModuleType,
  MODULE_META,
  formatFileSizeHe,
  formatDuration,
} from '@/lib/vault-logic';

interface ItemPreviewModalProps {
  item: VaultItem | null;
  albums: PhotoAlbum[];
  onClose: () => void;
  onCreateAlbum: (name: string) => Promise<PhotoAlbum>;
  onUpdateItem: (
    id: string,
    updates: {
      title: string;
      module: ModuleType;
      albumId?: string;
      albumName?: string;
      notes?: string;
    }
  ) => void;
  onDeleteItem: (id: string) => void;
}

export function ItemPreviewModal({
  item,
  albums,
  onClose,
  onCreateAlbum,
  onUpdateItem,
  onDeleteItem,
}: ItemPreviewModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editModule, setEditModule] = useState<ModuleType>('documents');
  const [editAlbumId, setEditAlbumId] = useState('');
  const [newAlbumName, setNewAlbumName] = useState('');
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    if (item) {
      setIsEditing(false);
      setEditTitle(item.title);
      setEditModule(item.module);
      setEditAlbumId(item.albumId || '');
      setNewAlbumName('');
      setEditNotes(item.notes || '');
    }
  }, [item]);

  if (!item) return null;

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;

    let finalAlbumId = editAlbumId;
    let finalAlbumName = '';

    if (editModule === 'photos') {
      if (newAlbumName.trim()) {
        const created = await onCreateAlbum(newAlbumName.trim());
        finalAlbumId = created.id;
        finalAlbumName = created.name;
      } else if (finalAlbumId) {
        const found = albums.find((a) => a.id === finalAlbumId);
        finalAlbumName = found ? found.name : '';
      }
    }

    onUpdateItem(item.id, {
      title: editTitle.trim(),
      module: editModule,
      albumId: editModule === 'photos' ? finalAlbumId : '',
      albumName: editModule === 'photos' ? finalAlbumName : '',
      notes: editNotes.trim() || undefined,
    });
    setIsEditing(false);
  };

  const sourceLabel =
    item.source === 'mobile-share'
      ? 'שותף מהמובייל'
      : item.source === 'voice-recorder'
      ? 'הוקלט במערכת'
      : 'הועלה למערכת';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
    >
      <div className="w-full max-w-2xl rounded-t-3xl sm:rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Top Bar */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="min-w-0 flex-1">
            <h2
              id="preview-modal-title"
              className="text-lg font-bold text-slate-900 break-words"
            >
              {item.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1 tabular-nums">
              <span className="font-semibold text-slate-700">
                {MODULE_META[item.module].label}
              </span>
              {item.module === 'photos' && item.albumName && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-bold text-teal-700">
                    אלבום: {item.albumName}
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span dir="ltr" className="font-mono">
                {item.formattedDate} · {item.formattedTime}
              </span>
              <span aria-hidden="true">·</span>
              <span dir="ltr" className="font-mono">
                {formatFileSizeHe(item.fileSize)}
              </span>
              <span aria-hidden="true">·</span>
              <span>{sourceLabel}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="סגירת תצוגה מקדימה"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Media / File Viewer */}
          {item.module === 'photos' && item.dataUrl && (
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center max-h-80">
              <img
                src={item.dataUrl}
                alt={item.title}
                referrerPolicy="no-referrer"
                className="max-h-80 w-auto object-contain"
              />
            </div>
          )}

          {item.module === 'recordings' && (
            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="flex items-center gap-2 font-semibold text-slate-800">
                  <Mic className="w-4 h-4 text-teal-600" />
                  <span>נגן הקלטה קולית — {item.fileName}</span>
                </span>
                {item.durationSec !== undefined && (
                  <span className="font-mono tabular-nums">
                    משך: {formatDuration(item.durationSec)}
                  </span>
                )}
              </div>
              {item.dataUrl ? (
                <audio controls src={item.dataUrl} className="w-full h-10" />
              ) : (
                <p className="text-xs text-slate-500">קובץ שמע מתועד במערכת</p>
              )}
            </div>
          )}

          {item.module === 'documents' && (
            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-teal-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {item.fileName}
                    </p>
                    <p className="text-xs text-slate-500 font-mono tabular-nums">
                      תאריך העלאה: {item.formattedDate} בשעה {item.formattedTime}
                    </p>
                  </div>
                </div>
              </div>
              {item.dataUrl && item.dataUrl.startsWith('data:text/plain') && (
                <div className="p-4 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {decodeURIComponent(
                    item.dataUrl.replace(/^data:text\/plain;charset=utf-8,/, '')
                  )}
                </div>
              )}
            </div>
          )}

          {item.notes && !isEditing && (
            <div className="text-sm text-slate-700 bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
              <span className="block text-xs font-bold text-slate-500 mb-1">
                הערות ותקציר:
              </span>
              {item.notes}
            </div>
          )}

          {/* Edit Title / Move Module / Change Album Form */}
          {isEditing && (
            <form
              onSubmit={handleSaveEdit}
              className="p-4 rounded-xl border border-slate-300 bg-slate-50 space-y-4"
            >
              <div>
                <label
                  htmlFor="edit-item-title"
                  className="block text-xs font-bold text-slate-800 mb-1"
                >
                  עריכת כותרת הפריט:
                </label>
                <input
                  id="edit-item-title"
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900"
                />
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-800 mb-1.5">
                  העברה למודול אחר:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'documents', label: 'מסמכים חשובים', icon: FileText },
                      { id: 'photos', label: 'תמונות', icon: ImageIcon },
                      { id: 'recordings', label: 'הקלטות', icon: Mic },
                    ] as const
                  ).map((mod) => {
                    const Icon = mod.icon;
                    const active = editModule === mod.id;
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => setEditModule(mod.id)}
                        className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{mod.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {editModule === 'photos' && (
                <div className="p-3 rounded-xl border border-teal-200 bg-white space-y-2.5">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-teal-600" />
                    <span>שיוך לאלבום תמונות:</span>
                  </span>
                  {albums.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {albums.map((alb) => (
                        <button
                          key={alb.id}
                          type="button"
                          onClick={() => {
                            setEditAlbumId(alb.id);
                            setNewAlbumName('');
                          }}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                            editAlbumId === alb.id && !newAlbumName
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {alb.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <FolderPlus className="w-4 h-4 text-teal-600 shrink-0" />
                    <input
                      type="text"
                      value={newAlbumName}
                      onChange={(e) => setNewAlbumName(e.target.value)}
                      placeholder="או הקלד שם לאלבום חדש..."
                      className="flex-1 h-9 px-2.5 rounded-lg border border-slate-300 text-xs text-slate-900"
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="edit-item-notes"
                  className="block text-xs font-bold text-slate-800 mb-1"
                >
                  הערה:
                </label>
                <input
                  id="edit-item-notes"
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="py-2 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>שמור שינויים</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing((v) => !v)}
              className="py-2 px-3.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>ערוך כותרת / מודול / אלבום</span>
            </button>

            {item.dataUrl && (
              <a
                href={item.dataUrl}
                download={item.fileName}
                className="py-2 px-3.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-100 flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>הורדת קובץ</span>
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onDeleteItem(item.id);
              onClose();
            }}
            className="py-2 px-3.5 rounded-xl border border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>מחק פריט</span>
          </button>
        </div>
      </div>
    </div>
  );
}
