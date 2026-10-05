// /lib/emails/send-daily-session-email.ts
import 'server-only';
import { Resend } from 'resend';
import { createUnsubscribeUrl } from './unsubscribe';
import { render } from '@react-email/components';
import { DailySessionEmail, type DailyEmailSession } from './DailySessionEmail';

export async function sendDailySessionEmail({
  email,
  userId,
  dayLabel,
  sessions,
}: {
  email: string;
  userId: string;
  dayLabel: string;
  sessions: DailyEmailSession[];
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const resend = new Resend(apiKey);
  const html = await render(DailySessionEmail({ dayLabel, sessions, unsubscribeUrl: createUnsubscribeUrl(userId, 'daily') }));

  // The subject IS the workout — the email earns its open before it's opened.
  const first = sessions[0];
  const subject =
    sessions.length === 1
      ? `Today: ${first.title}${first.duration ? ` · ${first.duration}` : ''}`
      : `Today: ${sessions.map((session) => session.title).join(' + ')}`;

  const { error } = await resend.emails.send({
    from: 'TrainGPT <hello@traingpt.co>',
    to: email,
    subject,
    html,
  });
  if (error) throw new Error(error.message);
}
