// lib/emails/send-upcoming-week-email.ts
import 'server-only';
import { Resend } from 'resend';
import { createUnsubscribeUrl } from './unsubscribe';
import { generateUpcomingWeekEmail } from './generateUpcomingWeekEmail';

export async function sendUpcomingWeekEmail({
  email,
  userId,
  sessions,
  coachNote,
  weekRange,
}: {
  email: string;
  userId: string;
  sessions: any[];
  coachNote: string;
  weekRange: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const resend = new Resend(apiKey);
  const html = await generateUpcomingWeekEmail({ sessions, weekRange, coachNote, unsubscribeUrl: createUnsubscribeUrl(userId, 'weekly') });

  const { error } = await resend.emails.send({
    from: 'TrainGPT <hello@traingpt.co>',
    to: email,
    subject: `Weekly brief — ${weekRange}`,
    html,
  });
  if (error) throw new Error(error.message);
}
