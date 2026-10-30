'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { Search, Plus, Menu } from 'lucide-react';
import { auth, googleProvider } from '@/lib/firebase';
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
  detectModuleFromMime,
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
  subscribeToUserVaultFirestore,
  consumeIncomingShare,
  arrayBufferToDataUrl,
} from '@/lib/vault-storage';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import { SidebarNav } from '@/components/sidebar-nav';
import { UploadShareModal, SharedDraft } from '@/components/upload-share-modal';
import { ItemPreviewModal } from '@/components/item-preview-modal';
import { PwaInstallModal } from '@/components/pwa-install-modal';
import { VaultItemsView } from '@/components/vault-items-view';

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
  const [uploadModalMode, setUploadModalMode] = useState<
    'upload' | 'record' | 'simulate-share'
  >('upload');
  const [incomingShareDraft, setIncomingShareDraft] = useState<SharedDraft | null>(null);
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [pwaModalOpen, setPwaModalOpen] = useState(false);

  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  // Load clean initial state & subscribe to Firebase Auth + Firestore
  useEffect(() => {
    let mounted = true;
    let unsubscribeFirestore: (() => void) | null = null;

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
            const detectedMod = detectModuleFromMime(
              sharedPayload.file?.type || '',
              sharedPayload.file?.name || ''
            );
            setIncomingShareDraft({
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
              suggestedModule: detectedMod,
            });
            setUploadModalMode('upload');
            setUploadModalOpen(true);
          }
          window.history.replaceState({}, '', '/');
        } else if (queryTitle || queryText) {
          setIncomingShareDraft({
            title: queryTitle || '',
            notes: queryText || '',
            fileName: 'shared-note.txt',
            fileSize: 2048,
            mimeType: 'text/plain',
            suggestedModule: 'documents',
          });
          setUploadModalMode('upload');
          setUploadModalOpen(true);
          window.history.replaceState({}, '', '/');
        }
      }
    }

    initLocalAndShareTarget();

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!mounted) return;
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }

      if (user) {
        setUserEmail(user.email || 'מחובר');
        unsubscribeFirestore = subscribeToUserVaultFirestore(user.uid, {
          onItemsChange: (cloudItems) => {
            if (mounted) {
              setItems(cloudItems);
              setIsLoaded(true);
            }
          },
          onAlbumsChange: (cloudAlbums) => {
            if (mounted) {
              setAlbums(cloudAlbums);
            }
          },
        });
      } else {
        setUserEmail(null);
      }
    });

    return () => {
      mounted = false;
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

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

  const handleSignInGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch {
      // ignore popup close
    }
  };

  const handleSignOutGoogle = async () => {
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
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

  const handleOpenUploadModal = (
    mode: 'upload' | 'record' | 'simulate-share' = 'upload',
    targetModule?: ModuleType,
    targetAlbumId?: string
  ) => {
    setIncomingShareDraft(
      targetModule || targetAlbumId
        ? {
            suggestedModule: targetModule,
            suggestedAlbumId: targetAlbumId,
          }
        : null
    );
    setUploadModalMode(mode);
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

  const activeModuleTitle =
    activeTab === 'all' ? 'כל הקבצים' : MODULE_META[activeTab].label;

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 pb-20 md:pb-0">
      {/* Right-Hand Simple Sidebar */}
      <SidebarNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        counts={counts}
        albums={albums}
        selectedAlbumId={selectedAlbumId}
        albumPhotoCounts={albumPhotoCounts}
        onSelectAlbum={setSelectedAlbumId}
        userEmail={userEmail}
        onSignInGoogle={handleSignInGoogle}
        onSignOutGoogle={handleSignOutGoogle}
        onOpenUploadModal={(mode) =>
          handleOpenUploadModal(
            mode,
            activeTab === 'all' ? undefined : activeTab,
            selectedAlbumId !== 'all' ? selectedAlbumId : undefined
          )
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

      {/* Clean, Calm Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        {/* Simple Header: Only Title, Search, and 1 Upload Button */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(true)}
                aria-label="פתיחת תפריט"
                className="md:hidden h-11 px-3.5 rounded-xl bg-slate-900 text-white flex items-center gap-2 text-sm font-bold cursor-pointer"
              >
                <Menu className="w-5 h-5 text-teal-400" />
                <span>תפריט</span>
              </button>

              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {activeModuleTitle}
              </h1>
            </div>

            <button
              type="button"
              onClick={() =>
                handleOpenUploadModal(
                  'upload',
                  defaultModuleForUpload,
                  selectedAlbumId !== 'all' ? selectedAlbumId : undefined
                )
              }
              className="h-11 px-5 rounded-xl bg-teal-500 text-slate-950 text-sm sm:text-base font-bold hover:bg-teal-400 flex items-center gap-2 cursor-pointer shrink-0 shadow-xs"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
              <span>העלאת קובץ</span>
            </button>
          </div>
        </header>

        {/* Main Content: Just a Simple Search Box (if items exist) and the Files List */}
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
                className="w-full h-12 pr-12 pl-4 rounded-2xl border border-slate-200 bg-white text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          )}

          <section aria-label="רשימת קבצים">
            {!isLoaded ? (
              <div className="p-12 text-center text-slate-400 text-sm">טוען...</div>
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
                  handleOpenUploadModal(
                    mode || 'upload',
                    targetAlbumId ? 'photos' : defaultModuleForUpload,
                    targetAlbumId ||
                      (selectedAlbumId !== 'all' ? selectedAlbumId : undefined)
                  )
                }
              />
            )}
          </section>
        </main>
      </div>

      {/* Simple 3-Step Upload Modal */}
      <UploadShareModal
        isOpen={uploadModalOpen}
        initialMode={uploadModalMode}
        defaultModule={defaultModuleForUpload}
        albums={albums}
        defaultAlbumId={selectedAlbumId !== 'all' ? selectedAlbumId : undefined}
        incomingShareDraft={incomingShareDraft}
        onClose={() => {
          setUploadModalOpen(false);
          setIncomingShareDraft(null);
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
          handleOpenUploadModal(
            'upload',
            activeTab === 'all' ? 'photos' : activeTab,
            selectedAlbumId !== 'all' ? selectedAlbumId : undefined
          )
        }
      />
    </div>
  );
}
