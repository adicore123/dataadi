import { NextRequest, NextResponse } from 'next/server';

// Server-side fallback for the PWA share target (POST /share-target).
// In the browser PWA the service worker intercepts this POST and this route
// is never reached. On the Android TWA APK the custom tab may deliver the
// POST straight to the server instead: text shares are forwarded via query
// params (handled by page.tsx), while file bytes cannot survive a redirect —
// we send the user to a manual recovery flow (pick module + attach file).
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
        url.searchParams.set(
          'text',
          [text, sharedUrl].filter(Boolean).join(' ')
        );
      }
    } else {
      url.searchParams.set('shared', 'error');
    }
  } catch {
    url.searchParams.set('shared', 'error');
  }
  return NextResponse.redirect(url, 303);
}

// A stray GET (e.g. an app linking to the action URL) goes to the recovery
// flow instead of a bare 404.
export async function GET(request: NextRequest) {
  const url = new URL('/', request.url);
  url.searchParams.set('shared', 'error');
  return NextResponse.redirect(url, 303);
}
