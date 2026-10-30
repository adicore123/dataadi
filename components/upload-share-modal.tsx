'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  Image as ImageIcon,
  Mic,
  Check,
  Square,
  AlertCircle,
  FolderPlus,
  Folder,
  FolderCheck,
} from 'lucide-react';
import {
  ModuleType,
  PhotoAlbum,
  MODULE_META,
  detectModuleFromMime,
  formatFileSizeHe,
  formatDuration,
  createSynthesizedWavDataUrl,
  CreateVaultItemInput,
} from '@/lib/vault-logic';

export interface SharedDraft {
  title?: string;
  notes?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  dataUrl?: string;
  suggestedModule?: ModuleType;
  suggestedAlbumId?: string;
}

export type UploadMode = 'upload' | 'record' | 'simulate-share';
export type UploadDestinationMode = 'fixed' | 'auto' | 'choose';

interface UploadShareModalProps {
  isOpen: boolean;
  initialMode: UploadMode;
  destinationMode: UploadDestinationMode;
  defaultModule: ModuleType;
  albums: PhotoAlbum[];
  defaultAlbumId?: string;
  incomingShareDraft?: SharedDraft | null;
  onClose: () => void;
  onCreateAlbum: (name: string) => Promise<PhotoAlbum>;
  onSaveItem: (input: CreateVaultItemInput) => Promise<void> | void;
}

export function UploadShareModal({
  isOpen,
  initialMode,
  destinationMode,
  defaultModule,
  albums,
  defaultAlbumId,
  incomingShareDraft,
  onClose,
  onCreateAlbum,
  onSaveItem,
}: UploadShareModalProps) {
  const [selectedModule, setSelectedModule] = useState<ModuleType>(defaultModule);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('');
  const [showNewAlbumInput, setShowNewAlbumInput] = useState<boolean>(false);
  const [newAlbumName, setNewAlbumName] = useState<string>('');

  const [title, setTitle] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [mimeType, setMimeType] = useState('application/pdf');
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

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setIsSubmitting(false);
    setAutoDestinationResolved(destinationMode !== 'auto');
    setNewAlbumName('');

    const initialAlbId =
      incomingShareDraft?.suggestedAlbumId ||
      (defaultAlbumId && defaultAlbumId !== 'all' ? defaultAlbumId : albums[0]?.id || '');
    setSelectedAlbumId(initialAlbId);
    setShowNewAlbumInput(destinationMode === 'choose' && albums.length === 0);

    if (incomingShareDraft) {
      setTitle(incomingShareDraft.title || '');
      setFileName(incomingShareDraft.fileName || '');
      setFileSize(incomingShareDraft.fileSize || 0);
      setMimeType(incomingShareDraft.mimeType || 'application/octet-stream');
      setDataUrl(incomingShareDraft.dataUrl);
      const mod =
        incomingShareDraft.suggestedModule ||
        detectModuleFromMime(
          incomingShareDraft.mimeType || '',
          incomingShareDraft.fileName || ''
        );
      setSelectedModule(mod);
      setSource('mobile-share');
    } else if (initialMode === 'simulate-share') {
      setSelectedModule(defaultModule);
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
      setMimeType(
        defaultModule === 'photos'
          ? 'image/jpeg'
          : defaultModule === 'recordings'
          ? 'audio/wav'
          : 'application/pdf'
      );
      setDataUrl(undefined);
      setDurationSec(undefined);
      setSource('upload');
    }
    // `albums` is intentionally read only when another opening input changes;
    // album updates while the modal is open are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    initialMode,
    destinationMode,
    defaultModule,
    defaultAlbumId,
    incomingShareDraft,
  ]);

  useEffect(() => {
    if (isOpen && albums.length > 0 && !selectedAlbumId) {
      setSelectedAlbumId(albums[0].id);
    }
  }, [isOpen, albums, selectedAlbumId]);

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
    const resolvedModule = destinationMode === 'fixed' ? defaultModule : detected;
    if (destinationMode !== 'fixed') {
      setSelectedModule(resolvedModule);
    }
    if (destinationMode === 'auto') {
      setAutoDestinationResolved(true);
    }
    setFileName(file.name);
    setFileSize(file.size);
    setMimeType(file.type || 'application/octet-stream');

    if (destinationMode === 'choose' && resolvedModule === 'photos' && albums.length === 0) {
      setShowNewAlbumInput(true);
    }

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

  const handleQuickCreateAlbum = async () => {
    const trimmed = newAlbumName.trim();
    if (!trimmed) {
      setErrorMsg('נא לכתוב שם לאלבום החדש');
      return;
    }
    setErrorMsg(null);
    const created = await onCreateAlbum(trimmed);
    setSelectedAlbumId(created.id);
    setNewAlbumName('');
    setShowNewAlbumInput(false);
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
      // Fallback to synthesized audio on stop
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
    } else {
      const wavUrl = createSynthesizedWavDataUrl(finalDuration, 460);
      setDataUrl(wavUrl);
      setFileName(`voice-recording-${Date.now()}.wav`);
      setFileSize(finalDuration * 16000 + 44);
      setMimeType('audio/wav');
    }

    if (!title.trim()) {
      setTitle(`הקלטה קולית (${finalDuration} שניות)`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!title.trim()) {
      setErrorMsg('נא לכתוב כותרת לקובץ');
      return;
    }

    if (destinationMode === 'auto' && !autoDestinationResolved) {
      setErrorMsg('נא לבחור קובץ כדי שהמערכת תזהה לאן להעלות אותו');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      let targetAlbumId = '';
      let targetAlbumName = '';

      if (selectedModule === 'photos') {
        if (newAlbumName.trim()) {
          const created = await onCreateAlbum(newAlbumName.trim());
          targetAlbumId = created.id;
          targetAlbumName = created.name;
        } else if (selectedAlbumId) {
          const found = albums.find((a) => a.id === selectedAlbumId);
          if (found) {
            targetAlbumId = found.id;
            targetAlbumName = found.name;
          }
        }
      }

      const defaultExt =
        selectedModule === 'photos'
          ? 'jpg'
          : selectedModule === 'recordings'
          ? 'wav'
          : 'pdf';
      const finalFileName = fileName.trim() || `${title.trim().slice(0, 25)}.${defaultExt}`;
      const finalSize = fileSize > 0 ? fileSize : 48200;

      let finalDataUrl = dataUrl;
      if (!finalDataUrl) {
        if (selectedModule === 'recordings') {
          finalDataUrl = createSynthesizedWavDataUrl(durationSec || 3, 440);
        } else if (selectedModule === 'photos') {
          const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" fill="none"><rect width="600" height="400" fill="#EAF2F8"/><rect x="90" y="60" width="420" height="280" rx="16" fill="#F8FAFC" stroke="#10B981" stroke-width="2"/><circle cx="210" cy="150" r="28" fill="#34D399" fill-opacity="0.4"/><path d="M130 290L230 190L310 260L390 175L470 290H130Z" fill="#059669" fill-opacity="0.35"/></svg>`;
          finalDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(placeholderSvg)}`;
        } else {
          finalDataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(title.trim())}`;
        }
      }

      await onSaveItem({
        title: title.trim(),
        module: selectedModule,
        albumId: targetAlbumId || undefined,
        albumName: targetAlbumName || undefined,
        fileName: finalFileName,
        fileSize: finalSize,
        mimeType,
        dataUrl: finalDataUrl,
        durationSec: selectedModule === 'recordings' ? durationSec || 3 : undefined,
        source,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'שגיאה בשמירת הקובץ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fixedAlbumSelected =
    destinationMode === 'fixed' && selectedModule === 'photos' && Boolean(defaultAlbumId);
  // Destination questions (module + album) are asked ONLY when a file is shared
  // in from the phone ('choose'). Uploading from inside the app saves silently
  // to the module (and album, when one is open) the user is already viewing.
  const showAlbumPicker =
    destinationMode === 'choose' &&
    selectedModule === 'photos' &&
    !fixedAlbumSelected;
  const fixedAlbumName = albums.find((a) => a.id === defaultAlbumId)?.name;
  const destinationHint =
    destinationMode === 'choose'
      ? null
      : destinationMode === 'auto' && !autoDestinationResolved
      ? 'סוג הקובץ יזוהה אוטומטית בעת הבחירה'
      : `יישמר ב: ${MODULE_META[selectedModule].label}${
          fixedAlbumSelected && fixedAlbumName ? ` · אלבום ${fixedAlbumName}` : ''
        }`;
  const titleStepNumber = destinationMode === 'choose' ? 3 : 2;
  const acceptedFileTypes =
    destinationMode === 'fixed' ? MODULE_META[defaultModule].acceptAttr : undefined;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-share-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4"
    >
      <div className="w-full max-w-lg rounded-t-4xl sm:rounded-4xl glass-strong shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Sheet handle (mobile affordance) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1" aria-hidden="true">
          <div className="sheet-handle" />
        </div>

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-900/[0.08]">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="upload-share-modal-title"
              className="text-xl font-bold tracking-tight text-slate-900"
            >
              העלאת קובץ חדש
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="סגירה"
              className="w-11 h-11 flex items-center justify-center rounded-2xl glass text-slate-500 hover:text-slate-900 hover:bg-slate-900/5 active:scale-95 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {destinationHint && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-mint-500/10 border border-mint-500/25 px-3 py-1.5 text-xs font-semibold text-mint-700">
              <FolderCheck className="w-3.5 h-3.5 text-mint-600 shrink-0" />
              <span>{destinationHint}</span>
            </div>
          )}
        </div>

        {/* 3-Step Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 overflow-y-auto">
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
                  : 'border-slate-900/[0.14] bg-slate-900/[0.02] hover:border-mint-500/40 hover:bg-mint-500/[0.04]'
              }`}
            >
              <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-mint-500/20 to-teal-500/10 text-mint-600">
                <Upload className="w-6 h-6" />
              </span>
              <span className="text-[15px] font-bold text-slate-800 leading-snug break-all">
                {fileName
                  ? `${fileName} (${formatFileSizeHe(fileSize)})`
                  : 'לחץ כאן לבחירת תמונה, מסמך או הקלטה'}
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
              <div
                className="grid grid-cols-3 gap-2.5"
                role="radiogroup"
                aria-label="לאן להכניס"
              >
                {(
                  [
                    { id: 'photos', label: 'תמונות', icon: ImageIcon },
                    { id: 'documents', label: 'מסמכים', icon: FileText },
                    { id: 'recordings', label: 'הקלטות', icon: Mic },
                  ] as const
                ).map((mod) => {
                  const Icon = mod.icon;
                  const active = selectedModule === mod.id;
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSelectedModule(mod.id)}
                      className={`min-h-20 p-3 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 ${
                        active
                          ? 'bg-gradient-to-br from-mint-500/20 to-teal-500/10 border-mint-500/50 text-slate-900 shadow-glow'
                          : 'glass text-slate-600 hover:bg-slate-900/5'
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 ${active ? 'text-mint-600' : 'text-slate-400'}`}
                      />
                      <span className="text-sm font-bold">{mod.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* IF PHOTOS: Which Album? */}
          {showAlbumPicker && (
            <div className="p-4 rounded-3xl glass space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-mint-600" />
                  <span>לאיזה אלבום להכניס את התמונה?</span>
                </span>
                {albums.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowNewAlbumInput((v) => !v)}
                    className="text-xs font-bold text-mint-700 hover:opacity-80 flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>{showNewAlbumInput ? 'אלבום קיים' : 'אלבום חדש'}</span>
                  </button>
                )}
              </div>

              {albums.length > 0 && !showNewAlbumInput && (
                <div className="flex flex-wrap gap-2">
                  {albums.map((album) => {
                    const isSelected = selectedAlbumId === album.id;
                    return (
                      <button
                        key={album.id}
                        type="button"
                        onClick={() => {
                          setSelectedAlbumId(album.id);
                          setNewAlbumName('');
                        }}
                        className={`min-h-10 px-4 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-br from-mint-500/15 to-teal-500/10 border-mint-500/40 text-mint-700'
                            : 'glass text-slate-600 hover:bg-slate-900/5'
                        }`}
                      >
                        <Folder
                          className={`w-4 h-4 ${
                            isSelected ? 'text-mint-600' : 'text-slate-500'
                          }`}
                        />
                        <span>{album.name}</span>
                        {isSelected && <Check className="w-4 h-4 text-mint-600" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {(showNewAlbumInput || albums.length === 0) && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <label htmlFor="new-photo-album-input" className="sr-only">
                    שם אלבום חדש
                  </label>
                  <input
                    id="new-photo-album-input"
                    type="text"
                    value={newAlbumName}
                    onChange={(e) => {
                      setNewAlbumName(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="כתוב שם לאלבום חדש (למשל: קבלות, משפחה, עבודה)..."
                    className="flex-1 min-h-11 px-3.5 rounded-xl glass text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-mint-500/60"
                  />
                  <button
                    type="button"
                    onClick={handleQuickCreateAlbum}
                    className="btn-accent min-h-11 px-4 rounded-xl text-sm font-bold cursor-pointer whitespace-nowrap"
                  >
                    צור אלבום
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Title */}
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
              className="w-full h-12 px-4 rounded-2xl glass text-base text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-mint-500/60 focus:bg-white transition-colors"
            />
            <p className="text-xs text-slate-400">
              התאריך והשעה נשמרים אוטומטית עם הקובץ.
            </p>
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

          {/* Submit */}
          <div className="flex items-center gap-3 pt-1 pb-safe">
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 px-5 py-3 rounded-2xl glass text-sm font-bold text-slate-600 hover:bg-slate-900/5 active:scale-95 transition cursor-pointer"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-accent flex-1 min-h-12 py-3 rounded-2xl text-base font-bold disabled:opacity-50 disabled:shadow-none cursor-pointer"
            >
              {isSubmitting ? 'שומר...' : 'שמור קובץ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
