import { useState } from 'react';
import {
  Check,
  Undo2,
  AlertTriangle,
  Loader2,
  Pencil,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { AIReviewPanel } from '@/components/manager/AIReviewPanel';
import type { Goal } from '@/types';
import { PredictiveRiskBadge } from '@/components/shared/PredictiveRiskBadge';
import { WhatIfSimulator } from '@/components/manager/WhatIfSimulator';
import toast from 'react-hot-toast';
import { Sparkles } from 'lucide-react';

async function notifyGoalEvent(event: 'goal_approved' | 'goal_returned', payload: Record<string, unknown>) {
  try {
    await supabase.functions.invoke('notify-goal-event', {
      body: { event, ...payload },
    });
  } catch (error) {
    console.warn(`[GoalReviewPanel] notify-goal-event failed for ${event}:`, error);
  }
}

interface GoalReviewPanelProps {
  employeeName: string;
  goals: Goal[];
  cycleId: string;
  onActionComplete: () => void;
}

interface EditingCell {
  goalId: string;
  field: 'target_value' | 'weightage';
}

export function GoalReviewPanel({
  employeeName,
  goals,
  cycleId,
  onActionComplete,
}: GoalReviewPanelProps) {
  const [localGoals, setLocalGoals] = useState<Goal[]>(goals);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editedGoals, setEditedGoals] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [approveConfirm, setApproveConfirm] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnComment, setReturnComment] = useState('');
  const [simulatingGoal, setSimulatingGoal] = useState<Goal | null>(null);

  const totalWeightage = localGoals.reduce((sum, g) => sum + g.weightage, 0);
  const isWeightageValid = totalWeightage === 100;

  function startEdit(goalId: string, field: 'target_value' | 'weightage') {
    const goal = localGoals.find((g) => g.goal_id === goalId);
    if (!goal) return;
    const value = field === 'target_value' ? goal.target_value ?? '' : goal.weightage;
    setEditingCell({ goalId, field });
    setEditValue(String(value));
  }

  async function commitEdit() {
    if (!editingCell) return;
    const { goalId, field } = editingCell;
    const numVal = Number(editValue);

    if (isNaN(numVal)) {
      setEditingCell(null);
      return;
    }

    if (field === 'weightage' && (numVal < 10 || numVal > 100)) {
      toast.error('Weightage must be between 10% and 100%');
      return;
    }

    // Update locally
    setLocalGoals((prev) =>
      prev.map((g) =>
        g.goal_id === goalId ? { ...g, [field]: numVal } : g
      )
    );

    // Persist to Supabase
    const { error } = await supabase
      .from('goals')
      .update({ [field]: numVal, updated_at: new Date().toISOString() })
      .eq('goal_id', goalId);

    if (error) {
      toast.error(`Failed to update: ${error.message}`);
      // Revert
      setLocalGoals(goals);
    } else {
      setEditedGoals((prev) => new Set(prev).add(goalId));
    }

    setEditingCell(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditingCell(null);
  }

  async function handleApproveAndLock() {
    if (!isWeightageValid) {
      toast.error('Total weightage must equal 100% before approval');
      return;
    }

    setProcessing(true);
    const ownerIds = [...new Set(localGoals.map((g) => g.owner_id))];

    const { error } = await supabase
      .from('goals')
      .update({ status: 'locked', updated_at: new Date().toISOString() })
      .in('owner_id', ownerIds)
      .eq('cycle_id', cycleId)
      .eq('status', 'submitted');

    setProcessing(false);

    if (error) {
      toast.error(`Failed to approve: ${error.message}`);
      return;
    }

    await notifyGoalEvent('goal_approved', {
      ownerId: ownerIds[0],
      cycleId,
      goalId: localGoals[0]?.goal_id,
      linkPath: '/dashboard',
    });

    toast.success(`${employeeName}'s goals approved and locked!`);
    onActionComplete();
  }

  async function handleReturn() {
    if (!returnComment.trim()) {
      toast.error('Please provide a reason for returning');
      return;
    }

    setProcessing(true);
    const ownerIds = [...new Set(localGoals.map((g) => g.owner_id))];

    const { error } = await supabase
      .from('goals')
      .update({ status: 'returned', updated_at: new Date().toISOString() })
      .in('owner_id', ownerIds)
      .eq('cycle_id', cycleId)
      .eq('status', 'submitted');

    if (error) {
      toast.error(`Failed to return: ${error.message}`);
      setProcessing(false);
      return;
    }

    // Log the return comment as an escalation
    const { error: escError } = await supabase.from('escalation_logs').insert({
      user_id: ownerIds[0],
      escalation_type: 'goal_returned',
      message: returnComment.trim(),
    });

    if (escError) console.warn('Failed to log escalation:', escError.message);

    await notifyGoalEvent('goal_returned', {
      ownerId: ownerIds[0],
      cycleId,
      goalId: localGoals[0]?.goal_id,
      comment: returnComment,
      linkPath: '/dashboard',
    });

    setProcessing(false);
    setReturnDialogOpen(false);
    setReturnComment('');
    toast.success(`${employeeName}'s goals returned for rework`);
    onActionComplete();
  }

  const uomLabel: Record<string, string> = {
    min: 'Min',
    max: 'Max',
    timeline: 'Timeline',
    zero: 'Zero',
  };

  return (
    <div className="border-t border-neutral-800 bg-neutral-950/50 px-6 py-5">
      {/* AI Manager Review */}
      <div className="mb-6">
        <AIReviewPanel
          employeeName={employeeName}
          goals={localGoals.map(g => ({
            title: g.title,
            thrust_area: g.thrust_area,
            uom_type: g.uom_type,
            weightage: g.weightage,
            status: g.status
          }))}
          onUseComment={(comment) => {
            setReturnComment(comment);
            setReturnDialogOpen(true);
          }}
        />
      </div>

      {/* Data grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left">
              <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">Thrust Area</th>
              <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">Title</th>
              <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">UoM</th>
              <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Target
                <Pencil className="ml-1 inline h-3 w-3 text-neutral-600" />
              </th>
              <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Weightage
                <Pencil className="ml-1 inline h-3 w-3 text-neutral-600" />
              </th>
            </tr>
          </thead>
          <tbody>
            {localGoals.map((goal) => (
              <tr key={goal.goal_id} className="border-b border-neutral-800/50 hover:bg-neutral-900/40">
                {/* Thrust Area & Risk Badge */}
                <td className="py-3 pr-4 align-top">
                  <div className="flex flex-col items-start gap-2">
                    <span className="inline-flex items-center rounded-full bg-[#fdb913]/10 px-2 py-0.5 text-xs font-medium text-[#fdb913]">
                      {goal.thrust_area}
                    </span>
                    <PredictiveRiskBadge 
                      goal={goal}
                      cyclePhase="Goal Setting"
                      checkins={[]}
                    />
                    <button
                      onClick={() => setSimulatingGoal(goal)}
                      className="flex items-center gap-1.5 px-2 py-1 mt-1 rounded-full text-[10px] uppercase font-bold tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-colors"
                      title="What-If Simulator"
                    >
                      <Sparkles className="h-3 w-3" />
                      Simulate
                    </button>
                  </div>
                </td>

                {/* Title */}
                <td className="py-3 pr-4 text-neutral-200 font-medium max-w-[200px] truncate">
                  {goal.title}
                </td>

                {/* UoM */}
                <td className="py-3 pr-4 text-neutral-400">
                  {uomLabel[goal.uom_type] || goal.uom_type}
                </td>

                {/* Target - editable */}
                <td className="py-3 pr-4">
                  {editingCell?.goalId === goal.goal_id && editingCell.field === 'target_value' ? (
                    <input
                      type="number"
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={handleKeyDown}
                      className="w-20 rounded border border-[#fdb913]/50 bg-neutral-800 px-2 py-1 text-sm text-white outline-none focus:ring-1 focus:ring-[#fdb913]/50"
                    />
                  ) : (
                    <button
                      onClick={() => startEdit(goal.goal_id, 'target_value')}
                      className="group/cell flex items-center gap-1 rounded px-2 py-1 text-neutral-300 transition-colors hover:bg-neutral-800"
                    >
                      {goal.uom_type === 'timeline'
                        ? goal.deadline_date
                          ? new Date(goal.deadline_date).toLocaleDateString()
                          : '—'
                        : goal.uom_type === 'zero'
                        ? '0'
                        : goal.target_value ?? '—'}
                      {editedGoals.has(goal.goal_id) && (
                        <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#fdb913]" title="Edited" />
                      )}
                      <Pencil className="h-3 w-3 text-neutral-600 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
                    </button>
                  )}
                </td>

                {/* Weightage - editable */}
                <td className="py-3 pr-4">
                  {editingCell?.goalId === goal.goal_id && editingCell.field === 'weightage' ? (
                    <input
                      type="number"
                      autoFocus
                      min={10}
                      max={100}
                      step={10}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={handleKeyDown}
                      className="w-20 rounded border border-[#fdb913]/50 bg-neutral-800 px-2 py-1 text-sm text-white outline-none focus:ring-1 focus:ring-[#fdb913]/50"
                    />
                  ) : (
                    <button
                      onClick={() => startEdit(goal.goal_id, 'weightage')}
                      className="group/cell flex items-center gap-1 rounded px-2 py-1 font-bold text-white transition-colors hover:bg-neutral-800"
                    >
                      {goal.weightage}%
                      {editedGoals.has(goal.goal_id) && (
                        <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#fdb913]" title="Edited" />
                      )}
                      <Pencil className="h-3 w-3 text-neutral-600 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="pt-3 text-right text-xs font-medium text-neutral-500">
                Total Weightage:
              </td>
              <td className="pt-3">
                <span className={`text-sm font-bold ${isWeightageValid ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalWeightage}%
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Validation warning */}
      {!isWeightageValid && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Total weightage is {totalWeightage}% — must equal 100% before approval.
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={() => setApproveConfirm(true)}
          disabled={!isWeightageValid || processing}
          className="flex items-center gap-1.5 rounded-lg bg-[#fdb913] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#e5a710] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Approve & Lock
        </button>
        <button
          onClick={() => setReturnDialogOpen(true)}
          disabled={processing}
          className="flex items-center gap-1.5 rounded-lg bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/25 disabled:opacity-40"
        >
          <Undo2 className="h-4 w-4" />
          Return for Rework
        </button>
      </div>

      <ConfirmDialog open={approveConfirm} title="Approve & Lock Goals?"
        description={`This will lock ${employeeName}'s ${localGoals.length} goals (${totalWeightage}% weightage). They will not be able to edit them.`}
        confirmLabel="Approve & Lock" variant="default" loading={processing}
        onConfirm={async () => { await handleApproveAndLock(); setApproveConfirm(false); }}
        onCancel={() => setApproveConfirm(false)} />

      {/* Return confirmation dialog */}
      {returnDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Return Goals for Rework</h3>
            <p className="mt-2 text-sm text-neutral-400">
              <strong className="text-neutral-300">{employeeName}</strong>'s goals will be returned to draft status. Please explain why.
            </p>
            <textarea
              autoFocus
              rows={3}
              value={returnComment}
              onChange={(e) => setReturnComment(e.target.value)}
              placeholder="e.g. Weightage distribution needs adjustment, some targets are too low…"
              className="mt-4 w-full rounded-lg border border-neutral-700 bg-neutral-800/60 px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none resize-none focus:border-[#fdb913] focus:ring-1 focus:ring-[#fdb913]/50"
            />
            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={() => { setReturnDialogOpen(false); setReturnComment(''); }}
                className="flex-1 rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={handleReturn}
                disabled={!returnComment.trim() || processing}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-orange-500/15 px-4 py-2 text-sm font-semibold text-orange-400 transition-colors hover:bg-orange-500/25 disabled:opacity-40"
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulator Modal */}
      {simulatingGoal && (
        <WhatIfSimulator
          goal={simulatingGoal}
          cyclePhase="Goal Setting"
          onClose={() => setSimulatingGoal(null)}
        />
      )}
    </div>
  );
}
