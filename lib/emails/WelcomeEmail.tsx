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
      <Preview>Welcome to TrainGPT — your AI coach is ready to go</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>TrainGPT</Text>
            <Text style={tagline}>Smarter triathlon training starts now.</Text>
          </Section>

          <Section style={hero}>
            <Text style={headline}>👋 Welcome, {name}!</Text>
            <Text style={paragraph}>
              You just took the first step toward your strongest season yet.
            </Text>
            <Text style={paragraph}>
              TrainGPT creates fully personalized triathlon plans — built by AI, grounded in coaching science, and tailored to your goals.
            </Text>
            <Link href="https://www.traingpt.co/schedule" style={cta}>
              📆 View Your Training Plan
            </Link>
            <Text style={subtext}>Your custom plan is ready to go.</Text>
          </Section>

          <Hr style={divider} />

          <Section>
            <Text style={subheading}>What’s Next?</Text>
            <ul style={list}>
              <li>
                <strong>📅 Check Your Schedule</strong> — Your week-by-week plan is live and tailored to your goals.
              </li>
              <li>
                <strong>🔁 Sync with Strava</strong> — Automatically track your workouts and stay consistent.
              </li>
              <li>
                <strong>💬 Talk to Your Coach</strong> — Ask your AI coach for advice, tweaks, or motivation anytime.
              </li>
            </ul>
          </Section>

          <Section>
            <Text style={paragraph}>
              Whether you're chasing a PR or just showing up stronger each week — your coach is with you, every step of the way.
            </Text>
            <Text style={paragraph}>
              Have questions? Just reply to this email — we’re here to help.
            </Text>
          </Section>

          <Hr style={divider} />

          <Section style={footer}>
            <Text style={footerText}>
              You’re receiving this email because you signed up for TrainGPT.<br />
              © 2025 TrainGPT. All rights reserved. <br />
              <Link href="https://www.traingpt.co/privacy">Privacy Policy</Link> • <Link href="#">Unsubscribe</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

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

const logo = {
  fontSize: '20px',
  fontWeight: 'bold' as const,
};

const tagline = {
  fontSize: '14px',
  color: '#555',
};

const hero = {
  marginBottom: '32px',
};

const headline = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  marginBottom: '8px',
};

const paragraph = {
  fontSize: '15px',
  lineHeight: '1.6',
  marginBottom: '20px',
};

const subheading = {
  fontSize: '16px',
  fontWeight: 'bold' as const,
  marginBottom: '12px',
};

const list = {
  paddingLeft: '20px',
  fontSize: '15px',
  lineHeight: '1.6',
  marginBottom: '24px',
};

const cta = {
  display: 'inline-block',
  backgroundColor: '#111827',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '12px 20px',
  borderRadius: '6px',
  fontWeight: 'bold' as const,
  fontSize: '14px',
  marginTop: '12px',
};

const subtext = {
  fontSize: '13px',
  color: '#777',
  marginTop: '8px',
};

const divider = {
  border: 'none',
  borderTop: '1px solid #eee',
  margin: '32px 0',
};

const footer = {
  textAlign: 'center' as const,
  fontSize: '12px',
  color: '#999',
};

const footerText = {
  lineHeight: '1.6',
};
