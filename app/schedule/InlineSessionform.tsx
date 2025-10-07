'use client';

import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function InlineSessionForm({
  date,
  onClose,
  onAdded,
}: {
  date: string;
  onClose: () => void;
  onAdded: (session: any) => void;
}) {
  const [sport, setSport] = useState('bike');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [saving, setSaving] = useState(false);
  const supabase = createClientComponentClient();

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);

    const { data, error } = await supabase
      .from('sessions')
      .insert([
        {
          date,
          title: `${getEmoji(sport)} ${title}`,
          duration: duration ? Number(duration) : null,
          sport,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error(error);
      alert('Failed to add session.');
      setSaving(false);
      return;
    }

    onAdded(data);
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={true} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md bg-white rounded-lg p-6 shadow-xl space-y-4">
          <Dialog.Title className="text-lg font-semibold">Add Session</Dialog.Title>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm"
              >
                <option value="swim">🏊 Swim</option>
                <option value="bike">🚴 Bike</option>
                <option value="run">🏃 Run</option>
                <option value="strength">💪 Strength</option>
                <option value="other">🔸 Other</option>
              </select>

              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className="flex-1 border rounded-md px-2 py-1 text-sm"
              />
              <input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="min"
                type="number"
                className="w-16 border rounded-md px-2 py-1 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="text-sm text-gray-500">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-black text-white text-sm px-4 py-2 rounded-md"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

function getEmoji(sport: string) {
  switch (sport) {
    case 'swim':
      return '🏊';
    case 'bike':
      return '🚴';
    case 'run':
      return '🏃';
    case 'strength':
      return '💪';
    default:
      return '🔸';
  }
}
