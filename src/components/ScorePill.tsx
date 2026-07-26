type ScorePillProps = {
  label: string;
  value: number;
};

export function ScorePill({ label, value }: ScorePillProps) {
  return (
    <div className="min-w-0 rounded border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-zinc-500">{label}</span>
        <span className="font-mono text-lg text-white">{value}</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-sky-300"
          style={{ width: `${Math.max(0, Math.min(value, 10)) * 10}%` }}
        />
      </div>
    </div>
  );
}
