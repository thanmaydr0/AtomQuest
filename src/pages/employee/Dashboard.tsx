import { useCallback, useEffect, useState } from 'react';
import { Target, Plus, Send, Loader2, AlertTriangle, CheckCircle2, FileText, Share2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useGoalStore } from '@/stores/goalStore';
import { supabase } from '@/lib/supabase';
import { GoalCard } from '@/components/employee/GoalCard';
import { GoalFormModal } from '@/components/employee/GoalFormModal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { WeightageMeter } from '@/components/shared/WeightageMeter';
import { SkeletonCards } from '@/components/shared/Skeletons';
import { WorkflowTimeline } from '@/components/shared/WorkflowTimeline';
import { CreepyButton } from '@/components/shared/CreepyButton';
import type { Goal, GoalStatus } from '@/types';
import toast from 'react-hot-toast';

const MAX_GOALS = 8;
const SHARED_READONLY_FIELDS = ['thrust_area', 'title', 'description', 'uom_type', 'target_value', 'deadline_date'];

function sheetStatus(goals: Goal[]): GoalStatus | 'empty' {
  if (goals.length === 0) return 'empty';
  const statuses = new Set(goals.map((g) => g.status));
  if (statuses.has('locked')) return 'locked';
  if (statuses.has('approved')) return 'approved';
  if (statuses.has('submitted')) return 'submitted';
  if (statuses.has('returned')) return 'returned';
  return 'draft';
}

const sheetStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  empty: { label: 'No Goals', color: 'text-neutral-500', icon: <FileText className="h-4 w-4" /> },
  draft: { label: 'Draft', color: 'text-neutral-400', icon: <FileText className="h-4 w-4" /> },
  submitted: { label: 'Submitted', color: 'text-blue-400', icon: <Send className="h-4 w-4" /> },
  approved: { label: 'Approved', color: 'text-emerald-400', icon: <CheckCircle2 className="h-4 w-4" /> },
  locked: { label: 'Locked', color: 'text-purple-400', icon: <CheckCircle2 className="h-4 w-4" /> },
  returned: { label: 'Returned', color: 'text-orange-400', icon: <AlertTriangle className="h-4 w-4" /> },
};

export default function EmployeeDashboard() {
  const user = useAuthStore((s) => s.user);
  const { goals, activeCycle, loading, submitting, fetchActiveCycle, fetchGoals, createGoal, updateGoal, deleteGoal, submitGoalSheet } = useGoalStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [pushedByMap, setPushedByMap] = useState<Map<string, string>>(new Map());

  const loadData = useCallback(async () => {
    if (!user) return;
    const cycle = await fetchActiveCycle();
    if (cycle) await fetchGoals(user.user_id, cycle.cycle_id);
  }, [user, fetchActiveCycle, fetchGoals]);

  useEffect(() => {
    async function loadPushedBy() {
      const sharedGoals = goals.filter((g) => g.is_shared && g.master_goal_id);
      if (sharedGoals.length === 0) return;
      const masterIds = [...new Set(sharedGoals.map((g) => g.master_goal_id!))];
      const { data: masters } = await supabase.from('shared_goals_master').select('master_id, creator_id').in('master_id', masterIds);
      if (!masters) return;
      const creatorIds = [...new Set(masters.map((m: { creator_id: string }) => m.creator_id))];
      const { data: creators } = await supabase.from('users').select('user_id, name').in('user_id', creatorIds);
      if (!creators) return;
      const creatorMap = new Map(creators.map((c: { user_id: string; name: string }) => [c.user_id, c.name]));
      const result = new Map<string, string>();
      for (const m of masters as { master_id: string; creator_id: string }[]) {
        result.set(m.master_id, creatorMap.get(m.creator_id) ?? 'Admin');
      }
      setPushedByMap(result);
    }
    loadPushedBy();
  }, [goals]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalWeightage = goals.reduce((sum, g) => sum + g.weightage, 0);
  const sharedWeightage = goals.filter((g) => g.is_shared).reduce((sum, g) => sum + g.weightage, 0);
  const hasSharedGoals = sharedWeightage > 0;

  const status = sheetStatus(goals);
  const statusCfg = sheetStatusConfig[status];
  const canEdit = status === 'draft' || status === 'returned' || status === 'empty';
  const hasIncompleteGoals = goals.some((g) => !g.title || !g.thrust_area);
  const canSubmit = canEdit && goals.length > 0 && goals.length <= MAX_GOALS && totalWeightage === 100 && !hasIncompleteGoals;

  function toggleExpand(goalId: string) {
    setExpandedGoals((prev) => {
      const next = new Set(prev);
      next.has(goalId) ? next.delete(goalId) : next.add(goalId);
      return next;
    });
  }

  async function handleSaveGoal(data: {
    thrust_area: string; title: string; description?: string;
    uom_type: 'min' | 'max' | 'timeline' | 'zero';
    target_value: number | null; deadline_date: string | null; weightage: number;
  }) {
    if (!user || !activeCycle) return;
    if (editingGoal) {
      if (editingGoal.is_shared) {
        await updateGoal(editingGoal.goal_id, { weightage: data.weightage });
      } else {
        await updateGoal(editingGoal.goal_id, {
          thrust_area: data.thrust_area, title: data.title, description: data.description || '',
          uom_type: data.uom_type,
          target_value: data.uom_type === 'min' || data.uom_type === 'max' ? data.target_value : null,
          deadline_date: data.uom_type === 'timeline' ? data.deadline_date : null,
          weightage: data.weightage,
        });
      }
    } else {
      await createGoal({
        owner_id: user.user_id, cycle_id: activeCycle.cycle_id,
        thrust_area: data.thrust_area, title: data.title, description: data.description || '',
        uom_type: data.uom_type,
        target_value: data.uom_type === 'min' || data.uom_type === 'max' ? data.target_value : null,
        deadline_date: data.uom_type === 'timeline' ? data.deadline_date : null,
        weightage: data.weightage, status: 'draft', master_goal_id: null, is_shared: false,
      });
    }
    setEditingGoal(null);
  }

  function handleEdit(goal: Goal) { setEditingGoal(goal); setModalOpen(true); }
  async function handleDelete() { 
    if (deleteConfirm) { 
      const goalToDelete = goals.find(g => g.goal_id === deleteConfirm);
      if (goalToDelete?.is_shared) {
        toast.error('Shared goals cannot be deleted. Contact your manager.');
        setDeleteConfirm(null);
        return;
      }
      await deleteGoal(deleteConfirm); 
      setDeleteConfirm(null); 
    } 
  }
  async function handleSubmit() {
    if (!user || !activeCycle) return;
    await submitGoalSheet(user.user_id, activeCycle.cycle_id);
    setSubmitConfirm(false);
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-800" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (<div key={i} className="h-24 animate-pulse rounded-xl border border-neutral-800 bg-neutral-900/50" />))}
        </div>
        <div className="h-16 animate-pulse rounded-xl border border-neutral-800 bg-neutral-900/50" />
        <SkeletonCards count={4} />
      </div>
    );
  }

  if (!activeCycle) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="h-12 w-12 text-neutral-600 mb-4" />
        <h2 className="text-lg font-semibold text-neutral-300">No Active Cycle</h2>
        <p className="mt-2 text-sm text-neutral-500">There is no active goal cycle. Contact your admin.</p>
      </div>
    );
  }

  const modalReadOnly = editingGoal ? !(editingGoal.status === 'draft' || editingGoal.status === 'returned' || editingGoal.is_shared) : false;
  const modalReadOnlyFields = editingGoal?.is_shared ? SHARED_READONLY_FIELDS : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Target className="h-6 w-6 text-[#fdb913]" />My Goals</h1>
          <p className="mt-1 text-sm text-neutral-400">{activeCycle.cycle_name} · <span className="capitalize">{activeCycle.phase.replace('_', ' ')}</span></p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => { setEditingGoal(null); setModalOpen(true); }} disabled={goals.length >= MAX_GOALS}
              className="flex items-center gap-1.5 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed">
              <Plus className="h-4 w-4" />Add Goal
            </button>
            <CreepyButton onClick={() => setSubmitConfirm(true)} disabled={!canSubmit || submitting}
              title={!canSubmit ? totalWeightage !== 100 ? 'Total weightage must equal 100%' : 'Fix goals first' : ''}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-black">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Submit Goal Sheet
              </span>
            </CreepyButton>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">Total Goals</div>
          <div className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-bold text-white">{goals.length}</span><span className="text-xs text-neutral-500">/ {MAX_GOALS} max</span></div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">Total Weightage</div>
          <div className="mt-1 flex items-baseline gap-2"><span className={`text-2xl font-bold ${totalWeightage === 100 ? 'text-emerald-400' : totalWeightage > 100 ? 'text-red-400' : 'text-[#fdb913]'}`}>{totalWeightage}%</span><span className="text-xs text-neutral-500">/ 100%</span></div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">Sheet Status</div>
          <div className={`mt-1 flex items-center gap-2 text-lg font-bold ${statusCfg.color}`}>{statusCfg.icon}{statusCfg.label}</div>
        </div>
      </div>

      {/* Weightage Meter */}
      <WeightageMeter total={totalWeightage} sharedAmount={hasSharedGoals ? sharedWeightage : 0} submitted={status === 'submitted'} />
      {hasSharedGoals && (
        <div className="flex items-center gap-4 text-xs px-1">
          <span className="flex items-center gap-1.5"><Share2 className="h-3 w-3 text-cyan-400" /><span className="text-cyan-400 font-medium">Shared: {sharedWeightage}%</span></span>
          <span className="text-neutral-500">|</span>
          <span className="text-neutral-400">Your goals: {totalWeightage - sharedWeightage}%</span>
          <span className="text-neutral-500">|</span>
          <span className={totalWeightage === 100 ? 'text-emerald-400 font-medium' : 'text-amber-400'}>Total: {totalWeightage}% {totalWeightage === 100 ? '✓' : ''}</span>
        </div>
      )}

      {/* Goal List */}
      {goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-800 py-16 text-center">
          <Target className="h-12 w-12 text-neutral-700 mb-4" />
          <h2 className="text-lg font-semibold text-neutral-400">No goals yet</h2>
          <p className="mt-2 max-w-sm text-sm text-neutral-600">Start by adding your first goal for this cycle.</p>
          {canEdit && (
            <button onClick={() => { setEditingGoal(null); setModalOpen(true); }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#fdb913] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#e5a710]">
              <Plus className="h-4 w-4" />Add Goal
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {goals.map((goal) => {
            const isExpanded = expandedGoals.has(goal.goal_id);
            return (
              <div key={goal.goal_id}>
                {/* Compact view always visible */}
                <GoalCard goal={goal} onEdit={handleEdit} onDelete={(id) => setDeleteConfirm(id)}
                  pushedByName={goal.master_goal_id ? pushedByMap.get(goal.master_goal_id) : undefined}
                  compact={!isExpanded} />
                {/* Expand toggle */}
                <button onClick={() => toggleExpand(goal.goal_id)}
                  className="mt-1 flex w-full items-center justify-center gap-1 rounded-b-lg border border-t-0 border-neutral-800 bg-neutral-900/30 py-1 text-[10px] text-neutral-600 hover:text-neutral-400 hover:bg-neutral-800/30 transition-colors">
                  {isExpanded ? <><ChevronUp className="h-3 w-3" />Collapse</> : <><ChevronDown className="h-3 w-3" />Expand</>}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Activity Timeline */}
      <div className="mt-12 pt-8 border-t border-neutral-800/60">
        <h2 className="flex items-center gap-2 text-xl font-bold text-white mb-6">
          <FileText className="h-5 w-5 text-emerald-500" />
          Cycle Activity Timeline
        </h2>
        <WorkflowTimeline userId={user!.user_id} cycleId={activeCycle.cycle_id} />
      </div>

      {/* Modals */}
      <GoalFormModal open={modalOpen} onClose={() => { setModalOpen(false); setEditingGoal(null); }}
        onSave={handleSaveGoal} editingGoal={editingGoal}
        currentWeightage={totalWeightage - (editingGoal?.weightage || 0)}
        readOnly={modalReadOnly} readOnlyFields={modalReadOnlyFields} />

      <ConfirmDialog open={!!deleteConfirm} title="Delete Goal?"
        description="This action cannot be undone. The goal will be permanently removed."
        variant="danger" confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setDeleteConfirm(null)} />

      <ConfirmDialog open={submitConfirm} title="Submit Goal Sheet?"
        description={`You're about to submit ${goals.length} goals totaling ${totalWeightage}% weightage. This cannot be undone without manager approval.`}
        variant="default" confirmLabel="Submit" loading={submitting}
        onConfirm={handleSubmit} onCancel={() => setSubmitConfirm(false)} />
    </div>
  );
}
