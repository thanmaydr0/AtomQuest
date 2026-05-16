import {
  Target,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Clock,
  Ban,
  Share2,
  Lock,
} from 'lucide-react';
import type { Goal, GoalStatus, UoMType } from '@/types';

interface GoalCardProps {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: (goalId: string) => void;
  pushedByName?: string;
  compact?: boolean;
}

const statusConfig: Record<GoalStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-neutral-700 text-neutral-300' },
  submitted: { label: 'Submitted', color: 'bg-blue-500/15 text-blue-400 border border-blue-500/20' },
  approved: { label: 'Approved', color: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' },
  locked: { label: 'Locked', color: 'bg-purple-500/15 text-purple-400 border border-purple-500/20' },
  returned: { label: 'Returned', color: 'bg-orange-500/15 text-orange-400 border border-orange-500/20' },
};

const uomConfig: Record<UoMType, { label: string; icon: React.ReactNode; color: string }> = {
  min: { label: 'Min', icon: <TrendingDown className="h-3 w-3" />, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  max: { label: 'Max', icon: <TrendingUp className="h-3 w-3" />, color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  timeline: { label: 'Timeline', icon: <Clock className="h-3 w-3" />, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  zero: { label: 'Zero', icon: <Ban className="h-3 w-3" />, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

export function GoalCard({ goal, onEdit, onDelete, pushedByName, compact = false }: GoalCardProps) {
  const status = statusConfig[goal.status];
  const uom = uomConfig[goal.uom_type];
  const isShared = goal.is_shared;
  const isEditable = (goal.status === 'draft' || goal.status === 'returned') || isShared;
  const isDeletable = goal.status === 'draft' && !isShared;

  return (
    <div className={`group rounded-xl border bg-neutral-900/60 p-5 transition-all hover:bg-neutral-900/80 ${isShared ? 'border-[#fdb913]/30' : 'border-neutral-800 hover:border-neutral-700'}`}>
      {/* Top row: thrust area + badges */}
      <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fdb913]/10 px-2.5 py-0.5 text-xs font-medium text-[#fdb913]">
            <Target className="h-3 w-3" />
            {goal.thrust_area}
          </span>
          {isShared && (
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-400 border border-cyan-500/20">
              <Share2 className="h-2.5 w-2.5" />
              Shared Goal
            </span>
          )}
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
          {status.label}
        </span>
      </div>

      {/* Title */}
      <h3 className="mb-1 text-base font-semibold text-white">{goal.title}</h3>

      {/* Description — hidden in compact mode */}
      {!compact && goal.description && (
        <p className="mb-3 text-sm text-neutral-400 line-clamp-2">{goal.description}</p>
      )}

      {/* Shared goal origin */}
      {!compact && isShared && pushedByName && (
        <p className="mb-3 text-[11px] text-neutral-500">
          Pushed by: <span className="font-medium text-neutral-400">{pushedByName}</span>
        </p>
      )}

      {/* Shared goal tooltip — hidden in compact */}
      {!compact && isShared && (
        <div className="mb-3 flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-800/40 px-3 py-2 text-[11px] text-neutral-500">
          <Lock className="h-3 w-3 shrink-0" />
          This goal was set by your manager. Only weightage can be adjusted.
        </div>
      )}

      {/* Meta row — compact shows only UoM + weightage, expanded shows target/deadline */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${uom.color}`}>
          {uom.icon}
          {uom.label}
        </span>

        {!compact && (goal.uom_type === 'min' || goal.uom_type === 'max') && goal.target_value !== null && (
          <span className="text-xs text-neutral-500">
            Target: <span className="text-neutral-300 font-medium">{goal.target_value}</span>
          </span>
        )}
        {!compact && goal.uom_type === 'timeline' && goal.deadline_date && (
          <span className="text-xs text-neutral-500">
            Due: <span className="text-neutral-300 font-medium">{new Date(goal.deadline_date).toLocaleDateString()}</span>
          </span>
        )}
        {!compact && goal.uom_type === 'zero' && (
          <span className="text-xs text-neutral-500 italic">Zero incidents</span>
        )}

        {/* Weightage */}
        <span className="ml-auto inline-flex items-center rounded-lg bg-neutral-800 px-2.5 py-1 text-sm font-bold text-white">
          {goal.weightage}%
        </span>
      </div>

      {/* Action buttons */}
      {(isEditable || isDeletable) && (
        <div className="flex items-center gap-2 border-t border-neutral-800 pt-3">
          {isEditable && (
            <button
              onClick={() => onEdit(goal)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
            >
              <Pencil className="h-3.5 w-3.5" />
              {isShared ? 'Adjust Weightage' : 'Edit'}
            </button>
          )}
          {isDeletable && (
            <button
              onClick={() => onDelete(goal.goal_id)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
