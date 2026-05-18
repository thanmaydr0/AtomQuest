import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle2, Clock, AlertTriangle, Eye, RefreshCw, History, X } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useGoalStore } from '@/stores/goalStore';
import { cachedRpc, invalidate } from '@/lib/analyticsCache';
import { WorkflowTimeline } from '@/components/shared/WorkflowTimeline';
import type { GoalStatus } from '@/types';

interface TeamMember {
  user_id: string;
  name: string;
  department: string;
  goal_count: number;
  total_weightage: number;
  sheet_status: GoalStatus | 'empty';
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
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimelineUserId, setSelectedTimelineUserId] = useState<string | null>(null);

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!user) return;
    if (forceRefresh) {
      setRefreshing(true);
      invalidate('get_manager_team_summary');
    } else {
      setLoading(true);
    }

    let cycle = activeCycle;
    if (!cycle) cycle = await fetchActiveCycle();
    if (!cycle) { setLoading(false); setRefreshing(false); return; }

    try {
      const data = await cachedRpc<TeamMember[]>('get_manager_team_summary', {
        p_manager_id: user.user_id,
        p_cycle_id: cycle.cycle_id,
      });
      setMembers(data ?? []);
    } catch (err) {
      console.error('Failed to load team summary:', err);
      setMembers([]);
    }

    setLoading(false);
    setRefreshing(false);
  }, [user, activeCycle, fetchActiveCycle]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalReports = members.length;
  const submitted = members.filter((r) => r.sheet_status === 'submitted').length;
  const locked = members.filter((r) => r.sheet_status === 'locked' || r.sheet_status === 'approved').length;
  const draft = members.filter((r) => r.sheet_status === 'draft' || r.sheet_status === 'empty').length;

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Users className="h-6 w-6 text-[#fdb913]" />My Team</h1>
          <p className="mt-1 text-sm text-neutral-400">{activeCycle ? `${activeCycle.cycle_name} · ${activeCycle.phase.replace('_', ' ')}` : 'No active cycle'}</p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:border-neutral-600 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}/>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
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
      {members.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-800 py-16 text-center">
          <Users className="h-12 w-12 text-neutral-700 mb-4" />
          <h2 className="text-lg font-semibold text-neutral-400">No direct reports</h2>
          <p className="mt-2 text-sm text-neutral-600">You don't have any team members assigned to you.</p>
        </div>
      )}

      {/* Report list */}
      {members.length > 0 && (
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
              {members.map((r) => {
                const badge = statusBadge[r.sheet_status];
                return (
                  <tr key={r.user_id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs font-bold text-neutral-300">
                          {r.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-white">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-400">{r.department}</td>
                    <td className="px-4 py-3 text-neutral-300">{r.goal_count}</td>
                    <td className="px-4 py-3">
                      <span className={r.total_weightage === 100 ? 'text-emerald-400' : 'text-neutral-400'}>{r.total_weightage}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                    </td>
                    <td className="px-4 py-3 flex items-center gap-2">
                      <button onClick={() => setSelectedTimelineUserId(r.user_id)} className="flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800/50 px-2 py-1.5 text-[10px] uppercase font-bold text-neutral-300 hover:bg-neutral-700 transition-colors">
                        <History className="h-3 w-3" /> Timeline
                      </button>
                      {r.sheet_status === 'submitted' ? (
                        <button onClick={() => navigate('/manager/approvals')} className="flex items-center gap-1 rounded-lg bg-[#fdb913]/10 px-3 py-1.5 text-xs font-medium text-[#fdb913] hover:bg-[#fdb913]/20">
                          <Eye className="h-3.5 w-3.5" />Review
                        </button>
                      ) : r.sheet_status === 'draft' || r.sheet_status === 'empty' ? (
                        <span className="flex items-center gap-1 text-xs text-neutral-600"><Clock className="h-3.5 w-3.5" />Waiting</span>
                      ) : r.sheet_status === 'returned' ? (
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

      {selectedTimelineUserId && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setSelectedTimelineUserId(null)} />
          <div className="relative w-full max-w-md bg-[#05060a] shadow-2xl border-l border-neutral-800 h-full flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-5 border-b border-neutral-800 bg-neutral-900/50">
              <h3 className="font-bold text-white flex items-center gap-2"><History className="h-5 w-5 text-[#fdb913]" /> Employee Timeline</h3>
              <button onClick={() => setSelectedTimelineUserId(null)} className="p-1.5 rounded-full bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-neutral-900/20 to-transparent">
              <WorkflowTimeline userId={selectedTimelineUserId} cycleId={activeCycle?.cycle_id!} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
