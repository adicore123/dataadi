import { NextRequest, NextResponse } from 'next/server';
import { getPhotoAlbumsCollection } from '@/lib/mongo';
import { getSessionUser } from '@/lib/auth';
import { parseAlbumCreate } from '@/lib/vault-validation';

export const dynamic = 'force-dynamic';

/** GET /api/photo-albums — every album owned by the signed-in user. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });
  }
  try {
    const albumsCol = await getPhotoAlbumsCollection();
    const docs = await albumsCol
      .find({ ownerId: user.email })
      .sort({ createdAtIso: -1 })
      .toArray();
    const albums = docs.map((doc) => ({
      id: doc._id,
      name: doc.name,
      createdAtIso: doc.createdAtIso,
    }));
    return NextResponse.json(albums);
  } catch (error) {
    console.error('photo-albums GET error:', error);
    return NextResponse.json({ error: 'שגיאת שרת בטעינת האלבומים' }, { status: 500 });
  }
}

/** POST /api/photo-albums — create/upsert an album (server sets ownerId). */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => null);
    const parsed = parseAlbumCreate(body);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const now = new Date();
    const albumsCol = await getPhotoAlbumsCollection();
    await albumsCol.replaceOne(
      { _id: parsed.id, ownerId: user.email },
      { ...parsed.doc, ownerId: user.email, createdAt: now, updatedAt: now },
      { upsert: true }
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('photo-albums POST error:', error);
    return NextResponse.json({ error: 'שגיאת שרת בשמירת האלבום' }, { status: 500 });
  }
}
