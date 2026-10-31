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

// GET is the Android TWA share path (the APK's baked share_target uses GET —
// the reliable route; POST file delivery depends on Chrome internals).
// Text shares arrive with title/text/url params; file shares arrive with no
// usable params (GET cannot carry file bytes) and fall into the recovery
// flow where the user attaches the file manually.
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const title = requestUrl.searchParams.get('title') || '';
  const text = requestUrl.searchParams.get('text') || '';
  const sharedUrl = requestUrl.searchParams.get('url') || '';
  const url = new URL('/', request.url);

  if (title || text || sharedUrl) {
    if (title) url.searchParams.set('title', title);
    if (text || sharedUrl) {
      url.searchParams.set('text', [text, sharedUrl].filter(Boolean).join(' '));
    }
  } else {
    url.searchParams.set('shared', 'error');
  }
  return NextResponse.redirect(url, 303);
}
