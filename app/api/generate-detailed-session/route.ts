import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import OpenAI from 'openai';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { parseISO, format } from 'date-fns';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { title, date } = await req.json();
    if (!title || !date) {
      return NextResponse.json({ error: 'Missing session title or date.' }, { status: 400 });
    }

    const supabase = createServerComponentClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get performance metrics
    const { data: profile } = await supabase
      .from('profiles')
      .select('swim_pace, bike_ftp, run_pace')
      .eq('id', user.id)
      .single();

    const swimPace = profile?.swim_pace || 'Not provided';
    const bikeFTP = profile?.bike_ftp || 'Not provided';
    const runPace = profile?.run_pace || 'Not provided';

    // Determine sport
    const lowerTitle = title.toLowerCase();
    const sport =
      lowerTitle.includes('swim') ? 'swim' :
      lowerTitle.includes('bike') ? 'bike' :
      lowerTitle.includes('run') ? 'run' :
      'general';

    // Build prompt
    const prompt = `
You are a world-class triathlon coach.

Write a short, structured workout for this session:
"${title}" on ${format(parseISO(date), 'EEEE, MMMM do')}

Athlete performance metrics (if relevant):
- Swim threshold pace: ${swimPace}
- Bike FTP: ${bikeFTP}
- Run threshold pace: ${runPace}

The workout should include:
- Warm-up
- Main Set(s)
- Cooldown

Format the response like this:

**[Workout Name]**
- Warm-up: ...
- Main Set: ...
- Cooldown: ...

Use bullet points or short lines. No fluff. No motivational text. Keep it practical and realistic for a triathlete following the title's intent. Only include distances, durations, intensities (pace/power/RPE), or drills that align with the session type.
`;

    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const content = gptResponse.choices[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json({ error: 'No content generated.' }, { status: 500 });
    }

    // Load latest plan
    const { data: planData, error: fetchErr } = await supabase
      .from('plans')
      .select('id, detailed_sessions')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr || !planData) {
      console.error('❌ Error fetching plan:', fetchErr);
      return NextResponse.json({ error: 'Could not fetch user plan' }, { status: 500 });
    }

    const updated = {
      ...(planData.detailed_sessions || {}),
      [date]: {
        ...(planData.detailed_sessions?.[date] || {}),
        [sport]: content,
      },
    };

    const { error: updateErr } = await supabase
      .from('plans')
      .update({ detailed_sessions: updated })
      .eq('id', planData.id);

    if (updateErr) {
      console.error('❌ Error saving detailed session:', updateErr);
      return NextResponse.json({ error: 'Failed to save workout' }, { status: 500 });
    }

    return NextResponse.json({ details: content });
  } catch (error) {
    console.error('Detailed session error:', error);
    return NextResponse.json({ error: 'Failed to generate workout.' }, { status: 500 });
  }
}
