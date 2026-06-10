// /lib/emails/send-daily-session-email.ts
import { Resend } from 'resend';
import { render } from '@react-email/components';
import { DailySessionEmail, type DailyEmailSession } from './DailySessionEmail';

export async function sendDailySessionEmail({
  email,
  dayLabel,
  sessions,
}: {
  email: string;
  dayLabel: string;
  sessions: DailyEmailSession[];
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const resend = new Resend(apiKey);
  const html = await render(DailySessionEmail({ dayLabel, sessions }));

  // The subject IS the workout — the email earns its open before it's opened.
  const first = sessions[0];
  const subject =
    sessions.length === 1
      ? `Today: ${first.title}${first.duration ? ` · ${first.duration}` : ''}`
      : `Today: ${sessions.map((session) => session.title).join(' + ')}`;

  await resend.emails.send({
    from: 'TrainGPT <hello@traingpt.co>',
    to: email,
    subject,
    html,
  });
}
