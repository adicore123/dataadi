import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#F4F8FB',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'כספת ניהול - מסמכים, תמונות והקלטות',
  description:
    'מערכת ניהול פשוטה בסגנון CRM להעלאה, שיתוף מהמובייל ותיעוד אוטומטי לפי תאריך ושעה של מסמכים חשובים, תמונות והקלטות קוליות.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'כספת ניהול',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'כספת ניהול - מסמכים, תמונות והקלטות',
    description:
      'מערכת ניהול פשוטה בסגנון CRM להעלאה, שיתוף מהמובייל ותיעוד אוטומטי לפי תאריך ושעה של מסמכים חשובים, תמונות והקלטות קוליות.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'כספת ניהול - מסמכים, תמונות והקלטות',
    description:
      'מערכת ניהול פשוטה בסגנון CRM להעלאה, שיתוף מהמובייל ותיעוד אוטומטי לפי תאריך ושעה של מסמכים חשובים, תמונות והקלטות קוליות.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body
        suppressHydrationWarning
        className="aurora-canvas min-h-screen text-slate-800 antialiased font-sans selection:bg-mint-500 selection:text-white"
      >
        {children}
      </body>
    </html>
  );
}
