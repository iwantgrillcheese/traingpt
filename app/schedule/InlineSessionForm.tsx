'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import { getEmoji } from '@/utils/session-utils';
console.log('MOUNT', 'InlineSessionForm');


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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
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

      const emoji = getEmoji(sport);
      const formattedTitle =
        title.trim() !== '' ? `${emoji} ${title.trim()}` : `${emoji} ${sport}`;

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
        .select('*')
        .single();

      if (error) throw error;

      onAdded({
        ...data,
        id: data.id || Math.random().toString(36).slice(2),
      });
      onClose();
    } catch (err: any) {
      console.error('❌ Failed to add session:', err);
      alert('Failed to add session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 border rounded-md bg-white shadow-sm mt-2">
      {/* form identical to before */}
      {/* ... unchanged */}
    </div>
  );
}
