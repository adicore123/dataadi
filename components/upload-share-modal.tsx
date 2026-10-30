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
} from 'lucide-react';
import {
  ModuleType,
  PhotoAlbum,
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

interface UploadShareModalProps {
  isOpen: boolean;
  initialMode: 'upload' | 'record' | 'simulate-share';
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
    setNewAlbumName('');

    const initialAlbId =
      incomingShareDraft?.suggestedAlbumId ||
      (defaultAlbumId && defaultAlbumId !== 'all' ? defaultAlbumId : albums[0]?.id || '');
    setSelectedAlbumId(initialAlbId);
    setShowNewAlbumInput(albums.length === 0);

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
  }, [isOpen, initialMode, defaultModule, defaultAlbumId, incomingShareDraft]);

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
    setSelectedModule(detected);
    setFileName(file.name);
    setFileSize(file.size);
    setMimeType(file.type || 'application/octet-stream');

    if (detected === 'photos' && albums.length === 0) {
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
          const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" fill="none"><rect width="600" height="400" fill="#0F172A"/><rect x="90" y="60" width="420" height="280" rx="16" fill="#1E293B" stroke="#2DD4BF" stroke-width="2"/><circle cx="210" cy="150" r="28" fill="#2DD4BF" fill-opacity="0.3"/><path d="M130 290L230 190L310 260L390 175L470 290H130Z" fill="#0D9488" fill-opacity="0.5"/></svg>`;
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-share-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4"
    >
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Clean Simple Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 id="upload-share-modal-title" className="text-xl font-bold text-slate-900">
            העלאת קובץ חדש
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Simple 3-Step Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          {/* STEP 1: Choose File */}
          <div className="space-y-2">
            <span className="block text-sm font-bold text-slate-900">
              1. בחר קובץ מהטלפון או מהמחשב:
            </span>

            <label
              htmlFor="vault-file-input"
              className="flex flex-col items-center justify-center w-full p-5 border-2 border-dashed border-teal-500/60 rounded-2xl bg-teal-50/40 hover:bg-teal-50 transition-colors cursor-pointer text-center"
            >
              <Upload className="w-7 h-7 text-teal-600 mb-2" />
              <span className="text-base font-bold text-slate-900">
                {fileName
                  ? `${fileName} (${formatFileSizeHe(fileSize)})`
                  : 'לחץ כאן לבחירת תמונה, מסמך או הקלטה'}
              </span>
              <input
                id="vault-file-input"
                type="file"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>

            {/* Optional live voice recording if they chose Recordings */}
            {selectedModule === 'recordings' && (
              <div className="pt-2 flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-medium text-slate-700">
                  {isRecording
                    ? `מקליט כעת... (${formatDuration(recSeconds)})`
                    : durationSec
                    ? `הוקלט (${formatDuration(durationSec)})`
                    : 'רוצה להקליט עכשיו מהמיקרופון?'}
                </span>
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startVoiceRecording}
                    className="py-1.5 px-3.5 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>הקלט קול</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopVoiceRecording}
                    className="py-1.5 px-3.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>עצור הקלטה</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* STEP 2: Where to put it? */}
          <div className="space-y-2.5">
            <span className="block text-sm font-bold text-slate-900">
              2. לאן להכניס את הקובץ?
            </span>
            <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="לאן להכניס">
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
                    className={`h-20 p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                      active
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-6 h-6 ${active ? 'text-teal-400' : 'text-slate-500'}`} />
                    <span className="text-sm font-bold">{mod.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* IF PHOTOS: Which Album? */}
          {selectedModule === 'photos' && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-teal-600" />
                  <span>לאיזה אלבום להכניס את התמונה?</span>
                </span>
                {albums.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowNewAlbumInput((v) => !v)}
                    className="text-xs font-bold text-teal-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>{showNewAlbumInput ? 'בחר אלבום קיים' : '+ אלבום חדש'}</span>
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
                        className={`h-10 px-4 rounded-xl border text-sm font-bold flex items-center gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <Folder className="w-4 h-4 text-teal-500" />
                        <span>{album.name}</span>
                        {isSelected && <Check className="w-4 h-4 text-teal-400" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {(showNewAlbumInput || albums.length === 0) && (
                <div className="flex items-center gap-2">
                  <input
                    id="new-photo-album-input"
                    type="text"
                    value={newAlbumName}
                    onChange={(e) => {
                      setNewAlbumName(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="כתוב שם לאלבום חדש (למשל: קבלות, משפחה, עבודה)..."
                    className="flex-1 h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <button
                    type="button"
                    onClick={handleQuickCreateAlbum}
                    className="h-11 px-4 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 cursor-pointer whitespace-nowrap"
                  >
                    צור אלבום
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Title */}
          <div className="space-y-2">
            <label htmlFor="item-title-input" className="block text-sm font-bold text-slate-900">
              3. תן כותרת לקובץ:
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
              className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <p className="text-xs text-slate-500">
              התאריך והשעה נשמרים אוטומטית עם הקובץ.
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm font-medium text-red-700"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-12 px-5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-12 rounded-xl bg-slate-900 text-white text-base font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'שומר...' : 'שמור קובץ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
