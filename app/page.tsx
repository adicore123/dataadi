'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, Plus, Menu } from 'lucide-react';
import {
  VaultItem,
  PhotoAlbum,
  FilterTab,
  ModuleType,
  MODULE_META,
  createVaultItem,
  createPhotoAlbum,
  CreateVaultItemInput,
  filterAndSortItems,
  computeModuleCounts,
  computeAlbumPhotoCounts,
  getInitialSeedItems,
} from '@/lib/vault-logic';
import {
  loadLocalVaultItems,
  loadLocalPhotoAlbums,
  saveVaultItemToDatabase,
  updateVaultItemInDatabase,
  deleteVaultItemFromDatabase,
  savePhotoAlbumToDatabase,
  deletePhotoAlbumFromDatabase,
  subscribeToUserVault,
  consumeIncomingShare,
  arrayBufferToDataUrl,
} from '@/lib/vault-storage';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import { SidebarNav } from '@/components/sidebar-nav';
import {
  UploadShareModal,
  SharedDraft,
  UploadDestinationMode,
  UploadMode,
} from '@/components/upload-share-modal';
import { ItemPreviewModal } from '@/components/item-preview-modal';
import { PwaInstallModal } from '@/components/pwa-install-modal';
import { AuthModal } from '@/components/auth-modal';
import { VaultItemsView } from '@/components/vault-items-view';

/** Fast base64 data-URL conversion for a fetched Blob (native FileReader). */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

interface UploadModalContext {
  mode: UploadMode;
  destinationMode: UploadDestinationMode;
  targetModule: ModuleType;
  targetAlbumId?: string;
  incomingShareDraft?: SharedDraft | null;
}

interface OpenUploadOptions {
  mode?: UploadMode;
  destinationMode: UploadDestinationMode;
  targetModule?: ModuleType;
  targetAlbumId?: string;
  incomingShareDraft?: SharedDraft | null;
}

export default function SmartVaultCRMPage() {
  const [items, setItems] = useState<VaultItem[]>(() => getInitialSeedItems());
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('all');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Modals state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadContext, setUploadContext] = useState<UploadModalContext>({
    mode: 'upload',
    destinationMode: 'auto',
    targetModule: 'photos',
    incomingShareDraft: null,
  });
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [pwaModalOpen, setPwaModalOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [apkVersion, setApkVersion] = useState<string | null>(null);
  const [shareDiag, setShareDiag] = useState<string | null>(null);

  // Show which installed APK build last delivered a share (diagnostics).
  useEffect(() => {
    try {
      setApkVersion(window.localStorage.getItem('apkBuild'));
      setShareDiag(window.localStorage.getItem('lastShareDiag'));
    } catch {
      // storage unavailable
    }
  }, []);

  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  // Cloud vault sync handle (poll + focus refresh; replaces Firestore
  // onSnapshot listeners).
  const unsubscribeVaultRef = useRef<(() => void) | null>(null);

  const stopVaultSync = useCallback(() => {
    unsubscribeVaultRef.current?.();
    unsubscribeVaultRef.current = null;
  }, []);

  const startVaultSync = useCallback(
    (email: string) => {
      stopVaultSync();
      unsubscribeVaultRef.current = subscribeToUserVault(email, {
        onItemsChange: (cloudItems) => {
          setItems(cloudItems);
          setIsLoaded(true);
        },
        onAlbumsChange: (cloudAlbums) => {
          setAlbums(cloudAlbums);
        },
      });
    },
    [stopVaultSync]
  );

  // Load clean initial state, probe the session, then sync the vault
  useEffect(() => {
    let mounted = true;

    async function initLocalAndShareTarget() {
      const [localItems, localAlbums] = await Promise.all([
        loadLocalVaultItems(),
        loadLocalPhotoAlbums(),
      ]);
      if (mounted) {
        setItems(localItems);
        setAlbums(localAlbums);
        setIsLoaded(true);
      }

      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const isShared = params.get('shared');
        const queryTitle = params.get('title') || params.get('share_title');
        const queryText = params.get('text') || params.get('share_text');
        // The APK appends its build version to share URLs — remember it so
        // the sidebar can show which APK build is installed (diagnostics).
        const apkBuild = params.get('v');
        const shareErr = params.get('err');
        if (apkBuild) {
          setApkVersion(apkBuild);
          try {
            window.localStorage.setItem('apkBuild', apkBuild);
            if (shareErr) {
              window.localStorage.setItem('lastShareDiag', `${apkBuild} · ${shareErr}`);
              setShareDiag(`${apkBuild} · ${shareErr}`);
            } else {
              window.localStorage.removeItem('lastShareDiag');
              setShareDiag(null);
            }
          } catch {
            // storage unavailable — diagnostics only, ignore
          }
        }
        // Recovery flow: the shared file did not reach the app automatically
        // (server fallback route or a failed service-worker save). Open the
        // modal with no preselected module and ask the user to attach the
        // file manually.
        // Failure codes reported by the APK (ShareSinkActivity) — mapped to
        // explicit reasons so on-device screenshots pinpoint the failing step.
        const SHARE_ERR_REASONS: Record<string, string> = {
          nos: 'השיתוף לא כלל קובץ מצורף',
          read: 'קריאת הקובץ מהאפליקציה המשתפת נכשלה',
          size: 'הקובץ גדול מ-25MB ולא ניתן להעברה אוטומטית',
          srv: 'שרת ההעברה המקומי לא עלה',
          'old-hook': 'הופעל מנגנון שיתוף ישן (עדכן/י את האפליקציה)',
          net: 'העלאת הקובץ לכספת הזמנית נכשלה (רשת או כללי אבטחה)',
          put: 'כתיבת הקובץ לכספת הזמנית נדחתה — נסה/י שוב בעוד רגע',
          size2: 'הקובץ גדול מדי לאחסון בכספת (עד ~550KB לקבצים שאינם תמונות; תמונות נדחסות אוטומטית)',
        };
        const openShareRecovery = (fileName?: string | null, reason?: string) => {
          if (!mounted) return;
          const errCode = new URLSearchParams(window.location.search).get('err');
          const errReason = reason || (errCode ? SHARE_ERR_REASONS[errCode] : undefined);
          setShareNotice(
            errReason
              ? `${errReason} — בחר/י את הקובץ ידנית בשלב 1 ובחר/י לאיזה מודול להכניס אותו`
              : 'הקובץ המשותף לא נקלט אוטומטית — בחר/י אותו בשלב 1 ובחר/י לאיזה מודול להכניס אותו'
          );
          setUploadContext({
            mode: 'upload',
            destinationMode: 'choose',
            targetModule: 'photos',
            incomingShareDraft: {
              title: fileName ? fileName.replace(/\.[^/.]+$/, '') : '',
              notes: '',
            },
          });
          setUploadModalOpen(true);
        };

        if (isShared === '1') {
          const sharedPayload = await consumeIncomingShare();
          if (sharedPayload && mounted) {
            let fileDataUrl: string | undefined;
            if (sharedPayload.file?.buffer) {
              fileDataUrl = arrayBufferToDataUrl(
                sharedPayload.file.buffer,
                sharedPayload.file.type
              );
            }
            const incomingShareDraft: SharedDraft = {
              title:
                sharedPayload.title ||
                (sharedPayload.file?.name
                  ? sharedPayload.file.name.replace(/\.[^/.]+$/, '')
                  : ''),
              notes: [sharedPayload.text, sharedPayload.url].filter(Boolean).join(' '),
              fileName: sharedPayload.file?.name || 'shared-mobile-file',
              fileSize: sharedPayload.file?.size || 64000,
              mimeType: sharedPayload.file?.type || 'application/octet-stream',
              dataUrl: fileDataUrl,
            };
            setShareNotice(null);
            setUploadContext({
              mode: 'upload',
              destinationMode: 'choose',
              targetModule: 'photos',
              incomingShareDraft,
            });
            setUploadModalOpen(true);
          } else {
            // The service worker redirected here but the payload is gone.
            openShareRecovery(params.get('name'));
          }
          window.history.replaceState({}, '', '/');
        } else if (isShared === 'pickup') {
          // Native APK bridge: the shared file's real bytes are served by a
          // one-shot local server inside the app (127.0.0.1). Fetch them and
          // open the upload modal with the file ALREADY attached — the user
          // only picks the destination module. Falls back to the manual
          // intake flow on any failure.
          const port = params.get('port');
          const token = params.get('token');
          const pickupName = params.get('name') || 'shared-file';
          const pickupType = params.get('type') || 'application/octet-stream';
          const pickupSize = Number(params.get('size')) || 0;

          if (!port || !token) {
            openShareRecovery(pickupName);
          } else {
            try {
              const res = await fetch(
                `http://127.0.0.1:${port}/pickup?token=${encodeURIComponent(token)}`
              );
              if (!res.ok) throw new Error('pickup rejected');
              const blob = await res.blob();
              const dataUrl = await blobToDataUrl(blob);
              if (!mounted) return;
              setShareNotice(
                `הקובץ "${pickupName}" הועבר אוטומטית מהשיתוף — בחר/י לאיזה מודול להכניס אותו ושמור`
              );
              setUploadContext({
                mode: 'upload',
                destinationMode: 'choose',
                targetModule: 'photos',
                incomingShareDraft: {
                  title: pickupName.replace(/\.[^/.]+$/, ''),
                  notes: '',
                  fileName: pickupName,
                  fileSize: pickupSize || blob.size,
                  mimeType: pickupType || blob.type,
                  dataUrl,
                },
              });
              setUploadModalOpen(true);
            } catch (err) {
              if (mounted) {
                const detail = err instanceof Error && err.message
                  ? ` (${err.message.slice(0, 60)})`
                  : '';
                openShareRecovery(
                  pickupName,
                  `העברת הקובץ האוטומטית נכשלה${detail}`
                );
                try {
                  window.localStorage.setItem('lastShareDiag', `${apkBuild || '?'} · fetch`);
                } catch {
                  // diagnostics only
                }
              }
            }
          }
          window.history.replaceState({}, '', '/');
        } else if (isShared === 'escrow') {
          // Native APK bridge v1.0.7+: the Android app uploads the shared
          // file to a one-time escrow doc (pending_shares/{id}, MongoDB
          // behind /api/pending-shares) BEFORE opening the site; we pick it
          // up here same-origin and open the upload modal with the file
          // ALREADY attached. This replaces the 127.0.0.1 local-server
          // bridge, which Chrome's Local Network Access policy blocks for
          // public sites inside TWAs.
          const escrowId = params.get('id');
          const escrowName = params.get('name') || 'shared-file';
          const escrowType = params.get('type') || 'application/octet-stream';
          const escrowSize = Number(params.get('size')) || 0;

          if (!escrowId) {
            openShareRecovery(escrowName);
          } else {
            try {
              // One-time pickup: the GET atomically reads AND deletes the
              // escrow doc on the server (while unexpired).
              const res = await fetch(`/api/pending-shares/${encodeURIComponent(escrowId)}`);
              if (!res.ok) throw new Error('escrow missing');
              const data = (await res.json()) as
                | { name?: string; mime?: string; size?: number; dataUrl?: string }
                | undefined;
              if (!data?.dataUrl) throw new Error('escrow missing');
              if (!mounted) return;
              const fileName = data.name || escrowName;
              setShareNotice(
                `הקובץ "${fileName}" הועבר אוטומטית מהשיתוף — בחר/י לאיזה מודול להכניס אותו ושמור`
              );
              setUploadContext({
                mode: 'upload',
                destinationMode: 'choose',
                targetModule: 'photos',
                incomingShareDraft: {
                  title: fileName.replace(/\.[^/.]+$/, ''),
                  notes: '',
                  fileName,
                  fileSize: data.size || escrowSize,
                  mimeType: data.mime || escrowType,
                  dataUrl: data.dataUrl,
                },
              });
              setUploadModalOpen(true);
            } catch {
              if (mounted) {
                openShareRecovery(
                  escrowName,
                  'העברת הקובץ האוטומטית נכשלה (המסמך הזמני לא נמצא או שפג תוקפו)'
                );
                try {
                  window.localStorage.setItem('lastShareDiag', `${apkBuild || '?'} · escrow`);
                } catch {
                  // diagnostics only
                }
              }
            }
          }
          window.history.replaceState({}, '', '/');
        } else if (isShared === 'error') {
          openShareRecovery(params.get('name'));
          window.history.replaceState({}, '', '/');
        } else if (queryTitle || queryText) {
          const incomingShareDraft: SharedDraft = {
            title: queryTitle || '',
            notes: queryText || '',
            fileName: 'shared-note.txt',
            fileSize: 2048,
            mimeType: 'text/plain',
          };
          setShareNotice(null);
          setUploadContext({
            mode: 'upload',
            destinationMode: 'choose',
            targetModule: 'documents',
            incomingShareDraft,
          });
          setUploadModalOpen(true);
          window.history.replaceState({}, '', '/');
        }
      }
    }

    initLocalAndShareTarget();

    // Session probe replaces Firebase's onAuthStateChanged — the session
    // lives in an httpOnly cookie backed by the users collection in MongoDB.
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then(({ email }: { email: string | null }) => {
        if (!mounted || !email) return;
        setUserEmail(email);
        startVaultSync(email);
      })
      .catch(() => {
        // offline — local-only mode
      });

    return () => {
      mounted = false;
      stopVaultSync();
    };
  }, [startVaultSync, stopVaultSync]);

  const counts = useMemo(() => computeModuleCounts(items), [items]);
  const albumPhotoCounts = useMemo(() => computeAlbumPhotoCounts(items), [items]);

  const filteredItems = useMemo(
    () =>
      filterAndSortItems(items, {
        moduleFilter: activeTab,
        albumFilter: activeTab === 'photos' ? selectedAlbumId : 'all',
        searchQuery,
        sortOrder: 'newest',
      }),
    [items, activeTab, selectedAlbumId, searchQuery]
  );

  const [authModalOpen, setAuthModalOpen] = useState(false);

  const handleAuthSuccess = (email: string) => {
    setAuthModalOpen(false);
    setUserEmail(email);
    startVaultSync(email);
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // best-effort — cookie clears server-side
    }
    stopVaultSync();
    setUserEmail(null);
  };

  const handleCreateAlbum = async (name: string): Promise<PhotoAlbum> => {
    const newAlbum = createPhotoAlbum(name);
    const updatedAlbums = await savePhotoAlbumToDatabase(newAlbum, albums);
    setAlbums(updatedAlbums);
    return newAlbum;
  };

  const handleDeleteAlbum = async (albumId: string) => {
    const updatedAlbums = await deletePhotoAlbumFromDatabase(albumId, albums);
    setAlbums(updatedAlbums);
    if (selectedAlbumId === albumId) {
      setSelectedAlbumId('all');
    }
  };

  const handleOpenUploadModal = ({
    mode = 'upload',
    destinationMode,
    targetModule,
    targetAlbumId,
    incomingShareDraft = null,
  }: OpenUploadOptions) => {
    setUploadContext({
      mode,
      destinationMode,
      targetModule: targetModule || 'photos',
      targetAlbumId,
      incomingShareDraft,
    });
    setUploadModalOpen(true);
  };

  const handleSaveNewItem = async (input: CreateVaultItemInput) => {
    const newItem = createVaultItem(input);
    const updated = await saveVaultItemToDatabase(newItem, items);
    setItems(updated);
  };

  const handleUpdateItem = async (
    id: string,
    updates: {
      title: string;
      module: ModuleType;
      albumId?: string;
      albumName?: string;
      notes?: string;
    }
  ) => {
    const updated = await updateVaultItemInDatabase(id, updates, items);
    setItems(updated);
    const refreshedSelected = updated.find((i) => i.id === id) || null;
    setSelectedItem(refreshedSelected);
  };

  const handleDeleteItem = async (id: string) => {
    const updated = await deleteVaultItemFromDatabase(id, items);
    setItems(updated);
  };

  const defaultModuleForUpload: ModuleType =
    activeTab === 'all' ? 'photos' : activeTab;
  const destinationModeForCurrentView: UploadDestinationMode =
    activeTab === 'all' ? 'auto' : 'fixed';
  const currentPhotoAlbumId =
    activeTab === 'photos' && selectedAlbumId !== 'all' ? selectedAlbumId : undefined;

  const activeModuleTitle =
    activeTab === 'all' ? 'כל הקבצים' : MODULE_META[activeTab].label;

  return (
    <div className="min-h-screen flex text-slate-800 pb-28 md:pb-0">
      {/* Right-Hand Glass Sidebar */}
      <SidebarNav
        activeTab={activeTab}
        apkVersion={shareDiag ?? apkVersion}
        onSelectTab={setActiveTab}
        counts={counts}
        albums={albums}
        selectedAlbumId={selectedAlbumId}
        albumPhotoCounts={albumPhotoCounts}
        onSelectAlbum={setSelectedAlbumId}
        userEmail={userEmail}
        onSignIn={() => setAuthModalOpen(true)}
        onSignOut={handleSignOut}
        onOpenUploadModal={(mode) =>
          handleOpenUploadModal({
            mode,
            destinationMode: destinationModeForCurrentView,
            targetModule: defaultModuleForUpload,
            targetAlbumId: currentPhotoAlbumId,
          })
        }
        onOpenPwaModal={() => setPwaModalOpen(true)}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        onInstallPwa={install}
        isDesktopSidebarOpen={isDesktopSidebarOpen}
        onToggleDesktopSidebar={() => setIsDesktopSidebarOpen((prev) => !prev)}
        isMobileDrawerOpen={isMobileDrawerOpen}
        onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
        onCloseMobileDrawer={() => setIsMobileDrawerOpen(false)}
      />

      {/* Main Workspace over the aurora canvas */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        {/* Glass Sticky Header: Title, Search shortcut, Upload */}
        <header className="sticky top-0 z-20 glass-strong border-x-0 border-t-0 px-4 sm:px-8 py-3.5">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(true)}
                aria-label="פתיחת תפריט"
                className="md:hidden h-11 w-11 shrink-0 rounded-2xl glass flex items-center justify-center text-slate-600 hover:bg-slate-900/5 active:scale-95 transition cursor-pointer"
              >
                <Menu className="w-5 h-5 text-mint-600" />
              </button>

              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
                {activeModuleTitle}
              </h1>
            </div>

            <button
              type="button"
              onClick={() =>
                handleOpenUploadModal({
                  mode: 'upload',
                  destinationMode: destinationModeForCurrentView,
                  targetModule: defaultModuleForUpload,
                  targetAlbumId: currentPhotoAlbumId,
                })
              }
              className="btn-accent h-11 px-4 sm:px-5 rounded-2xl text-sm sm:text-base font-bold flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
              <span className="hidden sm:inline">העלאת קובץ</span>
              <span className="sm:hidden">העלאה</span>
            </button>
          </div>
        </header>

        {/* Main Content: Search (if items exist) and the Files List */}
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
          {(items.length > 0 || searchQuery) && (
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <label htmlFor="simple-search" className="sr-only">
                חיפוש קובץ
              </label>
              <input
                id="simple-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חיפוש קובץ לפי שם, אלבום או תאריך..."
                className="w-full h-12 pr-12 pl-4 rounded-2xl glass text-base text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-mint-500/60 focus:bg-white transition-colors"
              />
            </div>
          )}

          <section aria-label="רשימת קבצים">
            {!isLoaded ? (
              <div className="space-y-3" aria-label="טוען קבצים">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="glass rounded-3xl h-20 animate-pulse"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
            ) : (
              <VaultItemsView
                items={filteredItems}
                activeTab={activeTab}
                albums={albums}
                selectedAlbumId={selectedAlbumId}
                albumPhotoCounts={albumPhotoCounts}
                totalPhotosCount={counts.photos}
                searchQuery={searchQuery}
                onSelectAlbum={setSelectedAlbumId}
                onCreateAlbum={handleCreateAlbum}
                onDeleteAlbum={handleDeleteAlbum}
                onSelectItem={(item) => setSelectedItem(item)}
                onDeleteItem={handleDeleteItem}
                onOpenUpload={(mode, targetAlbumId) =>
                  handleOpenUploadModal({
                    mode: mode || 'upload',
                    destinationMode:
                      targetAlbumId || activeTab !== 'all' ? 'fixed' : 'auto',
                    targetModule: targetAlbumId ? 'photos' : defaultModuleForUpload,
                    targetAlbumId: targetAlbumId || currentPhotoAlbumId,
                  })
                }
              />
            )}
          </section>
        </main>
      </div>

      {/* Simple 3-Step Upload Modal */}
      <UploadShareModal
        isOpen={uploadModalOpen}
        initialMode={uploadContext.mode}
        destinationMode={uploadContext.destinationMode}
        defaultModule={uploadContext.targetModule}
        albums={albums}
        defaultAlbumId={uploadContext.targetAlbumId}
        incomingShareDraft={uploadContext.incomingShareDraft}
        notice={shareNotice}
        onClose={() => {
          setUploadModalOpen(false);
          setShareNotice(null);
          setUploadContext((current) => ({
            ...current,
            incomingShareDraft: null,
          }));
        }}
        onCreateAlbum={handleCreateAlbum}
        onSaveItem={handleSaveNewItem}
      />

      {/* Item Preview Modal */}
      <ItemPreviewModal
        item={selectedItem}
        albums={albums}
        onClose={() => setSelectedItem(null)}
        onCreateAlbum={handleCreateAlbum}
        onUpdateItem={handleUpdateItem}
        onDeleteItem={handleDeleteItem}
      />

      {/* PWA Mobile App Icon Modal */}
      <PwaInstallModal
        isOpen={pwaModalOpen}
        onClose={() => setPwaModalOpen(false)}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        isIOS={isIOS}
        onInstall={install}
        onTryMobileShare={() =>
          handleOpenUploadModal({
            mode: 'simulate-share',
            destinationMode: 'choose',
            targetModule: defaultModuleForUpload,
          })
        }
      />

      {/* Email + Password Cloud Backup Account Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
