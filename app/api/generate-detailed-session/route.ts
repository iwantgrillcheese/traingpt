import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import OpenAI from 'openai';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { title, date } = await req.json();
    if (!title || !date) {
      return NextResponse.json({ error: 'Missing session title or date.' }, { status: 400 });
    }

    // Auth + Supabase profile lookup
    const supabase = createServerComponentClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('swim_pace, bike_ftp, run_pace')
      .eq('id', user.id)
      .single();

    const swimPace = profile?.swim_pace || 'Not provided';
    const bikeFTP = profile?.bike_ftp || 'Not provided';
    const runPace = profile?.run_pace || 'Not provided';

    const prompt = `
You are a world-class triathlon coach.

Write a detailed, structured workout for the following session:
"${title}" on ${date}

Use the following athlete metrics if relevant:
- Swim threshold pace: ${swimPace}
- Bike FTP: ${bikeFTP}
- Run threshold pace: ${runPace}

The session should include:
- Warmup
- Main set(s)
- Cooldown
- Specific distances, intensities (pace/power/Z2–Z4), or drills
- Technique/form guidance if appropriate

Use clear formatting — short paragraphs or bullet points. Avoid fluff or vague instructions. Make it feel like something a top-tier coach would write.
    `;

    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const content = gptResponse.choices[0].message?.content;

    return NextResponse.json({ response: content });
  } catch (error) {
    console.error('Detailed session error:', error);
    return NextResponse.json({ error: 'Failed to generate workout.' }, { status: 500 });
  }
}
