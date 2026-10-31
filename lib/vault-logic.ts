export type ModuleType = 'documents' | 'photos' | 'recordings';
export type FilterTab = 'all' | ModuleType;

/** Field updates shared by the edit modal and the storage layer. */
export interface VaultItemUpdates {
  title: string;
  module: ModuleType;
  folderId?: string;
  folderName?: string;
  tags?: string[];
  notes?: string;
}

/** A folder inside one module (documents / photos / recordings). */
export interface Folder {
  id: string;
  name: string;
  module: ModuleType;
  createdAt: string; // ISO string
  formattedDate: string; // DD.MM.YYYY
}

export interface VaultItem {
  id: string;
  title: string;
  module: ModuleType;
  folderId?: string;
  folderName?: string;
  tags?: string[];
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
  folderId?: string;
  folderName?: string;
  tags?: string[];
  fileName: string;
  fileSize: number;
  mimeType: string;
  dataUrl?: string;
  durationSec?: number;
  notes?: string;
  source?: 'upload' | 'mobile-share' | 'voice-recorder';
}

export const MODULE_IDS = ['documents', 'photos', 'recordings'] as const;
const MODULE_SET = new Set<string>(MODULE_IDS);

export const VAULT_SOURCES = ['upload', 'mobile-share', 'voice-recorder'] as const;
const SOURCE_SET = new Set<string>(VAULT_SOURCES);

/** Type guard used by cloud mappers and server validation alike. */
export function isModuleType(value: unknown): value is ModuleType {
  return typeof value === 'string' && MODULE_SET.has(value);
}

export function isVaultItemSource(value: unknown): value is VaultItem['source'] {
  return typeof value === 'string' && SOURCE_SET.has(value);
}

/** Collision-resistant id suffix (crypto random when available). */
function randomIdSuffix(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export const MODULE_META: Record<
  ModuleType,
  {
    id: ModuleType;
    label: string;
    singularLabel: string;
    shortLabel: string;
    acceptAttr: string;
  }
> = {
  documents: {
    id: 'documents',
    label: 'מסמכים חשובים',
    singularLabel: 'מסמך חשוב',
    shortLabel: 'מסמכים',
    acceptAttr: '.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.rtf,application/*,text/*',
  },
  photos: {
    id: 'photos',
    label: 'תמונות וצילומים',
    singularLabel: 'תמונה',
    shortLabel: 'תמונות',
    acceptAttr: 'image/*',
  },
  recordings: {
    id: 'recordings',
    label: 'הקלטות קוליות',
    singularLabel: 'הקלטה קולית',
    shortLabel: 'הקלטות',
    acceptAttr: 'audio/*,.mp3,.wav,.m4a,.ogg,.aac,.opus,.webm',
  },
};

/* ------------------------------------------------------------------ */
/* Tags                                                                */
/* ------------------------------------------------------------------ */

export const MAX_TAGS = 8;
export const MAX_TAG_LENGTH = 40;

/**
 * Parses free-form user input ("חשוב, עבודה, 2026") into clean,
 * de-duplicated tags (each ≤ 40 chars, at most 8).
 */
export function parseTagsInput(input: string): string[] {
  const seen = new Set<string>();
  for (const raw of input.split(/[,;\n]/)) {
    const tag = raw.trim().slice(0, MAX_TAG_LENGTH).replace(/^#/, '');
    if (tag) seen.add(tag);
    if (seen.size >= MAX_TAGS) break;
  }
  return [...seen];
}

/** Normalizes already-typed tags (cloud/docs sources, edits). */
export function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return parseTagsInput(tags.filter((t): t is string => typeof t === 'string').join(','));
}

/* ------------------------------------------------------------------ */
/* Module detection & formatting                                       */
/* ------------------------------------------------------------------ */

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
} {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return { formattedDate: '01.01.2026', formattedTime: '00:00' };
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return {
    formattedDate: `${day}.${month}.${year}`,
    formattedTime: `${hours}:${minutes}`,
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

/* ------------------------------------------------------------------ */
/* Factories                                                           */
/* ------------------------------------------------------------------ */

/**
 * Creates a validated Folder object.
 */
export function createFolder(
  name: string,
  module: ModuleType,
  nowIso: string = new Date().toISOString()
): Folder {
  const trimmedName = (name || '').trim().slice(0, 120);
  if (!trimmedName) {
    throw new Error('נא להזין שם לתיקייה');
  }
  if (!isModuleType(module)) {
    throw new Error('מודול יעד לא תקין');
  }

  return {
    id: `folder_${randomIdSuffix()}`,
    name: trimmedName,
    module,
    createdAt: nowIso,
    formattedDate: formatTimestampHe(nowIso).formattedDate,
  };
}

/**
 * Creates a validated VaultItem with automatic Date & Time stamping,
 * folder assignment and tags.
 */
export function createVaultItem(
  input: CreateVaultItemInput,
  nowIso: string = new Date().toISOString()
): VaultItem {
  const trimmedTitle = (input.title || '').trim().slice(0, 200);
  if (!trimmedTitle) {
    throw new Error('חובה להזין כותרת לפריט לפני השמירה');
  }

  if (!isModuleType(input.module)) {
    throw new Error('מודול יעד לא תקין');
  }

  return {
    id: `item_${randomIdSuffix()}`,
    title: trimmedTitle,
    module: input.module,
    folderId: input.folderId ? input.folderId.trim().slice(0, 128) : '',
    folderName: input.folderName ? input.folderName.trim().slice(0, 120) : '',
    tags: normalizeTags(input.tags),
    createdAt: nowIso,
    formattedDate: formatTimestampHe(nowIso).formattedDate,
    formattedTime: formatTimestampHe(nowIso).formattedTime,
    fileName: ((input.fileName || 'file').trim() || 'file').slice(0, 255),
    fileSize: Math.max(0, Number(input.fileSize) || 0),
    mimeType: (input.mimeType || 'application/octet-stream').slice(0, 128),
    dataUrl: input.dataUrl,
    durationSec: input.durationSec,
    notes: input.notes ? input.notes.trim().slice(0, 1000) : undefined,
    source: input.source || 'upload',
  };
}

/* ------------------------------------------------------------------ */
/* Filtering & counts                                                  */
/* ------------------------------------------------------------------ */

/**
 * Filters and sorts vault items by module, optional folder ID (any
 * module), free-text search query (title, file, notes, folder, tags,
 * dates), and chronological order.
 */
export function filterAndSortItems(
  items: VaultItem[],
  options: {
    moduleFilter: FilterTab;
    folderFilter?: string; // 'all' or specific folderId
    searchQuery: string;
    sortOrder?: 'newest' | 'oldest';
  }
): VaultItem[] {
  const { moduleFilter, folderFilter = 'all', searchQuery, sortOrder = 'newest' } = options;
  const normalizedQuery = (searchQuery || '').trim().toLowerCase();

  const filtered = items.filter((item) => {
    if (moduleFilter !== 'all' && item.module !== moduleFilter) {
      return false;
    }
    if (folderFilter && folderFilter !== 'all' && item.folderId !== folderFilter) {
      return false;
    }
    if (!normalizedQuery) return true;

    const haystack = [
      item.title,
      item.fileName,
      item.notes || '',
      item.folderName || '',
      ...(item.tags || []),
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
 * Computes item count per folderId (any module).
 */
export function computeFolderCounts(items: VaultItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    if (item.folderId) {
      counts[item.folderId] = (counts[item.folderId] || 0) + 1;
    }
  }
  return counts;
}
