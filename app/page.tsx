'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, Plus, Menu } from 'lucide-react';
import {
  VaultItem,
  Folder,
  FilterTab,
  ModuleType,
  VaultItemUpdates,
  MODULE_META,
  createVaultItem,
  createFolder,
  CreateVaultItemInput,
  filterAndSortItems,
  computeModuleCounts,
  computeFolderCounts,
} from '@/lib/vault-logic';
import {
  loadLocalVaultItems,
  loadLocalFolders,
  saveVaultItemToDatabase,
  updateVaultItemInDatabase,
  deleteVaultItemFromDatabase,
  saveFolderToDatabase,
  deleteFolderFromDatabase,
  subscribeToUserVault,
} from '@/lib/vault-storage';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import { useIncomingShare, OpenShareDraft } from '@/hooks/use-incoming-share';
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

interface UploadModalContext {
  mode: UploadMode;
  destinationMode: UploadDestinationMode;
  targetModule: ModuleType;
  targetFolderId?: string;
  incomingShareDraft?: SharedDraft | null;
}

interface OpenUploadOptions {
  mode?: UploadMode;
  destinationMode: UploadDestinationMode;
  targetModule?: ModuleType;
  targetFolderId?: string;
  incomingShareDraft?: SharedDraft | null;
}

export default function SmartVaultCRMPage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
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
  const [previewStartInEdit, setPreviewStartInEdit] = useState(false);
  const [pwaModalOpen, setPwaModalOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const { isInstallable, isInstalled, install } = usePWAInstall();

  const handleOpenUploadModal = useCallback(
    ({
      mode = 'upload',
      destinationMode,
      targetModule,
      targetFolderId,
      incomingShareDraft = null,
      notice = null,
    }: OpenUploadOptions & { notice?: string | null }) => {
      setUploadContext({
        mode,
        destinationMode,
        targetModule: targetModule || 'photos',
        targetFolderId,
        incomingShareDraft,
      });
      setShareNotice(notice);
      setUploadModalOpen(true);
    },
    []
  );

  // PWA share-target landing (?shared=1 / ?shared=error / ?title=&text=)
  const openShareDraft = useCallback<OpenShareDraft>(
    (draft, options) => {
      handleOpenUploadModal({
        mode: 'upload',
        destinationMode: 'choose',
        targetModule: options?.defaultModule || 'photos',
        incomingShareDraft: draft,
        notice: options?.notice ?? undefined,
      });
    },
    [handleOpenUploadModal]
  );
  useIncomingShare(openShareDraft);

  // Cloud vault sync handle (poll + focus refresh).
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
        onFoldersChange: (cloudFolders) => {
          setFolders(cloudFolders);
        },
      });
    },
    [stopVaultSync]
  );

  // Load clean initial state, probe the session, then sync the vault
  useEffect(() => {
    let mounted = true;

    (async () => {
      const [localItems, localFolders] = await Promise.all([
        loadLocalVaultItems(),
        loadLocalFolders(),
      ]);
      if (mounted) {
        setItems(localItems);
        setFolders(localFolders);
        setIsLoaded(true);
      }
    })();

    // Session probe — the session lives in an httpOnly cookie backed by
    // the users collection in MongoDB.
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
  const folderCounts = useMemo(() => computeFolderCounts(items), [items]);

  const filteredItems = useMemo(
    () =>
      filterAndSortItems(items, {
        moduleFilter: activeTab,
        folderFilter: activeTab === 'all' ? 'all' : selectedFolderId,
        searchQuery,
        sortOrder: 'newest',
      }),
    [items, activeTab, selectedFolderId, searchQuery]
  );

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

  const handleCreateFolder = async (name: string, module: ModuleType): Promise<Folder> => {
    const newFolder = createFolder(name, module);
    const updatedFolders = await saveFolderToDatabase(newFolder, folders);
    setFolders(updatedFolders);
    return newFolder;
  };

  const handleDeleteFolder = async (folderId: string) => {
    const updatedFolders = await deleteFolderFromDatabase(folderId, folders);
    setFolders(updatedFolders);
    if (selectedFolderId === folderId) {
      setSelectedFolderId('all');
    }
  };

  const handleSaveNewItem = async (input: CreateVaultItemInput) => {
    const newItem = createVaultItem(input);
    const updated = await saveVaultItemToDatabase(newItem, items);
    setItems(updated);
  };

  const handleUpdateItem = async (id: string, updates: VaultItemUpdates) => {
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
  // Uploads from inside a module view target the folder the user has open.
  const currentFolderId =
    activeTab !== 'all' && selectedFolderId !== 'all' ? selectedFolderId : undefined;

  const activeModuleTitle =
    activeTab === 'all' ? 'כל הקבצים' : MODULE_META[activeTab].label;

  return (
    <div className="min-h-screen flex text-slate-800 pb-28 md:pb-0">
      {/* Right-Hand Glass Sidebar */}
      <SidebarNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        counts={counts}
        folders={folders}
        selectedFolderId={selectedFolderId}
        folderCounts={folderCounts}
        onSelectFolder={setSelectedFolderId}
        userEmail={userEmail}
        onSignIn={() => setAuthModalOpen(true)}
        onSignOut={handleSignOut}
        onOpenUploadModal={(mode) =>
          handleOpenUploadModal({
            mode,
            destinationMode: destinationModeForCurrentView,
            targetModule: defaultModuleForUpload,
            targetFolderId: currentFolderId,
          })
        }
        onOpenPwaModal={() => setPwaModalOpen(true)}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        onInstallPwa={install}
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
                  targetFolderId: currentFolderId,
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
                placeholder="חיפוש קובץ לפי שם, אלבום, תגית או תאריך..."
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
                folders={folders}
                selectedFolderId={selectedFolderId}
                folderCounts={folderCounts}
                moduleCounts={counts}
                searchQuery={searchQuery}
                onSelectFolder={setSelectedFolderId}
                onCreateFolder={handleCreateFolder}
                onDeleteFolder={handleDeleteFolder}
                onSelectItem={(item) => setSelectedItem(item)}
                onEditItem={(item) => {
                  setSelectedItem(item);
                  setPreviewStartInEdit(true);
                }}
                onDeleteItem={handleDeleteItem}
                onOpenUpload={(mode, targetFolderId) =>
                  handleOpenUploadModal({
                    mode: mode || 'upload',
                    destinationMode:
                      targetFolderId || activeTab !== 'all' ? 'fixed' : 'auto',
                    targetModule: defaultModuleForUpload,
                    targetFolderId: targetFolderId || currentFolderId,
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
        folders={folders}
        defaultFolderId={uploadContext.targetFolderId}
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
        onCreateFolder={handleCreateFolder}
        onSaveItem={handleSaveNewItem}
      />

      {/* Item Preview Modal */}
      <ItemPreviewModal
        item={selectedItem}
        folders={folders}
        initialEditing={previewStartInEdit}
        onClose={() => {
          setSelectedItem(null);
          setPreviewStartInEdit(false);
        }}
        onCreateFolder={handleCreateFolder}
        onUpdateItem={handleUpdateItem}
        onDeleteItem={handleDeleteItem}
      />

      {/* PWA Mobile App Icon Modal */}
      <PwaInstallModal
        isOpen={pwaModalOpen}
        onClose={() => setPwaModalOpen(false)}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
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
