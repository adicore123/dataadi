import { NextRequest, NextResponse } from 'next/server';
import { getPhotoAlbumsCollection } from '@/lib/mongo';
import { getSessionUser } from '@/lib/auth';
import { DOC_ID_RE } from '@/lib/vault-validation';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** DELETE /api/photo-albums/[id] — idempotent, owner-scoped. */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });
  }
  const { id } = await context.params;
  if (!DOC_ID_RE.test(id)) {
    return NextResponse.json({ error: 'מזהה אלבום לא תקין' }, { status: 400 });
  }
  try {
    const albumsCol = await getPhotoAlbumsCollection();
    await albumsCol.deleteOne({ _id: id, ownerId: user.email });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('photo-albums DELETE error:', error);
    return NextResponse.json({ error: 'שגיאת שרת במחיקת האלבום' }, { status: 500 });
  }
}
