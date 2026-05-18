import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Download, Filter, X, Sheet, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { supabase } from '@/lib/supabase';
import { cachedRpc, invalidateAll } from '@/lib/analyticsCache';
import { scoreBgColor } from '@/lib/scoring';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { SkeletonCards } from '@/components/shared/Skeletons';
import type { User, GoalCycle } from '@/types';

interface AchievementRow {
  [key: string]: unknown;
  emp_name: string; department: string; manager_name: string;
  title: string; thrust_area: string; uom_type: string;
  target_value: number | null; actual: number | null;
  score: number | null; status: string; phase: string;
}

interface HeatCell { name: string; department: string; pct: number }
interface MgrEff { [k:string]:unknown; name: string; team: number; checkinsDone: number; pct: number; avgScore: number }
interface SliceD { name: string; value: number; color?: string }
interface DistributionData { thrust: SliceD[]; uom: SliceD[]; status: SliceD[] }

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

const COLORS = ['#fdb913', '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f'];
const STATUS_COLORS: Record<string, string> = { draft: '#6b7280', submitted: '#3b82f6', approved: '#10b981', locked: '#8b5cf6', returned: '#f97316' };

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

  // Google Sheets sync state
  const [syncing, setSyncing] = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncErr, setSyncErr] = useState<string | null>(null);

  // Lazy-loaded tab data
  const [empComp, setEmpComp] = useState<HeatCell[] | null>(null);
  const [mgrComp, setMgrComp] = useState<MgrEff[] | null>(null);
  const [distrib, setDistrib] = useState<DistributionData | null>(null);

  const loadCore = useCallback(async () => {
    setLoading(true);
    const [{ data: cData }, { data: uData }] = await Promise.all([
      supabase.from('goal_cycles').select('*').eq('status', 'active').limit(1).single(),
      supabase.from('users').select('*'),
    ]);
    const cy = cData as GoalCycle | null;
    const allUsers = (uData ?? []) as User[];
    setCycle(cy); setUsers(allUsers);
    if (!cy) { setLoading(false); return; }

    // Achievement rows — needs raw data for table/CSV
    const userMap = new Map(allUsers.map((u) => [u.user_id, u]));
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
        status: g.status as string, phase: ci ? ci.phase as string : '—',
      };
    });
    setRows(achRows);
    setLoading(false);
  }, []);

  // Lazy loaders for completion and distribution tabs
  const loadTab = useCallback(async (t: string) => {
    if (!cycle) return;
    try {
      if (t === 'completion' && !empComp) {
        const [heatData, mgrData] = await Promise.all([
          cachedRpc<HeatCell[]>('get_completion_heatmap', { p_cycle_id: cycle.cycle_id }),
          cachedRpc<MgrEff[]>('get_manager_effectiveness', { p_cycle_id: cycle.cycle_id, p_phase: cycle.phase }),
        ]);
        setEmpComp(heatData ?? []);
        setMgrComp(mgrData ?? []);
      }
      if (t === 'distribution' && !distrib) {
        const data = await cachedRpc<DistributionData>('get_goal_distribution', { p_cycle_id: cycle.cycle_id });
        setDistrib(data);
      }
    } catch (err) {
      console.error(`Failed to load ${t} tab:`, err);
    }
  }, [cycle, empComp, distrib]);

  useEffect(() => { loadCore(); }, [loadCore]);
  useEffect(() => { if (cycle && tab !== 'achievement') loadTab(tab); }, [cycle, tab, loadTab]);

  const handleRefresh = useCallback(async () => {
    invalidateAll();
    setEmpComp(null); setMgrComp(null); setDistrib(null);
    await loadCore();
  }, [loadCore]);

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

  async function syncToSheets() {
    setSyncing(true); setSyncErr(null); setSyncMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sheets-sync`;
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ spreadsheetId: sheetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setSheetUrl(data.spreadsheetUrl); setSheetId(data.spreadsheetId); setSyncMsg(data.message);
    } catch (err) { setSyncErr(String(err)); }
    finally { setSyncing(false); }
  }

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

  const thrustData = distrib?.thrust ?? [];
  const uomData = distrib?.uom ?? [];
  const statusData = distrib?.status?.map(d => ({ ...d, color: STATUS_COLORS[d.name] ?? '#6b7280' })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><BarChart3 className="h-6 w-6 text-[#fdb913]" />Reports</h1>
          <p className="mt-1 text-sm text-neutral-400">{cycle?.cycle_name ?? 'No active cycle'}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <button onClick={handleRefresh} className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-2.5 text-xs font-medium text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors">
              <RefreshCw className="h-3.5 w-3.5"/>Refresh
            </button>
            {!sheetUrl && (
              <input
                type="text"
                placeholder="Required: Paste Sheet URL"
                className="rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-xs text-white outline-none w-48 focus:border-[#fdb913]"
                onChange={(e) => {
                  const match = e.target.value.match(/\/d\/([a-zA-Z0-9-_]+)/);
                  if (match) setSheetId(match[1]);
                  else if (!e.target.value) setSheetId(null);
                }}
              />
            )}
            <button onClick={syncToSheets} disabled={syncing || !sheetId}
              className="flex items-center gap-2 rounded-lg bg-emerald-600/15 px-4 py-2.5 text-sm font-semibold text-emerald-400 transition-all hover:bg-emerald-600/25 disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-700/30">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sheet className="h-4 w-4" />}
              {syncing ? 'Syncing…' : sheetId ? 'Sync to Google Sheets' : 'Paste link to sync'}
            </button>
          </div>
          {sheetUrl && (
            <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors mt-2 justify-end">
              <ExternalLink className="h-3 w-3" />Open Sheet
            </a>
          )}
          {syncMsg && <p className="text-[11px] text-neutral-500 max-w-[280px] text-right">{syncMsg}</p>}
          {syncErr && <p className="text-[11px] text-red-400 max-w-[280px] text-right">{syncErr}</p>}
        </div>
      </div>

      <div className="flex gap-1 rounded-lg border border-neutral-800 bg-neutral-900/60 p-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === t.id ? 'bg-[#fdb913]/15 text-[#fdb913]' : 'text-neutral-400 hover:text-white'}`}>{t.label}</button>
        ))}
      </div>

      {/* Achievement */}
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

      {/* Completion — uses cached RPCs */}
      {tab === 'completion' && (
        empComp && mgrComp ? (
          <div className="space-y-6">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
              <p className="text-sm text-neutral-300">Employee check-in completion heatmap (all quarters)</p>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-neutral-300">Employee Completion</h3>
              <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/60">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-neutral-800 text-left">
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Employee</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Dept</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Completion %</th>
                  </tr></thead>
                  <tbody>
                    {empComp.map(e => (
                      <tr key={e.name} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                        <td className="px-5 py-3 font-medium text-white">{e.name}</td>
                        <td className="px-4 py-3 text-neutral-400">{e.department}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-20 rounded-full bg-neutral-800">
                              <div className="h-2 rounded-full bg-[#fdb913] transition-all" style={{ width: `${e.pct}%` }} />
                            </div>
                            <span className={`text-xs font-bold ${e.pct >= 75 ? 'text-emerald-400' : e.pct >= 25 ? 'text-amber-400' : 'text-neutral-500'}`}>{e.pct}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-neutral-300">Manager Team Completion</h3>
              <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/60">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-neutral-800 text-left">
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Manager</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Team Size</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Check-ins Done</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">%</th>
                  </tr></thead>
                  <tbody>
                    {mgrComp.map(m => (
                      <tr key={m.name} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                        <td className="px-5 py-3 font-medium text-white">{m.name}</td>
                        <td className="px-4 py-3 text-neutral-400">{m.team}</td>
                        <td className="px-4 py-3 text-neutral-300">{m.checkinsDone}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${m.pct === 100 ? 'bg-emerald-500/15 text-emerald-400' : m.pct > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-neutral-800 text-neutral-500'}`}>{m.pct}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : <SkeletonCards count={2} />
      )}

      {/* Distribution — uses cached RPC */}
      {tab === 'distribution' && (
        distrib ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
              <h3 className="mb-4 text-sm font-semibold text-neutral-300">Goals by Thrust Area</h3>
              {thrustData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={thrustData} margin={{ left: 0, right: 16 }}>
                    <XAxis dataKey="name" tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fill: '#737373', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#171717', border: '1px solid #262626', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" fill="#fdb913" radius={[4, 4, 0, 0]} name="Goals" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-neutral-600">No goals</p>}
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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
        ) : <SkeletonCards count={2} />
      )}
    </div>
  );
}
