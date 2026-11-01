'use client';

import React, { useState, useEffect } from 'react';
import {
  Download,
  Trash2,
  FileText,
  Image as ImageIcon,
  Mic,
  Check,
  Edit3,
  Folder as FolderIcon,
  Tag,
  Star,
  CalendarClock,
} from 'lucide-react';
import {
  VaultItem,
  Folder,
  VaultItemUpdates,
  ModuleType,
  MODULE_META,
  formatFileSizeHe,
  formatDuration,
} from '@/lib/vault-logic';
import { shareVaultItem } from '@/lib/share';
import { WhatsAppIcon } from '@/components/whatsapp-icon';
import { ModalShell } from '@/components/ui/modal-shell';
import { FolderPicker } from '@/components/ui/folder-picker';
import { ModuleRadioGroup } from '@/components/ui/module-radio-group';
import { TagsInput } from '@/components/ui/tags-input';

interface ItemPreviewModalProps {
  item: VaultItem | null;
  folders: Folder[];
  /** Open straight into edit mode (quick-edit pencil buttons). */
  initialEditing?: boolean;
  onClose: () => void;
  onCreateFolder: (name: string, module: ModuleType) => Promise<Folder>;
  onUpdateItem: (id: string, updates: VaultItemUpdates) => void;
  onToggleFavorite: (item: VaultItem) => void;
  onDeleteItem: (id: string) => void;
}

export function ItemPreviewModal({
  item,
  folders,
  initialEditing = false,
  onClose,
  onCreateFolder,
  onUpdateItem,
  onToggleFavorite,
  onDeleteItem,
}: ItemPreviewModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editModule, setEditModule] = useState<ModuleType>('documents');
  const [editFolderId, setEditFolderId] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editExpiresAt, setEditExpiresAt] = useState('');
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    if (item) {
      setIsEditing(initialEditing);
      setEditTitle(item.title);
      setEditModule(item.module);
      setEditFolderId(item.folderId || '');
      setNewFolderName('');
      setEditTags(item.tags ? [...item.tags] : []);
      setEditExpiresAt(item.expiresAt || '');
      setEditNotes(item.notes || '');
    }
  }, [item, initialEditing]);

  if (!item) return null;

  const moduleFolders = folders.filter((f) => f.module === editModule);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;

    let finalFolderId = editFolderId;
    let finalFolderName = '';

    if (newFolderName.trim()) {
      const created = await onCreateFolder(newFolderName.trim(), editModule);
      finalFolderId = created.id;
      finalFolderName = created.name;
    } else if (finalFolderId) {
      const found = folders.find((f) => f.id === finalFolderId);
      finalFolderName = found ? found.name : '';
    }

    onUpdateItem(item.id, {
      title: editTitle.trim(),
      module: editModule,
      folderId: finalFolderId,
      folderName: finalFolderName,
      tags: editTags,
      favorite: Boolean(item.favorite),
      expiresAt: editExpiresAt || undefined,
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

  const metaLine = (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1.5 tabular-nums">
      <span className="font-semibold text-slate-700 rounded-md bg-slate-900/[0.05] border border-slate-900/[0.08] px-1.5 py-0.5">
        {MODULE_META[item.module].label}
      </span>
      {item.folderName && (
        <span className="font-bold text-mint-700 rounded-md bg-mint-500/10 border border-mint-500/25 px-1.5 py-0.5 inline-flex items-center gap-1">
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
      {item.expiresAt && (
        <span className="font-bold text-amber-700 rounded-md bg-amber-400/15 border border-amber-500/30 px-1.5 py-0.5 inline-flex items-center gap-1">
          <CalendarClock className="w-3 h-3" />
          תוקף: {item.expiresAt}
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
  );

  return (
    <ModalShell
      titleId="preview-modal-title"
      title={item.title}
      closeLabel="סגירת תצוגה מקדימה"
      maxWidth="max-w-2xl"
      onClose={onClose}
      headerExtra={metaLine}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing((v) => !v)}
              className="min-h-10 py-2 px-3.5 rounded-xl glass text-xs font-semibold text-slate-700 hover:bg-slate-900/5 active:scale-95 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5 text-mint-600" />
              <span>ערוך כותרת / מודול / תיקייה</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleFavorite(item)}
              aria-label={item.favorite ? `הסרת ${item.title} מהמועדפים` : `הוספת ${item.title} למועדפים`}
              aria-pressed={Boolean(item.favorite)}
              className={
                item.favorite
                  ? 'min-h-10 py-2 px-3.5 rounded-xl bg-amber-400/20 border border-amber-500/40 text-xs font-bold text-amber-700 active:scale-95 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap'
                  : 'min-h-10 py-2 px-3.5 rounded-xl glass text-xs font-semibold text-slate-700 hover:bg-slate-900/5 active:scale-95 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap'
              }
            >
              <Star className={'w-3.5 h-3.5' + (item.favorite ? ' fill-amber-500 text-amber-500' : ' text-amber-500')} />
              <span>{item.favorite ? 'במועדפים' : 'הוסף למועדפים'}</span>
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
      }
    >
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
          {/* Real PDF viewer — the browser renders the data URL natively. */}
          {item.dataUrl && item.dataUrl.startsWith('data:application/pdf') && (
            <object
              data={item.dataUrl}
              type="application/pdf"
              aria-label={`תצוגת ${item.fileName}`}
              className="w-full h-[70vh] rounded-2xl border border-slate-900/[0.08] bg-white"
            >
              <div className="p-4 text-center text-sm text-slate-500">
                הדפדפן לא תומך בתצוגת PDF מוטמעת —
                <a href={item.dataUrl} download={item.fileName} className="text-mint-700 font-bold underline">
                  הורד/י את הקובץ
                </a>
              </div>
            </object>
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
        <form onSubmit={handleSaveEdit} className="p-4 rounded-3xl glass space-y-4">
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
              className="input-glass w-full"
            />
          </div>

          <div>
            <span className="block text-xs font-bold text-slate-700 mb-1.5">
              העברה למודול אחר:
            </span>
            <ModuleRadioGroup
              value={editModule}
              onChange={(m) => {
                setEditModule(m);
                setEditFolderId('');
                setNewFolderName('');
              }}
              variant="compact"
            />
          </div>

          <FolderPicker
            folders={moduleFolders}
            selectedFolderId={editFolderId}
            newFolderName={newFolderName}
            onSelectFolder={(id) => {
              setEditFolderId(id);
              setNewFolderName('');
            }}
            onNewFolderNameChange={setNewFolderName}
            onQuickCreate={async () => {
              const trimmed = newFolderName.trim();
              if (!trimmed) return;
              const created = await onCreateFolder(trimmed, editModule);
              setEditFolderId(created.id);
              setNewFolderName('');
            }}
            question={`תיקייה ב${MODULE_META[editModule].shortLabel}:`}
            inputId="edit-new-folder"
            compact
          />

          <TagsInput tags={editTags} onChange={setEditTags} inputId="edit-item-tags" compact />

          <div>
            <label
              htmlFor="edit-item-expiry"
              className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5"
            >
              <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
              תאריך תוקף (אופציונלי — דרכון, רישיון, ביטוח...):
            </label>
            <input
              id="edit-item-expiry"
              type="date"
              value={editExpiresAt}
              onChange={(e) => setEditExpiresAt(e.target.value)}
              className="input-glass w-full"
            />
          </div>

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
              className="input-glass w-full"
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
    </ModalShell>
  );
}
