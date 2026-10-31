import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side fallback for the PWA share target (POST /share-target).
 * In the installed PWA the service worker intercepts this POST and this
 * route is never reached. It only matters when the POST lands directly
 * on the server: text shares are forwarded via query params (page.tsx
 * picks them up), while file bytes cannot survive a redirect — we send
 * the user to the manual recovery flow (pick module + attach file).
 */
export async function POST(request: NextRequest) {
  const url = new URL('/', request.url);
  try {
    const formData = await request.formData();
    const title = String(formData.get('title') || '');
    const text = String(formData.get('text') || '');
    const sharedUrl = String(formData.get('url') || '');
    const file = formData.get('file');

    if (file instanceof File) {
      url.searchParams.set('shared', 'error');
      if (file.name) {
        url.searchParams.set('name', file.name);
      }
    } else if (title || text || sharedUrl) {
      if (title) {
        url.searchParams.set('title', title);
      }
      if (text || sharedUrl) {
        url.searchParams.set('text', [text, sharedUrl].filter(Boolean).join(' '));
      }
    } else {
      url.searchParams.set('shared', 'error');
    }
  } catch {
    url.searchParams.set('shared', 'error');
  }
  return NextResponse.redirect(url, 303);
}
