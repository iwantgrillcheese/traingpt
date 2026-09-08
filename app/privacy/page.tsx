import React from 'react';

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-black">
      <h1 className="mb-6 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-4">At Brick, we value your privacy. This policy explains how we collect, use, and protect information when you use the product.</p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">1. Information We Collect</h2>
      <ul className="mb-4 ml-6 list-disc">
        <li>Email address and name through Google sign-in</li>
        <li>Training preferences, race details, training zones, and schedule constraints</li>
        <li>Strava activity data when you choose to connect Strava</li>
        <li>Workout notes and completion data you add to Brick</li>
        <li>Basic product analytics such as page and feature usage</li>
      </ul>

      <h2 className="mb-2 mt-8 text-xl font-semibold">2. How We Use Your Information</h2>
      <ul className="mb-4 ml-6 list-disc">
        <li>To generate and adapt personalized training plans</li>
        <li>To match completed workouts to your schedule</li>
        <li>To calculate training progress and readiness</li>
        <li>To improve product reliability and user experience</li>
        <li>To send training-related or product emails when enabled</li>
      </ul>

      <h2 className="mb-2 mt-8 text-xl font-semibold">3. How We Protect Your Data</h2>
      <p className="mb-4">Training data is stored using Supabase and its access controls. We do not sell your personal data. Relevant training context may be sent to model providers when needed to generate or enrich a training plan.</p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">4. Third-Party Services</h2>
      <ul className="mb-4 ml-6 list-disc">
        <li><strong>Google:</strong> authentication</li>
        <li><strong>Supabase:</strong> database, storage, and authentication infrastructure</li>
        <li><strong>OpenAI:</strong> plan generation or session-detail enrichment where used</li>
        <li><strong>Strava:</strong> optional activity syncing</li>
        <li><strong>Resend:</strong> email delivery</li>
        <li><strong>Vercel / PostHog:</strong> hosting, reliability, and product analytics where enabled</li>
      </ul>

      <h2 className="mb-2 mt-8 text-xl font-semibold">5. Your Rights & Choices</h2>
      <p className="mb-4">You can disconnect Strava, change email preferences, delete your account, or request data deletion. Contact <a href="mailto:hello@traingpt.co" className="underline">hello@traingpt.co</a> if you need help.</p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">6. Cookies</h2>
      <p className="mb-4">We use cookies and local browser storage for authentication, product preferences, and analytics. Browser controls can limit cookies, though some product functionality may require them.</p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">7. Updates</h2>
      <p className="mb-4">We may update this policy as Brick evolves. Material changes will be reflected on this page.</p>

      <p className="mt-12 text-sm text-zinc-500">Last updated: September 8, 2026</p>
    </main>
  );
}
