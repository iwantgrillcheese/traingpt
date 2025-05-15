// lib/send-welcome-email.ts
export async function sendWelcomeEmail({
  to,
  name,
  plan,
}: {
  to: string;
  name: string;
  plan: string;
}) {
  try {
    await fetch('/api/send-email/welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, name, plan }),
    });
  } catch (err) {
    console.error('[❌ Failed to send welcome email]', err);
  }
}
