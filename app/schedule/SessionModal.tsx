'use client';

import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Session } from '@/types/session';

type Props = {
  session: Session | null;
  open: boolean;
  onClose: () => void;
};

export default function SessionModal({ session, open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(session?.details || null);

  const supabase = createClientComponentClient();

  const handleGenerate = async () => {
    if (!session) return;
    setLoading(true);

    const res = await fetch('/api/generate-detailed-session', {
      method: 'POST',
      body: JSON.stringify({
        title: session.title,
        date: session.date,
        sport: session.sport,
      }),
    });

    const { output: generated } = await res.json();
    setOutput(generated);

    await supabase.from('sessions').update({ details: generated }).eq('id', session.id);
    setLoading(false);
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/20" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white w-full max-w-md rounded-lg shadow-xl p-6 space-y-4">
          <Dialog.Title className="text-lg font-semibold text-gray-900">
            {session?.title ?? 'Untitled Session'}
          </Dialog.Title>

          {output ? (
            <pre className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap border">
              {output}
            </pre>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="text-sm bg-black text-white rounded px-4 py-2 disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Detailed Workout'}
            </button>
          )}

          <button
            onClick={onClose}
            className="text-sm text-gray-600 hover:text-black underline pt-2"
          >
            Close
          </button>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
