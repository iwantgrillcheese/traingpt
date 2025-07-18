'use client';

import { useState } from 'react';
import { format, isToday } from 'date-fns';
import type { Session } from '@/types/session';
import { cn } from '@/utils/session-utils';
import { useRouter } from 'next/navigation';

type DayCellProps = {
  date: Date;
  sessions: Session[];
  isFaded?: boolean;
};

export default function DayCell({ date, sessions, isFaded }: DayCellProps) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  const handleClick = (session: Session) => {
    const encoded = encodeURIComponent(session.title);
    const query = `?q=Can you explain the ${session.title} on ${format(date, 'EEEE')}?`;
    router.push(`/coaching${query}`);
  };

  return (
    <div
      className={cn(
        'relative flex flex-col p-2 border bg-background min-h-[80px] hover:bg-muted transition-colors cursor-pointer',
        isFaded && 'text-muted-foreground bg-muted/30',
        isToday(date) && 'border-primary'
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="text-xs font-medium mb-1">
        {format(date, 'd')}
      </div>

      <div className="flex flex-col gap-1">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => handleClick(s)}
            className="truncate text-xs px-2 py-1 rounded bg-muted hover:bg-accent text-foreground text-left"
          >
            {s.title}
          </button>
        ))}
      </div>

      {hovered && sessions.length === 0 && (
        <div className="absolute bottom-1 right-1 text-xs text-muted-foreground">No sessions</div>
      )}
    </div>
  );
}
