// lib/emails/UpcomingWeekEmail.tsx
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Heading,
  Button,
} from '@react-email/components';
import type { CSSProperties } from 'react';

export function UpcomingWeekEmail({
  weekRange,
  groupedSessions,
}: {
  weekRange: string;
  groupedSessions: Record<string, string[]>;
}) {
  return (
    <Html>
      <Head />
      <Preview>Your training week: {weekRange}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>
            Your Week of Training: {weekRange}
          </Heading>

          <Section style={styles.table}>
            {Object.entries(groupedSessions).map(([day, sessions]) => (
              <div key={day} style={styles.row}>
                <div style={styles.day}>{day}</div>
                <div style={styles.sessions}>
                  {Array.from(new Set(sessions)).map((session, i) => (
  <div key={i}>{session}</div>
))}
                </div>
              </div>
            ))}


          <Text style={styles.footerNote}>
            🧠 Want more detail on your swim or run this week? Ask your AI coach in your dashboard for a detailed workout.
          </Text>

          </Section>

          <div style={{ textAlign: 'center' as const, marginTop: '32px' }}>
            <Button href="https://traingpt.co/schedule" style={styles.button}>
              View Your Plan
            </Button>
          </div>

          <Text style={styles.footerNote}>
            ❌ Not training anymore? <a href="https://traingpt.co/unsubscribe">Unsubscribe here</a>.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const styles: Record<string, CSSProperties> = {
  body: {
    backgroundColor: '#f6f9fc',
    fontFamily: 'Helvetica, Arial, sans-serif',
    color: '#111827',
    padding: '40px 0',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    maxWidth: 600,
    margin: '0 auto',
    padding: '24px',
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)',
  },
  heading: {
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#111827',
  },
  coachNote: {
    fontSize: '15px',
    marginBottom: '24px',
    lineHeight: '1.6',
  },
  table: {
    fontSize: '14px',
    borderTop: '1px solid #e5e7eb',
    borderBottom: '1px solid #e5e7eb',
    padding: '8px 0',
  },
  row: {
    display: 'flex',
    padding: '12px 0',
    borderBottom: '1px solid #f0f0f0',
  },
  day: {
    width: '60px',
    fontWeight: '600',
    color: '#374151',
  },
  sessions: {
    flex: 1,
    color: '#111827',
  },
  button: {
    display: 'inline-block',
    backgroundColor: '#111827',
    color: '#ffffff',
    fontSize: '14px',
    padding: '12px 20px',
    borderRadius: '6px',
    textDecoration: 'none',
  },
  footerNote: {
    fontSize: '12px',
    color: '#6b7280',
    textAlign: 'center' as const,
    marginTop: '24px',
    lineHeight: '1.6',
  },
};
