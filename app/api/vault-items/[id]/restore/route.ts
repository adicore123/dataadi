import { NextRequest } from 'next/server';
import { getVaultItemsCollection } from '@/lib/mongo';
import { DOC_ID_RE } from '@/lib/vault-validation';
import { requireUser, jsonError, jsonOk, serverError } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/vault-items/[id]/restore — take an item out of the recycle bin. */
export async function POST(_request: NextRequest, context: RouteContext) {
  const email = await requireUser();
  if (!email) return jsonError('נדרשת התחברות', 401);
  const { id } = await context.params;
  if (!DOC_ID_RE.test(id)) {
    return jsonError('מזהה פריט לא תקין', 400);
  }
  try {
    const itemsCol = await getVaultItemsCollection();
    await itemsCol.updateOne(
      { _id: id, ownerId: email },
      { $set: { deletedAt: null, updatedAt: new Date() } }
    );
    return jsonOk();
  } catch (error) {
    return serverError('vault-items restore', error);
  }
}
