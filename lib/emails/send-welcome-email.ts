// lib/emails/send-welcome-email.ts
export async function sendWelcomeEmail({
  to,
  name,
  plan,
}: {
  to: string;
  name: string;
  plan: string;
}) {
  const baseUrl =
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : 'https://www.traingpt.co';

  try {
    await fetch(`${baseUrl}/api/send-email/welcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, name, plan }),
    });
  } catch (err) {
    console.error('❌ Failed to send welcome email (non-blocking)', err);
  }
}
