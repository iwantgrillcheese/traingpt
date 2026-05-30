// lib/emails/UpcomingWeekEmail.tsx
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

type GroupedSession = {
  title: string;
  sport: string;
  duration: string | null;
};

type WeeklySummary = {
  sessionCount: number;
  totalDuration: string | null;
  sportSummary: string;
};

const SPORT_COLORS: Record<string, string> = {
  Swim: '#2563eb',
  Bike: '#7c3aed',
  Run: '#059669',
  Strength: '#92400e',
  Other: '#64748b',
};

export function UpcomingWeekEmail({
  weekRange,
  groupedSessions,
  summary,
}: {
  weekRange: string;
  groupedSessions: Record<string, GroupedSession[]>;
  summary: WeeklySummary;
}) {
  const previewText = `${summary.sessionCount} sessions planned for ${weekRange}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.hero}>
            <Text style={styles.eyebrow}>TrainGPT weekly briefing</Text>
            <Heading style={styles.heading}>Your training week is ready</Heading>
            <Text style={styles.subheading}>{weekRange}</Text>
          </Section>

          <Section style={styles.summaryCard}>
            <div style={styles.summaryGrid}>
              <div style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Sessions</Text>
                <Text style={styles.summaryValue}>{String(summary.sessionCount)}</Text>
              </div>
              <div style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Planned time</Text>
                <Text style={styles.summaryValue}>{summary.totalDuration ?? 'Set'}</Text>
              </div>
              <div style={styles.summaryItemWide}>
                <Text style={styles.summaryLabel}>Focus</Text>
                <Text style={styles.summaryText}>{summary.sportSummary}</Text>
              </div>
            </div>
          </Section>

          <Section style={styles.coachCard}>
            <Text style={styles.coachTitle}>Coach note</Text>
            <Text style={styles.coachText}>
              Look over the week before Monday, move anything that conflicts with real life, and keep the key endurance sessions protected. Open your schedule if you want a detailed version of any workout.
            </Text>
          </Section>

          <Section style={styles.planCard}>
            <Text style={styles.sectionTitle}>Week at a glance</Text>
            {Object.entries(groupedSessions).map(([day, sessions]) => (
              <div key={day} style={styles.dayRow}>
                <div style={styles.dayColumn}>
                  <Text style={styles.day}>{day}</Text>
                </div>
                <div style={styles.sessionColumn}>
                  {sessions.length ? (
                    sessions.map((session, index) => (
                      <div key={`${day}-${index}`} style={styles.sessionPill}>
                        <span
                          style={{
                            ...styles.sportDot,
                            backgroundColor: SPORT_COLORS[session.sport] ?? SPORT_COLORS.Other,
                          }}
                        />
                        <span style={styles.sessionTitle}>{session.title}</span>
                        {session.duration ? <span style={styles.duration}>{session.duration}</span> : null}
                      </div>
                    ))
                  ) : (
                    <Text style={styles.restText}>No planned session</Text>
                  )}
                </div>
              </div>
            ))}
          </Section>

          <Section style={styles.ctaWrap}>
            <Button href="https://traingpt.co/schedule" style={styles.button}>
              Open my schedule
            </Button>
            <Text style={styles.ctaSubtext}>Your AI coach can explain, adjust, or expand any session.</Text>
          </Section>

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              You’re receiving this because weekly training reminders are enabled for your TrainGPT account.
            </Text>
            <Text style={styles.footerText}>
              <a href="https://traingpt.co/unsubscribe" style={styles.footerLink}>Unsubscribe</a>
              {' · '}
              <a href="https://traingpt.co/settings" style={styles.footerLink}>Email settings</a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles: Record<string, CSSProperties> = {
  body: {
    backgroundColor: '#f4f1eb',
    color: '#111827',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: '32px 0',
  },
  container: {
    backgroundColor: '#fbfaf7',
    border: '1px solid #e7e1d7',
    borderRadius: 20,
    maxWidth: 640,
    margin: '0 auto',
    overflow: 'hidden',
  },
  hero: {
    backgroundColor: '#111827',
    padding: '34px 32px 30px',
  },
  eyebrow: {
    color: '#c8d5c2',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.12em',
    margin: '0 0 12px',
    textTransform: 'uppercase',
  },
  heading: {
    color: '#ffffff',
    fontSize: 30,
    lineHeight: '36px',
    fontWeight: 700,
    letterSpacing: '-0.03em',
    margin: '0 0 8px',
  },
  subheading: {
    color: '#d1d5db',
    fontSize: 15,
    lineHeight: '22px',
    margin: 0,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #ece7df',
    padding: '22px 28px',
  },
  summaryGrid: {
    display: 'flex',
    gap: 12,
  },
  summaryItem: {
    backgroundColor: '#f7f4ee',
    border: '1px solid #ebe5da',
    borderRadius: 14,
    padding: '14px 14px 12px',
    width: '28%',
  },
  summaryItemWide: {
    backgroundColor: '#f7f4ee',
    border: '1px solid #ebe5da',
    borderRadius: 14,
    padding: '14px 14px 12px',
    flex: 1,
  },
  summaryLabel: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    margin: '0 0 6px',
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: '#111827',
    fontSize: 22,
    fontWeight: 700,
    margin: 0,
  },
  summaryText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: 600,
    lineHeight: '20px',
    margin: 0,
  },
  coachCard: {
    padding: '24px 32px 4px',
  },
  coachTitle: {
    color: '#111827',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.08em',
    margin: '0 0 8px',
    textTransform: 'uppercase',
  },
  coachText: {
    color: '#374151',
    fontSize: 15,
    lineHeight: '24px',
    margin: 0,
  },
  planCard: {
    padding: '20px 28px 8px',
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    margin: '0 0 14px',
  },
  dayRow: {
    display: 'flex',
    borderTop: '1px solid #ebe5da',
    padding: '14px 0',
  },
  dayColumn: {
    width: 54,
    paddingTop: 3,
  },
  day: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: 700,
    margin: 0,
  },
  sessionColumn: {
    flex: 1,
  },
  sessionPill: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    border: '1px solid #e8e2d8',
    borderRadius: 999,
    display: 'flex',
    marginBottom: 8,
    padding: '9px 12px',
  },
  sportDot: {
    borderRadius: 999,
    display: 'inline-block',
    height: 8,
    marginRight: 9,
    width: 8,
  },
  sessionTitle: {
    color: '#111827',
    flex: 1,
    fontSize: 14,
    fontWeight: 600,
    lineHeight: '18px',
  },
  duration: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: 600,
    marginLeft: 10,
    whiteSpace: 'nowrap',
  },
  restText: {
    color: '#9ca3af',
    fontSize: 13,
    margin: '5px 0 0',
  },
  ctaWrap: {
    padding: '24px 32px 30px',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#111827',
    borderRadius: 999,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 700,
    padding: '13px 22px',
    textDecoration: 'none',
  },
  ctaSubtext: {
    color: '#6b7280',
    fontSize: 13,
    lineHeight: '20px',
    margin: '14px 0 0',
  },
  footer: {
    backgroundColor: '#f1ede5',
    borderTop: '1px solid #e4ddd1',
    padding: '18px 32px 24px',
    textAlign: 'center',
  },
  footerText: {
    color: '#6b7280',
    fontSize: 12,
    lineHeight: '18px',
    margin: '0 0 8px',
  },
  footerLink: {
    color: '#374151',
    textDecoration: 'underline',
  },
};
