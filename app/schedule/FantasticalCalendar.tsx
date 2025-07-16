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
      <div className="flex max-w-7xl mx-auto p-4 gap-6">
        <SidebarCalendar
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
        />

        <div className="flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="text-sm px-3 py-1 border rounded hover:bg-gray-100 transition"
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
                className="text-sm px-3 py-1 border rounded hover:bg-gray-100 transition"
              >
                Prev
              </button>
              <button
                onClick={() =>
                  setCurrentMonth(
                    new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
                  )
                }
                className="text-sm px-3 py-1 border rounded hover:bg-gray-100 transition"
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
            // Optional: handle session status update logic here
            console.log('Status changed to', status);
          }}
          onGenerateWorkout={async () => {
            // Optional: trigger workout generation logic here
            console.log('Generating detailed workout for:', modalSession.title);
          }}
        />
      )}
    </>
  );
}
