// lib/emails/UpcomingWeekEmail.tsx
import * as React from 'react';

export function UpcomingWeekEmail({
  weekRange,
  coachNote,
  sessions,
}: {
  weekRange: string;
  coachNote: string;
  sessions: { day: string; emoji: string; title: string; duration: number }[];
}) {
  return (
    <div style={{ fontFamily: 'sans-serif', padding: 20, maxWidth: 600 }}>
      <h2>📅 Your Week of Training: {weekRange}</h2>
      <p><strong>Coach's Note:</strong> {coachNote}</p>
      <ul>
        {sessions.map((s, i) => (
          <li key={i}>
            <strong>{s.day}</strong>: {s.emoji} {s.title} ({s.duration} min)
          </li>
        ))}
      </ul>
      <a
        href="https://www.traingpt.ai/schedule"
        style={{
          marginTop: 20,
          display: 'inline-block',
          background: '#000',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: 6,
          textDecoration: 'none',
        }}
      >
        View Your Plan
      </a>
    </div>
  );
}
