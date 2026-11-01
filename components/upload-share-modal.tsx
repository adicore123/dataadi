'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Upload,
  Mic,
  Square,
  AlertCircle,
  FolderCheck,
  CalendarClock,
  Sparkles,
} from 'lucide-react';
import {
  ModuleType,
  Folder,
  MODULE_META,
  detectModuleFromMime,
  formatFileSizeHe,
  formatDuration,
  CreateVaultItemInput,
} from '@/lib/vault-logic';
import { suggestTags } from '@/lib/tag-suggestions';
import { ModalShell } from '@/components/ui/modal-shell';
import { FolderPicker } from '@/components/ui/folder-picker';
import { ModuleRadioGroup } from '@/components/ui/module-radio-group';
import { TagsInput } from '@/components/ui/tags-input';

export interface SharedDraft {
  title?: string;
  notes?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  dataUrl?: string;
  suggestedModule?: ModuleType;
  suggestedFolderId?: string;
}

export type UploadMode = 'upload' | 'record' | 'simulate-share';
export type UploadDestinationMode = 'fixed' | 'auto' | 'choose';

export interface UploadShareModalProps {
  isOpen: boolean;
  initialMode: UploadMode;
  destinationMode: UploadDestinationMode;
  defaultModule: ModuleType;
  folders: Folder[];
  defaultFolderId?: string;
  incomingShareDraft?: SharedDraft | null;
  /** Optional recovery banner (e.g. shared file not captured automatically). */
  notice?: string | null;
  onClose: () => void;
  onCreateFolder: (name: string, module: ModuleType) => Promise<Folder>;
  onSaveItem: (input: CreateVaultItemInput) => Promise<void> | void;
}

const DEFAULT_MIME: Record<ModuleType, string> = {
  photos: 'image/jpeg',
  recordings: 'audio/wav',
  documents: 'application/pdf',
};

export function UploadShareModal({
  isOpen,
  initialMode,
  destinationMode,
  defaultModule,
  folders,
  defaultFolderId,
  incomingShareDraft,
  notice,
  onClose,
  onCreateFolder,
  onSaveItem,
}: UploadShareModalProps) {
  // null = nothing selected yet (mobile-share flow: the user always picks the
  // destination module themselves — no auto-detection preselection).
  const [selectedModule, setSelectedModule] = useState<ModuleType | null>(defaultModule);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [newFolderName, setNewFolderName] = useState<string>('');

  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [mimeType, setMimeType] = useState(DEFAULT_MIME[defaultModule]);
  const [dataUrl, setDataUrl] = useState<string | undefined>(undefined);
  const [durationSec, setDurationSec] = useState<number | undefined>(undefined);
  const [source, setSource] = useState<'upload' | 'mobile-share' | 'voice-recorder'>('upload');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoDestinationResolved, setAutoDestinationResolved] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Only the folders of the currently chosen module are offered.
  const moduleFolders = useMemo(
    () => folders.filter((f) => f.module === (selectedModule || defaultModule)),
    [folders, selectedModule, defaultModule]
  );

  // Keep the selection valid whenever the module (or folder list) changes.
  useEffect(() => {
    if (selectedFolderId && !moduleFolders.some((f) => f.id === selectedFolderId)) {
      setSelectedFolderId(moduleFolders[0]?.id || '');
    }
  }, [moduleFolders, selectedFolderId]);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setIsSubmitting(false);
    setAutoDestinationResolved(destinationMode !== 'auto');
    setNewFolderName('');
    setTags([]);
    setExpiresAt('');

    const initialFolderId =
      incomingShareDraft?.suggestedFolderId ||
      (defaultFolderId && defaultFolderId !== 'all' ? defaultFolderId : '');
    setSelectedFolderId(initialFolderId);

    if (incomingShareDraft) {
      setTitle(incomingShareDraft.title || '');
      setFileName(incomingShareDraft.fileName || '');
      setFileSize(incomingShareDraft.fileSize || 0);
      setMimeType(incomingShareDraft.mimeType || 'application/octet-stream');
      setDataUrl(incomingShareDraft.dataUrl);
      // Mobile share: user picks the destination module manually — no
      // automatic preselection from the file type.
      setSelectedModule(incomingShareDraft.suggestedModule || null);
      setSource('mobile-share');
    } else if (initialMode === 'simulate-share') {
      setSelectedModule(null);
      setTitle('');
      setFileName('');
      setFileSize(0);
      setMimeType('application/octet-stream');
      setDataUrl(undefined);
      setDurationSec(undefined);
      setSource('mobile-share');
    } else if (initialMode === 'record') {
      setSelectedModule('recordings');
      setTitle('');
      setFileName('');
      setFileSize(0);
      setMimeType('audio/wav');
      setDataUrl(undefined);
      setDurationSec(undefined);
      setSource('voice-recorder');
    } else {
      setSelectedModule(defaultModule);
      setTitle('');
      setFileName('');
      setFileSize(0);
      setMimeType(DEFAULT_MIME[defaultModule]);
      setDataUrl(undefined);
      setDurationSec(undefined);
      setSource('upload');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    initialMode,
    destinationMode,
    defaultModule,
    defaultFolderId,
    incomingShareDraft,
  ]);

  useEffect(() => {
    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);

    const detected = detectModuleFromMime(file.type, file.name);
    // 'fixed' keeps the module it was opened with; 'auto' (in-app upload
    // from "all files") detects silently; 'choose' (mobile share) never
    // overrides the user's own selection.
    if (destinationMode === 'auto') {
      setSelectedModule(detected);
      setAutoDestinationResolved(true);
    }
    setFileName(file.name);
    setFileSize(file.size);
    setMimeType(file.type || 'application/octet-stream');

    if (!title.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(cleanName);
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleQuickCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setErrorMsg('נא לכתוב שם לתיקייה החדשה');
      return;
    }
    setErrorMsg(null);
    const created = await onCreateFolder(trimmed, selectedModule || defaultModule);
    setSelectedFolderId(created.id);
    setNewFolderName('');
  };

  const startVoiceRecording = async () => {
    setErrorMsg(null);
    setRecSeconds(0);
    setIsRecording(true);
    setSelectedModule('recordings');
    if (destinationMode === 'auto') {
      setAutoDestinationResolved(true);
    }
    setSource('voice-recorder');

    recTimerRef.current = setInterval(() => {
      setRecSeconds((prev) => prev + 1);
    }, 1000);

    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        chunksRef.current = [];
        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunksRef.current.push(ev.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          setFileSize(blob.size);
          setMimeType(blob.type || 'audio/webm');
          setFileName(`voice-note-${Date.now()}.webm`);
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') setDataUrl(reader.result);
          };
          reader.readAsDataURL(blob);
        };
        mediaRecorderRef.current = recorder;
        recorder.start();
      }
    } catch {
      // Mic denied — surfaced on stop.
    }
  };

  const stopVoiceRecording = () => {
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    setIsRecording(false);
    const finalDuration = Math.max(2, recSeconds);
    setDurationSec(finalDuration);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      if (!title.trim()) {
        setTitle(`הקלטה קולית (${finalDuration} שניות)`);
      }
    } else {
      // Mic unavailable/denied — surface an error instead of faking audio.
      setDurationSec(undefined);
      setErrorMsg('לא הצלחנו להקליט מהמיקרופון — נסה שוב או צרף קובץ הקלטה קיים בשלב 1');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!title.trim()) {
      setErrorMsg('נא לכתוב כותרת לקובץ');
      return;
    }

    if (destinationMode === 'choose' && !selectedModule) {
      setErrorMsg('נא לבחור לאן להכניס את הקובץ (מסמכים / תמונות / הקלטות)');
      return;
    }

    if (destinationMode === 'auto' && !autoDestinationResolved) {
      setErrorMsg('נא לבחור קובץ כדי שהמערכת תזהה לאן להעלות אותו');
      return;
    }

    // After validation the module is always known ('fixed'/'auto' prefill it;
    // 'choose' passed the check above). Fallback keeps TS happy.
    const targetModule: ModuleType = selectedModule || defaultModule;

    // Photos and recordings are binary content — saving without an actual
    // file would fake it. Block instead and tell the user.
    if (!dataUrl && (targetModule === 'photos' || targetModule === 'recordings')) {
      setErrorMsg(
        'הקובץ עצמו עדיין לא נבחר! גלול לשלב 1 בראש הטופס ← לחץ על המסגרת ← בחר את הקובץ מהטלפון ← ואז שמור'
      );
      return;
    }

    // Non-image files above the storage ceiling (base64 dataUrl > 760K chars)
    // would be silently stripped by ensureCloudSafeDataUrl and saved as an
    // EMPTY item. Block the save with a clear reason instead. Images are
    // canvas-compressed downstream and are not affected by this check.
    if (dataUrl && !dataUrl.startsWith('data:image') && dataUrl.length > 760_000) {
      setErrorMsg(
        'הקובץ גדול מדי לשמירה בכספת (מעל ~550KB לקבצים שאינם תמונות) — התוכן היה נשמר ריק. דחוס/י או קצר/י את הקובץ ונסה שוב'
      );
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      // Folder resolution: on-the-fly creation wins, then the selection.
      let targetFolderId = '';
      let targetFolderName = '';
      if (newFolderName.trim()) {
        const created = await onCreateFolder(newFolderName.trim(), targetModule);
        targetFolderId = created.id;
        targetFolderName = created.name;
      } else if (selectedFolderId) {
        const found = folders.find((f) => f.id === selectedFolderId && f.module === targetModule);
        if (found) {
          targetFolderId = found.id;
          targetFolderName = found.name;
        }
      }

      const finalFileName =
        fileName.trim() || `${title.trim().slice(0, 25)}.${targetModule === 'photos' ? 'jpg' : targetModule === 'recordings' ? 'wav' : 'pdf'}`;
      const finalSize = fileSize > 0 ? fileSize : 48200;

      // Only documents can be saved without a file (as a visible text note
      // built from the title) — photos/recordings are blocked by validation.
      const finalDataUrl =
        dataUrl || `data:text/plain;charset=utf-8,${encodeURIComponent(title.trim())}`;

      await onSaveItem({
        title: title.trim(),
        module: targetModule,
        folderId: targetFolderId || undefined,
        folderName: targetFolderName || undefined,
        tags,
        expiresAt: expiresAt || undefined,
        fileName: finalFileName,
        fileSize: finalSize,
        mimeType,
        dataUrl: finalDataUrl,
        durationSec: targetModule === 'recordings' ? durationSec || 3 : undefined,
        source,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'שגיאה בשמירת הקובץ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fixedFolderSelected =
    destinationMode === 'fixed' && Boolean(defaultFolderId);
  const fixedFolderName = folders.find((f) => f.id === defaultFolderId)?.name;
  // Destination questions (module + folder) are asked ONLY when a file is
  // shared in from the phone ('choose'). Uploading from inside the app saves
  // silently to the module (and folder, when one is open) the user views.
  const showFolderPicker = destinationMode === 'choose' && !fixedFolderSelected;
  const destinationHint =
    destinationMode === 'choose'
      ? null
      : destinationMode === 'auto' && !autoDestinationResolved
      ? 'סוג הקובץ יזוהה אוטומטית בעת הבחירה'
      : `יישמר ב: ${MODULE_META[selectedModule || defaultModule].label}${
          fixedFolderSelected && fixedFolderName ? ` · תיקייה ${fixedFolderName}` : ''
        }`;
  const titleStepNumber = destinationMode === 'choose' ? 3 : 2;
  const acceptedFileTypes =
    destinationMode === 'fixed' ? MODULE_META[defaultModule].acceptAttr : undefined;

  return (
    <ModalShell
      titleId="upload-share-modal-title"
      title="העלאת קובץ חדש"
      closeLabel="סגירה"
      onClose={onClose}
      headerExtra={
        <>
          {destinationHint && (
            <div className="inline-flex items-center gap-2 rounded-xl bg-mint-500/10 border border-mint-500/25 px-3 py-1.5 text-xs font-semibold text-mint-700">
              <FolderCheck className="w-3.5 h-3.5 text-mint-600 shrink-0" />
              <span>{destinationHint}</span>
            </div>
          )}
          {notice && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-400/15 border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-700">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{notice}</span>
            </div>
          )}
        </>
      }
      footer={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 px-5 py-3 rounded-2xl glass text-sm font-bold text-slate-600 hover:bg-slate-900/5 active:scale-95 transition cursor-pointer"
          >
            ביטול
          </button>
          <button
            type="submit"
            form="upload-share-form"
            disabled={isSubmitting}
            className="btn-accent flex-1 min-h-12 py-3 rounded-2xl text-base font-bold disabled:opacity-50 disabled:shadow-none cursor-pointer"
          >
            {isSubmitting ? 'שומר...' : 'שמור קובץ'}
          </button>
        </div>
      }
    >
      {/* 3-Step Form */}
      <form id="upload-share-form" onSubmit={handleSubmit} className="space-y-6">
        {/* STEP 1: Choose File */}
        <div className="space-y-2">
          <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-mint-500/15 text-mint-700 text-xs font-bold shrink-0">
              1
            </span>
            בחר קובץ מהטלפון או מהמחשב
          </span>

          <label
            htmlFor="vault-file-input"
            className={`flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-3xl transition-all cursor-pointer text-center gap-2.5 ${
              fileName
                ? 'border-mint-500/50 bg-mint-500/[0.06]'
                : destinationMode === 'choose'
                ? 'border-amber-500/50 bg-amber-400/[0.06] hover:border-amber-500/70 hover:bg-amber-400/[0.09]'
                : 'border-slate-900/[0.14] bg-slate-900/[0.02] hover:border-mint-500/40 hover:bg-mint-500/[0.04]'
            }`}
          >
            <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-mint-500/20 to-teal-500/10 text-mint-600">
              <Upload className="w-6 h-6" />
            </span>
            <span className="text-[15px] font-bold text-slate-800 leading-snug break-all">
              {fileName
                ? `${fileName} (${formatFileSizeHe(fileSize)})`
                : 'לחץ כאן לבחירת הקובץ (חובה)'}
            </span>
            {fileName && (
              <span className="text-xs font-semibold text-mint-700">הקובץ נבחר ✓</span>
            )}
            <input
              id="vault-file-input"
              type="file"
              accept={acceptedFileTypes}
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>

          {/* Optional live voice recording if they chose Recordings */}
          {selectedModule === 'recordings' && (
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl glass">
              <span className="flex items-center gap-2 text-xs font-medium text-slate-600 min-w-0">
                {isRecording && (
                  <span
                    aria-hidden="true"
                    className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse shrink-0"
                  />
                )}
                <span className="truncate">
                  {isRecording
                    ? `מקליט כעת... (${formatDuration(recSeconds)})`
                    : durationSec
                    ? `הוקלט (${formatDuration(durationSec)})`
                    : 'רוצה להקליט עכשיו מהמיקרופון?'}
                </span>
              </span>
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startVoiceRecording}
                  className="btn-accent min-h-10 py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>הקלט קול</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopVoiceRecording}
                  className="min-h-10 py-2 px-4 rounded-xl bg-red-500/90 text-white text-xs font-bold hover:bg-red-500 flex items-center gap-1.5 active:scale-95 transition cursor-pointer shrink-0"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>עצור</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* STEP 2: Where to put it? (mobile share only) */}
        {destinationMode === 'choose' && (
          <div className="space-y-2.5">
            <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-mint-500/15 text-mint-700 text-xs font-bold shrink-0">
                2
              </span>
              לאן להכניס את הקובץ?
            </span>
            <ModuleRadioGroup value={selectedModule} onChange={setSelectedModule} />
          </div>
        )}

        {/* Destination folder — any module, mobile share flow. */}
        {showFolderPicker && selectedModule && (
          <FolderPicker
            folders={moduleFolders}
            selectedFolderId={selectedFolderId}
            newFolderName={newFolderName}
            onSelectFolder={setSelectedFolderId}
            onNewFolderNameChange={(v) => {
              setNewFolderName(v);
              if (errorMsg) setErrorMsg(null);
            }}
            onQuickCreate={handleQuickCreateFolder}
            question={`לאיזו תיקייה להכניס את הקובץ? (${MODULE_META[selectedModule].shortLabel})`}
            inputId="upload-new-folder-input"
          />
        )}

        {/* STEP 3: Title + tags */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="item-title-input"
              className="flex items-center gap-2 text-sm font-bold text-slate-900"
            >
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-mint-500/15 text-mint-700 text-xs font-bold shrink-0">
                {titleStepNumber}
              </span>
              תן כותרת לקובץ
            </label>
            <input
              id="item-title-input"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="לדוגמה: חוזה שכירות / צילום קבלה / הקלטת פגישה..."
              className="input-glass w-full h-12 px-4 text-base rounded-2xl focus:bg-white transition-colors"
            />
            <p className="text-xs text-slate-400">
              התאריך והשעה נשמרים אוטומטית עם הקובץ.
            </p>
          </div>

          <TagsInput tags={tags} onChange={setTags} inputId="upload-item-tags" />

          {/* Auto-suggested tags from the file name (one-tap add). */}
          {(() => {
            const suggestions = suggestTags(
              title,
              fileName,
              selectedModule || defaultModule
            ).filter((tag) => !tags.includes(tag));
            if (suggestions.length === 0) return null;
            return (
              <div className="flex flex-wrap items-center gap-2 -mt-1">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  מוצע:
                </span>
                {suggestions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setTags([...tags, tag])}
                    className="min-h-8 px-2.5 rounded-lg bg-mint-500/10 border border-mint-500/25 text-xs font-bold text-mint-700 hover:bg-mint-500/20 transition cursor-pointer"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            );
          })()}

          <div className="space-y-2">
            <label
              htmlFor="upload-item-expiry"
              className="flex items-center gap-1.5 text-sm font-bold text-slate-700"
            >
              <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
              תאריך תוקף (אופציונלי — דרכון, רישיון, ביטוח...)
            </label>
            <input
              id="upload-item-expiry"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="input-glass w-full"
            />
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="flex items-center gap-2 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-sm font-medium text-red-600"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </form>
    </ModalShell>
  );
}
