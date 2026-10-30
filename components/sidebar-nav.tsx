'use client';

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  FileText,
  Image as ImageIcon,
  Mic,
  LayoutGrid,
  Plus,
  Smartphone,
  X,
  LogIn,
  LogOut,
  CheckCircle2,
  Folder,
} from 'lucide-react';
import { FilterTab, PhotoAlbum } from '@/lib/vault-logic';

interface SidebarNavProps {
  activeTab: FilterTab;
  onSelectTab: (tab: FilterTab) => void;
  counts: Record<FilterTab, number>;
  albums: PhotoAlbum[];
  selectedAlbumId: string;
  albumPhotoCounts: Record<string, number>;
  onSelectAlbum: (albumId: string) => void;
  userEmail?: string | null;
  onSignInGoogle: () => void;
  onSignOutGoogle: () => void;
  onOpenUploadModal: (initialMode?: 'upload' | 'record' | 'simulate-share') => void;
  onOpenPwaModal: () => void;
  isInstallable: boolean;
  isInstalled: boolean;
  onInstallPwa: () => void;
  isDesktopSidebarOpen: boolean;
  onToggleDesktopSidebar: () => void;
  isMobileDrawerOpen: boolean;
  onOpenMobileDrawer: () => void;
  onCloseMobileDrawer: () => void;
}

export function SidebarNav({
  activeTab,
  onSelectTab,
  counts,
  albums,
  selectedAlbumId,
  albumPhotoCounts,
  onSelectAlbum,
  userEmail,
  onSignInGoogle,
  onSignOutGoogle,
  onOpenUploadModal,
  onOpenPwaModal,
  isInstallable,
  isInstalled,
  onInstallPwa,
  isMobileDrawerOpen,
  onOpenMobileDrawer,
  onCloseMobileDrawer,
}: SidebarNavProps) {
  const navItems: Array<{
    id: FilterTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'all',
      label: 'כל הקבצים',
      icon: LayoutGrid,
    },
    {
      id: 'documents',
      label: 'מסמכים חשובים',
      icon: FileText,
    },
    {
      id: 'photos',
      label: 'תמונות ואלבומים',
      icon: ImageIcon,
    },
    {
      id: 'recordings',
      label: 'הקלטות',
      icon: Mic,
    },
  ];

  const renderSidebarContent = (isMobileDrawer: boolean) => (
    <div className="flex flex-col h-full bg-vault-950/80 backdrop-blur-2xl text-slate-100 select-none">
      {/* Brand header */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 min-w-0">
          <span className="relative shrink-0">
            <span
              aria-hidden="true"
              className="absolute -inset-1 rounded-2xl bg-mint-400/25 blur-md"
            />
            <img
              src="/icon.svg"
              alt="לוגו"
              referrerPolicy="no-referrer"
              className="relative w-10 h-10 rounded-2xl ring-1 ring-white/10"
            />
          </span>
          <div className="min-w-0">
            <span className="block text-lg font-bold tracking-tight text-slate-50">
              הכספת שלי
            </span>
            <span className="block text-[11px] font-medium text-mint-300/90">
              מאובטח · מסונכרן · מסודר
            </span>
          </div>
        </div>

        {isMobileDrawer && (
          <button
            type="button"
            onClick={onCloseMobileDrawer}
            aria-label="סגירת תפריט"
            className="w-11 h-11 flex items-center justify-center rounded-2xl glass text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Primary action */}
      <div className="p-4">
        <button
          type="button"
          onClick={() => {
            if (isMobileDrawer) onCloseMobileDrawer();
            onOpenUploadModal('upload');
          }}
          className="btn-accent w-full h-13 flex items-center justify-center gap-2.5 px-4 rounded-2xl text-base font-bold cursor-pointer"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>העלאת קובץ חדש</span>
        </button>
      </div>

      {/* Module navigation */}
      <nav
        aria-label={isMobileDrawer ? 'תפריט מובייל' : 'תפריט ראשי'}
        className="flex-1 px-3 space-y-1.5 overflow-y-auto"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <div key={item.id} className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  if (item.id === 'photos') {
                    onSelectAlbum('all');
                  }
                  if (isMobileDrawer) onCloseMobileDrawer();
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full min-h-13 flex items-center justify-between px-4 py-3 rounded-2xl text-right transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-white/[0.09] border-white/[0.12] text-slate-50 font-bold shadow-[inset_0_1px_0_0_rgb(255_255_255/0.07)]'
                    : 'border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-100 font-medium'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span
                    className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-colors ${
                      isActive
                        ? 'bg-gradient-to-br from-mint-400/25 to-teal-400/15 text-mint-300'
                        : 'bg-white/[0.05] text-slate-400'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                  </span>
                  <span className="text-[15px] truncate">{item.label}</span>
                </div>

                <span
                  className={`text-sm font-mono tabular-nums rounded-lg px-2 py-0.5 shrink-0 ${
                    isActive
                      ? 'bg-mint-400/15 text-mint-300 font-bold'
                      : 'text-slate-500'
                  }`}
                >
                  {counts[item.id]}
                </span>
              </button>

              {/* Photo albums nested under Photos */}
              {item.id === 'photos' && albums.length > 0 && (
                <div className="mr-5 pr-3 border-r border-white/[0.08] space-y-1 py-1">
                  {albums.map((alb) => {
                    const isAlbSelected =
                      activeTab === 'photos' && selectedAlbumId === alb.id;
                    return (
                      <button
                        key={alb.id}
                        type="button"
                        onClick={() => {
                          onSelectTab('photos');
                          onSelectAlbum(alb.id);
                          if (isMobileDrawer) onCloseMobileDrawer();
                        }}
                        className={`w-full min-h-11 py-2 px-3 rounded-xl flex items-center justify-between text-sm transition-colors cursor-pointer border ${
                          isAlbSelected
                            ? 'bg-white/[0.08] border-white/[0.1] text-mint-300 font-bold'
                            : 'border-transparent text-slate-400 hover:text-white hover:bg-white/[0.04]'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          <Folder
                            className={`w-4 h-4 shrink-0 ${
                              isAlbSelected ? 'text-mint-400' : 'text-slate-500'
                            }`}
                          />
                          <span className="truncate">{alb.name}</span>
                        </span>
                        <span className="font-mono text-xs tabular-nums text-slate-500">
                          {albumPhotoCounts[alb.id] || 0}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer: account + PWA */}
      <div className="p-4 border-t border-white/[0.06] space-y-2 pb-safe">
        {userEmail ? (
          <div className="flex items-center justify-between gap-2 min-h-11 px-3 py-2.5 rounded-2xl glass text-xs">
            <span className="flex items-center gap-2 text-mint-300 font-medium truncate">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="truncate">מחובר לענן ({userEmail})</span>
            </span>
            <button
              type="button"
              onClick={onSignOutGoogle}
              title="התנתק"
              aria-label="התנתקות מהחשבון"
              className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSignInGoogle}
            className="w-full min-h-11 flex items-center justify-center gap-2 rounded-2xl glass text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4 text-mint-400" />
            <span>גיבוי בענן (Google)</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            if (isMobileDrawer) onCloseMobileDrawer();
            if (isInstallable) {
              onInstallPwa();
            } else {
              onOpenPwaModal();
            }
          }}
          className="w-full min-h-11 flex items-center justify-center gap-2 rounded-2xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
        >
          <Smartphone className="w-4 h-4 text-mint-400" />
          <span>
            {isInstalled ? 'מותקן בטלפון' : 'שמירת אייקון למסך הבית בנייד'}
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Right-Hand Sidebar */}
      <aside
        aria-label="סיידבאר ראשי"
        className="hidden md:flex w-72 shrink-0 flex-col border-l border-white/[0.06] bg-vault-950/40 backdrop-blur-xl min-h-screen sticky top-0 h-screen z-30"
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Slide-Over Glass Drawer */}
      <AnimatePresence>
        {isMobileDrawerOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={onCloseMobileDrawer}
              aria-hidden="true"
              className="fixed inset-0 bg-vault-950/70 backdrop-blur-sm"
            />
            <motion.aside
              aria-label="תפריט צד למובייל"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="relative z-10 w-80 max-w-[86vw] h-full flex flex-col bg-vault-900/95 backdrop-blur-2xl border-l border-white/[0.08] shadow-[-24px_0_64px_-24px_rgb(0_0_0/0.8)] pt-safe"
            >
              {renderSidebarContent(true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Floating Glass Dock */}
      <nav
        aria-label="ניווט תחתון"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-safe"
      >
        <div className="glass-strong rounded-3xl shadow-[0_-8px_40px_-12px_rgb(0_0_0/0.7)] grid grid-cols-5 items-center px-1.5 py-1.5 mb-1">
          <button
            type="button"
            onClick={onOpenMobileDrawer}
            className="h-13 flex flex-col items-center justify-center gap-0.5 rounded-2xl text-slate-400 hover:text-white active:scale-95 transition cursor-pointer"
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-xl">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="w-[22px] h-[22px]"
                aria-hidden="true"
              >
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
            </span>
            <span className="text-[10.5px] font-semibold">תפריט</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('documents')}
            aria-current={activeTab === 'documents' ? 'page' : undefined}
            className={`h-13 flex flex-col items-center justify-center gap-0.5 rounded-2xl transition cursor-pointer ${
              activeTab === 'documents'
                ? 'text-mint-300 bg-white/[0.08]'
                : 'text-slate-400 hover:text-white active:scale-95'
            }`}
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-xl">
              <FileText className="w-[21px] h-[21px]" />
            </span>
            <span className="text-[10.5px] font-semibold">מסמכים</span>
          </button>

          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => onOpenUploadModal('upload')}
              aria-label="העלאת קובץ חדש"
              className="btn-accent w-14 h-14 -mt-7 rounded-3xl flex items-center justify-center cursor-pointer"
            >
              <Plus className="w-7 h-7 stroke-[2.5]" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => onSelectTab('photos')}
            aria-current={activeTab === 'photos' ? 'page' : undefined}
            className={`h-13 flex flex-col items-center justify-center gap-0.5 rounded-2xl transition cursor-pointer ${
              activeTab === 'photos'
                ? 'text-mint-300 bg-white/[0.08]'
                : 'text-slate-400 hover:text-white active:scale-95'
            }`}
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-xl">
              <ImageIcon className="w-[21px] h-[21px]" />
            </span>
            <span className="text-[10.5px] font-semibold">תמונות</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('recordings')}
            aria-current={activeTab === 'recordings' ? 'page' : undefined}
            className={`h-13 flex flex-col items-center justify-center gap-0.5 rounded-2xl transition cursor-pointer ${
              activeTab === 'recordings'
                ? 'text-mint-300 bg-white/[0.08]'
                : 'text-slate-400 hover:text-white active:scale-95'
            }`}
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-xl">
              <Mic className="w-[21px] h-[21px]" />
            </span>
            <span className="text-[10.5px] font-semibold">הקלטות</span>
          </button>
        </div>
      </nav>
    </>
  );
}
