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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
    >
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-teal-600" />
            <h2 id="pwa-modal-title" className="text-base font-bold text-slate-900">
              שמירה כאפליקציית Web למובייל ושיתוף מהיר
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירת חלון אפליקציית מובייל"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* App Icon Preview on Phone Home Screen */}
          <div className="p-5 rounded-2xl bg-slate-900 text-white flex items-center gap-4">
            <img
              src="/pwa-512x512.png"
              alt="אייקון מעוצב של כספת ניהול"
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-2xl shadow-md border border-slate-700 shrink-0"
            />
            <div className="space-y-1">
              <div className="text-sm font-bold text-white">כספת ניהול</div>
              <p className="text-xs text-slate-300 leading-relaxed">
                האייקון המעוצב מופיע אוטומטית על מסך הבית בטלפון (אייפון או אנדרואיד) ונפתח במסך מלא בדיוק כמו אפליקציה טבעית.
              </p>
            </div>
          </div>

          {isInstallable && !isInstalled && (
            <button
              type="button"
              onClick={onInstall}
              className="w-full py-3 px-4 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>התקן כעת כאפליקציה במכשיר</span>
            </button>
          )}

          {isInstalled && (
            <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-xs font-semibold text-teal-800 flex items-center gap-2">
              <Check className="w-4 h-4 text-teal-600 shrink-0" />
              <span>האפליקציה כבר מותקנת ופועלת במצב Web App עצמאי!</span>
            </div>
          )}

          {/* Instructions for iOS & Android */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
              <h3 className="text-xs font-bold text-slate-900">
                באייפון (Safari - iOS):
              </h3>
              <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside">
                <li>לחץ על כפתור ה-<strong>שיתוף (Share)</strong> בתחתית הדפדפן.</li>
                <li>גלול ובחר <strong>&quot;הוסף למסך הבית&quot; (Add to Home Screen)</strong>.</li>
                <li>האייקון המעוצב יופיע מיד בין האפליקציות שלך.</li>
              </ol>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
              <h3 className="text-xs font-bold text-slate-900">
                באנדרואיד (Chrome):
              </h3>
              <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside">
                <li>לחץ על תפריט שלוש הנקודות בראש הדפדפן.</li>
                <li>בחר <strong>&quot;התקן אפליקציה&quot;</strong> או <strong>&quot;הוסף למסך הבית&quot;</strong>.</li>
                <li>לאחר ההתקנה, האפליקציה תופיע גם בתפריט השיתוף של הטלפון!</li>
              </ol>
            </div>
          </div>

          {/* Mobile Share Explanation */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Share2 className="w-4 h-4 text-teal-600" />
              <span>שיתוף מהיר מהמובייל לתוך המודולים:</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              כאשר שומרים את האפליקציה לנייד, ניתן לשתף כל מסמך מוואטסאפ, תמונה מהגלריה או הקלטה קולית ישירות ל<strong>כספת ניהול</strong>, לבחור לאיזה מודול זה יגיע (מסמכים, תמונות או הקלטות) ולתת כותרת עם תיעוד תאריך ושעה אוטומטי.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onTryMobileShare();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              פתח מסך שיתוף ובחירת מודול כעת
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
