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
  Menu,
  Folder,
  LogIn,
  LogOut,
  CheckCircle2,
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
    <div className="flex flex-col h-full bg-slate-900 text-white select-none">
      {/* Simple App Title */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <img
            src="/icon.svg"
            alt="לוגו"
            referrerPolicy="no-referrer"
            className="w-9 h-9 rounded-xl"
          />
          <span className="text-lg font-bold tracking-tight">הכספת שלי</span>
        </div>

        {isMobileDrawer && (
          <button
            type="button"
            onClick={onCloseMobileDrawer}
            aria-label="סגירת תפריט"
            className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Single Big Obvious Action Button */}
      <div className="p-5">
        <button
          type="button"
          onClick={() => {
            if (isMobileDrawer) onCloseMobileDrawer();
            onOpenUploadModal('upload');
          }}
          className="w-full h-13 flex items-center justify-center gap-2.5 px-4 rounded-2xl bg-teal-400 text-slate-950 text-base font-bold hover:bg-teal-300 active:scale-[0.99] transition-all cursor-pointer shadow-sm"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>העלאת קובץ חדש</span>
        </button>
      </div>

      {/* Clean, Large Module Buttons */}
      <nav
        aria-label={isMobileDrawer ? 'תפריט מובייל' : 'תפריט ראשי'}
        className="flex-1 px-4 space-y-2 overflow-y-auto"
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
                className={`w-full h-13 flex items-center justify-between px-4 rounded-2xl text-right transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-950 font-bold shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white font-medium'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon
                    className={`w-5 h-5 shrink-0 ${
                      isActive ? 'text-teal-600' : 'text-slate-400'
                    }`}
                  />
                  <span className="text-base">{item.label}</span>
                </div>

                <span
                  className={`text-sm font-mono tabular-nums ${
                    isActive ? 'text-slate-900 font-bold' : 'text-slate-400'
                  }`}
                >
                  {counts[item.id]}
                </span>
              </button>

              {/* Show Photo Albums cleanly under Photos */}
              {item.id === 'photos' && albums.length > 0 && (
                <div className="mr-6 pr-3 border-r border-slate-800 space-y-1 py-1">
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
                        className={`w-full py-2 px-3 rounded-xl flex items-center justify-between text-sm transition-colors cursor-pointer ${
                          isAlbSelected
                            ? 'bg-slate-800 text-teal-300 font-bold'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Folder className="w-4 h-4 text-teal-400 shrink-0" />
                          <span className="truncate">{alb.name}</span>
                        </span>
                        <span className="font-mono text-xs tabular-nums">
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

      {/* Simple Minimal Footer */}
      <div className="p-4 border-t border-slate-800 space-y-2">
        {userEmail ? (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-800/70 text-xs">
            <span className="flex items-center gap-2 text-teal-300 font-medium truncate">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="truncate">מחובר לענן ({userEmail})</span>
            </span>
            <button
              type="button"
              onClick={onSignOutGoogle}
              title="התנתק"
              className="text-slate-400 hover:text-white p-1 cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSignInGoogle}
            className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4 text-teal-400" />
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
          className="w-full h-10 flex items-center justify-center gap-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Smartphone className="w-4 h-4 text-teal-400" />
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
        className="hidden md:flex w-68 shrink-0 flex-col border-l border-slate-200 bg-slate-900 min-h-screen sticky top-0 h-screen z-30"
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Slide-Over Sidebar Drawer */}
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
              className="fixed inset-0 bg-slate-950/60"
            />
            <motion.aside
              aria-label="תפריט צד למובייל"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative z-10 w-76 max-w-[85vw] h-full flex flex-col bg-slate-900 shadow-2xl"
            >
              {renderSidebarContent(true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Simple Mobile Bottom Bar */}
      <nav
        aria-label="ניווט תחתון"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-white border-t border-slate-200 grid grid-cols-5 items-center px-2"
      >
        <button
          type="button"
          onClick={onOpenMobileDrawer}
          className="h-12 flex flex-col items-center justify-center rounded-xl text-slate-600 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[11px] font-semibold mt-0.5">תפריט</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('documents')}
          className={`h-12 flex flex-col items-center justify-center rounded-xl cursor-pointer ${
            activeTab === 'documents' ? 'text-teal-700 font-bold' : 'text-slate-500'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[11px] mt-0.5">מסמכים</span>
        </button>

        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => onOpenUploadModal('upload')}
            aria-label="העלאת קובץ חדש"
            className="w-12 h-12 rounded-2xl bg-teal-500 text-slate-950 flex items-center justify-center shadow-md cursor-pointer"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onSelectTab('photos')}
          className={`h-12 flex flex-col items-center justify-center rounded-xl cursor-pointer ${
            activeTab === 'photos' ? 'text-teal-700 font-bold' : 'text-slate-500'
          }`}
        >
          <ImageIcon className="w-5 h-5" />
          <span className="text-[11px] mt-0.5">תמונות</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('recordings')}
          className={`h-12 flex flex-col items-center justify-center rounded-xl cursor-pointer ${
            activeTab === 'recordings' ? 'text-teal-700 font-bold' : 'text-slate-500'
          }`}
        >
          <Mic className="w-5 h-5" />
          <span className="text-[11px] mt-0.5">הקלטות</span>
        </button>
      </nav>
    </>
  );
}
