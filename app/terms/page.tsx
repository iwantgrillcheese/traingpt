'use client';

import React from 'react';

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16 text-black">
      <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>

      <p className="mb-4">
        Welcome to TrainGPT. By using our website and services, you agree to the following terms.
        Please read them carefully.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">1. Use of Service</h2>
      <p className="mb-4">
        TrainGPT is provided for personal, non-commercial use only. You agree not to misuse the
        platform, attempt to reverse-engineer our systems, or use our services for any illegal or
        harmful purposes.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">2. Accounts</h2>
      <p className="mb-4">
        You must be 13 or older to use TrainGPT. By signing in with Google, you agree to provide
        accurate information. You are responsible for all activity that occurs under your account.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">3. AI-Generated Content</h2>
      <p className="mb-4">
        Our training plans and coaching responses are powered by AI. While we aim to provide
        high-quality guidance, TrainGPT does not guarantee performance outcomes or prevent injury.
        You should consult a medical professional before starting any new training program.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">4. Data Usage</h2>
      <p className="mb-4">
        We collect and process your data as described in our{' '}
        <a href="/privacy" className="underline">Privacy Policy</a>. By using TrainGPT, you consent to this processing.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">5. Termination</h2>
      <p className="mb-4">
        We reserve the right to suspend or terminate your account at any time for violations of
        these terms or misuse of the platform.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">6. Changes to These Terms</h2>
      <p className="mb-4">
        We may update these terms as the platform evolves. Changes will be posted on this page and
        take effect immediately unless otherwise noted.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">7. Contact</h2>
      <p className="mb-4">
        For questions about these terms, contact us at{' '}
        <a href="mailto:hello@traingpt.co" className="underline">hello@traingpt.co</a>.
      </p>

      <p className="text-sm text-gray-500 mt-12">Last updated: June 4, 2025</p>
    </main>
  );
}
