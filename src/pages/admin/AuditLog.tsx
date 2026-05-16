import { useCallback, useEffect, useState } from 'react';
import { ScrollText, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SkeletonTable } from '@/components/shared/Skeletons';
import type { AuditLog, User } from '@/types';

const PAGE_SIZE = 20;

export default function AdminAuditLog() {
  const [logs, setLogs] = useState<(AuditLog & { user_name?: string })[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [opFilter, setOpFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Fetch users for name lookup
    const { data: uData } = await supabase.from('users').select('*');
    const allUsers = (uData ?? []) as User[];
    setUsers(allUsers);
    const userMap = new Map(allUsers.map((u) => [u.user_id, u.name]));

    // Build query
    let query = supabase.from('audit_logs').select('*', { count: 'exact' }).order('changed_at', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (opFilter) query = query.eq('operation', opFilter);
    if (userFilter) query = query.eq('changed_by', userFilter);

    const { data, count } = await query;
    const enriched = ((data ?? []) as AuditLog[]).map((l) => ({ ...l, user_name: userMap.get(l.changed_by) ?? 'System' }));
    setLogs(enriched);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, opFilter, userFilter]);

  useEffect(() => { load(); }, [load]);

  function renderDiff(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null) {
    if (!oldData && !newData) return <p className="text-xs text-neutral-600">No data</p>;
    const allKeys = new Set([...Object.keys(oldData ?? {}), ...Object.keys(newData ?? {})]);
    return (
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Old</div>
          <div className="space-y-1 rounded-lg bg-neutral-800/50 p-3 font-mono">
            {[...allKeys].map((key) => {
              const old = oldData?.[key];
              const nw = newData?.[key];
              const changed = JSON.stringify(old) !== JSON.stringify(nw);
              return (
                <div key={key} className={changed ? 'text-red-400' : 'text-neutral-500'}>
                  <span className="text-neutral-600">{key}:</span> {JSON.stringify(old ?? null)}
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">New</div>
          <div className="space-y-1 rounded-lg bg-neutral-800/50 p-3 font-mono">
            {[...allKeys].map((key) => {
              const old = oldData?.[key];
              const nw = newData?.[key];
              const changed = JSON.stringify(old) !== JSON.stringify(nw);
              return (
                <div key={key} className={changed ? 'text-amber-400' : 'text-neutral-500'}>
                  <span className="text-neutral-600">{key}:</span> {JSON.stringify(nw ?? null)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loading) return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-800" />
      <SkeletonTable rows={10} cols={5} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><ScrollText className="h-6 w-6 text-[#fdb913]" />Audit Log</h1>
        <p className="mt-1 text-sm text-neutral-400">Track all goal status changes and admin actions</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-neutral-500" />
        <select value={opFilter} onChange={(e) => { setOpFilter(e.target.value); setPage(0); }} className="rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white outline-none">
          <option value="">All Operations</option><option value="INSERT">INSERT</option><option value="UPDATE">UPDATE</option><option value="DELETE">DELETE</option>
        </select>
        <select value={userFilter} onChange={(e) => { setUserFilter(e.target.value); setPage(0); }} className="rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white outline-none">
          <option value="">All Users</option>{users.map((u) => <option key={u.user_id} value={u.user_id}>{u.name}</option>)}
        </select>
        {(opFilter || userFilter) && (
          <button onClick={() => { setOpFilter(''); setUserFilter(''); setPage(0); }} className="flex items-center gap-1 text-xs text-neutral-500 hover:text-white"><X className="h-3.5 w-3.5" />Clear</button>
        )}
        <span className="ml-auto text-xs text-neutral-500">{total} record{total !== 1 ? 's' : ''}</span>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-800 py-16 text-center">
          <ScrollText className="h-12 w-12 text-neutral-700 mb-4" />
          <h2 className="text-lg font-semibold text-neutral-400">No audit logs</h2>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/60">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-neutral-800 text-left">
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Timestamp</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">User</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Table</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Operation</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Record ID</th>
            </tr></thead>
            <tbody>
              {logs.map((l) => (
                <>
                  <tr key={l.id} onClick={() => setExpandedId(expandedId === l.id ? null : l.id)} className="border-b border-neutral-800/50 hover:bg-neutral-800/20 cursor-pointer">
                    <td className="px-5 py-3 text-neutral-400 text-xs">{new Date(l.changed_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-neutral-300">{l.user_name}</td>
                    <td className="px-4 py-3 text-neutral-400">{l.table_name}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${l.operation === 'UPDATE' ? 'bg-amber-500/15 text-amber-400' : l.operation === 'INSERT' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>{l.operation}</span></td>
                    <td className="px-4 py-3 text-neutral-500 text-xs font-mono">{l.record_id.slice(0, 8)}…</td>
                  </tr>
                  {expandedId === l.id && (
                    <tr key={l.id + '-diff'}><td colSpan={5} className="bg-neutral-950/50 px-6 py-4">{renderDiff(l.old_data, l.new_data)}</td></tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="rounded-lg border border-neutral-700 p-2 text-neutral-400 hover:bg-neutral-800 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm text-neutral-400">Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="rounded-lg border border-neutral-700 p-2 text-neutral-400 hover:bg-neutral-800 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}
