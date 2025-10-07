// /app/api/schedule/create-session/route.ts
import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  const supabase = createServerComponentClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date, sport, title, duration, details } = await req.json()

  const { data, error } = await supabase
    .from('sessions')
    .insert([{
      user_id: user.id,
      date,
      sport,
      title,
      duration: Number(duration) || null,
      details: details || null
    }])
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ session: data[0] })
}
