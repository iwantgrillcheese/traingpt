'use client';

import React from 'react';

export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16 text-black">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <p className="mb-4">
        At TrainGPT, we value your privacy. This Privacy Policy explains how we collect, use,
        and protect your information when you use our site and services.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">1. Information We Collect</h2>
      <ul className="list-disc ml-6 mb-4">
        <li>Email address and name (via Google Sign-In)</li>
        <li>Training preferences (race type, race date, training hours, experience level)</li>
        <li>Strava activity data (if connected)</li>
        <li>Plan notes and AI-generated messages</li>
        <li>Basic analytics (e.g. site usage, session duration)</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-2">2. How We Use Your Information</h2>
      <ul className="list-disc ml-6 mb-4">
        <li>To generate personalized training plans</li>
        <li>To provide AI-powered coaching and session feedback</li>
        <li>To sync your workouts with Strava (if enabled)</li>
        <li>To improve our product and user experience</li>
        <li>To send training-related emails (e.g. weekly summaries)</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-2">3. How We Protect Your Data</h2>
      <p className="mb-4">
        Your data is securely stored using Supabase (PostgreSQL + row-level security). We do not
        sell, rent, or share your data with third parties. Only the AI model you interact with
        (via OpenAI API) may receive relevant context to generate responses.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">4. Third-Party Services</h2>
      <ul className="list-disc ml-6 mb-4">
        <li><strong>Google:</strong> For authentication</li>
        <li><strong>Supabase:</strong> For database, storage, and authentication management</li>
        <li><strong>OpenAI:</strong> For generating training plans and coaching messages</li>
        <li><strong>Strava:</strong> For activity syncing (optional)</li>
        <li><strong>Resend:</strong> For email delivery (e.g. weekly summaries)</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-2">5. Your Rights & Choices</h2>
      <p className="mb-4">
        You can disconnect Strava, delete your account, or request data deletion at any time by
        contacting us at <a href="mailto:hello@traingpt.co" className="underline">hello@traingpt.co</a>.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">6. Cookies</h2>
      <p className="mb-4">
        We use cookies for basic session tracking and anonymous usage analytics. You can block
        cookies in your browser settings.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">7. Updates</h2>
      <p className="mb-4">
        We may update this policy as TrainGPT evolves. Major changes will be posted here and
        emailed if appropriate.
      </p>

      <p className="text-sm text-gray-500 mt-12">Last updated: June 4, 2025</p>
    </main>
  );
}
