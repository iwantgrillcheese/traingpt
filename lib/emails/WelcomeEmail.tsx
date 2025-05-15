import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Hr,
} from '@react-email/components';

type Props = {
  name?: string;
  plan?: string;
};

export default function WelcomeEmail({ name, plan }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to TrainGPT — your training starts now</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={heading}>Welcome to TrainGPT 🎉</Text>
            <Text style={subheading}>Your AI coach is ready to train.</Text>
          </Section>

          <Section style={content}>
            <Text style={paragraph}>
              You're in. Whether you're training for your first race or chasing a PR, TrainGPT is here to guide you with a personalized triathlon plan, expert-level insights, and on-demand support.
            </Text>
            <Text style={paragraph}>
              You can view your schedule anytime and check in with your coach whenever you need help, context, or motivation.
            </Text>
            <Hr style={divider} />
            <Text style={footer}>
              Welcome to smarter training. Let's get to work.
            </Text>
            <Text style={signature}>– The TrainGPT Team</Text>
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
  margin: '24px 0',
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
