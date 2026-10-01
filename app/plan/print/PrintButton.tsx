"use client";
import { track } from '@/lib/analytics/posthog-client';

export default function PrintButton() {
  return <button className="rounded-full bg-[#2563FF] px-5 py-3 text-sm font-semibold text-white" onClick={() => {
    try { track('plan_print_clicked', { source: 'print_view' }); } catch { /* Printing stays available if telemetry fails. */ }
    window.print();
  }}>Print / Save as PDF</button>;
}
