'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  Plus,
  Menu,
  RefreshCw,
  AlertTriangle,
  Undo2,
  X,
  CheckSquare,
  FolderInput,
  Tag as TagIcon,
  Share2,
  Trash2,
} from 'lucide-react';
import {
  VaultItem,
  Folder,
  FilterTab,
  ModuleType,
  VaultItemUpdates,
  MODULE_META,
  MODULE_IDS,
  SortMode,
  createVaultItem,
  createFolder,
  CreateVaultItemInput,
  filterAndSortItems,
  computeModuleCounts,
  computeFolderCounts,
  computeExpiryAlerts,
  collectTags,
} from '@/lib/vault-logic';
import {
  loadLocalVaultItems,
  loadLocalFolders,
  saveVaultItemToDatabase,
  updateVaultItemInDatabase,
  deleteVaultItemFromDatabase,
  restoreVaultItem as restoreVaultItemInDatabase,
  saveFolderToDatabase,
  deleteFolderFromDatabase,
  subscribeToUserVault,
  VaultSyncState,
  VaultSyncHandle,
} from '@/lib/vault-storage';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import { useIncomingShare, OpenShareDraft } from '@/hooks/use-incoming-share';
import { exportVaultZip } from '@/lib/backup';
import { shareVaultItems } from '@/lib/share';
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
import { cn } from '@/lib/utils';

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

const SORT_LABELS: Record<SortMode, string> = {
  newest: 'חדש ביותר',
  oldest: 'ישן ביותר',
  name: 'שם (א-ת)',
  size: 'גודל',
};

/** Fires OS notifications for soon-expiring documents (once per item+day). */
function notifyExpiries(alerts: ReturnType<typeof computeExpiryAlerts>) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const today = new Date().toISOString().slice(0, 10);
  for (const { item, daysLeft } of alerts.filter((a) => a.daysLeft <= 7)) {
    const key = `expiry_notified_${item.id}`;
    try {
      if (window.localStorage.getItem(key) === today) continue;
      window.localStorage.setItem(key, today);
    } catch {
      // storage unavailable — notify anyway
    }
    const when =
      daysLeft < 0
        ? `פג תוקף לפני ${Math.abs(daysLeft)} ימים!`
        : daysLeft === 0
        ? 'פג התוקף היום!'
        : `פג תוקף בעוד ${daysLeft} ימים`;
    new Notification(`כספת ניהול — ${item.title}`, {
      body: when,
      icon: '/pwa-192x192.png',
      tag: `expiry-${item.id}`,
    });
  }
}

export default function SmartVaultCRMPage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [viewTrash, setViewTrash] = useState(false);

  // Multi-select bulk actions.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTagInput, setBulkTagInput] = useState('');

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

  // "Moved to trash" toast with undo (restore).
  const [trashToast, setTrashToast] = useState<{ id: string; title: string } | null>(null);
  const trashToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cloud sync state for the header indicator.
  const [syncState, setSyncState] = useState<VaultSyncState | null>(null);
  const syncHandleRef = useRef<VaultSyncHandle | null>(null);

  // Theme (dark mode) + full-backup busy state.
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const { isInstallable, isInstalled, install } = usePWAInstall();

  // Apply the persisted/system theme on mount.
  useEffect(() => {
    const stored = window.localStorage.getItem('vault-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = stored ? stored === 'dark' : prefersDark;
    setIsDarkMode(dark);
    document.documentElement.classList.toggle('dark', dark);
  }, []);

  const handleToggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      try {
        window.localStorage.setItem('vault-theme', next ? 'dark' : 'light');
      } catch {
        // storage unavailable — theme just won't persist
      }
      return next;
    });
  };

  const handleExportBackup = async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    try {
      await exportVaultZip(items.filter((i) => !i.deletedAt), folders);
    } catch (error) {
      console.error('backup failed:', error);
    } finally {
      setIsBackingUp(false);
    }
  };

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

  const stopVaultSync = useCallback(() => {
    syncHandleRef.current?.();
    syncHandleRef.current = null;
    setSyncState(null);
  }, []);

  const startVaultSync = useCallback(
    (email: string) => {
      stopVaultSync();
      syncHandleRef.current = subscribeToUserVault(email, {
        onItemsChange: (cloudItems) => {
          setItems(cloudItems);
          setIsLoaded(true);
        },
        onFoldersChange: (cloudFolders) => {
          setFolders(cloudFolders);
        },
        onSyncStateChange: (state) => setSyncState(state),
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
  const trashCount = useMemo(
    () => items.filter((item) => item.deletedAt).length,
    [items]
  );
  const expiryAlerts = useMemo(() => computeExpiryAlerts(items), [items]);
  const tagOptions = useMemo(() => collectTags(items).slice(0, 12), [items]);

  // OS notifications for urgent expiries (once a day per item).
  useEffect(() => {
    if (expiryAlerts.length > 0) notifyExpiries(expiryAlerts);
  }, [expiryAlerts]);

  // Dismiss the trash toast automatically.
  useEffect(() => {
    if (!trashToast) return;
    if (trashToastTimer.current) clearTimeout(trashToastTimer.current);
    trashToastTimer.current = setTimeout(() => setTrashToast(null), 6000);
    return () => {
      if (trashToastTimer.current) clearTimeout(trashToastTimer.current);
    };
  }, [trashToast]);

  const filteredItems = useMemo(
    () =>
      filterAndSortItems(items, {
        moduleFilter: viewTrash ? 'all' : activeTab,
        folderFilter: activeTab === 'all' || viewTrash ? 'all' : selectedFolderId,
        tagFilter,
        searchQuery,
        sortOrder: sortMode,
        deleted: viewTrash ? 'only' : 'exclude',
      }),
    [items, activeTab, selectedFolderId, tagFilter, searchQuery, sortMode, viewTrash]
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

  const handleToggleFavorite = (item: VaultItem) => {
    void handleUpdateItem(item.id, {
      title: item.title,
      module: item.module,
      folderId: item.folderId,
      folderName: item.folderName,
      tags: item.tags,
      favorite: !item.favorite,
      expiresAt: item.expiresAt,
      notes: item.notes,
    });
    if (selectedItem?.id === item.id) {
      setSelectedItem({ ...selectedItem, favorite: !item.favorite });
    }
  };

  const handleDeleteItem = async (id: string) => {
    const target = items.find((i) => i.id === id);
    const updated = await deleteVaultItemFromDatabase(id, items);
    setItems(updated);
    setSelectedItem((current) => (current?.id === id ? null : current));
    if (target && !target.deletedAt) {
      setTrashToast({ id, title: target.title });
    }
  };

  const handleRestoreItem = async (id: string) => {
    const updated = await restoreVaultItemInDatabase(id, items);
    setItems(updated);
    setTrashToast(null);
  };

  const handleDeleteForever = async (id: string) => {
    const updated = await deleteVaultItemFromDatabase(id, items, { permanent: true });
    setItems(updated);
  };

  const handleSelectTab = (tab: FilterTab) => {
    setActiveTab(tab);
    setViewTrash(false);
    setSelectedFolderId('all');
    setTagFilter('all');
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  };

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds]
  );

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      await deleteVaultItemFromDatabase(id, items);
    }
    const deleted = new Set(selectedIds);
    setItems((current) =>
      current.map((item) =>
        deleted.has(item.id) ? { ...item, deletedAt: new Date().toISOString() } : item
      )
    );
    setSelectedIds([]);
    setSelectionMode(false);
  };

  const handleBulkAddTag = async () => {
    const tag = bulkTagInput.trim();
    if (!tag) return;
    for (const item of selectedItems) {
      await updateVaultItemInDatabase(
        item.id,
        {
          title: item.title,
          module: item.module,
          folderId: item.folderId,
          folderName: item.folderName,
          tags: [...(item.tags || []), tag],
          favorite: item.favorite,
          expiresAt: item.expiresAt,
          notes: item.notes,
        },
        items
      );
    }
    // Re-derive items locally from the last updated snapshot.
    setItems((current) =>
      current.map((item) =>
        selectedIds.includes(item.id)
          ? { ...item, tags: [...(item.tags || []), tag] }
          : item
      )
    );
    setBulkTagInput('');
    setSelectedIds([]);
    setSelectionMode(false);
  };

  const handleBulkMoveToFolder = async (folderId: string) => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;
    for (const item of selectedItems.filter((i) => i.module === folder.module)) {
      await updateVaultItemInDatabase(
        item.id,
        {
          title: item.title,
          module: item.module,
          folderId: folder.id,
          folderName: folder.name,
          tags: item.tags,
          favorite: item.favorite,
          expiresAt: item.expiresAt,
          notes: item.notes,
        },
        items
      );
    }
    setItems((current) =>
      current.map((item) =>
        selectedIds.includes(item.id) && item.module === folder.module
          ? { ...item, folderId: folder.id, folderName: folder.name }
          : item
      )
    );
    setSelectedIds([]);
    setSelectionMode(false);
  };

  const defaultModuleForUpload: ModuleType =
    activeTab === 'all' ? 'photos' : activeTab;
  const destinationModeForCurrentView: UploadDestinationMode =
    activeTab === 'all' ? 'auto' : 'fixed';
  // Uploads from inside a module view target the folder the user has open.
  const currentFolderId =
    activeTab !== 'all' && selectedFolderId !== 'all' ? selectedFolderId : undefined;

  const activeModuleTitle = viewTrash
    ? 'סל מיחזור'
    : activeTab === 'all'
    ? 'כל הקבצים'
    : MODULE_META[activeTab].label;

  const syncLabel = !userEmail
    ? 'מקומי בלבד — פתח/י את הכספת כדי לסנכרן'
    : syncState?.syncing
    ? 'מסנכרן…'
    : syncState?.lastSyncedAt
    ? `מסונכרן ✓ ${syncState.lastSyncedAt.toLocaleTimeString('he-IL', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : 'מתחבר לענן…';

  return (
    <div className="min-h-screen flex text-slate-800 pb-28 md:pb-0">
      {/* Right-Hand Glass Sidebar */}
      <SidebarNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        counts={counts}
        folders={folders}
        selectedFolderId={selectedFolderId}
        folderCounts={folderCounts}
        onSelectFolder={setSelectedFolderId}
        trashCount={trashCount}
        viewTrash={viewTrash}
        onOpenTrash={() => setViewTrash(true)}
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
        onExportBackup={() => void handleExportBackup()}
        isBackingUp={isBackingUp}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Workspace over the aurora canvas */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        {/* Glass Sticky Header: Title, Sync, Upload */}
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

              {/* Sync indicator + manual sync */}
              <span
                title={syncLabel}
                className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 min-w-0"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'w-2 h-2 rounded-full shrink-0',
                    !userEmail
                      ? 'bg-slate-300'
                      : syncState?.syncing
                      ? 'bg-amber-400 animate-pulse'
                      : syncState?.lastSyncedAt
                      ? 'bg-mint-500'
                      : 'bg-slate-300 animate-pulse'
                  )}
                />
                <span className="truncate">{syncLabel}</span>
                {userEmail && (
                  <button
                    type="button"
                    onClick={() => syncHandleRef.current?.syncNow()}
                    aria-label="סנכרון עכשיו"
                    title="סנכרון עכשיו"
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-900/[0.06] text-slate-400 hover:text-mint-700 transition cursor-pointer shrink-0"
                  >
                    <RefreshCw className={cn('w-3.5 h-3.5', syncState?.syncing && 'animate-spin')} />
                  </button>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Compact mobile sync dot */}
              <span
                title={syncLabel}
                aria-hidden="true"
                className={cn(
                  'sm:hidden w-2.5 h-2.5 rounded-full',
                  !userEmail
                    ? 'bg-slate-300'
                    : syncState?.syncing
                    ? 'bg-amber-400 animate-pulse'
                    : syncState?.lastSyncedAt
                    ? 'bg-mint-500'
                    : 'bg-slate-300 animate-pulse'
                )}
              />

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
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
          {/* Expiry banner — documents about to expire */}
          {!viewTrash && expiryAlerts.length > 0 && (
            <div className="glass card-sheen rounded-3xl p-4 space-y-2" role="alert">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                מסמכים שפג התוקף שלהם (או עומדים לפוג):
              </div>
              <div className="flex flex-col gap-1.5">
                {expiryAlerts.slice(0, 3).map(({ item, daysLeft, level }) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition cursor-pointer border',
                      level === 'expired'
                        ? 'bg-red-500/10 border-red-500/30 text-red-700'
                        : level === 'week'
                        ? 'bg-amber-400/15 border-amber-500/35 text-amber-700'
                        : 'bg-slate-900/[0.04] border-slate-900/[0.08] text-slate-600'
                    )}
                  >
                    <span className="truncate">{item.title}</span>
                    <span dir="rtl" className="shrink-0 font-bold">
                      {daysLeft < 0
                        ? `פג לפני ${Math.abs(daysLeft)} ימים`
                        : daysLeft === 0
                        ? 'פג היום!'
                        : `בעוד ${daysLeft} ימים`}
                    </span>
                  </button>
                ))}
              </div>
              {typeof window !== 'undefined' &&
                'Notification' in window &&
                Notification.permission === 'default' && (
                  <button
                    type="button"
                    onClick={() => void Notification.requestPermission()}
                    className="text-xs font-bold text-mint-700 hover:underline cursor-pointer"
                  >
                    הפעלת התראות טלפון לתוקף שמתקרב →
                  </button>
                )}
            </div>
          )}

          {!viewTrash && (items.length > 0 || searchQuery) && (
            <div className="space-y-3">
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
                  placeholder="חיפוש קובץ לפי שם, תיקייה, תגית או תאריך..."
                  className="w-full h-12 pr-12 pl-4 rounded-2xl glass text-base text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-mint-500/60 focus:bg-white dark:focus:bg-white/10 transition-colors"
                />
              </div>

              {/* Sort + tag filters */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400">מיון:</span>
                {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSortMode(mode)}
                    aria-pressed={sortMode === mode}
                    className={cn(
                      'min-h-8 px-3 py-1 rounded-lg border text-xs font-bold transition cursor-pointer',
                      sortMode === mode
                        ? 'chip-selected'
                        : 'glass text-slate-500 hover:bg-slate-900/5'
                    )}
                  >
                    {SORT_LABELS[mode]}
                  </button>
                ))}

                {tagOptions.length > 0 && (
                  <>
                    <span className="text-[11px] font-bold text-slate-400 mr-2">תגיות:</span>
                    {tagOptions.map(({ tag, count }) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setTagFilter(tagFilter === tag ? 'all' : tag)}
                        aria-pressed={tagFilter === tag}
                        className={cn(
                          'min-h-8 px-3 py-1 rounded-lg border text-xs font-bold transition cursor-pointer',
                          tagFilter === tag
                            ? 'chip-selected'
                            : 'glass text-slate-500 hover:bg-slate-900/5'
                        )}
                      >
                        {tag} <span className="opacity-60 font-mono">({count})</span>
                      </button>
                    ))}
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSelectionMode((v) => !v);
                    setSelectedIds([]);
                  }}
                  aria-pressed={selectionMode}
                  className={cn(
                    'min-h-8 px-3 py-1 rounded-lg border text-xs font-bold transition cursor-pointer mr-auto flex items-center gap-1.5',
                    selectionMode
                      ? 'chip-selected'
                      : 'glass text-slate-500 hover:bg-slate-900/5'
                  )}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  {selectionMode ? 'יציאה מבחירה' : 'בחירה מרובה'}
                </button>
              </div>
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
                onToggleFavorite={handleToggleFavorite}
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
                viewTrash={viewTrash}
                onRestoreItem={handleRestoreItem}
                onDeleteForever={handleDeleteForever}
                selectionMode={selectionMode && !viewTrash}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
              />
            )}
          </section>
        </main>
      </div>

      {/* Bulk-actions bar (multi-select) */}
      {selectionMode && (
        <div className="fixed bottom-24 md:bottom-6 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="glass-strong rounded-2xl shadow-2xl px-4 py-3 flex flex-wrap items-center gap-2 pointer-events-auto max-w-full">
            <span className="text-xs font-bold text-slate-700 shrink-0">
              {selectedIds.length} נבחרו
            </span>

            {activeTab !== 'all' &&
              folders.filter((f) => f.module === activeTab).length > 0 && (
                <label className="sr-only" htmlFor="bulk-folder-select">
                  העברה לתיקייה
                </label>
              )}
            {activeTab !== 'all' && (
              <select
                id="bulk-folder-select"
                value=""
                onChange={(e) => e.target.value && void handleBulkMoveToFolder(e.target.value)}
                className="input-glass min-h-9 py-1 text-xs"
                disabled={selectedIds.length === 0}
              >
                <option value="">העבר לתיקייה…</option>
                {folders
                  .filter((f) => f.module === activeTab)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            )}

            <input
              type="text"
              value={bulkTagInput}
              onChange={(e) => setBulkTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleBulkAddTag()}
              placeholder="הוסף תגית לכולם…"
              className="input-glass min-h-9 py-1 w-36 text-xs"
              disabled={selectedIds.length === 0}
            />
            <button
              type="button"
              onClick={() => void handleBulkAddTag()}
              disabled={selectedIds.length === 0 || !bulkTagInput.trim()}
              className="btn-accent min-h-9 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
            >
              <TagIcon className="w-3.5 h-3.5" />
              תיוג
            </button>

            <button
              type="button"
              onClick={() => void shareVaultItems(selectedItems)}
              disabled={selectedIds.length === 0}
              className="min-h-9 px-3 py-1.5 rounded-xl glass text-xs font-bold text-slate-700 hover:bg-slate-900/5 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Share2 className="w-3.5 h-3.5 text-mint-600" />
              שיתוף
            </button>

            <button
              type="button"
              onClick={() => void handleBulkDelete()}
              disabled={selectedIds.length === 0}
              className="min-h-9 px-3 py-1.5 rounded-xl border border-red-500/25 bg-red-500/10 text-xs font-semibold text-red-600 hover:bg-red-500/15 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              מחיקה
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectionMode(false);
                setSelectedIds([]);
              }}
              aria-label="סיום בחירה"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-900/[0.06] transition cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Trash undo toast */}
      {trashToast && (
        <div className="fixed bottom-24 md:bottom-6 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="glass-strong rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 pointer-events-auto max-w-full">
            <span className="text-sm text-slate-700 truncate">
              <strong className="font-bold">{trashToast.title}</strong> הועבר לסל המיחזור
            </span>
            <button
              type="button"
              onClick={() => void handleRestoreItem(trashToast.id)}
              className="btn-accent min-h-9 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Undo2 className="w-3.5 h-3.5" />
              שחזור
            </button>
            <button
              type="button"
              onClick={() => setTrashToast(null)}
              aria-label="סגירת ההודעה"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-900/[0.06] transition cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
        onToggleFavorite={handleToggleFavorite}
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
