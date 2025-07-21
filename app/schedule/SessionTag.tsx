export default function SessionTag({ session }: { session: string }) {
  if (typeof session !== 'string') {
    return (
      <div className="text-xs text-gray-500 italic px-2 py-[2px]">
        Unrecognized session
      </div>
    );
  }

  const icon = session.charAt(0); // first character (usually emoji)
  const label = session.slice(2).trim(); // remove emoji + space

  return (
    <div className="flex items-center gap-2 text-sm ... px-4 py-2 rounded-md">
  <span className="text-sm">{icon}</span>
  <span className="truncate">{label}</span>
</div>

  );
}
