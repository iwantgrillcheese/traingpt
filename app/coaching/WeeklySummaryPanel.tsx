'use client';

import { useEffect, useState } from 'react';
import { fetchGPTSummary } from '@/utils/fetchGPTSummary';

export default function WeeklySummaryPanel({ userId }: { userId: string }) {
  const [summary, setSummary] = useState<string>('Loading...');

  useEffect(() => {
    const fetchSummary = async () => {
      const res = await fetchGPTSummary(userId);
      setSummary(res || 'No summary available.');
    };
    fetchSummary();
  }, [userId]);

  return (
    <section className="mb-8 bg-gray-50 rounded-lg p-4 border border-gray-200">
      <h2 className="text-lg font-semibold mb-2">Coach Summary</h2>
      <p className="text-sm text-gray-700 whitespace-pre-line">{summary}</p>
    </section>
  );
}
