import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest & {
  share_target?: {
    action: string;
    method: string;
    enctype: string;
    params: {
      title: string;
      text: string;
      url: string;
      files: Array<{
        name: string;
        accept: string[];
      }>;
    };
  };
} {
  return {
    id: '/',
    name: 'כספת ניהול - מסמכים, תמונות והקלטות',
    short_name: 'כספת ניהול',
    description:
      'מערכת ניהול פשוטה בסגנון CRM להעלאה, שיתוף מהמובייל ותיעוד אוטומטי לפי תאריך ושעה של מסמכים חשובים, תמונות והקלטות קוליות.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    dir: 'rtl',
    lang: 'he',
    background_color: '#F8FAFC',
    theme_color: '#F4F8FB',
    icons: [
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
    share_target: {
      action: '/share-target',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
        files: [
          {
            name: 'file',
            accept: [
              'image/*',
              'audio/*',
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'text/*',
              '*/*',
            ],
          },
        ],
      },
    },
  };
}
