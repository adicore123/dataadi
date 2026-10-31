import { NextRequest } from 'next/server';
import { getFoldersCollection } from '@/lib/mongo';
import { parseFolderRename, DOC_ID_RE } from '@/lib/vault-validation';
import { requireUser, jsonError, jsonOk, serverError, parseJsonBody } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/folders/[id] — rename a folder. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const email = await requireUser();
  if (!email) return jsonError('נדרשת התחברות', 401);
  const { id } = await context.params;
  if (!DOC_ID_RE.test(id)) {
    return jsonError('מזהה תיקייה לא תקין', 400);
  }
  try {
    const parsed = parseFolderRename(await parseJsonBody(request));
    if ('error' in parsed) {
      return jsonError(parsed.error, 400);
    }
    const foldersCol = await getFoldersCollection();
    const result = await foldersCol.updateOne(
      { _id: id, ownerId: email },
      { $set: { name: parsed.name, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) {
      return jsonError('התיקייה לא נמצאה', 404);
    }
    return jsonOk();
  } catch (error) {
    return serverError('folders PATCH', error);
  }
}

/** DELETE /api/folders/[id] — idempotent, owner-scoped. */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const email = await requireUser();
  if (!email) return jsonError('נדרשת התחברות', 401);
  const { id } = await context.params;
  if (!DOC_ID_RE.test(id)) {
    return jsonError('מזהה תיקייה לא תקין', 400);
  }
  try {
    const foldersCol = await getFoldersCollection();
    await foldersCol.deleteOne({ _id: id, ownerId: email });
    return jsonOk();
  } catch (error) {
    return serverError('folders DELETE', error);
  }
}
