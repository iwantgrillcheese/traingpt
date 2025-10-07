'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { getEmoji } from '@/utils/session-utils';

type Props = {
  date: string;
  onClose: () => void;
  onAdded: (newSession: any) => void;
};

export default function InlineSessionForm({ date, onClose, onAdded }: Props) {
  const [sport, setSport] = useState('bike');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [loading, setLoading] = useState(false);

  const supabase = createClientComponentClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 🧭 ensure user is logged in
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) {
        alert('You must be logged in to add a session.');
        setLoading(false);
        return;
      }

      // 🧠 build clean title with emoji
      const emoji = getEmoji(sport);
      const formattedTitle =
        title.trim() !== '' ? `${emoji} ${title.trim()}` : `${emoji} ${sport}`;

      // 🧾 insert new session
      const { data, error } = await supabase
        .from('sessions')
        .insert([
          {
            user_id: user.id,
            date,
            sport,
            title: formattedTitle,
            duration: duration ? Number(duration) : null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // ✅ notify parent & close
      onAdded(data);
      onClose();
    } catch (err: any) {
      console.error('Failed to add session:', err);
      alert('Failed to add session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 border rounded-md bg-white shadow-sm mt-2">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        {/* sport selector */}
        <select
          value={sport}
          onChange={(e) => setSport(e.target.value)}
          className="border rounded-md px-2 py-1 text-sm"
        >
          <option value="swim">🏊 Swim</option>
          <option value="bike">🚴 Bike</option>
          <option value="run">🏃 Run</option>
          <option value="strength">💪 Strength</option>
          <option value="rest">😴 Rest</option>
        </select>

        {/* title input */}
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 border rounded-md px-2 py-1 text-sm"
        />

        {/* duration input */}
        <input
          type="number"
          placeholder="min"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="w-16 border rounded-md px-2 py-1 text-sm text-center"
        />

        {/* buttons */}
        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white px-3 py-1 rounded-md text-sm"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 text-sm"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}
