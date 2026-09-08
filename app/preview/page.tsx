import FreePlanLanding from '@/app/components/FreePlanLanding';

export const metadata = {
  title: 'Free Triathlon Training Plan Preview',
  description: 'Preview a personalized triathlon training week before creating an account. Adjust race distance, date, weekly hours, and long-session day.',
};

export default function PreviewPage() {
  return (
    <FreePlanLanding
      eyebrow="Free plan preview"
      title="See your triathlon week before you sign up."
      description="Give Brick four inputs and preview a realistic training week. Create an account only when you want the full race build, Strava matching, and weekly adaptation."
      raceType="Half Ironman (70.3)"
      bullets={[
        'Sprint through Ironman',
        'No account required for the preview',
        'Full plan uses your schedule and training data',
      ]}
    />
  );
}
