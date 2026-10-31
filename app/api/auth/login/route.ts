import { NextRequest, NextResponse } from 'next/server';
import { getUsersCollection } from '@/lib/mongo';
import {
  verifyPassword,
  normalizeEmail,
  setSessionCookie,
  createSessionToken,
  isConfigError,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

const GENERIC_ERROR = { error: 'אימייל או סיסמה שגויים' };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = normalizeEmail(body?.email);
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json(GENERIC_ERROR, { status: 401 });
    }

    const users = await getUsersCollection();
    const user = await users.findOne({ email });
    // Always run a compare so timing doesn't reveal whether the account exists.
    const hash = user?.passwordHash;
    let ok = false;
    try {
      ok = await verifyPassword(password, String(hash ?? ''));
    } catch {
      ok = false;
    }
    if (!user || !ok) {
      return NextResponse.json(GENERIC_ERROR, { status: 401 });
    }

    await setSessionCookie(await createSessionToken(email));
    return NextResponse.json({ email });
  } catch (error) {
    console.error('login error:', error);
    return NextResponse.json(
      {
        error: isConfigError(error)
          ? 'שגיאת תצורה בשרת (AUTH_SECRET) — פנה למנהל'
          : 'שגיאת שרת בהתחברות',
      },
      { status: 500 }
    );
  }
}
