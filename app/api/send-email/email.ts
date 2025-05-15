// /app/api/send-email/email.ts

import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { to, subject, html } = await req.json();

  if (!to || !subject || !html) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    const result = await resend.emails.send({
      from: 'TrainGPT <onboarding@resend.dev>', // update to your verified sender if needed
      to,
      subject,
      html,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[❌ Email Send Error]', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
