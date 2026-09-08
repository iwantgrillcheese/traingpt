import type { Metadata } from 'next';
import FreePlanLanding from '@/app/components/FreePlanLanding';

export const metadata: Metadata = {
  title: 'Free Ironman 70.3 Training Plan | Brick',
  description: 'Preview and build a free 70.3 triathlon training plan around your weekly hours, long ride day, race date, and training history.',
};

export default function Free703PlanPage() {
  return (
    <FreePlanLanding
      eyebrow="Free 70.3 training plan"
      title="Your 70.3 build should fit your life, not fight it."
      description="Preview a 70.3 week built around your available hours and preferred long-ride day. The full saved plan adds your current zones, race date, Strava training, and weekly adaptation."
      raceType="Half Ironman (70.3)"
      bullets={[
        'Long ride and run placed around your real weekend',
        'Race-specific brick work without stacking missed sessions',
        'Free plan, no credit card required',
      ]}
    />
  );
}
