'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, LogIn, CloudUpload, Loader2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a successful login/register with the signed-in email. */
  onSuccess: (email: string) => void;
}

type Mode = 'login' | 'register';

/**
 * Email + password sign-in modal (replaces the Firebase Google popup).
 * Talks to /api/auth/login and /api/auth/register — the session is an
 * httpOnly cookie set by the server.
 */
export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setPassword('');
      setBusy(false);
    }
  }, [isOpen]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);

    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('כתובת אימייל לא תקינה');
      return;
    }
    if (password.length < (mode === 'register' ? 8 : 1)) {
      setError('הסיסמה חייבת להכיל לפחות 8 תווים');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        email?: string;
        error?: string;
      };
      if (!res.ok || !data.email) {
        setError(data.error || 'ההתחברות נכשלה — נסה/י שוב');
        return;
      }
      onSuccess(data.email);
    } catch {
      setError('שגיאת רשת — בדוק/י את החיבור לאינטרנט');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={mode === 'login' ? 'התחברות לגיבוי בענן' : 'הרשמה לגיבוי בענן'}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="relative z-10 w-full max-w-md glass-strong rounded-3xl p-6 sm:p-8 shadow-[0_32px_80px_-24px_rgb(15_23_42/0.4)]"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="סגירה"
              className="absolute top-4 left-4 w-10 h-10 flex items-center justify-center rounded-2xl text-slate-400 hover:text-slate-900 hover:bg-slate-900/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-mint-400/15 text-mint-600">
                <CloudUpload className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-slate-900">
                {mode === 'login' ? 'פתיחת הכספת שלך' : 'יצירת מפתח לכספת'}
              </h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              {mode === 'login'
                ? 'זה המפתח הפרטי שלך לכספת — פעם אחת במכשיר וזהו, לא נשאל שוב.'
                : 'מפתח אחד מספיק — כל המכשירים ישתמשו בו, וכל הקבצים יישמרו במסד שלך.'}
            </p>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              לא שירות ענן חיצוני: הנתונים נשמרים ישירות במסד ה-Mongo שלך. המפתח רק מונע
              מזרים לפתוח את הכספת שלך מהאינטרנט.
            </p>

            {/* Mode tabs */}
            <div className="flex gap-1 p-1 rounded-2xl bg-slate-900/[0.05] mb-5" role="tablist">
              {(
                [
                  { id: 'login', label: 'התחברות' },
                  { id: 'register', label: 'הרשמה' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={mode === tab.id}
                  onClick={() => switchMode(tab.id)}
                  className={`flex-1 min-h-10 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                    mode === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  אימייל
                </label>
                <input
                  id="auth-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-12 px-4 rounded-2xl glass text-base text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-mint-500/60 focus:bg-white transition-colors text-left"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  סיסמה {mode === 'register' && <span className="text-slate-400">(8 תווים לפחות)</span>}
                </label>
                <input
                  id="auth-password"
                  type="password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 px-4 rounded-2xl glass text-base text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-mint-500/60 focus:bg-white transition-colors text-left"
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="btn-accent w-full h-12 flex items-center justify-center gap-2 rounded-2xl text-base font-bold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <LogIn className="w-5 h-5 stroke-[2.5]" />
                )}
                <span>{mode === 'login' ? 'התחברות' : 'יצירת חשבון'}</span>
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-slate-400">
              החשבון נשמר במסד הנתונים של הכספת — בלי Google, בלי פיירבייס.
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
