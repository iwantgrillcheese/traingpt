import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
} from 'date-fns';
import DayCell from './DayCell';

export default function MonthGrid({
  currentMonth,
  sessionsByDate,
  stravaActivities,
  onSelectSession,
}: {
  currentMonth: Date;
  sessionsByDate: Record<string, any[]>;
  stravaActivities?: Record<string, any[]>;
  onSelectSession: (session: any) => void;
}) {
  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);

  const allDays = eachDayOfInterval({ start, end });

  const paddedStart = start.getDay();
  const paddedEnd = 6 - end.getDay();
  const emptyStartDays = Array(paddedStart).fill(null);
  const emptyEndDays = Array(paddedEnd).fill(null);

  const daysToRender = [...emptyStartDays, ...allDays, ...emptyEndDays];

  return (
    <div className="grid grid-cols-7 gap-[1px] bg-gray-200 rounded-xl overflow-hidden">
      {daysToRender.map((day, idx) => (
        <DayCell
          key={idx}
          date={day}
          isCurrentMonth={day ? isSameMonth(day, currentMonth) : false}
          sessions={day ? sessionsByDate?.[day.toISOString().slice(0, 10)] ?? [] : []}
          onSelectSession={onSelectSession}
        />
      ))}
    </div>
  );
}
