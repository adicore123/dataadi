'use client';

import { useEffect } from 'react';
import { ModuleType } from '@/lib/vault-logic';
import { consumeIncomingShare, arrayBufferToDataUrl } from '@/lib/vault-storage';
import { SharedDraft } from '@/components/upload-share-modal';

/**
 * Opens the upload modal for an incoming share — either with the captured
 * file attached, or as a manual-recovery draft (no file, user attaches it).
 */
export type OpenShareDraft = (
  draft: SharedDraft | null,
  options?: { notice?: string | null; defaultModule?: ModuleType }
) => void;

/**
 * Handles the PWA share-target landing URL once on mount:
 * - ?shared=1        — service worker saved the file to IndexedDB; pick it up.
 * - ?shared=error    — the share failed; open manual recovery.
 * - ?title=&text=    — text-only share prefilled as a document draft.
 *
 * The URL is scrubbed with history.replaceState after handling.
 */
export function useIncomingShare(open: OpenShareDraft) {
  useEffect(() => {
    let mounted = true;

    async function handleIncomingShare() {
      const params = new URLSearchParams(window.location.search);
      const shared = params.get('shared');
      const queryTitle = params.get('title') || params.get('share_title');
      const queryText = params.get('text') || params.get('share_text');

      const scrubUrl = () => window.history.replaceState({}, '', '/');

      const openRecovery = (fileName?: string | null) => {
        if (!mounted) return;
        open(
          {
            title: fileName ? fileName.replace(/\.[^/.]+$/, '') : '',
            notes: '',
          },
          {
            notice:
              'הקובץ המשותף לא נקלט אוטומטית — בחר/י אותו בשלב 1 ובחר/י לאיזה מודול להכניס אותו',
          }
        );
      };

      if (shared === '1') {
        const payload = await consumeIncomingShare();
        if (payload && mounted) {
          const fileDataUrl = payload.file?.buffer
            ? arrayBufferToDataUrl(payload.file.buffer, payload.file.type)
            : undefined;
          open(
            {
              title:
                payload.title ||
                (payload.file?.name
                  ? payload.file.name.replace(/\.[^/.]+$/, '')
                  : ''),
              notes: [payload.text, payload.url].filter(Boolean).join(' '),
              fileName: payload.file?.name || 'shared-mobile-file',
              fileSize: payload.file?.size || 64000,
              mimeType: payload.file?.type || 'application/octet-stream',
              dataUrl: fileDataUrl,
            },
            { notice: null }
          );
        } else {
          openRecovery(params.get('name'));
        }
        scrubUrl();
      } else if (shared === 'error') {
        openRecovery(params.get('name'));
        scrubUrl();
      } else if (queryTitle || queryText) {
        open(
          {
            title: queryTitle || '',
            notes: queryText || '',
            fileName: 'shared-note.txt',
            fileSize: 2048,
            mimeType: 'text/plain',
          },
          { notice: null, defaultModule: 'documents' }
        );
        scrubUrl();
      }
    }

    void handleIncomingShare();

    return () => {
      mounted = false;
    };
  }, [open]);
}
