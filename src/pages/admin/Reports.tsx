import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Download, Filter, X, Check, Minus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { supabase } from '@/lib/supabase';
import { scoreBgColor } from '@/lib/scoring';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { SkeletonCards } from '@/components/shared/Skeletons';
import type { User, GoalCycle } from '@/types';

// ─── Types ─────────────────────────────────────────
interface AchievementRow {
  [key: string]: unknown;
  emp_name: string; department: string; manager_name: string;
  title: string; thrust_area: string; uom_type: string;
  target_value: number | null; actual: number | null;
  score: number | null; status: string; phase: string;
}

interface EmpCompletion {
  [key: string]: unknown;
  name: string; department: string;
  q1: 'done' | 'partial' | 'none';
  q2: 'done' | 'partial' | 'none';
  q3: 'done' | 'partial' | 'none';
  q4: 'done' | 'partial' | 'none';
}

interface MgrCompletion {
  [key: string]: unknown;
  name: string; total: number; completed: number; pct: number;
}

// ─── CSV helper ────────────────────────────────────
function toCSV(rows: Record<string, unknown>[], keys: string[]): string {
  const header = keys.join(',');
  const lines = rows.map((r) =>
    keys.map((k) => {
      const v = r[k];
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  );
  return [header, ...lines].join('\n');
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Chart colors ──────────────────────────────────
const COLORS = ['#fdb913', '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f'];
const STATUS_COLORS: Record<string, string> = { draft: '#6b7280', submitted: '#3b82f6', approved: '#10b981', locked: '#8b5cf6', returned: '#f97316' };

// ─── Component ─────────────────────────────────────
export default function AdminReports() {
  const [tab, setTab] = useState<'achievement' | 'completion' | 'distribution'>('achievement');
  const [cycle, setCycle] = useState<GoalCycle | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Achievement state
  const [rows, setRows] = useState<AchievementRow[]>([]);
  const [deptF, setDeptF] = useState('');
  const [mgrF, setMgrF] = useState('');
  const [uomF, setUomF] = useState('');
  const [statusF, setStatusF] = useState('');
  const [scoreF, setScoreF] = useState('');

  // Completion state
  const [empComp, setEmpComp] = useState<EmpCompletion[]>([]);
  const [mgrComp, setMgrComp] = useState<MgrCompletion[]>([]);

  // Distribution state
  const [thrustData, setThrustData] = useState<{ name: string; count: number }[]>([]);
  const [uomData, setUomData] = useState<{ name: string; value: number }[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number; color: string }[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);

    // Get active cycle & users
    const [{ data: cData }, { data: uData }] = await Promise.all([
      supabase.from('goal_cycles').select('*').eq('status', 'active').limit(1).single(),
      supabase.from('users').select('*'),
    ]);
    const cy = cData as GoalCycle | null;
    const allUsers = (uData ?? []) as User[];
    setCycle(cy); setUsers(allUsers);
    if (!cy) { setLoading(false); return; }

    const userMap = new Map(allUsers.map((u) => [u.user_id, u]));

    // ─── Section 1: Achievement ───
    const { data: gData } = await supabase.from('goals').select('*').eq('cycle_id', cy.cycle_id);
    const goals = gData ?? [];
    const goalIds = goals.map((g: Record<string, unknown>) => g.goal_id as string);

    let checkins: Record<string, unknown>[] = [];
    if (goalIds.length) {
      const { data: ciData } = await supabase.from('check_ins').select('*').in('goal_id', goalIds);
      checkins = ciData ?? [];
    }
    const ciMap = new Map(checkins.map((c) => [c.goal_id as string, c]));

    const achRows: AchievementRow[] = goals.map((g: Record<string, unknown>) => {
      const owner = userMap.get(g.owner_id as string);
      const mgr = owner?.manager_id ? userMap.get(owner.manager_id) : null;
      const ci = ciMap.get(g.goal_id as string);
      return {
        emp_name: owner?.name ?? '?', department: owner?.department ?? '', manager_name: mgr?.name ?? '—',
        title: g.title as string, thrust_area: g.thrust_area as string, uom_type: g.uom_type as string,
        target_value: g.target_value as number | null,
        actual: ci ? ci.actual_achievement as number | null : null,
        score: ci ? ci.computed_score as number | null : null,
        status: g.status as string,
        phase: ci ? ci.phase as string : '—',
      };
    });
    setRows(achRows);

    // ─── Section 2: Completion ───
    const employees = allUsers.filter((u) => u.role === 'employee');
    const phases = ['q1', 'q2', 'q3', 'q4'] as const;
    const empCompRows: EmpCompletion[] = employees.map((emp) => {
      const empGoals = goals.filter((g: Record<string, unknown>) => g.owner_id === emp.user_id && (g.status === 'locked' || g.status === 'approved'));
      const empGoalIds = empGoals.map((g: Record<string, unknown>) => g.goal_id);
      const result: EmpCompletion = { name: emp.name, department: emp.department, q1: 'none', q2: 'none', q3: 'none', q4: 'none' };
      for (const ph of phases) {
        const phCheckins = checkins.filter((c) => empGoalIds.includes(c.goal_id as string) && c.phase === ph);
        if (phCheckins.length === 0) result[ph] = 'none';
        else if (phCheckins.length >= empGoals.length) result[ph] = 'done';
        else result[ph] = 'partial';
      }
      return result;
    });
    setEmpComp(empCompRows);

    const managers = allUsers.filter((u) => u.role === 'manager');
    const mgrCompRows: MgrCompletion[] = managers.map((mgr) => {
      const reports = employees.filter((e) => e.manager_id === mgr.user_id);
      const activePhase = cy.phase;
      const completed = reports.filter((r) => {
        const rGoals = goals.filter((g: Record<string, unknown>) => g.owner_id === r.user_id && (g.status === 'locked' || g.status === 'approved'));
        const rGoalIds = rGoals.map((g: Record<string, unknown>) => g.goal_id);
        const rCheckins = checkins.filter((c) => rGoalIds.includes(c.goal_id as string) && c.phase === activePhase);
        return rCheckins.length > 0 && rCheckins.length >= rGoals.length;
      }).length;
      return { name: mgr.name, total: reports.length, completed, pct: reports.length ? Math.round((completed / reports.length) * 100) : 0 };
    });
    setMgrComp(mgrCompRows);

    // ─── Section 3: Distribution ───
    const thrustMap = new Map<string, number>();
    const uomMap = new Map<string, number>();
    const statMap = new Map<string, number>();
    for (const g of goals) {
      const ta = g.thrust_area as string;
      thrustMap.set(ta, (thrustMap.get(ta) ?? 0) + 1);
      const ut = g.uom_type as string;
      uomMap.set(ut, (uomMap.get(ut) ?? 0) + 1);
      const st = g.status as string;
      statMap.set(st, (statMap.get(st) ?? 0) + 1);
    }
    setThrustData([...thrustMap].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));
    setUomData([...uomMap].map(([name, value]) => ({ name: name.toUpperCase(), value })));
    setStatusData([...statMap].map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] ?? '#6b7280' })));

    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ─── Filters ─────────────────────────────────────
  const departments = [...new Set(users.map((u) => u.department).filter(Boolean))];
  const mgrs = users.filter((u) => u.role === 'manager');

  const filtered = rows.filter((r) => {
    if (deptF && r.department !== deptF) return false;
    if (mgrF && r.manager_name !== mgrF) return false;
    if (uomF && r.uom_type !== uomF) return false;
    if (statusF && r.status !== statusF) return false;
    if (scoreF === 'above80' && (r.score == null || r.score < 80)) return false;
    if (scoreF === 'below50' && (r.score == null || r.score >= 50)) return false;
    return true;
  });

  function exportCSV() {
    const keys = ['emp_name', 'department', 'manager_name', 'title', 'thrust_area', 'uom_type', 'target_value', 'actual', 'score', 'status', 'phase'];
    const csv = toCSV(filtered, keys);
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(csv, `achievement_report_${cycle?.cycle_name ?? 'cycle'}_${date}.csv`);
  }

  // ─── Achievement columns ─────────────────────────
  const achCols: Column<AchievementRow>[] = [
    { key: 'emp_name', label: 'Employee', sortable: true, render: (r) => <span className="font-medium text-white">{r.emp_name}</span> },
    { key: 'department', label: 'Dept', sortable: true, render: (r) => <span className="text-neutral-400">{r.department}</span> },
    { key: 'manager_name', label: 'Manager', sortable: true, render: (r) => <span className="text-neutral-500 text-xs">{r.manager_name}</span> },
    { key: 'title', label: 'Goal', sortable: true, render: (r) => <span className="text-neutral-200 max-w-[160px] truncate block">{r.title}</span> },
    { key: 'thrust_area', label: 'Thrust', sortable: true, render: (r) => <span className="rounded-full bg-[#fdb913]/10 px-2 py-0.5 text-[10px] text-[#fdb913]">{r.thrust_area}</span> },
    { key: 'uom_type', label: 'UoM', sortable: true, render: (r) => <span className="text-neutral-400 uppercase text-xs">{r.uom_type}</span> },
    { key: 'target_value', label: 'Target', sortable: true, render: (r) => <span className="text-neutral-400">{r.target_value ?? '—'}</span> },
    { key: 'actual', label: 'Actual', sortable: true, render: (r) => <span className="text-neutral-300">{r.actual ?? '—'}</span> },
    { key: 'score', label: 'Score', sortable: true, render: (r) => <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${scoreBgColor(r.score)}`}>{r.score != null ? `${r.score}%` : 'N/A'}</span> },
    { key: 'status', label: 'Status', sortable: true, render: (r) => <span className="text-neutral-400 capitalize text-xs">{r.status}</span> },
    { key: 'phase', label: 'Phase', sortable: true, render: (r) => <span className="text-neutral-500 text-xs">{r.phase}</span> },
  ];

  // ─── Completion columns ──────────────────────────
  const compStatusIcon = (s: string) => {
    if (s === 'done') return <Check className="h-4 w-4 text-emerald-400" />;
    if (s === 'partial') return <Minus className="h-4 w-4 text-amber-400" />;
    return <X className="h-4 w-4 text-neutral-700" />;
  };

  const empCompCols: Column<EmpCompletion>[] = [
    { key: 'name', label: 'Employee', sortable: true, render: (r) => <span className="font-medium text-white">{r.name}</span> },
    { key: 'department', label: 'Dept', sortable: true, render: (r) => <span className="text-neutral-400">{r.department}</span> },
    { key: 'q1', label: 'Q1', render: (r) => compStatusIcon(r.q1) },
    { key: 'q2', label: 'Q2', render: (r) => compStatusIcon(r.q2) },
    { key: 'q3', label: 'Q3', render: (r) => compStatusIcon(r.q3) },
    { key: 'q4', label: 'Q4', render: (r) => compStatusIcon(r.q4) },
  ];

  const mgrCompCols: Column<MgrCompletion>[] = [
    { key: 'name', label: 'Manager', sortable: true, render: (r) => <span className="font-medium text-white">{r.name}</span> },
    { key: 'total', label: 'Team Size', sortable: true },
    { key: 'completed', label: 'Completed', sortable: true, render: (r) => <span className={r.completed === r.total && r.total > 0 ? 'text-emerald-400 font-bold' : 'text-neutral-300'}>{r.completed}</span> },
    { key: 'pct', label: '%', sortable: true, render: (r) => {
      const cls = r.pct === 100 ? 'bg-emerald-500/15 text-emerald-400' : r.pct > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-neutral-800 text-neutral-500';
      return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${cls}`}>{r.pct}%</span>;
    }},
  ];

  const activePhaseLabel = cycle ? cycle.phase.replace('_', ' ').toUpperCase() : '';
  const totalEmps = empComp.length;
  const submittedCount = empComp.filter((e) => e[cycle?.phase ?? 'q1'] === 'done').length;

  const tabs = [
    { id: 'achievement' as const, label: 'Achievement Report' },
    { id: 'completion' as const, label: 'Completion Dashboard' },
    { id: 'distribution' as const, label: 'Goal Distribution' },
  ];

  if (loading) return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-800" />
      <SkeletonCards count={4} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><BarChart3 className="h-6 w-6 text-[#fdb913]" />Reports</h1>
        <p className="mt-1 text-sm text-neutral-400">{cycle?.cycle_name ?? 'No active cycle'}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-neutral-800 bg-neutral-900/60 p-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === t.id ? 'bg-[#fdb913]/15 text-[#fdb913]' : 'text-neutral-400 hover:text-white'}`}>{t.label}</button>
        ))}
      </div>

      {/* ─── Section 1: Achievement ─── */}
      {tab === 'achievement' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-neutral-500" />
            <select value={deptF} onChange={(e) => setDeptF(e.target.value)} className="rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-1.5 text-xs text-white outline-none"><option value="">All Depts</option>{departments.map((d) => <option key={d} value={d}>{d}</option>)}</select>
            <select value={mgrF} onChange={(e) => setMgrF(e.target.value)} className="rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-1.5 text-xs text-white outline-none"><option value="">All Managers</option>{mgrs.map((m) => <option key={m.user_id} value={m.name}>{m.name}</option>)}</select>
            <select value={uomF} onChange={(e) => setUomF(e.target.value)} className="rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-1.5 text-xs text-white outline-none"><option value="">All UoM</option><option value="min">Min</option><option value="max">Max</option><option value="timeline">Timeline</option><option value="zero">Zero</option></select>
            <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-1.5 text-xs text-white outline-none"><option value="">All Status</option><option value="draft">Draft</option><option value="submitted">Submitted</option><option value="approved">Approved</option><option value="locked">Locked</option></select>
            <select value={scoreF} onChange={(e) => setScoreF(e.target.value)} className="rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-1.5 text-xs text-white outline-none"><option value="">All Scores</option><option value="above80">≥ 80%</option><option value="below50">{'< 50%'}</option></select>
            {(deptF || mgrF || uomF || statusF || scoreF) && <button onClick={() => { setDeptF(''); setMgrF(''); setUomF(''); setStatusF(''); setScoreF(''); }} className="text-xs text-neutral-500 hover:text-white flex items-center gap-1"><X className="h-3.5 w-3.5" />Clear</button>}
            <button onClick={exportCSV} className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#fdb913]/10 px-3 py-1.5 text-xs font-medium text-[#fdb913] hover:bg-[#fdb913]/20"><Download className="h-3.5 w-3.5" />Export CSV</button>
          </div>
          <DataTable columns={achCols} data={filtered} pageSize={20} emptyMessage="No achievement data for this cycle" />
        </div>
      )}

      {/* ─── Section 2: Completion ─── */}
      {tab === 'completion' && (
        <div className="space-y-6">
          {/* Aggregate banner */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
            <p className="text-sm text-neutral-300"><strong className="text-white">{submittedCount}</strong> of <strong className="text-white">{totalEmps}</strong> employees have submitted <span className="font-semibold text-[#fdb913]">{activePhaseLabel}</span> check-ins</p>
            <div className="mt-2 h-2 w-full rounded-full bg-neutral-800"><div className="h-2 rounded-full bg-[#fdb913] transition-all" style={{ width: `${totalEmps ? (submittedCount / totalEmps) * 100 : 0}%` }} /></div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-neutral-300">Employee Completion</h3>
            <DataTable columns={empCompCols} data={empComp} pageSize={20} emptyMessage="No employees found" />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-neutral-300">Manager Team Completion</h3>
            <DataTable columns={mgrCompCols} data={mgrComp} pageSize={20} emptyMessage="No managers found" />
          </div>
        </div>
      )}

      {/* ─── Section 3: Distribution ─── */}
      {tab === 'distribution' && (
        <div className="space-y-6">
          {/* Thrust Area bar chart */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
            <h3 className="mb-4 text-sm font-semibold text-neutral-300">Goals by Thrust Area</h3>
            {thrustData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={thrustData} margin={{ left: 0, right: 16 }}>
                  <XAxis dataKey="name" tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: '#737373', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#171717', border: '1px solid #262626', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="#fdb913" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-neutral-600">No goals</p>}
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* UoM Pie */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
              <h3 className="mb-4 text-sm font-semibold text-neutral-300">Goals by UoM Type</h3>
              {uomData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={uomData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`} labelLine={false} fontSize={11}>
                      {uomData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#171717', border: '1px solid #262626', borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#a3a3a3' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-neutral-600">No data</p>}
            </div>

            {/* Status Pie */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
              <h3 className="mb-4 text-sm font-semibold text-neutral-300">Goals by Status</h3>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`} labelLine={false} fontSize={11}>
                      {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#171717', border: '1px solid #262626', borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#a3a3a3' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-neutral-600">No data</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
