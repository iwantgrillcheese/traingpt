export default function SessionTag({ session }: { session: string }) {
  const icon = session.startsWith('🚴')
    ? '🚴'
    : session.startsWith('🏃')
    ? '🏃'
    : session.startsWith('🏊')
    ? '🏊‍♂️'
    : '📌';

  const label = session.replace(/^.\s*/, ''); // remove emoji and space

  return (
    <div className="flex items-center gap-1 text-xs bg-gray-100 text-gray-800 rounded-md px-2 py-[2px] truncate">
      <span>{icon}</span>
      <span className="truncate max-w-[120px]">{label}</span>
    </div>
  );
}
