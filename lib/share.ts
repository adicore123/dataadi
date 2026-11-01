import { VaultItem } from './vault-logic';

/**
 * Shares a vault item through the native Android share sheet — the user
 * picks WhatsApp (or any other app) with the REAL file bytes attached
 * (dataUrl → Blob → File → navigator.share({files})).
 * Soft fallback: no Web Share API / no stored file / share failed → open
 * wa.me with the item title as text. Cancelled share sheets (AbortError)
 * exit quietly. Must be called from a user gesture (button click).
 */
export async function shareVaultItem(item: VaultItem): Promise<boolean> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;

  const fallbackToWhatsApp = () => {
    if (typeof window !== 'undefined') {
      window.open(
        'https://wa.me/?text=' + encodeURIComponent(item.title),
        '_blank'
      );
    }
    return false;
  };

  if (!nav || !nav.share || !item.dataUrl) {
    return fallbackToWhatsApp();
  }

  try {
    // Browsers decode data: URLs natively via fetch — no manual base64.
    const res = await fetch(item.dataUrl);
    const blob = await res.blob();
    const file = new File([blob], item.fileName, {
      type: blob.type || item.mimeType,
    });

    if (typeof nav.canShare === 'function' && !nav.canShare({ files: [file] })) {
      return fallbackToWhatsApp();
    }

    await nav.share({ files: [file], title: item.title });
    return true;
  } catch (err) {
    // AbortError = the user closed the share sheet — not a failure.
    if (err instanceof DOMException && err.name === 'AbortError') {
      return true;
    }
    return fallbackToWhatsApp();
  }
}

/**
 * Shares several items at once through the native share sheet (all real
 * files attached). Falls back to wa.me with the titles if unsupported.
 */
export async function shareVaultItems(items: VaultItem[]): Promise<boolean> {
  if (items.length === 0) return false;
  if (items.length === 1) return shareVaultItem(items[0]);

  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const fallback = () => {
    if (typeof window !== 'undefined') {
      window.open(
        'https://wa.me/?text=' + encodeURIComponent(items.map((i) => i.title).join(', ')),
        '_blank'
      );
    }
    return false;
  };
  if (!nav || !nav.share) return fallback();

  try {
    const files: File[] = [];
    for (const item of items) {
      if (!item.dataUrl) continue;
      const blob = await (await fetch(item.dataUrl)).blob();
      files.push(new File([blob], item.fileName, { type: blob.type || item.mimeType }));
    }
    if (files.length === 0) return fallback();
    if (typeof nav.canShare === 'function' && !nav.canShare({ files })) {
      return fallback();
    }
    await nav.share({ files, title: `${items.length} קבצים מהכספת` });
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return true;
    return fallback();
  }
}
