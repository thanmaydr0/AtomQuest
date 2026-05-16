import { useCallback, useEffect, useState } from 'react';
import { Share2, Plus, X, Loader2, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SkeletonTable } from '@/components/shared/Skeletons';
import type { SharedGoalMaster, User, GoalCycle } from '@/types';
import toast from 'react-hot-toast';

const THRUST_AREAS = ['Revenue Growth', 'Cost Optimisation', 'Customer Experience', 'People & Culture', 'Operational Excellence', 'Innovation'];

export default function AdminSharedGoals() {
  const [masters, setMasters] = useState<(SharedGoalMaster & { employee_count?: number })[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [cycles, setCycles] = useState<GoalCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ thrust_area: '', title: '', description: '', uom_type: 'max' as string, target_value: '', deadline_date: '', cycle_id: '' });
  const [selectedEmps, setSelectedEmps] = useState<string[]>([]);
  const [deptFilter, setDeptFilter] = useState('');

  const employees = users.filter((u) => u.role === 'employee');
  const departments = [...new Set(employees.map((u) => u.department).filter(Boolean))];
  const filteredEmps = deptFilter ? employees.filter((e) => e.department === deptFilter) : employees;

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: m }, { data: u }, { data: c }] = await Promise.all([
      supabase.from('shared_goals_master').select('*').order('created_at', { ascending: false }),
      supabase.from('users').select('*').order('name'),
      supabase.from('goal_cycles').select('*').eq('status', 'active'),
    ]);
    setMasters((m ?? []) as SharedGoalMaster[]);
    setUsers((u ?? []) as User[]);
    setCycles((c ?? []) as GoalCycle[]);

    // Count employees per shared goal
    if (m && m.length > 0) {
      const masterIds = m.map((sg: SharedGoalMaster) => sg.master_id);
      const { data: goals } = await supabase.from('goals').select('master_goal_id, owner_id').in('master_goal_id', masterIds);
      const counts = new Map<string, number>();
      for (const g of goals ?? []) { counts.set(g.master_goal_id, (counts.get(g.master_goal_id) ?? 0) + 1); }
      setMasters(m.map((sg: SharedGoalMaster) => ({ ...sg, employee_count: counts.get(sg.master_id) ?? 0 })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleEmp(id: string) {
    setSelectedEmps((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handlePush() {
    if (!form.title || !form.thrust_area || !form.cycle_id || selectedEmps.length === 0) { toast.error('Fill all required fields and select employees'); return; }
    setSaving(true);

    // 1. Create shared goal master
    const { data: masterData, error: mErr } = await supabase.from('shared_goals_master').insert({
      creator_id: (await supabase.auth.getUser()).data.user?.id,
      title: form.title, description: form.description, thrust_area: form.thrust_area,
      uom_type: form.uom_type, target_value: form.target_value ? Number(form.target_value) : null, cycle_id: form.cycle_id,
    }).select().single();

    if (mErr || !masterData) { toast.error(mErr?.message ?? 'Failed'); setSaving(false); return; }

    // 2. Insert goals for each selected employee
    const goalRows = selectedEmps.map((empId) => ({
      owner_id: empId, cycle_id: form.cycle_id, thrust_area: form.thrust_area, title: form.title,
      description: form.description, uom_type: form.uom_type,
      target_value: form.target_value ? Number(form.target_value) : null,
      deadline_date: form.deadline_date || null,
      weightage: 10, status: 'approved', master_goal_id: masterData.master_id, is_shared: true,
    }));

    const { error: gErr } = await supabase.from('goals').insert(goalRows);
    setSaving(false);
    if (gErr) { toast.error(gErr.message); return; }

    toast.success(`Shared goal pushed to ${selectedEmps.length} employee(s)`);
    setModalOpen(false); setSelectedEmps([]); setForm({ thrust_area: '', title: '', description: '', uom_type: 'max', target_value: '', deadline_date: '', cycle_id: '' });
    load();
  }

  const inp = "w-full rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white outline-none focus:border-[#fdb913]";

  if (loading) return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-800" />
      <SkeletonTable rows={5} cols={6} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Share2 className="h-6 w-6 text-[#fdb913]" />Shared Goals</h1><p className="mt-1 text-sm text-neutral-400">Push org-wide goals to employees</p></div>
        <button onClick={() => { setModalOpen(true); if (cycles[0]) setForm((f) => ({ ...f, cycle_id: cycles[0].cycle_id })); }} className="flex items-center gap-1.5 rounded-lg bg-[#fdb913] px-4 py-2 text-sm font-semibold text-black hover:bg-[#fdb913]/90"><Plus className="h-4 w-4" />Push Shared Goal</button>
      </div>

      {masters.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-800 py-16 text-center">
          <Share2 className="h-12 w-12 text-neutral-700 mb-4" />
          <h2 className="text-lg font-semibold text-neutral-400">No shared goals yet</h2>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/60">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-neutral-800 text-left">
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Title</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Thrust Area</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">UoM</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Target</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Employees</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Created</th>
            </tr></thead>
            <tbody>
              {masters.map((sg) => (
                <tr key={sg.master_id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                  <td className="px-5 py-3 font-medium text-white">{sg.title}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-[#fdb913]/10 px-2 py-0.5 text-xs text-[#fdb913]">{sg.thrust_area}</span></td>
                  <td className="px-4 py-3 text-neutral-400 capitalize">{sg.uom_type}</td>
                  <td className="px-4 py-3 text-neutral-400">{sg.target_value ?? '—'}</td>
                  <td className="px-4 py-3"><span className="flex items-center gap-1 text-neutral-300"><Users className="h-3.5 w-3.5" />{sg.employee_count ?? 0}</span></td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">{new Date(sg.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Push modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-800 bg-neutral-900/95 px-6 py-4 backdrop-blur-sm"><h2 className="text-lg font-semibold text-white">Push Shared Goal</h2><button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800"><X className="h-5 w-5" /></button></div>
            <div className="space-y-4 p-6">
              <div><label className="mb-1 block text-xs font-medium text-neutral-500">Thrust Area *</label>
                <select className={inp} value={form.thrust_area} onChange={(e) => setForm({ ...form, thrust_area: e.target.value })}>
                  <option value="">Select</option>{THRUST_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select></div>
              <div><label className="mb-1 block text-xs font-medium text-neutral-500">Title *</label><input className={inp} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><label className="mb-1 block text-xs font-medium text-neutral-500">Description</label><textarea rows={2} className={inp + ' resize-none'} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1 block text-xs font-medium text-neutral-500">UoM</label>
                  <select className={inp} value={form.uom_type} onChange={(e) => setForm({ ...form, uom_type: e.target.value })}>
                    <option value="min">Min</option><option value="max">Max</option><option value="timeline">Timeline</option><option value="zero">Zero</option>
                  </select></div>
                {(form.uom_type === 'min' || form.uom_type === 'max') && <div><label className="mb-1 block text-xs font-medium text-neutral-500">Target Value</label><input type="number" className={inp} value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value })} /></div>}
                {form.uom_type === 'timeline' && <div><label className="mb-1 block text-xs font-medium text-neutral-500">Deadline</label><input type="date" className={inp} value={form.deadline_date} onChange={(e) => setForm({ ...form, deadline_date: e.target.value })} /></div>}
              </div>
              <div><label className="mb-1 block text-xs font-medium text-neutral-500">Cycle *</label>
                <select className={inp} value={form.cycle_id} onChange={(e) => setForm({ ...form, cycle_id: e.target.value })}>
                  <option value="">Select</option>{cycles.map((c) => <option key={c.cycle_id} value={c.cycle_id}>{c.cycle_name}</option>)}
                </select></div>

              {/* Employee selector */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium text-neutral-500">Select Employees * ({selectedEmps.length} selected)</label>
                  <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-white">
                    <option value="">All Depts</option>{departments.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-800/40 p-2 space-y-1">
                  {filteredEmps.map((emp) => (
                    <label key={emp.user_id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800 cursor-pointer">
                      <input type="checkbox" checked={selectedEmps.includes(emp.user_id)} onChange={() => toggleEmp(emp.user_id)} className="rounded border-neutral-600" />
                      {emp.name} <span className="text-[10px] text-neutral-600">{emp.department}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 border-t border-neutral-800 pt-5">
                <button onClick={() => setModalOpen(false)} className="flex-1 rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800">Cancel</button>
                <button onClick={handlePush} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#fdb913] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#fdb913]/90 disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Push Goal</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
