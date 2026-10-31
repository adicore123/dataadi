# כספת ניהול (dataadi-vault)

PWA לניהול מסמכים, תמונות והקלטות — "כספת" אישית עם סנכרון ענן.

**Production:** https://dataadi.vercel.app · **Repo:** `land` branch — כל push מופרס אוטומטית ל-Vercel.

## מבנה

```
app/            Next.js 15 App Router — page.tsx (האפליקציה), API routes
components/     קומפוננטות UI (מודאלים, רשימות) + components/ui (רכיבי בסיס משותפים)
hooks/          use-pwa-install, use-incoming-share
lib/            vault-logic (מודל + לוגיקה), vault-storage (IndexedDB + סנכרון ענן),
                vault-validation (ולידציה בצד השרת), mongo, auth, share, api-helpers
public/sw.js    Service Worker — Web Share Target (קליטת שיתוף מוואטסאפ/המערכת)
```

## ארכיטקטורה בקצרה

- **Local-first:** הפריטים נשמרים מיד ב-IndexedDB (+localStorage fallback) ורק אז מסונכרנים לענן. בלי התחברות — האפליקציה עובדת מקומית.
- **ענן:** MongoDB Atlas דרך API routes של האפליקציה (`/api/vault-items`, `/api/photo-albums`, `/api/auth/*`). אימייל+סיסמה, JWT ב-httpOnly cookie.
- **שיתוף פנימה:** ה-PWA רשום כ-Share Target במערכת — שיתוף קובץ מוואטסאפ נקלט על ידי ה-Service Worker ל-IndexedDB ונפתח במודל "לאן להכניס את הקובץ?".
- **שיתוף החוצה:** Web Share API עם הקובץ עצמו (`lib/share.ts`), fallback ל-wa.me.

## פיתוח

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # בדיקות יחידה (node:test) ל-lib
npx tsc --noEmit   # בדיקת טיפוסים
npm run build      # build לייצור
```

משתני סביבה (ראו `.env.example`): `MONGODB_URI`, `AUTH_SECRET`.
