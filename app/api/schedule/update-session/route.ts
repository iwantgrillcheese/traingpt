// /app/api/schedule/update-session/route.ts
import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  const supabase = createServerComponentClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId, newDate, clientUserId } = await req.json()

  if (typeof clientUserId === 'string' && clientUserId && clientUserId !== user.id) {
    console.error('[schedule/update-session] auth mismatch', {
      cookieUserId: user.id,
      clientUserId,
    })
    return NextResponse.json({ error: 'Authentication session mismatch. Please sign in again.' }, { status: 401 })
  }

  const { error } = await supabase
    .from('sessions')
    .update({ date: newDate })
    .eq('id', sessionId)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
