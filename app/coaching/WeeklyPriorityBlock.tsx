'use client';

type Props = {
  title: string;
  body: string;
};

export default function WeeklyPriorityBlock({ title, body }: Props) {
  return (
    <section className="mt-5 rounded-xl border border-zinc-800 bg-[#101318] p-4 md:p-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Weekly priority</p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight text-zinc-100">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{body}</p>
    </section>
  );
}
