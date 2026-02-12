// lib/emails/send-upcoming-week-email.ts
import { Resend } from 'resend';
import { generateUpcomingWeekEmail } from './generateUpcomingWeekEmail';

export async function sendUpcomingWeekEmail({
  email,
  sessions,
  coachNote,
  weekRange,
}: {
  email: string;
  sessions: any[];
  coachNote: string;
  weekRange: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const resend = new Resend(apiKey);
  const html = await generateUpcomingWeekEmail({ sessions, weekRange });

  await resend.emails.send({
    from: 'TrainGPT <hello@traingpt.co>',
    to: email,
    subject: `Your Upcoming Week — ${weekRange}`,
    html,
  });
}
