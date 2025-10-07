'use client';
import { useState } from 'react';

type InlineSessionFormProps = {
  date: string;
  onClose: () => void;
  onAdded?: (session: any) => void;
};

export default function InlineSessionForm({ date, onClose, onAdded }: InlineSessionFormProps) {
  const [sport, setSport] = useState('run');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    const res = await fetch('/api/schedule/create-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, sport, title, duration }),
    });
    const data = await res.json();
    setLoading(false);
    onAdded?.(data.session);
    onClose();
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <select
        value={sport}
        onChange={(e) => setSport(e.target.value)}
        className="border rounded p-1 text-sm"
      >
        <option value="swim">🏊</option>
        <option value="bike">🚴</option>
        <option value="run">🏃</option>
        <option value="other">🧘</option>
      </select>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="border rounded p-1 flex-1 text-sm"
      />

      <input
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
        placeholder="min"
        type="number"
        className="border rounded p-1 w-16 text-sm"
      />

      <button
        onClick={handleSave}
        disabled={loading || !title}
        className="text-xs px-2 py-1 bg-black text-white rounded"
      >
        {loading ? '...' : 'Save'}
      </button>
    </div>
  );
}
