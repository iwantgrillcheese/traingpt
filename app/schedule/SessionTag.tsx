export default function SessionTag({ session }: { session: any }) {
  const icon = session?.title?.includes('Bike')
    ? '🚴'
    : session?.title?.includes('Run')
    ? '🏃'
    : '🏊‍♂️';

  return (
    <div className="flex items-center gap-1 text-xs bg-gray-100 text-gray-800 rounded-md px-2 py-[2px] truncate">
      <span>{icon}</span>
      <span className="truncate max-w-[120px]">{session?.title}</span>
    </div>
  );
}
