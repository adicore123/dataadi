export type ModuleType = 'documents' | 'photos' | 'recordings';
export type FilterTab = 'all' | ModuleType;

export interface PhotoAlbum {
  id: string;
  name: string;
  createdAt: string; // ISO string
  formattedDate: string; // DD.MM.YYYY
}

export interface VaultItem {
  id: string;
  title: string;
  module: ModuleType;
  albumId?: string;
  albumName?: string;
  createdAt: string; // ISO string
  formattedDate: string; // DD.MM.YYYY
  formattedTime: string; // HH:MM
  fileName: string;
  fileSize: number; // in bytes
  mimeType: string;
  dataUrl?: string;
  durationSec?: number;
  notes?: string;
  source: 'upload' | 'mobile-share' | 'voice-recorder';
}

export interface CreateVaultItemInput {
  title: string;
  module: ModuleType;
  albumId?: string;
  albumName?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  dataUrl?: string;
  durationSec?: number;
  notes?: string;
  source?: 'upload' | 'mobile-share' | 'voice-recorder';
}

export const MODULE_META: Record<
  ModuleType,
  {
    id: ModuleType;
    label: string;
    singularLabel: string;
    shortDesc: string;
    acceptAttr: string;
  }
> = {
  documents: {
    id: 'documents',
    label: 'מסמכים חשובים',
    singularLabel: 'מסמך חשוב',
    shortDesc: 'חוזים, קבלות, תעודות, PDF וקבצי טקסט',
    acceptAttr: '.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.rtf,application/*,text/*',
  },
  photos: {
    id: 'photos',
    label: 'תמונות וצילומים',
    singularLabel: 'תמונה',
    shortDesc: 'אלבומי תמונות, צילומי מסמכים ותמונות מהטלפון',
    acceptAttr: 'image/*',
  },
  recordings: {
    id: 'recordings',
    label: 'הקלטות קוליות',
    singularLabel: 'הקלטה',
    shortDesc: 'תזכורות קוליות, סיכומי פגישות והקלטות משותפות מהנייד',
    acceptAttr: 'audio/*,.mp3,.wav,.m4a,.ogg,.aac,.opus,.webm',
  },
};

/**
 * Automatically detects the most appropriate module from MIME type or filename extension.
 */
export function detectModuleFromMime(mimeType: string, fileName = ''): ModuleType {
  const normalizedMime = (mimeType || '').toLowerCase().trim();
  const lowerName = (fileName || '').toLowerCase().trim();

  if (
    normalizedMime.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|gif|heic|svg|bmp)$/i.test(lowerName)
  ) {
    return 'photos';
  }

  if (
    normalizedMime.startsWith('audio/') ||
    /\.(mp3|wav|m4a|ogg|aac|opus|flac|amr|wma)$/i.test(lowerName)
  ) {
    return 'recordings';
  }

  return 'documents';
}

/**
 * Formats an ISO timestamp into deterministic tabular DD.MM.YYYY and HH:MM strings.
 */
export function formatTimestampHe(isoString: string): {
  formattedDate: string;
  formattedTime: string;
  fullLabel: string;
} {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return {
      formattedDate: '01.01.2026',
      formattedTime: '00:00',
      fullLabel: '01.01.2026 · 00:00',
    };
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  const formattedDate = `${day}.${month}.${year}`;
  const formattedTime = `${hours}:${minutes}`;

  return {
    formattedDate,
    formattedTime,
    fullLabel: `${formattedDate} · ${formattedTime}`,
  };
}

/**
 * Formats byte size into human-readable KB / MB / B.
 */
export function formatFileSizeHe(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

/**
 * Formats audio duration in seconds to MM:SS.
 */
export function formatDuration(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return '00:00';
  }
  const totalSec = Math.round(seconds);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Creates a validated PhotoAlbum object.
 */
export function createPhotoAlbum(
  name: string,
  nowIso: string = new Date().toISOString()
): PhotoAlbum {
  const trimmedName = (name || '').trim().slice(0, 120);
  if (!trimmedName) {
    throw new Error('נא להזין שם לאלבום התמונות');
  }

  const { formattedDate } = formatTimestampHe(nowIso);
  const randomSuffix = Math.random().toString(36).substring(2, 8);

  return {
    id: `album_${Date.now()}_${randomSuffix}`,
    name: trimmedName,
    createdAt: nowIso,
    formattedDate,
  };
}

/**
 * Creates a validated VaultItem with automatic Date & Time stamping and album support.
 */
export function createVaultItem(
  input: CreateVaultItemInput,
  nowIso: string = new Date().toISOString()
): VaultItem {
  const trimmedTitle = (input.title || '').trim().slice(0, 200);
  if (!trimmedTitle) {
    throw new Error('חובה להזין כותרת לפריט לפני השמירה');
  }

  const validModules: ModuleType[] = ['documents', 'photos', 'recordings'];
  if (!validModules.includes(input.module)) {
    throw new Error('מודול יעד לא תקין');
  }

  const { formattedDate, formattedTime } = formatTimestampHe(nowIso);
  const randomSuffix = Math.random().toString(36).substring(2, 8);

  return {
    id: `item_${Date.now()}_${randomSuffix}`,
    title: trimmedTitle,
    module: input.module,
    albumId: input.module === 'photos' && input.albumId ? input.albumId.trim() : '',
    albumName:
      input.module === 'photos' && input.albumName
        ? input.albumName.trim().slice(0, 120)
        : '',
    createdAt: nowIso,
    formattedDate,
    formattedTime,
    fileName: ((input.fileName || 'file').trim() || 'file').slice(0, 255),
    fileSize: Math.max(0, Number(input.fileSize) || 0),
    mimeType: (input.mimeType || 'application/octet-stream').slice(0, 128),
    dataUrl: input.dataUrl,
    durationSec: input.durationSec,
    notes: input.notes ? input.notes.trim().slice(0, 1000) : undefined,
    source: input.source || 'upload',
  };
}

/**
 * Filters and sorts vault items by module, optional photo album ID, search query, and chronological order.
 */
export function filterAndSortItems(
  items: VaultItem[],
  options: {
    moduleFilter: FilterTab;
    albumFilter?: string; // 'all' or specific albumId
    searchQuery: string;
    sortOrder?: 'newest' | 'oldest';
  }
): VaultItem[] {
  const { moduleFilter, albumFilter = 'all', searchQuery, sortOrder = 'newest' } = options;
  const normalizedQuery = (searchQuery || '').trim().toLowerCase();

  const filtered = items.filter((item) => {
    if (moduleFilter !== 'all' && item.module !== moduleFilter) {
      return false;
    }
    if (
      moduleFilter === 'photos' &&
      albumFilter &&
      albumFilter !== 'all' &&
      item.albumId !== albumFilter
    ) {
      return false;
    }
    if (!normalizedQuery) return true;

    const haystack = [
      item.title,
      item.fileName,
      item.notes || '',
      item.albumName || '',
      item.formattedDate,
      item.formattedTime,
      MODULE_META[item.module]?.label || '',
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  return filtered.sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return sortOrder === 'oldest' ? timeA - timeB : timeB - timeA;
  });
}

/**
 * Computes item counts for each module and total.
 */
export function computeModuleCounts(items: VaultItem[]): Record<FilterTab, number> {
  const counts: Record<FilterTab, number> = {
    all: items.length,
    documents: 0,
    photos: 0,
    recordings: 0,
  };

  for (const item of items) {
    if (item.module in counts) {
      counts[item.module] += 1;
    }
  }
  return counts;
}

/**
 * Computes photo count per albumId.
 */
export function computeAlbumPhotoCounts(items: VaultItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    if (item.module === 'photos' && item.albumId) {
      counts[item.albumId] = (counts[item.albumId] || 0) + 1;
    }
  }
  return counts;
}

/**
 * Generates a playable WAV audio data URL when recording in an environment without mic hardware.
 */
export function createSynthesizedWavDataUrl(durationSec = 3, freqHz = 440): string {
  const sampleRate = 8000;
  const numSamples = Math.max(1, Math.floor(sampleRate * durationSec));
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, t * 8) * Math.max(0.15, 1 - t / (durationSec * 1.1));
    const mod = i % 4000 < 2000 ? freqHz : freqHz * 1.25;
    const sample = Math.sin(2 * Math.PI * mod * t) * 0.35 * envelope;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(buffer).toString('base64');
  return `data:audio/wav;base64,${base64}`;
}

/**
 * Returns a 100% clean, empty initial array (Zero mock/seed items as requested by user).
 */
export function getInitialSeedItems(): VaultItem[] {
  return [];
}
