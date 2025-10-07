'use client';

import { useDraggable } from '@dnd-kit/core';
import clsx from 'clsx';

type Props = {
  session: string;
  onClick?: (session: string) => void;
};

export default function SessionTag({ session, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: session, // unique identifier for drag events
  });

  // Basic transform style for smooth dragging
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  // Handle edge case where session isn't a string
  if (typeof session !== 'string') {
    return (
      <div className="text-xs text-gray-500 italic px-2 py-[2px]">
        Unrecognized session
      </div>
    );
  }

  // Parse emoji + label
  const icon = session.charAt(0);
  const label = session.slice(2).trim();

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      onClick={() => onClick?.(session)}
      className={clsx(
        'flex items-center gap-2 text-sm px-4 py-2 rounded-md border bg-white hover:shadow-sm transition-all cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-60 shadow-lg'
      )}
    >
      <span className="text-sm">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}
