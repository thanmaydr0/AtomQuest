interface SkeletonTableProps {
  rows?: number;
  cols?: number;
}

export function SkeletonTable({ rows = 5, cols = 5 }: SkeletonTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
      <div className="border-b border-neutral-800 px-5 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 w-20 animate-pulse rounded bg-neutral-800" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-neutral-800/30 px-5 py-4">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-3 animate-pulse rounded bg-neutral-800/60"
              style={{ width: `${60 + Math.random() * 60}px` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
          <div className="mb-3 flex justify-between"><div className="h-4 w-24 rounded bg-neutral-800" /><div className="h-4 w-16 rounded bg-neutral-800" /></div>
          <div className="h-5 w-48 rounded bg-neutral-800 mb-2" />
          <div className="h-3 w-full rounded bg-neutral-800/50 mb-4" />
          <div className="flex gap-2"><div className="h-6 w-12 rounded-full bg-neutral-800" /><div className="h-6 w-16 rounded-full bg-neutral-800" /></div>
        </div>
      ))}
    </div>
  );
}
