'use client';

import { downloadZip } from 'client-zip';
import { VaultItem, Folder } from './vault-logic';

/**
 * Full local backup — builds a ZIP in the browser from the items already
 * in memory/IndexedDB: every file (from its dataUrl) + manifest.json with
 * all metadata (folders, tags, favorites, expiry). No server round-trip.
 */

function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = dataUrl.match(/^data:([^;,]*)(;base64)?,(.*)$/);
  if (!match) return null;
  const [, mime, isBase64, payload] = match;
  if (isBase64) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime || 'application/octet-stream' });
  }
  return new Blob([decodeURIComponent(payload)], { type: mime || 'text/plain' });
}

/** Unique, module-scoped, filesystem-safe file name inside the ZIP. */
function zipFileName(item: VaultItem, used: Set<string>): string {
  const dir =
    item.module === 'photos' ? 'photos' : item.module === 'recordings' ? 'recordings' : 'documents';
  let name = `${dir}/${item.fileName || 'file'}`.replace(/[\\:*?"<>|]/g, '_');
  if (used.has(name)) {
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let i = 2;
    while (used.has(`${base} (${i})${ext}`)) i++;
    name = `${base} (${i})${ext}`;
  }
  used.add(name);
  return name;
}

export async function exportVaultZip(items: VaultItem[], folders: Folder[]): Promise<void> {
  const used = new Set<string>();
  const inputs: Array<{ name: string; input: Blob; lastModified?: Date }> = [];
  const manifestItems: Array<Record<string, unknown>> = [];

  for (const item of items) {
    let archivedAs: string | null = null;
    if (item.dataUrl) {
      const blob = dataUrlToBlob(item.dataUrl);
      if (blob) {
        archivedAs = zipFileName(item, used);
        inputs.push({
          name: archivedAs,
          input: blob,
          lastModified: new Date(item.createdAt),
        });
      }
    }
    manifestItems.push({
      id: item.id,
      title: item.title,
      module: item.module,
      folder: folders.find((f) => f.id === item.folderId)?.name ?? item.folderName ?? '',
      tags: item.tags ?? [],
      favorite: item.favorite === true,
      expiresAt: item.expiresAt ?? null,
      createdAt: item.createdAt,
      fileName: item.fileName,
      fileSize: item.fileSize,
      mimeType: item.mimeType,
      durationSec: item.durationSec ?? null,
      notes: item.notes ?? '',
      source: item.source,
      archivedAs,
    });
  }

  const manifest = {
    exportedAt: new Date().toISOString(),
    app: 'dataadi-vault',
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      module: f.module,
      createdAt: f.createdAt,
    })),
    items: manifestItems,
  };

  const blob = await downloadZip([
    ...inputs,
    {
      name: 'manifest.json',
      input: JSON.stringify(manifest, null, 2),
      lastModified: new Date(),
    },
  ]).blob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vault-backup-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
