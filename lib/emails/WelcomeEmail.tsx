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
      <Preview>Your training plan is ready.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>TrainGPT</Text>
            <Text style={tagline}>Your training plan is ready.</Text>
          </Section>

          <Section style={hero}>
            <Text style={headline}>Welcome, {name}.</Text>
            <Text style={paragraph}>
              Your training plan has been added to your account.
            </Text>
            <Text style={paragraph}>
              TrainGPT helps you review your schedule, track completed sessions, and stay consistent through the week.
            </Text>
            <Link href="https://www.traingpt.co/schedule" style={cta}>
              View Your Training Plan
            </Link>
            <Text style={subtext}>{plan}</Text>
          </Section>

          <Hr style={divider} />

          <Section>
            <Text style={subheading}>Start here</Text>
            <ul style={list}>
              <li>
                <strong>Check your schedule</strong> — Review your first week and note anything that needs to move.
              </li>
              <li>
                <strong>Protect the key sessions</strong> — Prioritize the longest and most specific workouts.
              </li>
              <li>
                <strong>Connect Strava</strong> — Automatically track completed workouts when you are ready.
              </li>
            </ul>
          </Section>

          <Section>
            <Text style={paragraph}>
              Have questions? Reply to this email and we will help.
            </Text>
          </Section>

          <Hr style={divider} />

          <Section style={footer}>
            <Text style={footerText}>
              You are receiving this email because your TrainGPT plan is ready.<br />
              © 2025 TrainGPT. All rights reserved. <br />
              <Link href="https://www.traingpt.co/privacy">Privacy Policy</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#ffffff',
  padding: '40px 0',
  fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  maxWidth: '680px',
  margin: '0 auto',
  padding: '40px 32px',
};

const header = {
  borderBottom: '1px solid #e8e8e8',
  marginBottom: '40px',
  paddingBottom: '24px',
};

const logo = {
  color: '#111111',
  fontSize: '16px',
  fontWeight: 'bold' as const,
  letterSpacing: '-0.03em',
};

const tagline = {
  fontSize: '13px',
  color: '#737373',
};

const hero = {
  marginBottom: '32px',
};

const headline = {
  color: '#111111',
  fontSize: '42px',
  fontWeight: 600 as const,
  letterSpacing: '-0.06em',
  lineHeight: '46px',
  marginBottom: '20px',
};

const paragraph = {
  color: '#404040',
  fontSize: '16px',
  lineHeight: '1.65',
  marginBottom: '18px',
};

const subheading = {
  color: '#111111',
  fontSize: '12px',
  fontWeight: 'bold' as const,
  letterSpacing: '0.11em',
  marginBottom: '16px',
  textTransform: 'uppercase' as const,
};

const list = {
  paddingLeft: '20px',
  fontSize: '15px',
  lineHeight: '1.7',
  marginBottom: '24px',
};

const cta = {
  display: 'inline-block',
  backgroundColor: '#111111',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '14px 24px',
  borderRadius: '999px',
  fontWeight: 'bold' as const,
  fontSize: '15px',
  marginTop: '12px',
};

const subtext = {
  fontSize: '13px',
  color: '#737373',
  marginTop: '12px',
};

const divider = {
  border: 'none',
  borderTop: '1px solid #e8e8e8',
  margin: '32px 0',
};

const footer = {
  textAlign: 'center' as const,
  fontSize: '12px',
  color: '#8a8a8a',
};

const footerText = {
  lineHeight: '1.6',
};
