import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Link,
} from '@react-email/components';

interface Props {
  name: string;
  plan: string;
}

export default function WelcomeEmail({ name, plan }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to TrainGPT — your AI coach is ready</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={brand}>TrainGPT</Text>
            <Text style={tagline}>Smarter triathlon training starts now.</Text>
          </Section>

          {/* Hero */}
          <Section style={section}>
            <Text style={hero}>👋 Welcome, {name}!</Text>
            <Text style={paragraph}>
              You just took the first step toward your strongest season yet.
            </Text>
            <Text style={paragraph}>
              TrainGPT creates fully personalized triathlon training plans — built by AI,
              grounded in coaching science, and tailored to your goals.
            </Text>
          </Section>

          {/* CTA */}
          <Section style={ctaBlock}>
            <Link href="https://www.traingpt.co/schedule" style={ctaLink}>
              📅 View Your Training Plan
            </Link>
            <Text style={note}>Your custom plan is ready to go.</Text>
          </Section>

          <Hr style={divider} />

          {/* Core Benefits */}
          <Section style={section}>
            <Text style={subheading}>What to Expect:</Text>
            <ul style={list}>
              <li><strong>🧠 Smart, Adaptive Plans</strong> — Structured week-by-week training, personalized to your race, goals, and availability.</li>
              <li><strong>📖 Real-Time Feedback</strong> — Check in with your AI coach anytime for advice, tweaks, or accountability.</li>
              <li><strong>📘 Strava Sync</strong> — See completed workouts, track consistency, and adjust your plan dynamically.</li>
            </ul>
          </Section>

          {/* Motivational + Support */}
          <Section style={section}>
            <Text style={paragraph}>
              Whether you're chasing a PR or just showing up stronger each week — your coach is with you, every step of the way.
            </Text>
            <Text style={paragraph}>
              Have questions? Just reply to this email — we’re here to help.
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              You’re receiving this email because you signed up for TrainGPT.<br />
              © 2025 TrainGPT. All rights reserved.<br />
              <Link href="https://www.traingpt.co/privacy">Privacy Policy</Link> • <Link href="#">Unsubscribe</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// === Styles ===

const main = {
  backgroundColor: '#f4f4f4',
  padding: '40px 0',
  fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  maxWidth: '600px',
  margin: '0 auto',
  padding: '40px 32px',
};

const header = {
  textAlign: 'center' as const,
  marginBottom: '24px',
};

const brand = {
  fontSize: '20px',
  fontWeight: 'bold' as const,
};

const tagline = {
  fontSize: '14px',
  color: '#666',
};

const section = {
  marginBottom: '24px',
};

const hero = {
  fontSize: '20px',
  fontWeight: 'bold' as const,
  marginBottom: '8px',
};

const paragraph = {
  fontSize: '15px',
  marginBottom: '16px',
};

const ctaBlock = {
  textAlign: 'center' as const,
  marginBottom: '32px',
};

const ctaLink = {
  display: 'inline-block',
  backgroundColor: '#111827',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontWeight: 'bold' as const,
  fontSize: '15px',
};

const note = {
  fontSize: '13px',
  color: '#666',
  marginTop: '8px',
};

const divider = {
  border: 'none',
  borderTop: '1px solid #eee',
  margin: '32px 0',
};

const subheading = {
  fontWeight: 'bold' as const,
  fontSize: '15px',
  marginBottom: '8px',
};

const list = {
  paddingLeft: '20px',
  fontSize: '14px',
  lineHeight: '1.6',
};

const footer = {
  textAlign: 'center' as const,
};

const footerText = {
  fontSize: '12px',
  color: '#888',
  lineHeight: '1.5',
};
