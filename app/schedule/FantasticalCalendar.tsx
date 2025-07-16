import { useState } from 'react';
import { SidebarCalendar } from './SidebarCalendar';
import { MonthGrid, Session } from './MonthGrid';
import SessionModal from './SessionModal';

export default function FantasticalCalendar({ sessions }: { sessions: Session[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [modalSession, setModalSession] = useState<Session | null>(null);

  return (
    <>
      <div className="flex gap-6 max-w-7xl mx-auto p-4">
        <SidebarCalendar
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          onDateSelect={(date) => setSelectedDate(date)}
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
                  setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
                }
                className="text-sm px-3 py-1 border rounded hover:bg-gray-100"
              >
                ← Prev
              </button>
              <button
                onClick={() =>
                  setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
                }
                className="text-sm px-3 py-1 border rounded hover:bg-gray-100"
              >
                Next →
              </button>
            </div>
          </div>
          <MonthGrid
            year={currentMonth.getFullYear()}
            month={currentMonth.getMonth()}
            sessions={sessions}
            onDayClick={(date) => setSelectedDate(date)}
            onSessionClick={(session) => setModalSession(session)}
          />
        </div>
      </div>

      <SessionModal
        session={modalSession ? { title: modalSession.title, date: modalSession.date } : null}
        onClose={() => setModalSession(null)}
      />
    </>
  );
}
