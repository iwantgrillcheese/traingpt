import FreePlanLanding from '@/app/components/FreePlanLanding';

export const metadata = {
  title: 'Free Triathlon Training Plan',
  description: 'Build a free triathlon training plan around your race, weekly availability, and training history. Preview a week before signing up.',
};

export default function FreeTriathlonPlanPage() {
  return (
    <FreePlanLanding
      eyebrow="Free triathlon training plan"
      title="A free triathlon plan built around the week you can actually train."
      description="Static plans assume life goes perfectly. Brick builds around your available hours and long-session days, then the saved plan can use Strava to keep future weeks aligned with what you actually complete."
      raceType="Olympic"
      bullets={[
        'Choose Sprint, Olympic, 70.3, or Ironman',
        'See the training logic before you create an account',
        'Connect Strava only when you want automatic matching and adaptation',
      ]}
    />
  );
}
