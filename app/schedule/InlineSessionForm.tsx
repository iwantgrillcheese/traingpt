'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-client';
import { format } from 'date-fns';

export default function InlineSessionForm({ date, onClose, onAdded }: any) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  // ✅ Always call hooks in the same order
  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      setLoading(false);
    };
    loadUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    const { data, error } = await supabase
      .from('sessions')
      .insert([
        {
          user_id: user.id,
          date: date,
          title: title || `Session ${format(new Date(date), 'MMM d')}`,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    setSaving(false);
    if (error) {
      console.error('Error adding session:', error);
      return;
    }

    onAdded?.(data);
  };

  // ✅ Conditional rendering, not conditional hooks
  if (loading) {
    return (
      <div className="text-center text-sm text-gray-400 py-4">
        Loading user…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center text-sm text-gray-400 py-4">
        Please sign in to add a session.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 p-2 sm:p-4"
    >
      <label className="text-sm font-medium">Session Title</label>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="rounded-md border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="e.g., Long Ride 3hr Z2"
      />

      <div className="flex gap-2 justify-end mt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1 text-gray-500 hover:text-gray-700 text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
