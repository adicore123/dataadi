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
import { shareVaultItem } from '@/lib/share';
import { WhatsAppIcon } from '@/components/whatsapp-icon';

interface ItemPreviewModalProps {
  item: VaultItem | null;
  albums: PhotoAlbum[];
  /** Open straight into edit mode (quick-edit pencil buttons). */
  initialEditing?: boolean;
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
  initialEditing = false,
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
      setIsEditing(initialEditing);
      setEditTitle(item.title);
      setEditModule(item.module);
      setEditAlbumId(item.albumId || '');
      setNewAlbumName('');
      setEditNotes(item.notes || '');
    }
  }, [item, initialEditing]);

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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4"
    >
      <div className="w-full max-w-2xl rounded-t-4xl sm:rounded-4xl glass-strong shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Sheet handle (mobile affordance) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1" aria-hidden="true">
          <div className="sheet-handle" />
        </div>

        {/* Top Bar */}
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-slate-900/[0.08]">
          <div className="min-w-0 flex-1">
            <h2
              id="preview-modal-title"
              className="text-lg font-bold tracking-tight text-slate-900 break-words"
            >
              {item.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1.5 tabular-nums">
              <span className="font-semibold text-slate-700 rounded-md bg-slate-900/[0.05] border border-slate-900/[0.08] px-1.5 py-0.5">
                {MODULE_META[item.module].label}
              </span>
              {item.module === 'photos' && item.albumName && (
                <span className="font-bold text-mint-700 rounded-md bg-mint-500/10 border border-mint-500/25 px-1.5 py-0.5 inline-flex items-center gap-1">
                  <Folder className="w-3 h-3" />
                  {item.albumName}
                </span>
              )}
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
            className="w-11 h-11 flex items-center justify-center rounded-2xl glass text-slate-500 hover:text-slate-900 hover:bg-slate-900/5 active:scale-95 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Photo viewer */}
          {item.module === 'photos' && item.dataUrl && (
            <div className="rounded-3xl overflow-hidden border border-slate-900/[0.08] bg-vault-100 flex items-center justify-center max-h-80">
              <img
                src={item.dataUrl}
                alt={item.title}
                referrerPolicy="no-referrer"
                className="max-h-80 w-auto object-contain"
              />
            </div>
          )}

          {/* Recording player */}
          {item.module === 'recordings' && (
            <div className="p-5 rounded-3xl glass space-y-3">
              <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
                <span className="flex items-center gap-2 font-semibold min-w-0">
                  <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-mint-500/20 to-teal-500/10 text-mint-600 shrink-0">
                    <Mic className="w-4 h-4" />
                  </span>
                  <span className="truncate">נגן הקלטה קולית — {item.fileName}</span>
                </span>
                {item.durationSec !== undefined && (
                  <span className="font-mono tabular-nums shrink-0">
                    משך: {formatDuration(item.durationSec)}
                  </span>
                )}
              </div>
              {item.dataUrl ? (
                <audio controls src={item.dataUrl} className="w-full h-10" />
              ) : (
                <p className="text-xs text-slate-400">קובץ שמע מתועד במערכת</p>
              )}
            </div>
          )}

          {/* Document card */}
          {item.module === 'documents' && (
            <div className="p-5 rounded-3xl glass space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-mint-500/20 to-teal-500/10 border border-mint-500/25 text-mint-600 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {item.fileName}
                    </p>
                    <p className="text-xs text-slate-500 font-mono tabular-nums">
                      תאריך העלאה: {item.formattedDate} בשעה {item.formattedTime}
                    </p>
                  </div>
                </div>
              </div>
              {item.dataUrl && item.dataUrl.startsWith('data:text/plain') && (
                <div className="p-4 rounded-2xl bg-slate-900/[0.03] border border-slate-900/[0.08] text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                  {decodeURIComponent(
                    item.dataUrl.replace(/^data:text\/plain;charset=utf-8,/, '')
                  )}
                </div>
              )}
            </div>
          )}

          {item.notes && !isEditing && (
            <div className="text-sm text-slate-600 bg-slate-900/[0.02] border border-slate-900/[0.08] p-4 rounded-2xl">
              <span className="block text-xs font-bold text-slate-400 mb-1">
                הערות ותקציר:
              </span>
              {item.notes}
            </div>
          )}

          {/* Edit form */}
          {isEditing && (
            <form
              onSubmit={handleSaveEdit}
              className="p-4 rounded-3xl glass space-y-4"
            >
              <div>
                <label
                  htmlFor="edit-item-title"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  עריכת כותרת הפריט:
                </label>
                <input
                  id="edit-item-title"
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full min-h-11 px-3.5 rounded-xl glass text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-mint-500/60"
                />
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-700 mb-1.5">
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
                        aria-pressed={active}
                        className={`min-h-11 p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          active
                            ? 'bg-gradient-to-br from-mint-500/15 to-teal-500/10 border-mint-500/40 text-mint-700'
                            : 'glass text-slate-600 hover:bg-slate-900/5'
                        }`}
                      >
                        <Icon
                          className={`w-3.5 h-3.5 ${
                            active ? 'text-mint-600' : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">{mod.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {editModule === 'photos' && (
                <div className="p-3 rounded-2xl border border-mint-500/25 bg-mint-500/[0.05] space-y-2.5">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-mint-600" />
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
                          className={`min-h-10 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                            editAlbumId === alb.id && !newAlbumName
                              ? 'bg-gradient-to-br from-mint-500/15 to-teal-500/10 border-mint-500/40 text-mint-700'
                              : 'glass text-slate-600 hover:bg-slate-900/5'
                          }`}
                        >
                          {alb.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <FolderPlus className="w-4 h-4 text-mint-600 shrink-0" />
                    <label htmlFor="edit-new-album" className="sr-only">
                      שם אלבום חדש
                    </label>
                    <input
                      id="edit-new-album"
                      type="text"
                      value={newAlbumName}
                      onChange={(e) => setNewAlbumName(e.target.value)}
                      placeholder="או הקלד שם לאלבום חדש..."
                      className="flex-1 min-h-10 px-3 rounded-xl glass text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-mint-500/60"
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="edit-item-notes"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  הערה:
                </label>
                <input
                  id="edit-item-notes"
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full min-h-11 px-3.5 rounded-xl glass text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-mint-500/60"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="min-h-10 py-2 px-4 rounded-xl glass text-xs font-semibold text-slate-600 hover:bg-slate-900/5 transition cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="btn-accent min-h-10 py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>שמור שינויים</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t border-slate-900/[0.08] pb-safe">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing((v) => !v)}
              className="min-h-10 py-2 px-3.5 rounded-xl glass text-xs font-semibold text-slate-700 hover:bg-slate-900/5 active:scale-95 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5 text-mint-600" />
              <span>ערוך כותרת / מודול / אלבום</span>
            </button>

            {item.dataUrl && (
              <a
                href={item.dataUrl}
                download={item.fileName}
                className="min-h-10 py-2 px-3.5 rounded-xl glass text-xs font-semibold text-slate-700 hover:bg-slate-900/5 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>הורדת קובץ</span>
              </a>
            )}

            <button
              type="button"
              onClick={() => void shareVaultItem(item)}
              className="min-h-10 py-2 px-3.5 rounded-xl glass text-xs font-semibold text-slate-700 hover:border-[#25D366]/40 hover:bg-[#25D366]/10 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <WhatsAppIcon className="w-3.5 h-3.5" />
              <span>שיתוף בוואטסאפ</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onDeleteItem(item.id);
              onClose();
            }}
            className="min-h-10 py-2 px-3.5 rounded-xl border border-red-500/25 bg-red-500/10 text-xs font-semibold text-red-600 hover:bg-red-500/15 active:scale-95 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>מחק פריט</span>
          </button>
        </div>
      </div>
    </div>
  );
}
