import { NextResponse } from 'next/server';
import {
  AuthError,
  assertSameUser,
  createRouteSupabaseClient,
  requireUser,
} from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type UpdateSessionPayload = {
  sessionId?: string;
  newDate?: string;
  clientUserId?: string | null;
};

export async function POST(req: Request) {
  try {
    const supabase = await createRouteSupabaseClient();
    const user = await requireUser(supabase);

    const payload = (await req.json()) as UpdateSessionPayload;

    assertSameUser({
      authenticatedUserId: user.id,
      requestedUserId: payload.clientUserId,
      routeName: 'schedule/update-session',
    });

    const sessionId = payload.sessionId?.trim();
    const newDate = payload.newDate?.trim();

    if (!sessionId || !newDate) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId and newDate are required.' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('sessions')
      .update({ date: newDate })
      .eq('id', sessionId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[schedule/update-session] update failed:', error);

      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[schedule/update-session] failed:', error);

    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update session.' },
      { status: 500 }
    );
  }
}