import { useState } from 'react';
import { SidebarCalendar } from './SidebarCalendar';
import { MonthGrid, Session } from './MonthGrid';
import { SessionModal } from './SessionModal';

interface FantasticalCalendarProps {
  sessions: Session[];
}

export default function FantasticalCalendar({ sessions }: FantasticalCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [modalSession, setModalSession] = useState<Session | null>(null);

  return (
    <>
      <div className="flex gap-6 max-w-7xl mx-auto p-4">
        <SidebarCalendar
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
        />

        <div className="flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="text-sm px-3 py-1 border rounded hover:bg-gray-100"
            >
              Today
            </button>
            <div className="font-semibold text-lg">
              {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setCurrentMonth(
                    new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
                  )
                }
                className="text-sm px-3 py-1 border rounded hover:bg-gray-100"
              >
                Prev
              </button>
              <button
                onClick={() =>
                  setCurrentMonth(
                    new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
                  )
                }
                className="text-sm px-3 py-1 border rounded hover:bg-gray-100"
              >
                Next
              </button>
            </div>
          </div>

          <MonthGrid
            year={currentMonth.getFullYear()}
            month={currentMonth.getMonth()}
            sessions={sessions}
            selectedDate={selectedDate}
            onDayClick={setSelectedDate}
            onSessionClick={setModalSession}
          />
        </div>
      </div>

      {modalSession && (
        <SessionModal
          session={modalSession}
          onClose={() => setModalSession(null)}
          onStatusChange={(status) => {
            // Optional: handle status change
            console.log('Session status:', status);
          }}
          onGenerateWorkout={async () => {
            // Optional: trigger detailed workout generation logic
            console.log('Generate workout for:', modalSession.title);
          }}
        />
      )}
    </>
  );
}
