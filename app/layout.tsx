import './globals.css';
import Providers from './providers';
import { Analytics } from '@vercel/analytics/react';
import SessionCompleteCelebration from './components/SessionCompleteCelebration';
import FunnelTelemetry from './components/FunnelTelemetry';

export const metadata = {
  title: {
    default: 'Brick | Running and Triathlon Training',
    template: '%s | Brick',
  },
  description: 'Personalized training for runners and triathletes. Build a plan for your race, connect Strava, and track your training in one place.',
  applicationName: 'Brick',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#101114" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Brick" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="font-sans">
        <Providers>
          <FunnelTelemetry />
          {children}
        </Providers>
        <SessionCompleteCelebration />
        <Analytics />
      </body>
    </html>
  );
}
