import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, Calendar, AlertTriangle, Loader2, Save, Info, Share2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useGoalStore } from '@/stores/goalStore';
import { supabase } from '@/lib/supabase';
import { SkeletonCards } from '@/components/shared/Skeletons';
import { computeScore, isCheckinWindowOpen, getActivePhaseLabel, scoreBgColor } from '@/lib/scoring';
import type { Goal, CheckIn } from '@/types';
import toast from 'react-hot-toast';

interface GoalWithCheckin {
  goal: Goal;
  checkin: CheckIn | null;
}

export default function EmployeeCheckins() {
  const user = useAuthStore((s) => s.user);
  const { activeCycle, fetchActiveCycle } = useGoalStore();
  const [items, setItems] = useState<GoalWithCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Local form state keyed by goal_id
  const [formState, setFormState] = useState<Record<string, {
    actual: string;
    completionDate: string;
    status: string;
  }>>({});

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let cycle = activeCycle;
    if (!cycle) cycle = await fetchActiveCycle();
    if (!cycle) { setLoading(false); return; }

    // Fetch locked goals
    const { data: goalsData } = await supabase
      .from('goals').select('*')
      .eq('owner_id', user.user_id).eq('cycle_id', cycle.cycle_id)
      .in('status', ['locked', 'approved'])
      .order('created_at', { ascending: true });

    const goals = (goalsData ?? []) as Goal[];
    if (goals.length === 0) { setItems([]); setLoading(false); return; }

    // Fetch existing check-ins for this cycle + phase
    const goalIds = goals.map((g) => g.goal_id);
    const { data: checkinsData } = await supabase
      .from('check_ins').select('*')
      .in('goal_id', goalIds).eq('cycle_id', cycle.cycle_id).eq('phase', cycle.phase);

    const checkins = (checkinsData ?? []) as CheckIn[];
    const checkinMap = new Map(checkins.map((c) => [c.goal_id, c]));

    const merged = goals.map((g) => ({ goal: g, checkin: checkinMap.get(g.goal_id) ?? null }));
    setItems(merged);

    // Init form state from existing check-ins
    const fs: typeof formState = {};
    for (const item of merged) {
      const ci = item.checkin;
      fs[item.goal.goal_id] = {
        actual: ci?.actual_achievement != null ? String(ci.actual_achievement) : '',
        completionDate: ci?.completion_date ?? '',
        status: ci?.status ?? 'not_started',
      };
    }
    setFormState(fs);
    setLoading(false);
  }, [user, activeCycle, fetchActiveCycle]);

  useEffect(() => { loadData(); }, [loadData]);

  function updateField(goalId: string, field: string, value: string) {
    setFormState((prev) => ({ ...prev, [goalId]: { ...prev[goalId], [field]: value } }));
  }

  function getLiveScore(goal: Goal, fs: { actual: string; completionDate: string }) {
    const cycle = activeCycle;
    if (!cycle) return null;
    return computeScore({
      uom_type: goal.uom_type,
      target_value: goal.target_value,
      actual_achievement: fs.actual !== '' ? Number(fs.actual) : null,
      deadline_date: goal.deadline_date,
      completion_date: fs.completionDate || null,
      cycle_start_date: cycle.start_date,
    });
  }

  async function handleSave(goalId: string) {
    if (!user || !activeCycle) return;
    const fs = formState[goalId];
    if (!fs) return;
    setSaving(goalId);

    const goal = items.find((i) => i.goal.goal_id === goalId)?.goal;
    if (!goal) { setSaving(null); return; }

    const score = getLiveScore(goal, fs);
    const existing = items.find((i) => i.goal.goal_id === goalId)?.checkin;

    const payload = {
      goal_id: goalId,
      cycle_id: activeCycle.cycle_id,
      phase: activeCycle.phase,
      actual_achievement: fs.actual !== '' ? Number(fs.actual) : null,
      completion_date: fs.completionDate || null,
      status: fs.status,
      computed_score: score,
      submitted_at: new Date().toISOString(),
    };

    let error;
    if (existing) {
      const res = await supabase.from('check_ins').update(payload).eq('check_in_id', existing.check_in_id);
      error = res.error;
    } else {
      const res = await supabase.from('check_ins').insert(payload);
      error = res.error;
    }

    setSaving(null);
    if (error) {
      toast.error(`Failed to save: ${error.message}`);
    } else {
      if (goal.is_shared) {
        toast.success("Check-in saved — your manager's achievement update is reflected in your goal sheet", { duration: 5000 });
      } else {
        toast.success('Check-in saved');
      }
      // Refetch all check-ins (handles shared goal sync from DB trigger)
      await loadData();
    }
  }

  const cycle = activeCycle;
  const windowOpen = cycle ? isCheckinWindowOpen(cycle) : false;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-800" />
        <SkeletonCards count={4} />
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="h-12 w-12 text-neutral-600 mb-4" />
        <h2 className="text-lg font-semibold text-neutral-300">No Active Cycle</h2>
        <p className="mt-2 text-sm text-neutral-500">Contact your admin to set up a goal cycle.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <ClipboardCheck className="h-6 w-6 text-[#fdb913]" />Check-ins
        </h1>
        <p className="mt-1 text-sm text-neutral-400">{cycle.cycle_name} · {getActivePhaseLabel(cycle)}</p>
      </div>

      {/* Window banner */}
      {windowOpen ? (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          <Calendar className="h-5 w-5 shrink-0" />
          <div>
            <strong>Check-in window is open!</strong>{' '}
            Log your progress below. Window closes{' '}
            <span className="font-semibold">{cycle.checkin_window_end ? new Date(cycle.checkin_window_end).toLocaleDateString() : 'TBD'}</span>.
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-neutral-700 bg-neutral-800/40 px-4 py-3 text-sm text-neutral-400">
          <Info className="h-5 w-5 shrink-0" />
          <div>
            <strong className="text-neutral-300">Check-in window is closed.</strong>{' '}
            {cycle.checkin_window_start ? `Next window: ${new Date(cycle.checkin_window_start).toLocaleDateString()} – ${cycle.checkin_window_end ? new Date(cycle.checkin_window_end).toLocaleDateString() : ''}` : 'No window scheduled yet.'}
          </div>
        </div>
      )}

      {/* No locked goals */}
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-800 py-16 text-center">
          <ClipboardCheck className="h-12 w-12 text-neutral-700 mb-4" />
          <h2 className="text-lg font-semibold text-neutral-400">No locked goals</h2>
          <p className="mt-2 text-sm text-neutral-600">Your goals need to be approved and locked before check-ins can begin.</p>
        </div>
      )}

      {/* Goal check-in cards */}
      <div className="space-y-4">
        {items.map(({ goal, checkin }) => {
          const fs = formState[goal.goal_id] ?? { actual: '', completionDate: '', status: 'not_started' };
          const liveScore = getLiveScore(goal, fs);
          const isSaving = saving === goal.goal_id;
          const readOnly = !windowOpen;

          return (
            <div key={goal.goal_id} className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
              {/* Goal header */}
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-[#fdb913]/10 px-2 py-0.5 text-xs font-medium text-[#fdb913]">{goal.thrust_area}</span>
                    {goal.is_shared && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-400 border border-cyan-500/20">
                        <Share2 className="h-2.5 w-2.5" />Shared
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 text-base font-semibold text-white">{goal.title}</h3>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {goal.uom_type === 'min' || goal.uom_type === 'max' ? `Target: ${goal.target_value}` : goal.uom_type === 'timeline' ? `Deadline: ${goal.deadline_date ? new Date(goal.deadline_date).toLocaleDateString() : '—'}` : 'Zero incidents'}{' '}
                    · Weightage: {goal.weightage}%
                  </p>
                </div>
                {/* Score preview */}
                <div className={`rounded-lg px-3 py-1.5 text-center ${scoreBgColor(liveScore)}`}>
                  <div className="text-[10px] font-medium uppercase tracking-wider opacity-70">Score</div>
                  <div className="text-lg font-bold">{liveScore != null ? `${liveScore}%` : 'N/A'}</div>
                </div>
              </div>

              {/* Input fields */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* Actual achievement */}
                {(goal.uom_type === 'min' || goal.uom_type === 'max') && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-500">Actual Achievement</label>
                    <input
                      type="number"
                      step="any"
                      value={fs.actual}
                      onChange={(e) => updateField(goal.goal_id, 'actual', e.target.value)}
                      disabled={readOnly}
                      placeholder="Enter actual value"
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white outline-none focus:border-[#fdb913] disabled:opacity-50"
                    />
                  </div>
                )}

                {goal.uom_type === 'timeline' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-500">Completion Date</label>
                    <input
                      type="date"
                      value={fs.completionDate}
                      onChange={(e) => updateField(goal.goal_id, 'completionDate', e.target.value)}
                      disabled={readOnly}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white outline-none focus:border-[#fdb913] disabled:opacity-50"
                    />
                  </div>
                )}

                {goal.uom_type === 'zero' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-500">Incident Count</label>
                    <input
                      type="number"
                      min={0}
                      value={fs.actual}
                      onChange={(e) => updateField(goal.goal_id, 'actual', e.target.value)}
                      disabled={readOnly}
                      placeholder="0 = success"
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white outline-none focus:border-[#fdb913] disabled:opacity-50"
                    />
                  </div>
                )}

                {/* Status */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">Status</label>
                  <select
                    value={fs.status}
                    onChange={(e) => updateField(goal.goal_id, 'status', e.target.value)}
                    disabled={readOnly}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white outline-none focus:border-[#fdb913] disabled:opacity-50"
                  >
                    <option value="not_started">Not Started</option>
                    <option value="on_track">On Track</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                {/* Save button */}
                <div className="flex items-end">
                  {!readOnly ? (
                    <button
                      onClick={() => handleSave(goal.goal_id)}
                      disabled={isSaving}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-[#fdb913] px-4 py-2 text-sm font-semibold text-black hover:bg-[#e5a710] disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save
                    </button>
                  ) : checkin ? (
                    <span className="text-xs text-neutral-500">Saved {new Date(checkin.submitted_at).toLocaleDateString()}</span>
                  ) : (
                    <span className="text-xs text-neutral-600">No check-in yet</span>
                  )}
                </div>
              </div>

              {/* Manager comment (read-only for employee) */}
              {checkin?.manager_comment && (
                <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-800/30 px-4 py-3">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 mb-1">Manager Comment</div>
                  <p className="text-sm text-neutral-300">{checkin.manager_comment}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
