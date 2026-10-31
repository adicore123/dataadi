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
