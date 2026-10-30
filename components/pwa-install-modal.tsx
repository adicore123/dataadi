'use client';

import React from 'react';
import { X, Smartphone, Share2, Download, Check } from 'lucide-react';

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  onInstall: () => void;
  onTryMobileShare: () => void;
}

export function PwaInstallModal({
  isOpen,
  onClose,
  isInstallable,
  isInstalled,
  onInstall,
  onTryMobileShare,
}: PwaInstallModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4"
    >
      <div className="w-full max-w-lg rounded-t-4xl sm:rounded-4xl glass-strong shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Sheet handle (mobile affordance) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1" aria-hidden="true">
          <div className="sheet-handle" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-900/[0.08]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-mint-500/20 to-teal-500/10 text-mint-600 shrink-0">
              <Smartphone className="w-[18px] h-[18px]" />
            </span>
            <h2
              id="pwa-modal-title"
              className="text-base font-bold tracking-tight text-slate-900 leading-snug"
            >
              שמירה כאפליקציית Web למובייל ושיתוף מהיר
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירת חלון אפליקציית מובייל"
            className="w-11 h-11 flex items-center justify-center rounded-2xl glass text-slate-500 hover:text-slate-900 hover:bg-slate-900/5 active:scale-95 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* App Icon Preview on Phone Home Screen */}
          <div className="relative p-5 rounded-3xl glass card-sheen overflow-hidden">
            <div
              aria-hidden="true"
              className="absolute -top-16 -left-8 w-48 h-48 rounded-full bg-mint-400/15 blur-3xl"
            />
            <div className="relative flex items-center gap-4">
              <img
                src="/pwa-512x512.png"
                alt="אייקון מעוצב של כספת ניהול"
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-2xl shadow-glow ring-1 ring-slate-900/10 shrink-0"
              />
              <div className="space-y-1 min-w-0">
                <div className="text-sm font-bold text-slate-900">כספת ניהול</div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  האייקון המעוצב מופיע אוטומטית על מסך הבית בטלפון (אייפון או
                  אנדרואיד) ונפתח במסך מלא בדיוק כמו אפליקציה טבעית.
                </p>
              </div>
            </div>
          </div>

          {isInstallable && !isInstalled && (
            <button
              type="button"
              onClick={onInstall}
              className="btn-accent w-full min-h-12 py-3 px-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>התקן כעת כאפליקציה במכשיר</span>
            </button>
          )}

          {isInstalled && (
            <div className="p-3.5 rounded-2xl bg-mint-500/10 border border-mint-500/30 text-xs font-semibold text-mint-700 flex items-center gap-2">
              <Check className="w-4 h-4 text-mint-600 shrink-0" />
              <span>האפליקציה כבר מותקנת ופועלת במצב Web App עצמאי!</span>
            </div>
          )}

          {/* Instructions for iOS & Android */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl glass space-y-2">
              <h3 className="text-xs font-bold text-slate-900">
                באייפון (Safari - iOS):
              </h3>
              <ol className="text-xs text-slate-500 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>
                  לחץ על כפתור ה-<strong className="text-slate-700">שיתוף (Share)</strong>{' '}
                  בתחתית הדפדפן.
                </li>
                <li>
                  גלול ובחר{' '}
                  <strong className="text-slate-700">
                    &quot;הוסף למסך הבית&quot; (Add to Home Screen)
                  </strong>
                  .
                </li>
                <li>האייקון המעוצב יופיע מיד בין האפליקציות שלך.</li>
              </ol>
            </div>

            <div className="p-4 rounded-2xl glass space-y-2">
              <h3 className="text-xs font-bold text-slate-900">
                באנדרואיד (Chrome):
              </h3>
              <ol className="text-xs text-slate-500 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>לחץ על תפריט שלוש הנקודות בראש הדפדפן.</li>
                <li>
                  בחר{' '}
                  <strong className="text-slate-700">&quot;התקן אפליקציה&quot;</strong>{' '}
                  או{' '}
                  <strong className="text-slate-700">&quot;הוסף למסך הבית&quot;</strong>.
                </li>
                <li>לאחר ההתקנה, האפליקציה תופיע גם בתפריט השיתוף של הטלפון!</li>
              </ol>
            </div>
          </div>

          {/* Mobile Share Explanation */}
          <div className="p-4 rounded-2xl glass space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Share2 className="w-4 h-4 text-mint-600" />
              <span>שיתוף מהיר מהמובייל לתוך המודולים:</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              כאשר שומרים את האפליקציה לנייד, ניתן לשתף כל מסמך מוואטסאפ, תמונה
              מהגלריה או הקלטה קולית ישירות ל{' '}
              <strong className="text-slate-700">כספת ניהול</strong>, לבחור לאיזה
              מודול זה יגיע (מסמכים, תמונות או הקלטות) ולתת כותרת עם תיעוד תאריך
              ושעה אוטומטי.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onTryMobileShare();
              }}
              className="btn-accent w-full min-h-11 py-2.5 px-4 rounded-2xl text-xs font-bold cursor-pointer"
            >
              פתח מסך שיתוף ובחירת מודול כעת
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
