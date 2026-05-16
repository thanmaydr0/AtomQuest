import { useCallback, useEffect, useState } from 'react';
import { CheckSquare, ChevronDown, ChevronUp, Inbox, Clock } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useGoalStore } from '@/stores/goalStore';
import { supabase } from '@/lib/supabase';
import { GoalReviewPanel } from '@/components/manager/GoalReviewPanel';
import type { Goal, User } from '@/types';

interface EmployeeSubmission {
  employee: User;
  goals: Goal[];
  submittedAt: string;
}

export default function ManagerApprovals() {
  const user = useAuthStore((s) => s.user);
  const { activeCycle, fetchActiveCycle } = useGoalStore();
  const [submissions, setSubmissions] = useState<EmployeeSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let cycle = activeCycle;
    if (!cycle) cycle = await fetchActiveCycle();
    if (!cycle) { setLoading(false); return; }

    const { data: reports } = await supabase.from('users').select('*').eq('manager_id', user.user_id);
    if (!reports || reports.length === 0) { setSubmissions([]); setLoading(false); return; }

    const reportIds = reports.map((r: User) => r.user_id);
    const { data: goalsData } = await supabase.from('goals').select('*').in('owner_id', reportIds).eq('cycle_id', cycle.cycle_id).eq('status', 'submitted').order('created_at', { ascending: true });
    const goals = (goalsData ?? []) as Goal[];

    const grouped = new Map<string, Goal[]>();
    for (const g of goals) { const l = grouped.get(g.owner_id) ?? []; l.push(g); grouped.set(g.owner_id, l); }

    const subs: EmployeeSubmission[] = [];
    for (const [ownerId, ownerGoals] of grouped) {
      const emp = reports.find((r: User) => r.user_id === ownerId);
      if (emp) {
        const latest = ownerGoals.reduce((max, g) => g.updated_at > max ? g.updated_at : max, ownerGoals[0].updated_at);
        subs.push({ employee: emp as User, goals: ownerGoals, submittedAt: latest });
      }
    }
    setSubmissions(subs);
    setLoading(false);
  }, [user, activeCycle, fetchActiveCycle]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-800" />
        {[1, 2].map((i) => (<div key={i} className="h-20 animate-pulse rounded-xl border border-neutral-800 bg-neutral-900/50" />))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><CheckSquare className="h-6 w-6 text-[#fdb913]" />Approvals</h1>
        <p className="mt-1 text-sm text-neutral-400">Review and approve submitted goal sheets from your team</p>
      </div>

      {submissions.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-800 py-16 text-center">
          <Inbox className="h-12 w-12 text-neutral-700 mb-4" />
          <h2 className="text-lg font-semibold text-neutral-400">No pending approvals</h2>
          <p className="mt-2 max-w-sm text-sm text-neutral-600">None of your direct reports have submitted their goal sheets yet.</p>
        </div>
      )}

      {submissions.map((sub) => {
        const isExpanded = expandedId === sub.employee.user_id;
        const totalW = sub.goals.reduce((s, g) => s + g.weightage, 0);
        return (
          <div key={sub.employee.user_id} className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
            <button onClick={() => setExpandedId(isExpanded ? null : sub.employee.user_id)} className="flex w-full items-center gap-4 px-6 py-4 text-left hover:bg-neutral-800/40">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-sm font-bold text-neutral-300">
                {sub.employee.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{sub.employee.name}</span>
                  <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-400 border border-blue-500/20">Submitted</span>
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-neutral-500">
                  <span>{sub.employee.department}</span><span>·</span>
                  <span>{sub.goals.length} goal{sub.goals.length !== 1 ? 's' : ''}</span><span>·</span>
                  <span className={totalW === 100 ? 'text-emerald-500' : 'text-amber-500'}>{totalW}% weightage</span>
                </div>
              </div>
              <div className="hidden items-center gap-1.5 text-xs text-neutral-500 sm:flex"><Clock className="h-3.5 w-3.5" />{new Date(sub.submittedAt).toLocaleDateString()}</div>
              {isExpanded ? <ChevronUp className="h-5 w-5 text-neutral-500" /> : <ChevronDown className="h-5 w-5 text-neutral-500" />}
            </button>
            {isExpanded && <GoalReviewPanel employeeName={sub.employee.name} goals={sub.goals} cycleId={sub.goals[0].cycle_id} onActionComplete={loadData} />}
          </div>
        );
      })}
    </div>
  );
}
