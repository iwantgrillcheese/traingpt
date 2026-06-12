// /lib/emails/SignupWelcomeEmail.tsx
// Sent once, on first authenticated load after signup. Three moves, one CTA.

export function SignupWelcomeEmail() {
  const card: React.CSSProperties = {
    border: '1px solid #E3E0D8',
    borderRadius: 14,
    padding: '14px 16px',
    marginTop: 10,
  };
  const label: React.CSSProperties = {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
    color: '#101114',
  };
  const body: React.CSSProperties = {
    margin: '4px 0 0',
    fontSize: 14,
    lineHeight: '21px',
    color: '#6B7280',
  };

  return (
    <div style={{ background: '#F7F6F2', padding: '32px 16px', fontFamily: 'Helvetica, Arial, sans-serif' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', background: '#ffffff', borderRadius: 20, border: '1px solid #E3E0D8', padding: '28px 28px 24px' }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#2563FF' }}>
          Welcome
        </p>
        <h1 style={{ margin: '12px 0 0', fontSize: 26, lineHeight: '30px', letterSpacing: '-0.03em', color: '#101114' }}>
          Your coach is ready.
        </h1>
        <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: '23px', color: '#4B5563' }}>
          TrainGPT builds your plan in seconds, sends you each morning&apos;s workout by
          email, and rewrites next week every Sunday based on what you actually did.
          Three moves to get the full loop running:
        </p>

        <div style={card}>
          <p style={label}>1 · Connect Strava</p>
          <p style={body}>Completed work syncs automatically — it&apos;s how the coach knows what really happened.</p>
        </div>
        <div style={card}>
          <p style={label}>2 · Build your plan</p>
          <p style={body}>Race, date, weekly hours. The full plan renders instantly.</p>
        </div>
        <div style={card}>
          <p style={label}>3 · Train</p>
          <p style={body}>Each morning you have a session, the workout lands in your inbox. Every Sunday, the plan adapts.</p>
        </div>

        <a
          href="https://www.traingpt.co/plan"
          style={{ display: 'inline-block', marginTop: 18, background: '#101114', color: '#ffffff', borderRadius: 999, padding: '11px 22px', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}
        >
          Build my plan
        </a>
      </div>
      <p style={{ maxWidth: 560, margin: '14px auto 0', fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
        TrainGPT · adaptive endurance coaching
      </p>
    </div>
  );
}
