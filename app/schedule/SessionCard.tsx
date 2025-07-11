'use client';

export default function SessionCard({ title }: { title: string }) {
  const getColor = (t: string) => {
    const s = t.toLowerCase();
    if (s.includes('swim')) return 'bg-cyan-300';
    if (s.includes('bike')) return 'bg-orange-300';
    if (s.includes('run')) return 'bg-pink-300';
    return 'bg-neutral-300';
  };

  return (
    <div className="flex items-center gap-1 text-xs text-black truncate leading-tight">
      <div className={`w-1.5 h-1.5 rounded-full ${getColor(title)}`} />
      <span className="truncate">{title.length > 42 ? title.slice(0, 40) + '…' : title}</span>
    </div>
  );
}
