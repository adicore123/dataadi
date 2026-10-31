import { NextRequest } from 'next/server';
import { getPhotoAlbumsCollection } from '@/lib/mongo';
import { DOC_ID_RE } from '@/lib/vault-validation';
import { requireUser, jsonError, jsonOk, serverError } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** DELETE /api/photo-albums/[id] — idempotent, owner-scoped. */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const email = await requireUser();
  if (!email) return jsonError('נדרשת התחברות', 401);
  const { id } = await context.params;
  if (!DOC_ID_RE.test(id)) {
    return jsonError('מזהה אלבום לא תקין', 400);
  }
  try {
    const albumsCol = await getPhotoAlbumsCollection();
    await albumsCol.deleteOne({ _id: id, ownerId: email });
    return jsonOk();
  } catch (error) {
    return serverError('photo-albums DELETE', error);
  }
}
