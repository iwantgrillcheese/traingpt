// /lib/emails/DailySessionEmail.tsx
//
// The daily trigger: one email per morning a session exists.
// Subject IS the workout (set by the sender); this template carries the
// full prescription so the athlete can train without opening the app —
// while the CTA still deep-links to /schedule.

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { CSSProperties } from 'react';

export type DailyEmailSession = {
  sport: string; // already title-cased: Swim | Bike | Run | Strength | Other
  title: string;
  duration: string | null; // pre-formatted, e.g. "1h 30m"
  detailLines: string[]; // Purpose / Workout / Intensity / Coach note lines
};

const SPORT_COLORS: Record<string, string> = {
  Swim: '#00c2a8',
  Bike: '#1668ff',
  Run: '#111111',
  Strength: '#8f98a3',
  Other: '#8f98a3',
};

export function DailySessionEmail({
  dayLabel,
  sessions,
}: {
  dayLabel: string; // e.g. "Tuesday, Jun 16"
  sessions: DailyEmailSession[];
}) {
  const previewText =
    sessions.length === 1
      ? `${sessions[0].title}${sessions[0].duration ? ` · ${sessions[0].duration}` : ''}`
      : `${sessions.length} sessions today`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.brandSection}>
            <Text style={styles.brand}>TrainGPT</Text>
          </Section>

          <Section style={styles.heroSection}>
            <Heading style={styles.heading}>Today&apos;s training.</Heading>
            <Text style={styles.dateText}>{dayLabel}</Text>
          </Section>

          {sessions.map((session, index) => (
            <Section key={index} style={styles.sessionSection}>
              <div style={styles.sessionHeader}>
                <span
                  style={{
                    ...styles.sportDot,
                    backgroundColor: SPORT_COLORS[session.sport] ?? SPORT_COLORS.Other,
                  }}
                />
                <Text style={styles.sessionTitle}>
                  {session.title}
                  {session.duration ? ` · ${session.duration}` : ''}
                </Text>
              </div>
              {session.detailLines.map((line, lineIndex) => (
                <Text key={lineIndex} style={styles.detailLine}>
                  {line}
                </Text>
              ))}
            </Section>
          ))}

          <Section style={styles.ctaSection}>
            <Button href="https://traingpt.co/schedule" style={styles.button}>
              Open today&apos;s session
            </Button>
          </Section>

          <Section style={styles.footerSection}>
            <Text style={styles.footerText}>
              You&apos;re getting this because you turned on daily session emails for your TrainGPT plan.
            </Text>
            <Text style={styles.footerText}>
              <a href="https://traingpt.co/unsubscribe" style={styles.anchor}>
                Unsubscribe
              </a>
              {' · '}
              <a href="https://traingpt.co/settings" style={styles.anchor}>
                Email settings
              </a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles: Record<string, CSSProperties> = {
  body: {
    backgroundColor: '#ffffff',
    color: '#202124',
    fontFamily: 'Arial, Helvetica, sans-serif',
    margin: 0,
    padding: 0,
  },
  container: {
    backgroundColor: '#ffffff',
    maxWidth: 640,
    margin: '0 auto',
    padding: '0 28px',
  },
  brandSection: {
    padding: '42px 0 22px',
  },
  brand: {
    color: '#202124',
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    margin: 0,
  },
  heroSection: {
    padding: '0 0 26px',
  },
  heading: {
    color: '#111111',
    fontSize: 34,
    fontWeight: 700,
    letterSpacing: '-0.04em',
    lineHeight: '38px',
    margin: 0,
  },
  dateText: {
    color: '#8f98a3',
    fontSize: 15,
    margin: '10px 0 0',
  },
  sessionSection: {
    border: '1px solid #e8eaed',
    borderRadius: 16,
    margin: '0 0 14px',
    padding: '18px 20px',
  },
  sessionHeader: {
    alignItems: 'center',
    display: 'flex',
    gap: 10,
  },
  sportDot: {
    borderRadius: '50%',
    display: 'inline-block',
    height: 10,
    marginRight: 10,
    width: 10,
  },
  sessionTitle: {
    color: '#111111',
    display: 'inline',
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    margin: 0,
  },
  detailLine: {
    color: '#3c4043',
    fontSize: 14,
    lineHeight: '21px',
    margin: '10px 0 0',
  },
  ctaSection: {
    padding: '12px 0 34px',
  },
  button: {
    backgroundColor: '#111111',
    borderRadius: 12,
    color: '#ffffff',
    display: 'inline-block',
    fontSize: 15,
    fontWeight: 600,
    padding: '13px 22px',
    textDecoration: 'none',
  },
  footerSection: {
    borderTop: '1px solid #e8eaed',
    padding: '22px 0 44px',
  },
  footerText: {
    color: '#8f98a3',
    fontSize: 12,
    lineHeight: '18px',
    margin: '0 0 8px',
  },
  anchor: {
    color: '#8f98a3',
    textDecoration: 'underline',
  },
};
