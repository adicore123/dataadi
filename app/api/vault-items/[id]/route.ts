import { NextRequest } from 'next/server';
import { getVaultItemsCollection } from '@/lib/mongo';
import { parseVaultItemUpdate, DOC_ID_RE } from '@/lib/vault-validation';
import { requireUser, jsonError, jsonOk, serverError, parseJsonBody } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/vault-items/[id] — title/module/album/notes only. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const email = await requireUser();
  if (!email) return jsonError('נדרשת התחברות', 401);
  const { id } = await context.params;
  if (!DOC_ID_RE.test(id)) {
    return jsonError('מזהה פריט לא תקין', 400);
  }
  try {
    const parsed = parseVaultItemUpdate(await parseJsonBody(request));
    if ('error' in parsed) {
      return jsonError(parsed.error, 400);
    }
    const itemsCol = await getVaultItemsCollection();
    const result = await itemsCol.updateOne(
      { _id: id, ownerId: email },
      { $set: { ...parsed, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) {
      return jsonError('הפריט לא נמצא', 404);
    }
    return jsonOk();
  } catch (error) {
    return serverError('vault-items PATCH', error);
  }
}

/** DELETE /api/vault-items/[id] — idempotent, owner-scoped. */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const email = await requireUser();
  if (!email) return jsonError('נדרשת התחברות', 401);
  const { id } = await context.params;
  if (!DOC_ID_RE.test(id)) {
    return jsonError('מזהה פריט לא תקין', 400);
  }
  try {
    const itemsCol = await getVaultItemsCollection();
    await itemsCol.deleteOne({ _id: id, ownerId: email });
    return jsonOk();
  } catch (error) {
    return serverError('vault-items DELETE', error);
  }
}
