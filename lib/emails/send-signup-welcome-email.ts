// /lib/emails/send-signup-welcome-email.ts
import { Resend } from 'resend';
import { render } from '@react-email/components';
import { SignupWelcomeEmail } from './SignupWelcomeEmail';

export async function sendSignupWelcomeEmail({ email }: { email: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const resend = new Resend(apiKey);
  const html = await render(SignupWelcomeEmail({}));

  await resend.emails.send({
    from: 'TrainGPT <hello@traingpt.co>',
    to: email,
    subject: 'Your coach is ready — three moves to start',
    html,
  });
}
