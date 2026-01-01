'use client';

import { useDraggable } from '@dnd-kit/core';
import clsx from 'clsx';

type Props = {
  session: string;
  onClick?: (session: string) => void;
};

export default function SessionTag({ session, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: session,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  if (typeof session !== 'string') {
    return <div className="px-2 py-1 text-xs text-gray-500 italic">Unrecognized session</div>;
  }

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
        'group flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2',
        'text-sm text-gray-800 shadow-[0_1px_0_rgba(0,0,0,0.03)]',
        'hover:bg-gray-50 hover:border-gray-300 transition cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-60 shadow-md'
      )}
    >
      <span className="md:hidden text-sm">{icon}</span>
      <span className="truncate font-medium">{label}</span>
      <span className="ml-auto hidden md:block text-[11px] text-gray-500 opacity-0 group-hover:opacity-100 transition">
        Drag
      </span>
    </div>
  );
}
