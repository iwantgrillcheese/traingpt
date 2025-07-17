import SessionTag from './SessionTag';
import { format } from 'date-fns';

export default function DayCell({
  date,
  isCurrentMonth,
  sessions,
  onSelectSession,
}: {
  date: Date | null;
  isCurrentMonth: boolean;
  sessions: string[];
  onSelectSession: (session: string) => void;
}) {
  return (
    <div
      className={`min-h-[100px] p-2 border bg-white flex flex-col justify-start gap-1 text-sm ${
        isCurrentMonth ? 'opacity-100' : 'opacity-30'
      }`}
    >
      <div className="text-xs font-medium text-gray-600">
        {date ? format(date, 'd') : ''}
      </div>
      <div className="flex flex-col gap-[2px] mt-1">
        {sessions?.map((session, idx) => (
          <button
            key={idx}
            onClick={() => onSelectSession(session)}
            className="text-left"
          >
            <SessionTag session={session} />
          </button>
        ))}
      </div>
    </div>
  );
}
