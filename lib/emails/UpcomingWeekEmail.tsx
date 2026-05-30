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
  Swim: '#00c2a8',
  Bike: '#1668ff',
  Run: '#111111',
  Strength: '#8f98a3',
  Other: '#8f98a3',
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
          <Section style={styles.brandSection}>
            <Text style={styles.brand}>TrainGPT</Text>
          </Section>

          <Section style={styles.heroSection}>
            <Heading style={styles.heading}>Your week ahead.</Heading>
            <Text style={styles.dateText}>{weekRange}</Text>
          </Section>

          <Section style={styles.summarySection}>
            <div style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Sessions</Text>
              <Text style={styles.summaryValue}>{String(summary.sessionCount)}</Text>
            </div>
            <div style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Planned time</Text>
              <Text style={styles.summaryValue}>{summary.totalDuration ?? 'Set'}</Text>
            </div>
            <div style={styles.summaryRowLast}>
              <Text style={styles.summaryLabel}>Focus</Text>
              <Text style={styles.summaryValue}>{summary.sportSummary}</Text>
            </div>
          </Section>

          <Section style={styles.noteSection}>
            <Text style={styles.noteText}>
              Review your week before Monday. Protect the key endurance work, move sessions that conflict with real life, and open any workout for more detail when you need it.
            </Text>
          </Section>

          <Section style={styles.weekSection}>
            <Heading style={styles.sectionHeading}>Week at a glance</Heading>
            {Object.entries(groupedSessions).map(([day, sessions]) => (
              <div key={day} style={styles.dayRow}>
                <div style={styles.dayColumn}>
                  <Text style={styles.dayText}>{day}</Text>
                </div>
                <div style={styles.sessionColumn}>
                  {sessions.length ? (
                    sessions.map((session, index) => (
                      <div key={`${day}-${index}`} style={styles.sessionItem}>
                        <span
                          style={{
                            ...styles.sportDot,
                            backgroundColor: SPORT_COLORS[session.sport] ?? SPORT_COLORS.Other,
                          }}
                        />
                        <span style={styles.sessionTitle}>{session.title}</span>
                        {session.duration ? <span style={styles.durationText}>{session.duration}</span> : null}
                      </div>
                    ))
                  ) : (
                    <Text style={styles.restText}>No planned session</Text>
                  )}
                </div>
              </div>
            ))}
          </Section>

          <Section style={styles.ctaSection}>
            <Button href="https://traingpt.co/schedule" style={styles.button}>
              View schedule
            </Button>
          </Section>

          <Section style={styles.footerSection}>
            <div style={styles.footerColumns}>
              <div style={styles.footerLeft}>
                <Text style={styles.footerBrand}>TrainGPT</Text>
                <Text style={styles.footerLink}>Schedule</Text>
                <Text style={styles.footerLink}>Coaching</Text>
                <Text style={styles.footerLink}>Settings</Text>
              </div>
              <div style={styles.footerRight}>
                <Text style={styles.footerText}>
                  This email was sent because your TrainGPT account has planned training sessions in the coming week.
                </Text>
                <Text style={styles.footerText}>
                  <a href="https://traingpt.co/unsubscribe" style={styles.anchor}>Unsubscribe</a>
                  {' · '}
                  <a href="https://traingpt.co/settings" style={styles.anchor}>Email settings</a>
                </Text>
              </div>
            </div>
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
    padding: '42px 0 26px',
  },
  brand: {
    color: '#202124',
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    margin: 0,
  },
  heroSection: {
    padding: '0 0 34px',
  },
  heading: {
    color: '#202124',
    fontSize: 38,
    fontWeight: 500,
    letterSpacing: '-0.055em',
    lineHeight: '44px',
    margin: '0 0 20px',
  },
  dateText: {
    color: '#5f6368',
    fontSize: 16,
    lineHeight: '24px',
    margin: 0,
  },
  summarySection: {
    borderTop: '1px solid #dadce0',
    borderBottom: '1px solid #dadce0',
    padding: '8px 0',
  },
  summaryRow: {
    borderBottom: '1px solid #edf0f2',
    display: 'flex',
    padding: '16px 0',
  },
  summaryRowLast: {
    display: 'flex',
    padding: '16px 0',
  },
  summaryLabel: {
    color: '#5f6368',
    fontSize: 15,
    lineHeight: '22px',
    margin: 0,
    width: '42%',
  },
  summaryValue: {
    color: '#202124',
    flex: 1,
    fontSize: 15,
    fontWeight: 600,
    lineHeight: '22px',
    margin: 0,
    textAlign: 'right',
  },
  noteSection: {
    padding: '32px 0 26px',
  },
  noteText: {
    color: '#3c4043',
    fontSize: 16,
    lineHeight: '26px',
    margin: 0,
  },
  weekSection: {
    padding: '0 0 20px',
  },
  sectionHeading: {
    color: '#202124',
    fontSize: 26,
    fontWeight: 500,
    letterSpacing: '-0.045em',
    lineHeight: '32px',
    margin: '0 0 20px',
  },
  dayRow: {
    borderTop: '1px solid #edf0f2',
    display: 'flex',
    padding: '18px 0',
  },
  dayColumn: {
    width: 72,
  },
  dayText: {
    color: '#202124',
    fontSize: 15,
    fontWeight: 600,
    lineHeight: '22px',
    margin: 0,
  },
  sessionColumn: {
    flex: 1,
  },
  sessionItem: {
    alignItems: 'center',
    display: 'flex',
    marginBottom: 10,
  },
  sportDot: {
    borderRadius: 999,
    display: 'inline-block',
    height: 10,
    marginRight: 12,
    width: 10,
  },
  sessionTitle: {
    color: '#202124',
    flex: 1,
    fontSize: 15,
    lineHeight: '22px',
  },
  durationText: {
    color: '#5f6368',
    fontSize: 14,
    lineHeight: '22px',
    marginLeft: 14,
    whiteSpace: 'nowrap',
  },
  restText: {
    color: '#9aa0a6',
    fontSize: 15,
    lineHeight: '22px',
    margin: 0,
  },
  ctaSection: {
    borderTop: '1px solid #dadce0',
    padding: '30px 0 38px',
  },
  button: {
    backgroundColor: '#202124',
    borderRadius: 999,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 600,
    padding: '13px 22px',
    textDecoration: 'none',
  },
  footerSection: {
    borderTop: '1px solid #dadce0',
    padding: '30px 0 46px',
  },
  footerColumns: {
    display: 'flex',
    gap: 48,
  },
  footerLeft: {
    width: 160,
  },
  footerRight: {
    flex: 1,
  },
  footerBrand: {
    color: '#202124',
    fontSize: 18,
    fontWeight: 700,
    margin: '0 0 18px',
  },
  footerLink: {
    borderBottom: '1px solid #dadce0',
    color: '#3c4043',
    fontSize: 15,
    lineHeight: '22px',
    margin: 0,
    padding: '8px 0',
  },
  footerText: {
    color: '#5f6368',
    fontSize: 12,
    lineHeight: '18px',
    margin: '0 0 14px',
  },
  anchor: {
    color: '#1967d2',
    textDecoration: 'none',
  },
};
