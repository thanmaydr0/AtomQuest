import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle2, Clock, AlertTriangle, Eye } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useGoalStore } from '@/stores/goalStore';
import { supabase } from '@/lib/supabase';
import type { Goal, User, GoalStatus } from '@/types';

interface ReportSummary {
  employee: User;
  goalCount: number;
  totalWeightage: number;
  sheetStatus: GoalStatus | 'empty';
}

function deriveStatus(goals: Goal[]): GoalStatus | 'empty' {
  if (goals.length === 0) return 'empty';
  const s = new Set(goals.map((g) => g.status));
  if (s.has('locked')) return 'locked';
  if (s.has('approved')) return 'approved';
  if (s.has('submitted')) return 'submitted';
  if (s.has('returned')) return 'returned';
  return 'draft';
}

const statusBadge: Record<string, { label: string; cls: string }> = {
  empty: { label: 'No Goals', cls: 'text-neutral-500 bg-neutral-800' },
  draft: { label: 'Draft', cls: 'text-neutral-400 bg-neutral-800' },
  submitted: { label: 'Submitted', cls: 'text-blue-400 bg-blue-500/15 border border-blue-500/20' },
  approved: { label: 'Approved', cls: 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/20' },
  locked: { label: 'Locked', cls: 'text-purple-400 bg-purple-500/15 border border-purple-500/20' },
  returned: { label: 'Returned', cls: 'text-orange-400 bg-orange-500/15 border border-orange-500/20' },
};

export default function ManagerTeamDashboard() {
  const user = useAuthStore((s) => s.user);
  const { activeCycle, fetchActiveCycle } = useGoalStore();
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let cycle = activeCycle;
    if (!cycle) cycle = await fetchActiveCycle();
    if (!cycle) { setLoading(false); return; }

    const { data: directReports } = await supabase.from('users').select('*').eq('manager_id', user.user_id);
    if (!directReports || directReports.length === 0) { setReports([]); setLoading(false); return; }

    const ids = directReports.map((r: User) => r.user_id);
    const { data: allGoals } = await supabase.from('goals').select('*').in('owner_id', ids).eq('cycle_id', cycle.cycle_id);
    const goals = (allGoals ?? []) as Goal[];

    const summaries: ReportSummary[] = directReports.map((emp: User) => {
      const empGoals = goals.filter((g) => g.owner_id === emp.user_id);
      return {
        employee: emp as User,
        goalCount: empGoals.length,
        totalWeightage: empGoals.reduce((s, g) => s + g.weightage, 0),
        sheetStatus: deriveStatus(empGoals),
      };
    });

    setReports(summaries);
    setLoading(false);
  }, [user, activeCycle, fetchActiveCycle]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalReports = reports.length;
  const submitted = reports.filter((r) => r.sheetStatus === 'submitted').length;
  const locked = reports.filter((r) => r.sheetStatus === 'locked' || r.sheetStatus === 'approved').length;
  const draft = reports.filter((r) => r.sheetStatus === 'draft' || r.sheetStatus === 'empty').length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-800" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">{[1, 2, 3, 4].map((i) => (<div key={i} className="h-24 animate-pulse rounded-xl border border-neutral-800 bg-neutral-900/50" />))}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Users className="h-6 w-6 text-[#fdb913]" />My Team</h1>
        <p className="mt-1 text-sm text-neutral-400">{activeCycle ? `${activeCycle.cycle_name} · ${activeCycle.phase.replace('_', ' ')}` : 'No active cycle'}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">Direct Reports</div>
          <div className="mt-1 text-2xl font-bold text-white">{totalReports}</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">Pending Review</div>
          <div className="mt-1 text-2xl font-bold text-blue-400">{submitted}</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">Approved / Locked</div>
          <div className="mt-1 text-2xl font-bold text-emerald-400">{locked}</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">Still in Draft</div>
          <div className="mt-1 text-2xl font-bold text-neutral-400">{draft}</div>
        </div>
      </div>

      {/* No reports */}
      {reports.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-800 py-16 text-center">
          <Users className="h-12 w-12 text-neutral-700 mb-4" />
          <h2 className="text-lg font-semibold text-neutral-400">No direct reports</h2>
          <p className="mt-2 text-sm text-neutral-600">You don't have any team members assigned to you.</p>
        </div>
      )}

      {/* Report list */}
      {reports.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left">
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Employee</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Department</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Goals</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Weightage</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const badge = statusBadge[r.sheetStatus];
                return (
                  <tr key={r.employee.user_id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs font-bold text-neutral-300">
                          {r.employee.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-white">{r.employee.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-400">{r.employee.department}</td>
                    <td className="px-4 py-3 text-neutral-300">{r.goalCount}</td>
                    <td className="px-4 py-3">
                      <span className={r.totalWeightage === 100 ? 'text-emerald-400' : 'text-neutral-400'}>{r.totalWeightage}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      {r.sheetStatus === 'submitted' ? (
                        <button onClick={() => navigate('/manager/approvals')} className="flex items-center gap-1 rounded-lg bg-[#fdb913]/10 px-3 py-1.5 text-xs font-medium text-[#fdb913] hover:bg-[#fdb913]/20">
                          <Eye className="h-3.5 w-3.5" />Review
                        </button>
                      ) : r.sheetStatus === 'draft' || r.sheetStatus === 'empty' ? (
                        <span className="flex items-center gap-1 text-xs text-neutral-600"><Clock className="h-3.5 w-3.5" />Waiting</span>
                      ) : r.sheetStatus === 'returned' ? (
                        <span className="flex items-center gap-1 text-xs text-orange-500"><AlertTriangle className="h-3.5 w-3.5" />Returned</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" />Done</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
