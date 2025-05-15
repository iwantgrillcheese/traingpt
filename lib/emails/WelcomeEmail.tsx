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
      <Preview>Welcome to TrainGPT — your training starts now</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={heading}>Welcome to TrainGPT 🎉</Text>
            <Text style={subheading}>Your AI coach is ready to train.</Text>
          </Section>

          <Section style={content}>
            <Text style={paragraph}>
              Whether you're chasing a PR or just showing up stronger each week — your coach is with you, every step of the way.
            </Text>
            <Text style={paragraph}>
              Have questions? Just reply to this email — we’re here to help.
            </Text>
            <Hr style={divider} />
            <Text style={footer}>
              Welcome to smarter training. Let's get to work.
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

const heading = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  marginBottom: '4px',
};

const subheading = {
  fontSize: '16px',
  color: '#666',
};

const content = {
  fontSize: '15px',
  lineHeight: '1.6',
};

const paragraph = {
  marginBottom: '20px',
};

const divider = {
  border: 'none',
  borderTop: '1px solid #eee',
  margin: '32px 0',
};

const footer = {
  fontWeight: 'bold' as const,
  fontSize: '15px',
  marginBottom: '12px',
};

const signature = {
  fontSize: '14px',
  color: '#777',
};
