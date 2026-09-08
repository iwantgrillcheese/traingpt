import FreePlanLanding from '@/app/components/FreePlanLanding';

export const metadata = {
  title: 'Free Ironman Training Plan',
  description: 'Preview and build a free Ironman training plan around your weekly availability, long-session day, race date, and training history.',
};

export default function FreeIronmanPlanPage() {
  return (
    <FreePlanLanding
      eyebrow="Free Ironman training plan"
      title="Build the Ironman volume you can actually absorb."
      description="A full-distance build needs progression, recovery, fueling practice, and long-session discipline. Preview how Brick structures the week before you create an account."
      raceType="Ironman (140.6)"
      bullets={[
        'Long-course volume scaled to available weekly hours',
        'Recovery protected around the biggest sessions',
        'Saved plans adapt from completed Strava training',
      ]}
    />
  );
}
