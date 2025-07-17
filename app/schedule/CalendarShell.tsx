'use client';

import { useState } from 'react';
import { addMonths, subMonths, format } from 'date-fns';
import MonthGrid from './MonthGrid';
import SessionModal from './SessionModal';

export default function CalendarShell({
  sessionsByDate,
  stravaActivities,
}: {
  sessionsByDate: Record<string, any[]>;
  stravaActivities?: Record<string, any[]>;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [selectedSession, setSelectedSession] = useState<any | null>(null);

  function handleOpenSession(session: any) {
    setSelectedSession(session);
  }

  function handleCloseSession() {
    setSelectedSession(null);
  }

  return (
    <div className="w-full h-full px-4 pb-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 mt-4">
        <h2 className="text-2xl font-semibold text-gray-800">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex gap-2">
          <button
            className="text-sm text-gray-500 hover:text-gray-700"
            onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
          >
            ◀
          </button>
          <button
            className="text-sm text-gray-500 hover:text-gray-700"
            onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
          >
            ▶
          </button>
        </div>
      </div>

      {/* Calendar */}
      <MonthGrid
        currentMonth={currentMonth}
        sessionsByDate={sessionsByDate}
        stravaActivities={stravaActivities}
        onSelectSession={handleOpenSession}
      />

      {/* Modal */}
      {selectedSession && (
        <SessionModal session={selectedSession} onClose={handleCloseSession} />
      )}
    </div>
  );
}
