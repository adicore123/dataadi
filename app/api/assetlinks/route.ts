import { NextResponse } from 'next/server';

// Digital Asset Links: lets Android verify this site owns the TWA APK
// (app.dataadi.vault), removing the URL bar and enabling Web Share Target.
// Keep the SHA-256 fingerprint in sync with the APK signing certificate
// (see D:\android-apk\KEYSTORE-INFO.txt).
// Exposed at /.well-known/assetlinks.json via a rewrite in next.config.ts.
export function GET() {
  const body = JSON.stringify([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'app.dataadi.vault',
        sha256_cert_fingerprints: [
          'b15f519e6b6e8a632419fb4fa0dda465c507e19982573ec3a17e18902e10c82e',
        ],
      },
    },
  ]);
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
