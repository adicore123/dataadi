import { ModuleType, normalizeTags, normalizeExpiryDate } from './vault-logic';

/**
 * Server-side payload validation for the vault API routes.
 * Clamps benign overflow instead of rejecting, mirroring how the
 * client pre-normalizes values before writing.
 */

const MODULES: ModuleType[] = ['documents', 'photos', 'recordings'];
const SOURCES = ['upload', 'mobile-share', 'voice-recorder'] as const;

export const DOC_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

export type VaultItemSource = (typeof SOURCES)[number];

export interface VaultItemDoc {
  title: string;
  module: ModuleType;
  folderId: string;
  folderName: string;
  tags: string[];
  favorite: boolean;
  expiresAt?: string;
  /** ISO string while the item sits in the recycle bin. */
  deletedAt?: string;
  createdAtIso: string;
  formattedDate: string;
  formattedTime: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  dataUrl: string;
  durationSec: number;
  notes: string;
  source: VaultItemSource;
}

export interface VaultItemUpdateDoc {
  title: string;
  module: ModuleType;
  folderId: string;
  folderName: string;
  tags: string[];
  notes: string;
  favorite: boolean;
  expiresAt?: string;
}

export interface FolderDoc {
  name: string;
  module: ModuleType;
  createdAtIso: string;
}

function clampStr(value: unknown, max: number, fallback = ''): string {
  return typeof value === 'string' ? value.slice(0, max) : fallback;
}

function clampNum(value: unknown, min: number, max: number, fallback = 0): number {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function validId(id: unknown): string | null {
  return typeof id === 'string' && DOC_ID_RE.test(id) ? id : null;
}

function validModule(value: unknown): ModuleType | null {
  return MODULES.includes(value as ModuleType) ? (value as ModuleType) : null;
}

export function parseVaultItemCreate(body: unknown): { id: string; doc: VaultItemDoc } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const id = validId(b.id);
  if (!id) return { error: 'מזהה פריט לא תקין' };

  const moduleType = validModule(b.module);
  if (!moduleType) return { error: 'סוג מודול לא תקין' };

  const source = SOURCES.includes(b.source as VaultItemSource)
    ? (b.source as VaultItemSource)
    : 'upload';

  return {
    id,
    doc: {
      title: clampStr(b.title, 200, 'פריט'),
      module: moduleType,
      folderId: clampStr(b.folderId, 128),
      folderName: clampStr(b.folderName, 120),
      tags: normalizeTags(b.tags),
      favorite: b.favorite === true,
      expiresAt: normalizeExpiryDate(b.expiresAt),
      deletedAt: clampStr(b.deletedAt, 64) || undefined,
      createdAtIso: clampStr(b.createdAtIso, 64, new Date().toISOString()),
      formattedDate: clampStr(b.formattedDate, 32),
      formattedTime: clampStr(b.formattedTime, 32),
      fileName: clampStr(b.fileName, 255, 'file') || 'file',
      fileSize: clampNum(b.fileSize, 0, 50_000_000),
      mimeType: clampStr(b.mimeType, 128, 'application/octet-stream') || 'application/octet-stream',
      dataUrl: clampStr(b.dataUrl, 780_000),
      durationSec: clampNum(b.durationSec, 0, 86400),
      notes: clampStr(b.notes, 1000),
      source,
    },
  };
}

export function parseVaultItemUpdate(body: unknown): VaultItemUpdateDoc | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const moduleType = validModule(b.module);
  if (!moduleType) return { error: 'סוג מודול לא תקין' };
  return {
    title: clampStr(b.title, 200, 'פריט'),
    module: moduleType,
    folderId: clampStr(b.folderId, 128),
    folderName: clampStr(b.folderName, 120),
    tags: normalizeTags(b.tags),
    notes: clampStr(b.notes, 1000),
    favorite: b.favorite === true,
    expiresAt: normalizeExpiryDate(b.expiresAt),
  };
}

export function parseFolderCreate(body: unknown): { id: string; doc: FolderDoc } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const id = validId(b.id);
  if (!id) return { error: 'מזהה תיקייה לא תקין' };

  const moduleType = validModule(b.module);
  if (!moduleType) return { error: 'סוג מודול לא תקין' };

  const name = clampStr(b.name, 120).trim();
  if (!name) return { error: 'שם תיקייה ריק' };

  return {
    id,
    doc: {
      name,
      module: moduleType,
      createdAtIso: clampStr(b.createdAtIso, 64, new Date().toISOString()),
    },
  };
}

export function parseFolderRename(body: unknown): { name: string } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = clampStr(b.name, 120).trim();
  if (!name) return { error: 'שם תיקייה ריק' };
  return { name };
}
