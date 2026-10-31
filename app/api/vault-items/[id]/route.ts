import { NextRequest, NextResponse } from 'next/server';
import { getVaultItemsCollection } from '@/lib/mongo';
import { getSessionUser } from '@/lib/auth';
import { parseVaultItemUpdate, DOC_ID_RE } from '@/lib/vault-validation';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/vault-items/[id] — title/module/album/notes only. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });
  }
  const { id } = await context.params;
  if (!DOC_ID_RE.test(id)) {
    return NextResponse.json({ error: 'מזהה פריט לא תקין' }, { status: 400 });
  }
  try {
    const body = await request.json().catch(() => null);
    const parsed = parseVaultItemUpdate(body);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const itemsCol = await getVaultItemsCollection();
    const result = await itemsCol.updateOne(
      { _id: id, ownerId: user.email },
      { $set: { ...parsed, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'הפריט לא נמצא' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('vault-items PATCH error:', error);
    return NextResponse.json({ error: 'שגיאת שרת בעדכון הפריט' }, { status: 500 });
  }
}

/** DELETE /api/vault-items/[id] — idempotent, owner-scoped. */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });
  }
  const { id } = await context.params;
  if (!DOC_ID_RE.test(id)) {
    return NextResponse.json({ error: 'מזהה פריט לא תקין' }, { status: 400 });
  }
  try {
    const itemsCol = await getVaultItemsCollection();
    await itemsCol.deleteOne({ _id: id, ownerId: user.email });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('vault-items DELETE error:', error);
    return NextResponse.json({ error: 'שגיאת שרת במחיקת הפריט' }, { status: 500 });
  }
}
