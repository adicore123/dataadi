import { NextRequest, NextResponse } from 'next/server';
import { getUsersCollection } from '@/lib/mongo';
import {
  hashPassword,
  isValidEmail,
  normalizeEmail,
  setSessionCookie,
  createSessionToken,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = normalizeEmail(body?.email);
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'כתובת אימייל לא תקינה' },
        { status: 400 }
      );
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים` },
        { status: 400 }
      );
    }

    const users = await getUsersCollection();
    const existing = await users.findOne({ email });
    if (existing) {
      return NextResponse.json(
        { error: 'כבר קיים חשבון עם האימייל הזה — נסה/י להתחבר' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    try {
      await users.insertOne({
        email,
        passwordHash,
        createdAt: new Date(),
      });
    } catch (err) {
      // Unique-index race on double submit — treat as already registered.
      if (err instanceof Error && (err as { code?: number }).code === 11000) {
        return NextResponse.json(
          { error: 'כבר קיים חשבון עם האימייל הזה — נסה/י להתחבר' },
          { status: 409 }
        );
      }
      throw err;
    }

    await setSessionCookie(await createSessionToken(email));
    return NextResponse.json({ email });
  } catch (error) {
    console.error('register error:', error);
    return NextResponse.json(
      { error: 'שגיאת שרת ביצירת החשבון' },
      { status: 500 }
    );
  }
}
