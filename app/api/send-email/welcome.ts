import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { generateWelcomeEmail } from '../../../lib/emails/generateWelcomeEmail';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { to, name, plan } = await req.json();

  if (!to || !plan) {
    return NextResponse.json({ error: 'Missing email or plan' }, { status: 400 });
  }

const html = await generateWelcomeEmail({ name, plan });

  try {
    const result = await resend.emails.send({
      from: 'TrainGPT <hello@traingpt.co>',
      to,
      subject: 'Welcome to TrainGPT — Your Training Starts Now 💪',
      html,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[❌ EMAIL SEND ERROR]', error);
    return NextResponse.json({ error: 'Failed to send welcome email' }, { status: 500 });
  }
}
