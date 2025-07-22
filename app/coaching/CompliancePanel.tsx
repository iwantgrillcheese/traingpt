'use client';

type CompliancePanelProps = {
  plannedCount: number;
  completedCount: number;
};

export default function CompliancePanel({ plannedCount, completedCount }: CompliancePanelProps) {
  const complianceRate = plannedCount === 0 ? 0 : Math.round((completedCount / plannedCount) * 100);

  return (
    <div className="mt-10 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">📈 Training Compliance</h2>

      <p className="mt-4 text-sm text-gray-700">
        You completed <strong>{completedCount}</strong> of <strong>{plannedCount}</strong> planned
        sessions this week.
      </p>

      <div className="mt-2 text-sm text-gray-700">
        Compliance Score: <span className="font-medium">{complianceRate}%</span>
      </div>
    </div>
  );
}
