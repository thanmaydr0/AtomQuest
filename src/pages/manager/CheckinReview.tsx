import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Users, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useGoalStore } from '@/stores/goalStore';
import { supabase } from '@/lib/supabase';
import { PredictiveRiskBadge } from '@/components/shared/PredictiveRiskBadge';
import { scoreBgColor, getActivePhaseLabel } from '@/lib/scoring';
import type { Goal, CheckIn, User } from '@/types';
import toast from 'react-hot-toast';

interface EmpData {
  employee: User;
  goals: Goal[];
  checkins: Map<string, CheckIn>;
}

export default function ManagerCheckinReview() {
  const user = useAuthStore((s) => s.user);
  const { activeCycle, fetchActiveCycle } = useGoalStore();
  const [empList, setEmpList] = useState<EmpData[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [commentEditing, setCommentEditing] = useState<string | null>(null);
  const [commentValue, setCommentValue] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let cycle = activeCycle;
    if (!cycle) cycle = await fetchActiveCycle();
    if (!cycle) { setLoading(false); return; }

    const { data: reports } = await supabase.from('users').select('*').eq('manager_id', user.user_id);
    if (!reports || reports.length === 0) { setEmpList([]); setLoading(false); return; }

    const ids = reports.map((r: User) => r.user_id);
    const { data: goalsData } = await supabase.from('goals').select('*').in('owner_id', ids).eq('cycle_id', cycle.cycle_id).in('status', ['locked', 'approved']);
    const goals = (goalsData ?? []) as Goal[];

    const goalIds = goals.map((g) => g.goal_id);
    let checkins: CheckIn[] = [];
    if (goalIds.length > 0) {
      const { data: ciData } = await supabase.from('check_ins').select('*').in('goal_id', goalIds).eq('cycle_id', cycle.cycle_id).eq('phase', cycle.phase);
      checkins = (ciData ?? []) as CheckIn[];
    }

    const ciMap = new Map(checkins.map((c) => [c.goal_id, c]));
    const result: EmpData[] = reports.map((emp: User) => {
      const empGoals = goals.filter((g) => g.owner_id === emp.user_id);
      const empCheckins = new Map<string, CheckIn>();
      for (const g of empGoals) { const ci = ciMap.get(g.goal_id); if (ci) empCheckins.set(g.goal_id, ci); }
      return { employee: emp as User, goals: empGoals, checkins: empCheckins };
    }).filter((e) => e.goals.length > 0);

    setEmpList(result);
    setLoading(false);
  }, [user, activeCycle, fetchActiveCycle]);

  useEffect(() => { loadData(); }, [loadData]);

  async function saveComment(checkinId: string) {
    setCommentSaving(true);
    const { error } = await supabase.from('check_ins').update({ manager_comment: commentValue }).eq('check_in_id', checkinId);
    setCommentSaving(false);
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    toast.success('Comment saved');
    setCommentEditing(null);
    await loadData();
  }

  const cycle = activeCycle;
  const selected = empList[selectedIdx] ?? null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-800" />
        <div className="h-64 animate-pulse rounded-xl border border-neutral-800 bg-neutral-900/50" />
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="h-12 w-12 text-neutral-600 mb-4" />
        <h2 className="text-lg font-semibold text-neutral-300">No Active Cycle</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <MessageSquare className="h-6 w-6 text-[#fdb913]" />Check-in Review
        </h1>
        <p className="mt-1 text-sm text-neutral-400">{cycle.cycle_name} · {getActivePhaseLabel(cycle)}</p>
      </div>

      {empList.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-800 py-16 text-center">
          <Users className="h-12 w-12 text-neutral-700 mb-4" />
          <h2 className="text-lg font-semibold text-neutral-400">No check-in data</h2>
          <p className="mt-2 text-sm text-neutral-600">None of your direct reports have locked goals yet.</p>
        </div>
      )}

      {empList.length > 0 && (
        <div className="flex gap-6">
          {/* Employee tabs */}
          <div className="w-48 shrink-0 space-y-1">
            {empList.map((ed, idx) => (
              <button
                key={ed.employee.user_id}
                onClick={() => setSelectedIdx(idx)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  idx === selectedIdx
                    ? 'bg-[#fdb913]/10 text-[#fdb913] font-semibold'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                }`}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-[10px] font-bold text-neutral-300">
                  {ed.employee.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <span className="truncate">{ed.employee.name}</span>
              </button>
            ))}
          </div>

          {/* Goal table */}
          {selected && (
            <div className="flex-1 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
              <div className="border-b border-neutral-800 px-5 py-3">
                <h2 className="font-semibold text-white">{selected.employee.name}</h2>
                <p className="text-xs text-neutral-500">{selected.employee.department} · {selected.goals.length} goal{selected.goals.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-800 text-left">
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Goal</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Target</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Actual</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Score</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Status</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.goals.map((goal) => {
                      const ci = selected.checkins.get(goal.goal_id);
                      const score = ci?.computed_score ?? null;
                      const isEditingComment = commentEditing === goal.goal_id;

                      return (
                        <tr key={goal.goal_id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                          <td className="px-5 py-3">
                            <div className="font-medium text-neutral-200 max-w-[180px] truncate mb-1">{goal.title}</div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-neutral-600 uppercase tracking-wider">{goal.thrust_area}</span>
                              <PredictiveRiskBadge 
                                goal={goal} 
                                cyclePhase={activeCycle?.phase ?? ''} 
                                checkins={ci ? [ci] : []} 
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-neutral-400">
                            {goal.uom_type === 'timeline'
                              ? goal.deadline_date ? new Date(goal.deadline_date).toLocaleDateString() : '—'
                              : goal.uom_type === 'zero' ? '0' : goal.target_value ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-neutral-300">
                            {ci ? (
                              goal.uom_type === 'timeline'
                                ? ci.completion_date ? new Date(ci.completion_date).toLocaleDateString() : '—'
                                : ci.actual_achievement ?? '—'
                            ) : (
                              <span className="text-neutral-600 italic text-xs">No data</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${scoreBgColor(score)}`}>
                              {score != null ? `${score}%` : 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {ci ? (
                              <span className="text-xs text-neutral-400 capitalize">{ci.status.replace('_', ' ')}</span>
                            ) : (
                              <span className="text-xs text-neutral-600 italic">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {ci ? (
                              isEditingComment ? (
                                <div className="flex items-center gap-2">
                                  <textarea
                                    autoFocus
                                    rows={2}
                                    value={commentValue}
                                    onChange={(e) => setCommentValue(e.target.value)}
                                    onBlur={() => saveComment(ci.check_in_id)}
                                    className="w-40 rounded border border-[#fdb913]/50 bg-neutral-800 px-2 py-1 text-xs text-white outline-none resize-none focus:ring-1 focus:ring-[#fdb913]/50"
                                  />
                                  {commentSaving && <Loader2 className="h-3 w-3 animate-spin text-neutral-500" />}
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setCommentEditing(goal.goal_id); setCommentValue(ci.manager_comment ?? ''); }}
                                  className="group flex items-center gap-1 text-xs text-neutral-500 hover:text-[#fdb913]"
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  {ci.manager_comment ? (
                                    <span className="max-w-[120px] truncate text-neutral-400">{ci.manager_comment}</span>
                                  ) : (
                                    <span className="italic">Add comment</span>
                                  )}
                                </button>
                              )
                            ) : (
                              <span className="text-[10px] text-neutral-600">No check-in</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
