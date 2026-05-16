import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface WeightageMeterProps {
  total: number;
  sharedAmount?: number;
  showLabel?: boolean;
  submitted?: boolean;
}

export function WeightageMeter({ total, sharedAmount = 0, showLabel = true, submitted = false }: WeightageMeterProps) {
  const personal = total - sharedAmount;
  let barColor = 'bg-[#fdb913]';
  let textColor = 'text-[#fdb913]';

  if (total === 100) {
    barColor = 'bg-emerald-500'; textColor = 'text-emerald-400';
  } else if (total > 100) {
    barColor = 'bg-red-500'; textColor = 'text-red-400';
  } else if (submitted && total < 80) {
    barColor = 'bg-red-500'; textColor = 'text-red-400';
  } else if (total >= 80) {
    barColor = 'bg-amber-500'; textColor = 'text-amber-400';
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      {showLabel && (
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium text-neutral-400">Weightage Distribution</span>
          <span className={`font-bold ${textColor}`}>{total}% of 100% allocated</span>
        </div>
      )}
      <div className="h-3 overflow-hidden rounded-full bg-neutral-800">
        {sharedAmount > 0 && (
          <div className="float-left h-full bg-cyan-500/70 transition-all duration-500" style={{ width: `${Math.min(sharedAmount, 100)}%` }} />
        )}
        <div className={`float-left h-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(personal, 100 - sharedAmount)}%` }} />
      </div>
      {total === 100 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />Balanced at 100%
        </p>
      )}
      {total !== 100 && total > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          {total > 100 ? `Over by ${total - 100}%` : `${100 - total}% remaining`}
        </p>
      )}
    </div>
  );
}
