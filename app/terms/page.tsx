import React from 'react';

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-black">
      <h1 className="mb-6 text-3xl font-bold">Terms of Service</h1>
      <p className="mb-4">Welcome to Brick. By using the website and services, you agree to these terms.</p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">1. Use of Service</h2>
      <p className="mb-4">Brick is provided for personal training use. You agree not to misuse the platform, interfere with the service, or use it for illegal or harmful purposes.</p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">2. Accounts</h2>
      <p className="mb-4">You must be 13 or older to use Brick. You are responsible for activity under your account and for keeping access to that account secure.</p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">3. Training Guidance</h2>
      <p className="mb-4">Brick uses software and model-generated content to create and adapt training guidance. Training carries risk, and Brick does not guarantee race performance, fitness outcomes, or freedom from injury. Use judgment, stop training when appropriate, and seek qualified medical care for health concerns.</p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">4. Data Usage</h2>
      <p className="mb-4">We collect and process data as described in the <a href="/privacy" className="underline">Privacy Policy</a>. Optional integrations such as Strava are used only when connected by the athlete.</p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">5. Service Changes</h2>
      <p className="mb-4">Brick is an actively developed product. Features, availability, integrations, and pricing may change. Material changes will be communicated where appropriate.</p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">6. Termination</h2>
      <p className="mb-4">We may suspend or terminate accounts for misuse of the service or violations of these terms.</p>

      <h2 className="mb-2 mt-8 text-xl font-semibold">7. Contact</h2>
      <p className="mb-4">Questions can be sent to <a href="mailto:hello@traingpt.co" className="underline">hello@traingpt.co</a>.</p>

      <p className="mt-12 text-sm text-zinc-500">Last updated: September 8, 2026</p>
    </main>
  );
}
