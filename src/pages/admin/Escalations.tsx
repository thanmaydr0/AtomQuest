import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bell, BellOff, CheckCircle, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SkeletonTable } from '@/components/shared/Skeletons';
import type { EscalationLog, EscalationType, User } from '@/types';
import toast from 'react-hot-toast';

const PAGE_SIZE = 20;

const TYPE_CFG: Record<EscalationType, { label: string; color: string; icon: React.ReactNode }> = {
  initial_warning:     { label: 'Initial Warning',      color: 'bg-amber-500/15 text-amber-400 border-amber-500/20',  icon: <Bell className="h-3 w-3" /> },
  manager_escalation:  { label: 'Manager Escalation',   color: 'bg-orange-500/15 text-orange-400 border-orange-500/20', icon: <AlertTriangle className="h-3 w-3" /> },
  skip_level:          { label: 'Skip-Level',           color: 'bg-red-500/15 text-red-400 border-red-500/20',       icon: <AlertTriangle className="h-3 w-3" /> },
  checkin_reminder:    { label: 'Check-in Reminder',    color: 'bg-blue-500/15 text-blue-400 border-blue-500/20',     icon: <Bell className="h-3 w-3" /> },
};

interface EnrichedEscalation extends EscalationLog {
  emp_name: string;
  escalated_to_name: string;
}

export default function AdminEscalations() {
  const [rows, setRows] = useState<EnrichedEscalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [typeF, setTypeF] = useState('');
  const [counts, setCounts] = useState({ initial_warning: 0, manager_escalation: 0, skip_level: 0, checkin_reminder: 0 });

  const load = useCallback(async () => {
    setLoading(true);

    const { data: uData } = await supabase.from('users').select('*');
    const allUsers = (uData ?? []) as User[];
    const userMap = new Map(allUsers.map((u) => [u.user_id, u.name]));

    let query = supabase.from('escalation_logs').select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (typeF) query = query.eq('escalation_type', typeF);

    const { data, count } = await query;
    const enriched = ((data ?? []) as EscalationLog[]).map((e) => ({
      ...e,
      emp_name: userMap.get(e.user_id) ?? 'Unknown',
      escalated_to_name: e.escalated_to ? (userMap.get(e.escalated_to) ?? 'Unknown') : '—',
    }));
    setRows(enriched);
    setTotal(count ?? 0);

    // Aggregate counts (unfiltered)
    const { data: allEsc } = await supabase.from('escalation_logs').select('escalation_type');
    const c = { initial_warning: 0, manager_escalation: 0, skip_level: 0, checkin_reminder: 0 };
    for (const e of (allEsc ?? []) as { escalation_type: EscalationType }[]) {
      if (c[e.escalation_type] !== undefined) c[e.escalation_type]++;
    }
    setCounts(c);
    setLoading(false);
  }, [page, typeF]);

  useEffect(() => { load(); }, [load]);

  async function toggleResolved(id: string, currentlyResolved: boolean) {
    const { error } = await supabase.from('escalation_logs').update({
      resolved_at: currentlyResolved ? null : new Date().toISOString(),
    }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(currentlyResolved ? 'Marked unresolved' : 'Marked resolved');
    load();
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (loading) return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-800" />
      <SkeletonTable rows={10} cols={6} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><AlertTriangle className="h-6 w-6 text-[#fdb913]" />Escalations</h1>
        <p className="mt-1 text-sm text-neutral-400">Automated escalation alerts for overdue goals and check-ins</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.entries(TYPE_CFG) as [EscalationType, typeof TYPE_CFG.initial_warning][]).map(([key, cfg]) => (
          <button key={key} onClick={() => { setTypeF(typeF === key ? '' : key); setPage(0); }}
            className={`rounded-xl border p-4 text-left transition-all ${typeF === key ? 'border-[#fdb913]/50 bg-[#fdb913]/5' : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'}`}>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.color}`}>{cfg.icon}{cfg.label}</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-white">{counts[key]}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-neutral-500" />
        <select value={typeF} onChange={(e) => { setTypeF(e.target.value); setPage(0); }}
          className="rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white outline-none">
          <option value="">All Types</option>
          {Object.entries(TYPE_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {typeF && <button onClick={() => { setTypeF(''); setPage(0); }} className="flex items-center gap-1 text-xs text-neutral-500 hover:text-white"><X className="h-3.5 w-3.5" />Clear</button>}
        <span className="ml-auto text-xs text-neutral-500">{total} escalation{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-800 py-16 text-center">
          <CheckCircle className="h-10 w-10 text-emerald-700 mb-3" />
          <h2 className="text-lg font-semibold text-neutral-400">No escalations</h2>
          <p className="mt-1 text-sm text-neutral-600">All clear — no overdue items found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Timestamp</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Employee</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Type</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Escalated To</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Notified</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const cfg = TYPE_CFG[e.escalation_type];
                const resolved = !!e.resolved_at;
                return (
                  <tr key={e.id} className={`border-b border-neutral-800/50 ${resolved ? 'opacity-50' : ''} hover:bg-neutral-800/20`}>
                    <td className="px-5 py-3 text-neutral-400 text-xs">{new Date(e.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium text-white">{e.emp_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.color}`}>
                        {cfg.icon}{cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-400">{e.escalated_to_name}</td>
                    <td className="px-4 py-3">
                      {e.notified_at
                        ? <span className="flex items-center gap-1 text-xs text-emerald-400"><Bell className="h-3 w-3" />{new Date(e.notified_at).toLocaleDateString()}</span>
                        : <span className="flex items-center gap-1 text-xs text-neutral-600"><BellOff className="h-3 w-3" />Pending</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleResolved(e.id, resolved)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          resolved
                            ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                      >
                        {resolved ? 'Unresolve' : 'Resolve'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
            className="rounded-lg border border-neutral-700 p-2 text-neutral-400 hover:bg-neutral-800 disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-neutral-400">Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
            className="rounded-lg border border-neutral-700 p-2 text-neutral-400 hover:bg-neutral-800 disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
